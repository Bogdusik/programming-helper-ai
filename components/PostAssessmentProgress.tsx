'use client'

import { trpc } from '../lib/trpc-client'
import { getPostAssessmentMessage } from '../lib/assessment-utils'
import Link from 'next/link'

export default function PostAssessmentProgress() {
  const { data: eligibility, isLoading } = trpc.assessment.checkPostAssessmentEligibility.useQuery()
  const { data: assessments } = trpc.assessment.getAssessments.useQuery()
  
  // Use explicit type casting to avoid "Type instantiation is excessively deep" error
  type SimpleAssessment = { type: string }
  const assessmentsArray = assessments as unknown as SimpleAssessment[] | undefined
  const postAssessment = assessmentsArray?.find((a) => a.type === 'post')
  
  // Don't show if already completed
  if (postAssessment) {
    return null
  }
  
  if (isLoading || !eligibility) {
    return null
  }
  
  const progressPercentage = eligibility.progressPercentage || 0
  
  return (
    <div className="glass rounded-lg shadow-lg p-6 border border-blue-500/20 bg-gradient-to-br from-blue-900/20 to-purple-900/20">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Post-Assessment Progress</h3>
          <p className="text-sm text-white/70">
            {eligibility.isEligible 
              ? "You're ready to take the post-assessment!" 
              : getPostAssessmentMessage(eligibility)}
          </p>
        </div>
        {eligibility.isEligible && (
          <Link
            href="/stats"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Take Now
          </Link>
        )}
      </div>
      
      {/* Overall Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-white">Overall Progress</span>
          <span className="text-sm text-white/70">{progressPercentage}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
      
      {/* Individual Requirements */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-white/70">Days</span>
            <span className="text-white font-medium">
              {eligibility.daysSinceRegistration}/{eligibility.minDaysRequired}
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                eligibility.daysSinceRegistration >= eligibility.minDaysRequired
                  ? 'bg-green-500'
                  : 'bg-blue-500'
              }`}
              style={{ 
                width: `${Math.min((eligibility.daysSinceRegistration / eligibility.minDaysRequired) * 100, 100)}%` 
              }}
            />
          </div>
        </div>
        
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-white/70">Questions</span>
            <span className="text-white font-medium">
              {eligibility.questionsAsked}/{eligibility.minQuestionsRequired}
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                eligibility.questionsAsked >= eligibility.minQuestionsRequired
                  ? 'bg-green-500'
                  : 'bg-blue-500'
              }`}
              style={{ 
                width: `${Math.min((eligibility.questionsAsked / eligibility.minQuestionsRequired) * 100, 100)}%` 
              }}
            />
          </div>
        </div>
        
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-white/70">Tasks</span>
            <span className="text-white font-medium">
              {eligibility.tasksCompleted}/{eligibility.minTasksRequired}
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                eligibility.tasksCompleted >= eligibility.minTasksRequired
                  ? 'bg-green-500'
                  : 'bg-blue-500'
              }`}
              style={{ 
                width: `${Math.min((eligibility.tasksCompleted / eligibility.minTasksRequired) * 100, 100)}%` 
              }}
            />
          </div>
        </div>
      </div>
      
      {eligibility.isEligible && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <Link
            href="/stats"
            className="block w-full text-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium"
          >
            Take Post-Assessment →
          </Link>
        </div>
      )}
    </div>
  )
}

