import { currentUser } from '@clerk/nextjs/server'
import { TRPCError } from '@trpc/server'
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

  // Try to find existing user first
  let dbUser = await db.user.findUnique({
    where: { id: user.id }
  })

  // If user doesn't exist, create it
  // Use try-catch with retry logic to handle race conditions where user might be created concurrently
  if (!dbUser) {
    let retries = 5 // Increased retries
    let lastError: any = null
    
    while (retries > 0 && !dbUser) {
      try {
        dbUser = await db.user.create({
          data: {
            id: user.id, // This is already anonymous from Clerk
            role: 'user',
            isBlocked: false
          }
        })
        break // Success, exit loop
      } catch (error: any) {
        lastError = error
        // If user was created concurrently (unique constraint error), try to fetch it
        if (error?.code === 'P2002' || 
            error?.message?.includes('Unique constraint') || 
            error?.message?.includes('Unique constraint failed')) {
          // Wait longer and try to fetch the user again
          await new Promise(resolve => setTimeout(resolve, 300))
          dbUser = await db.user.findUnique({
            where: { id: user.id }
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
        where: { id: user.id }
      })
      
      // If still not found, throw error
      if (!dbUser) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create or retrieve user after multiple attempts',
          cause: lastError
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
