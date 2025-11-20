import { currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// Disable caching for this endpoint to ensure fresh block status
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  let user = null
  try {
    user = await currentUser()
    
    if (!user) {
      return NextResponse.json({ isBlocked: false }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        }
      })
    }

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { isBlocked: true }
    })

    return NextResponse.json({ 
      isBlocked: dbUser?.isBlocked ?? false 
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      }
    })
  } catch (error) {
    logger.error('Error checking block status', user?.id, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ isBlocked: false }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      }
    })
  }
}

