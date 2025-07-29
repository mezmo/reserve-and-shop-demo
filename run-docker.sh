#!/bin/bash

# ========================================
# 🐳 Restaurant App Docker Setup Guide
# ========================================

echo "🚀 Building Restaurant App Docker container..."

# Build the Docker image (dependencies installed during build for faster startup)
docker build -t restaurant-app .

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Docker build successful!"
    echo ""
    echo "🌟 Starting the container..."
    echo ""
    
    # Run the Docker container with both frontend and backend ports
    # Port 8080: Frontend (React/Vite)
    # Port 3001: Backend API server
    docker run -p 8080:8080 -p 3001:3001 restaurant-app
    
else
    echo ""
    echo "❌ Docker build failed!"
    echo "Please check the build output above for errors."
    exit 1
fi

# ========================================
# 📋 Alternative Docker Commands
# ========================================
#
# Run in detached mode (background):
# docker run -d -p 8080:8080 -p 3001:3001 --name restaurant-app restaurant-app
#
# Run with volume mount for development (Windows example):
# docker run -it --rm -p 8080:8080 -p 3001:3001 -v C:\path\to\your\project:/app:rw restaurant-app
#
# View logs:
# docker logs restaurant-app
#
# Stop the container:
# docker stop restaurant-app
#
# Remove the container:
# docker rm restaurant-app
#
# Access container shell:
# docker exec -it restaurant-app bash
#
# View performance logs:
# docker exec -it restaurant-app tail -f /tmp/restaurant-performance.log
#
# Copy performance logs to host:
# docker cp restaurant-app:/tmp/restaurant-performance.log ./performance.log
#
# ========================================
# 🌐 Access Points
# ========================================
#
# Frontend Application: http://localhost:8080
# Backend API: http://localhost:3001/api
# API Health Check: http://localhost:3001/api/health
# Test HTTP Errors: Go to Config page in the app
#
# ========================================
# 🔧 Quick Commands
# ========================================
#
# Build and run in one command:
# docker build -t restaurant-app . && docker run -p 8080:8080 -p 3001:3001 restaurant-app
#
# Use the included test script:
# chmod +x docker-test.sh && ./docker-test.sh
#
# ========================================