import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ChatBox from '../../components/ChatBox'

// Mock tRPC
jest.mock('../../lib/trpc-client', () => ({
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
      }
    }
  }
}))

describe('ChatBox Component', () => {
  it('renders chat interface', () => {
    render(<ChatBox />)
    
    expect(screen.getByPlaceholderText(/ask me anything about programming/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('allows typing messages', () => {
    render(<ChatBox />)
    
    const input = screen.getByPlaceholderText(/ask me anything about programming/i)
    fireEvent.change(input, { target: { value: 'Hello AI' } })
    
    expect(input).toHaveValue('Hello AI')
  })

  it('shows welcome message when no messages', () => {
    render(<ChatBox />)
    
    expect(screen.getByText(/welcome to ai programming assistant/i)).toBeInTheDocument()
  })
})
