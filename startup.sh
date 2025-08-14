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

# Ensure temp directory exists for performance logs and Winston logs
mkdir -p /tmp/codeuser
chmod 755 /tmp/codeuser

# Create structured log files with proper permissions
# Server operational logs
touch /tmp/codeuser/server.log
touch /tmp/codeuser/server-error.log

# Application business logs  
touch /tmp/codeuser/access.log
touch /tmp/codeuser/events.log
touch /tmp/codeuser/metrics.log
touch /tmp/codeuser/errors.log
touch /tmp/codeuser/performance.log
touch /tmp/codeuser/app.log
chmod 644 /tmp/codeuser/*.log

echo "📝 Logging structure configured:"
echo ""
echo "🖥️  Server Logs (Operations):"
echo "   Server operations: /tmp/codeuser/server.log"
echo "   Server errors: /tmp/codeuser/server-error.log"
echo ""
echo "📊 Application Logs (Business):"
echo "   HTTP requests: /tmp/codeuser/access.log"
echo "   Business events: /tmp/codeuser/events.log"
echo "   Performance metrics: /tmp/codeuser/metrics.log"
echo "   Application errors: /tmp/codeuser/errors.log"
echo "   Performance timing: /tmp/codeuser/performance.log"
echo "   General app logs: /tmp/codeuser/app.log"

# Load agent configuration from file if available
load_agents_config() {
    local config_file="/app/agents-config.json"
    
    if [ -f "$config_file" ]; then
        echo "🔍 Found agents configuration file, loading settings..."
        
        # Use jq to parse JSON if available, otherwise basic parsing
        if command -v jq >/dev/null 2>&1; then
            # Get default config name
            local default_config=$(jq -r '.defaultConfig // "development"' "$config_file")
            echo "📋 Default configuration: $default_config"
            
            # Extract Mezmo configuration
            local mezmo_enabled=$(jq -r ".configurations.$default_config.mezmo.enabled // false" "$config_file")
            local mezmo_key=$(jq -r ".configurations.$default_config.mezmo.ingestionKey // \"\"" "$config_file")
            local mezmo_host=$(jq -r ".configurations.$default_config.mezmo.host // \"logs.mezmo.com\"" "$config_file")
            local mezmo_tags=$(jq -r ".configurations.$default_config.mezmo.tags // \"restaurant-app,demo\"" "$config_file")
            
            # Extract OTEL configuration
            local otel_enabled=$(jq -r ".configurations.$default_config.otel.enabled // false" "$config_file")
            local otel_service=$(jq -r ".configurations.$default_config.otel.serviceName // \"restaurant-app\"" "$config_file")
            local otel_tags=$(jq -r ".configurations.$default_config.otel.tags // \"restaurant-app,otel\"" "$config_file")
            
            # Extract Datadog configuration
            local datadog_enabled=$(jq -r ".configurations.$default_config.datadog.enabled // false" "$config_file")
            local datadog_api_key=$(jq -r ".configurations.$default_config.datadog.apiKey // \"\"" "$config_file")
            local datadog_route_id=$(jq -r ".configurations.$default_config.datadog.routeId // \"5c7e0854-7705-11f0-b8ef-0260f52d7685\"" "$config_file")
            local datadog_service=$(jq -r ".configurations.$default_config.datadog.service // \"restaurant-app\"" "$config_file")
            local datadog_env=$(jq -r ".configurations.$default_config.datadog.env // \"development\"" "$config_file")
            local datadog_tags=$(jq -r ".configurations.$default_config.datadog.tags // \"restaurant-app,datadog\"" "$config_file")
            local datadog_logs_enabled=$(jq -r ".configurations.$default_config.datadog.logCollection.enabled // false" "$config_file")
            local datadog_apm_enabled=$(jq -r ".configurations.$default_config.datadog.apmTracing.enabled // false" "$config_file")
            local datadog_process_enabled=$(jq -r ".configurations.$default_config.datadog.processMonitoring.enabled // false" "$config_file")
            
            echo "🔍 Datadog config check: enabled=$datadog_enabled, key=${datadog_api_key:0:8}..."
            
            # Configure agents if keys are provided
            if [ "$mezmo_enabled" = "true" ] && [ -n "$mezmo_key" ] && [ "$mezmo_key" != "null" ] && [ "$mezmo_key" != "" ]; then
                echo "🔧 Configuring Mezmo agent from file..."
                
                # Create LogDNA environment file
                cat > /etc/logdna/logdna.env << EOF
LOGDNA_INGESTION_KEY=$mezmo_key
LOGDNA_HOST=$mezmo_host
LOGDNA_TAGS=$mezmo_tags
LOGDNA_LOGDIR=/tmp/codeuser
LOGDNA_INCLUDE=*.log
EOF
                echo "✅ Mezmo agent pre-configured with key ${mezmo_key:0:8}..."
            fi
            
            if [ "$otel_enabled" = "true" ]; then
                echo "🔧 OTEL Collector configuration found in file (will be applied when enabled via API)"
            fi
            
            if [ "$datadog_enabled" = "true" ] && [ -n "$datadog_api_key" ] && [ "$datadog_api_key" != "null" ] && [ "$datadog_api_key" != "" ]; then
                echo "🔧 Configuring Datadog agent from file..."
                
                # Create Datadog environment file
                cat > /tmp/codeuser/datadog-agent.env << EOF
DD_API_KEY=$datadog_api_key
DD_ROUTE_ID=$datadog_route_id
DD_SERVICE=$datadog_service
DD_ENV=$datadog_env
DD_VERSION=1.0.0
DD_TAGS=$datadog_tags
DD_LOGS_ENABLED=$datadog_logs_enabled
DD_APM_ENABLED=$datadog_apm_enabled
DD_PROCESS_AGENT_ENABLED=$datadog_process_enabled
DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL=true
DD_LOGS_CONFIG_USE_HTTP=true
DD_CONF_DIR=/tmp/codeuser/datadog-agent
DD_RUN_PATH=/tmp/codeuser/datadog-run
DD_LOG_FILE=/tmp/codeuser/datadog-agent.log
EOF
                
                # Copy and substitute environment variables in the Datadog configuration
                envsubst < /app/datadog-agent.yaml > /tmp/codeuser/datadog-agent/datadog.yaml
                envsubst < /app/datadog-agent.yaml > /etc/datadog-agent/datadog.yaml
                
                # Copy and substitute environment variables in the logs configuration
                envsubst < /app/datadog-logs.yaml > /tmp/codeuser/datadog-agent/conf.d/logs.d/logs.yaml
                envsubst < /app/datadog-logs.yaml > /etc/datadog-agent/conf.d/logs.d/logs.yaml
                
                # Create auth token file for agent status commands
                echo "$(openssl rand -hex 32)" > /etc/datadog-agent/auth_token
                echo "$(openssl rand -hex 32)" > /tmp/codeuser/datadog-agent/auth_token
                chmod 600 /etc/datadog-agent/auth_token /tmp/codeuser/datadog-agent/auth_token
                
                # Create IPC certificate files for agent communication
                openssl req -x509 -newkey rsa:2048 -keyout /etc/datadog-agent/ipc_key.pem -out /etc/datadog-agent/ipc_cert.pem -days 365 -nodes -subj "/CN=datadog-agent"
                openssl req -x509 -newkey rsa:2048 -keyout /tmp/codeuser/datadog-agent/ipc_key.pem -out /tmp/codeuser/datadog-agent/ipc_cert.pem -days 365 -nodes -subj "/CN=datadog-agent"
                chmod 600 /etc/datadog-agent/ipc_*.pem /tmp/codeuser/datadog-agent/ipc_*.pem
                
                echo "✅ Datadog agent pre-configured with key ${datadog_api_key:0:8}..."
            fi
            
        else
            echo "⚠️  jq not available for JSON parsing, skipping detailed config loading"
            echo "💡 Agents can still be configured via the web interface"
        fi
    else
        echo "ℹ️  No agents configuration file found (/app/agents-config.json)"
        echo "💡 Agents can be configured via the web interface at /agents"
    fi
}

# Load configuration
load_agents_config

# LogDNA agent management functions
start_logdna_agent() {
    local config_file="/etc/logdna/config.yaml"
    local env_file="/etc/logdna/logdna.env"
    
    echo "🔍 Checking LogDNA agent configuration..."
    
    # Check if configuration exists
    if [ -f "$env_file" ]; then
        echo "📋 Found LogDNA configuration, starting agent..."
        
        # Source environment variables
        set -a
        source "$env_file"
        set +a
        
        # Start LogDNA agent in background (package manager installs to /usr/bin)
        nohup /usr/bin/logdna-agent > /tmp/codeuser/logdna-agent.log 2>&1 &
        LOGDNA_PID=$!
        
        # Save PID for later management
        echo $LOGDNA_PID > /tmp/codeuser/logdna-agent.pid
        
        echo "✅ LogDNA agent started (PID: $LOGDNA_PID)"
        
        # Wait a moment and check if it's still running
        sleep 2
        if kill -0 $LOGDNA_PID 2>/dev/null; then
            echo "🔗 LogDNA agent is running and forwarding logs"
        else
            echo "❌ LogDNA agent failed to start, check logs at /tmp/codeuser/logdna-agent.log"
        fi
    else
        echo "⚠️  No LogDNA configuration found, skipping agent startup"
        echo "💡 Configure LogDNA in the web interface at /config"
    fi
}

stop_logdna_agent() {
    local pid_file="/tmp/codeuser/logdna-agent.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            echo "🛑 Stopping LogDNA agent (PID: $pid)..."
            kill $pid
            rm -f "$pid_file"
            echo "✅ LogDNA agent stopped"
        else
            echo "⚠️  LogDNA agent PID $pid not running"
            rm -f "$pid_file"
        fi
    else
        echo "⚠️  No LogDNA agent PID file found"
    fi
}

# OpenTelemetry Collector management functions
start_otel_collector() {
    local config_file="/etc/otelcol/config.yaml"
    
    echo "🔍 Checking OpenTelemetry Collector configuration..."
    
    # Check if configuration exists
    if [ -f "$config_file" ]; then
        echo "📊 Found OTEL Collector configuration, starting collector..."
        
        # Start OTEL Collector in background
        nohup /usr/local/bin/otelcol-contrib --config="$config_file" > /tmp/codeuser/otel-collector.log 2>&1 &
        OTEL_PID=$!
        
        # Save PID for later management
        echo $OTEL_PID > /tmp/codeuser/otel-collector.pid
        
        echo "✅ OpenTelemetry Collector started (PID: $OTEL_PID)"
        
        # Wait a moment and check if it's still running
        sleep 2
        if kill -0 $OTEL_PID 2>/dev/null; then
            echo "📡 OTEL Collector is running and forwarding telemetry"
        else
            echo "❌ OTEL Collector failed to start, check logs at /tmp/codeuser/otel-collector.log"
        fi
    else
        echo "⚠️  No OTEL Collector configuration found, skipping collector startup"
        echo "💡 Configure OTEL Collector in the web interface at /config"
    fi
}

stop_otel_collector() {
    local pid_file="/tmp/codeuser/otel-collector.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            echo "🛑 Stopping OpenTelemetry Collector (PID: $pid)..."
            kill $pid
            rm -f "$pid_file"
            echo "✅ OTEL Collector stopped"
        else
            echo "⚠️  OTEL Collector PID $pid not running"
            rm -f "$pid_file"
        fi
    else
        echo "⚠️  No OTEL Collector PID file found"
    fi
}

check_otel_collector() {
    local pid_file="/tmp/codeuser/otel-collector.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            echo "✅ OpenTelemetry Collector is running (PID: $pid)"
            return 0
        else
            echo "❌ OTEL Collector is not running (stale PID file)"
            rm -f "$pid_file"
            return 1
        fi
    else
        echo "❌ OTEL Collector is not running"
        return 1
    fi
}

check_logdna_agent() {
    local pid_file="/tmp/codeuser/logdna-agent.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            echo "✅ LogDNA agent is running (PID: $pid)"
            return 0
        else
            echo "❌ LogDNA agent is not running (stale PID file)"
            rm -f "$pid_file"
            return 1
        fi
    else
        echo "❌ LogDNA agent is not running"
        return 1
    fi
}

# Datadog agent management functions
start_datadog_agent() {
    local config_file="/etc/datadog-agent/datadog.yaml"
    local user_config_file="/tmp/codeuser/datadog-agent/datadog.yaml"
    local env_file="/tmp/codeuser/datadog-agent.env"
    
    echo "🔍 Checking Datadog agent configuration..."
    
    # Check if configuration exists (prefer user config, fallback to system)
    local active_config=""
    if [ -f "$env_file" ]; then
        if [ -f "$user_config_file" ]; then
            active_config="$user_config_file"
        elif [ -f "$config_file" ]; then
            active_config="$config_file"
        fi
    fi
    
    if [ -n "$active_config" ]; then
        echo "🐕 Found Datadog configuration at $active_config, starting agent..."
        
        # Source environment variables
        set -a
        source "$env_file"
        set +a
        
        # Create run directory for datadog agent if it doesn't exist
        mkdir -p /tmp/codeuser/datadog-run
        
        # Export additional environment variables for the agent
        export DD_RUN_PATH="/tmp/codeuser/datadog-run"
        export DD_LOG_FILE="/tmp/codeuser/datadog-agent.log"
        export DD_CONF_DIR="/tmp/codeuser/datadog-agent"
        
        # Initialize agent to create any missing files
        echo "🔧 Initializing Datadog agent..."
        datadog-agent configcheck -c "$active_config" >/dev/null 2>&1 || echo "Config check completed"
        
        # Start Datadog agent in background with proper configuration
        # Run without sudo since codeuser now owns the necessary directories
        nohup datadog-agent run -c "$active_config" > /tmp/codeuser/datadog-agent.log 2>&1 &
        DATADOG_PID=$!
        
        # Save PID for later management
        echo $DATADOG_PID > /tmp/codeuser/datadog-agent.pid
        
        echo "✅ Datadog agent started (PID: $DATADOG_PID)"
        
        # Wait a moment and check if it's still running
        sleep 3
        if kill -0 $DATADOG_PID 2>/dev/null; then
            echo "🐕 Datadog agent is running and collecting logs"
        else
            echo "❌ Datadog agent failed to start, check logs at /tmp/codeuser/datadog-agent.log"
        fi
    else
        echo "⚠️  No Datadog configuration found, skipping agent startup"
        echo "💡 Configure Datadog in the web interface at /config"
    fi
}

stop_datadog_agent() {
    local pid_file="/tmp/codeuser/datadog-agent.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            echo "🛑 Stopping Datadog agent (PID: $pid)..."
            kill $pid
            rm -f "$pid_file"
            echo "✅ Datadog agent stopped"
        else
            echo "⚠️  Datadog agent PID $pid not running"
            rm -f "$pid_file"
        fi
    else
        echo "⚠️  No Datadog agent PID file found"
    fi
}

check_datadog_agent() {
    local pid_file="/tmp/codeuser/datadog-agent.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            echo "✅ Datadog agent is running (PID: $pid)"
            return 0
        else
            echo "❌ Datadog agent is not running (stale PID file)"
            rm -f "$pid_file"
            return 1
        fi
    else
        echo "❌ Datadog agent is not running"
        return 1
    fi
}

echo "🔍 Debug info:"
echo "   Current user: $(whoami)"
echo "   Working directory: $(pwd)"
echo "   Temp directory: $(ls -la /tmp/codeuser 2>/dev/null || echo 'Not found')"
echo "   Node modules: $([ -d node_modules ] && echo 'Present' || echo 'Missing')"

echo ""
echo "✅ Setup complete!"
echo ""

# Try to start LogDNA agent
start_logdna_agent
echo ""

# Try to start OpenTelemetry Collector
start_otel_collector
echo ""

# Try to start Datadog agent
start_datadog_agent
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
# Separate server logs from application logs
nohup npm run dev > /tmp/codeuser/server.log 2> /tmp/codeuser/server-error.log &
DEV_PID=$!

# Function to cleanup background processes on exit
cleanup() {
    echo "🛑 Stopping services..."
    kill $DEV_PID 2>/dev/null || true
    stop_logdna_agent
    stop_otel_collector
    stop_datadog_agent
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
    echo "📋 Server logs: /tmp/codeuser/server.log | Application logs: /tmp/codeuser/*.log"
    echo "🔧 You can now run commands. Type 'exit' to stop the container."
    echo ""
    
    # Show the first few lines of logs to verify it's working
    echo "📄 Recent server logs:"
    tail -n 10 /tmp/codeuser/server.log 2>/dev/null || echo "No server logs yet"
    echo ""
else
    echo "❌ Failed to start development server. Check logs:"
    echo "📄 Server output:"
    cat /tmp/codeuser/server.log 2>/dev/null || echo "No server log file found"
    echo "📄 Server errors:"
    cat /tmp/codeuser/server-error.log 2>/dev/null || echo "No server error log file found"
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