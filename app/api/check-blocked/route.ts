import { currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Disable caching for this endpoint to ensure fresh block status
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const user = await currentUser()
    
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
    console.error('Error checking block status:', error)
    return NextResponse.json({ isBlocked: false }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      }
    })
  }
}

