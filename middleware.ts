import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

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

export default clerkMiddleware((auth, req) => {
  if (isPublicApiRoute(req)) return
  
  // Allow blocked and contact pages without protection (they handle their own auth)
  if (isBlockedAllowedRoute(req)) {
    return
  }
  
  // Protect other routes
  // Note: Block status check is handled on client-side and in tRPC procedures
  // because middleware runs in Edge Runtime which doesn't support Prisma
  if (isProtectedRoute(req)) {
    auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
