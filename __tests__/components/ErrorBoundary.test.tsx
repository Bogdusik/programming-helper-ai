import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import ErrorBoundary from '../../components/ErrorBoundary'
import { renderWithProviders, suppressConsoleErrors, mockEnv } from '../setup/test-utils'

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

describe('ErrorBoundary', () => {
  let consoleSpy: ReturnType<typeof suppressConsoleErrors>

  beforeEach(() => {
    consoleSpy = suppressConsoleErrors()
  })

  afterEach(() => {
    consoleSpy.restore()
  })

  it('renders children when no error', () => {
    renderWithProviders(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('renders error fallback when error occurs', () => {
    renderWithProviders(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getAllByText(/try again/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/go home/i)).toBeInTheDocument()
  })

  it('shows error details in development', () => {
    const envMock = mockEnv({ NODE_ENV: 'development' })
    
    renderWithProviders(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(screen.getByText(/error details/i)).toBeInTheDocument()
    
    envMock.restore()
  })

  it('hides error details in production', () => {
    const envMock = mockEnv({ NODE_ENV: 'production' })
    
    renderWithProviders(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(screen.queryByText(/error details/i)).not.toBeInTheDocument()
    
    envMock.restore()
  })
})
