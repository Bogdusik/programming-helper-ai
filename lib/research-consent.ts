// Research consent management
export interface ResearchConsent {
  hasConsented: boolean
  consentDate: Date
  participantId: string // Anonymous ID
  userId?: string // Link consent to specific user
}

// Get storage key for user-specific consent
function getConsentStorageKey(userId?: string): string {
  if (userId) {
    return `research-consent-${userId}`
  }
  // Fallback to old key for backward compatibility
  return 'research-consent'
}

export function getConsentFromStorage(userId?: string): ResearchConsent | null {
  if (typeof window === 'undefined') return null
  
  try {
    // Try user-specific key first
    if (userId) {
      const stored = localStorage.getItem(getConsentStorageKey(userId))
      if (stored) {
        const consent = JSON.parse(stored)
        // Verify it's for the correct user
        if (consent.userId === userId) {
          return {
            ...consent,
            consentDate: new Date(consent.consentDate)
          }
        }
      }
    }
    
    // Fallback to old global key (for backward compatibility)
    const stored = localStorage.getItem('research-consent')
    if (!stored) return null
    
    const consent = JSON.parse(stored)
    return {
      ...consent,
      consentDate: new Date(consent.consentDate)
    }
  } catch {
    return null
  }
}

export function saveConsentToStorage(consent: boolean, userId?: string): ResearchConsent {
  const participantId = `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const consentData: ResearchConsent = {
    hasConsented: consent,
    consentDate: new Date(),
    participantId,
    userId
  }
  
  if (typeof window !== 'undefined') {
    // Save with user-specific key
    if (userId) {
      localStorage.setItem(getConsentStorageKey(userId), JSON.stringify(consentData))
      // Also clear old global key if it exists
      localStorage.removeItem('research-consent')
    } else {
      // Fallback to old key if no userId
      localStorage.setItem('research-consent', JSON.stringify(consentData))
    }
  }
  
  return consentData
}

export function clearConsentFromStorage(userId?: string): void {
  if (typeof window !== 'undefined') {
    if (userId) {
      localStorage.removeItem(getConsentStorageKey(userId))
    }
    // Also clear old global key
    localStorage.removeItem('research-consent')
  }
}

export function hasGivenConsent(userId?: string): boolean {
  const consent = getConsentFromStorage(userId)
  // If userId provided, only return true if consent is for this specific user
  if (userId && consent) {
    return consent.userId === userId && consent.hasConsented === true
  }
  return consent?.hasConsented ?? false
}
