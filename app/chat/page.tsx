'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Navbar from '../../components/Navbar'
import ChatBox from '../../components/ChatBox'

export default function ChatPage() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/')
    }
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded) {
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

  return (
    <div className="min-h-screen gradient-bg">
      <Navbar />
      
      <div className="pt-20 pb-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">AI Programming Assistant</h1>
            <p className="text-white/70 text-lg">Get instant help with your coding questions</p>
          </div>
          
          <div className="glass rounded-3xl shadow-2xl border border-white/10 h-[700px] overflow-hidden">
            <ChatBox />
          </div>
        </div>
      </div>
    </div>
  )
}