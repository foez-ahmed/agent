#!/usr/bin/env bash

# Exit on any error
set -e

# Change to the directory containing this script (project root)
cd "$(dirname "$0")"

# Install backend dependencies if a backend exists
if [ -f "./backend/package.json" ]; then
  echo "Installing backend dependencies..."
  npm install --prefix backend
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
npm install --prefix frontend

# Build the frontend for production
echo "Building frontend..."
npm run build --prefix frontend

# Serve the built frontend using a static server
# Start static server (optionally specify port)

echo "Starting static server..."
# Default port
PORT=3000
# Parse arguments for custom port
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --port) PORT="$2"; shift ;;
    *) ;;
  esac
  shift
done
npx serve -s frontend/dist --port $PORT

# Optional: run development servers
# To start the Vite dev server (frontend) with hot reload, uncomment the line below:
# npm run dev --prefix frontend
# To start the backend development server, uncomment the line below:
# npm run dev --prefix backend
