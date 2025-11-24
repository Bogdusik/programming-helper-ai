import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// Universal endpoint to sync database schema with Prisma schema
// This adds ALL missing columns from the User model
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    logger.info('Starting database schema sync', undefined)
    
    // All columns from User model in schema.prisma
    const allColumns = [
      // Core fields
      { name: 'role', type: 'VARCHAR(255)', default: "'user'", notNull: true },
      { name: 'isBlocked', type: 'BOOLEAN', default: 'false', notNull: true },
      { name: 'createdAt', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP', notNull: true },
      { name: 'updatedAt', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP', notNull: true },
      
      // Profile fields
      { name: 'selfReportedLevel', type: 'VARCHAR(255)', default: 'NULL', notNull: false },
      { name: 'assessedLevel', type: 'VARCHAR(255)', default: 'NULL', notNull: false },
      { name: 'learningGoals', type: 'TEXT[]', default: "'{}'", notNull: false },
      { name: 'aiExperience', type: 'VARCHAR(255)', default: 'NULL', notNull: false },
      { name: 'initialConfidence', type: 'INTEGER', default: 'NULL', notNull: false },
      { name: 'preferredLanguages', type: 'TEXT[]', default: "'{}'", notNull: false },
      { name: 'primaryLanguage', type: 'VARCHAR(255)', default: 'NULL', notNull: false },
      { name: 'onboardingCompleted', type: 'BOOLEAN', default: 'false', notNull: true },
      { name: 'onboardingStep', type: 'INTEGER', default: '0', notNull: true },
      { name: 'showTooltips', type: 'BOOLEAN', default: 'true', notNull: true },
      { name: 'profileCompleted', type: 'BOOLEAN', default: 'false', notNull: true },
    ]

    const addedColumns: string[] = []
    const errors: string[] = []

    for (const col of allColumns) {
      try {
        // Check if column exists
        const result = await db.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = ${col.name}
        `
        
        if (result.length === 0) {
          logger.info(`Adding missing column: ${col.name}`, undefined)
          
          // Add column
          const addColumnSQL = `ALTER TABLE users ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}${col.default !== 'NULL' ? ` DEFAULT ${col.default}` : ''}`
          await db.$executeRawUnsafe(addColumnSQL)
          
          // Update existing rows with default value (only for NOT NULL columns)
          if (col.notNull && col.default !== 'NULL') {
            const updateSQL = `UPDATE users SET "${col.name}" = ${col.default} WHERE "${col.name}" IS NULL`
            await db.$executeRawUnsafe(updateSQL)
            
            // Make NOT NULL if required
            const alterSQL = `ALTER TABLE users ALTER COLUMN "${col.name}" SET NOT NULL`
            await db.$executeRawUnsafe(alterSQL)
          }
          
          addedColumns.push(col.name)
          logger.info(`Column ${col.name} added successfully`, undefined)
        }
      } catch (colError: any) {
        const errorMsg = `Failed to add column ${col.name}: ${colError instanceof Error ? colError.message : 'Unknown error'}`
        errors.push(errorMsg)
        logger.error(errorMsg, undefined, {
          error: colError instanceof Error ? colError.message : 'Unknown error',
          stack: colError instanceof Error ? colError.stack : undefined
        })
        // Continue with other columns even if one fails
      }
    }

    if (errors.length > 0 && addedColumns.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Failed to add columns',
        errors,
        addedColumns: []
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: `Database schema synced successfully!`,
      addedColumns,
      errors: errors.length > 0 ? errors : undefined,
      totalColumns: allColumns.length,
      columnsAdded: addedColumns.length
    })
  } catch (error) {
    logger.error('Error syncing database schema', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ 
      error: 'Failed to sync database schema',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

