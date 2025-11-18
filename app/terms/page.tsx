'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Navbar from '../../components/Navbar'
import MinimalBackground from '../../components/MinimalBackground'
import { useBlockedStatus } from '../../hooks/useBlockedStatus'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function TermsPage() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const { isBlocked, isLoading } = useBlockedStatus({
    skipPaths: ['/blocked', '/contact'],
    enabled: isSignedIn && isLoaded,
  })

  // Redirect blocked users to blocked page
  useEffect(() => {
    if (isLoaded && isSignedIn && isBlocked) {
      router.replace('/blocked')
    }
  }, [isLoaded, isSignedIn, isBlocked, router])

  // Show loading while checking or redirecting
  if (!isLoaded || (isSignedIn && isLoading) || (isSignedIn && isBlocked)) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      <Navbar />
      <MinimalBackground />

      <div className="relative pt-20 pb-16 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass rounded-2xl shadow-xl p-8 border border-white/10">
            <h1 className="text-4xl font-bold text-white mb-6">Terms of Service</h1>
            
            <div className="prose prose-invert max-w-none space-y-6 text-white/80">
              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
                <p className="leading-relaxed">
                  By accessing and using Programming Helper AI, you accept and agree to be bound by the terms 
                  and provision of this agreement. If you do not agree to abide by the above, please do not use 
                  this service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">2. Use License</h2>
                <p className="leading-relaxed mb-3">
                  Permission is granted to temporarily use Programming Helper AI for personal, non-commercial 
                  transitory viewing only. This is the grant of a license, not a transfer of title, and under 
                  this license you may not:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Modify or copy the materials</li>
                  <li>Use the materials for any commercial purpose</li>
                  <li>Attempt to reverse engineer any software contained in the platform</li>
                  <li>Remove any copyright or other proprietary notations from the materials</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">3. User Conduct</h2>
                <p className="leading-relaxed mb-3">
                  You agree to use Programming Helper AI only for lawful purposes and in a way that does not 
                  infringe the rights of, restrict or inhibit anyone else's use and enjoyment of the platform. 
                  Prohibited behavior includes:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Harassing or abusing other users</li>
                  <li>Violating any applicable laws or regulations</li>
                  <li>Transmitting malicious code or viruses</li>
                  <li>Attempting to gain unauthorized access to the platform</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">4. Account Termination</h2>
                <p className="leading-relaxed">
                  We reserve the right to suspend or terminate your account at any time for violations of these 
                  Terms of Service, fraudulent activity, or any other reason we deem necessary to protect the 
                  integrity of our platform and users.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">5. Disclaimer</h2>
                <p className="leading-relaxed">
                  The materials on Programming Helper AI are provided on an 'as is' basis. We make no warranties, 
                  expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, 
                  implied warranties or conditions of merchantability, fitness for a particular purpose, or 
                  non-infringement of intellectual property or other violation of rights.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">6. Limitations</h2>
                <p className="leading-relaxed">
                  In no event shall Programming Helper AI or its suppliers be liable for any damages (including, 
                  without limitation, damages for loss of data or profit, or due to business interruption) arising 
                  out of the use or inability to use the materials on Programming Helper AI.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">7. Contact Information</h2>
                <p className="leading-relaxed">
                  If you have any questions about these Terms of Service, please contact us through our 
                  <a href="/contact" className="text-blue-400 hover:text-blue-300 underline ml-1">contact form</a>.
                </p>
              </section>

              <section>
                <p className="text-sm text-white/60 mt-8">
                  Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
