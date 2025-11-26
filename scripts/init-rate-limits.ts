import { initializeRateLimitTable } from '../lib/rate-limit-db'
import { logger } from '../lib/logger'

async function main() {
  try {
    logger.info('Initializing rate limits table...')
    await initializeRateLimitTable()
    logger.info('Rate limits table initialized successfully')
    process.exit(0)
  } catch (error) {
    logger.error('Failed to initialize rate limits table', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    process.exit(1)
  }
}

main()

