'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useMemo, lazy, Suspense } from 'react'
import Navbar from '../../components/Navbar'
import ChatBox from '../../components/ChatBox'
import ChatSidebar from '../../components/ChatSidebar'
import LoadingSpinner from '../../components/LoadingSpinner'
import LanguageSelector from '../../components/LanguageSelector'
import { hasGivenConsent } from '../../lib/research-consent'
import { trpc } from '../../lib/trpc-client'
import toast from 'react-hot-toast'

// OPTIMIZATION: Lazy load heavy modal components that are not always needed
const OnboardingTour = lazy(() => import('../../components/OnboardingTour'))
const AssessmentModal = lazy(() => import('../../components/AssessmentModal'))
const UserProfileModal = lazy(() => import('../../components/UserProfileModal'))

import type { AssessmentQuestion } from '../../components/AssessmentModal'
import type { ProfileData } from '../../components/UserProfileModal'

export default function ChatPage() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showPreAssessment, setShowPreAssessment] = useState(false)
  const [assessmentQuestions, setAssessmentQuestions] = useState<AssessmentQuestion[]>([])
  const [taskInitialized, setTaskInitialized] = useState(false)
  
  // OPTIMIZATION: Add staleTime to cache data and improve navigation speed
  const { data: userProfile, refetch: refetchProfile, error: profileError } = trpc.profile.getProfile.useQuery(undefined, {
    enabled: isSignedIn,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    onError: (error) => {
      // If user is blocked, redirect to blocked page
      if (error.data?.code === 'FORBIDDEN' && error.message === 'User account is blocked') {
        router.push('/blocked')
      }
    },
  })
  
  const { data: onboardingStatus } = trpc.onboarding.getOnboardingStatus.useQuery(undefined, {
    enabled: isSignedIn,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes (rarely changes)
  })
  
  const { data: preAssessment, refetch: refetchAssessment } = trpc.assessment.getAssessments.useQuery(undefined, {
    enabled: isSignedIn,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })
  
  const utils = trpc.useUtils()
  // Calculate chat height once and keep it fixed - use useMemo to prevent recalculation
  const chatHeight = useMemo(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768 ? 800 : 750
    }
    return 750
  }, [])
  
  const updateOnboardingMutation = trpc.onboarding.updateOnboardingStatus.useMutation()
  const updateLanguagesMutation = trpc.profile.updateLanguages.useMutation()
  const updateProfileMutation = trpc.profile.updateProfile.useMutation()
  const getQuestionsMutation = trpc.assessment.getQuestions.useMutation()
  const submitAssessmentMutation = trpc.assessment.submitAssessment.useMutation()
  const sendMessageMutation = trpc.chat.sendMessage.useMutation()
  const updateProgressMutation = trpc.task.updateTaskProgress.useMutation()
  const completeTaskMutation = trpc.task.completeTask.useMutation()
  
  // Get task data if taskId is in URL
  const taskId = searchParams.get('taskId')
  const sessionIdFromUrl = searchParams.get('sessionId')
  const { data: taskData } = trpc.task.getTask.useQuery(
    { taskId: taskId!, includeProgress: false },
    { enabled: !!taskId && isSignedIn }
  )

  // Handle task initialization when coming from tasks page
  useEffect(() => {
    if (sessionIdFromUrl) {
      setCurrentSessionId(sessionIdFromUrl)
      // Reset task initialization state when switching sessions
      setTaskInitialized(false)
    } else if (!sessionIdFromUrl && currentSessionId) {
      // Clear session if no sessionId in URL
      setCurrentSessionId(undefined)
      setTaskInitialized(false)
    }
  }, [sessionIdFromUrl])

  // Check if session has messages to determine if it's a new or existing session
  const { data: existingMessages, isLoading: isLoadingMessages } = trpc.chat.getMessages.useQuery(
    { sessionId: currentSessionId },
    { enabled: !!currentSessionId && isSignedIn }
  )

  // Auto-send task description when task is loaded (only for new task starts)
  useEffect(() => {
    // Only send initial message if:
    // 1. Task data is loaded
    // 2. Session exists and messages are loaded (not loading)
    // 3. Task is not yet initialized
    // 4. User is signed in
    // 5. Both taskId and sessionId are in URL (indicating new task start)
    // 6. Session has no existing messages (it's a new session)
    const hasNoMessages = !existingMessages || existingMessages.length === 0
    const isNewTaskStart = taskId && sessionIdFromUrl && hasNoMessages
    const isSessionReady = currentSessionId && !isLoadingMessages
    
    if (taskData && isSessionReady && !taskInitialized && isSignedIn && isNewTaskStart) {
      // Add a small delay to ensure everything is fully loaded and rendered
      const timer = setTimeout(() => {
        // Double-check that messages are still empty (session wasn't populated in the meantime)
        if (!existingMessages || existingMessages.length === 0) {
          // Only send message if this is a new task start (both taskId and sessionId in URL, and no messages)
          const taskMessage = `I want to work on this task:\n\n**${taskData.title}**\n\n${taskData.description}\n\nLanguage: ${taskData.language}\nDifficulty: ${taskData.difficulty}\n\nPlease help me solve this task.`
          
          sendMessageMutation.mutate(
            {
              message: taskMessage,
              sessionId: currentSessionId,
            },
            {
              onSuccess: (result) => {
                setTaskInitialized(true)
                // If a new session was created (session was missing), update currentSessionId
                if (result.sessionId && result.sessionId !== currentSessionId) {
                  setCurrentSessionId(result.sessionId)
                  // Update task progress with new session ID
                  if (taskId) {
                    updateProgressMutation.mutate({
                      taskId: taskId,
                      chatSessionId: result.sessionId,
                    })
                  }
                }
                // Remove taskId from URL after initialization
                const newUrl = new URL(window.location.href)
                newUrl.searchParams.delete('taskId')
                router.replace(newUrl.pathname + newUrl.search)
              },
              onError: (error) => {
                console.error('Error sending task message:', error)
                setTaskInitialized(true)
              }
            }
          )
        }
      }, 500) // Wait 500ms for session to be fully ready and rendered
      
      return () => clearTimeout(timer)
    } else if (taskId && !taskInitialized && !isLoadingMessages) {
      // If taskId exists but conditions not met, mark as initialized to prevent retries
      // Only mark as initialized if messages are loaded (not loading)
      setTaskInitialized(true)
    }
  }, [taskData, currentSessionId, taskInitialized, isSignedIn, sendMessageMutation, updateProgressMutation, router, taskId, sessionIdFromUrl, existingMessages, isLoadingMessages])

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/')
    }
    
    // Check if user is blocked (handled via tRPC error in onError callback)
    if (profileError && profileError.data?.code === 'FORBIDDEN') {
      router.push('/blocked')
    }
    
    // Check research consent
    if (isLoaded && isSignedIn && !hasGivenConsent()) {
      router.push('/')
    }
    
    // Order: Profile → Pre-Assessment → Onboarding Tour
    if (isLoaded && isSignedIn && userProfile) {
      // Step 1: Show profile modal if not completed
      if (!userProfile.profileCompleted) {
        setShowProfileModal(true)
        setShowOnboarding(false)
        setShowPreAssessment(false)
      }
      // Step 2: Show pre-assessment if profile completed but no pre-assessment
      else if (userProfile.profileCompleted && !preAssessment?.find(a => a.type === 'pre')) {
        setShowProfileModal(false)
        setShowOnboarding(false)
        // Only load questions if not already loading and not already shown
        if (!showPreAssessment && assessmentQuestions.length === 0) {
          loadPreAssessmentQuestions()
        }
      }
      // Step 3: Show onboarding tour if profile and pre-assessment are done, but tour not completed
      else if (userProfile.profileCompleted && preAssessment?.find(a => a.type === 'pre') && onboardingStatus) {
        setShowProfileModal(false)
        setShowPreAssessment(false)
        if (!onboardingStatus.onboardingCompleted) {
          setShowOnboarding(true)
        } else {
          // All steps completed - hide all modals
          setShowOnboarding(false)
          setShowProfileModal(false)
          setShowPreAssessment(false)
        }
      } else {
        // All steps completed - hide all modals (fallback)
        setShowProfileModal(false)
        setShowPreAssessment(false)
        setShowOnboarding(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, router, onboardingStatus, userProfile, preAssessment, showPreAssessment, assessmentQuestions.length])

  const loadPreAssessmentQuestions = async () => {
    try {
      const questions = await getQuestionsMutation.mutateAsync({
        type: 'pre',
        language: userProfile?.primaryLanguage || undefined,
      })
      setAssessmentQuestions(questions as AssessmentQuestion[])
      // Show pre-assessment modal after questions are loaded
      if (questions && questions.length > 0) {
        setShowPreAssessment(true)
      }
    } catch (error) {
      console.error('Error loading assessment questions:', error)
    }
  }

  const handleProfileComplete = async (data: ProfileData) => {
    try {
      await updateProfileMutation.mutateAsync({
        experience: data.experience,
        focusAreas: data.focusAreas,
        confidence: data.confidence,
        aiExperience: data.aiExperience,
        preferredLanguages: data.preferredLanguages,
        primaryLanguage: data.primaryLanguage,
      })
      setShowProfileModal(false)
      // Refetch profile to get updated data
      await refetchProfile()
      // Pre-assessment will be shown automatically via useEffect
    } catch (error) {
      console.error('Error updating profile:', error)
    }
  }

  const handleAssessmentSubmit = async (answers: any[], confidence: number) => {
    try {
      await submitAssessmentMutation.mutateAsync({
        type: 'pre',
        language: userProfile?.primaryLanguage || undefined,
        answers: answers.map(a => ({
          questionId: a.questionId,
          answer: a.answer,
          isCorrect: a.isCorrect,
        })),
        confidence,
      })
      setShowPreAssessment(false)
      // Refetch assessment to get updated data
      await refetchAssessment()
      // Onboarding tour will be shown automatically via useEffect
    } catch (error) {
      console.error('Error submitting assessment:', error)
    }
  }

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false)
    await updateOnboardingMutation.mutateAsync({
      completed: true,
    })
  }

  const handleOnboardingSkip = async () => {
    setShowOnboarding(false)
    await updateOnboardingMutation.mutateAsync({
      completed: true,
    })
  }

  const handleLanguagesChange = async (languages: string[], primary?: string) => {
    try {
      await updateLanguagesMutation.mutateAsync({
        preferredLanguages: languages,
        primaryLanguage: primary,
      })
      // Refetch profile to update UI immediately
      await refetchProfile()
    } catch (error) {
      console.error('Error updating languages:', error)
    }
  }

  const handleSessionSelect = (sessionId: string) => {
    setCurrentSessionId(sessionId)
    setTaskInitialized(false)
    // Clear taskId from URL when selecting an existing chat
    // The task will be found automatically from the session's associated task progress
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.delete('taskId')
    // Update sessionId in URL to reflect the selected session
    newUrl.searchParams.set('sessionId', sessionId)
    router.replace(newUrl.pathname + newUrl.search)
  }

  const handleNewChat = () => {
    setCurrentSessionId(undefined)
    setTaskInitialized(false)
    // Clear taskId from URL
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.delete('taskId')
    newUrl.searchParams.delete('sessionId')
    router.replace(newUrl.pathname + newUrl.search)
  }

  const handleSessionCreated = (sessionId: string) => {
    setCurrentSessionId(sessionId)
    // Trigger sidebar refresh
    setRefreshTrigger(prev => prev + 1)
  }

  if (!isLoaded) {
    return <LoadingSpinner />
  }

  if (!isSignedIn) {
    return null
  }

  return (
    <div className="min-h-screen gradient-bg">
      <Navbar />
      
      {/* User Profile Modal - Step 1 */}
      {showProfileModal && (
        <Suspense fallback={null}>
          <UserProfileModal
            isOpen={showProfileModal}
            onClose={() => setShowProfileModal(false)}
            onComplete={handleProfileComplete}
            isOptional={userProfile?.profileCompleted || false}
            initialData={userProfile ? {
              experience: userProfile.selfReportedLevel || '',
              focusAreas: userProfile.learningGoals || [],
              confidence: userProfile.initialConfidence || 3,
              aiExperience: userProfile.aiExperience || '',
              preferredLanguages: userProfile.preferredLanguages || [],
              primaryLanguage: userProfile.primaryLanguage,
            } : undefined}
          />
        </Suspense>
      )}

      {/* Pre-Assessment Modal - Step 2 */}
      {showPreAssessment && assessmentQuestions.length > 0 && (
        <Suspense fallback={null}>
          <AssessmentModal
            isOpen={showPreAssessment}
            onClose={() => setShowPreAssessment(false)}
            onSubmit={handleAssessmentSubmit}
            type="pre"
            questions={assessmentQuestions}
            language={userProfile?.primaryLanguage}
          />
        </Suspense>
      )}

      {/* Onboarding Tour - Step 3 */}
      {showOnboarding && !showProfileModal && !showPreAssessment && (
        <Suspense fallback={null}>
          <OnboardingTour
            isActive={showOnboarding}
            onComplete={handleOnboardingComplete}
            onSkip={handleOnboardingSkip}
          />
        </Suspense>
      )}
      
      <div className="pt-20 pb-8 min-h-[calc(100vh-5rem)] flex flex-col" style={{ minHeight: 'calc(100vh - 5rem)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col justify-center" style={{ minHeight: 0, height: '100%' }}>
          <div className="text-center mb-2 flex-shrink-0">
            <h1 className="text-4xl font-bold text-white mb-1">AI Programming Assistant</h1>
            <p className="text-white/70 text-lg mb-2">Get instant help with your coding questions</p>
            {/* Language Selector */}
            {userProfile && (
              <div className="flex justify-center mb-4" data-tour="language-selector">
                <LanguageSelector
                  selectedLanguages={userProfile.preferredLanguages || []}
                  primaryLanguage={userProfile.primaryLanguage || undefined}
                  onLanguagesChange={handleLanguagesChange}
                  compact={true}
                />
              </div>
            )}
          </div>
          
          <div className="flex justify-center items-center flex-shrink-0 w-full" style={{ height: `${chatHeight}px`, minHeight: `${chatHeight}px`, maxHeight: `${chatHeight}px` }}>
            <div 
              className="flex w-full max-w-7xl glass rounded-3xl shadow-2xl border border-white/10 overflow-hidden relative" 
              style={{ 
                height: `${chatHeight}px`,
                minHeight: `${chatHeight}px`,
                maxHeight: `${chatHeight}px`,
                width: '100%',
                maxWidth: '1280px',
                flexShrink: 0,
                flexGrow: 0,
                boxSizing: 'border-box',
                position: 'relative'
              }}
            >
            {/* Sidebar */}
            {sidebarOpen && (
              <div data-tour="chat-sessions">
                <ChatSidebar
                  currentSessionId={currentSessionId}
                  onSessionSelect={handleSessionSelect}
                  onNewChat={handleNewChat}
                  refreshTrigger={refreshTrigger}
                />
              </div>
            )}
            
            {/* Chat Area */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ height: '100%', minHeight: 0, maxHeight: '100%', overflow: 'hidden' }}>
              {/* Mobile sidebar toggle */}
              <div className="lg:hidden p-4 border-b border-white/10">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
              
              <ChatBox
                key={currentSessionId || 'new-chat'}
                sessionId={currentSessionId}
                taskId={taskId || undefined}
                onSessionCreated={handleSessionCreated}
                onTaskComplete={async (taskIdToComplete) => {
                  try {
                    await completeTaskMutation.mutateAsync({ taskId: taskIdToComplete })
                    // Invalidate queries to refresh UI in Tasks page and Stats
                    await utils.task.getTasks.invalidate()
                    await utils.task.getTaskProgress.invalidate({ taskId: taskIdToComplete })
                    await utils.task.getTaskProgress.invalidate() // Also invalidate all task progress
                    await utils.stats.getUserStats.invalidate()
                    toast.success('Task marked as completed! 🎉')
                  } catch (error) {
                    console.error('Error completing task:', error)
                    toast.error('Failed to complete task. Please try again.')
                  }
                }}
              />
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}