import { db } from './db'
import { logger } from './logger'

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

    logger.info('Data cleanup completed', undefined, {
      deletedMessages: deletedMessages.count,
      deletedSessions: deletedSessions.count,
      deletedStats: deletedStats.count
    })

    return {
      deletedMessages: deletedMessages.count,
      deletedSessions: deletedSessions.count,
      deletedStats: deletedStats.count
    }
  } catch (error) {
    logger.error('Error during data cleanup', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
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

    // Note: Session model was removed as it was unused
    // All session management is handled by ChatSession

    await db.user.delete({
      where: { id: userId }
    })

    logger.info('All data deleted for user', userId)
    return true
  } catch (error) {
    logger.error('Error deleting data for user', userId, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
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

    logger.info('Data anonymized for user', userId)
    return true
  } catch (error) {
    logger.error('Error anonymizing data for user', userId, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}
