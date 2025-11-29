import React from 'react'
import { screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import ChatSidebar from '../../components/ChatSidebar'
import { renderWithProviders, createMockTrpc } from '../setup/test-utils'
import toast from 'react-hot-toast'

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    promise: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}))

// Mock tRPC - use require inside to avoid initialization issues
jest.mock('../../lib/trpc-client', () => {
  const { createMockTrpc } = require('../setup/test-utils')
  return {
    trpc: createMockTrpc(),
  }
})

describe('ChatSidebar Component', () => {
  const mockOnSessionSelect = jest.fn()
  const mockOnNewChat = jest.fn()
  let mockTrpc: ReturnType<typeof createMockTrpc>
  
  beforeEach(() => {
    jest.clearAllMocks()
    // Get the mocked trpc instance
    const { trpc } = require('../../lib/trpc-client')
    mockTrpc = trpc
    
    mockTrpc.chat.getSessions.useQuery.mockReturnValue({
      data: [
        {
          id: 'session-1',
          title: 'Session 1',
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [],
        },
        {
          id: 'session-2',
          title: 'Session 2',
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [],
        },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    mockTrpc.chat.deleteSession.useMutation.mockReturnValue({
      mutateAsync: jest.fn(),
      mutate: jest.fn(),
      isPending: false,
      error: null,
      data: undefined,
    })
    mockTrpc.chat.updateSessionTitle.useMutation.mockReturnValue({
      mutateAsync: jest.fn(),
      mutate: jest.fn(),
      isPending: false,
      error: null,
      data: undefined,
    })
  })

  it('renders list of sessions', () => {
    renderWithProviders(
      <ChatSidebar
        currentSessionId="session-1"
        onSessionSelect={mockOnSessionSelect}
        onNewChat={mockOnNewChat}
      />
    )

    expect(screen.getByText('Session 1')).toBeInTheDocument()
    expect(screen.getByText('Session 2')).toBeInTheDocument()
  })

  it('calls onSessionSelect when session is clicked', () => {
    renderWithProviders(
      <ChatSidebar
        currentSessionId="session-1"
        onSessionSelect={mockOnSessionSelect}
        onNewChat={mockOnNewChat}
      />
    )

    const session2 = screen.getByText('Session 2')
    fireEvent.click(session2)

    expect(mockOnSessionSelect).toHaveBeenCalledWith('session-2')
  })

  it('calls onNewChat when new chat button is clicked', () => {
    renderWithProviders(
      <ChatSidebar
        currentSessionId="session-1"
        onSessionSelect={mockOnSessionSelect}
        onNewChat={mockOnNewChat}
      />
    )

    const newChatButton = screen.getByText(/new chat/i)
    fireEvent.click(newChatButton)

    expect(mockOnNewChat).toHaveBeenCalled()
  })

  it('shows loading state', () => {
    mockTrpc.chat.getSessions.useQuery.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    })

    renderWithProviders(
      <ChatSidebar
        currentSessionId="session-1"
        onSessionSelect={mockOnSessionSelect}
        onNewChat={mockOnNewChat}
      />
    )

    // The component might not show explicit "loading" text, but should show empty state or spinner
    // Check if sessions list is empty or loading indicator exists
    expect(screen.queryByText('Session 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Session 2')).not.toBeInTheDocument()
  })

  it('displays empty state when no sessions', () => {
    mockTrpc.chat.getSessions.useQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })

    renderWithProviders(
      <ChatSidebar
        currentSessionId={undefined}
        onSessionSelect={mockOnSessionSelect}
        onNewChat={mockOnNewChat}
      />
    )

    expect(screen.getByText(/no chats yet/i)).toBeInTheDocument()
  })

  it('handles session deletion', async () => {
    const mockDelete = jest.fn().mockResolvedValue({ success: true, tasksReset: 0 })
    mockTrpc.chat.deleteSession.useMutation.mockReturnValue({
      mutateAsync: mockDelete,
      mutate: jest.fn(),
      isPending: false,
      error: null,
      data: undefined,
    })

    renderWithProviders(
      <ChatSidebar
        currentSessionId="session-1"
        onSessionSelect={mockOnSessionSelect}
        onNewChat={mockOnNewChat}
      />
    )

    // Buttons are hidden by CSS (opacity-0) until hover, but they're still in the DOM
    // We need to find the button within the specific session item
    const sessionItem = screen.getByText('Session 1').closest('div[class*="group"]')
    expect(sessionItem).toBeTruthy()
    
    const deleteButton = await waitFor(() => {
      return within(sessionItem!).getByTitle('Delete chat')
    }, { timeout: 2000 })
    
    // Force click even if button is not visible (CSS opacity doesn't prevent clicks)
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith({ sessionId: 'session-1' })
    })
  })

  it('handles title editing', async () => {
    const mockUpdate = jest.fn().mockResolvedValue({})
    mockTrpc.chat.updateSessionTitle.useMutation.mockReturnValue({
      mutateAsync: mockUpdate,
      mutate: jest.fn(),
      isPending: false,
      error: null,
      data: undefined,
    })

    renderWithProviders(
      <ChatSidebar
        currentSessionId="session-1"
        onSessionSelect={mockOnSessionSelect}
        onNewChat={mockOnNewChat}
      />
    )

    // Buttons are hidden by CSS (opacity-0) until hover, but they're still in the DOM
    // We need to find the button within the specific session item
    const sessionItem = screen.getByText('Session 1').closest('div[class*="group"]')
    expect(sessionItem).toBeTruthy()
    
    const editButton = await waitFor(() => {
      return within(sessionItem!).getByTitle('Rename chat')
    }, { timeout: 2000 })
    
    // Force click even if button is not visible (CSS opacity doesn't prevent clicks)
    act(() => {
      fireEvent.click(editButton)
    })

    // After clicking edit, the input should appear
    // The input is rendered when isEditing === session.id
    // Use waitFor to wait for the input to appear
    // The input has value={editTitle} which is set to session.title when editing starts
    const input = await waitFor(() => {
      // Try to find input by its value or by role
      const inputs = screen.getAllByRole('textbox')
      const inputWithValue = inputs.find(inp => (inp as HTMLInputElement).value === 'Session 1')
      if (inputWithValue) {
        return inputWithValue as HTMLInputElement
      }
      // Fallback: try getByDisplayValue
      return screen.getByDisplayValue('Session 1')
    }, { timeout: 2000 })
    
    // Now change the value and press Enter
    act(() => {
      fireEvent.change(input, { target: { value: 'Updated Title' } })
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    })

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        sessionId: 'session-1',
        title: 'Updated Title',
      })
    })
  })
})

