import { currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'

// Temporary endpoint to fix admin role for existing users
// This should be removed after fixing all users
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

    if (!isAdmin) {
      return NextResponse.json({ 
        error: 'Your email is not in the admin list',
        yourEmail: userEmail,
        adminEmails: adminEmails.length > 0 ? adminEmails : 'ADMIN_EMAILS not set'
      }, { status: 403 })
    }

    // First, ensure role column exists
    try {
      await db.$queryRaw`SELECT role FROM users LIMIT 1`
    } catch (error: any) {
      // If role column doesn't exist, try to add it automatically
      if (error?.message?.includes('role') || error?.message?.includes('does not exist')) {
        logger.info('Role column missing, attempting to add it automatically', user.id)
        
        try {
          await db.$executeRaw`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS role VARCHAR(255) DEFAULT 'user'
          `
          
          await db.$executeRaw`
            UPDATE users 
            SET role = 'user' 
            WHERE role IS NULL
          `
          
          await db.$executeRaw`
            ALTER TABLE users 
            ALTER COLUMN role SET NOT NULL
          `
          
          logger.info('Role column added automatically', user.id)
        } catch (migrationError: any) {
          logger.error('Failed to add role column automatically', user.id, {
            error: migrationError instanceof Error ? migrationError.message : 'Unknown error'
          })
          
          return NextResponse.json({ 
            error: 'Database schema is out of date. The role column does not exist.',
            solution: 'Please call POST /api/migrate-schema first to add the role column, then try again.',
            details: 'The database needs to be synced with the Prisma schema. You can either call /api/migrate-schema endpoint or run the SQL script manually.'
          }, { status: 500 })
        }
      } else {
        throw error
      }
    }

    // Find or create user in database
    let dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        role: true,
      }
    })

    // If user doesn't exist, create it
    if (!dbUser) {
      logger.info('User not found, creating user in database', user.id)
      
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
          }
        })
        logger.info('User created successfully', user.id, { role: dbUser.role })
      } catch (error: any) {
        // If unique constraint error, user was created concurrently, fetch it
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          await new Promise(resolve => setTimeout(resolve, 300))
          dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: {
              id: true,
              role: true,
            }
          })
          
          if (!dbUser) {
            throw new Error('Failed to create or retrieve user after race condition')
          }
        } else {
          logger.error('Failed to create user', user.id, {
            error: error instanceof Error ? error.message : 'Unknown error'
          })
          throw error
        }
      }
    }

    // Update role to admin
    if (dbUser.role !== 'admin') {
      dbUser = await db.user.update({
        where: { id: user.id },
        data: { role: 'admin' }
      })

      logger.info('Admin role updated via fix endpoint', user.id, {
        email: userEmail,
        previousRole: 'user',
        newRole: 'admin'
      })

      return NextResponse.json({ 
        success: true,
        message: 'Admin role has been updated! Please refresh the page.',
        user: {
          id: dbUser.id,
          role: dbUser.role,
          email: userEmail
        }
      })
    } else {
      return NextResponse.json({ 
        success: true,
        message: 'You already have admin role',
        user: {
          id: dbUser.id,
          role: dbUser.role,
          email: userEmail
        }
      })
    }
  } catch (error) {
    logger.error('Error fixing admin role', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ 
      error: 'Failed to update admin role',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

