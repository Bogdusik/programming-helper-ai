// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

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

// Clean up expired records periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}, 60000) // Clean up every minute
