'use client'

import { UserButton, SignInButton, useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Logo from './Logo'
import { trpc } from '@/lib/trpc-client'
import { useBlockedStatus } from '../hooks/useBlockedStatus'
import { useUserRegistrationCheck } from '../hooks/useUserRegistrationCheck'
import { clientLogger } from '../lib/client-logger'

const NAV_LINKS = [
  { name: 'Chat', href: '/chat' },
  { name: 'Stats', href: '/stats', dataTour: 'stats-link' },
  { name: 'Tasks', href: '/tasks' },
] as const

export default function Navbar() {
  const { isSignedIn, user } = useUser()
  const pathname = usePathname()
  const [isScrolled, setIsScrolled] = useState(false)
  const { isCheckingUserExists, hasCheckedUserExists } = useUserRegistrationCheck()
  // OPTIMIZATION: Use cached block status from BlockedCheck instead of making separate request
  // BlockedCheck already handles the check, we just need to know the result
  // This reduces API calls - Navbar will get status from cache or shared request
  const { isBlocked } = useBlockedStatus({ 
    skipPaths: [], // Don't skip /contact - we need to check block status here
    enabled: isSignedIn,
  })
  
  const { data: userRole, error: roleError } = trpc.auth.getMyRole.useQuery(undefined, {
    enabled: isSignedIn && hasCheckedUserExists && !isCheckingUserExists,
    retry: false,
    refetchOnWindowFocus: false
  })
  
  // Handle errors - don't log UNAUTHORIZED errors as they're expected for unregistered users
  useEffect(() => {
    if (roleError && roleError.data?.code !== 'UNAUTHORIZED') {
      clientLogger.error('Error fetching user role:', roleError)
    }
  }, [roleError])
  
  const isAdmin = user?.publicMetadata?.role === 'admin' || userRole?.role === 'admin'

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (pathname === '/blocked') return null
  
  // Don't render Navbar for blocked users (they should only see contact form)
  if (isBlocked) return null

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
          
          <div className="flex items-center space-x-4">
            {isSignedIn && !isBlocked && (
              <>
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch={true}
                    {...('dataTour' in link && link.dataTour ? { 'data-tour': link.dataTour } : {})}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:shadow-lg ${
                      pathname === link.href
                        ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg shadow-green-500/25'
                        : 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white hover:shadow-slate-500/25'
                    }`}
                  >
                    {link.name}
                  </Link>
                ))}
                {isAdmin && (
                  <Link
                    href="/admin"
                    prefetch={true}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:shadow-lg ${
                      pathname === '/admin'
                        ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg shadow-green-500/25'
                        : 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white hover:shadow-slate-500/25'
                    }`}
                  >
                    Admin
                  </Link>
                )}
                <Link
                  href="/settings"
                  prefetch={true}
                  className={`p-2 rounded-full transition-all duration-200 hover:shadow-lg ${
                    pathname === '/settings'
                      ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg shadow-green-500/25'
                      : 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white hover:shadow-slate-500/25'
                  }`}
                  title="Settings"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>
              </>
            )}
            
            {isSignedIn ? (
              <div className="flex items-center space-x-2">
                <UserButton 
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8"
                    }
                  }}
                />
              </div>
            ) : (
              <SignInButton mode="modal">
                <button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25">
                  Log In
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}