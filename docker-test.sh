#!/bin/bash

echo "🧪 Testing Docker setup..."

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t restaurant-app .

if [ $? -eq 0 ]; then
    echo "✅ Docker build successful!"
    
    echo "🚀 You can now run the container with:"
    echo "   docker run -p 8080:8080 -p 3001:3001 -p 4317:4317 -p 4318:4318 -p 8126:8126 restaurant-app"
    echo ""
    echo "📍 Once running, access:"
    echo "   Frontend: http://localhost:8080"
    echo "   Backend API: http://localhost:3001/api"
    echo "   Health Check: http://localhost:3001/api/health"
    echo "   OpenTelemetry Collector: http://localhost:4317 (gRPC), http://localhost:4318 (HTTP)"
    echo "   DataDog APM: http://localhost:8126"
else
    echo "❌ Docker build failed!"
    exit 1
fi