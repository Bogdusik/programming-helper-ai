/**
 * Required environment variables for the application
 */
const REQUIRED_ENV_VARS = [
  'OPENAI_API_KEY',
  'DATABASE_URL',
] as const

/**
 * Optional environment variables (with defaults or graceful degradation)
 */
const OPTIONAL_ENV_VARS = [
  'RESEND_API_KEY',
  'CONTACT_EMAIL',
] as const

/**
 * Validates that all required environment variables are set
 * @throws Error if any required variables are missing
 */
function validateEnv(): void {
  const missing: string[] = []

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    )
  }
}

/**
 * Validates optional environment variables and logs warnings if missing
 * This allows the app to run with reduced functionality
 */
function validateOptionalEnv(): void {
  for (const key of OPTIONAL_ENV_VARS) {
    if (!process.env[key]) {
      // Log warning but don't throw - these are optional
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Optional environment variable ${key} is not set`)
      }
    }
  }
}

// Validate on module load (only in production for required vars)
if (process.env.NODE_ENV === 'production') {
  validateEnv()
} else {
  // In development, validate optional vars too
  validateOptionalEnv()
}

export { validateEnv, validateOptionalEnv }

