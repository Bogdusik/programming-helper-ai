// Optimized in-memory rate limiting with efficient cleanup
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

// Track cleanup interval to avoid memory leaks
let cleanupInterval: NodeJS.Timeout | null = null

// Optimized cleanup - only run if map has entries
function scheduleCleanup() {
  if (cleanupInterval) return // Already scheduled
  
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    let cleaned = 0
    const maxCleanup = 1000 // Limit cleanup per cycle to avoid blocking
    
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key)
        cleaned++
        if (cleaned >= maxCleanup) break // Prevent blocking on large maps
      }
    }
    
    // Clear interval if map is empty
    if (rateLimitMap.size === 0 && cleanupInterval) {
      clearInterval(cleanupInterval)
      cleanupInterval = null
    }
  }, 30000) // Clean up every 30 seconds (more frequent for better memory management)
}

export function rateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000 // 1 minute
): { success: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = identifier
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    // Reset or create new record
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + windowMs
    })
    
    // Schedule cleanup if needed
    if (!cleanupInterval) {
      scheduleCleanup()
    }
    
    return {
      success: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs
    }
  }

  if (record.count >= maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetTime: record.resetTime
    }
  }

  // Increment count
  record.count++
  rateLimitMap.set(key, record)

  return {
    success: true,
    remaining: maxRequests - record.count,
    resetTime: record.resetTime
  }
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval)
    }
    rateLimitMap.clear()
  })
}
