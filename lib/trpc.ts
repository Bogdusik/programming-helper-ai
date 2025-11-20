import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { db } from './db'
import { getCurrentUser } from './auth'
import { generateResponse, generateChatTitle, analyzeQuestionType, checkAssessmentAnswer } from './openai'
import { detectLanguage } from './prompts'
import { rateLimit } from './rate-limit'
import { logger } from './logger'
import { trackUserAction } from './analytics'
import { checkPostAssessmentEligibility } from './assessment-utils'
import { sendContactEmail } from './email'

const t = initTRPC.create()

export const router = t.router
export const publicProcedure = t.procedure

/**
 * Protected procedure that requires authentication
 * Ensures user is authenticated before proceeding
 */
const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      ...ctx,
      user,
    },
  })
})

/**
 * Admin procedure that requires admin role
 * Must be used after protectedProcedure to ensure user is authenticated
 * @throws TRPCError with FORBIDDEN code if user is not admin
 */
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const { user } = ctx
  if (user.role !== 'admin') {
    throw new TRPCError({ 
      code: 'FORBIDDEN',
      message: 'Admin access required' 
    })
  }
  return next({ ctx })
})

export const appRouter = router({
  chat: router({
    // Chat Sessions
    createSession: protectedProcedure
      .input(z.object({ title: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const { user } = ctx
        const { title = "New Chat" } = input

        const session = await db.chatSession.create({
          data: {
            userId: user.id,
            title,
          },
        })

        return session
      }),

    getSessions: protectedProcedure
      .query(async ({ ctx }) => {
        const { user } = ctx
        
        // OPTIMIZATION: Only select needed fields and limit message data
        const sessions = await db.chatSession.findMany({
          where: { userId: user.id },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            createdAt: true,
            updatedAt: true,
            messages: {
              orderBy: { timestamp: 'asc' },
              take: 1,
              select: {
                id: true,
                role: true,
                content: true,
                timestamp: true,
              },
            },
          },
        })

        return sessions
      }),

    deleteSession: protectedProcedure
      .input(z.object({ 
        sessionId: z.string().min(1, 'Session ID is required')
      }))
      .mutation(async ({ input, ctx }) => {
        const { user } = ctx
        const { sessionId } = input

        // Check if session exists and belongs to user
        const existingSession = await db.chatSession.findFirst({
          where: {
            id: sessionId,
            userId: user.id,
          },
        })

        if (!existingSession) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Session not found',
          })
        }

        // Check if this session is associated with any task progress
        const taskProgress = await db.userTaskProgress.findMany({
          where: {
            userId: user.id,
            chatSessionId: sessionId,
            status: { in: ['in_progress', 'not_started'] }, // Only reset if task is not completed
          },
        })

        // Reset task progress for associated tasks (set status to not_started and clear chatSessionId)
        if (taskProgress.length > 0) {
          for (const progress of taskProgress) {
            await db.userTaskProgress.update({
              where: {
                userId_taskId: {
                  userId: user.id,
                  taskId: progress.taskId,
                },
              },
              data: {
                status: 'not_started',
                chatSessionId: null,
              },
            })
          }
        }

        // Delete the session
        await db.chatSession.delete({
          where: {
            id: sessionId,
            userId: user.id,
          },
        })

        logger.info('Session deleted', user.id, {
          sessionId,
          tasksReset: taskProgress.length,
        })

        return { 
          success: true,
          tasksReset: taskProgress.length, // Return count for frontend to invalidate queries
        }
      }),

    updateSessionTitle: protectedProcedure
      .input(z.object({ 
        sessionId: z.string().min(1, 'Session ID is required'),
        title: z.string()
          .min(1, 'Title is required')
          .max(100, 'Title is too long (max 100 characters)')
          .trim()
      }))
      .mutation(async ({ input, ctx }) => {
        const { user } = ctx
        const { sessionId, title } = input

        // Check if session exists and belongs to user
        const existingSession = await db.chatSession.findFirst({
          where: {
            id: sessionId,
            userId: user.id,
          },
        })

        if (!existingSession) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Session not found',
          })
        }

        const session = await db.chatSession.update({
          where: {
            id: sessionId,
            userId: user.id,
          },
          data: { title },
        })

        return session
      }),

    // Messages
    sendMessage: protectedProcedure
      .input(z.object({ 
        message: z.string()
          .min(1, "Message cannot be empty")
          .max(2000, "Message too long (max 2000 characters)")
          .regex(/^[\s\S]*$/, "Invalid characters in message")
          .transform((msg) => msg.trim()),
        sessionId: z.string().optional()
      }))
      .mutation(async ({ input, ctx }) => {
        const { message, sessionId } = input
        const { user } = ctx

        // Rate limiting: 10 requests per minute per user
        const rateLimitResult = rateLimit(user.id, 10, 60000)
        if (!rateLimitResult.success) {
          logger.warn('Rate limit exceeded', user.id, { 
            remaining: rateLimitResult.remaining,
            resetTime: rateLimitResult.resetTime 
          })
          trackUserAction('rate_limit_exceeded', user.id)
          
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)} seconds.`
          })
        }

        let currentSessionId = sessionId

        // If no session provided, create a new one
        if (!currentSessionId) {
          // Generate smart title using AI
          const smartTitle = await generateChatTitle(message)
          
          const session = await db.chatSession.create({
            data: {
              userId: user.id,
              title: smartTitle,
            },
          })
          currentSessionId = session.id
        } else {
          // Verify that the session exists and belongs to the user
          const existingSession = await db.chatSession.findFirst({
            where: {
              id: currentSessionId,
              userId: user.id,
            },
          })
          
          // If session doesn't exist, create a new one
          if (!existingSession) {
            logger.warn('Session not found, creating new one', user.id, { sessionId: currentSessionId })
            const smartTitle = await generateChatTitle(message)
            
            const newSession = await db.chatSession.create({
              data: {
                userId: user.id,
                title: smartTitle,
              },
            })
            currentSessionId = newSession.id
          }
        }

        // OPTIMIZATION: Run parallel queries for better performance
        // Detect language synchronously (fast operation)
        const detectedLanguage = detectLanguage(message)
        
        // Parallel fetch: conversation history, user data, task context, and question type analysis
        const [
          previousMessages,
          userData,
          taskProgress,
          questionType
        ] = await Promise.all([
          // Get conversation history (only if session exists)
          currentSessionId ? db.message.findMany({
            where: { 
              userId: user.id,
              chatSessionId: currentSessionId 
            },
            orderBy: { timestamp: 'asc' },
            take: 20, // Last 20 messages for context
            select: {
              role: true,
              content: true
            }
          }) : Promise.resolve([]),
          
          // Get user's primary language as fallback
          db.user.findUnique({
            where: { id: user.id },
            select: { primaryLanguage: true, preferredLanguages: true },
          }),
          
          // Check if this session is associated with a task
          currentSessionId ? db.userTaskProgress.findFirst({
            where: {
              userId: user.id,
              chatSessionId: currentSessionId,
              status: { in: ['in_progress', 'not_started'] }
            },
            include: {
              task: {
                select: {
                  title: true,
                  description: true,
                  language: true,
                  difficulty: true,
                  hints: true
                }
              }
            }
          }) : Promise.resolve(null),
          
          // Analyze question type (can run in parallel, doesn't block message creation)
          analyzeQuestionType(message).catch(() => 'General Programming') // Fallback on error
        ])
        
        // Build conversation history from fetched messages
        const conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = 
          previousMessages.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          }))
        
        // Use detected language, or fall back to primary language, or 'general'
        const languageToUse = detectedLanguage !== 'general' 
          ? detectedLanguage 
          : (userData?.primaryLanguage || 'general')

        // Build task context if available
        const taskContext: { title: string; description: string; language: string; difficulty: string; hints?: string[] } | null = 
          taskProgress?.task ? {
            title: taskProgress.task.title,
            description: taskProgress.task.description,
            language: taskProgress.task.language,
            difficulty: taskProgress.task.difficulty,
            hints: taskProgress.task.hints || []
          } : null

        // Create user message with cached question type (non-blocking)
        const userMessagePromise = db.message.create({
          data: {
            userId: user.id,
            chatSessionId: currentSessionId,
            role: 'user',
            content: message,
            questionType: questionType, // Cache the question type
          },
        })

        // Wait for user message to be created
        await userMessagePromise
        
        const startTime = Date.now()
        // Generate response with conversation history for context and task context if available
        const response = await generateResponse(message, conversationHistory, taskContext)
        const responseTime = (Date.now() - startTime) / 1000 // Convert to seconds
        
        // OPTIMIZATION: Batch database operations - create assistant message and update session in parallel
        const [assistantMessage] = await Promise.all([
          // Create assistant message
          db.message.create({
            data: {
              userId: user.id,
              chatSessionId: currentSessionId,
              role: 'assistant',
              content: response,
            },
          }),
          
          // Update session timestamp (non-blocking)
          db.chatSession.update({
            where: { id: currentSessionId },
            data: { updatedAt: new Date() },
          }).catch(err => {
            logger.error('Error updating session timestamp', user.id, { error: err })
          })
        ])
        
        // OPTIMIZATION: Check message count and update title asynchronously (don't block response)
        if (currentSessionId) {
          db.message.count({
            where: { chatSessionId: currentSessionId }
          }).then(messageCount => {
            if (messageCount === 2) { // User message + Assistant response
              // Update title asynchronously - don't block the response
              generateChatTitle(message).then(enhancedTitle => {
                db.chatSession.update({
                  where: { id: currentSessionId },
                  data: { title: enhancedTitle }
                }).catch(error => {
                  logger.error('Error updating session title', user.id, {
                    error: error instanceof Error ? error.message : 'Unknown error'
                  })
                })
              }).catch(error => {
                logger.error('Error generating chat title', user.id, {
                  error: error instanceof Error ? error.message : 'Unknown error'
                })
              })
            }
          }).catch(err => {
            logger.error('Error counting messages', user.id, { error: err })
          })
        }
        
        // Log successful message (non-blocking)
        logger.info('Message sent successfully', user.id, { 
          messageLength: message.length,
          responseTime,
          sessionId: currentSessionId 
        })
        trackUserAction('message_sent', user.id, { 
          messageLength: message.length,
          responseTime 
        })

        // OPTIMIZATION: Update stats and language progress asynchronously (don't block response)
        // This significantly improves response time for users
        Promise.all([
          // Update stats with response time and question type
          (async () => {
            const existingStats = await db.stats.findUnique({
              where: { userId: user.id },
              select: {
                questionsAsked: true,
                avgResponseTime: true
              }
            })

            if (existingStats) {
              // Calculate new average response time
              const totalQuestions = existingStats.questionsAsked + 1
              const newAvgResponseTime = totalQuestions > 0
                ? ((existingStats.avgResponseTime * existingStats.questionsAsked) + responseTime) / totalQuestions
                : responseTime
              
              // Get user messages with cached question types (optimized query - only select needed fields)
              const userMessages = await db.message.findMany({
                where: { 
                  userId: user.id,
                  role: 'user',
                  questionType: { not: null }
                },
                orderBy: { timestamp: 'desc' },
                take: 10,
                select: {
                  questionType: true
                }
              })
              
              // Count question types using cached values
              const typeCounts: Record<string, number> = {}
              for (const msg of userMessages) {
                if (msg.questionType) {
                  typeCounts[msg.questionType] = (typeCounts[msg.questionType] || 0) + 1
                }
              }
              
              // Add current question type
              typeCounts[questionType] = (typeCounts[questionType] || 0) + 1
              
              // Find most frequent type
              const mostFrequentType = Object.entries(typeCounts)
                .sort(([,a], [,b]) => b - a)[0]?.[0] || questionType
              
              await db.stats.update({
                where: { userId: user.id },
                data: {
                  questionsAsked: { increment: 1 },
                  avgResponseTime: newAvgResponseTime,
                  mostFrequentResponseType: mostFrequentType,
                },
              })
            } else {
              await db.stats.create({
                data: {
                  userId: user.id,
                  questionsAsked: 1,
                  avgResponseTime: responseTime,
                  mostFrequentResponseType: questionType,
                },
              })
            }
          })(),
          
          // Update LanguageProgress for the detected/used language
          languageToUse !== 'general' ? db.languageProgress.upsert({
            where: {
              userId_language: {
                userId: user.id,
                language: languageToUse,
              },
            },
            create: {
              userId: user.id,
              language: languageToUse,
              questionsAsked: 1,
              lastUsedAt: new Date(),
            },
            update: {
              questionsAsked: { increment: 1 },
              lastUsedAt: new Date(),
            },
          }) : Promise.resolve()
        ]).catch(err => {
          // Log errors but don't fail the request
          logger.error('Error updating stats/language progress', user.id, {
            error: err instanceof Error ? err.message : 'Unknown error'
          })
        })

        return { response, sessionId: currentSessionId }
      }),

    getMessages: protectedProcedure
      .input(z.object({ sessionId: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        const { user } = ctx
        const { sessionId } = input
        
        // OPTIMIZATION: Only select needed fields to reduce data transfer
        if (sessionId) {
          // Get messages for specific session
          const messages = await db.message.findMany({
            where: { 
              userId: user.id,
              chatSessionId: sessionId,
            },
            orderBy: { timestamp: 'asc' },
            select: {
              id: true,
              role: true,
              content: true,
              timestamp: true,
              questionType: true, // Keep for potential future use
            },
          })
          return messages
        } else {
          // Get all messages (for backward compatibility) - limit to prevent huge queries
          const messages = await db.message.findMany({
            where: { userId: user.id },
            orderBy: { timestamp: 'desc' }, // Most recent first
            take: 100, // Limit to prevent performance issues
            select: {
              id: true,
              role: true,
              content: true,
              timestamp: true,
              chatSessionId: true,
              questionType: true,
            },
          })
          // Reverse to get chronological order
          return messages.reverse()
        }
      }),
  }),

  auth: router({
    getMyRole: protectedProcedure
      .query(async ({ ctx }) => {
        const { user } = ctx
        return {
          role: user.role,
          id: user.id
        }
      }),
  }),

  stats: router({
    getUserStats: protectedProcedure
      .query(async ({ ctx }) => {
        const { user } = ctx
        
        let stats = await db.stats.findUnique({
          where: { userId: user.id },
        })

        // Create stats record if it doesn't exist (for new users)
        if (!stats) {
          stats = await db.stats.create({
            data: {
              userId: user.id,
              questionsAsked: 0,
              avgResponseTime: 0,
              totalTimeSpent: 0,
              tasksCompleted: 0,
              languagesUsed: [],
            },
          })
          return stats
        }

        // OPTIMIZATION: Fix any discrepancies in tasksCompleted count
        // Recalculate from actual data to ensure accuracy
        const actualCompletedTasks = await db.userTaskProgress.count({
          where: {
            userId: user.id,
            status: 'completed',
          },
        })

        // If count doesn't match, fix it
        if (stats.tasksCompleted !== actualCompletedTasks) {
          stats = await db.stats.update({
            where: { userId: user.id },
            data: {
              tasksCompleted: actualCompletedTasks,
            },
          })
        }

        return stats
      }),

    getGlobalStats: publicProcedure
      .query(async () => {
        try {
          // OPTIMIZATION: All queries in parallel for maximum performance
          const [userStats, messageStats, activeUsers] = await Promise.all([
            db.user.count(),
            db.message.groupBy({
              by: ['role'],
              _count: {
                role: true
              }
            }),
            db.user.count({
              where: {
                messages: {
                  some: {
                    role: 'user'
                  }
                }
              }
            })
          ])

          const userMessages = messageStats.find(stat => stat.role === 'user')?._count.role || 0
          const assistantMessages = messageStats.find(stat => stat.role === 'assistant')?._count.role || 0

          return {
            totalUsers: userStats,
            activeUsers,
            totalQuestions: userMessages,
            totalSolutions: assistantMessages
          }
        } catch (error) {
          // Silently handle database connection errors for public endpoint
          // Only log a brief message in development mode
          if (process.env.NODE_ENV === 'development') {
            const errorMessage = error instanceof Error ? error.message : String(error)
            // Only log if it's a connection error (not other DB errors)
            if (errorMessage.includes('Can\'t reach database') || errorMessage.includes('connect')) {
              console.warn('⚠️  Database connection issue - stats will show 0. Make sure PostgreSQL is running and run: npm run db:push')
            } else {
              console.error('Error fetching global stats:', errorMessage)
            }
          }
          return {
            totalUsers: 0,
            activeUsers: 0,
            totalQuestions: 0,
            totalSolutions: 0
          }
        }
      }),
  }),

  admin: router({
    getDashboardStats: adminProcedure
      .query(async () => {
        try {
          const now = new Date()
          const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

          // Get user statistics
          const [totalUsers, activeUsers24h, activeUsers7d, newUsers24h, newUsers7d] = await Promise.all([
            db.user.count(),
            db.user.count({
              where: {
                messages: {
                  some: {
                    timestamp: { gte: last24Hours }
                  }
                }
              }
            }),
            db.user.count({
              where: {
                messages: {
                  some: {
                    timestamp: { gte: last7Days }
                  }
                }
              }
            }),
            db.user.count({
              where: {
                createdAt: { gte: last24Hours }
              }
            }),
            db.user.count({
              where: {
                createdAt: { gte: last7Days }
              }
            })
          ])

          // Get message statistics
          const [totalMessages, messages24h, messages7d] = await Promise.all([
            db.message.count(),
            db.message.count({
              where: {
                timestamp: { gte: last24Hours }
              }
            }),
            db.message.count({
              where: {
                timestamp: { gte: last7Days }
              }
            })
          ])

          // Get message distribution by role
          const messageStats = await db.message.groupBy({
            by: ['role'],
            _count: {
              role: true
            }
          })

          const userMessages = messageStats.find(stat => stat.role === 'user')?._count.role || 0
          const assistantMessages = messageStats.find(stat => stat.role === 'assistant')?._count.role || 0

          // Get chat sessions statistics
          const [totalSessions, sessions24h, sessions7d] = await Promise.all([
            db.chatSession.count(),
            db.chatSession.count({
              where: {
                createdAt: { gte: last24Hours }
              }
            }),
            db.chatSession.count({
              where: {
                createdAt: { gte: last7Days }
              }
            })
          ])

          // Get question type distribution
          const questionTypes = await db.stats.findMany({
            where: {
              mostFrequentResponseType: { not: null }
            },
            select: {
              mostFrequentResponseType: true
            }
          })

          const typeCounts: Record<string, number> = {}
          questionTypes.forEach(stat => {
            if (stat.mostFrequentResponseType) {
              typeCounts[stat.mostFrequentResponseType] = (typeCounts[stat.mostFrequentResponseType] || 0) + 1
            }
          })

          // Calculate average response time
          const allStats = await db.stats.findMany({
            where: {
              avgResponseTime: { gt: 0 }
            },
            select: {
              avgResponseTime: true
            }
          })

          const avgResponseTime = allStats.length > 0
            ? allStats.reduce((sum, stat) => sum + stat.avgResponseTime, 0) / allStats.length
            : 0

          return {
            users: {
              total: totalUsers,
              active24h: activeUsers24h,
              active7d: activeUsers7d,
              new24h: newUsers24h,
              new7d: newUsers7d
            },
            messages: {
              total: totalMessages,
              last24h: messages24h,
              last7d: messages7d,
              userMessages,
              assistantMessages
            },
            sessions: {
              total: totalSessions,
              last24h: sessions24h,
              last7d: sessions7d
            },
            analytics: {
              avgResponseTime: Math.round(avgResponseTime * 10) / 10, // Round to 1 decimal
              questionTypeDistribution: typeCounts
            }
          }
        } catch (error) {
          logger.error('Error fetching admin dashboard stats', undefined, { error })
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch dashboard statistics'
          })
        }
      }),

    getUsers: adminProcedure
      .input(z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional()
      }))
      .query(async ({ input }) => {
        const { page, limit, search } = input
        const skip = (page - 1) * limit

        const where = search && search.trim()
          ? {
              id: {
                contains: search.trim(),
                mode: 'insensitive' as const
              }
            }
          : {}

        const [users, total] = await Promise.all([
          db.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            distinct: ['id'], // Ensure no duplicates
            include: {
              _count: {
                select: {
                  messages: true,
                  chatSessions: true
                }
              }
            }
          }),
          db.user.count({ where })
        ])

        // Additional safety: filter out any potential duplicates by ID
        const uniqueUsers = Array.from(
          new Map(users.map(user => [user.id, user])).values()
        )

        return {
          users: uniqueUsers,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      }),

    exportData: adminProcedure
      .input(z.object({
        format: z.enum(['json', 'markdown', 'txt']).default('json')
      }))
      .mutation(async ({ input }) => {
        const { format } = input
        
        // Get all sessions with messages
        const sessions = await db.chatSession.findMany({
          include: {
            messages: {
              orderBy: { timestamp: 'asc' }
            },
            user: {
              select: {
                id: true,
                role: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        })
        
        switch (format) {
          case 'json':
            return {
              format: 'json',
              data: JSON.stringify(sessions, null, 2),
              filename: `admin-export-${Date.now()}.json`,
              mimeType: 'application/json'
            }
            
          case 'markdown':
            let markdown = '# Admin Data Export\n\n'
            markdown += `*Generated: ${new Date().toLocaleString()}*\n\n`
            markdown += `## Summary\n\n`
            markdown += `- Total Sessions: ${sessions.length}\n`
            markdown += `- Total Messages: ${sessions.reduce((sum, s) => sum + s.messages.length, 0)}\n\n`
            markdown += `---\n\n`
            
            sessions.forEach((session, idx) => {
              markdown += `## Session ${idx + 1}: ${session.title}\n\n`
              markdown += `*Created: ${session.createdAt.toLocaleString()}*\n`
              markdown += `*User ID: ${session.userId}*\n\n`
              
              session.messages.forEach(msg => {
                markdown += `### ${msg.role === 'user' ? 'User' : 'AI Assistant'}\n`
                markdown += `${msg.content}\n\n`
                markdown += `*${msg.timestamp.toLocaleString()}*\n\n---\n\n`
              })
            })
            
            return {
              format: 'markdown',
              data: markdown,
              filename: `admin-export-${Date.now()}.md`,
              mimeType: 'text/markdown'
            }
            
          case 'txt':
            let text = 'ADMIN DATA EXPORT\n'
            text += '='.repeat(50) + '\n\n'
            text += `Generated: ${new Date().toLocaleString()}\n`
            text += `Total Sessions: ${sessions.length}\n`
            text += `Total Messages: ${sessions.reduce((sum, s) => sum + s.messages.length, 0)}\n`
            text += '='.repeat(50) + '\n\n'
            
            sessions.forEach((session, idx) => {
              text += `SESSION ${idx + 1}: ${session.title}\n`
              text += `Created: ${session.createdAt.toLocaleString()}\n`
              text += `User ID: ${session.userId}\n`
              text += '-'.repeat(50) + '\n\n'
              
              session.messages.forEach(msg => {
                text += `[${msg.role.toUpperCase()}] ${msg.timestamp.toLocaleString()}\n`
                text += `${msg.content}\n\n`
              })
              text += '\n' + '='.repeat(50) + '\n\n'
            })
            
            return {
              format: 'txt',
              data: text,
              filename: `admin-export-${Date.now()}.txt`,
              mimeType: 'text/plain'
            }
        }
      }),

    // ========== TASKS MANAGEMENT ==========
    getAllTasks: adminProcedure
      .input(z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        language: z.string().optional(),
        difficulty: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        const { page, limit, search, language, difficulty, isActive } = input
        const skip = (page - 1) * limit

        const where: {
          OR?: Array<{ title?: { contains: string; mode: 'insensitive' }; description?: { contains: string; mode: 'insensitive' } }>
          language?: string
          difficulty?: string
          isActive?: boolean
        } = {}
        if (search && search.trim()) {
          where.OR = [
            { title: { contains: search.trim(), mode: 'insensitive' } },
            { description: { contains: search.trim(), mode: 'insensitive' } },
          ]
        }
        if (language) {
          where.language = language.toLowerCase()
        }
        if (difficulty) {
          where.difficulty = difficulty.toLowerCase()
        }
        if (isActive !== undefined) {
          where.isActive = isActive
        }

        const [tasks, total] = await Promise.all([
          db.programmingTask.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
              _count: {
                select: {
                  userProgress: true,
                },
              },
            },
          }),
          db.programmingTask.count({ where }),
        ])

        return {
          tasks,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        }
      }),

    getTask: adminProcedure
      .input(z.object({ taskId: z.string() }))
      .query(async ({ input }) => {
        const task = await db.programmingTask.findUnique({
          where: { id: input.taskId },
          include: {
            _count: {
              select: {
                userProgress: true,
              },
            },
            userProgress: {
              take: 10,
              orderBy: { completedAt: 'desc' },
              include: {
                user: {
                  select: {
                    id: true,
                    role: true,
                  },
                },
              },
            },
          },
        })

        if (!task) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Task not found',
          })
        }

        return task
      }),

    createTask: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        language: z.string().min(1),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
        category: z.string().min(1),
        starterCode: z.string().optional(),
        hints: z.array(z.string()).optional(),
        solution: z.string().optional(),
        testCases: z.any().optional(),
        isActive: z.boolean().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        const task = await db.programmingTask.create({
          data: {
            ...input,
            language: input.language.toLowerCase(),
            difficulty: input.difficulty.toLowerCase(),
            category: input.category.toLowerCase(),
          },
        })

        logger.info('Task created', ctx.user.id, { taskId: task.id, title: task.title })
        return task
      }),

    updateTask: adminProcedure
      .input(z.object({
        taskId: z.string(),
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        language: z.string().min(1).optional(),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
        category: z.string().min(1).optional(),
        starterCode: z.string().optional().nullable(),
        hints: z.array(z.string()).optional(),
        solution: z.string().optional().nullable(),
        testCases: z.any().optional().nullable(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { taskId, ...updateData } = input

        const task = await db.programmingTask.update({
          where: { id: taskId },
          data: {
            ...updateData,
            ...(updateData.language && { language: updateData.language.toLowerCase() }),
            ...(updateData.difficulty && { difficulty: updateData.difficulty.toLowerCase() }),
            ...(updateData.category && { category: updateData.category.toLowerCase() }),
          },
        })

        logger.info('Task updated', ctx.user.id, { taskId: task.id })
        return task
      }),

    deleteTask: adminProcedure
      .input(z.object({ taskId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await db.programmingTask.delete({
          where: { id: input.taskId },
        })

        logger.info('Task deleted', ctx.user.id, { taskId: input.taskId })
        return { success: true }
      }),

    getTaskStats: adminProcedure
      .query(async () => {
        const [totalTasks, activeTasks, tasksByDifficulty, tasksByLanguage, completedTasks] = await Promise.all([
          db.programmingTask.count(),
          db.programmingTask.count({ where: { isActive: true } }),
          db.programmingTask.groupBy({
            by: ['difficulty'],
            _count: { id: true },
          }),
          db.programmingTask.groupBy({
            by: ['language'],
            _count: { id: true },
          }),
          db.userTaskProgress.count({
            where: { status: 'completed' },
          }),
        ])

        return {
          totalTasks,
          activeTasks,
          inactiveTasks: totalTasks - activeTasks,
          tasksByDifficulty: tasksByDifficulty.reduce((acc, item) => {
            acc[item.difficulty] = item._count.id
            return acc
          }, {} as Record<string, number>),
          tasksByLanguage: tasksByLanguage.reduce((acc, item) => {
            acc[item.language] = item._count.id
            return acc
          }, {} as Record<string, number>),
          completedTasks,
        }
      }),

    // ========== USER MANAGEMENT ==========
    getUserDetails: adminProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input }) => {
        const user = await db.user.findUnique({
          where: { id: input.userId },
          include: {
            stats: true,
            profile: true,
            _count: {
              select: {
                messages: true,
                chatSessions: true,
                taskProgress: true,
                assessments: true,
              },
            },
            languageProgress: {
              orderBy: { lastUsedAt: 'desc' },
              take: 5,
            },
            taskProgress: {
              where: { status: 'completed' },
              take: 10,
              orderBy: { completedAt: 'desc' },
              include: {
                task: {
                  select: {
                    id: true,
                    title: true,
                    language: true,
                    difficulty: true,
                  },
                },
              },
            },
            assessments: {
              orderBy: { completedAt: 'desc' },
              take: 5,
            },
          },
        })

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          })
        }

        // Calculate additional stats
        const now = new Date()
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        const [messages24h, messages7d, sessions24h, sessions7d] = await Promise.all([
          db.message.count({
            where: {
              userId: input.userId,
              timestamp: { gte: last24Hours },
            },
          }),
          db.message.count({
            where: {
              userId: input.userId,
              timestamp: { gte: last7Days },
            },
          }),
          db.chatSession.count({
            where: {
              userId: input.userId,
              createdAt: { gte: last24Hours },
            },
          }),
          db.chatSession.count({
            where: {
              userId: input.userId,
              createdAt: { gte: last7Days },
            },
          }),
        ])

        return {
          ...user,
          activityStats: {
            messages24h,
            messages7d,
            sessions24h,
            sessions7d,
          },
        }
      }),

    toggleUserBlock: adminProcedure
      .input(z.object({
        userId: z.string(),
        isBlocked: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if user is admin - prevent blocking admins
        const targetUser = await db.user.findUnique({
          where: { id: input.userId },
          select: { role: true },
        })

        if (!targetUser) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          })
        }

        if (targetUser.role === 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin users cannot be blocked',
          })
        }

        const user = await db.user.update({
          where: { id: input.userId },
          data: { 
            isBlocked: input.isBlocked 
          } as { isBlocked: boolean },
        })

        logger.info(`User ${input.isBlocked ? 'blocked' : 'unblocked'}`, ctx.user.id, {
          targetUserId: input.userId,
        })

        return user
      }),

    deleteUser: adminProcedure
      .input(z.object({
        userId: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if user exists
        const targetUser = await db.user.findUnique({
          where: { id: input.userId },
          select: { role: true },
        })

        if (!targetUser) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          })
        }

        // Prevent deleting admin users
        if (targetUser.role === 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin users cannot be deleted',
          })
        }

        // Delete all user data in a transaction to ensure atomicity
        // This prevents race conditions where user might be recreated during deletion
        await db.$transaction(async (tx) => {
          // Delete all user data in correct order to respect foreign key constraints
          await tx.message.deleteMany({
            where: { userId: input.userId }
          })

          await tx.chatSession.deleteMany({
            where: { userId: input.userId }
          })

          await tx.assessment.deleteMany({
            where: { userId: input.userId }
          })

          await tx.languageProgress.deleteMany({
            where: { userId: input.userId }
          })

          await tx.userTaskProgress.deleteMany({
            where: { userId: input.userId }
          })

          await tx.stats.deleteMany({
            where: { userId: input.userId }
          })

          await tx.userProfile.deleteMany({
            where: { userId: input.userId }
          })

          // Finally delete the user
          await tx.user.delete({
            where: { id: input.userId }
          })
        })

        logger.info('User deleted', ctx.user.id, {
          deletedUserId: input.userId,
        })

        return { success: true }
      }),

    // ========== VISUALIZATION DATA ==========
    getActivityChart: adminProcedure
      .input(z.object({
        days: z.number().min(1).max(365).default(7),
        type: z.enum(['messages', 'users', 'sessions']).default('messages'),
      }))
      .query(async ({ input }) => {
        const { days, type } = input
        const now = new Date()
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

        const data: Array<{ date: string; count: number }> = []

        for (let i = 0; i < days; i++) {
          const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
          const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000)
          const dateStr = date.toISOString().split('T')[0]

          let count = 0
          if (type === 'messages') {
            count = await db.message.count({
              where: {
                timestamp: {
                  gte: date,
                  lt: nextDate,
                },
              },
            })
          } else if (type === 'users') {
            count = await db.user.count({
              where: {
                createdAt: {
                  gte: date,
                  lt: nextDate,
                },
              },
            })
          } else if (type === 'sessions') {
            count = await db.chatSession.count({
              where: {
                createdAt: {
                  gte: date,
                  lt: nextDate,
                },
              },
            })
          }

          data.push({ date: dateStr, count })
        }

        return data
      }),

    getLanguageDistribution: adminProcedure
      .query(async () => {
        const distribution = await db.languageProgress.groupBy({
          by: ['language'],
          _sum: {
            questionsAsked: true,
            tasksCompleted: true,
          },
          _count: {
            userId: true,
          },
        })

        return distribution.map((item) => ({
          language: item.language,
          users: item._count.userId,
          questionsAsked: item._sum.questionsAsked || 0,
          tasksCompleted: item._sum.tasksCompleted || 0,
        }))
      }),

    // ========== FILTERS AND REPORTS ==========
    getFilteredStats: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        language: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { startDate, endDate } = input

        const where: {
          timestamp?: {
            gte?: Date
            lte?: Date
          }
        } = {}
        if (startDate || endDate) {
          where.timestamp = {}
          if (startDate) {
            where.timestamp.gte = new Date(startDate)
          }
          if (endDate) {
            where.timestamp.lte = new Date(endDate)
          }
        }

        const [totalMessages, userMessages, assistantMessages] = await Promise.all([
          db.message.count({ where }),
          db.message.count({
            where: {
              ...where,
              role: 'user',
            },
          }),
          db.message.count({
            where: {
              ...where,
              role: 'assistant',
            },
          }),
        ])

        return {
          totalMessages,
          userMessages,
          assistantMessages,
          period: {
            start: startDate || null,
            end: endDate || null,
          },
        }
      }),

    exportReport: adminProcedure
      .input(z.object({
        format: z.enum(['csv', 'json']).default('csv'),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        type: z.enum(['users', 'messages', 'sessions', 'tasks']).default('users'),
      }))
      .mutation(async ({ input }) => {
        const { format, startDate, endDate, type } = input

        const dateFilter: {
          timestamp?: { gte?: Date; lte?: Date }
          createdAt?: { gte?: Date; lte?: Date }
        } = {}
        if (startDate || endDate) {
          const field = type === 'messages' ? 'timestamp' : 'createdAt'
          if (field === 'timestamp') {
            dateFilter.timestamp = {}
            if (startDate) dateFilter.timestamp.gte = new Date(startDate)
            if (endDate) dateFilter.timestamp.lte = new Date(endDate)
          } else {
            dateFilter.createdAt = {}
            if (startDate) dateFilter.createdAt.gte = new Date(startDate)
            if (endDate) dateFilter.createdAt.lte = new Date(endDate)
          }
        }

        let data: Array<Record<string, unknown>> = []
        let filename = ''

        if (type === 'users') {
          const users = await db.user.findMany({
            where: dateFilter,
            include: {
              _count: {
                select: {
                  messages: true,
                  chatSessions: true,
                  taskProgress: true,
                },
              },
            },
          })
          data = users.map((u) => ({
            id: u.id,
            role: u.role,
            isBlocked: (u as any).isBlocked ?? false,
            createdAt: u.createdAt.toISOString(),
            messages: u._count.messages,
            sessions: u._count.chatSessions,
            tasks: u._count.taskProgress,
          }))
          filename = `users-export-${Date.now()}.${format}`
        } else if (type === 'messages') {
          const messages = await db.message.findMany({
            where: dateFilter,
            take: 10000, // Limit for performance
            select: {
              id: true,
              userId: true,
              role: true,
              timestamp: true,
              questionType: true,
            },
          })
          data = messages.map((m) => ({
            id: m.id,
            userId: m.userId,
            role: m.role,
            timestamp: m.timestamp.toISOString(),
            questionType: m.questionType,
          }))
          filename = `messages-export-${Date.now()}.${format}`
        } else if (type === 'sessions') {
          const sessions = await db.chatSession.findMany({
            where: dateFilter,
            include: {
              _count: {
                select: {
                  messages: true,
                },
              },
            },
          })
          data = sessions.map((s) => ({
            id: s.id,
            userId: s.userId,
            title: s.title,
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString(),
            messageCount: s._count.messages,
          }))
          filename = `sessions-export-${Date.now()}.${format}`
        } else if (type === 'tasks') {
          const tasks = await db.programmingTask.findMany({
            where: dateFilter,
            include: {
              _count: {
                select: {
                  userProgress: true,
                },
              },
            },
          })
          data = tasks.map((t) => ({
            id: t.id,
            title: t.title,
            language: t.language,
            difficulty: t.difficulty,
            category: t.category,
            isActive: t.isActive,
            createdAt: t.createdAt.toISOString(),
            completions: t._count.userProgress,
          }))
          filename = `tasks-export-${Date.now()}.${format}`
        }

        if (format === 'csv') {
          if (data.length === 0) {
            return {
              format: 'csv',
              data: '',
              filename,
              mimeType: 'text/csv',
            }
          }

          const headers = Object.keys(data[0])
          const csvRows = [
            headers.join(','),
            ...data.map((row) =>
              headers.map((header) => {
                const value = row[header]
                if (value === null || value === undefined) return ''
                if (typeof value === 'object') return JSON.stringify(value)
                return String(value).replace(/,/g, ';')
              }).join(',')
            ),
          ]

          return {
            format: 'csv' as const,
            data: csvRows.join('\n'),
            filename,
            mimeType: 'text/csv' as const,
          }
        } else {
          return {
            format: 'json' as const,
            data: JSON.stringify(data, null, 2),
            filename,
            mimeType: 'application/json' as const,
          }
        }
      }),

    // ========== SYSTEM SETTINGS ==========
    getSystemSettings: adminProcedure
      .query(async () => {
        // Return current system settings (can be extended with a settings table)
        return {
          openai: {
            model: process.env.OPENAI_MODEL || 'gpt-4',
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
            maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
          },
          rateLimit: {
            enabled: true,
            requestsPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60'),
          },
        }
      }),

    // ========== MONITORING ==========
    getErrorLogs: adminProcedure
      .input(z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        level: z.enum(['error', 'warn', 'info']).optional(),
      }))
      .query(async ({ input }) => {
        // Get logs from logger (stored in memory)
        const allLogs = logger.getLogs()
        
        // Filter by level if specified
        let filteredLogs = allLogs
        if (input.level) {
          filteredLogs = allLogs.filter(log => log.level === input.level)
        }
        
        // Sort by timestamp (newest first)
        filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        
        // Paginate
        const startIndex = (input.page - 1) * input.limit
        const endIndex = startIndex + input.limit
        const paginatedLogs = filteredLogs.slice(startIndex, endIndex)
        
        // Format logs for display
        const formattedLogs = paginatedLogs.map(log => ({
          level: log.level,
          message: log.message,
          timestamp: log.timestamp.toISOString(),
          userId: log.userId,
          metadata: log.metadata,
        }))
        
        return {
          logs: formattedLogs,
          pagination: {
            page: input.page,
            limit: input.limit,
            total: filteredLogs.length,
            totalPages: Math.ceil(filteredLogs.length / input.limit),
          },
        }
      }),

    getAdminActivity: adminProcedure
      .input(z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
      }))
      .query(async ({ input }) => {
        // Get logs from logger and filter for admin actions
        // Admin actions are logged with info level and contain admin-related messages
        const allLogs = logger.getLogs()
        
        // Filter for admin-related activities (block/unblock, delete user, etc.)
        const adminActivityKeywords = ['blocked', 'unblocked', 'deleted', 'created', 'updated', 'admin']
        const adminActivities = allLogs.filter(log => 
          log.level === 'info' && 
          adminActivityKeywords.some(keyword => 
            log.message.toLowerCase().includes(keyword.toLowerCase())
          )
        )
        
        // Sort by timestamp (newest first)
        adminActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        
        // Paginate
        const startIndex = (input.page - 1) * input.limit
        const endIndex = startIndex + input.limit
        const paginatedActivities = adminActivities.slice(startIndex, endIndex)
        
        // Format activities for display
        const formattedActivities = paginatedActivities.map(activity => ({
          action: activity.message,
          timestamp: activity.timestamp.toISOString(),
          adminUserId: activity.userId,
          metadata: activity.metadata,
        }))
        
        return {
          activities: formattedActivities,
          pagination: {
            page: input.page,
            limit: input.limit,
            total: adminActivities.length,
            totalPages: Math.ceil(adminActivities.length / input.limit),
          },
        }
      }),
  }),

  profile: router({
    updateProfile: protectedProcedure
      .input(z.object({
        experience: z.string().optional(),
        focusAreas: z.array(z.string()).optional(),
        confidence: z.number().min(1).max(5).optional(),
        aiExperience: z.string().optional(),
        preferredLanguages: z.array(z.string()).optional(),
        primaryLanguage: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { user } = ctx
        
        // Update user profile
        const updatedUser = await db.user.update({
          where: { id: user.id },
          data: {
            selfReportedLevel: input.experience,
            learningGoals: input.focusAreas,
            initialConfidence: input.confidence,
            aiExperience: input.aiExperience,
            preferredLanguages: input.preferredLanguages,
            primaryLanguage: input.primaryLanguage,
            profileCompleted: true,
          },
        })

        // Create or update user profile
        await db.userProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            experience: input.experience,
            focusAreas: input.focusAreas || [],
            confidence: input.confidence,
            aiExperience: input.aiExperience,
          },
          update: {
            experience: input.experience,
            focusAreas: input.focusAreas,
            confidence: input.confidence,
            aiExperience: input.aiExperience,
          },
        })

        // Update language progress
        if (input.preferredLanguages) {
          for (const lang of input.preferredLanguages) {
            await db.languageProgress.upsert({
              where: {
                userId_language: {
                  userId: user.id,
                  language: lang,
                },
              },
              create: {
                userId: user.id,
                language: lang,
                lastUsedAt: new Date(),
              },
              update: {
                lastUsedAt: new Date(),
              },
            })
          }
        }

        return updatedUser
      }),

    getProfile: protectedProcedure
      .query(async ({ ctx }) => {
        const { user } = ctx
        
        const profile = await db.userProfile.findUnique({
          where: { userId: user.id },
        })

        return {
          ...user,
          profile,
        }
      }),

    updateLanguages: protectedProcedure
      .input(z.object({
        preferredLanguages: z.array(z.string()),
        primaryLanguage: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { user } = ctx
        
        const updatedUser = await db.user.update({
          where: { id: user.id },
          data: {
            preferredLanguages: input.preferredLanguages,
            primaryLanguage: input.primaryLanguage,
          },
        })

        // Update language progress
        for (const lang of input.preferredLanguages) {
          await db.languageProgress.upsert({
            where: {
              userId_language: {
                userId: user.id,
                language: lang,
              },
            },
            create: {
              userId: user.id,
              language: lang,
              lastUsedAt: new Date(),
            },
            update: {
              lastUsedAt: new Date(),
            },
          })
        }

        return updatedUser
      }),

    getLanguageProgress: protectedProcedure
      .query(async ({ ctx }) => {
        const { user } = ctx
        
        const progress = await db.languageProgress.findMany({
          where: { userId: user.id },
          orderBy: { lastUsedAt: 'desc' },
        })

        return progress
      }),
  }),

  assessment: router({
    getQuestions: protectedProcedure
      .input(z.object({
        type: z.enum(['pre', 'post']),
        language: z.string().optional(),
        difficulty: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { user } = ctx
        
        let difficulty = input.difficulty
        let excludedQuestionIds: string[] = []
        
        if (input.type === 'post') {
          // For post-assessment: get pre-assessment results
          const preAssessment = await db.assessment.findFirst({
            where: {
              userId: user.id,
              type: 'pre',
            },
            orderBy: { completedAt: 'desc' },
          })
          
          if (preAssessment) {
            // Extract question IDs from pre-assessment answers
            const preAnswers = preAssessment.answers as any
            if (Array.isArray(preAnswers)) {
              excludedQuestionIds = preAnswers
                .map((a: any) => a?.questionId)
                .filter((id: any): id is string => typeof id === 'string' && id.length > 0)
            }
            
            // Determine difficulty based on pre-assessment performance
            const preScore = preAssessment.score || 0
            const preTotal = preAssessment.totalQuestions || 15
            const prePercentage = (preScore / preTotal) * 100
            
            // Get the difficulty level used in pre-assessment
            // We'll infer it from the user's assessed level
            const userProfile = await db.user.findUnique({
              where: { id: user.id },
              select: { assessedLevel: true },
            })
            
            const assessedLevel = userProfile?.assessedLevel || 'beginner'
            
            // If user scored >= 80% in pre-assessment, use harder questions
            // Otherwise, use same difficulty level but different questions
            if (prePercentage >= 80) {
              // Use harder difficulty
              if (assessedLevel === 'beginner') {
                difficulty = 'intermediate'
              } else if (assessedLevel === 'intermediate') {
                difficulty = 'advanced'
              } else {
                // Already advanced, stay at advanced
                difficulty = 'advanced'
              }
            } else {
              // Use same difficulty as pre-assessment
              difficulty = assessedLevel === 'expert' ? 'advanced' 
                          : assessedLevel === 'advanced' ? 'advanced'
                          : assessedLevel === 'intermediate' ? 'intermediate'
                          : 'beginner'
            }
          } else {
            // No pre-assessment found, fall back to default logic
            const userProfile = await db.user.findUnique({
              where: { id: user.id },
              select: { selfReportedLevel: true, assessedLevel: true },
            })
            
            const level = userProfile?.assessedLevel || userProfile?.selfReportedLevel || 'beginner'
            difficulty = level === 'expert' ? 'advanced' : level === 'advanced' ? 'intermediate' : 'beginner'
          }
        } else {
          // For pre-assessment: use default logic
          if (!difficulty) {
            const userProfile = await db.user.findUnique({
              where: { id: user.id },
              select: { selfReportedLevel: true, assessedLevel: true },
            })
            
            const level = userProfile?.assessedLevel || userProfile?.selfReportedLevel || 'beginner'
            difficulty = level === 'expert' ? 'advanced' : level === 'advanced' ? 'intermediate' : 'beginner'
          }
        }

        // Get all available questions for the difficulty and language
        // Exclude questions that were already used in pre-assessment
        const allQuestions = await db.assessmentQuestion.findMany({
          where: {
            language: input.language || null, // If no language specified, get general questions (language = null)
            difficulty: difficulty,
            ...(excludedQuestionIds.length > 0 ? { id: { notIn: excludedQuestionIds } } : {}),
          },
        })

        // If not enough questions, get more from general (excluding pre-assessment questions)
        let questions = allQuestions
        if (allQuestions.length < 10) {
          const generalQuestions = await db.assessmentQuestion.findMany({
            where: {
              language: null,
              difficulty: difficulty,
              ...(excludedQuestionIds.length > 0 ? { id: { notIn: excludedQuestionIds } } : {}),
            },
          })
          // Combine and remove duplicates
          const questionIds = new Set(allQuestions.map(q => q.id))
          questions = [
            ...allQuestions,
            ...generalQuestions.filter(q => !questionIds.has(q.id))
          ]
        }

        // If still not enough questions after excluding pre-assessment ones,
        // allow reusing some questions (but prefer new ones)
        if (questions.length < 15 && input.type === 'post') {
          const fallbackQuestions = await db.assessmentQuestion.findMany({
            where: {
              language: input.language || null, // If no language specified, get general questions
              difficulty: difficulty,
            },
            take: 20, // Get more to have options
          })
          
          // Combine, prioritizing questions not in pre-assessment
          const existingIds = new Set(questions.map(q => q.id))
          const newQuestions = fallbackQuestions.filter(q => !existingIds.has(q.id))
          questions = [...questions, ...newQuestions].slice(0, 20)
        }

        // Define categories for comprehensive assessment (like real tech interviews)
        // Map existing categories to new interview-style categories
        const categoryMapping: Record<string, string[]> = {
          'attention_to_detail': ['attention_to_detail', 'debugging'],
          'problem_solving': ['problem_solving', 'algorithms', 'logic'],
          'code_quality': ['code_quality', 'syntax'],
          'algorithms': ['algorithms'],
          'data_structures': ['data_structures'],
          'syntax': ['syntax'],
          'debugging': ['debugging'],
          'logic': ['logic']
        }
        
        // Group questions by category
        const questionsByCategory: Record<string, typeof questions> = {}
        for (const [newCategory, oldCategories] of Object.entries(categoryMapping)) {
          questionsByCategory[newCategory] = questions.filter(q => 
            oldCategories.includes(q.category.toLowerCase())
          )
        }
        
        // Also group by exact category match
        for (const question of questions) {
          const category = question.category.toLowerCase()
          if (!questionsByCategory[category]) {
            questionsByCategory[category] = []
          }
          if (!questionsByCategory[category].includes(question)) {
            questionsByCategory[category].push(question)
          }
        }
        
        // Select questions from each category (4-5 per category for 25-30 total)
        const targetTotal = 30
        const categories = Object.keys(questionsByCategory).filter(cat => questionsByCategory[cat].length > 0)
        const questionsPerCategory = Math.floor(targetTotal / Math.max(categories.length, 1))
        const selectedQuestions: typeof questions = []
        const usedQuestionIds = new Set<string>()
        
        // First pass: select questions from each category
        for (const category of categories) {
          const categoryQuestions = questionsByCategory[category] || []
          if (categoryQuestions.length > 0) {
            // Shuffle category questions
            const shuffled = [...categoryQuestions].filter(q => !usedQuestionIds.has(q.id))
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
            }
            // Take questions from this category
            const toTake = Math.min(questionsPerCategory, shuffled.length)
            const selected = shuffled.slice(0, toTake)
            selectedQuestions.push(...selected)
            selected.forEach(q => usedQuestionIds.add(q.id))
          }
        }
        
        // If we don't have enough questions from categories, fill with random questions
        if (selectedQuestions.length < 25) {
          const remainingQuestions = questions.filter(q => !usedQuestionIds.has(q.id))
          const shuffled = [...remainingQuestions]
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
          }
          const needed = Math.min(30 - selectedQuestions.length, shuffled.length)
          selectedQuestions.push(...shuffled.slice(0, needed))
        }
        
        // Final shuffle of all selected questions
        const finalShuffled = [...selectedQuestions]
        for (let i = finalShuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [finalShuffled[i], finalShuffled[j]] = [finalShuffled[j], finalShuffled[i]]
        }
        
        // Return 25-30 questions (prefer 30, but at least 25)
        return finalShuffled.slice(0, Math.max(25, Math.min(30, finalShuffled.length)))
      }),

    submitAssessment: protectedProcedure
      .input(z.object({
        type: z.enum(['pre', 'post']),
        language: z.string().optional(),
        answers: z.array(z.object({
          questionId: z.string(),
          answer: z.string(),
          isCorrect: z.boolean().optional(), // Optional - will be checked on server for open questions
        })),
        confidence: z.number().min(1).max(5),
      }))
      .mutation(async ({ input, ctx }) => {
        const { user } = ctx
        
        // Get all questions to check answers properly
        const questionIds = input.answers.map(a => a.questionId)
        const questions = await db.assessmentQuestion.findMany({
          where: { id: { in: questionIds } }
        })
        
        // Create a map for quick lookup
        const questionMap = new Map(questions.map(q => [q.id, q]))
        
        // Check answers - use AI for open questions, exact match for multiple choice
        const checkedAnswers = await Promise.all(
          input.answers.map(async (answer) => {
            const question = questionMap.get(answer.questionId)
            if (!question) {
              // If question not found, use client-provided isCorrect
              return { ...answer, isCorrect: answer.isCorrect ?? false }
            }
            
            // For multiple choice, use exact match (client check is usually correct)
            if (question.type === 'multiple_choice') {
              const isCorrect = answer.answer.trim() === question.correctAnswer.trim()
              return { ...answer, isCorrect }
            }
            
            // For open questions (code_snippet, conceptual), use AI to check
            if (question.type === 'code_snippet' || question.type === 'conceptual') {
              try {
                const isCorrect = await checkAssessmentAnswer(
                  question.question,
                  answer.answer,
                  question.correctAnswer,
                  question.type as 'code_snippet' | 'conceptual'
                )
                return { ...answer, isCorrect }
              } catch (error) {
                // Fallback to client-provided value or case-insensitive comparison
                const isCorrect = answer.isCorrect ?? 
                  (answer.answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase())
                return { ...answer, isCorrect }
              }
            }
            
            // Fallback for unknown types
            return { ...answer, isCorrect: answer.isCorrect ?? false }
          })
        )
        
        const score = checkedAnswers.filter(a => a.isCorrect).length
        const totalQuestions = checkedAnswers.length

        // Determine assessed level based on score
        const percentage = (score / totalQuestions) * 100
        let assessedLevel = 'beginner'
        if (percentage >= 80) assessedLevel = 'advanced'
        else if (percentage >= 60) assessedLevel = 'intermediate'

        const assessment = await db.assessment.create({
          data: {
            userId: user.id,
            type: input.type,
            language: input.language,
            score,
            totalQuestions,
            confidence: input.confidence,
            answers: checkedAnswers as any,
          },
        })

        // Update user's assessed level if it's pre-assessment
        if (input.type === 'pre') {
          await db.user.update({
            where: { id: user.id },
            data: { assessedLevel },
          })
        } else {
          // Calculate improvement score for post-assessment
          const preAssessment = await db.assessment.findFirst({
            where: {
              userId: user.id,
              type: 'pre',
            },
            orderBy: { completedAt: 'desc' },
          })

          if (preAssessment) {
            const preScore = preAssessment.score || 0
            const preTotal = preAssessment.totalQuestions || 15
            const prePercentage = (preScore / preTotal) * 100
            
            // Get user's assessed level to determine if post-assessment used harder questions
            const userProfile = await db.user.findUnique({
              where: { id: user.id },
              select: { assessedLevel: true },
            })
            
            const assessedLevel = userProfile?.assessedLevel || 'beginner'
            
            // If pre-assessment was >= 80%, post-assessment should have used harder questions
            // In this case, maintaining the same score or improving is actually an improvement
            // Safety check: ensure totalQuestions > 0 to avoid division by zero
            if (totalQuestions <= 0) {
              logger.warn('Invalid totalQuestions in post-assessment', user.id, {
                totalQuestions,
                score
              })
              // Skip improvement score calculation if invalid
              return assessment
            }
            
            const postPercentage = (score / totalQuestions) * 100
            let improvementScore = 0
            
            if (prePercentage >= 80) {
              // Post-assessment used harder questions
              // If score is same or better, it's an improvement
              // Calculate improvement considering the difficulty increase
              const rawImprovement = score - preScore
              // Add bonus for maintaining performance on harder questions
              // If same score on harder questions, that's equivalent to +20% improvement
              // If better score, add extra bonus
              if (postPercentage >= prePercentage) {
                // Maintained or improved on harder questions
                improvementScore = ((rawImprovement / totalQuestions) * 100) + 20
              } else {
                // Slight decrease on harder questions is still improvement
                improvementScore = ((rawImprovement / totalQuestions) * 100) + 10
              }
            } else {
              // Post-assessment used same difficulty level
              // Standard improvement calculation
              const improvement = score - preScore
              improvementScore = (improvement / totalQuestions) * 100
            }

            await db.stats.update({
              where: { userId: user.id },
              data: { improvementScore },
            })
          }
        }

        return assessment
      }),

    getAssessments: protectedProcedure
      .query(async ({ ctx }) => {
        const { user } = ctx
        
        const assessments = await db.assessment.findMany({
          where: { userId: user.id },
          orderBy: { completedAt: 'desc' },
        })

        return assessments
      }),

    checkPostAssessmentEligibility: protectedProcedure
      .query(async ({ ctx }) => {
        const { user } = ctx
        
        const userData = await db.user.findUnique({
          where: { id: user.id },
          select: { createdAt: true },
        })

        if (!userData) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
        }

        const stats = await db.stats.findUnique({
          where: { userId: user.id },
        })

        const questionsAsked = stats?.questionsAsked || 0
        const tasksCompleted = stats?.tasksCompleted || 0
        const totalTimeSpent = stats?.totalTimeSpent || 0

        const eligibility = checkPostAssessmentEligibility(
          userData.createdAt,
          questionsAsked,
          tasksCompleted,
          totalTimeSpent
        )

        // Check if post-assessment already completed
        const postAssessment = await db.assessment.findFirst({
          where: {
            userId: user.id,
            type: 'post',
          },
        })

        return {
          ...eligibility,
          alreadyCompleted: !!postAssessment,
        }
      }),
  }),

  task: router({
    completeTask: protectedProcedure
      .input(z.object({
        taskId: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { user } = ctx
        const { taskId } = input

        // Verify task exists
        const task = await db.programmingTask.findUnique({
          where: { id: taskId },
          select: {
            id: true,
            language: true,
            title: true,
            isActive: true,
          },
        })

        if (!task) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Task not found',
          })
        }

        if (!task.isActive) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Task is not active',
          })
        }

        // Get or create task progress for this user and task
        let taskProgress = await db.userTaskProgress.findUnique({
          where: {
            userId_taskId: {
              userId: user.id,
              taskId: taskId,
            },
          },
        })

        // If no progress exists, create it
        if (!taskProgress) {
          taskProgress = await db.userTaskProgress.create({
            data: {
              userId: user.id,
              taskId: taskId,
              status: 'in_progress',
            },
          })
        }

        // Check if task is already completed
        if (taskProgress.status === 'completed') {
          return {
            success: true,
            message: 'Task already completed',
            alreadyCompleted: true,
          }
        }

        // Update task progress to completed
        await db.userTaskProgress.update({
          where: {
            userId_taskId: {
              userId: user.id,
              taskId: taskId,
            },
          },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        })

        // OPTIMIZATION: Recalculate tasksCompleted from actual data to ensure accuracy
        // This prevents counting bugs from duplicate completions or race conditions
        const actualCompletedTasks = await db.userTaskProgress.count({
          where: {
            userId: user.id,
            status: 'completed',
          },
        })

        // Get or create stats
        const existingStats = await db.stats.findUnique({
          where: { userId: user.id },
        })

        if (existingStats) {
          // Update with actual count (not increment) to ensure accuracy
          await db.stats.update({
            where: { userId: user.id },
            data: {
              tasksCompleted: actualCompletedTasks,
            },
          })
        } else {
          await db.stats.create({
            data: {
              userId: user.id,
              tasksCompleted: actualCompletedTasks,
              questionsAsked: 0,
              avgResponseTime: 0,
            },
          })
        }

        // Update LanguageProgress for the task's language
        const taskLanguage = task.language.toLowerCase()
        if (taskLanguage && taskLanguage !== 'general') {
          await db.languageProgress.upsert({
            where: {
              userId_language: {
                userId: user.id,
                language: taskLanguage,
              },
            },
            create: {
              userId: user.id,
              language: taskLanguage,
              tasksCompleted: 1,
              questionsAsked: 0,
              lastUsedAt: new Date(),
            },
            update: {
              tasksCompleted: { increment: 1 },
              lastUsedAt: new Date(),
            },
          })
        }

        logger.info('Task completed', user.id, {
          taskId,
          taskTitle: task.title,
          language: taskLanguage,
        })

        trackUserAction('task_completed', user.id, {
          taskId,
          language: taskLanguage,
        })

        return {
          success: true,
          message: 'Task completed successfully',
          alreadyCompleted: false,
        }
      }),

    getTaskProgress: protectedProcedure
      .input(z.object({
        taskId: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const { user } = ctx
        const { taskId } = input

        if (taskId) {
          // Get progress for specific task
          const progress = await db.userTaskProgress.findUnique({
            where: {
              userId_taskId: {
                userId: user.id,
                taskId: taskId,
              },
            },
            include: {
              task: true,
            },
          })
          return progress ? [progress] : []
        } else {
          // Get all task progress for user
          const progress = await db.userTaskProgress.findMany({
            where: { userId: user.id },
            include: {
              task: true,
            },
            orderBy: { updatedAt: 'desc' },
          })
          return progress
        }
      }),

    updateTaskProgress: protectedProcedure
      .input(z.object({
        taskId: z.string(),
        status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
        attempts: z.number().optional(),
        chatSessionId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { user } = ctx
        const { taskId, status, attempts, chatSessionId } = input

        // Upsert task progress
        const progress = await db.userTaskProgress.upsert({
          where: {
            userId_taskId: {
              userId: user.id,
              taskId: taskId,
            },
          },
          create: {
            userId: user.id,
            taskId: taskId,
            status: status || 'not_started',
            attempts: attempts || 0,
            chatSessionId: chatSessionId,
          },
          update: {
            ...(status && { status }),
            ...(attempts !== undefined && { attempts }),
            ...(chatSessionId !== undefined && { chatSessionId: chatSessionId || null }),
          },
        })

        return progress
      }),

    getTasks: protectedProcedure
      .input(z.object({
        language: z.string().optional(),
        languages: z.array(z.string()).optional(),
        difficulty: z.string().optional(),
        category: z.string().optional(),
        includeProgress: z.boolean().default(true),
      }))
      .query(async ({ input, ctx }) => {
        const { user } = ctx
        const { language, languages, difficulty, category, includeProgress } = input

        const where: {
          isActive: boolean
          language?: string | { in: string[] }
          difficulty?: string
          category?: string
        } = {
          isActive: true,
        }

        // Support both single language and array of languages
        if (languages && languages.length > 0) {
          where.language = {
            in: languages.map(l => l.toLowerCase()),
          }
        } else if (language) {
          where.language = language.toLowerCase()
        }
        
        if (difficulty) {
          where.difficulty = difficulty.toLowerCase()
        }
        if (category) {
          where.category = category.toLowerCase()
        }

        const tasks = await db.programmingTask.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: includeProgress
            ? {
                userProgress: {
                  where: { userId: user.id },
                  take: 1,
                },
              }
            : undefined,
        })

        return tasks
      }),

    getTask: protectedProcedure
      .input(z.object({
        taskId: z.string(),
        includeProgress: z.boolean().default(true),
      }))
      .query(async ({ input, ctx }) => {
        const { user } = ctx
        const { taskId, includeProgress } = input

        const task = await db.programmingTask.findUnique({
          where: { id: taskId },
          include: includeProgress
            ? {
                userProgress: {
                  where: { userId: user.id },
                  take: 1,
                },
              }
            : undefined,
        })

        if (!task) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Task not found',
          })
        }

        return task
      }),
  }),

  onboarding: router({
    updateOnboardingStatus: protectedProcedure
      .input(z.object({
        completed: z.boolean(),
        step: z.number().optional(),
        showTooltips: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { user } = ctx
        
        const updatedUser = await db.user.update({
          where: { id: user.id },
          data: {
            onboardingCompleted: input.completed,
            onboardingStep: input.step ?? user.onboardingStep,
            showTooltips: input.showTooltips ?? user.showTooltips,
          },
        })

        return updatedUser
      }),

    getOnboardingStatus: protectedProcedure
      .query(async ({ ctx }) => {
        const { user } = ctx
        
        return {
          onboardingCompleted: user.onboardingCompleted,
          onboardingStep: user.onboardingStep,
          showTooltips: user.showTooltips,
        }
      }),
  }),

  contact: router({
    sendMessage: publicProcedure
      .input(z.object({
        name: z.string()
          .min(1, 'Name is required')
          .max(100, 'Name is too long (max 100 characters)')
          .trim(),
        email: z.string()
          .email('Invalid email address')
          .max(255, 'Email is too long (max 255 characters)')
          .trim()
          .toLowerCase(),
        subject: z.string()
          .min(1, 'Subject is required')
          .max(200, 'Subject is too long (max 200 characters)')
          .trim(),
        message: z.string()
          .min(1, 'Message is required')
          .max(5000, 'Message is too long (max 5000 characters)')
          .trim(),
      }))
      .mutation(async ({ input }) => {
        // Rate limiting: 20 requests per hour per email
        const rateLimitResult = rateLimit(input.email, 20, 3600000) // 20 per hour
        
        if (!rateLimitResult.success) {
          logger.warn('Contact form rate limit exceeded', undefined, {
            email: input.email,
            remaining: rateLimitResult.remaining,
            resetTime: rateLimitResult.resetTime
          })
          
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: `Too many requests. Please try again in ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 60000)} minutes.`
          })
        }
        // Save to database
        const contactMessage = await db.contactMessage.create({
          data: {
            name: input.name,
            email: input.email,
            subject: input.subject,
            message: input.message,
            status: 'pending',
          },
        })

        // Send email notification
        try {
          await sendContactEmail({
            name: input.name,
            email: input.email,
            subject: input.subject,
            message: input.message,
          })
        } catch (error) {
          logger.error('Error sending email notification', undefined, {
            error: error instanceof Error ? error.message : 'Unknown error'
          })
          // Don't fail the mutation if email fails - message is still saved
        }

        return { success: true, id: contactMessage.id }
      }),
  }),
})

export type AppRouter = typeof appRouter
