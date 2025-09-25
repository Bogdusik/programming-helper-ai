'use client'

import { useState } from 'react'
import { trpc } from '../lib/trpc-client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'

export default function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error: any) => {
          // Don't retry on 404 errors
          if (error?.data?.httpStatus === 404) return false
          return failureCount < 3
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
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
