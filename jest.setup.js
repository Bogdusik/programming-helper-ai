import '@testing-library/jest-dom'

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.OPENAI_API_KEY = 'test-key'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  usePathname() {
    return '/'
  },
}))

// Mock Clerk (client)
jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    isSignedIn: true,
    isLoaded: true,
    user: { id: 'test-user-id' }
  }),
  UserButton: () => <div>UserButton</div>,
  SignInButton: ({ children }) => <div>{children}</div>,
  ClerkProvider: ({ children }) => <div>{children}</div>,
}))

// Mock Clerk (server)
jest.mock('@clerk/nextjs/server', () => ({
  currentUser: jest.fn(),
  auth: jest.fn(),
}))

// Mock tRPC
jest.mock('./lib/trpc-client', () => ({
  trpc: {
    chat: {
      sendMessage: {
        useMutation: () => ({
          mutateAsync: jest.fn(),
          isPending: false,
          error: null
        })
      },
      getMessages: {
        useQuery: () => ({
          data: [],
          refetch: jest.fn()
        })
      },
      getSessions: {
        useQuery: () => ({
          data: []
        })
      }
    },
    stats: {
      getGlobalStats: {
        useQuery: () => ({
          data: { activeUsers: 0, totalQuestions: 0, totalSolutions: 0 }
        })
      }
    }
  }
}))
