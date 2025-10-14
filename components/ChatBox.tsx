'use client'

import { useState, useEffect, useRef } from 'react'
import Message from './Message'
import { trpc } from '../lib/trpc-client'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatBoxProps {
  sessionId?: string
  onSessionCreated?: (sessionId: string) => void
}

export default function ChatBox({ sessionId, onSessionCreated }: ChatBoxProps) {
  const [message, setMessage] = useState('')
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([])
  const [isUserAtBottom, setIsUserAtBottom] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  
  const sendMessageMutation = trpc.chat.sendMessage.useMutation()
  const { data: messages = [], refetch: refetchMessages } = trpc.chat.getMessages.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  )

  // Use optimistic messages when available, otherwise use server messages
  const displayMessages = optimisticMessages.length > 0 ? optimisticMessages : messages

  // Function to scroll to bottom with smooth animation
  const scrollToBottom = () => {
    if (isUserAtBottom && messagesContainerRef.current) {
      const container = messagesContainerRef.current
      const targetScrollTop = container.scrollHeight
      
      // Smooth scroll animation
      const startScrollTop = container.scrollTop
      const distance = targetScrollTop - startScrollTop
      const duration = 300 // 300ms animation
      let startTime: number | null = null

      const animateScroll = (currentTime: number) => {
        if (startTime === null) startTime = currentTime
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        
        // Easing function for smooth animation
        const easeOutCubic = 1 - Math.pow(1 - progress, 3)
        container.scrollTop = startScrollTop + (distance * easeOutCubic)
        
        if (progress < 1) {
          requestAnimationFrame(animateScroll)
        }
      }
      
      requestAnimationFrame(animateScroll)
    }
  }

  // Check if user is at bottom of chat
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10 // 10px threshold
      setIsUserAtBottom(isAtBottom)
    }
  }

  // Clear optimistic messages when session changes
  useEffect(() => {
    setOptimisticMessages([])
  }, [sessionId])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [displayMessages])

  // Auto-refresh messages every 10 seconds to ensure we don't miss anything
  useEffect(() => {
    if (sessionId) {
      const interval = setInterval(() => {
        refetchMessages()
      }, 10000) // 10 seconds

      return () => clearInterval(interval)
    }
  }, [sessionId, refetchMessages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || sendMessageMutation.isPending) return

    const messageToSend = message
    setMessage('')

    // Add user message optimistically
    const userMessage = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: messageToSend,
      timestamp: new Date()
    }
    
    setOptimisticMessages(prev => [...prev, userMessage])
    
    // Scroll to bottom when adding optimistic message
    setTimeout(() => scrollToBottom(), 50)

    try {
      const result = await sendMessageMutation.mutateAsync({ 
        message: messageToSend,
        sessionId 
      })
      
      // If a new session was created, notify parent component
      if (result.sessionId && onSessionCreated) {
        onSessionCreated(result.sessionId)
      }
      
      // Refresh messages to show the complete conversation
      await refetchMessages()
      
      // Clear optimistic messages since we now have real data
      setOptimisticMessages([])
      
      // Scroll to bottom after new message
      setTimeout(() => scrollToBottom(), 100)
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please try again.')
      
      // Remove the optimistic message on error
      setOptimisticMessages(prev => prev.filter(msg => msg.id !== userMessage.id))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
        style={{ scrollBehavior: 'smooth' }}
      >
        {displayMessages?.length === 0 && (
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
        
        {displayMessages?.map((msg: any) => (
          <Message
            key={msg.id}
            role={msg.role as 'user' | 'assistant'}
            content={msg.content}
            timestamp={new Date(msg.timestamp)}
          />
        ))}
        
        {/* Invisible element for auto-scroll */}
        <div ref={messagesEndRef} />
        
        {/* Scroll to bottom button */}
        {!isUserAtBottom && displayMessages.length > 0 && (
          <div className="flex justify-center">
            <button
              onClick={() => {
                setIsUserAtBottom(true)
                scrollToBottom()
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 shadow-lg"
            >
              Scroll to bottom
            </button>
          </div>
        )}
        
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
        
        {sendMessageMutation.error && (
          <div className="flex justify-start">
            <div className="bg-gradient-to-r from-red-500/20 to-red-600/20 text-white px-6 py-4 rounded-2xl rounded-bl-md border border-red-500/30">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">
                  {sendMessageMutation.error.message.includes('Rate limit') 
                    ? 'Too many requests. Please wait a moment.'
                    : 'Failed to send message. Please try again.'
                  }
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

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