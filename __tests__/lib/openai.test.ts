import {
  generateResponse,
  generateChatTitle,
  analyzeQuestionType,
  checkAssessmentAnswer,
} from '../../lib/openai'
import { isProgrammingRelated, getRejectionMessage } from '../../lib/programming-validator'
import OpenAI from 'openai'
import { logger } from '../../lib/logger'

// Mock dependencies
jest.mock('openai')
jest.mock('../../lib/programming-validator')
jest.mock('../../lib/prompts', () => ({
  getSystemPrompt: jest.fn(() => 'You are a helpful programming assistant.'),
  detectLanguage: jest.fn(() => 'javascript'),
}))
jest.mock('../../lib/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}))

const mockIsProgrammingRelated = isProgrammingRelated as jest.MockedFunction<typeof isProgrammingRelated>
const mockGetRejectionMessage = getRejectionMessage as jest.MockedFunction<typeof getRejectionMessage>
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>

describe('openai.ts', () => {
  let mockOpenAIClient: jest.Mocked<OpenAI>

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-api-key'

    mockOpenAIClient = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    } as any

    MockedOpenAI.mockImplementation(() => mockOpenAIClient)
  })

  afterEach(() => {
    delete process.env.OPENAI_API_KEY
  })

  describe('generateResponse', () => {
    it('throws error when API key is not configured', async () => {
      const originalKey = process.env.OPENAI_API_KEY
      delete process.env.OPENAI_API_KEY
      // Clear the module cache to force re-evaluation of OPENAI_API_KEY
      jest.resetModules()

      try {
        // Re-import to get fresh module with no API key
        const { generateResponse: generateResponseWithoutKey } = await import('../../lib/openai')
        await expect(generateResponseWithoutKey('test message')).rejects.toThrow()
      } finally {
        // Restore original key
        if (originalKey) {
          process.env.OPENAI_API_KEY = originalKey
        }
        jest.resetModules()
      }
    })

    it('returns rejection message for non-programming questions', async () => {
      mockIsProgrammingRelated.mockReturnValue(false)
      mockGetRejectionMessage.mockReturnValue('This question is not programming-related.')

      const result = await generateResponse('What is the weather today?')

      expect(result).toBe('This question is not programming-related.')
      expect(mockIsProgrammingRelated).toHaveBeenCalledWith('What is the weather today?')
      expect(mockOpenAIClient.chat.completions.create).not.toHaveBeenCalled()
    })

    it('generates response for programming question', async () => {
      mockIsProgrammingRelated.mockReturnValue(true)
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'You can use Array.map() to transform elements.',
            },
          },
        ],
      } as any)

      const result = await generateResponse('How do I map over an array?')

      expect(result).toBe('You can use Array.map() to transform elements.')
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalled()
    })

    it('includes conversation history in request', async () => {
      mockIsProgrammingRelated.mockReturnValue(true)
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Response' } }],
      } as any)

      const history = [
        { role: 'user' as const, content: 'First question' },
        { role: 'assistant' as const, content: 'First answer' },
      ]

      await generateResponse('Follow-up question', history)

      const callArgs = mockOpenAIClient.chat.completions.create.mock.calls[0][0]
      expect(callArgs.messages.length).toBeGreaterThan(2) // system + history + current
    })

    it('includes task context in system prompt', async () => {
      mockIsProgrammingRelated.mockReturnValue(true)
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Response' } }],
      } as any)

      const taskContext = {
        title: 'Reverse String',
        description: 'Reverse a string',
        language: 'javascript',
        difficulty: 'easy',
      }

      await generateResponse('How do I start?', undefined, taskContext)

      const callArgs = mockOpenAIClient.chat.completions.create.mock.calls[0][0]
      const systemMessage = callArgs.messages.find((m: any) => m.role === 'system')
      expect(systemMessage.content).toContain('Reverse String')
      expect(systemMessage.content).toContain('GUIDE and HELP')
    })

    it('handles OpenAI API errors gracefully', async () => {
      mockIsProgrammingRelated.mockReturnValue(true)
      const error = new Error('API rate limit exceeded')
      error.message = 'rate limit'
      mockOpenAIClient.chat.completions.create.mockRejectedValue(error)

      await expect(generateResponse('test')).rejects.toThrow(
        'AI service is currently busy'
      )
    })

    it('handles timeout errors', async () => {
      mockIsProgrammingRelated.mockReturnValue(true)
      const error = new Error('Request timeout')
      error.message = 'timeout'
      mockOpenAIClient.chat.completions.create.mockRejectedValue(error)

      await expect(generateResponse('test')).rejects.toThrow(
        'taking too long to respond'
      )
    })

    it('handles quota errors', async () => {
      mockIsProgrammingRelated.mockReturnValue(true)
      const error = new Error('Quota exceeded')
      error.message = 'quota'
      mockOpenAIClient.chat.completions.create.mockRejectedValue(error)

      await expect(generateResponse('test')).rejects.toThrow(
        'quota exceeded'
      )
    })

    it('returns fallback message when response is empty', async () => {
      mockIsProgrammingRelated.mockReturnValue(true)
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: null } }],
      } as any)

      const result = await generateResponse('test')

      expect(result).toBe("Sorry, I couldn't generate a response.")
    })

    it('limits conversation history to CONVERSATION_HISTORY_LIMIT', async () => {
      mockIsProgrammingRelated.mockReturnValue(true)
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Response' } }],
      } as any)

      const longHistory = Array.from({ length: 30 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as const,
        content: `Message ${i}`,
      }))

      await generateResponse('New question', longHistory)

      const callArgs = mockOpenAIClient.chat.completions.create.mock.calls[0][0]
      // Should only include last 20 messages from history + system + current
      expect(callArgs.messages.length).toBeLessThanOrEqual(22)
    })
  })

  describe('generateChatTitle', () => {
    it('returns truncated message when API key is not configured', async () => {
      delete process.env.OPENAI_API_KEY

      const longMessage = 'a'.repeat(100)
      const result = await generateChatTitle(longMessage)

      expect(result).toBe('a'.repeat(50) + '...')
    })

    it('generates title from OpenAI', async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'React Hooks Help',
            },
          },
        ],
      } as any)

      const result = await generateChatTitle('How do I use useState?')

      expect(result).toBe('React Hooks Help')
    })

    it('returns fallback when title is too long', async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'a'.repeat(100),
            },
          },
        ],
      } as any)

      const message = 'Short message'
      const result = await generateChatTitle(message)

      expect(result).toBe(message)
    })

    it('returns fallback when title is too short', async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'AB',
            },
          },
        ],
      } as any)

      const message = 'How do I use React hooks?'
      const result = await generateChatTitle(message)

      expect(result).toBe(message)
    })

    it('cleans up title by removing quotes', async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: '"React Hooks Help"',
            },
          },
        ],
      } as any)

      const result = await generateChatTitle('test')

      expect(result).toBe('React Hooks Help')
    })

    it('handles errors and returns fallback', async () => {
      mockOpenAIClient.chat.completions.create.mockRejectedValue(
        new Error('API error')
      )

      const message = 'How do I use React?'
      const result = await generateChatTitle(message)

      expect(result).toBe(message)
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('analyzeQuestionType', () => {
    it('returns default category when API key is not configured', async () => {
      delete process.env.OPENAI_API_KEY

      const result = await analyzeQuestionType('test question')

      expect(result).toBe('General Programming')
    })

    it('analyzes question type from OpenAI', async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Code Debugging',
            },
          },
        ],
      } as any)

      const result = await analyzeQuestionType('Why is my code not working?')

      expect(result).toBe('Code Debugging')
    })

    it('returns default category when response is empty', async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: null } }],
      } as any)

      const result = await analyzeQuestionType('test')

      expect(result).toBe('General Programming')
    })

    it('handles errors and returns default category', async () => {
      mockOpenAIClient.chat.completions.create.mockRejectedValue(
        new Error('API error')
      )

      const result = await analyzeQuestionType('test')

      expect(result).toBe('General Programming')
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('checkAssessmentAnswer', () => {
    it('uses exact match for multiple choice questions', async () => {
      const result = await checkAssessmentAnswer(
        'What is 2+2?',
        '4',
        '4',
        'multiple_choice'
      )

      expect(result).toBe(true)
      expect(mockOpenAIClient.chat.completions.create).not.toHaveBeenCalled()
    })

    it('uses exact match when API key is not configured', async () => {
      delete process.env.OPENAI_API_KEY

      const result = await checkAssessmentAnswer(
        'What is a variable?',
        'A storage location',
        'A storage location',
        'conceptual'
      )

      expect(result).toBe(true)
    })

    it('uses AI to check code snippet answers', async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'true',
            },
          },
        ],
      } as any)

      const result = await checkAssessmentAnswer(
        'Write a function to reverse a string',
        'function reverse(str) { return str.split("").reverse().join(""); }',
        'function reverse(str) { return str.split("").reverse().join(""); }',
        'code_snippet'
      )

      expect(result).toBe(true)
    })

    it('returns false when AI says answer is incorrect', async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'false',
            },
          },
        ],
      } as any)

      const result = await checkAssessmentAnswer(
        'What is a variable?',
        'Wrong answer',
        'A storage location',
        'conceptual'
      )

      expect(result).toBe(false)
    })

    it('handles errors and falls back to exact match', async () => {
      mockOpenAIClient.chat.completions.create.mockRejectedValue(
        new Error('API error')
      )

      const result = await checkAssessmentAnswer(
        'What is a variable?',
        'A storage location',
        'A storage location',
        'conceptual'
      )

      expect(result).toBe(true)
      expect(logger.error).toHaveBeenCalled()
    })

    it('trims whitespace in answers', async () => {
      const result = await checkAssessmentAnswer(
        'What is 2+2?',
        '  4  ',
        '4',
        'multiple_choice'
      )

      expect(result).toBe(true)
    })
  })
})

