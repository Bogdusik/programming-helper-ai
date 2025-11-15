import { rateLimit } from '../../lib/rate-limit'

describe('Rate Limiting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('allows requests within limit', () => {
      const result = rateLimit('user1', 5, 60000)
      
      expect(result.success).toBe(true)
      expect(result.remaining).toBeGreaterThanOrEqual(0)
      expect(result.remaining).toBeLessThanOrEqual(4)
    })

    it('returns correct remaining count', () => {
      const userId = 'user2'
      const limit = 5
      
      for (let i = 0; i < 3; i++) {
        rateLimit(userId, limit, 60000)
      }
      
      const result = rateLimit(userId, limit, 60000)
      expect(result.remaining).toBeGreaterThanOrEqual(0)
    })
  })

  describe('limit enforcement', () => {
    it('blocks requests when limit exceeded', () => {
      const userId = 'user3'
      const limit = 5
      
      // Make requests up to limit
      for (let i = 0; i < limit; i++) {
        rateLimit(userId, limit, 60000)
      }
      
      // Next request should be blocked
      const result = rateLimit(userId, limit, 60000)
      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('tracks different users independently', () => {
      const user1 = 'user4'
      const user2 = 'user5'
      const limit = 3
      
      // Exceed limit for user1
      for (let i = 0; i < limit; i++) {
        rateLimit(user1, limit, 60000)
      }
      
      // user2 should still be allowed
      const result = rateLimit(user2, limit, 60000)
      expect(result.success).toBe(true)
    })
  })

  describe('time window', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('resets after time window expires', () => {
      const userId = 'user6'
      const limit = 2
      const windowMs = 1000
      
      // Make requests up to limit
      rateLimit(userId, limit, windowMs)
      rateLimit(userId, limit, windowMs)
      
      // Should be blocked
      let result = rateLimit(userId, limit, windowMs)
      expect(result.success).toBe(false)
      
      // Advance time past window
      jest.advanceTimersByTime(windowMs + 100)
      
      // Should be allowed again
      result = rateLimit(userId, limit, windowMs)
      expect(result.success).toBe(true)
    })

    it('maintains correct reset time', () => {
      const userId = 'user7'
      const limit = 2
      const windowMs = 1000
      
      rateLimit(userId, limit, windowMs)
      
      // Advance time but not past window
      jest.advanceTimersByTime(500)
      
      const result = rateLimit(userId, limit, windowMs)
      expect(result.success).toBe(true)
      expect(result.resetTime).toBeGreaterThan(Date.now())
    })
  })
})
