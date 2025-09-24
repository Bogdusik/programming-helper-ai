import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { db } from './db'
import { getCurrentUser } from './auth'
import { generateResponse } from './openai'

const t = initTRPC.create()

export const router = t.router
export const publicProcedure = t.procedure

const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      ...ctx,
      user,
    },
  })
})

export const appRouter = router({
  chat: router({
    sendMessage: protectedProcedure
      .input(z.object({ message: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const { message } = input
        const { user } = ctx

        // Save user message
        await db.message.create({
          data: {
            userId: user.id,
            role: 'user',
            content: message,
          },
        })

        // Generate AI response
        const response = await generateResponse(message)

        // Save assistant response
        await db.message.create({
          data: {
            userId: user.id,
            role: 'assistant',
            content: response,
          },
        })

        // Update user stats
        await db.stats.upsert({
          where: { userId: user.id },
          update: {
            questionsAsked: { increment: 1 },
          },
          create: {
            userId: user.id,
            questionsAsked: 1,
          },
        })

        return { response }
      }),

    getMessages: protectedProcedure
      .query(async ({ ctx }) => {
        const { user } = ctx
        
        const messages = await db.message.findMany({
          where: { userId: user.id },
          orderBy: { timestamp: 'asc' },
        })

        return messages
      }),
  }),

  stats: router({
    getUserStats: protectedProcedure
      .query(async ({ ctx }) => {
        const { user } = ctx
        
        const stats = await db.stats.findUnique({
          where: { userId: user.id },
        })

        return stats
      }),
  }),
})

export type AppRouter = typeof appRouter
