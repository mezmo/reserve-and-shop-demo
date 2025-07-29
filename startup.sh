#!/bin/bash
# Remove set -e to prevent script from exiting on errors - we'll handle them manually
# set -e  # Exit on any error

# Enable debug output
set -x

echo "========================================="
echo "🚀 Bella Vista Restaurant App Starting"
echo "========================================="
echo ""

# Verify Node.js and npm versions
echo "📋 Environment Info:"
echo "   Node.js: $(node --version)"
echo "   npm: $(npm --version)"
echo ""

# Check if node_modules exists (they should from Docker build)
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules not found, installing dependencies..."
    npm install --silent --no-audit --no-fund || {
        echo "❌ Failed to install dependencies. Trying without silent mode..."
        npm install --no-audit --no-fund
    }
else
    echo "✅ Dependencies already installed ($(ls node_modules | wc -l) packages)"
fi

# Verify key dependencies
echo ""
echo "🔍 Verifying dependencies..."
if [ ! -d "node_modules/express" ]; then
    echo "❌ Express not found, installing server dependencies..."
    npm install express cors --silent
fi

if [ ! -d "node_modules/concurrently" ]; then
    echo "❌ Concurrently not found, installing dev dependencies..."
    npm install concurrently --silent
fi

# Ensure temp directory exists for performance logs
mkdir -p /tmp/codeuser
chmod 755 /tmp/codeuser

echo "🔍 Debug info:"
echo "   Current user: $(whoami)"
echo "   Working directory: $(pwd)"
echo "   Temp directory: $(ls -la /tmp/codeuser 2>/dev/null || echo 'Not found')"
echo "   Node modules: $([ -d node_modules ] && echo 'Present' || echo 'Missing')"

echo ""
echo "✅ Setup complete!"
echo ""

# Start the development server
echo "🌟 Starting development server..."
echo "📍 Frontend: http://localhost:8080"
echo "📍 Backend API: http://localhost:3001/api"
echo "📍 Health Check: http://localhost:3001/api/health"
echo ""
echo "🔧 Available npm scripts:"
npm run --silent 2>/dev/null | grep -E "^\s+(dev|server|client)" || echo "   dev, server, client"
echo ""

# Start the application in the background
nohup npm run dev > /tmp/codeuser/app.log 2>&1 &
DEV_PID=$!

# Function to cleanup background processes on exit
cleanup() {
    echo "🛑 Stopping services..."
    kill $DEV_PID 2>/dev/null || true
    exit 0
}

# Set up trap to cleanup on exit
trap cleanup SIGTERM SIGINT

# Wait a moment for services to start
sleep 5

# Check if the process is still running
if kill -0 $DEV_PID 2>/dev/null; then
    echo "🎉 Services started successfully!"
    echo "💡 Development server is running in the background (PID: $DEV_PID)"
    echo "📋 Logs available at: /tmp/codeuser/app.log"
    echo "🔧 You can now run commands. Type 'exit' to stop the container."
    echo ""
    
    # Show the first few lines of logs to verify it's working
    echo "📄 Recent logs:"
    tail -n 10 /tmp/codeuser/app.log 2>/dev/null || echo "No logs yet"
    echo ""
else
    echo "❌ Failed to start development server. Check logs:"
    cat /tmp/codeuser/app.log 2>/dev/null || echo "No log file found"
    echo ""
    echo "🔧 Falling back to interactive shell for debugging..."
fi

# Always drop into an interactive shell (even if dev server failed)
echo "🐚 Starting interactive shell..."

# Keep container alive with a proper interactive bash session
# This ensures stdin/stdout/stderr are properly connected
if [ -t 0 ]; then
    # We have a TTY, start interactive bash
    exec bash -i
else
    # No TTY, but keep container alive
    echo "⚠️  No TTY detected. Starting bash in non-interactive mode."
    echo "💡 Try running: docker exec -it <container-name> bash"
    exec bash -c "while true; do sleep 30; done"
fi