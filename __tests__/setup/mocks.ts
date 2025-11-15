// Common mocks for testing

export const mockUser = {
  id: 'test-user-id',
  emailAddresses: [{ emailAddress: 'test@example.com' }],
  firstName: 'Test',
  lastName: 'User',
}

export const mockSession = {
  id: 'test-session-id',
  title: 'Test Session',
  createdAt: new Date(),
  updatedAt: new Date(),
}

export const mockMessage = {
  id: 'test-message-id',
  role: 'user' as const,
  content: 'Test message',
  timestamp: new Date(),
}

// Mock Clerk
export const mockClerk = {
  useUser: () => ({
    isSignedIn: true,
    isLoaded: true,
    user: mockUser,
  }),
  useAuth: () => ({
    userId: mockUser.id,
    sessionId: 'test-session-id',
  }),
}

