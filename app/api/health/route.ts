import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Health check endpoint
 * Returns 200 if the application and database are healthy
 * Used for monitoring and load balancer health checks
 */
export async function GET() {
  try {
    // Check database connection
    await db.$queryRaw`SELECT 1`
    
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
        },
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'disconnected',
        },
        error: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined,
      },
      { status: 503 }
    )
  }
}

