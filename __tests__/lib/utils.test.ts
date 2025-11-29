import {
  formatTimeAgo,
  formatDate,
  capitalize,
  formatLanguageName,
  escapeHtml,
} from '../../lib/utils'

describe('utils.ts', () => {
  describe('formatTimeAgo', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('returns "Just now" for recent timestamps', () => {
      const recent = new Date('2024-01-01T11:59:30Z')
      expect(formatTimeAgo(recent)).toBe('Just now')
    })

    it('returns minutes ago for timestamps less than an hour', () => {
      const fiveMinutesAgo = new Date('2024-01-01T11:55:00Z')
      expect(formatTimeAgo(fiveMinutesAgo)).toBe('5m ago')
    })

    it('returns hours ago for timestamps more than an hour', () => {
      const twoHoursAgo = new Date('2024-01-01T10:00:00Z')
      expect(formatTimeAgo(twoHoursAgo)).toBe('2h ago')
    })

    it('handles number timestamps', () => {
      const timestamp = new Date('2024-01-01T11:55:00Z').getTime()
      expect(formatTimeAgo(timestamp)).toBe('5m ago')
    })
  })

  describe('formatDate', () => {
    it('formats date correctly', () => {
      const date = new Date('2024-01-15T12:00:00Z')
      const formatted = formatDate(date)
      expect(formatted).toContain('2024')
      expect(formatted).toContain('January')
    })
  })

  describe('capitalize', () => {
    it('capitalizes first letter', () => {
      expect(capitalize('hello')).toBe('Hello')
      expect(capitalize('world')).toBe('World')
    })

    it('handles already capitalized strings', () => {
      expect(capitalize('Hello')).toBe('Hello')
    })

    it('handles empty strings', () => {
      expect(capitalize('')).toBe('')
    })

    it('handles single character', () => {
      expect(capitalize('a')).toBe('A')
    })
  })

  describe('formatLanguageName', () => {
    it('formats known languages correctly', () => {
      expect(formatLanguageName('javascript')).toBe('JavaScript')
      expect(formatLanguageName('typescript')).toBe('TypeScript')
      expect(formatLanguageName('python')).toBe('Python')
      expect(formatLanguageName('csharp')).toBe('C#')
    })

    it('capitalizes unknown languages', () => {
      expect(formatLanguageName('unknown')).toBe('Unknown')
    })

    it('handles case-insensitive input', () => {
      expect(formatLanguageName('JAVASCRIPT')).toBe('JavaScript')
      expect(formatLanguageName('JavaScript')).toBe('JavaScript')
    })
  })

  describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      )
    })

    it('escapes ampersand', () => {
      expect(escapeHtml('A & B')).toBe('A &amp; B')
    })

    it('escapes quotes', () => {
      expect(escapeHtml('He said "hello"')).toBe('He said &quot;hello&quot;')
      expect(escapeHtml("It's working")).toBe('It&#039;s working')
    })

    it('handles strings without special characters', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World')
    })

    it('handles empty strings', () => {
      expect(escapeHtml('')).toBe('')
    })
  })
})

