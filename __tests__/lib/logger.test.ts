import { logger, LogLevel } from '../../lib/logger'

// Mock console methods
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation()
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation()
const mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation()
const mockConsoleDebug = jest.spyOn(console, 'debug').mockImplementation()

describe('Logger', () => {
  beforeEach(() => {
    logger.clearLogs()
    mockConsoleError.mockClear()
    mockConsoleWarn.mockClear()
    mockConsoleInfo.mockClear()
    mockConsoleDebug.mockClear()
  })

  afterAll(() => {
    mockConsoleError.mockRestore()
    mockConsoleWarn.mockRestore()
    mockConsoleInfo.mockRestore()
    mockConsoleDebug.mockRestore()
  })

  it('logs error messages', () => {
    logger.error('Test error', 'user123', { code: 'TEST_001' })
    
    const logs = logger.getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].level).toBe(LogLevel.ERROR)
    expect(logs[0].message).toBe('Test error')
    expect(logs[0].userId).toBe('user123')
    expect(logs[0].metadata).toEqual({ code: 'TEST_001' })
    
    expect(mockConsoleError).toHaveBeenCalled()
  })

  it('logs info messages', () => {
    logger.info('Test info', 'user123')
    
    const logs = logger.getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].level).toBe(LogLevel.INFO)
    expect(logs[0].message).toBe('Test info')
    
    expect(mockConsoleInfo).toHaveBeenCalled()
  })

  it('clears logs', () => {
    logger.error('Test error')
    expect(logger.getLogs()).toHaveLength(1)
    
    logger.clearLogs()
    expect(logger.getLogs()).toHaveLength(0)
  })
})
