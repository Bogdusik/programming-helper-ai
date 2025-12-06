-- Add examples and constraints fields to programming_tasks table
ALTER TABLE "programming_tasks" 
ADD COLUMN IF NOT EXISTS "examples" JSONB,
ADD COLUMN IF NOT EXISTS "constraints" TEXT[] DEFAULT ARRAY[]::TEXT[];

