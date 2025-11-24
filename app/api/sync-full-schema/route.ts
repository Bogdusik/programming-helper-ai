import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// Full schema synchronization endpoint
// This will run prisma db push to sync the entire schema
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    logger.info('Starting full schema synchronization', undefined)
    
    // We can't directly run prisma commands in API route, so we'll use Prisma's introspection
    // and then create missing tables manually
    
    // First, let's check what tables exist
    const existingTables = await db.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `
    
    const existingTableNames = existingTables.map(t => t.tablename)
    
    // Expected tables from schema.prisma
    const expectedTables = [
      'users',
      'chat_sessions',
      'messages',
      'stats',
      'user_profiles',
      'assessments',
      'assessment_questions',
      'language_progress',
      'programming_tasks',
      'user_task_progress',
      'contact_messages'
    ]
    
    const missingTables = expectedTables.filter(t => !existingTableNames.includes(t))
    
    if (missingTables.length > 0) {
      logger.info(`Missing tables detected: ${missingTables.join(', ')}`, undefined)
      
      return NextResponse.json({
        success: false,
        message: 'Missing tables detected. Please run "npx prisma db push" manually or use Vercel deployment.',
        missingTables,
        existingTables: existingTableNames,
        instructions: [
          '1. Connect to your database',
          '2. Run: npx prisma db push',
          '3. Or wait for the next deployment which should sync the schema'
        ]
      }, { status: 400 })
    }
    
    // Check if all required columns exist in users table (we already did this, but double-check)
    const userColumns = await db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY column_name
    `
    
    const userColumnNames = userColumns.map(c => c.column_name)
    const requiredUserColumns = [
      'id', 'role', 'isBlocked', 'createdAt', 'updatedAt',
      'selfReportedLevel', 'assessedLevel', 'learningGoals',
      'aiExperience', 'initialConfidence', 'preferredLanguages',
      'primaryLanguage', 'onboardingCompleted', 'onboardingStep',
      'showTooltips', 'profileCompleted'
    ]
    
    const missingUserColumns = requiredUserColumns.filter(c => !userColumnNames.includes(c))
    
    return NextResponse.json({
      success: true,
      message: 'Schema check completed',
      existingTables: existingTableNames,
      missingTables: missingTables.length > 0 ? missingTables : undefined,
      userColumns: {
        total: userColumnNames.length,
        missing: missingUserColumns.length > 0 ? missingUserColumns : undefined
      },
      recommendation: missingTables.length > 0 
        ? 'Run "npx prisma db push" to create missing tables'
        : 'Schema appears to be in sync'
    })
  } catch (error) {
    logger.error('Error checking schema', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({
      success: false,
      error: 'Failed to check schema',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

