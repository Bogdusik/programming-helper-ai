# Tests

This directory contains all test files for the application.

## Structure

```
__tests__/
├── setup/           # Test utilities and mocks
│   ├── test-utils.tsx  # Custom render functions and helpers
│   └── mocks.ts         # Common mock data
├── components/      # Component tests
└── lib/            # Library/utility tests
```

## Running Tests

```bash
npm test
# or
npm run test:watch
```

## Test Utilities

### `renderWithProviders`
Custom render function that includes React Query provider for components that use tRPC.

### `createMockTrpc`
Helper to create mock tRPC hooks for testing.

### `suppressConsoleErrors`
Helper to suppress console errors during tests (useful for error boundary tests).

### `mockEnv`
Helper to mock environment variables during tests.

## Best Practices

1. Use `renderWithProviders` for components that use tRPC
2. Group related tests using `describe` blocks
3. Clean up mocks in `beforeEach`/`afterEach`
4. Use fake timers for time-dependent tests
5. Test both success and error cases

