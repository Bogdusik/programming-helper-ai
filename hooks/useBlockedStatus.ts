import { useUser } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'

// Simple in-memory cache to avoid duplicate requests
const blockStatusCache = new Map<string, { isBlocked: boolean; timestamp: number }>()
const CACHE_DURATION = 30 * 1000 // 30 seconds cache to reduce API calls while still being responsive

// OPTIMIZATION: Global flag to prevent multiple simultaneous requests
let activeRequest: Promise<boolean> | null = null
let activeRequestUserId: string | null = null

/**
 * Custom hook to check if the current user is blocked
 * @param options - Configuration options
 * @param options.skipPaths - Paths to skip checking (e.g., ['/blocked', '/contact'])
 * @param options.enabled - Whether to enable the check (default: true)
 * @returns Object with isBlocked status and loading state
 */
export function useBlockedStatus(options: {
  skipPaths?: string[]
  enabled?: boolean
} = {}) {
  const { skipPaths = ['/blocked', '/contact'], enabled = true } = options
  const { isSignedIn, isLoaded, user } = useUser()
  const pathname = usePathname()
  const [isBlocked, setIsBlocked] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Use refs to store values that don't need to trigger re-renders
  const skipPathsRef = useRef(skipPaths)
  const enabledRef = useRef(enabled)
  
  // Update refs when values change (without triggering re-render)
  useEffect(() => {
    skipPathsRef.current = skipPaths
    enabledRef.current = enabled
  }, [skipPaths, enabled])

  const checkBlockStatus = useCallback(async () => {
    const currentEnabled = enabledRef.current
    const currentSkipPaths = skipPathsRef.current
    
    if (!currentEnabled || !isSignedIn || !isLoaded || !user?.id) {
      setIsBlocked(false)
      setIsLoading(false)
      return
    }

    // OPTIMIZATION: Check pathname inside callback to avoid recreating function
    if (currentSkipPaths.some(path => pathname.startsWith(path))) {
      setIsBlocked(false)
      setIsLoading(false)
      return
    }

    // OPTIMIZATION: Use cache for both blocked and non-blocked users
    // This reduces API calls while still being responsive
    const cached = blockStatusCache.get(user.id)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      // Use cache if still valid (for both blocked and non-blocked)
      setIsBlocked(cached.isBlocked)
      setIsLoading(false)
      return
    }
    // If cache expired or doesn't exist, re-check

    // CRITICAL: If there's already an active request for this user, wait for it
    // This prevents multiple simultaneous requests from different components
    if (activeRequest && activeRequestUserId === user.id) {
      try {
        const blocked = await activeRequest
        setIsBlocked(blocked)
        setIsLoading(false)
      } catch {
        setIsBlocked(false)
        setIsLoading(false)
      }
      return
    }

    // OPTIMIZATION: Don't make request if already loading (prevent duplicate requests)
    if (abortControllerRef.current) {
      // Wait for existing request to complete
      if (activeRequest && activeRequestUserId === user.id) {
        activeRequest.then(blocked => {
          setIsBlocked(blocked)
          setIsLoading(false)
        }).catch(() => {
          setIsBlocked(false)
          setIsLoading(false)
        })
      }
      return
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    // OPTIMIZATION: Create a shared promise for all components to use
    const requestPromise = (async () => {
      try {
        const response = await fetch('/api/check-blocked', {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        })
        
        if (response.ok) {
          const data = await response.json()
          const blocked = data.isBlocked ?? false
          // Cache the result
          blockStatusCache.set(user.id, { isBlocked: blocked, timestamp: Date.now() })
          return blocked
        } else {
          return false
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error
        }
        console.error('Error checking block status:', error)
        return false
      } finally {
        activeRequest = null
        activeRequestUserId = null
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
        }
      }
    })()

    activeRequest = requestPromise
    activeRequestUserId = user.id

    try {
      const blocked = await requestPromise
      setIsBlocked(blocked)
    } catch {
      setIsBlocked(false)
    } finally {
      setIsLoading(false)
    }
  }, [isSignedIn, isLoaded, user?.id, pathname])

  useEffect(() => {
    if (!isLoaded) {
      setIsLoading(false)
      return
    }

    if (!isSignedIn) {
      setIsBlocked(false)
      setIsLoading(false)
      // OPTIMIZATION: Clear active request if user signed out
      if (activeRequestUserId && activeRequestUserId !== user?.id) {
        activeRequest = null
        activeRequestUserId = null
      }
      return
    }

    const currentSkipPaths = skipPathsRef.current
    const currentEnabled = enabledRef.current

    // OPTIMIZATION: Check if path should be skipped before making request
    if (currentSkipPaths.some(path => pathname.startsWith(path))) {
      setIsBlocked(false)
      setIsLoading(false)
      return
    }

    // CRITICAL: Set loading state immediately when starting check
    // This ensures UI shows loading before API call completes
    if (!currentEnabled) {
      setIsBlocked(false)
      setIsLoading(false)
      return
    }

    // OPTIMIZATION: Check cache immediately before making request
    // Use cache for both blocked and non-blocked users if still valid
    const cached = blockStatusCache.get(user?.id || '')
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      // Use cache if still valid (for both blocked and non-blocked)
      setIsBlocked(cached.isBlocked)
      setIsLoading(false)
      return
    }
    // If cache expired or doesn't exist, re-check

    // CRITICAL: Set loading state BEFORE making request
    // This ensures UI blocks content immediately
    setIsLoading(true)
    
    // Check immediately for blocked users - no delay needed
    checkBlockStatus()
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, pathname, user?.id])

  return { isBlocked, isLoading }
}

// Helper to clear cache when user signs out or is unblocked
export function clearBlockStatusCache(userId?: string) {
  if (userId) {
    blockStatusCache.delete(userId)
    // OPTIMIZATION: Clear active request if it's for this user
    if (activeRequestUserId === userId) {
      activeRequest = null
      activeRequestUserId = null
    }
  } else {
    blockStatusCache.clear()
    activeRequest = null
    activeRequestUserId = null
  }
}
