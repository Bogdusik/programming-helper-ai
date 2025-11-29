import React from 'react'
import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import Message from '../../components/Message'
import { renderWithProviders } from '../setup/test-utils'

describe('Message Component', () => {
  it('renders user message correctly', () => {
    const timestamp = new Date('2024-01-01T12:00:00')
    renderWithProviders(
      <Message 
        role="user" 
        content="Hello, this is a test message" 
        timestamp={timestamp}
      />
    )
    
    expect(screen.getByText('Hello, this is a test message')).toBeInTheDocument()
    expect(screen.getByText(timestamp.toLocaleTimeString())).toBeInTheDocument()
  })

  it('renders assistant message correctly', () => {
    const timestamp = new Date('2024-01-01T12:00:00')
    renderWithProviders(
      <Message 
        role="assistant" 
        content="This is an AI response" 
        timestamp={timestamp}
      />
    )
    
    expect(screen.getByText('This is an AI response')).toBeInTheDocument()
    expect(screen.getByText(timestamp.toLocaleTimeString())).toBeInTheDocument()
  })

  it('displays user message with correct styling', () => {
    const { container } = renderWithProviders(
      <Message 
        role="user" 
        content="User message" 
        timestamp={new Date()}
      />
    )
    
    // Find the outer container div with flex class
    const messageContainer = container.querySelector('.flex.justify-end')
    expect(messageContainer).toBeInTheDocument()
  })

  it('displays assistant message with correct styling', () => {
    const { container } = renderWithProviders(
      <Message 
        role="assistant" 
        content="Assistant message" 
        timestamp={new Date()}
      />
    )
    
    // Find the outer container div with flex class
    const messageContainer = container.querySelector('.flex.justify-start')
    expect(messageContainer).toBeInTheDocument()
  })

  it('handles multi-line content correctly', () => {
    const multiLineContent = 'Line 1\nLine 2\nLine 3'
    renderWithProviders(
      <Message 
        role="user" 
        content={multiLineContent} 
        timestamp={new Date()}
      />
    )
    
    // Check that all lines are present (whitespace-pre-wrap preserves newlines)
    expect(screen.getByText(/Line 1/i)).toBeInTheDocument()
    expect(screen.getByText(/Line 2/i)).toBeInTheDocument()
    expect(screen.getByText(/Line 3/i)).toBeInTheDocument()
  })

  it('displays timestamp in correct format', () => {
    const timestamp = new Date('2024-01-01T14:30:00')
    renderWithProviders(
      <Message 
        role="user" 
        content="Test" 
        timestamp={timestamp}
      />
    )
    
    expect(screen.getByText(timestamp.toLocaleTimeString())).toBeInTheDocument()
  })
})

