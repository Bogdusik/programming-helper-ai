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

    // First, ensure all required columns exist
    // Check and add missing columns one by one
    const requiredColumns = [
      { name: 'role', type: 'VARCHAR(255)', default: "'user'", notNull: true },
      { name: 'isBlocked', type: 'BOOLEAN', default: 'false', notNull: true },
      { name: 'createdAt', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP', notNull: true },
      { name: 'updatedAt', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP', notNull: true },
      { name: 'onboardingCompleted', type: 'BOOLEAN', default: 'false', notNull: true },
      { name: 'onboardingStep', type: 'INTEGER', default: '0', notNull: true },
      { name: 'showTooltips', type: 'BOOLEAN', default: 'true', notNull: true },
      { name: 'profileCompleted', type: 'BOOLEAN', default: 'false', notNull: true },
      { name: 'learningGoals', type: 'TEXT[]', default: "'{}'", notNull: false },
      { name: 'preferredLanguages', type: 'TEXT[]', default: "'{}'", notNull: false },
    ]

    for (const col of requiredColumns) {
      try {
        // Check if column exists
        const result = await db.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = ${col.name}
        `
        
        if (result.length === 0) {
          logger.info(`Adding missing column: ${col.name}`, user.id)
          
          // Add column
          await db.$executeRawUnsafe(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type} DEFAULT ${col.default}
          `)
          
          // Update existing rows
          if (col.notNull) {
            await db.$executeRawUnsafe(`
              UPDATE users 
              SET "${col.name}" = ${col.default} 
              WHERE "${col.name}" IS NULL
            `)
            
            // Make NOT NULL if required
            await db.$executeRawUnsafe(`
              ALTER TABLE users 
              ALTER COLUMN "${col.name}" SET NOT NULL
            `)
          }
          
          logger.info(`Column ${col.name} added successfully`, user.id)
        }
      } catch (colError: any) {
        logger.error(`Failed to add column ${col.name}`, user.id, {
          error: colError instanceof Error ? colError.message : 'Unknown error'
        })
        // Continue with other columns even if one fails
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

