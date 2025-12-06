'use client'

import { useState } from 'react'
import Navbar from '../../components/Navbar'
import MinimalBackground from '../../components/MinimalBackground'

export default function MigratePage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string>('')
  const [details, setDetails] = useState<Record<string, unknown> | null>(null)

  const handleMigrate = async () => {
    setStatus('loading')
    setMessage('Applying migration...')
    setDetails(null)

    try {
      const response = await fetch('/api/migrate', {
        method: 'GET',
      })

      const data = await response.json()
      setDetails(data)

      if (response.ok && data.success) {
        setStatus('success')
        setMessage(data.message || 'Migration applied successfully!')
      } else {
        setStatus('error')
        setMessage(data.error || data.message || 'Failed to apply migration')
      }
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Failed to apply migration')
      setDetails({ error: String(error) })
    }
  }

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      <Navbar />
      <MinimalBackground />
      
      <div className="container mx-auto px-4 max-w-4xl flex-1 flex flex-col justify-center py-12">
        <div className="bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 p-8">
          <h1 className="text-3xl font-bold text-white mb-6">Database Migration</h1>
          
          <div className="mb-6">
            <p className="text-white/80 mb-4">
              This page will apply the database migration to add <code className="bg-gray-800 px-2 py-1 rounded">examples</code> and <code className="bg-gray-800 px-2 py-1 rounded">constraints</code> columns to the <code className="bg-gray-800 px-2 py-1 rounded">programming_tasks</code> table.
            </p>
            <p className="text-white/60 text-sm">
              This migration is safe to run multiple times - it will only add columns if they don&apos;t already exist.
            </p>
          </div>

          <button
            onClick={handleMigrate}
            disabled={status === 'loading'}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors mb-6"
          >
            {status === 'loading' ? 'Applying Migration...' : 'Apply Migration'}
          </button>

          {status !== 'idle' && (
            <div className={`p-4 rounded-lg ${
              status === 'success' ? 'bg-green-500/20 border border-green-500/50' :
              status === 'error' ? 'bg-red-500/20 border border-red-500/50' :
              'bg-blue-500/20 border border-blue-500/50'
            }`}>
              <div className={`font-medium mb-2 ${
                status === 'success' ? 'text-green-300' :
                status === 'error' ? 'text-red-300' :
                'text-blue-300'
              }`}>
                {status === 'success' ? '✓ Success' : status === 'error' ? '✗ Error' : '⏳ Processing'}
              </div>
              <div className="text-white/80 text-sm mb-2">{message}</div>
              {details && (
                <details className="mt-2">
                  <summary className="text-white/60 text-xs cursor-pointer hover:text-white/80">
                    Show details
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-900/50 p-3 rounded overflow-auto text-white/70">
                    {JSON.stringify(details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-white/20">
            <h2 className="text-lg font-semibold text-white mb-3">Alternative Methods</h2>
            <div className="space-y-2 text-sm text-white/70">
              <p><strong>1. Via API endpoint:</strong></p>
              <code className="block bg-gray-900/50 p-2 rounded text-xs text-green-300 mb-2">
                GET /api/migrate
              </code>
              
              <p className="mt-4"><strong>2. Via curl:</strong></p>
              <code className="block bg-gray-900/50 p-2 rounded text-xs text-green-300 mb-2">
                curl https://programming-helper-ai.vercel.app/api/migrate
              </code>
              
              <p className="mt-4"><strong>3. Direct SQL (if you have database access):</strong></p>
              <code className="block bg-gray-900/50 p-2 rounded text-xs text-green-300">
                ALTER TABLE &quot;programming_tasks&quot; <br/>
                ADD COLUMN IF NOT EXISTS &quot;examples&quot; JSONB,<br/>
                ADD COLUMN IF NOT EXISTS &quot;constraints&quot; TEXT[] DEFAULT ARRAY[]::TEXT[];
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

