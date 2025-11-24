'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useMemo, lazy, Suspense } from 'react'
import Navbar from '../../components/Navbar'
import ChatBox from '../../components/ChatBox'
import ChatSidebar from '../../components/ChatSidebar'
import LoadingSpinner from '../../components/LoadingSpinner'
import LanguageSelector from '../../components/LanguageSelector'
import { hasGivenConsent, saveConsentToStorage } from '../../lib/research-consent'
import { trpc } from '../../lib/trpc-client'
import { useBlockedStatus } from '../../hooks/useBlockedStatus'
import toast from 'react-hot-toast'

// OPTIMIZATION: Lazy load heavy modal components that are not always needed
const OnboardingTour = lazy(() => import('../../components/OnboardingTour'))
const AssessmentModal = lazy(() => import('../../components/AssessmentModal'))
const UserProfileModal = lazy(() => import('../../components/UserProfileModal'))
const ResearchConsent = lazy(() => import('../../components/ResearchConsent'))

import type { AssessmentQuestion } from '../../components/AssessmentModal'
import type { ProfileData } from '../../components/UserProfileModal'

// Internal component that uses useSearchParams - must be wrapped in Suspense
function ChatPageContent() {
  const { isSignedIn, isLoaded, user } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showPreAssessment, setShowPreAssessment] = useState(false)
  const [showResearchConsent, setShowResearchConsent] = useState(false)
  const [assessmentQuestions, setAssessmentQuestions] = useState<AssessmentQuestion[]>([])
  const [taskInitialized, setTaskInitialized] = useState(false)
  
  // Check if user is blocked - this should redirect via BlockedCheck, but adding extra safety
  const { isBlocked, isLoading: isCheckingBlocked } = useBlockedStatus({
    skipPaths: ['/blocked', '/contact'],
    enabled: isSignedIn && isLoaded,
  })
  
  // OPTIMIZATION: Add staleTime to cache data and improve navigation speed
  // But use refetchOnMount to ensure fresh data when component mounts
  const { data: userProfile, refetch: refetchProfile, error: profileError } = trpc.profile.getProfile.useQuery(undefined, {
    enabled: isSignedIn,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnMount: 'always', // Always refetch when component mounts to get latest profileCompleted status
  })
  
  // Handle profile error separately (onError is not supported in newer tRPC versions)
  useEffect(() => {
    if (profileError?.data?.code === 'FORBIDDEN' && profileError.message === 'User account is blocked') {
      router.push('/blocked')
    }
  }, [profileError, router])
  
  const { data: onboardingStatus, refetch: refetchOnboarding } = trpc.onboarding.getOnboardingStatus.useQuery(undefined, {
    enabled: isSignedIn,
    staleTime: 0, // Always fetch fresh data to prevent showing tour multiple times
    refetchOnMount: 'always', // Always refetch when component mounts
  })
  
  const { data: preAssessment, refetch: refetchAssessment } = trpc.assessment.getAssessments.useQuery(undefined, {
    enabled: isSignedIn,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })
  
  // Extract pre-assessment check to avoid type inference issues
  const hasPreAssessment = useMemo(() => {
    return preAssessment?.some(a => a.type === 'pre') ?? false
  }, [preAssessment])
  
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
          
          // Use mutateAsync to avoid complex type inference in dependencies
          sendMessageMutation.mutateAsync({
            message: taskMessage,
            sessionId: currentSessionId,
          }).then((result) => {
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
          }).catch((error) => {
            console.error('Error sending task message:', error)
            setTaskInitialized(true)
          })
        }
      }, 500) // Wait 500ms for session to be fully ready and rendered
      
      return () => clearTimeout(timer)
    } else if (taskId && !taskInitialized && !isLoadingMessages) {
      // If taskId exists but conditions not met, mark as initialized to prevent retries
      // Only mark as initialized if messages are loaded (not loading)
      setTaskInitialized(true)
    }
  }, [taskData?.id, currentSessionId, taskInitialized, isSignedIn, taskId, sessionIdFromUrl, existingMessages?.length, isLoadingMessages])

  // Separate useEffect specifically for Research Consent - highest priority
  // This runs independently to ensure it shows immediately for new users
  useEffect(() => {
    if (isLoaded && isSignedIn && user?.id) {
      const consentGiven = hasGivenConsent(user.id)
      if (!consentGiven) {
        // Show research consent immediately for new users
        setShowResearchConsent(true)
      } else {
        // Hide research consent if already given
        setShowResearchConsent(false)
      }
    } else if (isLoaded && isSignedIn && !user?.id) {
      // User signed in but ID not loaded yet - wait
      setShowResearchConsent(false)
    }
  }, [isLoaded, isSignedIn, user?.id])

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/')
      return
    }
    
    // Check if user is blocked - redirect immediately
    if (isBlocked) {
      router.replace('/blocked')
      return
    }
    
    // Check if user is blocked (handled via tRPC error in onError callback)
    if (profileError && profileError.data?.code === 'FORBIDDEN') {
      router.push('/blocked')
      return
    }
    
    // Don't show other modals if research consent is showing
    if (showResearchConsent) {
      setShowProfileModal(false)
      setShowPreAssessment(false)
      setShowOnboarding(false)
      return
    }
    
    // Only proceed with other steps if consent is given AND user ID is available
    if (!isLoaded || !isSignedIn || !user?.id) {
      return
    }
    
    // Double-check consent before proceeding (safety check)
    const consentGiven = hasGivenConsent(user.id)
    if (!consentGiven) {
      // Consent not given - show research consent
      setShowResearchConsent(true)
      setShowProfileModal(false)
      setShowPreAssessment(false)
      setShowOnboarding(false)
      return
    }
    
    // Order: Profile → Pre-Assessment → Onboarding Tour (after consent)
    if (userProfile) {
      // Step 1: Show profile modal ONLY if not completed (rely on database, not local state)
      if (!userProfile.profileCompleted) {
        setShowProfileModal(true)
        setShowOnboarding(false)
        setShowPreAssessment(false)
      }
      // Step 2: Show pre-assessment if profile completed but no pre-assessment
      else if (userProfile.profileCompleted && !hasPreAssessment) {
        setShowProfileModal(false)
        setShowOnboarding(false)
        // Only load questions if not already loading and not already shown
        if (!showPreAssessment && assessmentQuestions.length === 0) {
          loadPreAssessmentQuestions()
        }
      }
      // Step 3: Show onboarding tour if profile and pre-assessment are done, but tour not completed
      // Only show if onboardingStatus is loaded and explicitly false (not undefined/null)
      else if (userProfile.profileCompleted && hasPreAssessment && onboardingStatus !== undefined && onboardingStatus.onboardingCompleted === false) {
        setShowProfileModal(false)
        setShowPreAssessment(false)
        setShowOnboarding(true)
      }
      // All steps completed - hide all modals
      else {
        setShowProfileModal(false)
        setShowPreAssessment(false)
        setShowOnboarding(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, router, onboardingStatus, userProfile, hasPreAssessment, showPreAssessment, assessmentQuestions.length, user?.id, isBlocked, profileError])

  const loadPreAssessmentQuestions = async () => {
    try {
      const questions = await getQuestionsMutation.mutateAsync({
        type: 'pre',
        language: userProfile?.primaryLanguage ?? undefined,
      })
      // Transform questions to AssessmentQuestion format explicitly
      const transformedQuestions: AssessmentQuestion[] = questions.map((q: any) => ({
        id: q.id,
        question: q.question,
        type: q.type as 'multiple_choice' | 'code_snippet' | 'conceptual',
        options: Array.isArray(q.options) ? q.options : (q.options ? [q.options] : undefined),
        correctAnswer: q.correctAnswer,
        category: q.category,
        difficulty: q.difficulty,
        explanation: q.explanation || undefined,
      }))
      setAssessmentQuestions(transformedQuestions)
      // Show pre-assessment modal after questions are loaded
      if (transformedQuestions.length > 0) {
        setShowPreAssessment(true)
      }
    } catch (error) {
      console.error('Error loading assessment questions:', error)
    }
  }

  const utils = trpc.useUtils()
  
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
      setProfileModalDismissed(true)
      
      // Invalidate and refetch profile to get updated data
      await utils.profile.getProfile.invalidate()
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
    try {
      await updateOnboardingMutation.mutateAsync({
        completed: true,
      })
      // Immediately refetch to get updated status
      await refetchOnboarding()
      // Also invalidate cache to ensure fresh data on next mount
      await utils.onboarding.getOnboardingStatus.invalidate()
    } catch (error) {
      console.error('Error completing onboarding:', error)
    }
  }

  const handleOnboardingSkip = async () => {
    setShowOnboarding(false)
    try {
      await updateOnboardingMutation.mutateAsync({
        completed: true,
      })
      // Immediately refetch to get updated status
      await refetchOnboarding()
      // Also invalidate cache to ensure fresh data on next mount
      await utils.onboarding.getOnboardingStatus.invalidate()
    } catch (error) {
      console.error('Error skipping onboarding:', error)
    }
  }

  const handleResearchConsent = (consent: boolean) => {
    if (user?.id) {
      saveConsentToStorage(consent, user.id)
    } else {
      saveConsentToStorage(consent)
    }
    setShowResearchConsent(false)
    if (!consent) {
      // If user declines, redirect to home page
      router.push('/')
    } else {
      // If consent given, trigger refetch to show profile modal
      refetchProfile()
    }
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

  // Show loading while checking block status
  if (isCheckingBlocked) {
    return <LoadingSpinner />
  }

  // Don't render chat if user is blocked (should redirect, but safety check)
  if (isBlocked) {
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
            onClose={() => {
        setShowProfileModal(false)
      }}
            onComplete={handleProfileComplete}
            isOptional={userProfile?.profileCompleted || false}
            initialData={userProfile ? {
              experience: userProfile.selfReportedLevel || '',
              focusAreas: userProfile.learningGoals || [],
              confidence: userProfile.initialConfidence || 3,
              aiExperience: userProfile.aiExperience || '',
              preferredLanguages: userProfile.preferredLanguages || [],
              primaryLanguage: userProfile.primaryLanguage ?? undefined,
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
            language={userProfile?.primaryLanguage ?? undefined}
          />
        </Suspense>
      )}

      {/* Onboarding Tour - Step 3 */}
      {showOnboarding && !showProfileModal && !showPreAssessment && !showResearchConsent && (
        <Suspense fallback={null}>
          <OnboardingTour
            isActive={showOnboarding}
            onComplete={handleOnboardingComplete}
            onSkip={handleOnboardingSkip}
          />
        </Suspense>
      )}

      {/* Research Consent Modal - Step 1 (FIRST, before everything else) */}
      {showResearchConsent && (
        <Suspense fallback={null}>
          <ResearchConsent onConsent={handleResearchConsent} />
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

// Main component that wraps ChatPageContent in Suspense
export default function ChatPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ChatPageContent />
    </Suspense>
  )
}