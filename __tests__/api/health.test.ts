import { GET } from '../../app/api/health/route'
import { db } from '../../lib/db'
import { NextResponse } from 'next/server'

// Mock dependencies
jest.mock('../../lib/db', () => {
  const { createPrismaMock } = require('../setup/prisma-mocks')
  return {
    db: createPrismaMock(),
  }
})
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: () => Promise.resolve(data),
      status: init?.status || 200,
    })),
  },
}))

const mockDb = db as any

describe('GET /api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NODE_ENV = 'test'
  })

  it('returns healthy status when database is connected', async () => {
    mockDb.$queryRaw.mockResolvedValue([{ '?column?': 1 }] as any)

    const response = await GET()
    const data = await response.json()

    expect(data.status).toBe('healthy')
    expect(data.services.database).toBe('connected')
    expect(data.timestamp).toBeDefined()
    expect(mockDb.$queryRaw).toHaveBeenCalledWith(expect.any(Array))
  })

  it('returns unhealthy status when database connection fails', async () => {
    const error = new Error('Database connection failed')
    mockDb.$queryRaw.mockRejectedValue(error)

    const response = await GET()
    const data = await response.json()

    expect(data.status).toBe('unhealthy')
    expect(data.services.database).toBe('disconnected')
    expect(data.timestamp).toBeDefined()
  })

  it('includes error message in development mode', async () => {
    process.env.NODE_ENV = 'development'
    const error = new Error('Database connection failed')
    mockDb.$queryRaw.mockRejectedValue(error)

    const response = await GET()
    const data = await response.json()

    expect(data.error).toBe('Database connection failed')
  })

  it('hides error message in production mode', async () => {
    process.env.NODE_ENV = 'production'
    const error = new Error('Database connection failed')
    mockDb.$queryRaw.mockRejectedValue(error)

    const response = await GET()
    const data = await response.json()

    expect(data.error).toBeUndefined()
  })

  it('returns 200 status code when healthy', async () => {
    mockDb.$queryRaw.mockResolvedValue([{ '?column?': 1 }] as any)

    const response = await GET()

    expect(response.status).toBe(200)
  })

  it('returns 503 status code when unhealthy', async () => {
    mockDb.$queryRaw.mockRejectedValue(new Error('Database error'))

    const response = await GET()

    expect(response.status).toBe(503)
  })
})

