#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

# Seed only when explicitly requested or on first run. Default: do not auto-seed in production.
if [ "$RUN_SEED" = "true" ]; then
  echo "Seeding database..."
  npx tsx prisma/seed.ts
fi

# Execute the container's main command
exec "$@"
