import { currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'

// Universal endpoint to create user in database if they don't exist
// Works for any authenticated user, regardless of admin status
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const userEmail = user.emailAddresses?.[0]?.emailAddress
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || []
    const isAdmin = userEmail && adminEmails.includes(userEmail.toLowerCase())

    // Check if user already exists
    let dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        role: true,
        isBlocked: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (dbUser) {
      // User exists, check if role needs update
      if (isAdmin && dbUser.role !== 'admin') {
        dbUser = await db.user.update({
          where: { id: user.id },
          data: { role: 'admin' },
          select: {
            id: true,
            role: true,
            isBlocked: true,
            createdAt: true,
            updatedAt: true
          }
        })
        
        return NextResponse.json({ 
          success: true,
          message: 'User exists, admin role updated!',
          user: {
            id: dbUser.id,
            role: dbUser.role,
            email: userEmail
          }
        })
      }
      
      return NextResponse.json({ 
        success: true,
        message: 'User already exists in database',
        user: {
          id: dbUser.id,
          role: dbUser.role,
          email: userEmail,
          isAdmin: isAdmin
        }
      })
    }

    // User doesn't exist, create it
    try {
      dbUser = await db.user.create({
        data: {
          id: user.id,
          role: isAdmin ? 'admin' : 'user',
          isBlocked: false
        },
        select: {
          id: true,
          role: true,
          isBlocked: true,
          createdAt: true,
          updatedAt: true
        }
      })
      
      logger.info('User created via create-user endpoint', user.id, {
        email: userEmail,
        role: dbUser.role,
        isAdmin: isAdmin
      })

      return NextResponse.json({ 
        success: true,
        message: 'User created successfully!',
        user: {
          id: dbUser.id,
          role: dbUser.role,
          email: userEmail,
          isAdmin: isAdmin,
          note: isAdmin ? 'You have admin role' : 'To get admin role, add your email to ADMIN_EMAILS in Vercel'
        }
      })
    } catch (error: any) {
      // If unique constraint error, user was created concurrently, fetch it
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        await new Promise(resolve => setTimeout(resolve, 300))
        dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            role: true,
            isBlocked: true,
            createdAt: true,
            updatedAt: true
          }
        })
        
        if (dbUser) {
          return NextResponse.json({ 
            success: true,
            message: 'User was created concurrently, retrieved successfully',
            user: {
              id: dbUser.id,
              role: dbUser.role,
              email: userEmail
            }
          })
        }
      }
      
      logger.error('Failed to create user', user.id, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  } catch (error) {
    logger.error('Error in create-user endpoint', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ 
      error: 'Failed to create user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

