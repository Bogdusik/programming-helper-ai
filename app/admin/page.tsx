'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Navbar from '@/components/Navbar'
import { trpc } from '@/lib/trpc-client'

export default function AdminPage() {
  const { isSignedIn, isLoaded, user } = useUser()
  const router = useRouter()
  
  // Modal states
  const [showUsersModal, setShowUsersModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showTasksModal, setShowTasksModal] = useState(false)
  const [showUserDetailsModal, setShowUserDetailsModal] = useState(false)
  const [showChartsModal, setShowChartsModal] = useState(false)
  const [showReportsModal, setShowReportsModal] = useState(false)
  const [showMonitoringModal, setShowMonitoringModal] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [usersPage, setUsersPage] = useState(1)
  const [usersSearch, setUsersSearch] = useState('')
  const [exportFormat, setExportFormat] = useState<'json' | 'markdown' | 'txt'>('json')
  
  // All hooks must be called before any conditional returns
  // Check admin role from database via tRPC
  const { data: userRole } = trpc.auth.getMyRole.useQuery(undefined, {
    enabled: isSignedIn && isLoaded,
    retry: false
  })
  
  // OPTIMIZATION: Add staleTime to cache dashboard stats and reduce refetches
  const { data: dashboardStats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = trpc.admin.getDashboardStats.useQuery(undefined, {
    enabled: isSignedIn && isLoaded,
    retry: false,
    staleTime: 30 * 1000, // Cache for 30 seconds
  })
  
  // Get users list
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = trpc.admin.getUsers.useQuery(
    { page: usersPage, limit: 20, search: usersSearch || undefined },
    { enabled: showUsersModal && isSignedIn && isLoaded }
  )

  // Get user details
  const { data: userDetails, refetch: refetchUserDetails } = trpc.admin.getUserDetails.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId && showUserDetailsModal && isSignedIn && isLoaded }
  )

  // Mutations
  const toggleBlockMutation = trpc.admin.toggleUserBlock.useMutation({
    onSuccess: () => {
      toast.success('User status updated')
      if (selectedUserId) {
        refetchUserDetails()
      }
      if (showUsersModal) {
        // Refetch users list to update button states
        refetchUsers()
      }
    },
  })

  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success('User deleted successfully')
      if (showUsersModal) {
        // Refetch users list
        refetchUsers()
      }
      if (showUserDetailsModal) {
        setShowUserDetailsModal(false)
        setSelectedUserId(null)
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete user')
    },
  })
  
  const handleRefreshStats = () => {
    toast.promise(refetchStats(), {
      loading: 'Refreshing statistics...',
      success: 'Statistics refreshed successfully',
      error: 'Failed to refresh statistics',
    })
  }
  
  const handleClearCache = () => {
    toast((t) => (
      <div>
        <p className="mb-2">Are you sure you want to clear the cache?</p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              toast.promise(refetchStats(), {
                loading: 'Clearing cache...',
                success: 'Cache cleared! Statistics refreshed.',
                error: 'Failed to clear cache',
              })
              toast.dismiss(t.id)
            }}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
          >
            Yes, clear cache
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    ), {
      duration: 5000,
    })
  }

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/')
    }
  }, [isLoaded, isSignedIn, router])

  // Calculate admin status after all hooks
  const isAdmin = user?.publicMetadata?.role === 'admin' || userRole?.role === 'admin'

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
            <p className="mt-4 text-white/80">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return null
  }

  if (!isAdmin && userRole) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
        <Navbar />
        <div className="pt-20 pb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white">Access Denied</h1>
              <p className="mt-2 text-white/70">You don&apos;t have permission to access this page.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      <Navbar />
      <div className="relative pt-20 pb-12 min-h-[calc(100vh-5rem)] flex flex-col">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col justify-center">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
            <p className="mt-2 text-white/70">Manage the Programming Helper AI system</p>
          </div>

          {/* Admin Actions - moved to top */}
          <div className="mb-6 flex justify-center">
            <div className="glass rounded-lg p-4 inline-block">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 w-fit">
                <button 
                  onClick={() => setShowUsersModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  <span>Users</span>
                </button>
                <button 
                  onClick={() => setShowTasksModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>Tasks</span>
                </button>
                <button 
                  onClick={() => setShowChartsModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>Charts</span>
                </button>
                <button 
                  onClick={() => setShowReportsModal(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Reports</span>
                </button>
                <button 
                  onClick={() => setShowSettingsModal(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Settings</span>
                </button>
                <button 
                  onClick={() => setShowMonitoringModal(true)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Monitoring</span>
                </button>
              </div>
            </div>
          </div>

          {statsError && (
            <div className="mb-6 glass border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-300">Error loading dashboard statistics. Please try again later.</p>
              </div>
            </div>
          )}

          {/* Statistics Section */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-white mb-3 text-center">Dashboard Statistics</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
            {/* Total Users */}
            <div className="glass overflow-hidden rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-white/70 truncate">Total Users</dt>
                      <dd className="text-lg font-medium text-white">
                        {statsLoading ? (
                          <div className="animate-pulse bg-white/20 h-6 w-16 rounded"></div>
                        ) : (
                          dashboardStats?.users.total ?? 0
                        )}
                      </dd>
                      {dashboardStats && (
                        <dd className="text-xs text-white/50 mt-1">
                          {dashboardStats.users.active24h} active (24h) • {dashboardStats.users.new24h} new (24h)
                        </dd>
                      )}
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Messages */}
            <div className="glass overflow-hidden rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-white/70 truncate">Total Messages</dt>
                      <dd className="text-lg font-medium text-white">
                        {statsLoading ? (
                          <div className="animate-pulse bg-white/20 h-6 w-16 rounded"></div>
                        ) : (
                          dashboardStats?.messages.total ?? 0
                        )}
                      </dd>
                      {dashboardStats && (
                        <dd className="text-xs text-white/50 mt-1">
                          {dashboardStats.messages.last24h} in last 24h • {dashboardStats.messages.userMessages} questions
                        </dd>
                      )}
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Sessions */}
            <div className="glass overflow-hidden rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-white/70 truncate">Chat Sessions</dt>
                      <dd className="text-lg font-medium text-white">
                        {statsLoading ? (
                          <div className="animate-pulse bg-white/20 h-6 w-16 rounded"></div>
                        ) : (
                          dashboardStats?.sessions.total ?? 0
                        )}
                      </dd>
                      {dashboardStats && (
                        <dd className="text-xs text-white/50 mt-1">
                          {dashboardStats.sessions.last24h} created (24h) • {dashboardStats.sessions.last7d} (7d)
                        </dd>
                      )}
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Average Response Time */}
            <div className="glass overflow-hidden rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-white/70 truncate">Avg Response Time</dt>
                      <dd className="text-lg font-medium text-white">
                        {statsLoading ? (
                          <div className="animate-pulse bg-white/20 h-6 w-16 rounded"></div>
                        ) : (
                          dashboardStats?.analytics.avgResponseTime ? `${dashboardStats.analytics.avgResponseTime}s` : '0s'
                        )}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Users (7 days) */}
            <div className="glass overflow-hidden rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-indigo-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-white/70 truncate">Active Users (7d)</dt>
                      <dd className="text-lg font-medium text-white">
                        {statsLoading ? (
                          <div className="animate-pulse bg-white/20 h-6 w-16 rounded"></div>
                        ) : (
                          dashboardStats?.users.active7d ?? 0
                        )}
                      </dd>
                      {dashboardStats && (
                        <dd className="text-xs text-white/50 mt-1">
                          {dashboardStats.users.new7d} new users (7d)
                        </dd>
                      )}
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* System Health */}
            <div className="glass overflow-hidden rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-white/70 truncate">System Health</dt>
                      <dd className="text-lg font-medium text-green-400">
                        {statsLoading ? (
                          <div className="animate-pulse bg-white/20 h-6 w-16 rounded"></div>
                        ) : statsError ? (
                          <span className="text-red-400">Error</span>
                        ) : (
                          'Healthy'
                        )}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>

        </div>
      </div>

      {/* Users Modal */}
      {showUsersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowUsersModal(false)}>
          <div className="glass rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">All Users</h2>
              <button 
                onClick={() => setShowUsersModal(false)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by user ID..."
                value={usersSearch}
                onChange={(e) => {
                  setUsersSearch(e.target.value)
                  setUsersPage(1)
                }}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {usersLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
                <p className="mt-4 text-white/70">Loading users...</p>
              </div>
            ) : usersData ? (
              <>
                {usersData.users.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-white/70">No users found</p>
                    {usersSearch && (
                      <p className="text-white/50 text-sm mt-2">Try a different search term</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    {usersData.users.map((user) => (
                      <div key={user.id} className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="text-white font-medium break-words">User ID: <span className="font-mono text-sm">{user.id}</span></div>
                              {user.isBlocked && (
                                <span className="px-2 py-0.5 bg-red-500/20 text-red-300 text-xs rounded-full">Blocked</span>
                              )}
                            </div>
                            <div className="text-white/60 text-sm mt-1">
                              Role: <span className={`font-semibold ${user.role === 'admin' ? 'text-green-400' : 'text-blue-400'}`}>{user.role}</span>
                            </div>
                            <div className="text-white/50 text-xs mt-2">
                              Messages: <span className="text-white/70">{user._count.messages}</span> • Sessions: <span className="text-white/70">{user._count.chatSessions}</span>
                            </div>
                            <div className="text-white/50 text-xs">
                              Created: {new Date(user.createdAt).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                              })}
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => {
                                setSelectedUserId(user.id)
                                setShowUserDetailsModal(true)
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-colors"
                            >
                              Details
                            </button>
                            {user.role !== 'admin' && (
                              <>
                                <button
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to ${user.isBlocked ? 'unblock' : 'block'} this user?`)) {
                                      toggleBlockMutation.mutate({
                                        userId: user.id,
                                        isBlocked: !user.isBlocked,
                                      })
                                    }
                                  }}
                                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                    user.isBlocked
                                      ? 'bg-green-600 hover:bg-green-700 text-white'
                                      : 'bg-red-600 hover:bg-red-700 text-white'
                                  }`}
                                >
                                  {user.isBlocked ? 'Unblock' : 'Block'}
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to DELETE this user? This will permanently delete all their data (messages, sessions, stats, etc.) and they will need to go through the personalization process again when they log in. This action cannot be undone!`)) {
                                      deleteUserMutation.mutate({
                                        userId: user.id,
                                      })
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-xs font-medium transition-colors"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {usersData.pagination.totalPages > 1 && (
                  <div className="flex justify-between items-center mt-4">
                    <button
                      onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                      disabled={usersPage === 1}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-white/70 text-sm">
                      Page {usersData.pagination.page} of {usersData.pagination.totalPages} ({usersData.pagination.total} total)
                    </span>
                    <button
                      onClick={() => setUsersPage(p => Math.min(usersData.pagination.totalPages, p + 1))}
                      disabled={usersPage === usersData.pagination.totalPages}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal 
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          format={exportFormat}
          onFormatChange={setExportFormat}
        />
      )}

      {/* User Details Modal */}
      {showUserDetailsModal && selectedUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => {
          setShowUserDetailsModal(false)
          setSelectedUserId(null)
        }}>
          <div className="glass rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">User Details</h2>
              <button 
                onClick={() => {
                  setShowUserDetailsModal(false)
                  setSelectedUserId(null)
                }}
                className="text-white/70 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {userDetails ? (
              <div className="space-y-4">
                {/* User Info */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white">User Information</h3>
                    <div className="flex gap-2">
                      {userDetails.isBlocked && (
                        <span className="px-3 py-1 bg-red-500/20 text-red-300 text-xs rounded-full">Blocked</span>
                      )}
                      <span className={`px-3 py-1 text-xs rounded-full ${userDetails.role === 'admin' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'}`}>
                        {userDetails.role}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-white/60">User ID</div>
                      <div className="text-white font-mono text-xs mt-1 break-all">{userDetails.id}</div>
                    </div>
                    <div>
                      <div className="text-white/60">Created</div>
                      <div className="text-white mt-1">
                        {new Date(userDetails.createdAt).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                  {userDetails.role !== 'admin' && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to ${userDetails.isBlocked ? 'unblock' : 'block'} this user?`)) {
                            toggleBlockMutation.mutate({
                              userId: userDetails.id,
                              isBlocked: !userDetails.isBlocked,
                            })
                          }
                        }}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          userDetails.isBlocked
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                      >
                        {userDetails.isBlocked ? 'Unblock User' : 'Block User'}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`⚠️ WARNING: Are you sure you want to DELETE this user?\n\nThis will permanently delete:\n- All messages\n- All chat sessions\n- All statistics\n- All assessments\n- All language progress\n- All task progress\n- User profile\n\nAfter deletion, when the user logs in through Clerk, they will need to go through the personalization process again.\n\nThis action CANNOT be undone!`)) {
                            deleteUserMutation.mutate({
                              userId: userDetails.id,
                            })
                          }
                        }}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-sm font-medium transition-colors"
                      >
                        Delete User
                      </button>
                    </div>
                  )}
                  {userDetails.role === 'admin' && (
                    <div className="mt-3 px-4 py-2 bg-gray-600/50 text-white/50 rounded-md text-sm font-medium text-center">
                      Admin users cannot be blocked
                    </div>
                  )}
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-white/60 text-xs mb-1">Total Messages</div>
                    <div className="text-2xl font-bold text-white">{userDetails._count.messages}</div>
                    <div className="text-white/50 text-xs mt-1">
                      {userDetails.activityStats.messages24h} (24h) • {userDetails.activityStats.messages7d} (7d)
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-white/60 text-xs mb-1">Chat Sessions</div>
                    <div className="text-2xl font-bold text-white">{userDetails._count.chatSessions}</div>
                    <div className="text-white/50 text-xs mt-1">
                      {userDetails.activityStats.sessions24h} (24h) • {userDetails.activityStats.sessions7d} (7d)
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-white/60 text-xs mb-1">Tasks Progress</div>
                    <div className="text-2xl font-bold text-white">{userDetails._count.taskProgress}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-white/60 text-xs mb-1">Assessments</div>
                    <div className="text-2xl font-bold text-white">{userDetails._count.assessments}</div>
                  </div>
                </div>

                {/* Profile Info */}
                {(userDetails.profile || userDetails.selfReportedLevel) && (
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-3">Profile</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-white/60">Experience Level</div>
                        <div className="text-white mt-1 capitalize">
                          {(userDetails.selfReportedLevel || userDetails.profile?.experience)?.replace(/_/g, ' ') || 'Not set'}
                        </div>
                      </div>
                      <div>
                        <div className="text-white/60">AI Experience</div>
                        <div className="text-white mt-1 capitalize">
                          {(userDetails.profile?.aiExperience)?.replace(/_/g, ' ') || 'Not set'}
                        </div>
                      </div>
                      <div>
                        <div className="text-white/60">Confidence</div>
                        <div className="text-white mt-1">
                          {(userDetails.initialConfidence || userDetails.profile?.confidence) || 'Not set'}/5
                        </div>
                      </div>
                      {(userDetails.learningGoals && userDetails.learningGoals.length > 0) || (userDetails.profile?.focusAreas && userDetails.profile.focusAreas.length > 0) ? (
                        <div className="col-span-2">
                          <div className="text-white/60 mb-2">Focus Areas</div>
                          <div className="flex flex-wrap gap-2">
                            {(userDetails.learningGoals || userDetails.profile?.focusAreas || []).map((area: string) => (
                              <span key={area} className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                                {area}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Language Progress */}
                {userDetails.languageProgress && userDetails.languageProgress.length > 0 && (
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-3">Language Progress</h3>
                    <div className="space-y-2">
                      {userDetails.languageProgress.map((lang) => (
                        <div key={lang.language} className="flex justify-between items-center text-sm">
                          <span className="text-white capitalize">{lang.language}</span>
                          <div className="flex gap-4 text-white/70">
                            <span>{lang.questionsAsked} questions</span>
                            <span>{lang.tasksCompleted} tasks</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed Tasks */}
                {userDetails.taskProgress && userDetails.taskProgress.length > 0 && (
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-3">Completed Tasks</h3>
                    <div className="space-y-2">
                      {userDetails.taskProgress.map((progress) => (
                        <div key={progress.id} className="flex justify-between items-center text-sm p-2 bg-white/5 rounded">
                          <div>
                            <div className="text-white font-medium">{progress.task.title}</div>
                            <div className="text-white/60 text-xs">
                              {progress.task.language} • {progress.task.difficulty}
                            </div>
                          </div>
                          <div className="text-white/70 text-xs">
                            {progress.completedAt && new Date(progress.completedAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stats */}
                {userDetails.stats && (
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-3">Statistics</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-white/60">Questions Asked</div>
                        <div className="text-white font-semibold">{userDetails.stats.questionsAsked}</div>
                      </div>
                      <div>
                        <div className="text-white/60">Tasks Completed</div>
                        <div className="text-white font-semibold">{userDetails.stats.tasksCompleted}</div>
                      </div>
                      <div>
                        <div className="text-white/60">Avg Response Time</div>
                        <div className="text-white font-semibold">{userDetails.stats.avgResponseTime.toFixed(2)}s</div>
                      </div>
                      <div>
                        <div className="text-white/60">Total Time Spent</div>
                        <div className="text-white font-semibold">{Math.floor(userDetails.stats.totalTimeSpent / 60)} min</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
                <p className="mt-4 text-white/70">Loading user details...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowSettingsModal(false)}>
          <div className="glass rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">System Settings</h2>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <SystemSettingsContent />
          </div>
        </div>
      )}

      {/* Tasks Management Modal */}
      {showTasksModal && (
        <TasksManagementModal
          isOpen={showTasksModal}
          onClose={() => setShowTasksModal(false)}
        />
      )}

      {/* Charts Modal */}
      {showChartsModal && (
        <ChartsModal
          isOpen={showChartsModal}
          onClose={() => setShowChartsModal(false)}
        />
      )}

      {/* Reports Modal */}
      {showReportsModal && (
        <ReportsModal
          isOpen={showReportsModal}
          onClose={() => setShowReportsModal(false)}
        />
      )}

      {/* Monitoring Modal */}
      {showMonitoringModal && (
        <MonitoringModal
          isOpen={showMonitoringModal}
          onClose={() => setShowMonitoringModal(false)}
        />
      )}
    </div>
  )
}

// System Settings Component
function SystemSettingsContent() {
  const { data: settings, isLoading } = trpc.admin.getSystemSettings.useQuery()

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
        <p className="mt-4 text-white/70">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <h3 className="text-white font-medium mb-2">Database Status</h3>
        <p className="text-white/70 text-sm">Connected to PostgreSQL</p>
        <p className="text-white/50 text-xs mt-1">Database: programming_helper_ai</p>
      </div>
      
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <h3 className="text-white font-medium mb-2">System Information</h3>
        <div className="space-y-1 text-sm text-white/70">
          <p>Next.js Version: 15.5.4</p>
          <p>Prisma Version: 6.16.2</p>
          <p>Database: PostgreSQL</p>
        </div>
      </div>

      {settings && (
        <>
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <h3 className="text-white font-medium mb-3">OpenAI Settings</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/70">Model</span>
                <span className="text-white font-mono">{settings.openai.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70">Temperature</span>
                <span className="text-white">{settings.openai.temperature}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70">Max Tokens</span>
                <span className="text-white">{settings.openai.maxTokens}</span>
              </div>
            </div>
            <p className="text-white/50 text-xs mt-3">Note: These settings are configured via environment variables</p>
          </div>

          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <h3 className="text-white font-medium mb-3">Rate Limiting</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/70">Enabled</span>
                <span className={`${settings.rateLimit.enabled ? 'text-green-400' : 'text-red-400'}`}>
                  {settings.rateLimit.enabled ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70">Requests per Minute</span>
                <span className="text-white">{settings.rateLimit.requestsPerMinute}</span>
              </div>
            </div>
          </div>
        </>
      )}
      
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <h3 className="text-white font-medium mb-2">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => {
              toast.promise(
                new Promise((resolve) => {
                  setTimeout(resolve, 1000)
                }),
                {
                  loading: 'Clearing cache...',
                  success: 'Cache cleared!',
                  error: 'Failed to clear cache',
                }
              )
            }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-colors"
          >
            Clear Cache
          </button>
          <button 
            onClick={() => {
              window.location.reload()
            }}
            className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md text-xs font-medium transition-colors"
          >
            Refresh Stats
          </button>
        </div>
      </div>
    </div>
  )
}

// Tasks Management Modal Component
function TasksManagementModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [language, setLanguage] = useState<string | undefined>()
  const [difficulty, setDifficulty] = useState<string | undefined>()
  const [isActive, setIsActive] = useState<boolean | undefined>()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Record<string, unknown> | null>(null)

  const { data: tasksData, isLoading, refetch } = trpc.admin.getAllTasks.useQuery({
    page,
    limit: 20,
    search: search || undefined,
    language: language || undefined,
    difficulty: difficulty || undefined,
    isActive,
  })

  const { data: taskStats } = trpc.admin.getTaskStats.useQuery()

  const deleteTaskMutation = trpc.admin.deleteTask.useMutation({
    onSuccess: () => {
      toast.success('Task deleted successfully')
      refetch()
    },
  })

  const utils = trpc.useUtils()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Tasks Management</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              Create Task
            </button>
            <button 
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats */}
        {taskStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-white/60 text-xs mb-1">Total Tasks</div>
              <div className="text-xl font-bold text-white">{taskStats.totalTasks}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-white/60 text-xs mb-1">Active</div>
              <div className="text-xl font-bold text-green-400">{taskStats.activeTasks}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-white/60 text-xs mb-1">Inactive</div>
              <div className="text-xl font-bold text-red-400">{taskStats.inactiveTasks}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-white/60 text-xs mb-1">Completed</div>
              <div className="text-xl font-bold text-blue-400">{taskStats.completedTasks}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-white/60 text-xs mb-1">By Language</div>
              <div className="text-xs text-white/70 mt-1">
                {Object.keys(taskStats.tasksByLanguage).length} languages
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 space-y-3">
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="flex gap-3 flex-wrap">
            <select
              value={language || ''}
              onChange={(e) => {
                setLanguage(e.target.value || undefined)
                setPage(1)
              }}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">All Languages</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
              <option value="csharp">C#</option>
            </select>
            <select
              value={difficulty || ''}
              onChange={(e) => {
                setDifficulty(e.target.value || undefined)
                setPage(1)
              }}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">All Difficulties</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <select
              value={isActive === undefined ? '' : isActive ? 'true' : 'false'}
              onChange={(e) => {
                setIsActive(e.target.value === '' ? undefined : e.target.value === 'true')
                setPage(1)
              }}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>

        {/* Tasks List */}
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
            <p className="mt-4 text-white/70">Loading tasks...</p>
          </div>
        ) : tasksData && tasksData.tasks.length > 0 ? (
          <>
            <div className="space-y-2 mb-4">
              {tasksData.tasks.map((task) => (
                <div key={task.id} className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-white font-semibold">{task.title}</h3>
                        {!task.isActive && (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-300 text-xs rounded-full">Inactive</span>
                        )}
                      </div>
                      <p className="text-white/70 text-sm mb-2 line-clamp-2">{task.description}</p>
                      <div className="flex gap-2 flex-wrap">
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded capitalize">{task.language}</span>
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded capitalize">{task.difficulty}</span>
                        <span className="px-2 py-1 bg-orange-500/20 text-orange-300 text-xs rounded capitalize">{task.category}</span>
                        <span className="px-2 py-1 bg-gray-500/20 text-gray-300 text-xs rounded">
                          {task._count.userProgress} attempts
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => setEditingTask(task)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
                            deleteTaskMutation.mutate({ taskId: task.id })
                          }
                        }}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {tasksData.pagination.totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
                >
                  Previous
                </button>
                <span className="text-white/70 text-sm">
                  Page {tasksData.pagination.page} of {tasksData.pagination.totalPages} ({tasksData.pagination.total} total)
                </span>
                <button
                  onClick={() => setPage(p => Math.min(tasksData.pagination.totalPages, p + 1))}
                  disabled={page === tasksData.pagination.totalPages}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-white/70">No tasks found</p>
          </div>
        )}

        {/* Create/Edit Task Modal */}
        {(showCreateModal || editingTask) && (
          <TaskFormModal
            task={editingTask}
            onClose={() => {
              setShowCreateModal(false)
              setEditingTask(null)
            }}
            onSuccess={() => {
              refetch()
              setShowCreateModal(false)
              setEditingTask(null)
            }}
          />
        )}
      </div>
    </div>
  )
}

// Task Form Modal Component
function TaskFormModal({ task, onClose, onSuccess }: { task?: Record<string, unknown>; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    language: task?.language || '',
    difficulty: task?.difficulty || 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    category: task?.category || '',
    starterCode: task?.starterCode || '',
    hints: task?.hints || [] as string[],
    solution: task?.solution || '',
    isActive: task?.isActive !== undefined ? task.isActive : true,
  })
  const [hintInput, setHintInput] = useState('')

  const createMutation = trpc.admin.createTask.useMutation({
    onSuccess: () => {
      toast.success('Task created successfully')
      onSuccess()
    },
  })

  const updateMutation = trpc.admin.updateTask.useMutation({
    onSuccess: () => {
      toast.success('Task updated successfully')
      onSuccess()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (task) {
      updateMutation.mutate({
        taskId: task.id,
        ...formData,
      })
    } else {
      createMutation.mutate(formData)
    }
  }

  const addHint = () => {
    if (hintInput.trim()) {
      setFormData(prev => ({
        ...prev,
        hints: [...prev.hints, hintInput.trim()],
      }))
      setHintInput('')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">{task ? 'Edit Task' : 'Create Task'}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-white/70 text-sm mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-white/70 text-sm mb-1">Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              required
              rows={4}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-white/70 text-sm mb-1">Language *</label>
              <input
                type="text"
                value={formData.language}
                onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                required
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">Difficulty *</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value as 'beginner' | 'intermediate' | 'advanced' }))}
                required
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">Category *</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                required
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-white/70 text-sm mb-1">Starter Code</label>
            <textarea
              value={formData.starterCode}
              onChange={(e) => setFormData(prev => ({ ...prev, starterCode: e.target.value }))}
              rows={6}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white font-mono text-sm placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-white/70 text-sm mb-1">Hints</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={hintInput}
                onChange={(e) => setHintInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addHint())}
                placeholder="Add a hint..."
                className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                type="button"
                onClick={addHint}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.hints.map((hint, idx) => (
                <span key={idx} className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm flex items-center gap-2">
                  {hint}
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, hints: prev.hints.filter((_, i) => i !== idx) }))}
                    className="hover:text-red-300"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-white/70 text-sm mb-1">Solution</label>
            <textarea
              value={formData.solution}
              onChange={(e) => setFormData(prev => ({ ...prev, solution: e.target.value }))}
              rows={6}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white font-mono text-sm placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="isActive" className="text-white/70 text-sm">Active (visible to users)</label>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : task ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Charts Modal Component
function ChartsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [chartType, setChartType] = useState<'messages' | 'users' | 'sessions'>('messages')
  const [days, setDays] = useState(7)
  const { data: chartData, isLoading } = trpc.admin.getActivityChart.useQuery({
    type: chartType,
    days,
  })
  const { data: languageData } = trpc.admin.getLanguageDistribution.useQuery()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-6 max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Data Visualization</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6 flex gap-3 flex-wrap">
          <select
            value={chartType}
                onChange={(e) => setChartType(e.target.value as 'messages' | 'users' | 'sessions')}
            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="messages">Messages</option>
            <option value="users">Users</option>
            <option value="sessions">Sessions</option>
          </select>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
            <p className="mt-4 text-white/70">Loading chart data...</p>
          </div>
        ) : chartData && chartData.length > 0 ? (
          <div className="space-y-6">
            {/* Activity Chart */}
            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4 capitalize">
                {chartType} Activity ({days} days)
              </h3>
              <div className="h-64 flex items-end justify-between gap-1 mb-8">
                {chartData.map((item, idx) => {
                  const maxCount = Math.max(...chartData.map(d => d.count), 1)
                  const height = (item.count / maxCount) * 100
                  const date = new Date(item.date)
                  const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center min-w-0">
                      <div
                        className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all hover:from-blue-500 hover:to-blue-300 cursor-pointer"
                        style={{ height: `${height}%`, minHeight: item.count > 0 ? '4px' : '0' }}
                        title={`${item.date}: ${item.count}`}
                      />
                      <div className="text-white/50 text-xs mt-2 h-8 flex items-start justify-center">
                        <span className="transform -rotate-45 origin-center whitespace-nowrap">{dateStr}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 text-center text-white/70 text-sm">
                Total: {chartData.reduce((sum, item) => sum + item.count, 0)} {chartType}
              </div>
            </div>

            {/* Language Distribution */}
            {languageData && languageData.length > 0 && (
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">Language Distribution</h3>
                <div className="space-y-4">
                  {languageData
                    .sort((a, b) => b.users - a.users || b.questionsAsked - a.questionsAsked)
                    .map((lang) => {
                      const maxUsers = Math.max(...languageData.map(l => l.users), 1)
                      const barWidth = maxUsers > 0 ? (lang.users / maxUsers) * 100 : 0
                      return (
                        <div key={lang.language} className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-white capitalize font-medium">{lang.language}</span>
                            <span className="text-white/70 text-sm">{lang.users} {lang.users === 1 ? 'user' : 'users'}</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2.5">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all"
                              style={{ width: `${barWidth}%`, minWidth: lang.users > 0 ? '2px' : '0' }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-white/60">
                            <span>{lang.questionsAsked} {lang.questionsAsked === 1 ? 'question' : 'questions'}</span>
                            <span>{lang.tasksCompleted} {lang.tasksCompleted === 1 ? 'task' : 'tasks'}</span>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-white/70">No chart data available</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Reports Modal Component
function ReportsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [reportType, setReportType] = useState<'users' | 'messages' | 'sessions' | 'tasks'>('users')
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const exportMutation = trpc.admin.exportReport.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.data], { type: data.mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Report exported successfully!')
    },
  })

  const { data: filteredStats } = trpc.admin.getFilteredStats.useQuery({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Reports & Export</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-white/70 text-sm mb-2">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as 'users' | 'messages' | 'sessions' | 'tasks')}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="users">Users</option>
              <option value="messages">Messages</option>
              <option value="sessions">Sessions</option>
              <option value="tasks">Tasks</option>
            </select>
          </div>

          <div>
            <label className="block text-white/70 text-sm mb-2">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'csv' | 'json')}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white/70 text-sm mb-2">Start Date (optional)</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-2">End Date (optional)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {filteredStats && (
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <h3 className="text-white font-medium mb-2">Preview Stats</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-white/60">Total Messages</div>
                  <div className="text-white font-semibold">{filteredStats.totalMessages}</div>
                </div>
                <div>
                  <div className="text-white/60">User Messages</div>
                  <div className="text-white font-semibold">{filteredStats.userMessages}</div>
                </div>
                <div>
                  <div className="text-white/60">AI Responses</div>
                  <div className="text-white font-semibold">{filteredStats.assistantMessages}</div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              exportMutation.mutate({
                type: reportType,
                format,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
              })
            }}
            disabled={exportMutation.isPending}
            className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {exportMutation.isPending ? 'Exporting...' : `Export ${reportType} as ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// Monitoring Modal Component
function MonitoringModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [logsPage, setLogsPage] = useState(1)
  const [activityPage, setActivityPage] = useState(1)
  const [logLevel, setLogLevel] = useState<'error' | 'warn' | 'info' | undefined>()

  const { data: errorLogs } = trpc.admin.getErrorLogs.useQuery({
    page: logsPage,
    limit: 20,
    level: logLevel,
  })

  const { data: adminActivity } = trpc.admin.getAdminActivity.useQuery({
    page: activityPage,
    limit: 20,
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">System Monitoring</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Error Logs */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-white">Error Logs</h3>
              <select
                value={logLevel || ''}
                onChange={(e) => setLogLevel((e.target.value || undefined) as 'error' | 'warn' | 'info' | undefined)}
                className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">All Levels</option>
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              {errorLogs && errorLogs.logs.length > 0 ? (
                <div className="space-y-2">
                  {errorLogs.logs.map((log: Record<string, unknown>, idx: number) => (
                    <div key={idx} className="text-sm text-white/70 font-mono p-2 bg-white/5 rounded">
                      {JSON.stringify(log, null, 2)}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/50 text-sm text-center py-4">No error logs available</p>
              )}
            </div>
          </div>

          {/* Admin Activity */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Admin Activity</h3>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              {adminActivity && adminActivity.activities.length > 0 ? (
                <div className="space-y-2">
                  {adminActivity.activities.map((activity: Record<string, unknown>, idx: number) => (
                    <div key={idx} className="text-sm text-white/70 p-2 bg-white/5 rounded">
                      {JSON.stringify(activity, null, 2)}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/50 text-sm text-center py-4">No admin activity logged</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Export Modal Component
function ExportModal({ isOpen, onClose, format, onFormatChange }: { 
  isOpen: boolean
  onClose: () => void
  format: 'json' | 'markdown' | 'txt'
  onFormatChange: (format: 'json' | 'markdown' | 'txt') => void
}) {
  const [isExporting, setIsExporting] = useState(false)
  const exportMutation = trpc.admin.exportData.useMutation()

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await exportMutation.mutateAsync({ format })
      if (result) {
        // Create blob and download
        const blob = new Blob([result.data], { type: result.mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = result.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success('Data exported successfully!')
        onClose()
      }
    } catch (error) {
      console.error('Export error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to export data. Please try again.'
      toast.error(errorMessage)
    } finally {
      setIsExporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Export Data</h2>
          <button 
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Export Format</label>
            <select 
              value={format} 
              onChange={(e) => onFormatChange(e.target.value as 'json' | 'markdown' | 'txt')}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="json">JSON (.json)</option>
              <option value="markdown">Markdown (.md)</option>
              <option value="txt">Plain Text (.txt)</option>
            </select>
          </div>
          
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <p className="text-white/70 text-sm">
              This will export all chat sessions and messages from the database.
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}