'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

interface AssessmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (answers: AssessmentAnswer[], confidence: number) => void
  type: 'pre' | 'post'
  questions: AssessmentQuestion[]
  language?: string
}

export interface AssessmentQuestion {
  id: string
  question: string
  type: 'multiple_choice' | 'code_snippet' | 'conceptual'
  options?: string[]
  correctAnswer: string
  category: string
  difficulty: string
  explanation?: string
}

export interface AssessmentAnswer {
  questionId: string
  answer: string
  isCorrect: boolean
}

export default function AssessmentModal({
  isOpen,
  onClose,
  onSubmit,
  type,
  questions,
  language
}: AssessmentModalProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [confidence, setConfidence] = useState(3)
  const [timeStarted, setTimeStarted] = useState<Date | null>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeStarted(new Date())
      setCurrentQuestion(0)
      setAnswers({})
      setConfidence(3)
    }
  }, [isOpen])

  if (!isOpen || questions.length === 0) return null

  // OPTIMIZATION: Memoize current question and progress
  const question = useMemo(() => questions[currentQuestion], [questions, currentQuestion])
  const progress = useMemo(() => 
    ((currentQuestion + 1) / questions.length) * 100,
    [currentQuestion, questions.length]
  )

  const handleAnswer = useCallback((answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [question.id]: answer
    }))
  }, [question.id])

  const handleNext = useCallback(() => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      // Calculate results
      const assessmentAnswers: AssessmentAnswer[] = questions.map(q => ({
        questionId: q.id,
        answer: answers[q.id] || '',
        isCorrect: answers[q.id] === q.correctAnswer
      }))
      onSubmit(assessmentAnswers, confidence)
    }
  }, [currentQuestion, questions.length, questions, answers, confidence, onSubmit])

  const handlePrevious = useCallback(() => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }, [currentQuestion])

  // OPTIMIZATION: Memoize computed values
  const isAnswered = useMemo(() => 
    answers[question.id] !== undefined,
    [answers, question.id]
  )
  const canProceed = useMemo(() => 
    isAnswered || question.type === 'conceptual',
    [isAnswered, question.type]
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-gray-900">
              {type === 'pre' ? 'Pre-Assessment' : 'Post-Assessment'}
              {language && ` - ${language}`}
            </h2>
            <span className="text-sm text-gray-500">
              Question {currentQuestion + 1} of {questions.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800">
                {question.category}
              </span>
              <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-800">
                {question.difficulty}
              </span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {question.question}
            </h3>

            {question.type === 'multiple_choice' && question.options && (
              <div className="space-y-3">
                {question.options.map((option, index) => (
                  <label
                    key={index}
                    className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      answers[question.id] === option
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option}
                      checked={answers[question.id] === option}
                      onChange={(e) => handleAnswer(e.target.value)}
                      className="mt-1 w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-700 flex-1">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {question.type === 'code_snippet' && (
              <div className="space-y-3">
                <textarea
                  value={answers[question.id] || ''}
                  onChange={(e) => handleAnswer(e.target.value)}
                  placeholder="Enter your code answer here..."
                  className="w-full h-32 p-3 border-2 border-gray-200 rounded-lg font-mono text-sm text-gray-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            )}

            {question.type === 'conceptual' && (
              <div className="space-y-3">
                <textarea
                  value={answers[question.id] || ''}
                  onChange={(e) => handleAnswer(e.target.value)}
                  placeholder="Enter your answer here..."
                  className="w-full h-32 p-3 border-2 border-gray-200 rounded-lg text-gray-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Confidence rating (only on last question) */}
          {currentQuestion === questions.length - 1 && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                How confident are you with your answers overall?
              </label>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">Not confident</span>
                <div className="flex space-x-2">
                  {[1, 2, 3, 4, 5].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setConfidence(num)}
                      className={`w-12 h-12 rounded-full border-2 transition-all ${
                        confidence === num
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <span className="text-sm text-gray-500">Very confident</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceed}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {currentQuestion === questions.length - 1 ? 'Submit' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

