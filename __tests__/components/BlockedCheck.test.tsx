import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import BlockedCheck from '../../components/BlockedCheck'
import { renderWithProviders } from '../setup/test-utils'
import { useUser } from '@clerk/nextjs'
import { useRouter, usePathname } from 'next/navigation'
import { useBlockedStatus } from '../../hooks/useBlockedStatus'

// Mock dependencies
jest.mock('@clerk/nextjs', () => ({
  useUser: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}))

jest.mock('../../hooks/useBlockedStatus', () => ({
  useBlockedStatus: jest.fn(),
  clearBlockStatusCache: jest.fn(),
}))

const mockUseUser = useUser as jest.MockedFunction<typeof useUser>
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>
const mockUseBlockedStatus = useBlockedStatus as jest.MockedFunction<typeof useBlockedStatus>

describe('BlockedCheck Component', () => {
  const mockPush = jest.fn()
  const mockReplace = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: mockReplace,
      prefetch: jest.fn(),
    } as any)
    mockUsePathname.mockReturnValue('/')
  })

  it('renders children when user is not blocked', () => {
    mockUseUser.mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
      user: { id: 'user-123' },
    } as any)
    mockUseBlockedStatus.mockReturnValue({
      isBlocked: false,
      isLoading: false,
    } as any)

    renderWithProviders(
      <BlockedCheck>
        <div>Content</div>
      </BlockedCheck>
    )

    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('redirects to blocked page when user is blocked', async () => {
    mockUseUser.mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
      user: { id: 'user-123' },
    } as any)
    mockUseBlockedStatus.mockReturnValue({
      isBlocked: true,
      isLoading: false,
    } as any)

    renderWithProviders(
      <BlockedCheck>
        <div>Content</div>
      </BlockedCheck>
    )

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/blocked')
    })
  })

  it('shows loading spinner while checking block status', () => {
    mockUseUser.mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
      user: { id: 'user-123' },
    } as any)
    mockUseBlockedStatus.mockReturnValue({
      isBlocked: false,
      isLoading: true,
    } as any)

    renderWithProviders(
      <BlockedCheck>
        <div>Content</div>
      </BlockedCheck>
    )

    // Should show loading spinner
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('allows access to blocked page for blocked users', () => {
    mockUseUser.mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
      user: { id: 'user-123' },
    } as any)
    mockUsePathname.mockReturnValue('/blocked')
    mockUseBlockedStatus.mockReturnValue({
      isBlocked: true,
      isLoading: false,
    } as any)

    renderWithProviders(
      <BlockedCheck>
        <div>Blocked Page Content</div>
      </BlockedCheck>
    )

    expect(screen.getByText('Blocked Page Content')).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('allows access to contact page for blocked users', () => {
    mockUseUser.mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
      user: { id: 'user-123' },
    } as any)
    mockUsePathname.mockReturnValue('/contact')
    mockUseBlockedStatus.mockReturnValue({
      isBlocked: true,
      isLoading: false,
    } as any)

    renderWithProviders(
      <BlockedCheck>
        <div>Contact Page</div>
      </BlockedCheck>
    )

    expect(screen.getByText('Contact Page')).toBeInTheDocument()
  })

  it('does not check block status for signed-out users', () => {
    mockUseUser.mockReturnValue({
      isSignedIn: false,
      isLoaded: true,
      user: null,
    } as any)
    // When signed out, isLoading should be false to show content
    mockUseBlockedStatus.mockReturnValue({
      isBlocked: false,
      isLoading: false,
    } as any)

    renderWithProviders(
      <BlockedCheck>
        <div>Content</div>
      </BlockedCheck>
    )

    expect(screen.getByText('Content')).toBeInTheDocument()
    expect(mockUseBlockedStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    )
  })

  it('does not check block status while user is loading', () => {
    mockUseUser.mockReturnValue({
      isSignedIn: false,
      isLoaded: false,
      user: null,
    } as any)

    renderWithProviders(
      <BlockedCheck>
        <div>Content</div>
      </BlockedCheck>
    )

    expect(mockUseBlockedStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    )
  })

  it('shows loading spinner when blocked user is being redirected', () => {
    mockUseUser.mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
      user: { id: 'user-123' },
    } as any)
    mockUseBlockedStatus.mockReturnValue({
      isBlocked: true,
      isLoading: false,
    } as any)

    renderWithProviders(
      <BlockedCheck>
        <div>Content</div>
      </BlockedCheck>
    )

    // Should show loading while redirecting
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })
})

