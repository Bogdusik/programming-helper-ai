import { db } from './db'
import { logger } from './logger'

/**
 * Database-based rate limiting for serverless environments
 * Uses database to track rate limits across multiple instances
 */

interface RateLimitRecord {
  identifier: string
  count: number
  resetTime: Date
  createdAt: Date
  updatedAt: Date
}

// Cache for in-memory fallback (works alongside DB for better performance)
const memoryCache = new Map<string, { count: number; resetTime: number }>()

// Cleanup memory cache periodically
let cleanupInterval: NodeJS.Timeout | null = null

function scheduleMemoryCleanup() {
  if (cleanupInterval) return
  
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, record] of memoryCache.entries()) {
      if (now > record.resetTime) {
        memoryCache.delete(key)
      }
    }
    
    if (memoryCache.size === 0 && cleanupInterval) {
      clearInterval(cleanupInterval)
      cleanupInterval = null
    }
  }, 30000) // Clean every 30 seconds
}

/**
 * Rate limit using database (works in serverless environments)
 * Falls back to in-memory cache if database fails
 */
export async function rateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000 // 1 minute
): Promise<{ success: boolean; remaining: number; resetTime: number }> {
  const now = Date.now()
  const resetTime = now + windowMs
  
  // Check memory cache first (fast path)
  const cached = memoryCache.get(identifier)
  if (cached && now < cached.resetTime) {
    if (cached.count >= maxRequests) {
      return {
        success: false,
        remaining: 0,
        resetTime: cached.resetTime
      }
    }
    cached.count++
    return {
      success: true,
      remaining: maxRequests - cached.count,
      resetTime: cached.resetTime
    }
  }
  
  try {
    // Try database-based rate limiting
    // Use Prisma.$queryRaw with template literal for type-safe parameterized queries
    const record = await db.$queryRaw<RateLimitRecord[]>`
      SELECT * FROM rate_limits 
      WHERE identifier = ${identifier} AND reset_time > NOW()
      LIMIT 1
    `
    
    if (record.length > 0) {
      const existing = record[0]
      const resetTimeMs = existing.resetTime.getTime()
      
      if (existing.count >= maxRequests) {
        // Update memory cache
        memoryCache.set(identifier, {
          count: existing.count,
          resetTime: resetTimeMs
        })
        scheduleMemoryCleanup()
        
        return {
          success: false,
          remaining: 0,
          resetTime: resetTimeMs
        }
      }
      
      // Increment count
      await db.$executeRaw`
        UPDATE rate_limits 
        SET count = count + 1, updated_at = NOW()
        WHERE identifier = ${identifier} AND reset_time > NOW()
      `
      
      const newCount = existing.count + 1
      memoryCache.set(identifier, {
        count: newCount,
        resetTime: resetTimeMs
      })
      scheduleMemoryCleanup()
      
      return {
        success: true,
        remaining: maxRequests - newCount,
        resetTime: resetTimeMs
      }
    }
    
    // No existing record or expired - create new one
    const resetTimeDate = new Date(resetTime)
    await db.$executeRaw`
      INSERT INTO rate_limits (identifier, count, reset_time, created_at, updated_at)
      VALUES (${identifier}, 1, ${resetTimeDate}::timestamp, NOW(), NOW())
      ON CONFLICT (identifier) 
      DO UPDATE SET 
        count = CASE 
          WHEN rate_limits.reset_time <= NOW() THEN 1 
          ELSE rate_limits.count + 1 
        END,
        reset_time = CASE 
          WHEN rate_limits.reset_time <= NOW() THEN ${resetTimeDate}::timestamp
          ELSE rate_limits.reset_time 
        END,
        updated_at = NOW()
    `
    
    memoryCache.set(identifier, {
      count: 1,
      resetTime: resetTime
    })
    scheduleMemoryCleanup()
    
    return {
      success: true,
      remaining: maxRequests - 1,
      resetTime: resetTime
    }
  } catch (error) {
    // Fallback to in-memory if database fails
    logger.warn('Rate limit database query failed, using memory fallback', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error',
      identifier
    })
    
    const cached = memoryCache.get(identifier)
    if (cached && now < cached.resetTime) {
      if (cached.count >= maxRequests) {
        return {
          success: false,
          remaining: 0,
          resetTime: cached.resetTime
        }
      }
      cached.count++
      return {
        success: true,
        remaining: maxRequests - cached.count,
        resetTime: cached.resetTime
      }
    }
    
    // Create new record in memory
    memoryCache.set(identifier, {
      count: 1,
      resetTime: resetTime
    })
    scheduleMemoryCleanup()
    
    return {
      success: true,
      remaining: maxRequests - 1,
      resetTime: resetTime
    }
  }
}

/**
 * Initialize rate limits table if it doesn't exist
 * Call this once on app startup or in a migration
 */
export async function initializeRateLimitTable() {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        identifier TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_time TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_time 
      ON rate_limits(reset_time)
    `)
    
    // Clean up expired records periodically
    await db.$executeRawUnsafe(`
      DELETE FROM rate_limits WHERE reset_time < NOW() - INTERVAL '1 hour'
    `)
  } catch (error) {
    logger.error('Failed to initialize rate limit table', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Cleanup on process exit
const globalForShutdown = globalThis as unknown as {
  rateLimitShutdownRegistered?: boolean
}

if (typeof process !== 'undefined' && !globalForShutdown.rateLimitShutdownRegistered) {
  globalForShutdown.rateLimitShutdownRegistered = true
  process.on('exit', () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval)
    }
    memoryCache.clear()
  })
}

