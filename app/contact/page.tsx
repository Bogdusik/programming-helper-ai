'use client'

import { useState, useEffect, useRef } from 'react'
import { useUser, SignOutButton } from '@clerk/nextjs'
import Navbar from '../../components/Navbar'
import MinimalBackground from '../../components/MinimalBackground'
import { trpc } from '../../lib/trpc-client'
import { useBlockedStatus, clearBlockStatusCache } from '../../hooks/useBlockedStatus'
import LoadingSpinner from '../../components/LoadingSpinner'
import { clientLogger } from '../../lib/client-logger'

export default function ContactPage() {
  const { isSignedIn, isLoaded, user } = useUser()
  const hasClearedCacheRef = useRef(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  
  // State for block status - we'll check it directly
  const [isBlockedState, setIsBlockedState] = useState(false)
  const [isCheckingBlocked, setIsCheckingBlocked] = useState(false)
  
  // Clear cache and force check block status on mount
  useEffect(() => {
    if (isLoaded && isSignedIn && user?.id) {
      // Clear cache first
      if (!hasClearedCacheRef.current) {
        clearBlockStatusCache(user.id)
        hasClearedCacheRef.current = true
      }
      
      // Force check block status directly
      setIsCheckingBlocked(true)
      fetch('/api/check-blocked', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      })
        .then(res => res.json())
        .then(data => {
          setIsBlockedState(data.isBlocked ?? false)
          setIsCheckingBlocked(false)
        })
        .catch(err => {
          clientLogger.error('Error checking block status:', err)
          setIsBlockedState(false)
          setIsCheckingBlocked(false)
        })
    }
  }, [isLoaded, isSignedIn, user?.id])
  
  // Also use hook for consistency
  const { isBlocked: isBlockedFromHook } = useBlockedStatus({
    skipPaths: [], // Don't skip /contact - we need to check block status here
    enabled: isSignedIn && isLoaded,
  })
  
  // Use the direct check result, fallback to hook result
  const isBlocked = isBlockedState || isBlockedFromHook

  // All hooks must be called before any conditional returns
  const sendMessageMutation = trpc.contact.sendMessage.useMutation({
    onSuccess: () => {
      setSubmitStatus('success')
      setFormData({ name: '', email: '', subject: '', message: '' })
      setErrorMessage('')
      setTimeout(() => {
        setSubmitStatus('idle')
      }, 5000)
    },
    onError: (error) => {
      setSubmitStatus('error')
      setErrorMessage(error.message || 'Failed to send message. Please try again.')
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitStatus('idle')
    setErrorMessage('')
    
    try {
      await sendMessageMutation.mutateAsync({
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
      })
    } catch {
      // Error is handled by onError callback
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  // For blocked users, don't show Navbar at all - they should only see contact form
  // Also adjust padding since there's no navbar
  // Force hide Navbar if blocked (double check)
  const shouldShowNavbar = !isBlocked && isLoaded && isSignedIn

  // Show loading while checking block status (AFTER all hooks)
  if (isSignedIn && isLoaded && isCheckingBlocked) {
    return <LoadingSpinner />
  }
  
  // Note: We don't redirect blocked users from /contact page
  // They are allowed to be here to contact support
  // But Navbar and Footer links are hidden based on isBlocked
  
  return (
    <div className="min-h-screen bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {shouldShowNavbar && <Navbar />}
      <MinimalBackground />

      <div className={`relative min-h-screen flex items-center ${isBlocked ? 'pt-8 pb-16' : 'pt-20 pb-16'}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">Contact Us</h1>
            <p className="text-white/70 text-lg">
              Have a question or feedback? We&apos;d love to hear from you!
            </p>
          </div>

          <div className="glass rounded-2xl shadow-xl p-8 border border-white/10">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-white/90 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="your.email@example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-white/90 mb-2">
                  Subject *
                </label>
                <select
                  id="subject"
                  name="subject"
                  required
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="" className="bg-slate-800">Select a subject</option>
                  <option value="general" className="bg-slate-800">General Inquiry</option>
                  <option value="technical" className="bg-slate-800">Technical Support</option>
                  <option value="feedback" className="bg-slate-800">Feedback</option>
                  <option value="bug" className="bg-slate-800">Report a Bug</option>
                  <option value="feature" className="bg-slate-800">Feature Request</option>
                  <option value="other" className="bg-slate-800">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-white/90 mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={6}
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  placeholder="Tell us how we can help you..."
                />
              </div>

              {submitStatus === 'success' && (
                <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
                  <p className="text-green-400 text-sm">
                    ✓ Thank you! Your message has been sent. We&apos;ll get back to you soon.
                  </p>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <p className="text-red-400 text-sm">
                    ✗ {errorMessage || 'Failed to send message. Please try again.'}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={sendMessageMutation.isPending}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendMessageMutation.isPending ? 'Sending...' : 'Send Message'}
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Other Ways to Reach Us</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-lg">
                  <h4 className="text-white font-medium mb-2">Email Support</h4>
                  <p className="text-white/70 text-sm">bogdyn13@proton.me</p>
                </div>
                <div className="p-4 bg-white/5 rounded-lg">
                  <h4 className="text-white font-medium mb-2">Response Time</h4>
                  <p className="text-white/70 text-sm">We typically respond within 24-48 hours</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Log Out button for blocked users */}
          {isBlocked && isSignedIn && isLoaded && (
            <div className="mt-8 flex justify-center">
              <SignOutButton redirectUrl="/">
                <button className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Log Out
                </button>
              </SignOutButton>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

