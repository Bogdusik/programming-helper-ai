import { memo } from 'react'

interface MessageProps {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
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
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
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