interface MessageProps {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function Message({ role, content, timestamp }: MessageProps) {
  const isUser = role === 'user'
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
        isUser 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-200 text-gray-800'
      }`}>
        <p className="text-sm whitespace-pre-wrap">{content}</p>
        <p className={`text-xs mt-1 ${
          isUser ? 'text-blue-100' : 'text-gray-500'
        }`}>
          {timestamp.toLocaleTimeString()}
        </p>
      </div>
    </div>
  )
}