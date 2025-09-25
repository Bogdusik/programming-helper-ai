'use client'

import { SignInButton, useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import AnimatedCounter from '../components/AnimatedCounter'
import { trpc } from '../lib/trpc-client'

export default function Home() {
  const { isSignedIn, isLoaded } = useUser()
  const [isMounted, setIsMounted] = useState(false)
  
  // Get real-time global statistics
  const { data: globalStats, isLoading: statsLoading, dataUpdatedAt, error: statsError } = trpc.stats.getGlobalStats.useQuery(undefined, {
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: 1000,
  })

  // Format last update time
  const getLastUpdateTime = () => {
    if (!dataUpdatedAt) return ''
    const now = new Date()
    const diff = Math.floor((now.getTime() - dataUpdatedAt) / 1000)
    
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  useEffect(() => {
    setIsMounted(true)
  }, [])

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
      
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-green-600/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center animate-fadeInUp">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-white mb-6">
              Level Up
              <br />
              <span className="gradient-text">Your Coding Skills with AI</span>
            </h1>
            <p className="text-xl text-white/80 max-w-3xl mx-auto mb-8 leading-relaxed">
              Get instant help with your programming questions. Our AI assistant guides you through code challenges, explains concepts and helps you debug issues.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {!isLoaded ? (
                <div className="animate-pulse-slow bg-white/20 h-14 w-64 rounded-full"></div>
              ) : isSignedIn ? (
                <Link 
                  href="/chat"
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all duration-200 hover:shadow-xl hover:shadow-green-500/25 hover:scale-105"
                >
                  Start Chatting
                </Link>
              ) : (
                <SignInButton mode="modal">
                  <button className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/25 hover:scale-105">
                    Get Started
                  </button>
                </SignInButton>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-16">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Our Impact in Numbers</h2>
            <p className="text-white/60">Growing community of developers</p>
            {!statsLoading && globalStats && !statsError && (
              <div className="flex items-center justify-center space-x-2 mt-4">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-white/60">
                  Live data • Updated {getLastUpdateTime()} • Refreshes every 30s
                </span>
              </div>
            )}
            {statsError && (
              <div className="flex items-center justify-center space-x-2 mt-4">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span className="text-sm text-white/60">
                  Using cached data • Some stats may be outdated
                </span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center glass rounded-2xl p-8 card-hover">
              <div className="text-4xl font-bold gradient-text mb-2">
                {statsLoading ? (
                  <div className="animate-pulse-slow bg-white/20 h-12 w-24 rounded mx-auto"></div>
                ) : statsError ? (
                  <span className="text-4xl font-bold gradient-text">0+</span>
                ) : (
                  <>
                    <AnimatedCounter 
                      value={globalStats?.activeUsers || 0} 
                      className="text-4xl font-bold gradient-text"
                    />
                    <span className="text-4xl font-bold gradient-text">+</span>
                  </>
                )}
              </div>
              <div className="text-white/60">Active Users</div>
            </div>
            <div className="text-center glass rounded-2xl p-8 card-hover">
              <div className="text-4xl font-bold gradient-text mb-2">
                {statsLoading ? (
                  <div className="animate-pulse-slow bg-white/20 h-12 w-24 rounded mx-auto"></div>
                ) : statsError ? (
                  <span className="text-4xl font-bold gradient-text">0+</span>
                ) : (
                  <>
                    <AnimatedCounter 
                      value={globalStats?.totalQuestions || 0} 
                      className="text-4xl font-bold gradient-text"
                    />
                    <span className="text-4xl font-bold gradient-text">+</span>
                  </>
                )}
              </div>
              <div className="text-white/60">Questions Asked</div>
            </div>
            <div className="text-center glass rounded-2xl p-8 card-hover">
              <div className="text-4xl font-bold gradient-text mb-2">
                {statsLoading ? (
                  <div className="animate-pulse-slow bg-white/20 h-12 w-24 rounded mx-auto"></div>
                ) : statsError ? (
                  <span className="text-4xl font-bold gradient-text">0+</span>
                ) : (
                  <>
                    <AnimatedCounter 
                      value={globalStats?.totalSolutions || 0} 
                      className="text-4xl font-bold gradient-text"
                    />
                    <span className="text-4xl font-bold gradient-text">+</span>
                  </>
                )}
              </div>
              <div className="text-white/60">Solutions Provided</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-16">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Our Features</h2>
            <p className="text-white/60">Everything you need to become a better developer</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass rounded-2xl p-8 card-hover">
              <div className="inline-flex items-center justify-center p-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl shadow-lg mb-6">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Code Assistance</h3>
              <p className="text-white/70 leading-relaxed">
                Get help with coding problems, syntax questions, and implementation guidance from our advanced AI.
              </p>
            </div>

            <div className="glass rounded-2xl p-8 card-hover">
              <div className="inline-flex items-center justify-center p-4 bg-gradient-to-r from-green-500 to-green-600 rounded-2xl shadow-lg mb-6">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Debugging Help</h3>
              <p className="text-white/70 leading-relaxed">
                Find and fix bugs in your code with AI-powered debugging assistance and step-by-step solutions.
              </p>
            </div>

            <div className="glass rounded-2xl p-8 card-hover">
              <div className="inline-flex items-center justify-center p-4 bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl shadow-lg mb-6">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Learning Support</h3>
              <p className="text-white/70 leading-relaxed">
                Learn new programming concepts and best practices with detailed explanations and examples.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-16">
        <div className="relative max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <div className="glass rounded-3xl p-12">
            <h2 className="text-3xl font-bold text-white mb-6">Ready to Level Up Your Coding?</h2>
            <p className="text-white/70 text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of developers who are already using our AI assistant to solve problems faster and learn more effectively.
            </p>
            {!isLoaded ? (
              <div className="animate-pulse-slow bg-white/20 h-14 w-64 rounded-full mx-auto"></div>
            ) : isSignedIn ? (
              <Link 
                href="/chat"
                className="inline-block bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all duration-200 hover:shadow-xl hover:shadow-green-500/25 hover:scale-105"
              >
                Start Chatting Now
              </Link>
            ) : (
              <SignInButton mode="modal">
                <button className="inline-block bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/25 hover:scale-105">
                  Get Started Free
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </section>

      {/* Animated border */}
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse"></div>
    </div>
  )
}