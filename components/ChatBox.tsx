'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import toast from 'react-hot-toast'
import Message from './Message'
import { trpc } from '../lib/trpc-client'
import type { TaskProgress } from '../lib/trpc-types'

// Scroll animation constants
const SCROLL_ANIMATION_DURATION_MS = 300 // Animation duration in milliseconds
const SCROLL_BOTTOM_THRESHOLD_PX = 10 // Threshold in pixels to consider at bottom

interface ChatBoxProps {
  sessionId?: string
  taskId?: string
  onSessionCreated?: (sessionId: string) => void
  onTaskComplete?: (taskId: string) => void
}

export default function ChatBox({ sessionId, taskId, onSessionCreated, onTaskComplete }: ChatBoxProps) {
  const [message, setMessage] = useState('')
  const [optimisticMessages, setOptimisticMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: Date }>>([])
  const [isUserAtBottom, setIsUserAtBottom] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  
  // Check if user has completed onboarding (profile and pre-assessment)
  // This prevents sending messages before completing required steps
  const { data: userProfile, refetch: refetchProfile, error: profileError } = trpc.profile.getProfile.useQuery(undefined, {
    enabled: true,
    staleTime: 5 * 60 * 1000,
  })
  
  const { data: preAssessment, refetch: refetchAssessment, error: assessmentError } = trpc.assessment.getAssessments.useQuery(undefined, {
    enabled: true,
    staleTime: 5 * 60 * 1000,
  })
  
  // Auto-retry on errors (user might be creating)
  useEffect(() => {
    if (profileError) {
      const errorCode = profileError.data?.code
      const httpStatus = profileError.data?.httpStatus
      // Check for Clerk "not found" errors - use type assertion for cause
      const errorWithCause = profileError as { cause?: unknown }
      const cause = errorWithCause.cause
      const isNotFound = httpStatus === 404 || 
        (errorCode === 'INTERNAL_SERVER_ERROR' && profileError.message === 'Not Found') ||
        (cause && typeof cause === 'object' && cause !== null && 'clerkError' in cause)
      
      if (errorCode === 'UNAUTHORIZED' || isNotFound) {
        const retryTimer = setTimeout(() => {
          refetchProfile()
        }, 1000)
        return () => clearTimeout(retryTimer)
      }
    }
  }, [profileError, refetchProfile])
  
  useEffect(() => {
    if (assessmentError) {
      const errorCode = assessmentError.data?.code
      const httpStatus = assessmentError.data?.httpStatus
      // Check for Clerk "not found" errors - use type assertion for cause
      const errorWithCause = assessmentError as { cause?: unknown }
      const cause = errorWithCause.cause
      const isNotFound = httpStatus === 404 || 
        (errorCode === 'INTERNAL_SERVER_ERROR' && assessmentError.message === 'Not Found') ||
        (cause && typeof cause === 'object' && cause !== null && 'clerkError' in cause)
      
      if (errorCode === 'UNAUTHORIZED' || isNotFound) {
        const retryTimer = setTimeout(() => {
          refetchAssessment()
        }, 1000)
        return () => clearTimeout(retryTimer)
      }
    }
  }, [assessmentError, refetchAssessment])
  
  const hasPreAssessment = preAssessment?.some(a => a.type === 'pre') ?? false
  // Note: primaryLanguage is not required for chat to work - it's optional
  const isOnboardingComplete = userProfile?.profileCompleted && hasPreAssessment
  
  const sendMessageMutation = trpc.chat.sendMessage.useMutation()
  const { data: messages = [], refetch: refetchMessages, isLoading: isLoadingMessages } = trpc.chat.getMessages.useQuery(
    { sessionId },
    { 
      enabled: !!sessionId,
      // Refetch on mount to ensure messages are loaded when opening existing session
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  )
  
  // Get task data if taskId is provided
  const { data: taskData } = trpc.task.getTask.useQuery(
    { taskId: taskId!, includeProgress: false },
    { enabled: !!taskId }
  )
  
  // Also try to get task from session if no taskId but sessionId exists
  // Get all task progress and find one that matches the sessionId
  // Only load if sessionId exists and no explicit taskId (to avoid showing task in new chats)
  const { data: allTaskProgress, refetch: refetchAllTaskProgress } = trpc.task.getTaskProgress.useQuery(
    { taskId: undefined },
    { 
      enabled: !!sessionId && !taskId,
      // Refetch when sessionId changes to get updated task associations
      refetchOnMount: true,
    }
  )
  
  // OPTIMIZATION: Memoize task progress calculations to avoid unnecessary recalculations
  // Use explicit type casting to avoid deep type recursion
  type SimpleTaskProgress = {
    id: string
    taskId: string
    chatSessionId: string | null
    status: string
    task?: {
      id: string
      title: string
      language: string
      difficulty: string
      category: string
      description: string
    }
  }
  
  const associatedProgress = useMemo(() => {
    if (!sessionId || !allTaskProgress) return null
    // Cast to simpler type to avoid "Type instantiation is excessively deep" error
    const progressArray = allTaskProgress as unknown as SimpleTaskProgress[]
    return progressArray.find((progress) => {
      const matchesSession = progress.chatSessionId === sessionId
      if (taskId) {
        return matchesSession && progress.taskId === taskId
      }
      return matchesSession && progress.status !== 'completed'
    }) || null
  }, [sessionId, taskId, allTaskProgress])
  
  const associatedTask = useMemo(() => associatedProgress?.task, [associatedProgress])
  
  const shouldUseTaskId = useMemo(() => 
    taskId && associatedProgress && associatedProgress.taskId === taskId,
    [taskId, associatedProgress]
  )
  
  // Use explicit type casting to avoid deep type recursion
  type SimpleTask = {
    id: string
    title: string
    language: string
    difficulty: string
    category: string
    description: string
  }
  
  // Extract simple values to avoid deep type recursion in useMemo dependencies
  const taskDataSimple = taskData ? (taskData as unknown as SimpleTask) : null
  const associatedTaskSimple = associatedTask ? (associatedTask as SimpleTask) : null
  
  const currentTask = useMemo((): SimpleTask | null => {
    if (shouldUseTaskId && taskDataSimple) {
      return taskDataSimple
    }
    if (sessionId && associatedTaskSimple) {
      return associatedTaskSimple
    }
    return null
  }, [shouldUseTaskId, taskDataSimple, sessionId, associatedTaskSimple])
  
  const effectiveTaskId = useMemo(() => 
    shouldUseTaskId ? taskId : (sessionId ? (associatedTask?.id || associatedProgress?.taskId) : null),
    [shouldUseTaskId, taskId, sessionId, associatedTask, associatedProgress]
  )
  
  // Get task progress for current task to show stats
  const utils = trpc.useUtils()
  const { data: taskProgressData, refetch: refetchTaskProgress } = trpc.task.getTaskProgress.useQuery(
    { taskId: effectiveTaskId || '' },
    { enabled: !!effectiveTaskId }
  )
  const taskProgress = taskProgressData?.[0]
  
  // OPTIMIZATION: Memoize computed values
  const isTaskCompleted = useMemo(() => 
    taskProgress?.status === 'completed',
    [taskProgress?.status]
  )
  
  const timeSpent = useMemo(() => 
    taskProgress?.createdAt 
      ? Math.floor((new Date().getTime() - new Date(taskProgress.createdAt).getTime()) / 1000 / 60)
      : 0,
    [taskProgress?.createdAt]
  )

  const displayMessages = useMemo(() => 
    optimisticMessages.length > 0 && sendMessageMutation.isPending 
      ? optimisticMessages 
      : messages,
    [optimisticMessages, sendMessageMutation.isPending, messages]
  )

  // OPTIMIZATION: Memoize scroll function to avoid recreating on every render
  const scrollToBottom = useCallback(() => {
    if (isUserAtBottom && messagesContainerRef.current) {
      const container = messagesContainerRef.current
      const targetScrollTop = container.scrollHeight
      
      // Smooth scroll animation
      const startScrollTop = container.scrollTop
      const distance = targetScrollTop - startScrollTop
      let startTime: number | null = null

      const animateScroll = (currentTime: number) => {
        if (startTime === null) startTime = currentTime
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / SCROLL_ANIMATION_DURATION_MS, 1)
        
        // Easing function for smooth animation
        const easeOutCubic = 1 - Math.pow(1 - progress, 3)
        container.scrollTop = startScrollTop + (distance * easeOutCubic)
        
        if (progress < 1) {
          requestAnimationFrame(animateScroll)
        }
      }
      
      requestAnimationFrame(animateScroll)
    }
  }, [isUserAtBottom])

  // OPTIMIZATION: Memoize scroll handler
  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - SCROLL_BOTTOM_THRESHOLD_PX
      setIsUserAtBottom(isAtBottom)
    }
  }, [])

  // Clear optimistic messages and refetch when session changes
  useEffect(() => {
    if (sessionId) {
      setOptimisticMessages([])
      // Force refetch messages when session changes (e.g., opening existing session)
      refetchMessages()
      // Refetch task progress to get updated task associations for the new session
      if (!taskId) {
        refetchAllTaskProgress()
      }
    } else {
      // Clear optimistic messages when session is cleared
      setOptimisticMessages([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, taskId])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMessages]) // scrollToBottom is stable, doesn't need to be in deps

  // Optimized: Only refetch when window regains focus (user comes back to tab)
  // This reduces unnecessary API calls while maintaining data freshness
  useEffect(() => {
    if (!sessionId) return
    
    const handleFocus = () => {
      refetchMessages()
    }
    
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]) // Only depend on sessionId, not refetchMessages to avoid re-adding listeners

  // OPTIMIZATION: Memoize submit handler
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || sendMessageMutation.isPending) return

    // Check if onboarding is complete before allowing message send
    if (!isOnboardingComplete) {
      if (!userProfile?.profileCompleted) {
        toast.error('Please complete your profile before sending messages. Please refresh the page if you don\'t see the profile form.')
        return
      }
      if (!hasPreAssessment) {
        toast.error('Please complete the knowledge assessment before sending messages. Please refresh the page if you don\'t see the assessment form.')
        return
      }
      return
    }

    const messageToSend = message
    setMessage('')

    // Add user message optimistically
    const userMessage = {
      id: `temp-user-${Date.now()}`,
      role: 'user' as const,
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
      
      // Clear optimistic messages after a short delay to ensure smooth transition
      setTimeout(() => {
        setOptimisticMessages([])
      }, 100)
      
      // Scroll to bottom after new message
      setTimeout(() => scrollToBottom(), 100)
    } catch (error) {
      console.error('Error sending message:', error)
      
      // Check if it's a tRPC error with specific code
      let errorMessage = 'Failed to send message. Please try again.'
      let shouldShowRefreshHint = false
      
      if (error && typeof error === 'object') {
        // tRPC errors have a specific structure
        const trpcError = error as { 
          data?: { code?: string; httpStatus?: number }; 
          message?: string;
          shape?: { message?: string; data?: { code?: string } }
        }
        
        // Check error.data.code (tRPC error structure)
        if (trpcError.data?.code === 'PRECONDITION_FAILED') {
          errorMessage = trpcError.message || 'Please complete onboarding before sending messages.'
          shouldShowRefreshHint = true
        } else if (trpcError.shape?.data?.code === 'PRECONDITION_FAILED') {
          errorMessage = trpcError.shape.message || 'Please complete onboarding before sending messages.'
          shouldShowRefreshHint = true
        } else if (trpcError.message) {
          errorMessage = trpcError.message
          // Check if message mentions onboarding
          if (errorMessage.includes('complete your profile') || errorMessage.includes('complete the knowledge assessment') || errorMessage.includes('onboarding')) {
            shouldShowRefreshHint = true
          }
        }
      } else if (error instanceof Error) {
        errorMessage = error.message
        // Check if error is about onboarding not being complete
        if (errorMessage.includes('complete your profile') || errorMessage.includes('complete the knowledge assessment') || errorMessage.includes('onboarding')) {
          shouldShowRefreshHint = true
        }
      }
      
      // Show error with refresh hint if needed
      if (shouldShowRefreshHint) {
        toast.error(errorMessage + ' Please refresh the page to continue with onboarding.', { duration: 5000 })
      } else {
        toast.error(errorMessage)
      }
      
      // Remove the optimistic message on error
      setOptimisticMessages(prev => prev.filter(msg => msg.id !== userMessage.id))
    }
  }, [message, sendMessageMutation, sessionId, onSessionCreated, refetchMessages, scrollToBottom, isOnboardingComplete, userProfile?.profileCompleted, hasPreAssessment])

  return (
    <div className="flex flex-col h-full min-h-0" style={{ height: '100%', minHeight: 0, maxHeight: '100%' }}>
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
        style={{ scrollBehavior: 'smooth' }}
      >
        {(!displayMessages || displayMessages.length === 0) && !isLoadingMessages && (
          <div className="text-center py-12">
            {currentTask ? (
              // Task-specific welcome message
              <div className="max-w-2xl mx-auto">
                <div className="inline-flex items-center justify-center p-4 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-2xl mb-4">
                  <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold text-white mb-3">{currentTask.title}</h3>
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm rounded-full capitalize">
                    {currentTask.language}
                  </span>
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-sm rounded-full capitalize">
                    {currentTask.difficulty}
                  </span>
                  <span className="px-3 py-1 bg-orange-500/20 text-orange-300 text-sm rounded-full capitalize">
                    {currentTask.category}
                  </span>
                </div>
                <p className="text-white/80 text-lg mb-4 leading-relaxed">{currentTask.description}</p>
                <p className="text-white/50 text-sm mb-4">Work on this task with AI assistance. Ask questions, get hints, or request code reviews!</p>
                {effectiveTaskId && (
                  <button
                    onClick={() => {
                      window.location.href = `/task/${effectiveTaskId}`
                    }}
                    className="mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      <span>Open Code Editor</span>
                    </div>
                  </button>
                )}
              </div>
            ) : (
              // Default welcome message
              <div>
                <div className="inline-flex items-center justify-center p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl mb-4">
                  <svg className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Welcome to AI Programming Assistant</h3>
                <p className="text-white/60">Ask me anything about programming, debugging, or learning new concepts!</p>
              </div>
            )}
          </div>
        )}
        
        {displayMessages?.map((msg) => (
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
        <div className="flex flex-col space-y-3">
          <div className="flex space-x-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={isOnboardingComplete ? "Ask me anything about programming..." : "Please complete onboarding to start chatting..."}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200"
              disabled={sendMessageMutation.isPending || !isOnboardingComplete}
              data-tour="chat-input"
            />
            <button
              type="submit"
              disabled={!message.trim() || sendMessageMutation.isPending || !isOnboardingComplete}
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
          {currentTask && onTaskComplete && effectiveTaskId && (
            <div className="mt-4 pt-4 border-t border-white/10">
              {/* Task Info Panel */}
              <div className="mb-3 p-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {isTaskCompleted ? (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-green-400">Task completed</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-white">Working on task</span>
                      </>
                    )}
                  </div>
                  <span className="text-xs text-white/60 capitalize">{currentTask.difficulty}</span>
                </div>
                <h4 className="text-sm font-semibold text-white mb-2">{currentTask.title}</h4>
                <div className="flex items-center gap-4 text-xs text-white/70">
                  {timeSpent > 0 && (
                    <div className="flex items-center space-x-1">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{timeSpent} min</span>
                    </div>
                  )}
                  {messages.length > 0 && (
                    <div className="flex items-center space-x-1">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span>{messages.length} messages</span>
                    </div>
                  )}
                  {taskProgress && taskProgress.attempts > 0 && (
                    <div className="flex items-center space-x-1">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span>{taskProgress.attempts} attempt{taskProgress.attempts !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Complete Button */}
              {!isTaskCompleted ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (effectiveTaskId && onTaskComplete) {
                      if (confirm('Are you sure you want to mark this task as complete?')) {
                        await onTaskComplete(effectiveTaskId)
                        // Invalidate and refetch task progress to update UI
                        await utils.task.getTaskProgress.invalidate({ taskId: effectiveTaskId })
                        await refetchTaskProgress()
                      }
                    }
                  }}
                  className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-green-500/25 flex items-center justify-center space-x-2"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Mark Task as Complete</span>
                </button>
              ) : (
                <div className="w-full px-4 py-3 bg-gradient-to-r from-green-600/50 to-green-700/50 text-green-300 rounded-xl text-sm font-medium flex items-center justify-center space-x-2 cursor-not-allowed">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Task Completed</span>
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  )
}