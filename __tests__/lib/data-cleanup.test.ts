import {
  cleanupOldData,
  deleteUserData,
  anonymizeUserData,
} from '../../lib/data-cleanup'
import { db } from '../../lib/db'

// Mock dependencies
jest.mock('../../lib/db', () => {
  const { createPrismaMock } = require('../setup/prisma-mocks')
  return {
    db: createPrismaMock(),
  }
})

const mockDb = db as any

describe('data-cleanup.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('cleanupOldData', () => {
    it('deletes old messages', async () => {
      mockDb.message.deleteMany.mockResolvedValue({ count: 10 } as any)
      mockDb.chatSession.deleteMany.mockResolvedValue({ count: 5 } as any)
      mockDb.stats.deleteMany.mockResolvedValue({ count: 2 } as any)

      const result = await cleanupOldData()

      expect(result.deletedMessages).toBe(10)
      expect(mockDb.message.deleteMany).toHaveBeenCalledWith({
        where: {
          timestamp: {
            lt: expect.any(Date),
          },
        },
      })
    })

    it('deletes old sessions without messages', async () => {
      mockDb.message.deleteMany.mockResolvedValue({ count: 0 } as any)
      mockDb.chatSession.deleteMany.mockResolvedValue({ count: 3 } as any)
      mockDb.stats.deleteMany.mockResolvedValue({ count: 0 } as any)

      const result = await cleanupOldData()

      expect(result.deletedSessions).toBe(3)
      expect(mockDb.chatSession.deleteMany).toHaveBeenCalledWith({
        where: {
          updatedAt: {
            lt: expect.any(Date),
          },
          messages: {
            none: {},
          },
        },
      })
    })

    it('deletes old stats', async () => {
      mockDb.message.deleteMany.mockResolvedValue({ count: 0 } as any)
      mockDb.chatSession.deleteMany.mockResolvedValue({ count: 0 } as any)
      mockDb.stats.deleteMany.mockResolvedValue({ count: 5 } as any)

      const result = await cleanupOldData()

      expect(result.deletedStats).toBe(5)
      expect(mockDb.stats.deleteMany).toHaveBeenCalledWith({
        where: {
          updatedAt: {
            lt: expect.any(Date),
          },
        },
      })
    })

    it('handles errors during cleanup', async () => {
      const error = new Error('Database error')
      mockDb.message.deleteMany.mockRejectedValue(error)

      await expect(cleanupOldData()).rejects.toThrow('Database error')
    })

    it('calculates correct cutoff dates', async () => {
      mockDb.message.deleteMany.mockResolvedValue({ count: 0 } as any)
      mockDb.chatSession.deleteMany.mockResolvedValue({ count: 0 } as any)
      mockDb.stats.deleteMany.mockResolvedValue({ count: 0 } as any)

      await cleanupOldData()

      // Check message cutoff (365 days)
      const messageCall = mockDb.message.deleteMany.mock.calls[0][0]
      const messageCutoff = messageCall.where.timestamp.lt
      const expectedMessageCutoff = new Date('2023-01-15T12:00:00Z')
      expect(messageCutoff.getTime()).toBeCloseTo(expectedMessageCutoff.getTime(), -3)

      // Check stats cutoff (730 days)
      const statsCall = mockDb.stats.deleteMany.mock.calls[0][0]
      const statsCutoff = statsCall.where.updatedAt.lt
      const expectedStatsCutoff = new Date('2022-01-15T12:00:00Z')
      expect(statsCutoff.getTime()).toBeCloseTo(expectedStatsCutoff.getTime(), -3)
    })
  })

  describe('deleteUserData', () => {
    it('deletes all user data in correct order', async () => {
      mockDb.message.deleteMany.mockResolvedValue({ count: 10 } as any)
      mockDb.chatSession.deleteMany.mockResolvedValue({ count: 5 } as any)
      mockDb.stats.deleteMany.mockResolvedValue({ count: 1 } as any)
      mockDb.user.delete.mockResolvedValue({} as any)

      const result = await deleteUserData('user-123')

      expect(result).toBe(true)
      expect(mockDb.message.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      })
      expect(mockDb.chatSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      })
      expect(mockDb.stats.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      })
      expect(mockDb.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      })
    })

    it('deletes in correct order to respect foreign keys', async () => {
      mockDb.message.deleteMany.mockResolvedValue({ count: 0 } as any)
      mockDb.chatSession.deleteMany.mockResolvedValue({ count: 0 } as any)
      mockDb.stats.deleteMany.mockResolvedValue({ count: 0 } as any)
      mockDb.user.delete.mockResolvedValue({} as any)

      await deleteUserData('user-123')

      const calls = mockDb.message.deleteMany.mock.invocationCallOrder
      const sessionCalls = mockDb.chatSession.deleteMany.mock.invocationCallOrder
      const statsCalls = mockDb.stats.deleteMany.mock.invocationCallOrder
      const userCalls = mockDb.user.delete.mock.invocationCallOrder

      // Messages should be deleted first
      expect(calls[0]).toBeLessThan(sessionCalls[0])
      expect(calls[0]).toBeLessThan(statsCalls[0])
      expect(calls[0]).toBeLessThan(userCalls[0])
    })

    it('handles errors during deletion', async () => {
      const error = new Error('Delete failed')
      mockDb.message.deleteMany.mockRejectedValue(error)

      await expect(deleteUserData('user-123')).rejects.toThrow('Delete failed')
    })
  })

  describe('anonymizeUserData', () => {
    it('anonymizes user messages', async () => {
      mockDb.user.update.mockResolvedValue({} as any)
      mockDb.message.updateMany.mockResolvedValue({ count: 10 } as any)

      const result = await anonymizeUserData('user-123')

      expect(result).toBe(true)
      expect(mockDb.message.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: {
          content: '[Data anonymized for research compliance]',
        },
      })
    })

    it('updates user record', async () => {
      mockDb.user.update.mockResolvedValue({} as any)
      mockDb.message.updateMany.mockResolvedValue({ count: 0 } as any)

      await anonymizeUserData('user-123')

      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {},
      })
    })

    it('handles errors during anonymization', async () => {
      const error = new Error('Anonymization failed')
      mockDb.user.update.mockRejectedValue(error)

      await expect(anonymizeUserData('user-123')).rejects.toThrow('Anonymization failed')
    })
  })
})

