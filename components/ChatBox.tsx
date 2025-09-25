'use client'

import { useState, useEffect } from 'react'
import Message from './Message'
import { trpc } from '../lib/trpc-client'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function ChatBox() {
  const [message, setMessage] = useState('')
  
  // tRPC hooks
  const sendMessageMutation = trpc.chat.sendMessage.useMutation()
  const { data: messages = [], refetch: refetchMessages } = trpc.chat.getMessages.useQuery()

  // Load messages on component mount
  useEffect(() => {
    refetchMessages()
  }, [refetchMessages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || sendMessageMutation.isPending) return

    const messageToSend = message
    setMessage('')

    try {
      await sendMessageMutation.mutateAsync({ message: messageToSend })
      // Refetch messages to get the updated list
      await refetchMessages()
    } catch (error) {
      console.error('Error sending message:', error)
      // Show error to user
      alert('Failed to send message. Please try again.')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages?.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl mb-4">
              <svg className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Welcome to AI Programming Assistant</h3>
            <p className="text-white/60">Ask me anything about programming, debugging, or learning new concepts!</p>
          </div>
        )}
        
        {messages?.map((msg: any) => (
          <Message
            key={msg.id}
            role={msg.role as 'user' | 'assistant'}
            content={msg.content}
            timestamp={new Date(msg.timestamp)}
          />
        ))}
        
        {sendMessageMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white px-6 py-4 rounded-2xl rounded-bl-md">
              <div className="flex items-center space-x-2">
                <div className="animate-pulse-slow w-2 h-2 bg-blue-400 rounded-full"></div>
                <div className="animate-pulse-slow w-2 h-2 bg-blue-400 rounded-full" style={{animationDelay: '0.2s'}}></div>
                <div className="animate-pulse-slow w-2 h-2 bg-blue-400 rounded-full" style={{animationDelay: '0.4s'}}></div>
                <span className="text-sm ml-2">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-6 border-t border-white/10">
        <div className="flex space-x-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask me anything about programming..."
            className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200"
            disabled={sendMessageMutation.isPending}
          />
          <button
            type="submit"
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            {sendMessageMutation.isPending ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Sending...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span>Send</span>
              </div>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}