import { analytics, trackUserAction, trackError, trackPerformance } from '../../lib/analytics'

describe('Analytics', () => {
  beforeEach(() => {
    analytics.clearEvents()
  })

  it('tracks user actions', () => {
    trackUserAction('test_action', 'user123', { test: 'data' })
    
    const events = analytics.getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('user.test_action')
    expect(events[0].userId).toBe('user123')
    expect(events[0].properties).toEqual({ test: 'data' })
  })

  it('tracks errors', () => {
    trackError('Test error', 'user123', { errorCode: 'TEST_001' })
    
    const events = analytics.getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('error.occurred')
    expect(events[0].properties).toMatchObject({ error: 'Test error', errorCode: 'TEST_001' })
  })

  it('tracks performance metrics', () => {
    trackPerformance('response_time', 1.5, 'user123')
    
    const events = analytics.getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('performance.metric')
    expect(events[0].properties).toEqual({ metric: 'response_time', value: 1.5 })
  })
})
