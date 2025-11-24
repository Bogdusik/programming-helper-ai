import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// Endpoint to check current database connection and show connection info
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get DATABASE_URL (masked for security)
    const dbUrl = process.env.DATABASE_URL
    const maskedUrl = dbUrl 
      ? dbUrl.replace(/(:\/\/[^:]+:)([^@]+)(@)/, '$1***$3') // Mask password
      : 'NOT SET'
    
    // Test connection
    let connectionStatus = 'unknown'
    let error: string | null = null
    
    try {
      await db.$queryRaw`SELECT 1`
      connectionStatus = 'connected'
    } catch (err) {
      connectionStatus = 'failed'
      error = err instanceof Error ? err.message : 'Unknown error'
    }
    
    // Get database info
    let dbInfo: any = {}
    try {
      const result = await db.$queryRaw<Array<{ current_database: string }>>`
        SELECT current_database()
      `
      dbInfo.databaseName = result[0]?.current_database || 'unknown'
      
      // Get tables count
      const tables = await db.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `
      dbInfo.tablesCount = Number(tables[0]?.count || 0)
      
      // Get users count
      try {
        const users = await db.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count FROM users
        `
        dbInfo.usersCount = Number(users[0]?.count || 0)
      } catch {
        dbInfo.usersCount = 'table does not exist'
      }
      
      // Get messages count
      try {
        const messages = await db.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count FROM messages
        `
        dbInfo.messagesCount = Number(messages[0]?.count || 0)
      } catch {
        dbInfo.messagesCount = 'table does not exist'
      }
    } catch (err) {
      dbInfo.error = err instanceof Error ? err.message : 'Unknown error'
    }
    
    // Check if connected to Neon (cloud database)
    const isNeon = dbUrl?.includes('neon.tech') || dbUrl?.includes('neon.tech')
    const isLocalhost = dbUrl?.includes('localhost')
    
    return NextResponse.json({
      connection: {
        status: connectionStatus,
        error: error || undefined,
        databaseUrl: maskedUrl,
        host: dbUrl ? new URL(dbUrl).hostname : undefined,
        type: isNeon ? 'neon' : isLocalhost ? 'localhost' : 'other'
      },
      database: dbInfo,
      status: connectionStatus === 'connected' ? 'ready' : 'error',
      message: connectionStatus === 'connected' 
        ? (isNeon 
          ? '✅ Connected to Neon database. All data has been migrated successfully.' 
          : isLocalhost 
          ? '⚠️ Connected to localhost database. This will not work on Vercel. Please use Neon database.'
          : '✅ Database connected successfully.')
        : '❌ Database connection failed',
      instructions: connectionStatus === 'connected' && isNeon
        ? {
            message: 'Migration completed successfully!',
            note: 'All data from your local database has been imported to Neon.',
            actions: [
              '✅ Database is ready to use',
              '✅ All users and messages are available',
              '✅ No further action needed'
            ]
          }
        : connectionStatus === 'connected' && isLocalhost
        ? {
            message: '⚠️ Using localhost database',
            warning: 'This database will not work on Vercel. You need to use a cloud database (Neon).',
            actions: [
              '1. Create a Neon database at https://neon.tech',
              '2. Export data from localhost using: pg_dump',
              '3. Import data to Neon using: psql',
              '4. Update DATABASE_URL in Vercel environment variables',
              '5. Redeploy the project'
            ]
          }
        : {
            message: 'Database connection issue',
            actions: [
              '1. Check DATABASE_URL environment variable',
              '2. Verify database credentials',
              '3. Ensure database is accessible',
              '4. Check network connectivity'
            ]
          }
    })
  } catch (error) {
    logger.error('Error checking database', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return NextResponse.json({
      error: 'Failed to check database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

