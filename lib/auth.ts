import { currentUser } from '@clerk/nextjs/server'
import { db } from './db'

export async function getCurrentUser() {
  const user = await currentUser()
  
  if (!user) {
    return null
  }

  // Get or create user in database
  let dbUser = await db.user.findUnique({
    where: { id: user.id }
  })

  if (!dbUser) {
    // Create new user if doesn't exist
    dbUser = await db.user.create({
      data: {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || '', // Get email from Clerk user
        role: 'user'
      }
    })
  }

  return dbUser
}

export async function isAdmin() {
  const user = await getCurrentUser()
  return user?.role === 'admin'
}
