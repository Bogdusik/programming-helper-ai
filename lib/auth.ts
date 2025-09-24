import { auth } from '@clerk/nextjs'
import { db } from './db'

export async function getCurrentUser() {
  const { userId } = await auth()
  
  if (!userId) {
    return null
  }

  // Get or create user in database
  let user = await db.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    // Create new user if doesn't exist
    user = await db.user.create({
      data: {
        id: userId,
        email: '', // Will be updated when we get user info from Clerk
        role: 'user'
      }
    })
  }

  return user
}

export async function isAdmin() {
  const user = await getCurrentUser()
  return user?.role === 'admin'
}
