// Environment variables validation
function validateEnv() {
  const required = ['OPENAI_API_KEY', 'DATABASE_URL']
  const missing: string[] = []

  for (const key of required) {
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

// Validate on module load (only in production)
if (process.env.NODE_ENV === 'production') {
  validateEnv()
}

export { validateEnv }

