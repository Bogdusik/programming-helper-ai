/**
 * Helper types for tRPC responses
 * These types help avoid "Type instantiation is excessively deep" errors
 * by providing explicit type definitions for common tRPC query results
 */

import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from './trpc'

// Infer all router outputs
type RouterOutputs = inferRouterOutputs<AppRouter>

// Task-related types
export type TaskProgress = RouterOutputs['task']['getTaskProgress'][number]
export type Task = RouterOutputs['task']['getTask']
export type Tasks = RouterOutputs['task']['getTasks']

// Assessment types
export type Assessment = RouterOutputs['assessment']['getAssessments'][number]
export type Assessments = RouterOutputs['assessment']['getAssessments']

// Chat session types
export type ChatSession = RouterOutputs['chat']['getSessions'][number]
export type ChatSessions = RouterOutputs['chat']['getSessions']

// Admin types
export type AdminTask = RouterOutputs['admin']['getAllTasks']['tasks'][number]
export type AdminTasks = RouterOutputs['admin']['getAllTasks']['tasks']

// User profile types
export type UserProfile = RouterOutputs['profile']['getProfile']

