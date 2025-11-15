import { useUser } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'

// Simple in-memory cache to avoid duplicate requests
const blockStatusCache = new Map<string, { isBlocked: boolean; timestamp: number }>()
const CACHE_DURATION = 60 * 1000 // OPTIMIZATION: Increased to 60 seconds cache to reduce API calls

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

  const checkBlockStatus = useCallback(async () => {
    if (!enabled || !isSignedIn || !isLoaded || !user?.id) {
      setIsBlocked(false)
      setIsLoading(false)
      return
    }

    // OPTIMIZATION: Check pathname inside callback to avoid recreating function
    if (skipPaths.some(path => pathname.startsWith(path))) {
      setIsBlocked(false)
      setIsLoading(false)
      return
    }

    // Check cache first
    const cached = blockStatusCache.get(user.id)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setIsBlocked(cached.isBlocked)
      setIsLoading(false)
      return
    }

    // OPTIMIZATION: If there's already an active request for this user, wait for it
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
      return // Already checking, wait for result
    }

    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsLoading(true)

    // OPTIMIZATION: Create a shared promise for all components to use
    const requestPromise = (async () => {
      try {
        const response = await fetch('/api/check-blocked', {
          cache: 'no-store',
          signal: controller.signal,
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
  }, [isSignedIn, isLoaded, enabled, user?.id]) // OPTIMIZATION: Removed pathname and skipPaths from deps

  useEffect(() => {
    if (!isLoaded) return

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

    // OPTIMIZATION: Check if path should be skipped before making request
    if (skipPaths.some(path => pathname.startsWith(path))) {
      setIsBlocked(false)
      setIsLoading(false)
      return
    }

    // OPTIMIZATION: Check cache immediately before making request
    const cached = blockStatusCache.get(user?.id || '')
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setIsBlocked(cached.isBlocked)
      setIsLoading(false)
      return
    }

    // Small delay to avoid checking during sign out and to debounce rapid pathname changes
    const timeoutId = setTimeout(checkBlockStatus, 150)
    return () => {
      clearTimeout(timeoutId)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [isLoaded, isSignedIn, checkBlockStatus, pathname, skipPaths, user?.id])

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
