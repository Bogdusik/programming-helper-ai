'use client';

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import Logo from './Logo'
import { useBlockedStatus } from '../hooks/useBlockedStatus'

const QUICK_LINKS = [
  { name: 'Chat', href: '/chat' },
  { name: 'Statistics', href: '/stats' },
  { name: 'FAQ', href: '/faq' },
] as const

const GET_STARTED_LINKS = [
  { name: 'Sign In', href: '/sign-in' },
  { name: 'Sign Up', href: '/sign-up' },
] as const

const SUPPORT_LINKS = [
  { name: 'Contact Us', href: '/contact' },
  { name: 'Privacy Policy', href: '/privacy' },
  { name: 'Terms of Service', href: '/terms' },
] as const

const SUPPORT_LINKS_PUBLIC = [
  { name: 'Privacy Policy', href: '/privacy' },
  { name: 'Terms of Service', href: '/terms' },
] as const

const FooterLink = ({ name, href }: { name: string; href: string }) => (
  <li>
    <Link 
      href={href}
      className="text-slate-400 hover:text-white transition-colors duration-200 text-sm group flex items-center"
    >
      <span className="w-1 h-1 bg-slate-500 rounded-full mr-2 group-hover:bg-white transition-colors"></span>
      {name}
    </Link>
  </li>
)

const Footer: React.FC = () => {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const { isSignedIn, isLoaded } = useUser();
  // OPTIMIZATION: Use cached value from shared cache (hook will use cache if available)
  const { isBlocked } = useBlockedStatus();

  useEffect(() => {
    setIsMounted(true);
    setCurrentTime(new Date());
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [])

  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }, [])

  const currentYear = useMemo(() => new Date().getFullYear(), [])

  if (!isMounted) return null

  return (
    <footer 
      id="footer"
      className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t border-slate-700/50 overflow-hidden"
    >
      {/* Animated top line */}
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse"></div>
      
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5"></div>
        <div className="absolute top-1/2 left-1/4 w-2 h-2 bg-blue-400 rounded-full animate-pulse opacity-60"></div>
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-purple-400 rounded-full animate-pulse opacity-40" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-1/4 left-1/2 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse opacity-50" style={{ animationDelay: '2s' }}></div>
      </div>


      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className={`grid grid-cols-1 gap-8 ${isLoaded && isSignedIn && !isBlocked ? 'md:grid-cols-4' : isLoaded && !isSignedIn ? 'md:grid-cols-4' : 'md:grid-cols-1'}`}>
          <div className="md:col-span-2">
            <div className="mb-4">
              <Logo size="lg" showText={true} />
            </div>
            <p className="text-slate-300 text-sm leading-relaxed max-w-md">
              Your intelligent programming companion. Get instant help with coding challenges, 
              code reviews, and technical solutions powered by cutting-edge AI technology.
            </p>
            
            <div className="mt-4 flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-slate-400 text-xs">System Online</span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-slate-400 text-xs">{currentTime ? formatTime(currentTime) : '--:--:--'}</span>
            </div>
          </div>

          {isLoaded && isSignedIn && !isBlocked ? (
            <>
              <div>
                <h4 className="text-white font-semibold mb-4">Quick Links</h4>
                <ul className="space-y-3">
                  {QUICK_LINKS.map((link) => (
                    <FooterLink key={link.name} name={link.name} href={link.href} />
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4">Support</h4>
                <ul className="space-y-3">
                  {SUPPORT_LINKS.map((link) => (
                    <FooterLink key={link.name} name={link.name} href={link.href} />
                  ))}
                </ul>
              </div>
            </>
          ) : isLoaded && !isSignedIn ? (
            <>
              <div>
                <h4 className="text-white font-semibold mb-4">Get Started</h4>
                <ul className="space-y-3">
                  {GET_STARTED_LINKS.map((link) => (
                    <FooterLink key={link.name} name={link.name} href={link.href} />
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4">Support</h4>
                <ul className="space-y-3">
                  {SUPPORT_LINKS_PUBLIC.map((link) => (
                    <FooterLink key={link.name} name={link.name} href={link.href} />
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-8 pt-8 border-t border-slate-700/50">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <p className="text-slate-400 text-sm">
                © {currentYear} Programming Helper AI. All rights reserved.
              </p>
            </div>
            
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse"></div>
    </footer>
  );
};

export default Footer;
