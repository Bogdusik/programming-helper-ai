'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import Navbar from '../../../components/Navbar'
import MinimalBackground from '../../../components/MinimalBackground'
import LoadingSpinner from '../../../components/LoadingSpinner'
import CodeEditor from '../../../components/CodeEditor'
import { trpc } from '../../../lib/trpc-client'
import { useBlockedStatus } from '../../../hooks/useBlockedStatus'
import { useUserRegistrationCheck } from '../../../hooks/useUserRegistrationCheck'
import toast from 'react-hot-toast'

function TaskPageContent() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const params = useParams()
  const taskId = params?.taskId as string
  
  const { isBlocked, isLoading: isCheckingBlocked } = useBlockedStatus({
    skipPaths: ['/blocked', '/contact'],
    enabled: isSignedIn && isLoaded,
  })
  const { isCheckingUserExists } = useUserRegistrationCheck()
  
  const [code, setCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { data: taskData, isLoading: isLoadingTask } = trpc.task.getTask.useQuery(
    { taskId: taskId!, includeProgress: true },
    { enabled: !!taskId && isSignedIn && !isCheckingUserExists }
  )
  
  const sendMessageMutation = trpc.chat.sendMessage.useMutation()
  const createSessionMutation = trpc.chat.createSession.useMutation()
  const updateProgressMutation = trpc.task.updateTaskProgress.useMutation()
  
  // Initialize code with starter code if available
  useEffect(() => {
    if (taskData?.starterCode && !code) {
      setCode(taskData.starterCode)
    }
  }, [taskData?.starterCode, code])
  
  const handleSubmitCode = async () => {
    if (!taskData || !code.trim() || isSubmitting) return
    
    setIsSubmitting(true)
    
    try {
      // Create or get session for this task
      let sessionId: string | undefined
      
      // Try to get existing session from task progress
      const progress = taskData.userProgress?.[0]
      if (progress?.chatSessionId) {
        sessionId = progress.chatSessionId
      } else {
        // Create new session
        const session = await createSessionMutation.mutateAsync({
          title: `Task: ${taskData.title}`,
        })
        sessionId = session.id
        
        // Update task progress with session ID
        await updateProgressMutation.mutateAsync({
          taskId: taskData.id,
          chatSessionId: sessionId,
        })
      }
      
      // Send code to chat
      const message = `Here's my solution for the task:\n\n\`\`\`${taskData.language}\n${code}\n\`\`\`\n\nPlease review my code and provide feedback.`
      
      await sendMessageMutation.mutateAsync({
        message,
        sessionId,
      })
      
      toast.success('Code submitted! Check the chat for feedback.')
      
      // Navigate to chat with this session
      router.push(`/chat?sessionId=${sessionId}`)
    } catch (error) {
      console.error('Error submitting code:', error)
      toast.error('Failed to submit code. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleContinueInChat = async () => {
    if (!taskData) return
    
    try {
      // Get or create session
      const progress = taskData.userProgress?.[0]
      let sessionId: string | undefined
      
      if (progress?.chatSessionId) {
        sessionId = progress.chatSessionId
      } else {
        const session = await createSessionMutation.mutateAsync({
          title: `Task: ${taskData.title}`,
        })
        sessionId = session.id
        
        await updateProgressMutation.mutateAsync({
          taskId: taskData.id,
          chatSessionId: sessionId,
        })
      }
      
      router.push(`/chat?sessionId=${sessionId}`)
    } catch (error) {
      console.error('Error opening chat:', error)
      toast.error('Failed to open chat. Please try again.')
    }
  }
  
  if (!isLoaded || isCheckingUserExists || isCheckingBlocked) {
    return <LoadingSpinner />
  }
  
  if (!isSignedIn) {
    return null
  }
  
  if (isBlocked) {
    return <LoadingSpinner />
  }
  
  if (isLoadingTask) {
    return (
      <div className="min-h-screen gradient-bg">
        <Navbar />
        <MinimalBackground />
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner />
        </div>
      </div>
    )
  }
  
  if (!taskData) {
    return (
      <div className="min-h-screen gradient-bg">
        <Navbar />
        <MinimalBackground />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-white mb-4">Task not found</h2>
            <button
              onClick={() => router.push('/tasks')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Tasks
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  // Build question text with task description, hints, etc.
  const questionText = `**${taskData.title}**\n\n${taskData.description}\n\n` +
    `**Language:** ${taskData.language}\n` +
    `**Difficulty:** ${taskData.difficulty}\n` +
    `**Category:** ${taskData.category}\n\n` +
    (taskData.hints && taskData.hints.length > 0
      ? `**Hints:**\n${taskData.hints.map((hint, i) => `${i + 1}. ${hint}`).join('\n')}\n\n`
      : '') +
    (taskData.starterCode ? `**Starter Code:**\n\`\`\`${taskData.language}\n${taskData.starterCode}\n\`\`\`` : '')
  
  return (
    <div className="min-h-screen gradient-bg">
      <Navbar />
      <MinimalBackground />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push('/tasks')}
            className="text-white/70 hover:text-white flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Tasks</span>
          </button>
          
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm rounded-full capitalize">
              {taskData.language}
            </span>
            <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-sm rounded-full capitalize">
              {taskData.difficulty}
            </span>
            <span className="px-3 py-1 bg-orange-500/20 text-orange-300 text-sm rounded-full capitalize">
              {taskData.category}
            </span>
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 p-6">
          <CodeEditor
            question={questionText}
            value={code}
            onChange={setCode}
            placeholder={`Write your solution in ${taskData.language}...`}
            language={taskData.language}
            isCode={true}
            height="calc(100vh - 250px)"
          />
          
          <div className="mt-6 flex items-center justify-between pt-6 border-t border-white/20">
            <button
              onClick={handleContinueInChat}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Continue in Chat
            </button>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setCode(taskData.starterCode || '')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Reset to Starter Code
              </button>
              <button
                onClick={handleSubmitCode}
                disabled={!code.trim() || isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Code'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TaskPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <TaskPageContent />
    </Suspense>
  )
}

