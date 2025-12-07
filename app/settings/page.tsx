'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar'
import MinimalBackground from '../../components/MinimalBackground'
import LoadingSpinner from '../../components/LoadingSpinner'
import UserProfileModal, { ProfileData } from '../../components/UserProfileModal'
import { trpc } from '../../lib/trpc-client'
import { useBlockedStatus } from '../../hooks/useBlockedStatus'
import toast from 'react-hot-toast'
import { clientLogger } from '../../lib/client-logger'

export default function SettingsPage() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const { isBlocked, isLoading: isCheckingBlocked } = useBlockedStatus({
    skipPaths: ['/blocked', '/contact'],
    enabled: isSignedIn && isLoaded,
  })
  const [showProfileModal, setShowProfileModal] = useState(false)
  
  const { data: userProfile, refetch: refetchProfile } = trpc.profile.getProfile.useQuery(undefined, {
    enabled: isSignedIn,
  })
  
  const updateProfileMutation = trpc.profile.updateProfile.useMutation()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/')
      return
    }
    
    // Redirect blocked users to blocked page
    if (isLoaded && isSignedIn && isBlocked) {
      router.replace('/blocked')
    }
  }, [isLoaded, isSignedIn, isBlocked, router])

  const handleProfileComplete = async (data: ProfileData) => {
    try {
      await updateProfileMutation.mutateAsync({
        experience: data.experience,
        focusAreas: data.focusAreas,
        confidence: data.confidence,
        aiExperience: data.aiExperience,
        preferredLanguages: data.preferredLanguages,
        primaryLanguage: data.primaryLanguage,
      })
      setShowProfileModal(false)
      await refetchProfile()
      toast.success('Profile updated successfully! 🎉')
    } catch (error) {
      clientLogger.error('Error updating profile:', error)
      toast.error('Failed to update profile. Please try again.')
    }
  }

  if (!isLoaded || (isSignedIn && isCheckingBlocked) || (isSignedIn && isBlocked)) {
    return <LoadingSpinner />
  }

  if (!isSignedIn) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      <Navbar />
      <MinimalBackground />

      <div className="relative min-h-screen flex items-center justify-center pt-20 pb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">Account Settings</h1>
            <p className="text-white/70 text-lg">Manage your profile and preferences</p>
          </div>

          <div className="glass rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Account Information</h2>
                <p className="text-white/60 text-sm">Basic account details are managed by Clerk</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-white/70">Email & Password</span>
                <span className="text-white/40 text-sm">Managed by Clerk</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-white/70">Name</span>
                <span className="text-white/40 text-sm">Managed by Clerk</span>
              </div>
            </div>
            <p className="text-white/50 text-xs mt-4">
              To change your email, password, or name, click on your profile icon in the top right corner and select &quot;Manage account&quot;
            </p>
          </div>

          <div className="glass rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Programming Profile</h2>
                <p className="text-white/60 text-sm">Customize your learning preferences and languages</p>
              </div>
              <button
                onClick={() => setShowProfileModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Edit Profile
              </button>
            </div>
            
            {userProfile && (
              <div className="space-y-4">
                <div className={`grid gap-4 ${userProfile.initialConfidence ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <div className="text-white/60 text-xs mb-1">Experience Level</div>
                    <div className="text-white font-medium capitalize">
                      {userProfile.selfReportedLevel?.replace(/_/g, ' ') || 'Not set'}
                    </div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <div className="text-white/60 text-xs mb-1">AI Experience</div>
                    <div className="text-white font-medium capitalize">
                      {userProfile.aiExperience?.replace(/_/g, ' ') || 'Not set'}
                    </div>
                  </div>
                  {userProfile.initialConfidence && (
                    <div className="p-3 bg-white/5 rounded-lg">
                      <div className="text-white/60 text-xs mb-1">Confidence</div>
                      <div className="text-white font-medium">
                        {userProfile.initialConfidence}/5
                      </div>
                    </div>
                  )}
                </div>
                
                {userProfile.preferredLanguages && userProfile.preferredLanguages.length > 0 && (
                  <div className="p-3 bg-white/5 rounded-lg">
                    <div className="text-white/60 text-xs mb-2">Preferred Languages</div>
                    <div className="flex flex-wrap gap-2">
                      {userProfile.preferredLanguages.map((lang) => (
                        <span
                          key={lang}
                          className={`px-3 py-1 rounded-full text-sm ${
                            userProfile.primaryLanguage === lang
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {lang === 'csharp' ? 'C#' : lang === 'cpp' ? 'C++' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                          {userProfile.primaryLanguage === lang && ' (Primary)'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {userProfile.learningGoals && userProfile.learningGoals.length > 0 && (
                  <div className="p-3 bg-white/5 rounded-lg">
                    <div className="text-white/60 text-xs mb-2">Learning Goals</div>
                    <div className="flex flex-wrap gap-2">
                      {userProfile.learningGoals.map((goal) => (
                        <span
                          key={goal}
                          className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm"
                        >
                          {goal}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showProfileModal && (
        <UserProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onComplete={handleProfileComplete}
          isOptional={true}
          initialData={userProfile ? {
            experience: userProfile.selfReportedLevel || '',
            focusAreas: userProfile.learningGoals || [],
            confidence: userProfile.initialConfidence || 3,
            aiExperience: userProfile.aiExperience || '',
            preferredLanguages: userProfile.preferredLanguages || [],
            primaryLanguage: userProfile.primaryLanguage ?? undefined,
          } : undefined}
        />
      )}
    </div>
  )
}

