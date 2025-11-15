import { screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ChatBox from '../../components/ChatBox'
import { renderWithProviders, createMockTrpc } from '../setup/test-utils'

// Mock tRPC
const mockTrpc = createMockTrpc()
jest.mock('../../lib/trpc-client', () => ({
  trpc: mockTrpc,
}))

// Mock Clerk
jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    isSignedIn: true,
    isLoaded: true,
    user: { id: 'test-user' },
  }),
}))

describe('ChatBox Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders chat interface', () => {
    renderWithProviders(<ChatBox sessionId="test-session" />)
    
    expect(screen.getByPlaceholderText(/ask me anything about programming/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('allows typing messages', () => {
    renderWithProviders(<ChatBox sessionId="test-session" />)
    
    const input = screen.getByPlaceholderText(/ask me anything about programming/i)
    fireEvent.change(input, { target: { value: 'Hello AI' } })
    
    expect(input).toHaveValue('Hello AI')
  })

  it('shows welcome message when no messages', () => {
    renderWithProviders(<ChatBox sessionId="test-session" />)
    
    expect(screen.getByText(/welcome to ai programming assistant/i)).toBeInTheDocument()
  })

  it('disables send button when input is empty', () => {
    renderWithProviders(<ChatBox sessionId="test-session" />)
    
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect(sendButton).toBeDisabled()
  })

  it('enables send button when input has text', () => {
    renderWithProviders(<ChatBox sessionId="test-session" />)
    
    const input = screen.getByPlaceholderText(/ask me anything about programming/i)
    const sendButton = screen.getByRole('button', { name: /send/i })
    
    fireEvent.change(input, { target: { value: 'Test message' } })
    
    expect(sendButton).not.toBeDisabled()
  })
})
