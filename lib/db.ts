import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Optimized Prisma client with connection pooling and query optimization
export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  // Optimize connection pool for better performance
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

// Enable connection pooling hints
if (process.env.NODE_ENV !== 'production') {
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
