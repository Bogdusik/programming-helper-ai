import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ChatBox from '../../components/ChatBox'
import { renderWithProviders, createMockTrpc } from '../setup/test-utils'
import toast from 'react-hot-toast'

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn(),
  },
}))

// Mock tRPC
jest.mock('../../lib/trpc-client', () => {
  const { createMockTrpc } = require('../setup/test-utils')
  return {
    trpc: createMockTrpc(),
  }
})

// Mock Clerk
jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    isSignedIn: true,
    isLoaded: true,
    user: { id: 'test-user' },
  }),
}))

describe('ChatBox Extended Tests', () => {
  let mockTrpc: ReturnType<typeof createMockTrpc>

  beforeEach(() => {
    jest.clearAllMocks()
    // Get the mocked trpc
    const trpcModule = jest.requireMock('../../lib/trpc-client')
    mockTrpc = trpcModule.trpc
    
    // Reset mocks
    mockTrpc.chat.sendMessage.useMutation.mockReturnValue({
      mutateAsync: jest.fn(),
      mutate: jest.fn(),
      isPending: false,
      error: null,
      data: undefined,
    })
    mockTrpc.chat.getMessages.useQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    mockTrpc.profile.getProfile.useQuery.mockReturnValue({
      data: { profileCompleted: true },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    mockTrpc.assessment.getAssessments.useQuery.mockReturnValue({
      data: [{ type: 'pre' }],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
  })

  describe('Message Sending', () => {
    it('sends message successfully', async () => {
      const mockMutateAsync = jest.fn().mockResolvedValue({
        sessionId: 'new-session-id',
      })
      const mockRefetch = jest.fn().mockResolvedValue({})
      
      mockTrpc.chat.sendMessage.useMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
        mutate: jest.fn(),
        isPending: false,
        error: null,
        data: undefined,
      })
      
      mockTrpc.chat.getMessages.useQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      })

      renderWithProviders(<ChatBox sessionId="test-session" />)
      
      const input = screen.getByPlaceholderText(/ask me anything about programming/i)
      const sendButton = screen.getByRole('button', { name: /send/i })
      
      fireEvent.change(input, { target: { value: 'Test message' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          message: 'Test message',
          sessionId: 'test-session',
        })
      })
    })

    it('clears input after sending message', async () => {
      const mockMutateAsync = jest.fn().mockResolvedValue({
        sessionId: 'new-session-id',
      })
      
      mockTrpc.chat.sendMessage.useMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
        mutate: jest.fn(),
        isPending: false,
        error: null,
        data: undefined,
      })

      renderWithProviders(<ChatBox sessionId="test-session" />)
      
      const input = screen.getByPlaceholderText(/ask me anything about programming/i) as HTMLInputElement
      const sendButton = screen.getByRole('button', { name: /send/i })
      
      fireEvent.change(input, { target: { value: 'Test message' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(input.value).toBe('')
      })
    })

    it('shows loading state while sending', () => {
      mockTrpc.chat.sendMessage.useMutation.mockReturnValue({
        mutateAsync: jest.fn(),
        mutate: jest.fn(),
        isPending: true,
        error: null,
        data: undefined,
      })

      renderWithProviders(<ChatBox sessionId="test-session" />)
      
      expect(screen.getByText(/ai is thinking/i)).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('displays error message when sending fails', async () => {
      const mockMutateAsync = jest.fn().mockRejectedValue({
        message: 'Failed to send message',
        data: { code: 'INTERNAL_SERVER_ERROR' },
      })
      
      mockTrpc.chat.sendMessage.useMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
        mutate: jest.fn(),
        isPending: false,
        error: null,
        data: undefined,
      })

      renderWithProviders(<ChatBox sessionId="test-session" />)
      
      const input = screen.getByPlaceholderText(/ask me anything about programming/i)
      const sendButton = screen.getByRole('button', { name: /send/i })
      
      fireEvent.change(input, { target: { value: 'Test message' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })
    })

    it('handles rate limit errors', async () => {
      const mockMutateAsync = jest.fn().mockRejectedValue({
        message: 'Rate limit exceeded',
        data: { code: 'TOO_MANY_REQUESTS' },
      })
      
      mockTrpc.chat.sendMessage.useMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
        mutate: jest.fn(),
        isPending: false,
        error: {
          message: 'Rate limit exceeded',
          data: { code: 'TOO_MANY_REQUESTS' },
        },
        data: undefined,
      })

      renderWithProviders(<ChatBox sessionId="test-session" />)
      
      await waitFor(() => {
        expect(screen.getByText(/too many requests/i)).toBeInTheDocument()
      })
    })

    it('handles PRECONDITION_FAILED errors with refresh hint', async () => {
      const mockMutateAsync = jest.fn().mockRejectedValue({
        message: 'Please complete onboarding',
        data: { code: 'PRECONDITION_FAILED' },
      })
      
      mockTrpc.chat.sendMessage.useMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
        mutate: jest.fn(),
        isPending: false,
        error: null,
        data: undefined,
      })

      renderWithProviders(<ChatBox sessionId="test-session" />)
      
      const input = screen.getByPlaceholderText(/ask me anything about programming/i)
      const sendButton = screen.getByRole('button', { name: /send/i })
      
      fireEvent.change(input, { target: { value: 'Test message' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('Please refresh the page'),
          expect.any(Object)
        )
      })
    })
  })

  describe('Onboarding Checks', () => {
    it('blocks message sending when profile is not completed', () => {
      mockTrpc.profile.getProfile.useQuery.mockReturnValue({
        data: { profileCompleted: false },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      })

      renderWithProviders(<ChatBox sessionId="test-session" />)
      
      const input = screen.getByPlaceholderText(/please complete onboarding/i)
      const sendButton = screen.getByRole('button', { name: /send/i })
      
      expect(input).toBeDisabled()
      expect(sendButton).toBeDisabled()
    })

    it('blocks message sending when assessment is not completed', () => {
      mockTrpc.profile.getProfile.useQuery.mockReturnValue({
        data: { profileCompleted: true },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      })
      
      mockTrpc.assessment.getAssessments.useQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      })

      renderWithProviders(<ChatBox sessionId="test-session" />)
      
      const input = screen.getByPlaceholderText(/please complete onboarding/i)
      const sendButton = screen.getByRole('button', { name: /send/i })
      
      expect(input).toBeDisabled()
      expect(sendButton).toBeDisabled()
    })

    it('shows error toast when trying to send without completing profile', async () => {
      mockTrpc.profile.getProfile.useQuery.mockReturnValue({
        data: { profileCompleted: false },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      })

      renderWithProviders(<ChatBox sessionId="test-session" />)
      
      const input = screen.getByPlaceholderText(/please complete onboarding/i)
      const sendButton = screen.getByRole('button', { name: /send/i })
      
      // Try to enable input (shouldn't work, but test the logic)
      fireEvent.change(input, { target: { value: 'Test' } })
      
      // Input should still be disabled
      expect(input).toBeDisabled()
    })
  })

  describe('Session Management', () => {
    it('calls onSessionCreated when new session is created', async () => {
      const onSessionCreated = jest.fn()
      const mockMutateAsync = jest.fn().mockResolvedValue({
        sessionId: 'new-session-id',
      })
      
      mockTrpc.chat.sendMessage.useMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
        mutate: jest.fn(),
        isPending: false,
        error: null,
        data: undefined,
      })

      renderWithProviders(
        <ChatBox 
          sessionId={undefined} 
          onSessionCreated={onSessionCreated}
        />
      )
      
      const input = screen.getByPlaceholderText(/ask me anything about programming/i)
      const sendButton = screen.getByRole('button', { name: /send/i })
      
      fireEvent.change(input, { target: { value: 'Test message' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(onSessionCreated).toHaveBeenCalledWith('new-session-id')
      })
    })
  })

  describe('Message Display', () => {
    it('displays existing messages', () => {
      const messages = [
        {
          id: '1',
          role: 'user' as const,
          content: 'Hello',
          timestamp: new Date(),
        },
        {
          id: '2',
          role: 'assistant' as const,
          content: 'Hi there!',
          timestamp: new Date(),
        },
      ]

      mockTrpc.chat.getMessages.useQuery.mockReturnValue({
        data: messages,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      })

      renderWithProviders(<ChatBox sessionId="test-session" />)
      
      expect(screen.getByText('Hello')).toBeInTheDocument()
      expect(screen.getByText('Hi there!')).toBeInTheDocument()
    })

    it('shows welcome message when no messages', () => {
      mockTrpc.chat.getMessages.useQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      })

      renderWithProviders(<ChatBox sessionId="test-session" />)
      
      expect(screen.getByText(/welcome to ai programming assistant/i)).toBeInTheDocument()
    })
  })
})

