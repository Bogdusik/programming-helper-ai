'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Prisma } from '@prisma/client'
import Navbar from '../../components/Navbar'
import MinimalBackground from '../../components/MinimalBackground'
import LoadingSpinner from '../../components/LoadingSpinner'
import ProgressDashboard from '../../components/ProgressDashboard'
import AssessmentModal, { AssessmentQuestion } from '../../components/AssessmentModal'
import { trpc } from '../../lib/trpc-client'

export default function StatsPage() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const [showPostAssessment, setShowPostAssessment] = useState(false)
  const [assessmentQuestions, setAssessmentQuestions] = useState<AssessmentQuestion[]>([])
  
  // OPTIMIZATION: Add staleTime to cache data and improve navigation speed
  const { data: stats, isLoading: statsLoading, error: statsError } = trpc.stats.getUserStats.useQuery(undefined, {
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  })
  const { data: userProfile } = trpc.profile.getProfile.useQuery(undefined, {
    enabled: isSignedIn,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })
  const getQuestionsMutation = trpc.assessment.getQuestions.useMutation()
  const submitAssessmentMutation = trpc.assessment.submitAssessment.useMutation()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/')
    }
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded || statsLoading) {
    return <LoadingSpinner />
  }

  if (!isSignedIn) {
    return null
  }

  const handleTakePostAssessment = async () => {
    try {
      const questions = await getQuestionsMutation.mutateAsync({
        type: 'post',
        language: userProfile?.primaryLanguage || undefined,
      })
      // Transform database questions to AssessmentQuestion format
      // Cast to type with Prisma.JsonValue for options and explanation
      const questionsArray = questions as unknown as Array<{
        id: string
        question: string
        type: string
        options: Prisma.JsonValue
        correctAnswer: string
        category: string
        difficulty: string
        explanation: Prisma.JsonValue
      }>
      
      const transformedQuestions: AssessmentQuestion[] = questionsArray.map((q) => {
        // Convert options from Prisma.JsonValue to string[] | undefined
        let options: string[] | undefined = undefined
        if (q.options !== null && q.options !== undefined) {
          if (Array.isArray(q.options)) {
            // Filter out non-string values and convert to string[]
            options = q.options.filter((item): item is string => typeof item === 'string')
          } else if (typeof q.options === 'string') {
            options = [q.options]
          }
        }
        
        // Convert explanation from Prisma.JsonValue to string | undefined
        let explanation: string | undefined = undefined
        if (q.explanation !== null && q.explanation !== undefined && typeof q.explanation === 'string') {
          explanation = q.explanation
        }
        
        return {
          id: q.id,
          question: q.question,
          type: q.type as 'multiple_choice' | 'code_snippet' | 'conceptual',
          options,
          correctAnswer: q.correctAnswer,
          category: q.category,
          difficulty: q.difficulty,
          explanation,
        }
      })
      setAssessmentQuestions(transformedQuestions)
      setShowPostAssessment(true)
    } catch (error) {
      console.error('Error loading assessment questions:', error)
    }
  }

  const handleAssessmentSubmit = async (answers: Array<{ questionId: string; answer: string; isCorrect?: boolean }>, confidence: number) => {
    try {
      await submitAssessmentMutation.mutateAsync({
        type: 'post',
        language: userProfile?.primaryLanguage || undefined,
        answers: answers.map(a => ({
          questionId: a.questionId,
          answer: a.answer,
          isCorrect: a.isCorrect,
        })),
        confidence,
      })
      setShowPostAssessment(false)
      // Refresh stats to show improvement
      window.location.reload()
    } catch (error) {
      console.error('Error submitting assessment:', error)
    }
  }

  if (statsError) {
    return (
      <div className="min-h-screen gradient-bg">
        <Navbar />
        <div className="pt-20 pb-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="glass rounded-2xl p-6 border border-red-500/20">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Error loading statistics</h3>
                  <p className="text-white/70 mt-1">There was an error loading your statistics. Please try again later.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      <Navbar />
      
      {/* Minimal background for stats page */}
      <MinimalBackground />
      
      {/* Post-Assessment Modal */}
      {showPostAssessment && assessmentQuestions.length > 0 && (
        <AssessmentModal
          isOpen={showPostAssessment}
          onClose={() => setShowPostAssessment(false)}
          onSubmit={handleAssessmentSubmit}
          type="post"
          questions={assessmentQuestions}
          language={userProfile?.primaryLanguage || undefined}
        />
      )}

      <div className="relative pt-30 pb-40 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Your Programming Journey</h1>
            <p className="text-white/70">Track your progress with AI assistance</p>
          </div>

          {/* Progress Dashboard */}
          <div className="mb-6">
            <ProgressDashboard />
          </div>

          {/* Legacy Stats Cards (keeping for backward compatibility) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="glass rounded-xl p-5 card-hover text-center">
              <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold gradient-text mb-1">{stats?.questionsAsked || 0}</h3>
              <p className="text-white/60 text-sm">Questions Asked</p>
            </div>

            <div className="glass rounded-xl p-5 card-hover text-center">
              <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-lg mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold gradient-text mb-1">{stats?.avgResponseTime ? `${stats.avgResponseTime.toFixed(1)}s` : '0s'}</h3>
              <p className="text-white/60 text-sm">Avg Response Time</p>
            </div>

            <div className="glass rounded-xl p-5 card-hover text-center">
              <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow-lg mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold gradient-text mb-1">{stats?.mostFrequentResponseType || 'None'}</h3>
              <p className="text-white/60 text-sm">Most Frequent Type</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}