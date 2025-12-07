// Simple analytics and monitoring
import { logger } from './logger'

interface AnalyticsEvent {
  event: string
  userId?: string
  properties?: Record<string, unknown>
  timestamp: Date
}

class Analytics {
  private events: AnalyticsEvent[] = []

  track(event: string, properties?: Record<string, unknown>, userId?: string) {
    const analyticsEvent: AnalyticsEvent = {
      event,
      userId,
      properties,
      timestamp: new Date()
    }
    
    this.events.push(analyticsEvent)
    
    // In production, send to analytics service
    if (process.env.NODE_ENV === 'production') {
      this.sendToAnalytics(analyticsEvent)
    }
    
    // Log analytics event (only in development)
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Analytics event', analyticsEvent.userId, analyticsEvent.properties)
    }
  }

  private async sendToAnalytics(_event: AnalyticsEvent) {
    try {
      // Send to your analytics service (e.g., PostHog, Mixpanel, etc.)
      // await fetch('/api/analytics', {
      //   method: 'POST',
      //   body: JSON.stringify(event)
      // })
    } catch (error) {
      logger.error('Failed to send analytics', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  getEvents() {
    return this.events
  }

  clearEvents() {
    this.events = []
  }
}

export const analytics = new Analytics()

// Usage tracking functions
export const trackUserAction = (action: string, userId?: string, properties?: Record<string, unknown>) => {
  analytics.track(`user.${action}`, properties, userId)
}

export const trackError = (error: string, userId?: string, properties?: Record<string, unknown>) => {
  analytics.track('error.occurred', { error, ...properties }, userId)
}

export const trackPerformance = (metric: string, value: number, userId?: string) => {
  analytics.track('performance.metric', { metric, value }, userId)
}
