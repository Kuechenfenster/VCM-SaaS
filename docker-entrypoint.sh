#!/bin/sh
set -e
set -x

echo "Running database migrations..."
npx prisma migrate deploy || {
  echo "Migration failed, sleeping for log capture..."
  sleep 60
  exit 1
}

# Seed only when explicitly requested or on first run. Default: do not auto-seed in production.
if [ "$RUN_SEED" = "true" ]; then
  echo "Seeding database..."
  npx tsx prisma/seed.ts || {
    echo "Seeding failed, sleeping for log capture..."
    sleep 60
    exit 1
  }
fi

# Execute the container's main command
exec "$@"
