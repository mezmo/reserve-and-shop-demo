#!/bin/bash

# Install dependencies if node_modules doesn't exist or package.json is newer
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo "Updating browserslist database..."
    npx update-browserslist-db@latest
fi

# Start vite in the background with output redirected
echo "Starting development server..."
npx vite > /tmp/vite.log 2>&1 &

echo "Development server started in background. Logs available at: /tmp/vite.log"
echo "You can view logs with: tail -f /tmp/vite.log"

# Keep the container running with bash
exec bash