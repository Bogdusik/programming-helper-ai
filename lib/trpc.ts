import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { db } from './db'
import { getCurrentUser } from './auth'
import { generateResponse, generateChatTitle, analyzeQuestionType } from './openai'
import { rateLimit } from './rate-limit'
import { logger } from './logger'
import { trackUserAction, trackError } from './analytics'

const t = initTRPC.create()

export const router = t.router
export const publicProcedure = t.procedure

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
        
        const sessions = await db.chatSession.findMany({
          where: { userId: user.id },
          orderBy: { updatedAt: 'desc' },
          include: {
            messages: {
              orderBy: { timestamp: 'asc' },
              take: 1,
            },
          },
        })

        return sessions
      }),

    deleteSession: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const { user } = ctx
        const { sessionId } = input

        await db.chatSession.delete({
          where: {
            id: sessionId,
            userId: user.id,
          },
        })

        return { success: true }
      }),

    updateSessionTitle: protectedProcedure
      .input(z.object({ sessionId: z.string(), title: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const { user } = ctx
        const { sessionId, title } = input

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
        }

        // Create user message
        await db.message.create({
          data: {
            userId: user.id,
            chatSessionId: currentSessionId,
            role: 'user',
            content: message,
          },
        })

        const startTime = Date.now()
        const response = await generateResponse(message)
        const responseTime = (Date.now() - startTime) / 1000 // Convert to seconds
        
        // Log successful message
        logger.info('Message sent successfully', user.id, { 
          messageLength: message.length,
          responseTime,
          sessionId: currentSessionId 
        })
        trackUserAction('message_sent', user.id, { 
          messageLength: message.length,
          responseTime 
        })
        
        // Analyze question type
        const questionType = await analyzeQuestionType(message)

        // Create assistant message
        await db.message.create({
          data: {
            userId: user.id,
            chatSessionId: currentSessionId,
            role: 'assistant',
            content: response,
          },
        })

        // Update session timestamp
        await db.chatSession.update({
          where: { id: currentSessionId },
          data: { updatedAt: new Date() },
        })

        // If this is the first message in the session, update the title with more context
        const messageCount = await db.message.count({
          where: { chatSessionId: currentSessionId }
        })
        
        if (messageCount === 2) { // User message + Assistant response
          try {
            const enhancedTitle = await generateChatTitle(message)
            await db.chatSession.update({
              where: { id: currentSessionId },
              data: { title: enhancedTitle }
            })
          } catch (error) {
            console.error('Error updating session title:', error)
            // Don't fail the whole operation if title update fails
          }
        }

        // Update stats with response time and question type
        const existingStats = await db.stats.findUnique({
          where: { userId: user.id }
        })

        if (existingStats) {
          // Calculate new average response time
          const newAvgResponseTime = ((existingStats.avgResponseTime * existingStats.questionsAsked) + responseTime) / (existingStats.questionsAsked + 1)
          
          // Get all user messages to analyze most frequent type
          const userMessages = await db.message.findMany({
            where: { 
              userId: user.id,
              role: 'user'
            },
            orderBy: { timestamp: 'desc' },
            take: 10 // Analyze last 10 questions
          })
          
          // Count question types (simplified - in real app you'd store types in DB)
          const typeCounts: Record<string, number> = {}
          for (const msg of userMessages) {
            try {
              const msgType = await analyzeQuestionType(msg.content)
              typeCounts[msgType] = (typeCounts[msgType] || 0) + 1
            } catch (error) {
              // Skip if analysis fails
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

        return { response, sessionId: currentSessionId }
      }),

    getMessages: protectedProcedure
      .input(z.object({ sessionId: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        const { user } = ctx
        const { sessionId } = input
        
        if (sessionId) {
          // Get messages for specific session
          const messages = await db.message.findMany({
            where: { 
              userId: user.id,
              chatSessionId: sessionId,
            },
            orderBy: { timestamp: 'asc' },
          })
          return messages
        } else {
          // Get all messages (for backward compatibility)
          const messages = await db.message.findMany({
            where: { userId: user.id },
            orderBy: { timestamp: 'asc' },
          })
          return messages
        }
      }),
  }),

  stats: router({
    getUserStats: protectedProcedure
      .query(async ({ ctx }) => {
        const { user } = ctx
        
        const stats = await db.stats.findUnique({
          where: { userId: user.id },
        })

        return stats
      }),

    getGlobalStats: publicProcedure
      .query(async () => {
        try {
          // Optimized: Single query with aggregation
          const [userStats, messageStats] = await Promise.all([
            db.user.count(),
            db.message.groupBy({
              by: ['role'],
              _count: {
                role: true
              }
            })
          ])

          const activeUsers = await db.user.count({
            where: {
              messages: {
                some: {
                  role: 'user'
                }
              }
            }
          })

          const userMessages = messageStats.find(stat => stat.role === 'user')?._count.role || 0
          const assistantMessages = messageStats.find(stat => stat.role === 'assistant')?._count.role || 0

          return {
            totalUsers: userStats,
            activeUsers,
            totalQuestions: userMessages,
            totalSolutions: assistantMessages
          }
        } catch (error) {
          console.error('Error fetching global stats:', error)
          return {
            totalUsers: 0,
            activeUsers: 0,
            totalQuestions: 0,
            totalSolutions: 0
          }
        }
      }),
  }),
})

export type AppRouter = typeof appRouter
