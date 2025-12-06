import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * Simple migration endpoint that can be called via GET request
 * This makes it easier to apply migrations from browser
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    logger.info('Applying migration for examples and constraints fields')

    // Check if columns already exist
    let columnsExist = false
    try {
      await db.$queryRaw`
        SELECT "examples", "constraints" FROM "programming_tasks" LIMIT 1
      `
      columnsExist = true
      logger.info('Migration already applied - columns exist')
    } catch (error) {
      // Columns don't exist, need to add them
      logger.info('Columns do not exist, applying migration...')
    }

    if (columnsExist) {
      return NextResponse.json({ 
        success: true, 
        message: 'Migration already applied - columns exist',
        columns: ['examples', 'constraints']
      })
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
      message: 'Migration applied successfully! Columns examples and constraints have been added.',
      columns: ['examples', 'constraints']
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

