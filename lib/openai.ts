import OpenAI from 'openai'
import { getSystemPrompt } from './prompts'
import { isProgrammingRelated, getRejectionMessage } from './programming-validator'
import { logger } from './logger'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!OPENAI_API_KEY) {
  logger.error('OPENAI_API_KEY is not set', undefined, {
    environment: process.env.NODE_ENV
  })
}

// Initialize OpenAI client only if API key is available
// Use a getter function to ensure proper error handling
function getOpenAIClient(): OpenAI {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured')
  }
  return new OpenAI({
    apiKey: OPENAI_API_KEY,
    timeout: 30000, // 30 seconds timeout
  })
}

export async function generateResponse(
  message: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant', content: string }>,
  taskContext?: { title: string; description: string; language: string; difficulty: string; hints?: string[] } | null
): Promise<string> {
  if (!OPENAI_API_KEY) {
    logger.error('OpenAI API key not configured')
    throw new Error('OpenAI service is not configured')
  }

  const openai = getOpenAIClient()

  try {
    // Validate that the message is programming-related
    if (!isProgrammingRelated(message)) {
      return getRejectionMessage()
    }
    
    // Get specialized system prompt based on the message and conversation history
    let systemPrompt = getSystemPrompt(message, conversationHistory)
    
    // If this is a task-related conversation, add task-specific instructions
    if (taskContext) {
      const taskInstructions = `
IMPORTANT: The user is working on a programming task. Your role is to GUIDE and HELP them learn, NOT to provide complete solutions.

Task: ${taskContext.title}
Description: ${taskContext.description}
Language: ${taskContext.language}
Difficulty: ${taskContext.difficulty}
${taskContext.hints && taskContext.hints.length > 0 ? `Available hints: ${taskContext.hints.join(', ')}` : ''}

CRITICAL RULES when the user asks for help or hints:
- NEVER provide complete, working solutions
- NEVER show the full implementation
- ONLY provide:
  * Step-by-step guidance on HOW to approach the problem
  * Conceptual explanations
  * Partial code snippets showing the STRUCTURE or PATTERN, not the complete solution
  * Leading questions to help them think
  * References to relevant concepts or methods they should use
- If they ask "give me hints" or "how to implement", give them GUIDANCE, not code
- Example of GOOD response: "Think about how you can reverse a string. What methods are available? Consider using split() and reverse(). Try building it step by step."
- Example of BAD response: "Here's the complete function: function isPalindrome(str) { return str === str.split('').reverse().join(''); }"

When the user shares their solution or code:
- Review their code and provide constructive feedback
- If their solution is correct and complete, acknowledge it positively: "Great work! Your solution looks correct and well-implemented. You've successfully solved the task!"
- If there are issues, point them out gently and guide them to fix it
- Encourage them to mark the task as completed if their solution works

The goal is LEARNING, not just completing the task. Help them understand the concepts and develop problem-solving skills through guided discovery.
`
      systemPrompt = `${systemPrompt}\n\n${taskInstructions}`
    }
    
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPrompt
      }
    ]
    
    // Add conversation history (limit to last 20 messages to avoid token limits)
    if (conversationHistory && conversationHistory.length > 0) {
      // Take last 20 messages to stay within token limits
      const recentHistory = conversationHistory.slice(-20)
      
      recentHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        })
      })
    }
    
    // Add current message
    messages.push({
      role: "user",
      content: message
    })
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    })

    return completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response."
  } catch (error) {
    logger.error('OpenAI API error', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw new Error('Failed to generate response')
  }
}

export async function analyzeQuestionType(message: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    return 'General Programming'
  }

  try {
    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that categorizes programming questions. Based on the user's question, determine the most appropriate category from these options: 'Code Debugging', 'Algorithm Help', 'Syntax Questions', 'Framework Help', 'Database Queries', 'API Integration', 'General Programming', 'Code Review'. Return only the category name, nothing else."
        },
        {
          role: "user",
          content: `Categorize this programming question: "${message}"`
        }
      ],
      max_tokens: 20,
      temperature: 0.3,
    })

    const category = completion.choices[0]?.message?.content?.trim() || 'General Programming'
    return category
  } catch (error) {
    logger.error('Error analyzing question type', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return 'General Programming'
  }
}

export async function generateChatTitle(message: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    return message.length > 50 ? message.substring(0, 50) + "..." : message
  }

  try {
    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates concise, descriptive titles for programming chat conversations. Based on the user's question, generate a short, clear title (max 6 words) that captures the main topic or programming concept being discussed. Examples: 'React Hooks Help', 'Python Debugging', 'Database Design', 'API Integration', 'CSS Styling Issues'. Return only the title, nothing else."
        },
        {
          role: "user",
          content: `Create a title for this programming question: "${message}"`
        }
      ],
      max_tokens: 20,
      temperature: 0.3,
    })

    const title = completion.choices[0]?.message?.content?.trim() || 'Programming Question'
    
    // Clean up the title and ensure it's not too long
    const cleanTitle = title.replace(/['"]/g, '').trim()
    
    if (cleanTitle.length > 50 || cleanTitle.length < 3) {
      return message.length > 50 ? message.substring(0, 50) + "..." : message
    }
    
    return cleanTitle
  } catch (error) {
    logger.error('Error generating title', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    // Fallback to original logic
    return message.length > 50 ? message.substring(0, 50) + "..." : message
  }
}
