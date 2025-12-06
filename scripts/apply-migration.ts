/**
 * Script to apply database migration for examples and constraints fields
 * This can be run manually or as part of deployment
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function applyMigration() {
  try {
    console.log('Checking if migration is needed...')

    // Check if columns already exist
    try {
      await prisma.$queryRaw`
        SELECT "examples", "constraints" FROM "programming_tasks" LIMIT 1
      `
      console.log('✅ Migration already applied - columns exist')
      return
    } catch (error) {
      console.log('Columns do not exist, applying migration...')
    }

    // Apply migration
    await prisma.$executeRaw`
      ALTER TABLE "programming_tasks" 
      ADD COLUMN IF NOT EXISTS "examples" JSONB,
      ADD COLUMN IF NOT EXISTS "constraints" TEXT[] DEFAULT ARRAY[]::TEXT[]
    `

    console.log('✅ Migration applied successfully!')
  } catch (error) {
    console.error('❌ Error applying migration:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

applyMigration()

