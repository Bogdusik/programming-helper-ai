import { db } from './db'

// Data retention policies
const RETENTION_POLICIES = {
  // Delete messages older than 1 year
  MESSAGE_RETENTION_DAYS: 365,
  // Delete sessions older than 1 year
  SESSION_RETENTION_DAYS: 365,
  // Delete stats older than 2 years
  STATS_RETENTION_DAYS: 730,
}

export async function cleanupOldData() {
  const now = new Date()
  
  try {
    // Clean up old messages
    const messageCutoff = new Date(now.getTime() - RETENTION_POLICIES.MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const deletedMessages = await db.message.deleteMany({
      where: {
        timestamp: {
          lt: messageCutoff
        }
      }
    })

    // Clean up old sessions (only if they have no messages)
    const sessionCutoff = new Date(now.getTime() - RETENTION_POLICIES.SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const deletedSessions = await db.chatSession.deleteMany({
      where: {
        updatedAt: {
          lt: sessionCutoff
        },
        messages: {
          none: {}
        }
      }
    })

    // Clean up old stats
    const statsCutoff = new Date(now.getTime() - RETENTION_POLICIES.STATS_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const deletedStats = await db.stats.deleteMany({
      where: {
        updatedAt: {
          lt: statsCutoff
        }
      }
    })

    console.log(`Data cleanup completed:
      - Deleted ${deletedMessages.count} old messages
      - Deleted ${deletedSessions.count} old sessions
      - Deleted ${deletedStats.count} old stats`)

    return {
      deletedMessages: deletedMessages.count,
      deletedSessions: deletedSessions.count,
      deletedStats: deletedStats.count
    }
  } catch (error) {
    console.error('Error during data cleanup:', error)
    throw error
  }
}

// Function to delete all data for a specific user (for withdrawal)
export async function deleteUserData(userId: string) {
  try {
    // Delete in correct order to respect foreign key constraints
    await db.message.deleteMany({
      where: { userId }
    })

    await db.chatSession.deleteMany({
      where: { userId }
    })

    await db.stats.deleteMany({
      where: { userId }
    })

    await db.session.deleteMany({
      where: { userId }
    })

    await db.user.delete({
      where: { id: userId }
    })

    console.log(`All data deleted for user: ${userId}`)
    return true
  } catch (error) {
    console.error(`Error deleting data for user ${userId}:`, error)
    throw error
  }
}

// Function to anonymize user data (alternative to deletion)
export async function anonymizeUserData(userId: string) {
  try {
    // Update user to remove any identifying information
    await db.user.update({
      where: { id: userId },
      data: {
        // Keep the ID but remove any other identifying data
        // (in this case, we already don't store email, so this is just for future-proofing)
      }
    })

    // Anonymize messages by removing or replacing content
    await db.message.updateMany({
      where: { userId },
      data: {
        content: '[Data anonymized for research compliance]'
      }
    })

    console.log(`Data anonymized for user: ${userId}`)
    return true
  } catch (error) {
    console.error(`Error anonymizing data for user ${userId}:`, error)
    throw error
  }
}
