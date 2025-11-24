import { currentUser } from '@clerk/nextjs/server'
import { TRPCError } from '@trpc/server'
import { Prisma } from '@prisma/client'
import { db } from './db'

/**
 * Get current authenticated user from Clerk and database
 * Creates user in database if doesn't exist
 * @returns User object from database or null if not authenticated
 * @throws TRPCError with FORBIDDEN code if user is blocked
 */
export async function getCurrentUser() {
  const user = await currentUser()
  
  if (!user) {
    return null
  }

  // Check if user should be admin based on email
  const userEmail = user.emailAddresses?.[0]?.emailAddress
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || []
  const isAdmin = userEmail && adminEmails.includes(userEmail.toLowerCase())

  // Try to find existing user first
  // Use select to only fetch essential columns to avoid errors if schema is out of sync
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

  // If user exists, check if role needs to be updated (e.g., if email was added to admin list)
  if (dbUser && isAdmin && dbUser.role !== 'admin') {
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
  }

  // If user doesn't exist, create it
  // Use try-catch with retry logic to handle race conditions where user might be created concurrently
  if (!dbUser) {
    
    let retries = 5 // Increased retries
    let lastError: Error | null = null
    
    while (retries > 0 && !dbUser) {
      try {
        dbUser = await db.user.create({
          data: {
            id: user.id, // This is already anonymous from Clerk
            role: isAdmin ? 'admin' : 'user',
            isBlocked: false
          }
        })
        break // Success, exit loop
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        // Check if it's an email constraint error - use raw SQL fallback
        const isEmailConstraintError = 
          error instanceof Error && error.message.includes('email')
        
        if (isEmailConstraintError && retries === 5) {
          // First attempt failed due to email, make email nullable and retry
          try {
            await db.$executeRawUnsafe(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`)
          } catch (alterError) {
            // Column might not exist or already nullable, continue
          }
          // Retry with Prisma
          retries--
          continue
        }
        
        // Check if it's a Prisma unique constraint error
        const isUniqueConstraintError = 
          (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') ||
          (error instanceof Error && (
            error.message.includes('Unique constraint') || 
            error.message.includes('Unique constraint failed')
          ))
        
        if (isUniqueConstraintError) {
          // Wait longer and try to fetch the user again
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
          // If found, exit loop
          if (dbUser) {
            break
          }
          // If not found and retries left, try again with longer delay
          retries--
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 200))
            continue
          }
        } else if (isEmailConstraintError && retries < 5) {
          // Email constraint after making nullable - use raw SQL
          try {
            await db.$executeRawUnsafe(`
              INSERT INTO users (id, role, "isBlocked", "createdAt", "updatedAt")
              VALUES ('${user.id}', '${isAdmin ? 'admin' : 'user'}', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT (id) DO NOTHING
            `)
            
            await new Promise(resolve => setTimeout(resolve, 200))
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
              break
            }
          } catch (sqlError) {
            // SQL failed, continue to next retry
          }
          retries--
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 200))
            continue
          }
        } else {
          // If it's not a unique constraint error, throw immediately
          throw error
        }
      }
    }
    
    // Final check - if still not found after all retries, try one more time to fetch
    if (!dbUser) {
      await new Promise(resolve => setTimeout(resolve, 500))
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
      
      // If still not found, throw error
      if (!dbUser) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create or retrieve user after multiple attempts',
          cause: lastError || undefined
        })
      }
    }
  }

  // Check if user is blocked
  if (dbUser.isBlocked) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'User account is blocked'
    })
  }

  return dbUser
}

/**
 * Check if current user has admin role
 * @returns true if user is admin, false otherwise
 */
export async function isAdmin() {
  const user = await getCurrentUser()
  return user?.role === 'admin'
}
