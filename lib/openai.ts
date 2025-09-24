import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function generateResponse(message: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful programming assistant. Provide clear, concise, and accurate answers to programming questions. When providing code examples, make sure they are well-formatted and include comments where appropriate."
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    })

    return completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response."
  } catch (error) {
    console.error('OpenAI API error:', error)
    throw new Error('Failed to generate response')
  }
}
