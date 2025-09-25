'use client'

import { UserButton, SignInButton, useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import Logo from './Logo'

export default function Navbar() {
  const { isSignedIn } = useUser()
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'glass backdrop-blur-md border-b border-white/10' 
        : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="hover:opacity-80 transition-opacity duration-200">
              <Logo size="md" showText={true} />
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              href="/" 
              className="text-white/80 hover:text-white transition-colors duration-200 font-medium"
            >
              Home
            </Link>
            {isSignedIn && (
              <>
                <Link 
                  href="/chat" 
                  className="text-white/80 hover:text-white transition-colors duration-200 font-medium"
                >
                  Chat
                </Link>
                <Link 
                  href="/stats" 
                  className="text-white/80 hover:text-white transition-colors duration-200 font-medium"
                >
                  Stats
                </Link>
              </>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {isSignedIn ? (
              <UserButton 
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8"
                  }
                }}
              />
            ) : (
              <SignInButton mode="modal">
                <button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25">
                  Get Started
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}