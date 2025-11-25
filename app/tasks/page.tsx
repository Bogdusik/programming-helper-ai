'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import Navbar from '../../components/Navbar'
import MinimalBackground from '../../components/MinimalBackground'
import LoadingSpinner from '../../components/LoadingSpinner'
import { trpc } from '../../lib/trpc-client'
import type { RouterOutputs } from '../../lib/trpc-types'

import { useBlockedStatus } from '../../hooks/useBlockedStatus'
import toast from 'react-hot-toast'

// Type for task with userProgress included (when includeProgress: true)
type TaskWithProgress = RouterOutputs['task']['getTasks'][number] & {
  userProgress?: Array<{
    id: string
    status: string
    chatSessionId: string | null
    attempts: number
  }>
}

export default function TasksPage() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const { isBlocked, isLoading: isCheckingBlocked } = useBlockedStatus({
    skipPaths: ['/blocked', '/contact'],
    enabled: isSignedIn && isLoaded,
  })
  const [selectedLanguage, setSelectedLanguage] = useState<string | undefined>()
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | undefined>()
  
  const { data: userProfile } = trpc.profile.getProfile.useQuery(undefined, {
    enabled: isSignedIn,
  })
  
  // Use preferred languages from profile, or fall back to selectedLanguage filter
  const preferredLanguages = userProfile?.preferredLanguages || []
  const languagesToFilter = preferredLanguages.length > 0 
    ? preferredLanguages 
    : selectedLanguage 
      ? [selectedLanguage] 
      : undefined
  
  const { data: allTasks, isLoading } = trpc.task.getTasks.useQuery(
    {
      languages: languagesToFilter,
      difficulty: selectedDifficulty,
      includeProgress: true,
    },
    {
      // Refetch when preferred languages change
      enabled: isSignedIn,
    }
  )
  
  // Limit tasks to 5 maximum (as required for post-assessment unlock)
  // Distribute tasks across selected languages if multiple languages are selected
  const tasks = useMemo(() => {
    if (!allTasks || allTasks.length === 0) return []
    
    // Cast to TaskWithProgress[] since includeProgress: true
    const tasksWithProgress = allTasks as unknown as TaskWithProgress[]
    
    // If only one language or no specific languages, just take first 5
    if (!languagesToFilter || languagesToFilter.length <= 1) {
      return tasksWithProgress.slice(0, 5)
    }
    
    // If multiple languages, distribute tasks evenly, but ensure we get exactly 5 if available
    const tasksPerLanguage = Math.ceil(5 / languagesToFilter.length)
    const tasksByLanguage: { [key: string]: TaskWithProgress[] } = {}
    
    // Group tasks by language
    for (const task of tasksWithProgress) {
      const lang = task.language.toLowerCase()
      if (!tasksByLanguage[lang]) {
        tasksByLanguage[lang] = []
      }
      tasksByLanguage[lang].push(task)
    }
    
    // Take tasks from each language
    const result: TaskWithProgress[] = []
    for (const lang of languagesToFilter) {
      const langLower = lang.toLowerCase()
      const langTasks = tasksByLanguage[langLower] || []
      const needed = 5 - result.length
      const toTake = Math.min(tasksPerLanguage, needed, langTasks.length)
      result.push(...langTasks.slice(0, toTake))
      if (result.length >= 5) break
    }
    
    // If we still don't have 5 tasks, fill from remaining tasks regardless of language
    if (result.length < 5 && tasksWithProgress) {
      // Extract IDs as strings to avoid deep type recursion
      const usedTaskIds = new Set<string>(
        (result as Array<{ id: string }>).map((t) => t.id)
      )
      for (const task of tasksWithProgress) {
        if (!usedTaskIds.has(task.id)) {
          result.push(task)
          if (result.length >= 5) break
        }
      }
    }
    
    return result.slice(0, 5)
  }, [allTasks, languagesToFilter])
  
  const utils = trpc.useUtils()
  
  const completeTaskMutation = trpc.task.completeTask.useMutation({
    onSuccess: () => {
      // Invalidate tasks query to refresh the UI
      utils.task.getTasks.invalidate()
    },
  })
  const updateProgressMutation = trpc.task.updateTaskProgress.useMutation({
    onSuccess: () => {
      // Invalidate tasks query to refresh the UI
      utils.task.getTasks.invalidate()
    },
  })
  const createSessionMutation = trpc.chat.createSession.useMutation()
  const [startingTaskId, setStartingTaskId] = useState<string | null>(null)

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/')
      return
    }
    
    // Redirect blocked users to blocked page
    if (isLoaded && isSignedIn && isBlocked) {
      router.replace('/blocked')
    }
  }, [isLoaded, isSignedIn, isBlocked, router])

  if (!isLoaded || isLoading || (isSignedIn && isCheckingBlocked) || (isSignedIn && isBlocked)) {
    return <LoadingSpinner />
  }

  if (!isSignedIn) {
    return null
  }

  const handleStartTask = async (task: TaskWithProgress) => {
    // Prevent multiple clicks
    if (startingTaskId === task.id) {
      return
    }
    
    try {
      setStartingTaskId(task.id)
      
      // Check if task already has progress with a session
      const progress = task.userProgress?.[0]
      if (progress?.chatSessionId && progress?.status === 'in_progress') {
        // Check if session has messages - if not, reset task to not_started
        try {
          const sessionMessages = await utils.chat.getMessages.fetch({ 
            sessionId: progress.chatSessionId 
          })
          
          if (!sessionMessages || sessionMessages.length === 0) {
            // Session is empty, reset task to not_started
            await updateProgressMutation.mutateAsync({
              taskId: task.id,
              status: 'not_started',
              chatSessionId: undefined,
            })
            // Invalidate queries to refresh UI
            utils.task.getTasks.invalidate()
            setStartingTaskId(null)
            return
          }
        } catch (error) {
          // If we can't check messages, assume session is empty and reset
          console.warn('Could not check session messages, resetting task:', error)
          await updateProgressMutation.mutateAsync({
            taskId: task.id,
            status: 'not_started',
            chatSessionId: undefined,
          })
          utils.task.getTasks.invalidate()
          setStartingTaskId(null)
          return
        }
        
        // Task already in progress with messages, navigate to existing session
        router.push(`/chat?sessionId=${progress.chatSessionId}`)
        setStartingTaskId(null)
        return
      }
      
      // Create a chat session with task title
      const session = await createSessionMutation.mutateAsync({
        title: `Task: ${task.title}`,
      })
      
      // Update task progress with the chat session ID
      await updateProgressMutation.mutateAsync({
        taskId: task.id,
        status: 'in_progress',
        chatSessionId: session.id,
      })
      
      // OPTIMIZATION: Wait a bit for session to be fully created and then navigate
      // This ensures the chat page can properly load the session before auto-sending message
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Navigate to chat page with the session ID and taskId
      // taskId is needed for auto-sending the task description message
      router.push(`/chat?sessionId=${session.id}&taskId=${task.id}`)
    } catch (error) {
      console.error('Error starting task:', error)
      alert('Error starting task. Please try again.')
      setStartingTaskId(null)
    }
  }

  const handleCompleteTask = async (taskId: string) => {
    try {
      await completeTaskMutation.mutateAsync({ taskId })
      // Query will be invalidated automatically by the mutation's onSuccess
    } catch (error) {
      console.error('Error completing task:', error)
      alert('Error completing task. Please try again.')
    }
  }

  const handleRestartTask = async (task: TaskWithProgress) => {
    if (!confirm('Are you sure you want to restart this task? Your previous progress will be reset.')) {
      return
    }
    
    try {
      // Reset task progress to not_started and clear chat session
      await updateProgressMutation.mutateAsync({
        taskId: task.id,
        status: 'not_started',
        chatSessionId: undefined,
        attempts: (task.userProgress?.[0]?.attempts || 0) + 1, // Increment attempts
      })
      // Invalidate queries to refresh UI
      utils.task.getTasks.invalidate()
      toast.success('Task restarted! You can now start it again.')
    } catch (error) {
      console.error('Error restarting task:', error)
      toast.error('Failed to restart task. Please try again.')
    }
  }

  const getTaskStatus = (task: TaskWithProgress) => {
    const progress = task.userProgress?.[0]
    return progress?.status || 'not_started'
  }

  const isTaskCompleted = (task: TaskWithProgress) => {
    return getTaskStatus(task) === 'completed'
  }

  const isTaskInProgress = (task: TaskWithProgress) => {
    return getTaskStatus(task) === 'in_progress'
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      <Navbar />
      <MinimalBackground />

      <div className="relative pt-20 pb-8 min-h-screen flex flex-col">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col justify-center">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">Programming Tasks</h1>
            <p className="text-white/70 text-lg">Complete tasks to improve your skills and unlock post-assessment</p>
          </div>

          {/* Filters */}
          <div className="glass rounded-lg p-4 mb-8 flex flex-wrap gap-4 items-center justify-center max-w-2xl mx-auto">
            {preferredLanguages.length === 0 && (
              <div>
                <label className="text-sm text-white/70 mr-2">Language:</label>
                <select
                  value={selectedLanguage || ''}
                  onChange={(e) => setSelectedLanguage(e.target.value || undefined)}
                  className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                >
                  <option value="">All Languages</option>
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                  <option value="csharp">C#</option>
                  <option value="rust">Rust</option>
                  <option value="go">Go</option>
                </select>
              </div>
            )}
            {preferredLanguages.length > 0 && (
              <div className="text-sm text-white/70">
                <span className="mr-2">Showing tasks for:</span>
                <span className="text-white font-medium">
                  {preferredLanguages.map(lang => {
                    const langNames: Record<string, string> = {
                      javascript: 'JavaScript',
                      typescript: 'TypeScript',
                      python: 'Python',
                      java: 'Java',
                      cpp: 'C++',
                      csharp: 'C#',
                      rust: 'Rust',
                      go: 'Go',
                      sql: 'SQL',
                    }
                    return langNames[lang] || lang
                  }).join(', ')}
                </span>
                <p className="text-xs text-white/50 mt-1">
                  Update your language preferences on the Chat page to change this filter
                </p>
              </div>
            )}
            <div>
              <label className="text-sm text-white/70 mr-2">Difficulty:</label>
              <select
                value={selectedDifficulty || ''}
                onChange={(e) => setSelectedDifficulty(e.target.value || undefined)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              >
                <option value="">All Levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          {/* Tasks Grid */}
          {tasks && tasks.length > 0 ? (
            <div className="flex justify-center items-center">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
                {tasks.map((task) => {
                const status = getTaskStatus(task)
                const isCompleted = isTaskCompleted(task)
                const inProgress = isTaskInProgress(task)

                return (
                  <div
                    key={task.id}
                    className={`glass rounded-lg p-6 ${
                      isCompleted
                        ? 'border-2 border-green-500/50 bg-gradient-to-br from-green-900/20 to-blue-900/20'
                        : inProgress
                        ? 'border-2 border-blue-500/50'
                        : 'border border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-white mb-1">{task.title}</h3>
                        <div className="flex gap-2 mt-2">
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded capitalize">
                            {task.language}
                          </span>
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded capitalize">
                            {task.difficulty}
                          </span>
                          {isCompleted && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded">
                              ✓ Completed
                            </span>
                          )}
                          {inProgress && (
                            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded">
                              In Progress
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-white/70 text-sm mb-4 line-clamp-3">{task.description}</p>

                    <div className="flex flex-col sm:flex-row gap-2">
                      {status === 'not_started' && (
                        <button
                          onClick={() => handleStartTask(task)}
                          disabled={startingTaskId === task.id}
                          className="w-full sm:flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm font-medium"
                        >
                          {startingTaskId === task.id ? 'Starting...' : 'Start Task'}
                        </button>
                      )}
                      {inProgress && (
                        <>
                          <button
                            onClick={async () => {
                              const progress = task.userProgress?.[0]
                              if (progress?.chatSessionId) {
                                // Navigate to existing session WITHOUT taskId to avoid auto-sending message
                                router.push(`/chat?sessionId=${progress.chatSessionId}`)
                              } else {
                                // If no session exists, create one
                                await handleStartTask(task)
                              }
                            }}
                            disabled={startingTaskId === task.id}
                            className="w-full sm:flex-1 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm font-medium"
                          >
                            Continue Task
                          </button>
                          <button
                            onClick={() => handleCompleteTask(task.id)}
                            className="w-full sm:flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap text-sm font-medium"
                          >
                            Mark Complete
                          </button>
                        </>
                      )}
                      {isCompleted && (
                        <div className="flex flex-col sm:flex-row gap-2 w-full">
                          <div className="w-full sm:flex-1 px-4 py-2 bg-green-500/20 text-green-300 rounded-lg text-center whitespace-nowrap text-sm font-medium flex items-center justify-center">
                            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Completed
                          </div>
                          <button
                            onClick={() => handleRestartTask(task)}
                            className="w-full sm:flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap text-sm font-medium flex items-center justify-center space-x-1"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Restart Task</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center py-12">
                <p className="text-white/60 text-lg">No tasks available. Check back later!</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

