-- Migration: Create rate_limits table for database-based rate limiting
-- This enables rate limiting to work in serverless environments

CREATE TABLE IF NOT EXISTS rate_limits (
  identifier TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_time TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_time 
ON rate_limits(reset_time);

-- Clean up expired records (older than 1 hour)
-- This can be run periodically or via a cron job
DELETE FROM rate_limits WHERE reset_time < NOW() - INTERVAL '1 hour';

