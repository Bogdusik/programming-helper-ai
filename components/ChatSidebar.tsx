'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { trpc } from '../lib/trpc-client'

interface ChatSession {
  id: string
  title: string
  createdAt: string | Date
  updatedAt: string | Date
  messages: Array<{
    id: string
    content: string
    role: string
    timestamp: string | Date
  }>
}

interface ChatSidebarProps {
  currentSessionId?: string
  onSessionSelect: (sessionId: string) => void
  onNewChat: () => void
  refreshTrigger?: number // Add trigger for manual refresh
}

export default function ChatSidebar({ currentSessionId, onSessionSelect, onNewChat, refreshTrigger }: ChatSidebarProps) {
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const utils = trpc.useUtils()
  const { data: sessions = [], refetch: refetchSessions } = trpc.chat.getSessions.useQuery()
  const deleteSessionMutation = trpc.chat.deleteSession.useMutation()
  const updateTitleMutation = trpc.chat.updateSessionTitle.useMutation()

  // Auto-refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger) {
      refetchSessions()
    }
  }, [refreshTrigger, refetchSessions])

  // Optimized: Only refetch when window regains focus
  // This reduces unnecessary API calls
  useEffect(() => {
    const handleFocus = () => {
      refetchSessions()
    }
    
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only add listener once, refetchSessions is stable from React Query

  const handleDeleteSession = async (sessionId: string) => {
    // Use toast.promise for better UX
    const deletePromise = deleteSessionMutation.mutateAsync({ sessionId })
    
    toast.promise(deletePromise, {
      loading: 'Deleting chat...',
      success: (result) => {
        refetchSessions()
        // Invalidate tasks and stats queries to update UI
        utils.task.getTasks.invalidate()
        utils.task.getTaskProgress.invalidate()
        utils.stats.getUserStats.invalidate()
        
        if (currentSessionId === sessionId) {
          onNewChat()
        }
        
        const message = result.tasksReset > 0 
          ? `Chat deleted. ${result.tasksReset} task(s) reset to "Start Task".`
          : 'Chat deleted successfully'
        return message
      },
      error: (error: unknown) => {
        console.error('Error deleting session:', error)
        return error instanceof Error ? error.message : 'Failed to delete chat. Please try again.'
      },
    })
  }

  const handleEditTitle = (session: ChatSession) => {
    setIsEditing(session.id)
    setEditTitle(session.title)
  }

  const handleSaveTitle = async (sessionId: string) => {
    if (editTitle.trim()) {
      try {
        await updateTitleMutation.mutateAsync({ 
          sessionId, 
          title: editTitle.trim() 
        })
        await refetchSessions()
      } catch (error) {
        console.error('Error updating title:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to update title. Please try again.'
        toast.error(errorMessage)
      }
    }
    setIsEditing(null)
    setEditTitle('')
  }

  const handleCancelEdit = () => {
    setIsEditing(null)
    setEditTitle('')
  }

  // OPTIMIZATION: Memoize formatDate to avoid recreating on every render
  const formatDate = useCallback((date: Date) => {
    const now = new Date()
    const diffInHours = (now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 168) { // 7 days
      return new Date(date).toLocaleDateString([], { weekday: 'short' })
    } else {
      return new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }, [])

  return (
    <div className="w-80 bg-slate-900/50 border-r border-white/10 flex flex-col h-full min-h-0 relative z-10 flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <button
          onClick={onNewChat}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25 flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Chat</span>
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-white/60 mb-2">No chats yet</div>
            <div className="text-sm text-white/40">Start a new conversation!</div>
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`group relative rounded-lg transition-all duration-200 ${
                  currentSessionId === session.id
                    ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30'
                    : 'hover:bg-white/5'
                }`}
              >
                <button
                  onClick={() => onSessionSelect(session.id)}
                  className="w-full p-3 text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-12">
                      {isEditing === session.id ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => handleSaveTitle(session.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveTitle(session.id)
                            } else if (e.key === 'Escape') {
                              handleCancelEdit()
                            }
                          }}
                          className="w-full bg-transparent text-white text-sm font-medium focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <div className="text-white text-sm font-medium truncate">
                          {session.title}
                        </div>
                      )}
                      <div className="text-white/50 text-xs mt-1">
                        {formatDate(new Date(session.updatedAt))}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Action buttons */}
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-800/80 backdrop-blur-sm rounded-md p-1">
                  <div className="flex space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditTitle(session)
                      }}
                      className="p-1.5 hover:bg-blue-500/20 rounded transition-colors duration-200"
                      title="Rename chat"
                    >
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteSession(session.id)
                      }}
                      className="p-1.5 hover:bg-red-500/20 rounded transition-colors duration-200"
                      title="Delete chat"
                    >
                      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-white/40 text-center">
          {sessions.length} chat{sessions.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}
