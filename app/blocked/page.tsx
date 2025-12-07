'use client'

import { useUser, SignOutButton } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import MinimalBackground from '../../components/MinimalBackground'

export default function BlockedPage() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/')
    }
  }, [isLoaded, isSignedIn, router])

  // OPTIMIZATION: Show content immediately if user is signed in, don't wait for full load
  // This prevents slow loading for blocked users
  if (!isLoaded) {
    // Show minimal loading state, not full spinner
    return (
      <div className="min-h-screen bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    )
  }
  
  if (!isSignedIn) return null

  return (
    <div className="min-h-screen bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      <MinimalBackground />

      <div className="relative min-h-screen flex items-center justify-center pt-20 pb-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="glass rounded-2xl p-8 border border-red-500/20">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg 
                  className="w-10 h-10 text-red-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-white text-center mb-4">
              Account Access Restricted
            </h1>

            {/* Message */}
            <div className="space-y-4 text-center">
              <p className="text-white/80 text-lg leading-relaxed">
                We&apos;re sorry, but your account has been temporarily restricted from accessing the Programming Helper AI platform.
              </p>

              <div className="bg-white/5 rounded-lg p-6 mt-6 text-left">
                <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  What does this mean?
                </h2>
                <p className="text-white/70 text-sm leading-relaxed">
                  This restriction is typically temporary and may be related to account security, terms of service compliance, or administrative review. We take the security and integrity of our platform seriously to ensure a safe learning environment for all users.
                </p>
              </div>

              <div className="bg-white/5 rounded-lg p-6 mt-4 text-left">
                <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Need help?
                </h2>
                <p className="text-white/70 text-sm leading-relaxed mb-3">
                  If you believe this is an error or have questions about your account status, please don&apos;t hesitate to reach out to our support team.
                </p>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
                >
                  Contact Support
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

              <div className="pt-6 flex justify-center">
                <SignOutButton redirectUrl="/">
                  <button className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </SignOutButton>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

