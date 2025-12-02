import { currentUser } from '@clerk/nextjs/server'
import { TRPCError } from '@trpc/server'
import { db } from './db'

/**
 * Get current authenticated user from Clerk and database
 * Does NOT create user automatically - user must be registered through sign-up
 * @returns User object from database or null if not authenticated or not registered
 * @throws TRPCError with FORBIDDEN code if user is blocked
 * @throws TRPCError with UNAUTHORIZED code if user is not registered (doesn't exist in database)
 */
export async function getCurrentUser() {
  let user
  try {
    user = await currentUser()
  } catch (error) {
    // Handle cases where Clerk can't find the user (e.g., user was deleted, not fully created, etc.)
    // Log the error for debugging but don't throw - return null to indicate user is not authenticated
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      // User not found in Clerk - this can happen during registration or if user was deleted
      return null
    }
    // For other errors, re-throw them
    throw error
  }
  
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

  // If user doesn't exist, throw UNAUTHORIZED error
  // User must be registered through sign-up before they can use the application
  if (!dbUser) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User not registered. Please sign up first.'
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
 * Check if user exists in database without creating them
 * Used to verify if user was registered through sign-up
 * @returns true if user exists, false otherwise
 */
export async function checkUserExists(userId: string): Promise<boolean> {
  try {
    const dbUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true }
    })
    return !!dbUser
  } catch {
    return false
  }
}

/**
 * Check if current user has admin role
 * @returns true if user is admin, false otherwise
 */
export async function isAdmin() {
  const user = await getCurrentUser()
  return user?.role === 'admin'
}
