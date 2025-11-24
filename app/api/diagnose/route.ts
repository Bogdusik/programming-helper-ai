import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    status: 'checking',
    checks: {}
  }

  try {
    // Check 1: Database Connection
    try {
      await db.$queryRaw`SELECT 1`
      diagnostics.checks.databaseConnection = {
        status: 'ok',
        message: 'Database connection successful'
      }
    } catch (error) {
      diagnostics.checks.databaseConnection = {
        status: 'error',
        message: 'Database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      diagnostics.status = 'error'
    }

    // Check 2: Environment Variables
    const adminEmails = process.env.ADMIN_EMAILS
    diagnostics.checks.environmentVariables = {
      ADMIN_EMAILS: adminEmails || 'NOT SET',
      ADMIN_EMAILS_PARSED: adminEmails ? adminEmails.split(',').map(e => e.trim().toLowerCase()) : [],
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ? 'SET' : 'NOT SET',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? 'SET' : 'NOT SET'
    }

    // Check 3: User Table Structure
    try {
      const columns = await db.$queryRaw<Array<{ column_name: string, data_type: string }>>`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY column_name
      `
      
      const requiredColumns = [
        'id', 'role', 'isBlocked', 'createdAt', 'updatedAt',
        'selfReportedLevel', 'assessedLevel', 'learningGoals',
        'aiExperience', 'initialConfidence', 'preferredLanguages',
        'primaryLanguage', 'onboardingCompleted', 'onboardingStep',
        'showTooltips', 'profileCompleted'
      ]
      
      const existingColumns = columns.map(c => c.column_name)
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col))
      
      diagnostics.checks.userTableStructure = {
        status: missingColumns.length === 0 ? 'ok' : 'error',
        totalColumns: columns.length,
        existingColumns: existingColumns,
        missingColumns: missingColumns,
        message: missingColumns.length === 0 
          ? 'All required columns exist' 
          : `Missing columns: ${missingColumns.join(', ')}`
      }
      
      if (missingColumns.length > 0) {
        diagnostics.status = 'error'
      }
    } catch (error) {
      diagnostics.checks.userTableStructure = {
        status: 'error',
        message: 'Failed to check table structure',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      diagnostics.status = 'error'
    }

    // Check 4: Current User Authentication
    try {
      const user = await currentUser()
      if (user) {
        const userEmail = user.emailAddresses?.[0]?.emailAddress
        const isAdminEmail = userEmail && adminEmails 
          ? adminEmails.split(',').map(e => e.trim().toLowerCase()).includes(userEmail.toLowerCase())
          : false
        
        diagnostics.checks.currentUser = {
          status: 'ok',
          authenticated: true,
          userId: user.id,
          email: userEmail || 'No email',
          isAdminEmail: isAdminEmail,
          adminEmailsList: adminEmails ? adminEmails.split(',').map(e => e.trim().toLowerCase()) : []
        }

        // Check 5: User in Database
        try {
          const dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: {
              id: true,
              role: true,
              isBlocked: true,
              createdAt: true,
              updatedAt: true
            }
          })

          if (dbUser) {
            diagnostics.checks.userInDatabase = {
              status: 'ok',
              exists: true,
              role: dbUser.role,
              isBlocked: dbUser.isBlocked,
              createdAt: dbUser.createdAt,
              updatedAt: dbUser.updatedAt,
              shouldBeAdmin: isAdminEmail,
              roleCorrect: isAdminEmail ? dbUser.role === 'admin' : true
            }
            
            if (isAdminEmail && dbUser.role !== 'admin') {
              diagnostics.status = 'warning'
              diagnostics.checks.userInDatabase.message = 'User should be admin but role is not admin'
            }
          } else {
            diagnostics.checks.userInDatabase = {
              status: 'error',
              exists: false,
              message: 'User authenticated in Clerk but not found in database',
              shouldBeAdmin: isAdminEmail
            }
            diagnostics.status = 'error'
          }
        } catch (error) {
          diagnostics.checks.userInDatabase = {
            status: 'error',
            message: 'Failed to check user in database',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
          diagnostics.status = 'error'
        }
      } else {
        diagnostics.checks.currentUser = {
          status: 'warning',
          authenticated: false,
          message: 'Not authenticated - please sign in first'
        }
      }
    } catch (error) {
      diagnostics.checks.currentUser = {
        status: 'error',
        message: 'Failed to check authentication',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Check 6: Total Users in Database
    try {
      const userCount = await db.user.count()
      diagnostics.checks.databaseStats = {
        totalUsers: userCount
      }
    } catch (error) {
      diagnostics.checks.databaseStats = {
        status: 'error',
        message: 'Failed to get database stats',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Generate recommendations
    const recommendations: string[] = []
    
    if (!adminEmails) {
      recommendations.push('1. Set ADMIN_EMAILS environment variable in Vercel (Settings → Environment Variables)')
    }
    
    if (diagnostics.checks.userTableStructure?.missingColumns?.length > 0) {
      recommendations.push('2. Run POST /api/final-schema-sync to sync database schema')
    }
    
    if (diagnostics.checks.userInDatabase?.exists === false) {
      recommendations.push('3. Run GET /api/fix-admin-role to create user and set admin role')
    }
    
    if (diagnostics.checks.userInDatabase?.roleCorrect === false) {
      recommendations.push('4. Run GET /api/fix-admin-role to update admin role')
    }

    diagnostics.recommendations = recommendations
    diagnostics.summary = diagnostics.status === 'error' 
      ? 'Issues found - see recommendations below'
      : diagnostics.status === 'warning'
      ? 'Minor issues found - see recommendations below'
      : 'All checks passed!'

    return NextResponse.json(diagnostics, { status: 200 })
  } catch (error) {
    logger.error('Diagnostic check failed', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    
    return NextResponse.json({
      ...diagnostics,
      status: 'error',
      error: 'Diagnostic check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

