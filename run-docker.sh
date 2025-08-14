#!/bin/bash

# ========================================
# 🐳 Restaurant App Docker Setup Guide
# ========================================

# Parse command line arguments
AGENTS_CONFIG=""
NO_CACHE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --agents-config)
      AGENTS_CONFIG="$2"
      shift 2
      ;;
    --no-cache)
      NO_CACHE="--no-cache"
      shift
      ;;
    --help)
      echo "Usage: $0 [--agents-config <path-to-config-file>] [--no-cache]"
      echo ""
      echo "Options:"
      echo "  --agents-config    Path to agents configuration file (JSON)"
      echo "  --no-cache         Force complete rebuild without using Docker cache"
      echo "  --help            Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0 --agents-config ./my-agents-config.json"
      echo "  $0 --no-cache"
      echo "  $0 --agents-config ./config.json --no-cache"
      exit 0
      ;;
    *)
      echo "Unknown parameter: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo "🚀 Building Restaurant App Docker container..."

# Display build options
if [[ -n "$NO_CACHE" ]]; then
  echo "🔥 No-cache build enabled - complete rebuild will be performed"
fi

# Check if agents config file exists
if [[ -n "$AGENTS_CONFIG" ]]; then
  if [[ -f "$AGENTS_CONFIG" ]]; then
    echo "📄 Using agents config file: $AGENTS_CONFIG"
    # Copy config file to build context temporarily
    cp "$AGENTS_CONFIG" ./agents-config.json.tmp
    # Build with config file
    docker build $NO_CACHE --build-arg AGENTS_CONFIG_FILE=agents-config.json.tmp -t restaurant-app .
    # Clean up temporary file
    rm -f ./agents-config.json.tmp
  else
    echo "❌ Agents config file not found: $AGENTS_CONFIG"
    exit 1
  fi
else
  echo "ℹ️  No agents config file specified (agents can be configured via web UI)"
  # Build without config file
  docker build $NO_CACHE -t restaurant-app .
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Docker build successful!"
    echo ""
    echo "🌟 Starting the container..."
    echo ""
    
    # Run the Docker container with all required ports
    # Port 8080: Frontend (React/Vite)
    # Port 3001: Backend API server
    # Port 4317: OpenTelemetry Collector (gRPC)
    # Port 4318: OpenTelemetry Collector (HTTP)
    # Port 8126: DataDog APM traces endpoint
    docker run -it -p 8080:8080 -p 3001:3001 -p 4317:4317 -p 4318:4318 -p 8126:8126 restaurant-app
    
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
# Build with agents configuration:
# ./run-docker.sh --agents-config ./my-agents-config.json
#
# Force complete rebuild without cache:
# ./run-docker.sh --no-cache
#
# Build with agents config and no cache:
# ./run-docker.sh --agents-config ./my-agents-config.json --no-cache
#
# Run in detached mode (background):
# docker run -d -p 8080:8080 -p 3001:3001 -p 4317:4317 -p 4318:4318 -p 8126:8126 --name restaurant-app restaurant-app
#
# Run with volume mount for development (Windows example):
# docker run -it --rm -p 8080:8080 -p 3001:3001 -p 4317:4317 -p 4318:4318 -p 8126:8126 -v C:\path\to\your\project:/app:rw restaurant-app
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
# OpenTelemetry Collector Metrics: http://localhost:8888/metrics
# OTEL Traces Endpoint: http://localhost:4318/v1/traces
# Test HTTP Errors: Go to Config page in the app
#
# ========================================
# 🔧 Quick Commands
# ========================================
#
# Build and run in one command:
# docker build -t restaurant-app . && docker run -it -p 8080:8080 -p 3001:3001 -p 4317:4317 -p 4318:4318 -p 8126:8126 restaurant-app
#
# Use the included test script:
# chmod +x docker-test.sh && ./docker-test.sh
#
# ========================================