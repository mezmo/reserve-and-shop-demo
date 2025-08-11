#!/bin/bash
# Vector Troubleshooting Script for Restaurant App
# Diagnoses common Vector issues and provides solutions

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VECTOR_CONFIG="/etc/vector/vector.toml"
VECTOR_DATA_DIR="/tmp/vector"
VECTOR_SERVICE="vector"
MEZMO_TEST_ENDPOINT="https://pipeline.mezmo.com"

# Logging functions
log() {
    echo -e "${GREEN}[DIAG]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

header() {
    echo ""
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE} $1 ${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Check Vector service status
check_service_status() {
    header "Vector Service Status"
    
    if systemctl is-active "$VECTOR_SERVICE" >/dev/null 2>&1; then
        log "Vector service is running"
        systemctl status "$VECTOR_SERVICE" --no-pager -l
    else
        error "Vector service is not running"
        info "Service status:"
        systemctl status "$VECTOR_SERVICE" --no-pager -l
        
        info "Recent logs:"
        journalctl -u "$VECTOR_SERVICE" -n 20 --no-pager
        
        return 1
    fi
}

# Check Vector configuration
check_configuration() {
    header "Configuration Validation"
    
    if [[ ! -f "$VECTOR_CONFIG" ]]; then
        error "Vector configuration file not found: $VECTOR_CONFIG"
        return 1
    fi
    
    info "Validating configuration file..."
    if vector validate "$VECTOR_CONFIG"; then
        log "Configuration validation passed"
    else
        error "Configuration validation failed"
        info "Common configuration issues:"
        info "  - Syntax errors in TOML format"
        info "  - Invalid VRL scripts"
        info "  - Missing required fields"
        info "  - Invalid sink URLs or authentication"
        return 1
    fi
    
    # Check VRL scripts
    info "Checking VRL scripts..."
    VRL_DIR="/etc/vector/vrl"
    if [[ -d "$VRL_DIR" ]]; then
        for vrl_file in "$VRL_DIR"/*.vrl; do
            if [[ -f "$vrl_file" ]]; then
                info "  - $(basename "$vrl_file")"
                if vector vrl "$vrl_file" --input '{}' >/dev/null 2>&1; then
                    log "    ✓ Valid VRL syntax"
                else
                    error "    ✗ VRL syntax error"
                fi
            fi
        done
    else
        warning "VRL scripts directory not found: $VRL_DIR"
    fi
}

# Check Vector metrics
check_vector_metrics() {
    header "Vector Metrics Analysis"
    
    METRICS_URL="http://localhost:8686/metrics"
    
    if ! curl -sf "$METRICS_URL" >/dev/null 2>&1; then
        error "Cannot access Vector metrics endpoint: $METRICS_URL"
        info "Possible causes:"
        info "  - Vector API not enabled in configuration"
        info "  - Vector not listening on expected port"
        info "  - Firewall blocking access"
        return 1
    fi
    
    info "Fetching Vector metrics..."
    METRICS=$(curl -s "$METRICS_URL")
    
    # Check component error rates
    info "Component Error Analysis:"
    echo "$METRICS" | grep "vector_component_errors_total" | while read -r line; do
        COMPONENT=$(echo "$line" | grep -o 'component_name="[^"]*"' | cut -d'"' -f2)
        VALUE=$(echo "$line" | awk '{print $2}')
        if [[ ${VALUE%.*} -gt 0 ]]; then
            warning "  - $COMPONENT: $VALUE errors"
        else
            log "  - $COMPONENT: No errors"
        fi
    done
    
    # Check throughput
    info "Throughput Analysis:"
    EVENTS_PROCESSED=$(echo "$METRICS" | grep "vector_component_received_events_total" | tail -1 | awk '{print $2}')
    if [[ -n "$EVENTS_PROCESSED" ]]; then
        log "  - Total events processed: $EVENTS_PROCESSED"
    else
        warning "  - No throughput metrics found"
    fi
    
    # Check memory usage
    info "Memory Usage:"
    MEMORY_BYTES=$(echo "$METRICS" | grep "vector_memory_usage_bytes" | awk '{print $2}')
    if [[ -n "$MEMORY_BYTES" ]]; then
        MEMORY_MB=$((MEMORY_BYTES / 1024 / 1024))
        log "  - Memory usage: ${MEMORY_MB}MB"
        if [[ $MEMORY_MB -gt 1024 ]]; then
            warning "  - High memory usage detected (>${MEMORY_MB}MB)"
        fi
    fi
    
    # Check buffer utilization
    info "Buffer Utilization:"
    echo "$METRICS" | grep "vector_buffer_" | while read -r line; do
        BUFFER_TYPE=$(echo "$line" | grep -o 'buffer="[^"]*"' | cut -d'"' -f2)
        VALUE=$(echo "$line" | awk '{print $2}')
        info "  - $BUFFER_TYPE: $VALUE"
    done
}

# Check log file processing
check_log_processing() {
    header "Log File Processing"
    
    LOG_SOURCE_DIR="/tmp/codeuser"
    
    if [[ ! -d "$LOG_SOURCE_DIR" ]]; then
        warning "Log source directory not found: $LOG_SOURCE_DIR"
        return 1
    fi
    
    info "Checking log files in $LOG_SOURCE_DIR:"
    for log_file in "$LOG_SOURCE_DIR"/*.log; do
        if [[ -f "$log_file" ]]; then
            FILENAME=$(basename "$log_file")
            SIZE=$(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file" 2>/dev/null || echo "unknown")
            MODIFIED=$(stat -f%Sm "$log_file" 2>/dev/null || stat -c%y "$log_file" 2>/dev/null || echo "unknown")
            
            info "  - $FILENAME"
            info "    Size: $SIZE bytes"
            info "    Modified: $MODIFIED"
            
            # Check file permissions
            if [[ -r "$log_file" ]]; then
                log "    ✓ Readable by Vector user"
            else
                error "    ✗ Not readable by Vector user"
            fi
        fi
    done
    
    # Test log processing with sample entry
    info "Testing log processing..."
    TEST_LOG="$LOG_SOURCE_DIR/vector-test.log"
    
    # Create test log entry
    echo '{"timestamp":"'$(date -Iseconds)'","level":"info","message":"Vector troubleshooting test","service":"restaurant-app","test_mode":true}' > "$TEST_LOG"
    
    sleep 3
    
    # Check if Vector processed the test entry
    if grep -q "troubleshooting test" /tmp/vector/*/vector-*.log 2>/dev/null; then
        log "✓ Vector is processing log files"
    else
        warning "Vector may not be processing log files correctly"
        info "Check Vector logs: journalctl -u vector -f"
    fi
    
    # Cleanup test file
    rm -f "$TEST_LOG"
}

# Check Mezmo connectivity
check_mezmo_connectivity() {
    header "Mezmo Connectivity"
    
    # Test basic connectivity to Mezmo
    if curl -sf --connect-timeout 10 "$MEZMO_TEST_ENDPOINT" >/dev/null 2>&1; then
        log "✓ Can reach Mezmo endpoints"
    else
        error "✗ Cannot reach Mezmo endpoints"
        info "Possible causes:"
        info "  - Network connectivity issues"
        info "  - Firewall blocking outbound HTTPS"
        info "  - DNS resolution problems"
        
        # DNS test
        if nslookup pipeline.mezmo.com >/dev/null 2>&1; then
            log "  - DNS resolution working"
        else
            error "  - DNS resolution failed"
        fi
        
        return 1
    fi
    
    # Check SSL certificate
    info "Testing SSL connectivity..."
    if openssl s_client -connect pipeline.mezmo.com:443 -servername pipeline.mezmo.com < /dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
        log "✓ SSL certificate validation passed"
    else
        warning "SSL certificate validation issues"
    fi
    
    # Check for authentication errors in Vector logs
    info "Checking for Mezmo authentication errors..."
    AUTH_ERRORS=$(journalctl -u vector --since "1 hour ago" | grep -i "401\|403\|unauthorized\|forbidden" | wc -l)
    if [[ $AUTH_ERRORS -gt 0 ]]; then
        error "Found $AUTH_ERRORS authentication errors"
        info "Check Mezmo ingestion keys and pipeline IDs"
    else
        log "No authentication errors found"
    fi
}

# Check disk space and file permissions
check_system_resources() {
    header "System Resources"
    
    # Check disk space
    info "Disk Space Analysis:"
    df -h "$VECTOR_DATA_DIR" | tail -1 | while read -r filesystem size used avail percent mount; do
        log "  - Data directory: $used used, $avail available ($percent full)"
        PERCENT_NUM=${percent%\%}
        if [[ $PERCENT_NUM -gt 90 ]]; then
            error "  - Low disk space warning (${percent} full)"
        fi
    done
    
    # Check file permissions
    info "File Permissions:"
    if [[ -d "$VECTOR_DATA_DIR" ]]; then
        OWNER=$(stat -f%Su "$VECTOR_DATA_DIR" 2>/dev/null || stat -c%U "$VECTOR_DATA_DIR" 2>/dev/null)
        if [[ "$OWNER" == "vector" ]]; then
            log "  - Data directory owned by vector user"
        else
            error "  - Data directory not owned by vector user (owner: $OWNER)"
        fi
    fi
    
    # Check Vector process limits
    info "Process Limits:"
    VECTOR_PID=$(pgrep vector || echo "")
    if [[ -n "$VECTOR_PID" ]]; then
        if [[ -f "/proc/$VECTOR_PID/limits" ]]; then
            MAX_FILES=$(grep "Max open files" "/proc/$VECTOR_PID/limits" | awk '{print $4}')
            log "  - Max open files: $MAX_FILES"
            if [[ $MAX_FILES -lt 65536 ]]; then
                warning "  - File descriptor limit may be too low"
            fi
        fi
    fi
}

# Check Vector performance
check_performance() {
    header "Performance Analysis"
    
    VECTOR_PID=$(pgrep vector || echo "")
    if [[ -z "$VECTOR_PID" ]]; then
        error "Vector process not found"
        return 1
    fi
    
    # CPU and memory usage
    info "Resource Usage:"
    PS_OUTPUT=$(ps -p "$VECTOR_PID" -o pid,pcpu,pmem,vsz,rss,comm --no-headers)
    if [[ -n "$PS_OUTPUT" ]]; then
        read -r pid cpu mem vsz rss comm <<< "$PS_OUTPUT"
        log "  - PID: $pid"
        log "  - CPU: ${cpu}%"
        log "  - Memory: ${mem}% (${rss}KB resident)"
        
        # Memory usage warnings
        if (( $(echo "$mem > 10.0" | bc -l) )); then
            warning "  - High memory usage (${mem}%)"
        fi
        
        if (( $(echo "$cpu > 50.0" | bc -l) )); then
            warning "  - High CPU usage (${cpu}%)"
        fi
    fi
    
    # Check for processing bottlenecks
    info "Processing Performance:"
    if [[ -f "/tmp/vector/metrics/performance-$(date +%Y-%m-%d).log" ]]; then
        PERF_LOG="/tmp/vector/metrics/performance-$(date +%Y-%m-%d).log"
        RECENT_ENTRIES=$(tail -10 "$PERF_LOG")
        
        # Analyze recent processing times
        echo "$RECENT_ENTRIES" | grep "processing_latency_ms" | while read -r entry; do
            LATENCY=$(echo "$entry" | grep -o '"processing_latency_ms":[0-9]*' | cut -d':' -f2)
            if [[ $LATENCY -gt 1000 ]]; then
                warning "  - High processing latency: ${LATENCY}ms"
            fi
        done
    fi
}

# Generate diagnostics report
generate_report() {
    header "Diagnostics Summary"
    
    REPORT_FILE="/tmp/vector-diagnostics-$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "Vector Diagnostics Report"
        echo "Generated: $(date)"
        echo "Hostname: $(hostname)"
        echo "Vector Version: $(vector --version 2>/dev/null || echo 'Not available')"
        echo ""
        
        echo "=== Service Status ==="
        systemctl status vector --no-pager -l
        echo ""
        
        echo "=== Configuration ==="
        echo "Config file: $VECTOR_CONFIG"
        echo "Config validation: $(vector validate "$VECTOR_CONFIG" >/dev/null 2>&1 && echo "PASSED" || echo "FAILED")"
        echo ""
        
        echo "=== Recent Logs ==="
        journalctl -u vector -n 50 --no-pager
        echo ""
        
        echo "=== System Resources ==="
        df -h "$VECTOR_DATA_DIR"
        ps aux | grep vector | head -5
        echo ""
        
        echo "=== Network Connectivity ==="
        curl -sf --connect-timeout 5 "$MEZMO_TEST_ENDPOINT" >/dev/null 2>&1 && echo "Mezmo: ACCESSIBLE" || echo "Mezmo: NOT ACCESSIBLE"
        echo ""
        
    } > "$REPORT_FILE"
    
    info "Diagnostics report generated: $REPORT_FILE"
}

# Main troubleshooting function
run_diagnostics() {
    log "Starting Vector troubleshooting diagnostics..."
    
    local exit_code=0
    
    # Run all diagnostic checks
    check_service_status || exit_code=1
    check_configuration || exit_code=1
    check_system_resources || exit_code=1
    check_vector_metrics || exit_code=1
    check_log_processing || exit_code=1
    check_mezmo_connectivity || exit_code=1
    check_performance || exit_code=1
    
    # Generate summary report
    generate_report
    
    if [[ $exit_code -eq 0 ]]; then
        log "All diagnostic checks passed!"
    else
        warning "Some diagnostic checks failed. Check the output above for details."
    fi
    
    return $exit_code
}

# Quick fixes function
suggest_fixes() {
    header "Common Fixes"
    
    info "If Vector is not starting:"
    info "  - Check configuration: vector validate $VECTOR_CONFIG"
    info "  - Check logs: journalctl -u vector -f"
    info "  - Restart service: sudo systemctl restart vector"
    
    info "If logs are not being processed:"
    info "  - Check file permissions: ls -la /tmp/codeuser/"
    info "  - Verify log file paths in configuration"
    info "  - Check Vector user can read log files"
    
    info "If Mezmo delivery is failing:"
    info "  - Verify network connectivity: curl https://pipeline.mezmo.com"
    info "  - Check ingestion keys and pipeline IDs"
    info "  - Review authentication errors in logs"
    
    info "For performance issues:"
    info "  - Monitor resource usage: htop"
    info "  - Check buffer utilization in metrics"
    info "  - Consider adjusting batch sizes"
    
    info "For high memory usage:"
    info "  - Check for memory leaks in metrics"
    info "  - Restart Vector service"
    info "  - Review buffer configurations"
}

# Command line argument handling
case "${1:-help}" in
    "full")
        run_diagnostics
        ;;
    "service")
        check_service_status
        ;;
    "config")
        check_configuration
        ;;
    "metrics")
        check_vector_metrics
        ;;
    "logs")
        check_log_processing
        ;;
    "mezmo")
        check_mezmo_connectivity
        ;;
    "performance")
        check_performance
        ;;
    "resources")
        check_system_resources
        ;;
    "report")
        generate_report
        ;;
    "fixes")
        suggest_fixes
        ;;
    "help"|*)
        echo "Vector Troubleshooting Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  full         - Run all diagnostic checks (default)"
        echo "  service      - Check Vector service status"
        echo "  config       - Validate Vector configuration"
        echo "  metrics      - Analyze Vector metrics"
        echo "  logs         - Check log file processing"
        echo "  mezmo        - Test Mezmo connectivity"
        echo "  performance  - Analyze Vector performance"
        echo "  resources    - Check system resources"
        echo "  report       - Generate diagnostics report"
        echo "  fixes        - Show common fixes"
        echo "  help         - Show this help message"
        echo ""
        ;;
esac