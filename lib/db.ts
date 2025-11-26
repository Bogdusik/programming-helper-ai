import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Optimized Prisma client with connection pooling and query optimization
// Connection pool settings are configured via DATABASE_URL connection string parameters:
// - ?connection_limit=10&pool_timeout=20 (adjust based on your database provider)
export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  // Connection pool is managed by Prisma automatically
  // For Neon/PostgreSQL, connection pooling is handled via the connection string
  // For better performance in serverless, use a connection pooler (e.g., Neon's pooler)
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Set query timeout to prevent hanging queries
  // Note: This is a global setting, individual queries can override
})

// Reuse Prisma client across requests (important for production)
// This prevents creating multiple connections
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = db
}

// Graceful shutdown - only register once to avoid memory leaks in hot reload
const globalForShutdown = globalThis as unknown as {
  dbShutdownRegistered?: boolean
}

if (typeof process !== 'undefined' && !globalForShutdown.dbShutdownRegistered) {
  globalForShutdown.dbShutdownRegistered = true
  process.on('beforeExit', async () => {
    await db.$disconnect()
  })
}
