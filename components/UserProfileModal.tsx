'use client'

import { useState, useEffect } from 'react'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (data: ProfileData) => void
  isOptional?: boolean
  initialData?: ProfileData // Add initial data for editing
}

export interface ProfileData {
  experience: string
  focusAreas: string[]
  confidence: number
  aiExperience: string
  preferredLanguages: string[]
  primaryLanguage?: string
}

const EXPERIENCE_LEVELS = [
  { value: 'complete_beginner', label: 'Complete beginner (just starting)' },
  { value: 'beginner', label: 'Beginner (some basics, < 6 months)' },
  { value: 'intermediate', label: 'Intermediate (6 months - 2 years)' },
  { value: 'advanced', label: 'Advanced (2+ years, working on projects)' },
  { value: 'expert', label: 'Expert (professional developer)' },
]

const FOCUS_AREAS = [
  'Learning fundamentals',
  'Improving existing skills',
  'Preparing for interviews',
  'Working on specific projects',
  'Exploring new technologies',
]

const AI_EXPERIENCE_OPTIONS = [
  { value: 'frequent', label: 'Yes, frequently' },
  { value: 'occasional', label: 'Yes, occasionally' },
  { value: 'never', label: 'No, this is my first time' },
]

const PROGRAMMING_LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'rust', label: 'Rust' },
  { value: 'go', label: 'Go' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'dart', label: 'Dart' },
  { value: 'scala', label: 'Scala' },
  { value: 'r', label: 'R' },
  { value: 'sql', label: 'SQL' },
]

export default function UserProfileModal({ isOpen, onClose, onComplete, isOptional = false, initialData }: UserProfileModalProps) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<ProfileData>({
    experience: initialData?.experience || '',
    focusAreas: initialData?.focusAreas || [],
    confidence: initialData?.confidence || 3,
    aiExperience: initialData?.aiExperience || '',
    preferredLanguages: initialData?.preferredLanguages || [],
    primaryLanguage: initialData?.primaryLanguage,
  })
  
  // Update form data when initialData changes (for editing)
  useEffect(() => {
    if (initialData && isOpen) {
      setFormData({
        experience: initialData.experience || '',
        focusAreas: initialData.focusAreas || [],
        confidence: initialData.confidence || 3,
        aiExperience: initialData.aiExperience || '',
        preferredLanguages: initialData.preferredLanguages || [],
        primaryLanguage: initialData.primaryLanguage,
      })
    }
  }, [initialData, isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (step < 3) {
      setStep(step + 1)
    } else {
      // Validate required fields
      if (!formData.experience || !formData.aiExperience || formData.preferredLanguages.length === 0) {
        alert('Please complete all required fields')
        return
      }
      onComplete(formData)
    }
  }

  const handleSkip = () => {
    if (isOptional) {
      onClose()
    }
  }

  const toggleFocusArea = (area: string) => {
    setFormData(prev => ({
      ...prev,
      focusAreas: prev.focusAreas.includes(area)
        ? prev.focusAreas.filter(a => a !== area)
        : [...prev.focusAreas, area]
    }))
  }

  const toggleLanguage = (lang: string) => {
    setFormData(prev => {
      const newLanguages = prev.preferredLanguages.includes(lang)
        ? prev.preferredLanguages.filter(l => l !== lang)
        : [...prev.preferredLanguages, lang]
      
      // If primary language was removed, clear it
      const newPrimary = prev.primaryLanguage === lang ? undefined : prev.primaryLanguage
      
      return {
        ...prev,
        preferredLanguages: newLanguages,
        primaryLanguage: newPrimary || (newLanguages.length === 1 ? newLanguages[0] : prev.primaryLanguage)
      }
    })
  }

  const setPrimaryLanguage = (lang: string) => {
    setFormData(prev => ({
      ...prev,
      primaryLanguage: lang
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {isOptional ? 'Help us personalize your experience' : 'Complete your profile'}
          </h2>
          {isOptional && (
            <button
              onClick={handleSkip}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Step 1: Experience and Goals */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Programming Experience <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {EXPERIENCE_LEVELS.map(level => (
                    <label key={level.value} className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="experience"
                        value={level.value}
                        checked={formData.experience === level.value}
                        onChange={(e) => setFormData(prev => ({ ...prev, experience: e.target.value }))}
                        className="w-4 h-4 text-blue-600"
                        required
                      />
                      <span className="text-gray-700">{level.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What do you want to focus on? (Select all that apply)
                </label>
                <div className="space-y-2">
                  {FOCUS_AREAS.map(area => (
                    <label key={area} className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.focusAreas.includes(area)}
                        onChange={() => toggleFocusArea(area)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-gray-700">{area}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How confident are you with programming? <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500">Not confident</span>
                  <div className="flex space-x-2">
                    {[1, 2, 3, 4, 5].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, confidence: num }))}
                        className={`w-12 h-12 rounded-full border-2 transition-all ${
                          formData.confidence === num
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-300 text-gray-600 hover:border-blue-400'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <span className="text-sm text-gray-500">Very confident</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: AI Experience */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Have you used AI coding assistants before? <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {AI_EXPERIENCE_OPTIONS.map(option => (
                    <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="aiExperience"
                        value={option.value}
                        checked={formData.aiExperience === option.value}
                        onChange={(e) => setFormData(prev => ({ ...prev, aiExperience: e.target.value }))}
                        className="w-4 h-4 text-blue-600"
                        required
                      />
                      <span className="text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Languages */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select programming languages you want to learn or improve <span className="text-red-500">*</span>
                </label>
                <p className="text-sm text-gray-500 mb-4">Select at least one language to get started</p>
                <div className="grid grid-cols-2 gap-3">
                  {PROGRAMMING_LANGUAGES.map(lang => (
                    <label
                      key={lang.value}
                      className={`flex items-center space-x-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.preferredLanguages.includes(lang.value)
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.preferredLanguages.includes(lang.value)}
                        onChange={() => toggleLanguage(lang.value)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-gray-700 font-medium">{lang.label}</span>
                      {formData.preferredLanguages.includes(lang.value) && formData.preferredLanguages.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setPrimaryLanguage(lang.value)
                          }}
                          className={`ml-auto px-2 py-1 text-xs rounded ${
                            formData.primaryLanguage === lang.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {formData.primaryLanguage === lang.value ? 'Primary' : 'Set Primary'}
                        </button>
                      )}
                    </label>
                  ))}
                </div>
                {formData.preferredLanguages.length > 0 && (
                  <p className="mt-3 text-sm text-gray-600">
                    Selected: {formData.preferredLanguages.length} language(s)
                    {formData.primaryLanguage && (
                      <span className="ml-2 text-blue-600">
                        • Primary: {PROGRAMMING_LANGUAGES.find(l => l.value === formData.primaryLanguage)?.label}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Progress indicator */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex space-x-2">
              {[1, 2, 3].map(num => (
                <div
                  key={num}
                  className={`w-2 h-2 rounded-full ${
                    num <= step ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            <div className="flex space-x-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {step === 3 ? 'Complete' : 'Next'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

