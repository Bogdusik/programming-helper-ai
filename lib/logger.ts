// Simple logging system
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: Date
  userId?: string
  metadata?: Record<string, unknown>
}

class Logger {
  private logs: LogEntry[] = []

  log(level: LogLevel, message: string, userId?: string, metadata?: Record<string, unknown>) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      userId,
      metadata
    }

    this.logs.push(entry)

    // Console output
    const timestamp = entry.timestamp.toISOString()
    const userInfo = userId ? `[${userId}]` : ''
    const metaInfo = metadata ? ` ${JSON.stringify(metadata)}` : ''
    
    console[level](`[${timestamp}] ${level.toUpperCase()} ${userInfo} ${message}${metaInfo}`)

    // In production, send to logging service
    if (process.env.NODE_ENV === 'production') {
      this.sendToLoggingService(entry)
    }
  }

  error(message: string, userId?: string, metadata?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, message, userId, metadata)
  }

  warn(message: string, userId?: string, metadata?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, userId, metadata)
  }

  info(message: string, userId?: string, metadata?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, userId, metadata)
  }

  debug(message: string, userId?: string, metadata?: Record<string, unknown>) {
    this.log(LogLevel.DEBUG, message, userId, metadata)
  }

  private async sendToLoggingService(_entry: LogEntry) {
    // Send to your logging service (e.g., LogRocket, Sentry, etc.)
    // This is a placeholder for future implementation
    // await fetch('/api/logs', {
    //   method: 'POST',
    //   body: JSON.stringify(_entry)
    // })
  }

  getLogs() {
    return this.logs
  }

  clearLogs() {
    this.logs = []
  }
}

export const logger = new Logger()
