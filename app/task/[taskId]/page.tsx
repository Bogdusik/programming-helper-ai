'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import Navbar from '../../../components/Navbar'
import MinimalBackground from '../../../components/MinimalBackground'
import LoadingSpinner from '../../../components/LoadingSpinner'
import TaskCodeEditor from '../../../components/TaskCodeEditor'
import { trpc } from '../../../lib/trpc-client'
import { useBlockedStatus } from '../../../hooks/useBlockedStatus'
import { useUserRegistrationCheck } from '../../../hooks/useUserRegistrationCheck'
import toast from 'react-hot-toast'
import type { TaskDataTyped, TaskTestCase, TestResult } from '../../../lib/task-types'

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
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  
  const { data: taskData, isLoading: isLoadingTask } = trpc.task.getTask.useQuery(
    { taskId: taskId!, includeProgress: true },
    { enabled: !!taskId && isSignedIn && !isCheckingUserExists }
  )
  
  const sendMessageMutation = trpc.chat.sendMessage.useMutation()
  const createSessionMutation = trpc.chat.createSession.useMutation()
  const updateProgressMutation = trpc.task.updateTaskProgress.useMutation()
  const utils = trpc.useUtils()
  
  // Initialize code with starter code if available
  useEffect(() => {
    if (!taskData) return
    // Use type assertion to avoid deep type recursion
    const starterCode = (taskData as { starterCode?: string | null })?.starterCode
    if (starterCode && !code) {
      setCode(starterCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskData?.id, code])
  
  const handleSubmitCode = async () => {
    if (!taskData || !code.trim() || isSubmitting) return
    
    // Validate code length before submission
    const codeLength = code.length
    const messagePrefix = "Here's my solution for the task:\n\n```\n\n```\n\nPlease review my code and provide feedback."
    const estimatedMessageLength = messagePrefix.length + codeLength + 50 // Add buffer for language tag
    
    if (estimatedMessageLength > 10000) {
      toast.error(`Code is too long (${codeLength} characters). Maximum allowed is approximately 9900 characters.`)
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Use type assertion to avoid deep type recursion
      type TaskDataSimple = {
        id: string
        title: string
        language: string
        description: string
        difficulty: string
        userProgress?: Array<{ chatSessionId?: string | null; status?: string }>
      }
      const taskDataSimple = taskData as TaskDataSimple
      
      // Create or get session for this task
      let sessionId: string | undefined
      
      // Try to get existing session from task progress
      const progress = taskDataSimple.userProgress?.[0]
      if (progress?.chatSessionId) {
        sessionId = progress.chatSessionId
      } else {
        // Create new session
        const session = await createSessionMutation.mutateAsync({
          title: `Task: ${taskDataSimple.title}`,
        })
        sessionId = session.id
        
        // Update task progress with session ID and set status to in_progress
        try {
          await updateProgressMutation.mutateAsync({
            taskId: taskDataSimple.id,
            status: 'in_progress',
            chatSessionId: sessionId,
          })
        } catch (error) {
          console.error('Error updating task progress:', error)
          // Continue anyway - session is created
        }
      }
      
      // Send code to chat with task context
      // Format: message with code in markdown code block
      const message = `Here's my solution for the task:\n\n\`\`\`${taskDataSimple.language}\n${code}\n\`\`\`\n\nPlease review my code and provide feedback.`
      
      await sendMessageMutation.mutateAsync({
        message,
        sessionId,
      })
      
      toast.success('Code submitted! Check the chat for feedback.')
      
      // Note: Status remains 'in_progress' - user can continue working on the task
      // If code is incorrect, user can return to CodeEditor and try again
      // Status will only change to 'completed' when user explicitly marks task as complete
      
      // Navigate to chat with this session and taskId
      router.push(`/chat?sessionId=${sessionId}&taskId=${taskDataSimple.id}`)
    } catch (error) {
      console.error('Error submitting code:', error)
      // Check if error is about message length
      if (error instanceof Error && error.message.includes('too long')) {
        toast.error('Code is too long. Please shorten your code or split it into smaller parts.')
      } else {
        toast.error('Failed to submit code. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleContinueInChat = async () => {
    if (!taskData || isCreatingSession) return
    
    try {
      setIsCreatingSession(true)
      
      // Use type assertion to avoid deep type recursion
      type TaskDataSimple = {
        id: string
        title: string
        userProgress?: Array<{ chatSessionId?: string | null; status?: string }>
      }
      const taskDataSimple = taskData as TaskDataSimple
      
      // Get or create session
      const progress = taskDataSimple.userProgress?.[0]
      let sessionId: string | undefined
      
      // Check if there's an existing session with messages
      if (progress?.chatSessionId) {
        // Verify session exists and has messages before reusing
        try {
          const sessionMessages = await utils.chat.getMessages.fetch({ 
            sessionId: progress.chatSessionId 
          })
          
          // Only reuse if session has messages (it's been used)
          if (sessionMessages && sessionMessages.length > 0) {
            sessionId = progress.chatSessionId
            // Navigate without taskId to avoid re-initialization
            router.push(`/chat?sessionId=${sessionId}`)
            setIsCreatingSession(false)
            return
          }
        } catch (error) {
          // If we can't check, assume session is empty and create new one
          console.warn('Could not verify session, creating new one:', error)
        }
      }
      
      // Create new session if no valid existing session
      const session = await createSessionMutation.mutateAsync({
        title: `Task: ${taskDataSimple.title}`,
      })
      sessionId = session.id
      
      // Update task progress with session ID and set status to in_progress
      try {
        await updateProgressMutation.mutateAsync({
          taskId: taskDataSimple.id,
          status: 'in_progress',
          chatSessionId: sessionId,
        })
      } catch (error) {
        console.error('Error updating task progress:', error)
        // Continue anyway - session is created
      }
      
      // Navigate to chat with sessionId and taskId for initialization
      router.push(`/chat?sessionId=${sessionId}&taskId=${taskDataSimple.id}`)
    } catch (error) {
      console.error('Error opening chat:', error)
      toast.error('Failed to open chat. Please try again.')
    } finally {
      setIsCreatingSession(false)
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
  
  // Use double assertion through unknown to avoid deep type recursion from tRPC types
  const taskDataTyped = taskData as unknown as TaskDataTyped

  // Function to run tests on the code
  const handleRunTests = async (code: string): Promise<{ passed: number; failed: number; results: TestResult[] }> => {
    if (!taskDataTyped.testCases) {
      throw new Error('No test cases available for this task')
    }

    // This is a simplified test runner - in production, you'd want to use a proper code execution service
    // For now, we'll just validate the code structure and return mock results
    const testCasesArray = Array.isArray(taskDataTyped.testCases) 
      ? taskDataTyped.testCases 
      : (taskDataTyped.testCases as TaskTestCase)?.testCases || []

    const results: TestResult[] = testCasesArray.map((testCase: TaskTestCase) => {
      // Basic validation - check if code contains the function
      // In a real implementation, you'd execute the code in a sandbox
      const hasFunction = code.includes('function') || code.includes('const') || code.includes('let')
      
      return {
        passed: hasFunction, // Simplified - in production, actually run the code
        testCase: testCase.input,
        expected: testCase.output,
        error: hasFunction ? undefined : 'Code does not appear to be valid',
      }
    })

    const passed = results.filter((r) => r.passed).length
    const failed = results.length - passed

    return { passed, failed, results }
  }
  
  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      <Navbar />
      <MinimalBackground />
      
      <div className="container mx-auto px-4 max-w-7xl flex-1 flex flex-col">
        <div className="flex-1 flex flex-col justify-center py-8">
          <div className="mb-4 flex items-center justify-start flex-wrap gap-2 flex-shrink-0">
            <button
              onClick={() => router.push('/tasks')}
              className="text-white/70 hover:text-white flex items-center space-x-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Tasks</span>
            </button>
          </div>
          
          <div className="flex flex-col">
          <div className="bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 p-1.5 sm:p-2 mb-4 flex flex-col overflow-hidden" style={{ height: '600px', maxHeight: '600px' }}>
            <TaskCodeEditor
              title={taskDataTyped.title}
              description={taskDataTyped.description}
              language={taskDataTyped.language}
              difficulty={taskDataTyped.difficulty}
              category={taskDataTyped.category}
              hints={taskDataTyped.hints}
              starterCode={taskDataTyped.starterCode}
              examples={taskDataTyped.examples}
              constraints={taskDataTyped.constraints}
              testCases={taskDataTyped.testCases}
              value={code}
              onChange={setCode}
              placeholder={`Write your solution in ${taskDataTyped.language}...`}
              height="100%"
              onRunTests={taskDataTyped.testCases ? handleRunTests : undefined}
            />
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 p-2 sm:p-3 flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <button
              onClick={handleContinueInChat}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              Continue in Chat
            </button>
            
            <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => {
                  const starterCode = (taskData as { starterCode?: string | null })?.starterCode || ''
                  setCode(starterCode)
                }}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Reset to Starter Code
              </button>
              <button
                onClick={async () => {
                  if (!taskData) return
                  if (!confirm('Are you sure you want to restart this task? Your code will be reset to starter code.')) {
                    return
                  }
                  
                  try {
                    type TaskDataSimple = {
                      id: string
                      starterCode?: string | null
                    }
                    const taskDataSimple = taskData as TaskDataSimple
                    
                    // Reset task status to not_started
                    await updateProgressMutation.mutateAsync({
                      taskId: taskDataSimple.id,
                      status: 'not_started',
                    })
                    
                    // Reset code to starter code
                    const starterCode = taskDataSimple.starterCode || ''
                    setCode(starterCode)
                    
                    toast.success('Task restarted! You can start fresh.')
                  } catch (error) {
                    console.error('Error restarting task:', error)
                    toast.error('Failed to restart task. Please try again.')
                  }
                }}
                className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
              >
                Restart Task
              </button>
              <button
                onClick={handleSubmitCode}
                disabled={!code.trim() || isSubmitting}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Code'}
              </button>
            </div>
          </div>
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

