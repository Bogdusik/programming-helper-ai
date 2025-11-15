import { analytics, trackUserAction, trackError, trackPerformance } from '../../lib/analytics'

describe('Analytics', () => {
  beforeEach(() => {
    analytics.clearEvents()
  })

  describe('user actions', () => {
    it('tracks user actions with metadata', () => {
      trackUserAction('test_action', 'user123', { test: 'data' })
      
      const events = analytics.getEvents()
      expect(events).toHaveLength(1)
      expect(events[0].event).toBe('user.test_action')
      expect(events[0].userId).toBe('user123')
      expect(events[0].properties).toEqual({ test: 'data' })
    })

    it('tracks user actions without metadata', () => {
      trackUserAction('simple_action', 'user123')
      
      const events = analytics.getEvents()
      expect(events[0].properties).toEqual({})
    })

    it('tracks multiple user actions', () => {
      trackUserAction('action1', 'user123')
      trackUserAction('action2', 'user123')
      
      const events = analytics.getEvents()
      expect(events).toHaveLength(2)
      expect(events[0].event).toBe('user.action1')
      expect(events[1].event).toBe('user.action2')
    })
  })

  describe('error tracking', () => {
    it('tracks errors with error code', () => {
      trackError('Test error', 'user123', { errorCode: 'TEST_001' })
      
      const events = analytics.getEvents()
      expect(events).toHaveLength(1)
      expect(events[0].event).toBe('error.occurred')
      expect(events[0].properties).toMatchObject({ 
        error: 'Test error', 
        errorCode: 'TEST_001' 
      })
    })

    it('tracks errors without additional metadata', () => {
      trackError('Simple error', 'user123')
      
      const events = analytics.getEvents()
      expect(events[0].properties).toMatchObject({ error: 'Simple error' })
    })
  })

  describe('performance tracking', () => {
    it('tracks performance metrics', () => {
      trackPerformance('response_time', 1.5, 'user123')
      
      const events = analytics.getEvents()
      expect(events).toHaveLength(1)
      expect(events[0].event).toBe('performance.metric')
      expect(events[0].properties).toEqual({ 
        metric: 'response_time', 
        value: 1.5 
      })
    })

    it('tracks multiple performance metrics', () => {
      trackPerformance('response_time', 1.5, 'user123')
      trackPerformance('render_time', 0.8, 'user123')
      
      const events = analytics.getEvents()
      expect(events).toHaveLength(2)
      expect(events[0].properties.metric).toBe('response_time')
      expect(events[1].properties.metric).toBe('render_time')
    })
  })

  describe('event management', () => {
    it('clears events correctly', () => {
      trackUserAction('test', 'user123')
      expect(analytics.getEvents()).toHaveLength(1)
      
      analytics.clearEvents()
      expect(analytics.getEvents()).toHaveLength(0)
    })

    it('maintains event order', () => {
      trackUserAction('first', 'user123')
      trackError('error', 'user123')
      trackPerformance('metric', 1.0, 'user123')
      
      const events = analytics.getEvents()
      expect(events[0].event).toBe('user.first')
      expect(events[1].event).toBe('error.occurred')
      expect(events[2].event).toBe('performance.metric')
    })
  })
})
