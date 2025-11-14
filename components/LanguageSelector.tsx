'use client'

import { useState, useEffect, useRef } from 'react'

interface LanguageSelectorProps {
  selectedLanguages: string[]
  primaryLanguage?: string
  onLanguagesChange: (languages: string[], primary?: string) => void
  compact?: boolean
}

interface Language {
  value: string
  label: string
  icon: string
  gradient: string
  borderColor: string
}

const PROGRAMMING_LANGUAGES: Language[] = [
  { value: 'python', label: 'Python', icon: '🐍', gradient: 'from-yellow-400 to-yellow-600', borderColor: 'border-yellow-400' },
  { value: 'javascript', label: 'JavaScript', icon: '📜', gradient: 'from-yellow-400 to-yellow-600', borderColor: 'border-yellow-400' },
  { value: 'typescript', label: 'TypeScript', icon: '📘', gradient: 'from-blue-400 to-blue-600', borderColor: 'border-blue-400' },
  { value: 'java', label: 'Java', icon: '☕', gradient: 'from-orange-400 to-orange-600', borderColor: 'border-orange-400' },
  { value: 'cpp', label: 'C++', icon: '⚡', gradient: 'from-blue-500 to-blue-700', borderColor: 'border-blue-500' },
  { value: 'csharp', label: 'C#', icon: '🎵', gradient: 'from-purple-400 to-purple-600', borderColor: 'border-purple-400' },
  { value: 'rust', label: 'Rust', icon: '🦀', gradient: 'from-orange-500 to-orange-700', borderColor: 'border-orange-500' },
  { value: 'go', label: 'Go', icon: '🐹', gradient: 'from-cyan-400 to-cyan-600', borderColor: 'border-cyan-400' },
  { value: 'ruby', label: 'Ruby', icon: '💎', gradient: 'from-red-400 to-red-600', borderColor: 'border-red-400' },
  { value: 'php', label: 'PHP', icon: '🐘', gradient: 'from-indigo-400 to-indigo-600', borderColor: 'border-indigo-400' },
  { value: 'swift', label: 'Swift', icon: '🐦', gradient: 'from-orange-400 to-orange-600', borderColor: 'border-orange-400' },
  { value: 'kotlin', label: 'Kotlin', icon: '🔷', gradient: 'from-purple-500 to-purple-700', borderColor: 'border-purple-500' },
  { value: 'dart', label: 'Dart', icon: '🎯', gradient: 'from-blue-400 to-blue-600', borderColor: 'border-blue-400' },
  { value: 'scala', label: 'Scala', icon: '🔴', gradient: 'from-red-500 to-red-700', borderColor: 'border-red-500' },
  { value: 'r', label: 'R', icon: '📊', gradient: 'from-blue-500 to-blue-700', borderColor: 'border-blue-500' },
  { value: 'sql', label: 'SQL', icon: '🗄️', gradient: 'from-gray-400 to-gray-600', borderColor: 'border-gray-400' },
]

export default function LanguageSelector({
  selectedLanguages,
  primaryLanguage,
  onLanguagesChange,
  compact = false
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [localPrimaryLanguage, setLocalPrimaryLanguage] = useState(primaryLanguage)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Update local state when prop changes
  useEffect(() => {
    setLocalPrimaryLanguage(primaryLanguage)
  }, [primaryLanguage])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // Focus search input when dropdown opens
      setTimeout(() => inputRef.current?.focus(), 100)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Filter languages based on search query
  const filteredLanguages = PROGRAMMING_LANGUAGES.filter(lang =>
    lang.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.value.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleLanguage = (lang: string) => {
    const newLanguages = selectedLanguages.includes(lang)
      ? selectedLanguages.filter(l => l !== lang)
      : [...selectedLanguages, lang]
    
    // If primary language was removed, clear it or set first remaining
    let newPrimary = primaryLanguage
    if (primaryLanguage === lang && newLanguages.length > 0) {
      newPrimary = newLanguages[0]
    } else if (primaryLanguage === lang) {
      newPrimary = undefined
    } else if (newLanguages.length === 1 && !primaryLanguage) {
      // Auto-set primary if only one language selected
      newPrimary = newLanguages[0]
    }
    
    // Update local state optimistically
    setLocalPrimaryLanguage(newPrimary)
    onLanguagesChange(newLanguages, newPrimary)
  }

  const setPrimary = (lang: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    // Optimistically update local state for immediate UI feedback
    setLocalPrimaryLanguage(lang)
    onLanguagesChange(selectedLanguages, lang)
  }

  if (compact) {
    const primaryLang = PROGRAMMING_LANGUAGES.find(l => l.value === (localPrimaryLanguage || primaryLanguage))
    
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-200 text-white shadow-lg hover:shadow-xl"
        >
          <span className="text-base font-medium">
            {primaryLang ? (
              <span className="flex items-center space-x-2">
                <span className="text-lg">{primaryLang.icon}</span>
                <span>{primaryLang.label}</span>
              </span>
            ) : selectedLanguages.length > 0 ? (
              <span className="flex items-center space-x-2">
                <span className="text-sm bg-blue-500/20 px-2 py-0.5 rounded-full">{selectedLanguages.length}</span>
                <span>selected</span>
              </span>
            ) : (
              'Select Language'
            )}
          </span>
          <svg 
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div 
            className="absolute top-full mt-2 left-0 z-50 bg-slate-800/95 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl min-w-[280px] max-w-md overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="p-3 border-b border-white/10">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search languages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
              </div>
            </div>

            {/* Language List */}
            <div className="max-h-64 overflow-y-auto p-2">
              {filteredLanguages.length === 0 ? (
                <div className="text-center py-8 text-white/50">
                  <p>No languages found</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredLanguages.map(lang => {
                    const isSelected = selectedLanguages.includes(lang.value)
                    const isPrimary = (localPrimaryLanguage || primaryLanguage) === lang.value
                    
                    return (
                      <div
                        key={lang.value}
                        className={`group flex items-center justify-between p-2.5 rounded-lg transition-all duration-150 ${
                          isSelected 
                            ? isPrimary 
                              ? `bg-gradient-to-r ${lang.gradient} text-white` 
                              : 'bg-blue-500/20 border border-blue-400/30 text-white'
                            : 'hover:bg-white/10 text-white/80'
                        }`}
                      >
                        <label className="flex items-center space-x-3 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleLanguage(lang.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-400"
                          />
                          <span className="text-lg">{lang.icon}</span>
                          <span className="text-sm font-medium">{lang.label}</span>
                          {isPrimary && (
                            <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">Primary</span>
                          )}
                        </label>
                        {isSelected && selectedLanguages.length > 1 && !isPrimary && (
                          <button
                            type="button"
                            onClick={(e) => setPrimary(lang.value, e)}
                            className="ml-2 px-2.5 py-1 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-white"
                          >
                            Set Primary
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-white">
        Programming Languages
      </label>
      
      {/* Search Input */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search languages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm"
        />
      </div>

      {/* Language Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filteredLanguages.map(lang => {
          const isSelected = selectedLanguages.includes(lang.value)
          const isPrimary = primaryLanguage === lang.value
          
          return (
            <button
              key={lang.value}
              type="button"
              onClick={() => toggleLanguage(lang.value)}
              className={`relative px-4 py-3 rounded-xl border-2 transition-all duration-200 transform hover:scale-105 ${
                isSelected
                  ? isPrimary
                    ? `bg-gradient-to-br ${lang.gradient} ${lang.borderColor} text-white shadow-lg`
                    : `bg-blue-500/20 ${lang.borderColor} border-2 text-white`
                  : 'border-white/20 bg-white/5 text-white/70 hover:bg-white/10 hover:border-white/30'
              }`}
            >
              <div className="flex flex-col items-center space-y-1.5">
                <span className="text-2xl">{lang.icon}</span>
                <span className="text-sm font-medium">{lang.label}</span>
                {isPrimary && selectedLanguages.length > 1 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {filteredLanguages.length === 0 && (
        <div className="text-center py-8 text-white/50">
          <p>No languages found matching "{searchQuery}"</p>
        </div>
      )}

      {selectedLanguages.length > 1 && (
        <p className="text-sm text-white/60">
          💡 Click on a selected language to set it as primary
        </p>
      )}
    </div>
  )
}

