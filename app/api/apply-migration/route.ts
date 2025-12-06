import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * Apply database migration for examples and constraints fields
 * This endpoint adds the new fields to programming_tasks table if they don't exist
 */
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    logger.info('Applying migration for examples and constraints fields')

    // Check if columns already exist by trying to query them
    try {
      await db.$queryRaw`
        SELECT "examples", "constraints" FROM "programming_tasks" LIMIT 1
      `
      logger.info('Migration already applied - columns exist')
      return NextResponse.json({ 
        success: true, 
        message: 'Migration already applied - columns exist' 
      })
    } catch {
      // Columns don't exist, need to add them
      logger.info('Columns do not exist, applying migration...')
    }

    // Apply migration
    await db.$executeRaw`
      ALTER TABLE "programming_tasks" 
      ADD COLUMN IF NOT EXISTS "examples" JSONB,
      ADD COLUMN IF NOT EXISTS "constraints" TEXT[] DEFAULT ARRAY[]::TEXT[]
    `

    logger.info('Migration applied successfully')
    
    return NextResponse.json({ 
      success: true, 
      message: 'Migration applied successfully' 
    })
  } catch (error) {
    logger.error('Error applying migration', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    
    return NextResponse.json({
      success: false,
      error: 'Failed to apply migration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

