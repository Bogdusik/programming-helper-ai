import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// Diagnostic endpoint to check admin panel data
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const results: {
      timestamp: string
      user?: {
        id?: string
        email?: string
        role?: string
      }
      database: {
        user?: {
          id?: string
          role?: string
          isBlocked?: boolean
          error?: string
        }
        users?: {
          total?: number
          active?: number
          blocked?: number
          error?: string
        }
        messages?: {
          total?: number
          userMessages?: number
          error?: string
        }
        sessions?: number
        chatSessions?: {
          total?: number
          userSessions?: number
          error?: string
        }
        stats?: {
          totalRecords?: number
          userStats?: {
            questionsAsked: number
            tasksCompleted: number
            totalTimeSpent: number
          } | null
          error?: string
        }
        dashboardStats?: {
          totalUsers?: number
          totalMessages?: number
          totalSessions?: number
          avgResponseTime?: number
          success?: boolean
          error?: string
        }
      }
      errors?: string[]
    } = {
      timestamp: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.emailAddresses?.[0]?.emailAddress
      },
      database: {}
    }

    // Check user in database
    try {
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          role: true,
          isBlocked: true
        }
      })
      results.database.user = dbUser || undefined
    } catch (error) {
      results.database.user = { error: error instanceof Error ? error.message : 'Unknown' }
    }

    // Check stats table
    try {
      const statsCount = await db.stats.count()
      const userStats = await db.stats.findUnique({
        where: { userId: user.id }
      })
      results.database.stats = {
        totalRecords: statsCount,
        userStats: userStats ? {
          questionsAsked: userStats.questionsAsked,
          tasksCompleted: userStats.tasksCompleted,
          totalTimeSpent: userStats.totalTimeSpent
        } : null
      }
    } catch (error) {
      results.database.stats = { error: error instanceof Error ? error.message : 'Unknown' }
    }

    // Check messages table
    try {
      const messagesCount = await db.message.count()
      const userMessagesCount = await db.message.count({
        where: { userId: user.id }
      })
      results.database.messages = {
        total: messagesCount,
        userMessages: userMessagesCount
      }
    } catch (error) {
      results.database.messages = { error: error instanceof Error ? error.message : 'Unknown' }
    }

    // Check chat_sessions table
    try {
      const sessionsCount = await db.chatSession.count()
      const userSessionsCount = await db.chatSession.count({
        where: { userId: user.id }
      })
      results.database.chatSessions = {
        total: sessionsCount,
        userSessions: userSessionsCount
      }
      results.database.sessions = sessionsCount
    } catch (error) {
      results.database.chatSessions = { error: error instanceof Error ? error.message : 'Unknown' }
    }

    // Check users table
    try {
      const usersCount = await db.user.count()
      const activeUsersCount = await db.user.count({
        where: { isBlocked: false }
      })
      results.database.users = {
        total: usersCount,
        active: activeUsersCount,
        blocked: usersCount - activeUsersCount
      }
    } catch (error) {
      results.database.users = { error: error instanceof Error ? error.message : 'Unknown' }
    }

    // Check if we can query admin dashboard stats (simulate the query)
    try {
      const [totalUsers, totalMessages, totalSessions, avgResponseTime] = await Promise.all([
        db.user.count(),
        db.message.count(),
        db.chatSession.count(),
        db.stats.aggregate({
          _avg: { avgResponseTime: true }
        })
      ])

      results.database.dashboardStats = {
        totalUsers,
        totalMessages,
        totalSessions,
        avgResponseTime: avgResponseTime._avg.avgResponseTime || 0,
        success: true
      }
    } catch (error) {
      results.database.dashboardStats = {
        error: error instanceof Error ? error.message : 'Unknown',
        success: false
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    logger.error('Error checking admin data', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({
      error: 'Failed to check admin data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

