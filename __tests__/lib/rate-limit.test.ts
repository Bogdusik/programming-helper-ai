import { rateLimit } from '../../lib/rate-limit'

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Clear rate limit map before each test
    jest.clearAllMocks()
  })

  it('allows requests within limit', () => {
    const result = rateLimit('user1', 5, 60000)
    
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('blocks requests when limit exceeded', () => {
    const userId = 'user2'
    
    // Make 5 requests (limit)
    for (let i = 0; i < 5; i++) {
      rateLimit(userId, 5, 60000)
    }
    
    // 6th request should be blocked
    const result = rateLimit(userId, 5, 60000)
    
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('resets after time window', () => {
    const userId = 'user3'
    
    // Mock Date.now to control time
    const originalDateNow = Date.now
    let mockTime = 1000000
    
    Date.now = jest.fn(() => mockTime)
    
    // Make requests
    rateLimit(userId, 2, 1000) // 1 second window
    rateLimit(userId, 2, 1000)
    
    // Should be blocked
    let result = rateLimit(userId, 2, 1000)
    expect(result.success).toBe(false)
    
    // Advance time by 1.1 seconds
    mockTime += 1100
    result = rateLimit(userId, 2, 1000)
    expect(result.success).toBe(true)
    
    // Restore original Date.now
    Date.now = originalDateNow
  })
})
