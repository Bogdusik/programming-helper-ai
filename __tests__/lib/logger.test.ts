import { logger, LogLevel } from '../../lib/logger'

describe('Logger', () => {
  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation()
  const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation()
  const mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation()
  const mockConsoleDebug = jest.spyOn(console, 'debug').mockImplementation()

  beforeEach(() => {
    logger.clearLogs()
    jest.clearAllMocks()
  })

  afterAll(() => {
    mockConsoleError.mockRestore()
    mockConsoleWarn.mockRestore()
    mockConsoleInfo.mockRestore()
    mockConsoleDebug.mockRestore()
  })

  describe('error logging', () => {
    it('logs error messages with metadata', () => {
      logger.error('Test error', 'user123', { code: 'TEST_001' })
      
      const logs = logger.getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].level).toBe(LogLevel.ERROR)
      expect(logs[0].message).toBe('Test error')
      expect(logs[0].userId).toBe('user123')
      expect(logs[0].metadata).toEqual({ code: 'TEST_001' })
      expect(mockConsoleError).toHaveBeenCalled()
    })

    it('logs error without userId', () => {
      logger.error('Test error')
      
      const logs = logger.getLogs()
      expect(logs[0].userId).toBeUndefined()
    })
  })

  describe('info logging', () => {
    it('logs info messages', () => {
      logger.info('Test info', 'user123')
      
      const logs = logger.getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].level).toBe(LogLevel.INFO)
      expect(logs[0].message).toBe('Test info')
      expect(mockConsoleInfo).toHaveBeenCalled()
    })
  })

  describe('warn logging', () => {
    it('logs warning messages', () => {
      logger.warn('Test warning', 'user123')
      
      const logs = logger.getLogs()
      expect(logs[0].level).toBe(LogLevel.WARN)
      expect(mockConsoleWarn).toHaveBeenCalled()
    })
  })

  describe('log management', () => {
    it('clears logs', () => {
      logger.error('Test error')
      expect(logger.getLogs()).toHaveLength(1)
      
      logger.clearLogs()
      expect(logger.getLogs()).toHaveLength(0)
    })

    it('maintains log order', () => {
      logger.info('First')
      logger.warn('Second')
      logger.error('Third')
      
      const logs = logger.getLogs()
      expect(logs).toHaveLength(3)
      expect(logs[0].message).toBe('First')
      expect(logs[1].message).toBe('Second')
      expect(logs[2].message).toBe('Third')
    })
  })
})
