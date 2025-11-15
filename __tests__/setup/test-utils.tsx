import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Create a test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })

// Custom render function with providers
export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const queryClient = createTestQueryClient()

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return render(ui, { wrapper: Wrapper, ...options })
}

// Mock tRPC utilities
export const createMockTrpc = () => ({
  chat: {
    sendMessage: {
      useMutation: jest.fn(() => ({
        mutateAsync: jest.fn(),
        mutate: jest.fn(),
        isPending: false,
        error: null,
        data: undefined,
      })),
    },
    getMessages: {
      useQuery: jest.fn(() => ({
        data: [],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      })),
    },
    getSessions: {
      useQuery: jest.fn(() => ({
        data: [],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      })),
    },
  },
  profile: {
    getProfile: {
      useQuery: jest.fn(() => ({
        data: null,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      })),
    },
  },
})

// Helper to suppress console errors in tests
export const suppressConsoleErrors = () => {
  const originalError = console.error
  const mockError = jest.fn()
  console.error = mockError

  return {
    mockError,
    restore: () => {
      console.error = originalError
    },
  }
}

// Helper to mock environment variables
export const mockEnv = (env: Record<string, string | undefined>) => {
  const originalEnv = { ...process.env }
  Object.assign(process.env, env)

  return {
    restore: () => {
      process.env = originalEnv
    },
  }
}

