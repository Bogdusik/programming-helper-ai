#!/bin/bash

# Script to import data to Neon database
# Usage: ./import-to-neon.sh

echo "Importing data to Neon database..."
echo ""
echo "Please enter your Neon DATABASE_URL:"
read -r NEON_URL

if [ -z "$NEON_URL" ]; then
  echo "❌ Error: DATABASE_URL is required"
  exit 1
fi

echo ""
echo "Step 1: Syncing schema first..."
echo "Call /api/final-schema-sync on Vercel to create tables"
echo ""
read -p "Press Enter after you've called /api/final-schema-sync..."

echo ""
echo "Step 2: Importing data..."
echo "⚠️  This will import data from local-db-data.sql"
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled"
  exit 1
fi

# Import data (schema should already exist)
psql "$NEON_URL" < local-db-data.sql

echo ""
echo "✅ Data imported successfully!"
echo ""
echo "Next steps:"
echo "1. Check /api/diagnose to verify data"
echo "2. Check /api/check-database to see imported data"

