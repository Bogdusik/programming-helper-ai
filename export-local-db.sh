#!/bin/bash

# Script to export data from local PostgreSQL database
# Usage: ./export-local-db.sh

echo "Exporting data from local database..."

# Export schema (structure)
pg_dump "postgresql://bogdusikk@localhost:5432/programming_helper_ai" \
  --schema-only \
  --no-owner \
  --no-privileges \
  > local-db-schema.sql

echo "✅ Schema exported to local-db-schema.sql"

# Export data only
pg_dump "postgresql://bogdusikk@localhost:5432/programming_helper_ai" \
  --data-only \
  --no-owner \
  --no-privileges \
  > local-db-data.sql

echo "✅ Data exported to local-db-data.sql"

# Export everything (schema + data)
pg_dump "postgresql://bogdusikk@localhost:5432/programming_helper_ai" \
  --no-owner \
  --no-privileges \
  > local-db-full.sql

echo "✅ Full backup exported to local-db-full.sql"
echo ""
echo "Next steps:"
echo "1. Review the exported files"
echo "2. Import to Neon database using: ./import-to-neon.sh"

