import { currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json({ isBlocked: false })
    }

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { isBlocked: true }
    })

    return NextResponse.json({ 
      isBlocked: dbUser?.isBlocked ?? false 
    })
  } catch (error) {
    console.error('Error checking block status:', error)
    return NextResponse.json({ isBlocked: false }, { status: 500 })
  }
}

