'use client'

import { useEffect } from 'react'
import Navbar from '../../components/Navbar'
import MinimalBackground from '../../components/MinimalBackground'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      <Navbar />
      <MinimalBackground />

      <div className="relative pt-20 pb-16 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass rounded-2xl shadow-xl p-8 border border-white/10">
            <h1 className="text-4xl font-bold text-white mb-6">Privacy Policy</h1>
            
            <div className="prose prose-invert max-w-none space-y-6 text-white/80">
              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
                <p className="leading-relaxed">
                  Programming Helper AI ("we", "our", or "us") is committed to protecting your privacy. 
                  This Privacy Policy explains how we collect, use, disclose, and safeguard your information 
                  when you use our AI-powered programming assistant platform.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">2. Information We Collect</h2>
                <p className="leading-relaxed mb-3">
                  We collect information that you provide directly to us, including:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Account information (anonymous user IDs)</li>
                  <li>Programming questions and code snippets</li>
                  <li>Learning progress and assessment results</li>
                  <li>Language preferences and skill levels</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">3. How We Use Your Information</h2>
                <p className="leading-relaxed mb-3">
                  We use the information we collect to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide and improve our AI programming assistance services</li>
                  <li>Personalize your learning experience</li>
                  <li>Track your progress and provide feedback</li>
                  <li>Ensure platform security and prevent abuse</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">4. Data Security</h2>
                <p className="leading-relaxed">
                  We implement appropriate technical and organizational measures to protect your personal information 
                  against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission 
                  over the Internet is 100% secure.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">5. Your Rights</h2>
                <p className="leading-relaxed mb-3">
                  You have the right to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Access your personal information</li>
                  <li>Request correction of inaccurate data</li>
                  <li>Request deletion of your account and data</li>
                  <li>Opt-out of certain data processing activities</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">6. Contact Us</h2>
                <p className="leading-relaxed">
                  If you have questions about this Privacy Policy, please contact us through our 
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
