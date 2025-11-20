'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useBlockedStatus, clearBlockStatusCache } from '../hooks/useBlockedStatus'
import LoadingSpinner from './LoadingSpinner'

// Only these paths are allowed for blocked users
const ALLOWED_PATHS_FOR_BLOCKED = ['/blocked', '/contact']

export default function BlockedCheck({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded, user } = useUser()
  const router = useRouter()
  const pathname = usePathname()
  
  // OPTIMIZATION: Only clear cache when user actually changes (not on every render)
  // This prevents unnecessary cache clearing that causes extra API calls
  const prevUserIdRef = useRef<string | undefined>(undefined)
  const isOnBlockedPage = ALLOWED_PATHS_FOR_BLOCKED.some(path => pathname.startsWith(path))
  
  // CRITICAL: Only clear cache when user ID actually changes
  // Don't clear on blocked/contact pages - it causes slow loading and extra requests
  useEffect(() => {
    // Only clear cache when user changes, not on every mount/render
    if (isLoaded && isSignedIn && user?.id && prevUserIdRef.current !== user.id) {
      // Only clear if NOT on blocked page (to avoid slow loading)
      if (!isOnBlockedPage) {
        clearBlockStatusCache(user.id)
      }
      prevUserIdRef.current = user.id
    } else if (!isSignedIn) {
      prevUserIdRef.current = undefined
    }
  }, [isLoaded, isSignedIn, user?.id, isOnBlockedPage])
  
  // CRITICAL: Check block status on all pages except blocked/contact
  // This must be the primary check that prevents content from showing
  const { isBlocked, isLoading } = useBlockedStatus({
    skipPaths: isOnBlockedPage ? ['/blocked', '/contact'] : [], // Skip check on blocked page
    enabled: isSignedIn && isLoaded && !isOnBlockedPage, // Disable check on blocked page
  })

  // Redirect to blocked page immediately when blocked status is detected
  // Blocked users can ONLY access /blocked and /contact pages
  useEffect(() => {
    if (isBlocked && !ALLOWED_PATHS_FOR_BLOCKED.some(path => pathname.startsWith(path))) {
      // Use replace to prevent back button navigation
      router.replace('/blocked')
    }
  }, [isBlocked, pathname, router])

  // CRITICAL: Always show loading while checking block status for signed-in users
  // This prevents content from flashing before block check completes
  if (isSignedIn && isLoaded && !isOnBlockedPage && isLoading) {
    return <LoadingSpinner />
  }

  // CRITICAL: If user is blocked, show loading while redirecting
  // Never show content to blocked users
  if (isBlocked && !ALLOWED_PATHS_FOR_BLOCKED.some(path => pathname.startsWith(path))) {
    return <LoadingSpinner />
  }

  return <>{children}</>
}

