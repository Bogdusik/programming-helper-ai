'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { trpc } from '../lib/trpc-client'
import { checkPostAssessmentEligibility, getPostAssessmentMessage } from '../lib/assessment-utils'
import type { Assessment } from '../lib/trpc-types'
import AssessmentModal, { AssessmentQuestion } from './AssessmentModal'
import { logger } from '../lib/logger'

export default function ProgressDashboard() {
  const [showPostAssessment, setShowPostAssessment] = useState(false)
  const [assessmentQuestions, setAssessmentQuestions] = useState<AssessmentQuestion[]>([])
  
  const { data: userProfile, isLoading: profileLoading } = trpc.profile.getProfile.useQuery()
  const { data: stats, isLoading: statsLoading } = trpc.stats.getUserStats.useQuery(undefined, {
    refetchOnWindowFocus: true, // Refetch when user returns to the page
    refetchOnMount: true, // Always refetch when component mounts to get latest stats
  })
  const { data: languageProgress, isLoading: languageProgressLoading } = trpc.profile.getLanguageProgress.useQuery()
  const { data: eligibility, isLoading: eligibilityLoading } = trpc.assessment.checkPostAssessmentEligibility.useQuery()
  const { data: assessments, isLoading: assessmentsLoading } = trpc.assessment.getAssessments.useQuery()
  
  const getQuestionsMutation = trpc.assessment.getQuestions.useMutation()
  const submitAssessmentMutation = trpc.assessment.submitAssessment.useMutation()

  // Show loading only if critical data is still loading
  const isLoading = profileLoading || statsLoading
  
  // OPTIMIZATION: Memoize assessment calculations
  // Must be called before early return to follow React Hooks rules
  // Cast to simple type to avoid deep type recursion
  const assessmentsArray = useMemo(() => {
    if (!assessments || !Array.isArray(assessments)) return []
    return assessments as unknown as Array<{ 
      type: string
      score?: number
      totalQuestions?: number
      completedAt?: Date | string
      confidence?: number
    }>
  }, [assessments])
  
  const preAssessmentData = useMemo(() => {
    const pre = assessmentsArray.find((a) => a.type === 'pre')
    if (!pre) return null
    return {
      score: pre.score ?? 0,
      totalQuestions: pre.totalQuestions ?? 0,
      completedAt: pre.completedAt,
      confidence: pre.confidence ?? 0,
    }
  }, [assessmentsArray])
  
  const postAssessmentData = useMemo(() => {
    const post = assessmentsArray.find((a) => a.type === 'post')
    if (!post) return null
    return {
      score: post.score ?? 0,
      totalQuestions: post.totalQuestions ?? 0,
      completedAt: post.completedAt,
      confidence: post.confidence ?? 0,
    }
  }, [assessmentsArray])
  
  // Keep Assessment types for compatibility, but use simple data objects for calculations
  // Don't create Assessment objects to avoid deep type recursion - use data objects instead
  const preAssessment = preAssessmentData ? true : false
  const postAssessment = postAssessmentData ? true : false
  
  const improvement = useMemo((): number | null => {
    if (!postAssessmentData || !preAssessmentData) return null
    return postAssessmentData.score - preAssessmentData.score
  }, [postAssessmentData, preAssessmentData])

  // OPTIMIZATION: Memoize days calculation
  const daysSinceRegistration = useMemo(() => {
    if (!userProfile?.createdAt) return 0
    return Math.floor((new Date().getTime() - new Date(userProfile.createdAt).getTime()) / (1000 * 60 * 60 * 24))
  }, [userProfile?.createdAt])
  
  if (isLoading || !userProfile || !stats) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const handleTakePostAssessment = async () => {
    try {
      const questions = await getQuestionsMutation.mutateAsync({
        type: 'post',
        language: userProfile?.primaryLanguage || undefined,
      })
      setAssessmentQuestions(questions as unknown as AssessmentQuestion[])
      setShowPostAssessment(true)
    } catch (error) {
      logger.error('Error loading assessment questions', userProfile?.id, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
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
      // Refresh page to show updated results
      window.location.reload()
    } catch (error) {
      console.error('Error submitting assessment:', error)
    }
  }

  return (
    <>
      {/* Post-Assessment Modal */}
      {showPostAssessment && assessmentQuestions.length > 0 && (
        <AssessmentModal
          isOpen={showPostAssessment}
          onClose={() => setShowPostAssessment(false)}
          onSubmit={handleAssessmentSubmit}
          type="post"
          questions={assessmentQuestions}
          language={userProfile?.primaryLanguage ?? undefined}
        />
      )}
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Your Learning Progress</h2>
        <p className="text-white/70 text-sm mt-0.5">
          Track your improvement and achievements
        </p>
      </div>

      {/* Assessment Cards */}
      <div className="space-y-3">
        {/* Pre-Assessment - Compact Badge */}
        {preAssessmentData && (
          <div className="glass rounded-lg shadow p-2.5 border border-blue-500/30 bg-gradient-to-r from-blue-900/20 to-transparent">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">Pre-Assessment</span>
                  <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full font-medium">
                    {preAssessmentData.score}/{preAssessmentData.totalQuestions}
                  </span>
                  <span className="text-xs text-white/60">
                    {preAssessmentData.completedAt ? new Date(preAssessmentData.completedAt).toLocaleDateString() : 'N/A'}
                  </span>
                  <span className="text-xs text-white/50">
                    Confidence: {preAssessmentData.confidence}/5
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Post-Assessment */}
        <div className={`glass rounded-lg shadow-lg p-4 ${
          eligibility && eligibility.isEligible && !postAssessmentData 
            ? 'border-2 border-green-500/50 bg-gradient-to-br from-green-900/20 to-blue-900/20' 
            : 'border border-blue-500/20'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-semibold text-white">Post-Assessment</h3>
            {eligibility && eligibility.isEligible && !postAssessmentData && (
              <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full animate-pulse">
                READY!
              </span>
            )}
          </div>
          {postAssessmentData ? (
            <div>
              <div className="text-2xl font-bold text-green-600 mb-1">
                {postAssessmentData.score}/{postAssessmentData.totalQuestions}
              </div>
              <p className="text-xs text-white/70">
                Completed {postAssessmentData.completedAt ? new Date(postAssessmentData.completedAt).toLocaleDateString() : 'N/A'}
              </p>
              {improvement !== null && (
                <p className={`text-xs mt-1 ${improvement >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {improvement >= 0 ? '+' : ''}{improvement} point{improvement !== 1 ? 's' : ''} improvement
                </p>
              )}
            </div>
          ) : eligibility && eligibility.isEligible ? (
            <div>
              <p className="text-green-400 font-medium mb-2 text-sm">🎉 You&apos;re ready to take the post-assessment!</p>
              <button 
                onClick={handleTakePostAssessment}
                className="w-full px-3 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 font-medium text-sm transition-all shadow-lg hover:shadow-green-500/50"
              >
                Take Post-Assessment →
              </button>
            </div>
          ) : (
            <div>
              <p className="text-white/80 font-medium mb-2 text-sm">
                {eligibility ? getPostAssessmentMessage(eligibility) : 'Loading requirements...'}
              </p>
              {eligibility ? (
                <>
                  {/* Overall Progress */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-medium text-white">Overall Progress</span>
                      <span className="text-xs text-white/70">{eligibility.progressPercentage}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${eligibility.progressPercentage}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Individual Requirements */}
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between mb-1 text-white/80">
                        <span>Days Active:</span>
                        <span className="font-medium">
                          {eligibility.daysSinceRegistration}/{eligibility.minDaysRequired}
                          {eligibility.daysSinceRegistration >= eligibility.minDaysRequired && ' ✓'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            eligibility.daysSinceRegistration >= eligibility.minDaysRequired
                              ? 'bg-green-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.min((eligibility.daysSinceRegistration / eligibility.minDaysRequired) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1 text-white/80">
                        <span>Questions Asked:</span>
                        <span className="font-medium">
                          {eligibility.questionsAsked}/{eligibility.minQuestionsRequired}
                          {eligibility.questionsAsked >= eligibility.minQuestionsRequired && ' ✓'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            eligibility.questionsAsked >= eligibility.minQuestionsRequired
                              ? 'bg-green-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.min((eligibility.questionsAsked / eligibility.minQuestionsRequired) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-white/80">Tasks Completed:</span>
                        <span className="font-medium text-white">
                          {eligibility.tasksCompleted}/{eligibility.minTasksRequired}
                          {eligibility.tasksCompleted >= eligibility.minTasksRequired && ' ✓'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            eligibility.tasksCompleted >= eligibility.minTasksRequired
                              ? 'bg-green-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.min((eligibility.tasksCompleted / eligibility.minTasksRequired) * 100, 100)}%` }}
                        />
                      </div>
                      {eligibility.tasksCompleted < eligibility.minTasksRequired && (
                        <Link
                          href="/tasks"
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xs font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-blue-500/50 hover:scale-105"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                          <span>Complete Tasks</span>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-white/60 text-sm mt-2">Loading eligibility...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass rounded-lg shadow p-3">
          <p className="text-xs text-white/70 mb-1">Questions Asked</p>
          <p className="text-xl font-bold text-white">{stats.questionsAsked}</p>
        </div>
        <div className="glass rounded-lg shadow p-3">
          <p className="text-xs text-white/70 mb-1">Tasks Completed</p>
          <p className="text-xl font-bold text-white">{stats.tasksCompleted}</p>
        </div>
        <div className="glass rounded-lg shadow p-3">
          <p className="text-xs text-white/70 mb-1">Days Active</p>
          <p className="text-xl font-bold text-white">{daysSinceRegistration}</p>
        </div>
        <div className="glass rounded-lg shadow p-3">
          <p className="text-xs text-white/70 mb-1">Avg Response Time</p>
          <p className="text-xl font-bold text-white">
            {stats.avgResponseTime ? `${stats.avgResponseTime.toFixed(1)}s` : 'N/A'}
          </p>
        </div>
      </div>

      {/* Language Progress */}
      {userProfile?.preferredLanguages && userProfile.preferredLanguages.length > 0 && (
        <div className="glass rounded-lg shadow p-4">
          <h3 className="text-base font-semibold text-white mb-3">Language Progress</h3>
          <div className="space-y-3">
            {userProfile.preferredLanguages.map(preferredLang => {
              // Find progress for this language
              const langProgress = languageProgress?.find(
                lp => lp.language.toLowerCase() === preferredLang.toLowerCase()
              )
              
              const questionsAsked = langProgress?.questionsAsked || 0
              const tasksCompleted = langProgress?.tasksCompleted || 0
              const totalActivity = questionsAsked + tasksCompleted
              const progress = Math.min((totalActivity / 20) * 100, 100)
              const isPrimary = userProfile.primaryLanguage?.toLowerCase() === preferredLang.toLowerCase()
              
              return (
                <div key={preferredLang}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white capitalize">{preferredLang}</span>
                      {isPrimary && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full font-medium">
                          Primary
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-white/70">
                      {questionsAsked} questions • {tasksCompleted} tasks
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Improvement Score */}
      {stats.improvementScore !== null && (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-4 text-white">
          <h3 className="text-base font-semibold mb-1">Overall Improvement</h3>
          <p className="text-2xl font-bold">
            {stats.improvementScore > 0 ? '+' : ''}{stats.improvementScore.toFixed(1)}%
          </p>
          <p className="text-blue-100 text-sm mt-1">
            Based on your pre and post-assessment comparison
          </p>
        </div>
      )}
    </div>
    </>
  )
}

