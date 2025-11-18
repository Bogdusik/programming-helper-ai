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

  let dbUser = await db.user.findUnique({
    where: { id: user.id }
  })

  if (!dbUser) {
    // For research compliance, don't store email - use anonymous ID only
    dbUser = await db.user.create({
      data: {
        id: user.id, // This is already anonymous from Clerk
        role: 'user',
        isBlocked: false
      }
    })
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
