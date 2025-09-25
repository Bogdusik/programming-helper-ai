'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar'
import { trpc } from '../../lib/trpc-client'

export default function StatsPage() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)
  
  // Load user statistics
  const { data: stats, isLoading: statsLoading, error: statsError } = trpc.stats.getUserStats.useQuery()

  useEffect(() => {
    setIsMounted(true)
    if (isLoaded && !isSignedIn) {
      router.push('/')
    }
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded || statsLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-4 text-white/80">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return null
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
      
      {/* Animated background elements - only render on client */}
      {isMounted && (
        <div className="absolute inset-0">
          <div className="absolute top-20 left-1/4 w-2 h-2 bg-blue-400 rounded-full animate-pulse opacity-60"></div>
          <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-purple-400 rounded-full animate-pulse opacity-40" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-1/4 left-1/2 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse opacity-50" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-cyan-400 rounded-full animate-pulse opacity-30" style={{ animationDelay: '3s' }}></div>
          <div className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-pink-400 rounded-full animate-pulse opacity-40" style={{ animationDelay: '4s' }}></div>
        </div>
      )}

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
      
      <div className="relative pt-20 pb-8 min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">Your Programming Journey</h1>
            <p className="text-white/70 text-lg">Track your progress with AI assistance</p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 mb-12">
            <div className="glass rounded-2xl p-8 card-hover text-center">
              <div className="inline-flex items-center justify-center p-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl shadow-lg mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold gradient-text mb-2">{stats?.questionsAsked || 0}</h3>
              <p className="text-white/60">Questions Asked</p>
            </div>

            <div className="glass rounded-2xl p-8 card-hover text-center">
              <div className="inline-flex items-center justify-center p-4 bg-gradient-to-r from-green-500 to-green-600 rounded-2xl shadow-lg mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold gradient-text mb-2">{stats?.avgResponseTime ? `${stats.avgResponseTime.toFixed(1)}s` : '0s'}</h3>
              <p className="text-white/60">Avg Response Time</p>
            </div>

            <div className="glass rounded-2xl p-8 card-hover text-center">
              <div className="inline-flex items-center justify-center p-4 bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl shadow-lg mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold gradient-text mb-2">{stats?.mostFrequentResponseType || 'None'}</h3>
              <p className="text-white/60">Most Frequent Type</p>
            </div>
          </div>

          <div className="glass rounded-3xl p-8">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-4">Activity Summary</h3>
              <p className="text-white/70 text-lg leading-relaxed max-w-2xl mx-auto">
                You've asked <span className="gradient-text font-semibold">{stats?.questionsAsked || 0}</span> questions and received helpful AI assistance. 
                Keep up the great work and continue your programming journey!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Animated border */}
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse"></div>
    </div>
  )
}