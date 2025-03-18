#!/bin/bash
set -e

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 5

# Run migrations
echo "Running database migrations..."
bun run db:migrate

# Start the application
echo "Starting the application..."
exec "$@"