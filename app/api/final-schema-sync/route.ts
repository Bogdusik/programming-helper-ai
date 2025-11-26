import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * FINAL SCHEMA SYNCHRONIZATION ENDPOINT
 * 
 * This endpoint performs a complete schema synchronization:
 * 1. Removes old columns from users table (email, name, etc.)
 * 2. Adds all missing columns to users table
 * 3. Creates all missing tables with correct structure
 * 4. Creates all indexes and foreign keys
 * 
 * Call this ONCE after deployment to sync your database with Prisma schema.
 */
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    logger.info('Starting FINAL schema synchronization', undefined)
    
    const results: {
      removedColumns: string[]
      addedColumns: string[]
      createdTables: string[]
      errors: string[]
    } = {
      removedColumns: [],
      addedColumns: [],
      createdTables: [],
      errors: []
    }
    
    // ============================================
    // STEP 1: Create users table if it doesn't exist
    // ============================================
    try {
      // Check if users table exists
      const usersTableCheck = await db.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'users'
      `
      
      // If users table doesn't exist, create it first
      if (usersTableCheck.length === 0) {
        logger.info('Creating users table (base table)', undefined)
        
        // Create users table
        await db.$executeRawUnsafe(`CREATE TABLE "users" (
          "id" TEXT NOT NULL,
          "role" VARCHAR(255) NOT NULL DEFAULT 'user',
          "isBlocked" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          "selfReportedLevel" VARCHAR(255),
          "assessedLevel" VARCHAR(255),
          "learningGoals" TEXT[] DEFAULT ARRAY[]::TEXT[],
          "aiExperience" VARCHAR(255),
          "initialConfidence" INTEGER,
          "preferredLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
          "primaryLanguage" VARCHAR(255),
          "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
          "onboardingStep" INTEGER NOT NULL DEFAULT 0,
          "showTooltips" BOOLEAN NOT NULL DEFAULT true,
          "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
          CONSTRAINT "users_pkey" PRIMARY KEY ("id")
        )`)
        
        // Set initial updatedAt for existing rows
        await db.$executeRawUnsafe(`UPDATE "users" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL`)
        
        // Create updatedAt trigger function (separate command)
        await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW."updatedAt" = CURRENT_TIMESTAMP; RETURN NEW; END; $$ language 'plpgsql'`)
        
        // Create trigger (separate command)
        await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS update_users_updated_at ON "users"`)
        await db.$executeRawUnsafe(`CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`)
        
        results.createdTables.push('users')
        logger.info('Users table created successfully', undefined)
      }
      
      // Now fix existing users table (remove old columns, add missing ones)
      const userColumns = await db.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users'
      `
      
      const existingColumns = userColumns.map(c => c.column_name)
      const columnsToRemove = ['email', 'name', 'emailVerified', 'image']
      
      for (const col of columnsToRemove) {
        if (existingColumns.includes(col)) {
          try {
            await db.$executeRawUnsafe(`ALTER TABLE users DROP COLUMN IF EXISTS "${col}" CASCADE`)
            results.removedColumns.push(col)
            logger.info(`Removed column ${col} from users table`, undefined)
          } catch (error) {
            // Ignore errors - column might be referenced
            logger.info(`Could not remove column ${col} (may be referenced)`, undefined)
          }
        }
      }
      
      // Add missing columns to users table
      const requiredUserColumns = [
        { name: 'role', type: 'VARCHAR(255)', default: "'user'", notNull: true },
        { name: 'isBlocked', type: 'BOOLEAN', default: 'false', notNull: true },
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
      
      for (const col of requiredUserColumns) {
        if (!existingColumns.includes(col.name)) {
          try {
            const addSQL = `ALTER TABLE users ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}${col.default !== 'NULL' ? ` DEFAULT ${col.default}` : ''}`
            await db.$executeRawUnsafe(addSQL)
            
            if (col.notNull && col.default !== 'NULL') {
              await db.$executeRawUnsafe(`UPDATE users SET "${col.name}" = ${col.default} WHERE "${col.name}" IS NULL`)
              await db.$executeRawUnsafe(`ALTER TABLE users ALTER COLUMN "${col.name}" SET NOT NULL`)
            }
            
            results.addedColumns.push(col.name)
            logger.info(`Added column ${col.name} to users table`, undefined)
          } catch (error) {
            results.errors.push(`Failed to add column ${col.name}: ${error instanceof Error ? error.message : 'Unknown'}`)
          }
        }
      }
    } catch (error) {
      results.errors.push(`Error fixing users table: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
    
    // ============================================
    // STEP 2: Create all missing tables
    // ============================================
    const tablesToCreate = [
      {
        name: 'chat_sessions',
        sql: `CREATE TABLE IF NOT EXISTS "chat_sessions" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "title" TEXT NOT NULL DEFAULT 'New Chat',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
        )`,
        indexes: [
          `CREATE INDEX IF NOT EXISTS "chat_sessions_userId_updatedAt_idx" ON "chat_sessions"("userId", "updatedAt")`
        ],
        foreignKeys: [
          `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_sessions_userId_fkey') THEN ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
        ]
      },
      {
        name: 'messages',
        sql: `CREATE TABLE IF NOT EXISTS "messages" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "chatSessionId" TEXT,
          "role" TEXT NOT NULL,
          "content" TEXT NOT NULL,
          "questionType" TEXT,
          "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
        )`,
        indexes: [
          `CREATE INDEX IF NOT EXISTS "messages_userId_timestamp_idx" ON "messages"("userId", "timestamp")`,
          `CREATE INDEX IF NOT EXISTS "messages_chatSessionId_timestamp_idx" ON "messages"("chatSessionId", "timestamp")`,
          `CREATE INDEX IF NOT EXISTS "messages_role_idx" ON "messages"("role")`,
          `CREATE INDEX IF NOT EXISTS "messages_questionType_idx" ON "messages"("questionType")`
        ],
        foreignKeys: [
          `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_userId_fkey') THEN ALTER TABLE "messages" ADD CONSTRAINT "messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
          `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_chatSessionId_fkey') THEN ALTER TABLE "messages" ADD CONSTRAINT "messages_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
        ]
      },
      {
        name: 'stats',
        sql: `CREATE TABLE IF NOT EXISTS "stats" (
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
        )`,
        indexes: [
          `CREATE UNIQUE INDEX IF NOT EXISTS "stats_userId_key" ON "stats"("userId")`
        ],
        foreignKeys: [
          `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stats_userId_fkey') THEN ALTER TABLE "stats" ADD CONSTRAINT "stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
        ]
      },
      {
        name: 'user_profiles',
        sql: `CREATE TABLE IF NOT EXISTS "user_profiles" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "experience" TEXT,
          "focusAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
          "confidence" INTEGER,
          "aiExperience" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
        )`,
        indexes: [
          `CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_userId_key" ON "user_profiles"("userId")`
        ],
        foreignKeys: [
          `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_userId_fkey') THEN ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
        ]
      },
      {
        name: 'assessments',
        sql: `CREATE TABLE IF NOT EXISTS "assessments" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "language" TEXT,
          "score" INTEGER,
          "totalQuestions" INTEGER NOT NULL DEFAULT 0,
          "confidence" INTEGER NOT NULL,
          "answers" JSONB NOT NULL,
          "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
        )`,
        indexes: [
          `CREATE INDEX IF NOT EXISTS "assessments_userId_type_idx" ON "assessments"("userId", "type")`
        ],
        foreignKeys: [
          `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assessments_userId_fkey') THEN ALTER TABLE "assessments" ADD CONSTRAINT "assessments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
        ]
      },
      {
        name: 'assessment_questions',
        sql: `CREATE TABLE IF NOT EXISTS "assessment_questions" (
          "id" TEXT NOT NULL,
          "question" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "options" JSONB,
          "correctAnswer" TEXT NOT NULL,
          "category" TEXT NOT NULL,
          "difficulty" TEXT NOT NULL,
          "language" TEXT,
          "explanation" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id")
        )`,
        indexes: [
          `CREATE INDEX IF NOT EXISTS "assessment_questions_difficulty_language_idx" ON "assessment_questions"("difficulty", "language")`,
          `CREATE INDEX IF NOT EXISTS "assessment_questions_category_idx" ON "assessment_questions"("category")`
        ],
        foreignKeys: []
      },
      {
        name: 'language_progress',
        sql: `CREATE TABLE IF NOT EXISTS "language_progress" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "language" TEXT NOT NULL,
          "questionsAsked" INTEGER NOT NULL DEFAULT 0,
          "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
          "lastUsedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "language_progress_pkey" PRIMARY KEY ("id")
        )`,
        indexes: [
          `CREATE UNIQUE INDEX IF NOT EXISTS "language_progress_userId_language_key" ON "language_progress"("userId", "language")`,
          `CREATE INDEX IF NOT EXISTS "language_progress_userId_idx" ON "language_progress"("userId")`
        ],
        foreignKeys: [
          `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'language_progress_userId_fkey') THEN ALTER TABLE "language_progress" ADD CONSTRAINT "language_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
        ]
      },
      {
        name: 'programming_tasks',
        sql: `CREATE TABLE IF NOT EXISTS "programming_tasks" (
          "id" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "description" TEXT NOT NULL,
          "language" TEXT NOT NULL,
          "difficulty" TEXT NOT NULL,
          "category" TEXT NOT NULL,
          "starterCode" TEXT,
          "hints" TEXT[] DEFAULT ARRAY[]::TEXT[],
          "solution" TEXT,
          "testCases" JSONB,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "programming_tasks_pkey" PRIMARY KEY ("id")
        )`,
        indexes: [
          `CREATE INDEX IF NOT EXISTS "programming_tasks_language_difficulty_idx" ON "programming_tasks"("language", "difficulty")`,
          `CREATE INDEX IF NOT EXISTS "programming_tasks_category_idx" ON "programming_tasks"("category")`
        ],
        foreignKeys: []
      },
      {
        name: 'user_task_progress',
        sql: `CREATE TABLE IF NOT EXISTS "user_task_progress" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "taskId" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'not_started',
          "attempts" INTEGER NOT NULL DEFAULT 0,
          "completedAt" TIMESTAMP(3),
          "chatSessionId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "user_task_progress_pkey" PRIMARY KEY ("id")
        )`,
        indexes: [
          `CREATE UNIQUE INDEX IF NOT EXISTS "user_task_progress_userId_taskId_key" ON "user_task_progress"("userId", "taskId")`,
          `CREATE INDEX IF NOT EXISTS "user_task_progress_userId_status_idx" ON "user_task_progress"("userId", "status")`
        ],
        foreignKeys: [
          `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_task_progress_userId_fkey') THEN ALTER TABLE "user_task_progress" ADD CONSTRAINT "user_task_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
          `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_task_progress_taskId_fkey') THEN ALTER TABLE "user_task_progress" ADD CONSTRAINT "user_task_progress_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "programming_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
        ]
      },
      {
        name: 'contact_messages',
        sql: `CREATE TABLE IF NOT EXISTS "contact_messages" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "subject" TEXT NOT NULL,
          "message" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
        )`,
        indexes: [
          `CREATE INDEX IF NOT EXISTS "contact_messages_status_createdAt_idx" ON "contact_messages"("status", "createdAt")`
        ],
        foreignKeys: []
      },
      {
        name: 'rate_limits',
        sql: `CREATE TABLE IF NOT EXISTS "rate_limits" (
          "identifier" TEXT NOT NULL,
          "count" INTEGER NOT NULL DEFAULT 1,
          "reset_time" TIMESTAMP(3) NOT NULL,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("identifier")
        )`,
        indexes: [
          `CREATE INDEX IF NOT EXISTS "idx_rate_limits_reset_time" ON "rate_limits"("reset_time")`
        ],
        foreignKeys: []
      }
    ]
    
    // Check existing tables
    const existingTables = await db.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `
    const existingTableNames = existingTables.map(t => t.tablename)
    
    // Create missing tables
    for (const table of tablesToCreate) {
      if (!existingTableNames.includes(table.name)) {
        try {
          await db.$executeRawUnsafe(table.sql)
          
          for (const indexSQL of table.indexes) {
            await db.$executeRawUnsafe(indexSQL)
          }
          
          for (const fkSQL of table.foreignKeys) {
            await db.$executeRawUnsafe(fkSQL)
          }
          
          results.createdTables.push(table.name)
          logger.info(`Created table ${table.name}`, undefined)
        } catch (error) {
          results.errors.push(`Failed to create table ${table.name}: ${error instanceof Error ? error.message : 'Unknown'}`)
        }
      } else {
        // Table exists, check for missing columns (especially for messages table)
        if (table.name === 'messages') {
          const msgColumns = await db.$queryRaw<Array<{ column_name: string }>>`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'messages'
          `
          const msgColumnNames = msgColumns.map(c => c.column_name)
          
          if (!msgColumnNames.includes('chatSessionId')) {
            try {
              await db.$executeRawUnsafe(`ALTER TABLE "messages" ADD COLUMN "chatSessionId" TEXT`)
              results.addedColumns.push('messages.chatSessionId')
            } catch (error) {
              results.errors.push(`Failed to add chatSessionId to messages: ${error instanceof Error ? error.message : 'Unknown'}`)
            }
          }
          
          if (!msgColumnNames.includes('questionType')) {
            try {
              await db.$executeRawUnsafe(`ALTER TABLE "messages" ADD COLUMN "questionType" TEXT`)
              results.addedColumns.push('messages.questionType')
            } catch (error) {
              results.errors.push(`Failed to add questionType to messages: ${error instanceof Error ? error.message : 'Unknown'}`)
            }
          }
        }
      }
    }
    
    // ============================================
    // STEP 3: Create updatedAt triggers
    // ============================================
    const tablesWithUpdatedAt = ['stats', 'chat_sessions', 'messages', 'user_profiles', 'language_progress', 'programming_tasks', 'user_task_progress', 'contact_messages']
    
    try {
      await db.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW."updatedAt" = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `)
      
      for (const tableName of tablesWithUpdatedAt) {
        if (existingTableNames.includes(tableName) || results.createdTables.includes(tableName)) {
          try {
            await db.$executeRawUnsafe(`
              DROP TRIGGER IF EXISTS update_${tableName}_updated_at ON "${tableName}";
              CREATE TRIGGER update_${tableName}_updated_at
                BEFORE UPDATE ON "${tableName}"
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
            `)
          } catch (error) {
            // Ignore trigger errors
          }
        }
      }
    } catch (error) {
      // Triggers are not critical
      logger.info('Trigger creation skipped', undefined)
    }
    
    return NextResponse.json({
      success: results.errors.length === 0 || results.createdTables.length > 0 || results.addedColumns.length > 0,
      message: 'Final schema synchronization completed',
      summary: {
        removedColumns: results.removedColumns.length,
        addedColumns: results.addedColumns.length,
        createdTables: results.createdTables.length,
        errors: results.errors.length
      },
      details: {
        removedColumns: results.removedColumns.length > 0 ? results.removedColumns : undefined,
        addedColumns: results.addedColumns.length > 0 ? results.addedColumns : undefined,
        createdTables: results.createdTables.length > 0 ? results.createdTables : undefined,
        errors: results.errors.length > 0 ? results.errors : undefined
      }
    })
  } catch (error) {
    logger.error('Error in final schema sync', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({
      success: false,
      error: 'Failed to sync schema',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

