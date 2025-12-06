'use client'

import { useState, useEffect, useCallback } from 'react'
import TaskDescription from './TaskDescription'

interface Example {
  input: string | Record<string, any>
  output: string | any
  explanation?: string
}

interface TaskCodeEditorProps {
  title: string
  description: string
  language: string
  difficulty: string
  category: string
  hints?: string[]
  starterCode?: string | null
  examples?: Example[] | null
  constraints?: string[] | null
  testCases?: any
  value: string
  onChange: (value: string) => void
  placeholder?: string
  height?: string
  onRunTests?: (code: string) => Promise<{ passed: number; failed: number; results: any[] }>
}

export default function TaskCodeEditor({
  title,
  description,
  language,
  difficulty,
  category,
  hints,
  starterCode,
  examples,
  constraints,
  testCases,
  value,
  onChange,
  placeholder = 'Write your solution here...',
  height = '100%',
  onRunTests,
}: TaskCodeEditorProps) {
  const [isResizing, setIsResizing] = useState(false)
  const [leftWidth, setLeftWidth] = useState(50) // Percentage
  const [testResults, setTestResults] = useState<{
    passed: number
    failed: number
    results: any[]
  } | null>(null)
  const [isRunningTests, setIsRunningTests] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const container = document.getElementById('task-code-editor-container')
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

  const handleRunTests = async () => {
    if (!onRunTests || !value.trim()) return
    
    setIsRunningTests(true)
    setTestResults(null)
    
    try {
      const results = await onRunTests(value)
      setTestResults(results)
    } catch (error) {
      console.error('Error running tests:', error)
      setTestResults({
        passed: 0,
        failed: 1,
        results: [{ passed: false, error: 'Failed to run tests' }],
      })
    } finally {
      setIsRunningTests(false)
    }
  }

  return (
    <div 
      id="task-code-editor-container"
      className="flex border border-white/20 rounded-lg overflow-hidden bg-white/10 backdrop-blur-lg shadow-sm h-full"
      style={{ maxHeight: height === '100%' ? '600px' : undefined, height: height === '100%' ? '100%' : height }}
    >
      {/* Left side - Task Description */}
      <div 
        className="overflow-y-auto bg-gray-900/50 border-r border-white/20"
        style={{ width: `${leftWidth}%` }}
      >
        <TaskDescription
          title={title}
          description={description}
          language={language}
          difficulty={difficulty}
          category={category}
          hints={hints}
          starterCode={starterCode}
          examples={examples}
          constraints={constraints}
        />
      </div>

      {/* Resizer */}
      <div
        className="w-1 bg-white/20 hover:bg-blue-500/50 cursor-col-resize transition-colors flex-shrink-0"
        onMouseDown={handleMouseDown}
        style={{ minWidth: '4px' }}
      >
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-0.5 h-8 bg-white/40 rounded"></div>
        </div>
      </div>

      {/* Right side - Code Editor */}
      <div 
        className="flex-1 flex flex-col overflow-hidden bg-gray-900/30"
        style={{ width: `${100 - leftWidth}%` }}
      >
        {language && (
          <div className="px-3 py-2 bg-gray-800/50 border-b border-white/20 flex items-center justify-between flex-shrink-0">
            <span className="text-xs font-medium text-gray-300 capitalize">
              {language}
            </span>
            {onRunTests && (
              <button
                onClick={handleRunTests}
                disabled={!value.trim() || isRunningTests}
                className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                {isRunningTests ? 'Running...' : 'Run Tests'}
              </button>
            )}
          </div>
        )}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 w-full p-3 sm:p-4 border-0 resize-none focus:outline-none min-h-0 font-mono text-sm text-gray-200 bg-gray-900/50"
          style={{ 
            fontFamily: 'Monaco, "Courier New", monospace',
            lineHeight: '1.5',
            tabSize: 2
          }}
        />
        {testResults && (
          <div className="border-t border-white/20 bg-gray-900/70 p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">Test Results</span>
              <span className={`text-xs font-medium ${
                testResults.failed === 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {testResults.passed} passed, {testResults.failed} failed
              </span>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {testResults.results.map((result, index) => (
                <div
                  key={index}
                  className={`text-xs p-2 rounded ${
                    result.passed
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  Test {index + 1}: {result.passed ? '✓ Passed' : `✗ Failed${result.error ? ` - ${result.error}` : ''}`}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

