'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '../lib/trpc-client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'

export default function TRPCProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
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

          // Check error.data
          if ('data' in error) {
            const errorData = error.data as { httpStatus?: number; code?: string; message?: string }
            if (isAuthError(errorData.code, errorData.httpStatus)) {
              if (isBlockedError(errorData.code, errorData.message)) {
                handleBlockedUser()
              }
              return false
            }
            if (errorData.httpStatus === 404) return false
          }

          // Check error.code directly
          if ('code' in error) {
            const trpcError = error as { code?: string; message?: string }
            if (isAuthError(trpcError.code)) {
              if (isBlockedError(trpcError.code, trpcError.message)) {
                handleBlockedUser()
              }
              return false
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
