'use client'

import { useState, useEffect, useCallback } from 'react'

interface CodeEditorProps {
  question: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  language?: string
  isCode?: boolean // true for code_snippet, false for conceptual
  height?: string // Custom height for the editor
}

export default function CodeEditor({
  question,
  value,
  onChange,
  placeholder = 'Enter your answer here...',
  language,
  isCode = true,
  height = 'calc(100vh - 300px)'
}: CodeEditorProps) {
  const [isResizing, setIsResizing] = useState(false)
  const [leftWidth, setLeftWidth] = useState(50) // Percentage

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const container = document.getElementById('code-editor-container')
    if (!container) return
    
    const containerRect = container.getBoundingClientRect()
    const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100
    
    // Limit between 30% and 70%
    const clampedWidth = Math.max(30, Math.min(70, newLeftWidth))
    setLeftWidth(clampedWidth)
  }, [])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  // Add event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  return (
    <div 
      id="code-editor-container"
      className="flex border border-gray-300 rounded-lg overflow-hidden bg-white"
      style={{ height }}
    >
      {/* Left side - Question/Description */}
      <div 
        className="overflow-y-auto p-6 bg-gray-50 border-r border-gray-300"
        style={{ width: `${leftWidth}%` }}
      >
        <div className="prose prose-sm max-w-none">
          <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
            {question}
          </div>
        </div>
      </div>

      {/* Resizer */}
      <div
        className="w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize transition-colors flex-shrink-0"
        onMouseDown={handleMouseDown}
        style={{ minWidth: '4px' }}
      >
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-0.5 h-8 bg-gray-400 rounded"></div>
        </div>
      </div>

      {/* Right side - Code Editor */}
      <div 
        className="flex-1 flex flex-col overflow-hidden"
        style={{ width: `${100 - leftWidth}%` }}
      >
        {language && (
          <div className="px-4 py-2 bg-gray-100 border-b border-gray-300 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {language}
            </span>
          </div>
        )}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 w-full p-4 border-0 resize-none focus:outline-none ${
            isCode ? 'font-mono text-sm' : 'text-base'
          } text-gray-900 bg-white`}
          style={{ 
            fontFamily: isCode ? 'Monaco, "Courier New", monospace' : 'inherit',
            lineHeight: isCode ? '1.5' : '1.6'
          }}
        />
      </div>
    </div>
  )
}

