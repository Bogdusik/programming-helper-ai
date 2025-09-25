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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
            <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
              <p className="text-sm">Thinking...</p>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask me anything about programming..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={sendMessageMutation.isPending}
          />
          <button
            type="submit"
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendMessageMutation.isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}