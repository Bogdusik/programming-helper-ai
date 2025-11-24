import { currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

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

    // Find user in database
    // First check if role column exists by trying to query it
    let dbUser
    try {
      dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          role: true,
        }
      })
    } catch (error: any) {
      // If role column doesn't exist, try to add it automatically
      if (error?.message?.includes('role') || error?.message?.includes('does not exist')) {
        logger.info('Role column missing, attempting to add it automatically', user.id)
        
        try {
          // Try to add the column automatically
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
          
          // Now try to fetch user again
          dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: {
              id: true,
              role: true,
            }
          })
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

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 })
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

