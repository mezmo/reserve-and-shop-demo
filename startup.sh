#!/bin/bash

echo "========================================="
echo "🚀 Bella Vista Restaurant App Starting"
echo "========================================="
echo ""

# Install dependencies if node_modules doesn't exist or package.json is newer
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "🔄 Updating browserslist database..."
    npx update-browserslist-db@latest
    echo ""
fi

# Start vite in the background with output redirected
echo "🌐 Starting development server..."
npx vite > /tmp/vite.log 2>&1 &

echo ""
echo "✅ Development server started successfully!"
echo ""
echo "📊 PERFORMANCE LOGS LOCATION:"
echo "   Container Path: /tmp/restaurant-performance.log"
echo "   View logs: docker exec -it <container_name> tail -f /tmp/restaurant-performance.log"
echo "   Copy logs: docker cp <container_name>:/tmp/restaurant-performance.log ./performance.log"
echo ""
echo "📈 VITE DEVELOPMENT SERVER LOGS:"
echo "   Container Path: /tmp/vite.log"  
echo "   View logs: docker exec -it <container_name> tail -f /tmp/vite.log"
echo "   Copy logs: docker cp <container_name>:/tmp/vite.log ./vite.log"
echo ""
echo "⚙️  CONFIGURATION:"
echo "   Configure logging format in the Config page of the app"
echo "   Access app at: http://localhost:8080"
echo ""
echo "🔍 USEFUL COMMANDS:"
echo "   View all logs: ls -la /tmp/*.log"
echo "   Monitor performance: watch 'tail -5 /tmp/restaurant-performance.log'"
echo ""
echo "========================================="
echo ""

# Keep the container running with bash
exec bash