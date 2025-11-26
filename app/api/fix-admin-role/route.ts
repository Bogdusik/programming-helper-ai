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

    // First, ensure ALL columns from schema exist
    // This is critical - Prisma tries to select ALL columns, so ALL must exist
    const allColumns = [
      { name: 'role', type: 'VARCHAR(255)', default: "'user'", notNull: true },
      { name: 'isBlocked', type: 'BOOLEAN', default: 'false', notNull: true },
      { name: 'createdAt', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP', notNull: true },
      { name: 'updatedAt', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP', notNull: true },
      { name: 'selfReportedLevel', type: 'VARCHAR(255)', default: 'NULL', notNull: false },
      { name: 'assessedLevel', type: 'VARCHAR(255)', default: 'NULL', notNull: false },
      { name: 'learningGoals', type: 'TEXT[]', default: "'{}'", notNull: false },
      { name: 'aiExperience', type: 'VARCHAR(255)', default: 'NULL', notNull: false },
      { name: 'initialConfidence', type: 'INTEGER', default: 'NULL', notNull: false },
      { name: 'preferredLanguages', type: 'TEXT[]', default: "'{}'", notNull: false },
      { name: 'primaryLanguage', type: 'VARCHAR(255)', default: 'NULL', notNull: false },
      { name: 'onboardingCompleted', type: 'BOOLEAN', default: 'false', notNull: true },
      { name: 'onboardingStep', type: 'INTEGER', default: '0', notNull: true },
      { name: 'showTooltips', type: 'BOOLEAN', default: 'true', notNull: true },
      { name: 'profileCompleted', type: 'BOOLEAN', default: 'false', notNull: true },
    ]

    for (const col of allColumns) {
      try {
        const result = await db.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = ${col.name}
        `
        
        if (result.length === 0) {
          logger.info(`Adding missing column: ${col.name}`, user.id)
          
          const addColumnSQL = `ALTER TABLE users ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}${col.default !== 'NULL' ? ` DEFAULT ${col.default}` : ''}`
          await db.$executeRawUnsafe(addColumnSQL)
          
          if (col.notNull && col.default !== 'NULL') {
            await db.$executeRawUnsafe(`UPDATE users SET "${col.name}" = ${col.default} WHERE "${col.name}" IS NULL`)
            await db.$executeRawUnsafe(`ALTER TABLE users ALTER COLUMN "${col.name}" SET NOT NULL`)
          }
          
          logger.info(`Column ${col.name} added successfully`, user.id)
        }
      } catch (colError: unknown) {
        logger.error(`Failed to add column ${col.name}`, user.id, {
          error: colError instanceof Error ? colError.message : 'Unknown error'
        })
        // Continue with other columns
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
        // First, ensure email column is nullable (if it exists)
        try {
          const emailColumnCheck = await db.$queryRaw<Array<{ is_nullable: string }>>`
            SELECT is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'email'
          `
          
          if (emailColumnCheck.length > 0 && emailColumnCheck[0].is_nullable === 'NO') {
            logger.info('Making email column nullable', user.id)
            await db.$executeRawUnsafe(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`)
          }
        } catch (emailError) {
          // Email column might not exist, that's fine
          logger.info('Email column check skipped', user.id)
        }
        
        // Try to create user with Prisma first
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
        } catch (createError: unknown) {
          // If Prisma fails due to email constraint, use raw SQL
          if (createError instanceof Error && createError.message.includes('email')) {
            logger.info('Creating user with raw SQL due to email constraint', user.id)
            // Use parameterized query to prevent SQL injection
            await db.$executeRaw`
              INSERT INTO users (id, role, "isBlocked", "createdAt", "updatedAt")
              VALUES (${user.id}, ${isAdmin ? 'admin' : 'user'}, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT (id) DO NOTHING
            `
            
            // Fetch the created user
            await new Promise(resolve => setTimeout(resolve, 200))
            dbUser = await db.user.findUnique({
              where: { id: user.id },
              select: {
                id: true,
                role: true,
              }
            })
            
            if (!dbUser) {
              throw new Error('Failed to create user with raw SQL')
            }
          } else {
            // If unique constraint error, user was created concurrently, fetch it
            if (createError instanceof Prisma.PrismaClientKnownRequestError && createError.code === 'P2002') {
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
              throw createError
            }
          }
        }
      } catch (error: unknown) {
        logger.error('Failed to create user', user.id, {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
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

