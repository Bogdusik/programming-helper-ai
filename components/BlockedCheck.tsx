'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { useBlockedStatus } from '../hooks/useBlockedStatus'
import LoadingSpinner from './LoadingSpinner'

const BLOCKED_PATHS = ['/blocked', '/contact']

export default function BlockedCheck({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const { isBlocked, isLoading } = useBlockedStatus({
    skipPaths: BLOCKED_PATHS,
    enabled: isSignedIn && isLoaded,
  })

  useEffect(() => {
    if (isBlocked && !BLOCKED_PATHS.some(path => pathname.startsWith(path))) {
      router.replace('/blocked')
    }
  }, [isBlocked, pathname, router])

  if (isBlocked && !BLOCKED_PATHS.some(path => pathname.startsWith(path))) {
    return <LoadingSpinner />
  }

  if (isLoading && isSignedIn && isLoaded && !BLOCKED_PATHS.some(path => pathname.startsWith(path))) {
    return <LoadingSpinner />
  }

  return <>{children}</>
}

