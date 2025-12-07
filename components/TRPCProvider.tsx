'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '../lib/trpc-client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'

export default function TRPCProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retryDelay: (attemptIndex) => {
          // Exponential backoff with jitter for retries
          // For "Not Found" errors, use shorter delays (user creation is usually fast)
          return Math.min(1000 * 2 ** attemptIndex + Math.random() * 1000, 5000)
        },
        retry: (failureCount, error: unknown) => {
          if (!error || typeof error !== 'object') {
            return failureCount < 3
          }

          const handleBlockedUser = () => {
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/blocked')) {
              setTimeout(() => router.push('/blocked'), 0)
            }
          }

          const isAuthError = (code?: string, httpStatus?: number) => 
            code === 'UNAUTHORIZED' || code === 'FORBIDDEN' || httpStatus === 401 || httpStatus === 403

          const isBlockedError = (code?: string, message?: string) =>
            code === 'FORBIDDEN' && message === 'User account is blocked'

          // Check for "Not Found" errors from Clerk - these can be temporary during user creation
          const isNotFoundError = (code?: string, httpStatus?: number, message?: string, cause?: unknown) => {
            if (httpStatus === 404) return true
            if (code === 'INTERNAL_SERVER_ERROR' && message === 'Not Found') return true
            // Check if cause contains Clerk "not found" error
            if (cause && typeof cause === 'object' && 'clerkError' in cause) {
              const clerkCause = cause as { clerkError?: boolean; status?: number; errors?: Array<{ code?: string; message?: string }> }
              if (clerkCause.clerkError && clerkCause.status === 404) return true
              if (clerkCause.errors?.some(e => e.code === 'resource_not_found')) return true
            }
            return false
          }

          // Check error.data
          if ('data' in error) {
            const errorData = error.data as { httpStatus?: number; code?: string; message?: string }
            if (isAuthError(errorData.code, errorData.httpStatus)) {
              if (isBlockedError(errorData.code, errorData.message)) {
                handleBlockedUser()
              }
              return false
            }
            // Retry "Not Found" errors up to 2 times with delay (user might be creating)
            if (isNotFoundError(errorData.code, errorData.httpStatus, errorData.message)) {
              return failureCount < 2
            }
            if (errorData.httpStatus === 404 && !isNotFoundError(errorData.code, errorData.httpStatus, errorData.message)) {
              return false
            }
          }

          // Check error.cause for Clerk errors
          if ('cause' in error) {
            const cause = (error as { cause?: unknown }).cause
            if (isNotFoundError(undefined, undefined, undefined, cause)) {
              return failureCount < 2
            }
          }

          // Check error.code directly
          if ('code' in error) {
            const trpcError = error as { code?: string; message?: string; cause?: unknown }
            if (isAuthError(trpcError.code)) {
              if (isBlockedError(trpcError.code, trpcError.message)) {
                handleBlockedUser()
              }
              return false
            }
            // Retry INTERNAL_SERVER_ERROR with "Not Found" message
            if (isNotFoundError(trpcError.code, undefined, trpcError.message, trpcError.cause)) {
              return failureCount < 2
            }
          }

          return failureCount < 3
        },
        staleTime: 5 * 60 * 1000,
        // Don't refetch on window focus if user is not signed in
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: (failureCount, error: unknown) => {
          if (!error || typeof error !== 'object') {
            return failureCount < 1
          }

          const isAuthError = (code?: string, httpStatus?: number) => 
            code === 'UNAUTHORIZED' || code === 'FORBIDDEN' || httpStatus === 401 || httpStatus === 403

          if ('data' in error) {
            const errorData = error.data as { httpStatus?: number; code?: string }
            if (isAuthError(errorData.code, errorData.httpStatus)) return false
          }

          if ('code' in error) {
            const trpcError = error as { code?: string }
            if (isAuthError(trpcError.code)) return false
          }

          return failureCount < 1
        },
      },
    },
  }))
  
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          headers() {
            return {
              'x-trpc-source': 'react',
            }
          },
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  )
}
