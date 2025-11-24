import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// Endpoint to create missing tables (specifically stats table)
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    logger.info('Creating missing tables', undefined)
    
    const createdTables: string[] = []
    const errors: string[] = []
    
    // Check if stats table exists
    try {
      const statsTableCheck = await db.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'stats'
      `
      
      if (statsTableCheck.length === 0) {
        logger.info('Creating stats table', undefined)
        
        // Create stats table
        await db.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "stats" (
            "id" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "questionsAsked" INTEGER NOT NULL DEFAULT 0,
            "avgResponseTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "mostFrequentResponseType" TEXT,
            "totalTimeSpent" INTEGER NOT NULL DEFAULT 0,
            "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
            "averageQuestionsPerTask" DOUBLE PRECISION,
            "languagesUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
            "improvementScore" DOUBLE PRECISION,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "stats_pkey" PRIMARY KEY ("id")
          )
        `)
        
        // Create unique constraint on userId
        await db.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "stats_userId_key" ON "stats"("userId")
        `)
        
        // Create foreign key
        await db.$executeRawUnsafe(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint 
              WHERE conname = 'stats_userId_fkey'
            ) THEN
              ALTER TABLE "stats" 
              ADD CONSTRAINT "stats_userId_fkey" 
              FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            END IF;
          END $$;
        `)
        
        createdTables.push('stats')
        logger.info('Stats table created successfully', undefined)
      }
    } catch (error) {
      const errorMsg = `Failed to create stats table: ${error instanceof Error ? error.message : 'Unknown error'}`
      errors.push(errorMsg)
      logger.error(errorMsg, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    // Check other critical tables
    const criticalTables = [
      { name: 'chat_sessions', sql: `
        CREATE TABLE IF NOT EXISTS "chat_sessions" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "title" TEXT NOT NULL DEFAULT 'New Chat',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
        )
      ` },
      { name: 'messages', sql: `
        CREATE TABLE IF NOT EXISTS "messages" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "chatSessionId" TEXT,
          "role" TEXT NOT NULL,
          "content" TEXT NOT NULL,
          "questionType" TEXT,
          "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
        )
      ` }
    ]
    
    for (const table of criticalTables) {
      try {
        const tableCheck = await db.$queryRaw<Array<{ tablename: string }>>`
          SELECT tablename 
          FROM pg_tables 
          WHERE schemaname = 'public' AND tablename = ${table.name}
        `
        
        if (tableCheck.length === 0) {
          await db.$executeRawUnsafe(table.sql)
          createdTables.push(table.name)
          logger.info(`Table ${table.name} created`, undefined)
        }
      } catch (error) {
        errors.push(`Failed to create ${table.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    if (errors.length > 0 && createdTables.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create tables',
        errors,
        createdTables: []
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Tables created successfully',
      createdTables,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    logger.error('Error creating tables', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({
      success: false,
      error: 'Failed to create tables',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

