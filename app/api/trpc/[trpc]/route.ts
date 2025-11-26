import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/lib/trpc'
import { logger } from '@/lib/logger'
import { initializeRateLimitTable } from '@/lib/rate-limit-db'

// Initialize rate limits table on first import (only runs once due to module caching)
let rateLimitInitialized = false
if (!rateLimitInitialized) {
  rateLimitInitialized = true
  // Initialize asynchronously to avoid blocking requests
  initializeRateLimitTable().catch((error) => {
    logger.error('Failed to initialize rate limits table', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  })
}

const handler = async (req: Request) => {
  try {
    return await fetchRequestHandler({
      endpoint: '/api/trpc',
      req,
      router: appRouter,
      createContext: async () => {
        // Context is created in tRPC procedures via getCurrentUser()
        return {}
      },
      onError: ({ path, error }) => {
        // Log errors for debugging
        logger.error(`tRPC error on ${path}`, undefined, {
          code: error.code,
          message: error.message,
          cause: error.cause,
        })
      },
    })
  } catch (error) {
    // Handle unexpected errors
    logger.error('Unexpected error in tRPC handler', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
    // Return a proper error response
    return new Response(
      JSON.stringify({
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR',
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

export { handler as GET, handler as POST }
