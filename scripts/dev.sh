#!/bin/bash
# Start all services for development

echo "Starting Münzsammlung development environment..."

# Start PostgreSQL
echo "Starting PostgreSQL..."
docker compose up -d

# Wait for DB
echo "Waiting for database..."
sleep 2

# Start web app and camera service concurrently
echo "Starting web app and camera service..."
pnpm dev
