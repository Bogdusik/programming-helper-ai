import { db } from '../../lib/db'
import { logger } from '../../lib/logger'

// Mock dependencies
jest.mock('../../lib/db', () => {
  const { createPrismaMock } = require('../setup/prisma-mocks')
  return {
    db: createPrismaMock(),
  }
})
jest.mock('../../lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

const mockDb = db as any

describe('rate-limit-db.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers() // Use real timers for all tests
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('rateLimit', () => {
    it('allows requests within limit', async () => {
      jest.isolateModules(async () => {
        const { rateLimit } = require('../../lib/rate-limit-db')
        // The code uses $queryRaw to check for existing record
        // If no record exists, it creates one with $executeRaw
        mockDb.$queryRaw.mockResolvedValue([]) // No existing record
        mockDb.$executeRaw.mockResolvedValue(1) // INSERT successful

        const result = await rateLimit('user-123', 10, 60000)

        expect(result.success).toBe(true)
        expect(result.remaining).toBe(9) // 10 - 1
      })
    })

    it('blocks requests when limit exceeded', async () => {
      jest.isolateModules(async () => {
        const { rateLimit } = require('../../lib/rate-limit-db')
        const resetTime = new Date(Date.now() + 30000)
        // The code uses $queryRaw instead of rateLimit.findUnique
        // First check memory cache (should be empty), then check DB
        mockDb.$queryRaw.mockResolvedValue([{
          identifier: 'user-123',
          count: 10, // At the limit
          resetTime,
          createdAt: new Date(),
          updatedAt: new Date(),
        }] as any)

        const result = await rateLimit('user-123', 10, 60000)

        expect(result.success).toBe(false)
        expect(result.remaining).toBe(0)
        expect(result.resetTime).toBeGreaterThan(Date.now())
      })
    })

    it('resets count after time window expires', async () => {
      jest.isolateModules(async () => {
        const { rateLimit } = require('../../lib/rate-limit-db')
        // When time window expires, $queryRaw returns empty array (no active record)
        // Then code creates new record with $executeRaw
        mockDb.$queryRaw.mockResolvedValue([]) // No active record (expired)
        mockDb.$executeRaw.mockResolvedValue(1) // INSERT successful

        const result = await rateLimit('user-123', 10, 60000)

        expect(result.success).toBe(true)
        expect(result.remaining).toBe(9) // 10 - 1
        // Verify that $executeRaw was called to create new record
        expect(mockDb.$executeRaw).toHaveBeenCalled()
      })
    })

    it('increments count for same identifier', async () => {
      jest.isolateModules(async () => {
        const { rateLimit } = require('../../lib/rate-limit-db')
        const resetTime = new Date(Date.now() + 60000)
        // The code uses $queryRaw to get existing record
        mockDb.$queryRaw.mockResolvedValue([{
          identifier: 'user-123',
          count: 5,
          resetTime,
          createdAt: new Date(),
          updatedAt: new Date(),
        }] as any)
        // Then uses $executeRaw to increment count
        mockDb.$executeRaw.mockResolvedValue(1) // UPDATE successful

        const result = await rateLimit('user-123', 10, 60000)

        expect(result.success).toBe(true)
        expect(result.remaining).toBe(4) // 10 - (5 + 1) = 4
        // Verify that $executeRaw was called to increment count
        expect(mockDb.$executeRaw).toHaveBeenCalled()
      })
    })

    it('handles database errors and falls back to memory cache', async () => {
      jest.isolateModules(async () => {
        const { rateLimit } = require('../../lib/rate-limit-db')
        // First call fails, falls back to memory
        mockDb.$queryRaw.mockRejectedValueOnce(new Error('DB error'))
        
        const result = await rateLimit('user-123', 10, 60000)

        // Should still work with memory fallback
        expect(result.success).toBe(true)
        expect(result.remaining).toBeGreaterThanOrEqual(0)
      })
    })

    it('tracks different identifiers independently', async () => {
      jest.isolateModules(async () => {
        const { rateLimit } = require('../../lib/rate-limit-db')
        // First identifier - no existing record
        mockDb.$queryRaw.mockResolvedValueOnce([])
        mockDb.$executeRaw.mockResolvedValueOnce(1)
        const result1 = await rateLimit('user-1', 10, 60000)

        // Second identifier - no existing record
        mockDb.$queryRaw.mockResolvedValueOnce([])
        mockDb.$executeRaw.mockResolvedValueOnce(1)
        const result2 = await rateLimit('user-2', 10, 60000)

        expect(result1.success).toBe(true)
        expect(result2.success).toBe(true)
        expect(result1.remaining).toBe(9)
        expect(result2.remaining).toBe(9)
      })
    })

    it('returns correct remaining count', async () => {
      jest.isolateModules(async () => {
        const { rateLimit } = require('../../lib/rate-limit-db')
        const resetTime = new Date(Date.now() + 60000)
        mockDb.$queryRaw.mockResolvedValue([{
          identifier: 'user-123',
          count: 7,
          resetTime,
          createdAt: new Date(),
          updatedAt: new Date(),
        }] as any)
        mockDb.$executeRaw.mockResolvedValue(1)

        const result = await rateLimit('user-123', 10, 60000)

        expect(result.success).toBe(true)
        expect(result.remaining).toBe(2) // 10 - (7 + 1) = 2
      })
    })
  })
})
