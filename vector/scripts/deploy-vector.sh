#!/bin/bash
# Vector Deployment Script for Restaurant App
# Automates Vector installation, configuration, and startup

set -euo pipefail

# Configuration
VECTOR_VERSION="0.34.0"
VECTOR_USER="vector"
VECTOR_GROUP="vector"
VECTOR_HOME="/etc/vector"
VECTOR_DATA_DIR="/tmp/vector"
LOG_FILE="/var/log/vector-deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
        exit 1
    fi
}

# Create Vector user and group
create_vector_user() {
    log "Creating Vector user and group..."
    
    if ! getent group "$VECTOR_GROUP" >/dev/null 2>&1; then
        groupadd --system "$VECTOR_GROUP"
        log "Created group: $VECTOR_GROUP"
    else
        info "Group $VECTOR_GROUP already exists"
    fi
    
    if ! getent passwd "$VECTOR_USER" >/dev/null 2>&1; then
        useradd --system \
                --gid "$VECTOR_GROUP" \
                --home-dir "$VECTOR_HOME" \
                --shell /bin/false \
                --comment "Vector log processor" \
                "$VECTOR_USER"
        log "Created user: $VECTOR_USER"
    else
        info "User $VECTOR_USER already exists"
    fi
}

# Install Vector binary
install_vector() {
    log "Installing Vector $VECTOR_VERSION..."
    
    # Check if Vector is already installed
    if command -v vector >/dev/null 2>&1; then
        CURRENT_VERSION=$(vector --version | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
        if [[ "$CURRENT_VERSION" == "$VECTOR_VERSION" ]]; then
            info "Vector $VECTOR_VERSION is already installed"
            return 0
        else
            warning "Vector $CURRENT_VERSION is installed, upgrading to $VECTOR_VERSION"
        fi
    fi
    
    # Download and install Vector
    if curl --proto '=https' --tlsv1.2 -sSfL https://sh.vector.dev | bash -s -- -y --version "$VECTOR_VERSION"; then
        log "Vector $VECTOR_VERSION installed successfully"
    else
        error "Failed to install Vector"
        exit 1
    fi
}

# Create required directories
create_directories() {
    log "Creating required directories..."
    
    # Vector configuration directories
    mkdir -p "$VECTOR_HOME"/{vrl,config}
    mkdir -p "$VECTOR_DATA_DIR"/{backup,metrics,alerts,failed,operations}
    mkdir -p /var/log/vector
    
    # Set ownership
    chown -R "$VECTOR_USER:$VECTOR_GROUP" "$VECTOR_HOME"
    chown -R "$VECTOR_USER:$VECTOR_GROUP" "$VECTOR_DATA_DIR"
    chown -R "$VECTOR_USER:$VECTOR_GROUP" /var/log/vector
    
    # Set permissions
    chmod 755 "$VECTOR_HOME"
    chmod 755 "$VECTOR_DATA_DIR"
    chmod 755 /var/log/vector
    
    log "Directories created and permissions set"
}

# Deploy configuration files
deploy_configuration() {
    log "Deploying Vector configuration files..."
    
    # Copy main configuration
    if [[ -f "/app/vector/vector.toml" ]]; then
        cp /app/vector/vector.toml "$VECTOR_HOME/"
        log "Copied main configuration"
    else
        error "Main configuration file not found: /app/vector/vector.toml"
        exit 1
    fi
    
    # Copy VRL scripts
    if [[ -d "/app/vector/vrl" ]]; then
        cp /app/vector/vrl/* "$VECTOR_HOME/vrl/"
        log "Copied VRL scripts"
    else
        error "VRL scripts directory not found: /app/vector/vrl"
        exit 1
    fi
    
    # Copy additional configurations
    if [[ -d "/app/vector/config" ]]; then
        cp /app/vector/config/* "$VECTOR_HOME/config/"
        log "Copied additional configurations"
    else
        warning "Additional config directory not found: /app/vector/config"
    fi
    
    # Set ownership
    chown -R "$VECTOR_USER:$VECTOR_GROUP" "$VECTOR_HOME"
    
    log "Configuration files deployed"
}

# Validate configuration
validate_configuration() {
    log "Validating Vector configuration..."
    
    if vector validate "$VECTOR_HOME/vector.toml"; then
        log "Configuration validation passed"
    else
        error "Configuration validation failed"
        exit 1
    fi
}

# Create systemd service
create_systemd_service() {
    log "Creating systemd service..."
    
    cat > /etc/systemd/system/vector.service << EOF
[Unit]
Description=Vector log processor
Documentation=https://vector.dev/
After=network.target
Wants=network.target

[Service]
Type=simple
User=$VECTOR_USER
Group=$VECTOR_GROUP
ExecStart=/usr/bin/vector --config $VECTOR_HOME/vector.toml
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vector

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectHome=yes
ProtectSystem=strict
ReadWritePaths=$VECTOR_DATA_DIR /var/log/vector

# Resource limits
MemoryMax=2G
CPUQuota=200%
TasksMax=1024

# File descriptor limits
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd
    systemctl daemon-reload
    log "Systemd service created"
}

# Configure log rotation
configure_log_rotation() {
    log "Configuring log rotation..."
    
    cat > /etc/logrotate.d/vector << EOF
/var/log/vector/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 644 $VECTOR_USER $VECTOR_GROUP
    postrotate
        /bin/systemctl reload vector
    endscript
}

$VECTOR_DATA_DIR/*/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 $VECTOR_USER $VECTOR_GROUP
}
EOF

    log "Log rotation configured"
}

# Set environment variables
configure_environment() {
    log "Configuring environment variables..."
    
    cat > /etc/default/vector << EOF
# Vector environment variables
VECTOR_CONFIG_DIR=$VECTOR_HOME
VECTOR_DATA_DIR=$VECTOR_DATA_DIR
NODE_ENV=${NODE_ENV:-production}
APP_VERSION=${APP_VERSION:-1.0.0}
HOSTNAME=$(hostname)
EOF

    log "Environment variables configured"
}

# Start Vector service
start_vector_service() {
    log "Starting Vector service..."
    
    # Enable service to start on boot
    systemctl enable vector
    
    # Start the service
    if systemctl start vector; then
        log "Vector service started successfully"
    else
        error "Failed to start Vector service"
        systemctl status vector
        exit 1
    fi
    
    # Wait a moment and check status
    sleep 5
    if systemctl is-active vector >/dev/null 2>&1; then
        log "Vector service is running"
    else
        error "Vector service is not running"
        systemctl status vector
        exit 1
    fi
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Wait for Vector to fully initialize
    sleep 10
    
    # Check API endpoint
    if curl -sf http://localhost:8686/health >/dev/null 2>&1; then
        log "Vector API health check passed"
    else
        warning "Vector API health check failed - API may not be enabled"
    fi
    
    # Check metrics endpoint
    if curl -sf http://localhost:8686/metrics >/dev/null 2>&1; then
        log "Vector metrics endpoint accessible"
    else
        warning "Vector metrics endpoint not accessible"
    fi
    
    # Check log file processing
    if [[ -f "/tmp/codeuser/app.log" ]]; then
        # Create a test log entry
        echo '{"timestamp":"'$(date -Iseconds)'","level":"info","message":"Vector deployment test","service":"restaurant-app"}' >> /tmp/codeuser/app.log
        
        # Wait and check if Vector processed it
        sleep 5
        if systemctl status vector | grep -q "Active: active"; then
            log "Vector is processing log files"
        else
            warning "Vector may not be processing log files correctly"
        fi
    else
        warning "Test log file not found - cannot verify log processing"
    fi
}

# Backup existing configuration
backup_existing_config() {
    if [[ -f "$VECTOR_HOME/vector.toml" ]]; then
        log "Backing up existing configuration..."
        cp "$VECTOR_HOME/vector.toml" "$VECTOR_HOME/vector.toml.backup.$(date +%Y%m%d_%H%M%S)"
        log "Existing configuration backed up"
    fi
}

# Cleanup function
cleanup() {
    if [[ $? -ne 0 ]]; then
        error "Deployment failed. Cleaning up..."
        
        # Stop service if it was started
        systemctl stop vector >/dev/null 2>&1 || true
        systemctl disable vector >/dev/null 2>&1 || true
        
        # Restore backup if it exists
        if [[ -f "$VECTOR_HOME/vector.toml.backup."* ]]; then
            BACKUP_FILE=$(ls -t "$VECTOR_HOME"/vector.toml.backup.* | head -1)
            cp "$BACKUP_FILE" "$VECTOR_HOME/vector.toml"
            warning "Restored configuration from backup"
        fi
    fi
}

# Main execution
main() {
    log "Starting Vector deployment for Restaurant App..."
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Deployment steps
    check_root
    create_vector_user
    install_vector
    create_directories
    backup_existing_config
    deploy_configuration
    validate_configuration
    create_systemd_service
    configure_log_rotation
    configure_environment
    start_vector_service
    health_check
    
    log "Vector deployment completed successfully!"
    
    # Display status
    info "Vector Status:"
    systemctl status vector --no-pager -l
    
    info "Vector Configuration:"
    info "  - Config file: $VECTOR_HOME/vector.toml"
    info "  - VRL scripts: $VECTOR_HOME/vrl/"
    info "  - Data directory: $VECTOR_DATA_DIR"
    info "  - API endpoint: http://localhost:8686"
    info "  - Metrics: http://localhost:8686/metrics"
    
    info "Next steps:"
    info "  1. Update Mezmo pipeline IDs and ingestion keys in configuration"
    info "  2. Monitor Vector logs: journalctl -u vector -f"
    info "  3. Check processing metrics: curl http://localhost:8686/metrics"
    info "  4. Review health status: systemctl status vector"
    
    log "Deployment log saved to: $LOG_FILE"
}

# Run main function
main "$@"