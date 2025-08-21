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
mkdir -p /tmp/codeuser /logs
chmod 755 /tmp/codeuser /logs

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
touch /tmp/codeuser/restaurant-performance.log
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
echo "   Restaurant performance: /tmp/codeuser/restaurant-performance.log"
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
            local mezmo_endpoint=$(jq -r ".configurations.$default_config.mezmo.endpoint // \"logs.mezmo.com\"" "$config_file")
            local mezmo_tags=$(jq -r ".configurations.$default_config.mezmo.tags // \"restaurant-app,demo\"" "$config_file")
            
            # Extract OTEL configuration
            local otel_enabled=$(jq -r ".configurations.$default_config.otel.enabled // false" "$config_file")
            local otel_service=$(jq -r ".configurations.$default_config.otel.serviceName // \"restaurant-app\"" "$config_file")
            local otel_tags=$(jq -r ".configurations.$default_config.otel.tags // \"restaurant-app,otel\"" "$config_file")
            
            # Configure agents if keys are provided
            if [ "$mezmo_enabled" = "true" ] && [ -n "$mezmo_key" ] && [ "$mezmo_key" != "null" ] && [ "$mezmo_key" != "" ]; then
                echo "🔧 Configuring Mezmo agent from file..."
                
                # Create LogDNA environment file
                cat > /etc/logdna/logdna.env << EOF
# MZ_ prefixed variables (required by LogDNA Agent v2/v3)
MZ_INGESTION_KEY=$mezmo_key
MZ_HOST=$mezmo_host
MZ_TAGS=$mezmo_tags
MZ_ENDPOINT=$mezmo_endpoint
MZ_LOGDIR=/tmp/codeuser
MZ_DB_PATH=/var/lib/logdna
MZ_LOOKBACK=start
MZ_LOG_LEVEL=info
MZ_HOSTNAME=restaurant-app-container
MZ_USE_SSL=true
EOF

                # Create YAML configuration file to explicitly target our application logs
                cat > /etc/logdna/config.yaml << EOF
http:
  endpoint: $mezmo_endpoint
  host: $mezmo_host
  timeout: 30000
  use_ssl: true
  use_compression: true
  gzip_level: 2
  body_size: 2097152
  ingestion_key: $mezmo_key
  params:
    hostname: restaurant-app-container
    tags: $mezmo_tags

log:
  dirs:
    - /tmp/codeuser/
  db_path: /var/lib/logdna
  metrics_port: 9898
  include:
    glob:
      - "*.log"
      - "/tmp/codeuser/*.log"
      - "/tmp/codeuser/server.log"
      - "/tmp/codeuser/app.log"
      - "/tmp/codeuser/access.log"
      - "/tmp/codeuser/events.log"
      - "/tmp/codeuser/metrics.log"
      - "/tmp/codeuser/errors.log"
      - "/tmp/codeuser/performance.log"
      - "/tmp/codeuser/restaurant-performance.log"
    regex: []
  exclude:
    glob:
      - "/tmp/codeuser/logdna-agent.log"
      - "/tmp/codeuser/logdna-agent.pid"
    regex: []
  line_exclusion_regex: []
  line_inclusion_regex: []
  lookback: start

journald: {}
startup: {}
EOF
                echo "✅ Mezmo agent pre-configured with key ${mezmo_key:0:8}..."
            fi
            
            if [ "$otel_enabled" = "true" ]; then
                echo "🔧 OTEL Collector configuration found in file (will be applied when enabled via API)"
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
validate_logdna_config() {
    local env_file="$1"
    
    if [ ! -f "$env_file" ]; then
        echo "❌ Environment file not found: $env_file"
        return 1
    fi
    
    # Source the env file to check variables
    set -a
    source "$env_file" 2>/dev/null
    set +a
    
    # Check for required variables (both MZ_ and LOGDNA_ formats)
    local has_mz_config=false
    local has_logdna_config=false
    
    if [ -n "$MZ_INGESTION_KEY" ] && [ -n "$MZ_HOST" ]; then
        has_mz_config=true
        echo "✅ Found MZ_* configuration"
    fi
    
    if [ -n "$LOGDNA_INGESTION_KEY" ] && [ -n "$LOGDNA_HOST" ]; then
        has_logdna_config=true
        echo "✅ Found LOGDNA_* configuration"
    fi
    
    if [ "$has_mz_config" = false ] && [ "$has_logdna_config" = false ]; then
        echo "❌ Missing required configuration variables"
        echo "   Need either (MZ_INGESTION_KEY + MZ_HOST) or (LOGDNA_INGESTION_KEY + LOGDNA_HOST)"
        return 1
    fi
    
    # Validate ingestion key format (should be 32+ characters)
    local key="${MZ_INGESTION_KEY:-$LOGDNA_INGESTION_KEY}"
    if [ ${#key} -lt 16 ]; then
        echo "❌ Ingestion key appears invalid (too short): ${#key} characters"
        return 1
    fi
    
    echo "✅ Configuration validation passed"
    return 0
}

start_logdna_agent() {
    local config_file="/etc/logdna/config.yaml"
    local env_file="/etc/logdna/logdna.env"
    local pid_file="/tmp/codeuser/logdna-agent.pid"
    local log_file="/tmp/codeuser/logdna-agent.log"
    
    echo "🔍 Checking LogDNA agent configuration..."
    
    # Check if agent is already running
    if [ -f "$pid_file" ]; then
        local existing_pid=$(cat "$pid_file" 2>/dev/null)
        if [ -n "$existing_pid" ] && kill -0 "$existing_pid" 2>/dev/null; then
            echo "⚠️  LogDNA agent already running (PID: $existing_pid)"
            return 0
        else
            echo "🧹 Cleaning up stale PID file"
            rm -f "$pid_file"
        fi
    fi
    
    # Check if configuration exists and is valid
    if [ -f "$env_file" ]; then
        echo "📋 Found LogDNA configuration file, validating..."
        
        if ! validate_logdna_config "$env_file"; then
            echo "❌ LogDNA configuration validation failed"
            echo "💡 Fix configuration in web interface at /agents or check agents-config.json"
            return 1
        fi
        
        # Check if LogDNA binary exists
        if [ ! -f "/usr/bin/logdna-agent" ]; then
            echo "❌ LogDNA agent binary not found at /usr/bin/logdna-agent"
            echo "💡 Agent may not be installed properly"
            return 1
        fi
        
        echo "🚀 Starting LogDNA agent..."
        
        # Source environment variables
        set -a
        source "$env_file"
        set +a
        
        # Create a more robust startup command that uses YAML config
        cat > /tmp/start-logdna.sh << 'EOF'
#!/bin/bash
set -e
source /etc/logdna/logdna.env
echo "🚀 Starting LogDNA agent with config file /etc/logdna/config.yaml"
echo "📁 Target directory: /tmp/codeuser/"
exec /usr/bin/logdna-agent --config /etc/logdna/config.yaml
EOF
        chmod +x /tmp/start-logdna.sh
        
        # Start LogDNA agent in background with better error handling
        nohup /tmp/start-logdna.sh > "$log_file" 2>&1 &
        LOGDNA_PID=$!
        
        # Save PID for later management
        echo $LOGDNA_PID > "$pid_file"
        
        echo "⏳ LogDNA agent starting (PID: $LOGDNA_PID)..."
        
        # Wait longer and validate more thoroughly
        local wait_count=0
        local max_wait=10
        local agent_validated=false
        
        while [ $wait_count -lt $max_wait ]; do
            sleep 1
            wait_count=$((wait_count + 1))
            
            # Check if process is still running
            if ! kill -0 $LOGDNA_PID 2>/dev/null; then
                echo "❌ LogDNA agent process died (waited ${wait_count}s)"
                break
            fi
            
            # Check for startup success indicators in logs (LogDNA Agent v3.x patterns)
            if [ -f "$log_file" ]; then
                if grep -q "Enabling filesystem" "$log_file" 2>/dev/null || \
                   grep -q "initializing middleware" "$log_file" 2>/dev/null || \
                   grep -q "watching.*tmp.*codeuser" "$log_file" 2>/dev/null || \
                   grep -q "files_tracked.*[1-9]" "$log_file" 2>/dev/null; then
                    agent_validated=true
                    break
                fi
                
                # Check for immediate failures
                if grep -qi "authentication.*failed\|invalid.*key\|connection.*refused\|unable.*connect" "$log_file" 2>/dev/null; then
                    echo "❌ LogDNA agent authentication/connection failed"
                    break
                fi
            fi
            
            echo "⏳ Still waiting for agent to initialize... (${wait_count}/${max_wait}s)"
        done
        
        # Final validation
        if kill -0 $LOGDNA_PID 2>/dev/null; then
            if [ "$agent_validated" = true ]; then
                echo "✅ LogDNA agent started successfully and is forwarding logs (PID: $LOGDNA_PID)"
                return 0
            else
                echo "⚠️  LogDNA agent is running but status unclear (PID: $LOGDNA_PID)"
                echo "📄 Check logs: tail -f $log_file"
                return 0
            fi
        else
            echo "❌ LogDNA agent failed to start"
            
            # Show recent logs for debugging
            if [ -f "$log_file" ]; then
                echo "📄 Recent agent logs:"
                tail -n 10 "$log_file" 2>/dev/null | sed 's/^/   /'
            fi
            
            # Clean up PID file
            rm -f "$pid_file"
            return 1
        fi
    else
        echo "⚠️  No LogDNA configuration found, skipping agent startup"
        echo "💡 Configure LogDNA in the web interface at /agents"
        return 0
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