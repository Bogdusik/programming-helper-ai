import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isProtectedRoute = createRouteMatcher([
  '/chat(.*)',
  '/stats(.*)',
  '/admin(.*)',
  '/settings(.*)',
  '/tasks(.*)'
])

const isBlockedAllowedRoute = createRouteMatcher([
  '/blocked(.*)',
  '/contact(.*)',
  '/privacy(.*)',
  '/terms(.*)'
])

const isPublicApiRoute = createRouteMatcher([
  '/api/trpc/stats.getGlobalStats(.*)'
])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicApiRoute(req)) {
    return NextResponse.next()
  }
  
  // Allow blocked and contact pages without protection (they handle their own auth)
  if (isBlockedAllowedRoute(req)) {
    return NextResponse.next()
  }
  
  // Protect other routes
  // Note: Block status check is handled on client-side and in tRPC procedures
  // because middleware runs in Edge Runtime which doesn't support Prisma
  if (isProtectedRoute(req)) {
    try {
      // Use auth() to check authentication status safely
      // This prevents unhandled rejection errors
      const { userId } = await auth()
      
      if (!userId) {
        // User is not authenticated - redirect to sign-in
        const signInUrl = new URL('/sign-in', req.url)
        signInUrl.searchParams.set('redirect_url', req.url)
        return NextResponse.redirect(signInUrl)
      }
      
      // User is authenticated - allow access
      return NextResponse.next()
    } catch {
      // Silently handle auth errors - redirect to sign-in
      // This prevents unhandled rejection errors in console
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('redirect_url', req.url)
      return NextResponse.redirect(signInUrl)
    }
  }
  
  // Allow all other routes
  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
