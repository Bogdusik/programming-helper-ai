import { memo } from 'react'

interface MessageProps {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// Simple function to parse and render markdown code blocks
function renderMessageContent(content: string, isUser: boolean) {
  // Split content by code blocks
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = []
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textContent = content.substring(lastIndex, match.index)
      if (textContent.trim()) {
        parts.push({ type: 'text', content: textContent })
      }
    }
    
    // Add code block
    parts.push({
      type: 'code',
      content: match[2],
      language: match[1] || 'text'
    })
    
    lastIndex = codeBlockRegex.lastIndex
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    const textContent = content.substring(lastIndex)
    if (textContent.trim()) {
      parts.push({ type: 'text', content: textContent })
    }
  }
  
  // If no code blocks found, return original content
  if (parts.length === 0) {
    return <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
  }
  
  // Render parts
  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        if (part.type === 'code') {
          return (
            <div key={index} className={`rounded-lg overflow-hidden ${
              isUser ? 'bg-black/30' : 'bg-black/20'
            }`}>
              {part.language && (
                <div className={`px-3 py-1 text-xs font-mono ${
                  isUser ? 'text-blue-200' : 'text-white/70'
                } border-b border-white/10`}>
                  {part.language}
                </div>
              )}
              <pre className={`p-3 overflow-x-auto text-xs font-mono ${
                isUser ? 'text-white' : 'text-white/90'
              }`}>
                <code>{part.content}</code>
              </pre>
            </div>
          )
        } else {
          return (
            <p key={index} className="text-sm leading-relaxed whitespace-pre-wrap">
              {part.content}
            </p>
          )
        }
      })}
    </div>
  )
}

// OPTIMIZATION: Memoize Message component to prevent unnecessary re-renders
const Message = memo(function Message({ role, content, timestamp }: MessageProps) {
  const isUser = role === 'user'
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeInUp`}>
      <div className={`max-w-2xl px-6 py-4 rounded-2xl ${
        isUser 
          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-br-md' 
          : 'bg-gradient-to-r from-white/10 to-white/5 text-white border border-white/10 rounded-bl-md'
      }`}>
        <div className="flex items-start space-x-3">
          {!isUser && (
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          <div className="flex-1">
            {renderMessageContent(content, isUser)}
            <p className={`text-xs mt-2 ${
              isUser ? 'text-blue-100' : 'text-white/50'
            }`}>
              {timestamp.toLocaleTimeString()}
            </p>
          </div>
          {isUser && (
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default Message