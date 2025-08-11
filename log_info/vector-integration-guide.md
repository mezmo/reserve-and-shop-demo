# Vector Integration Guide for Restaurant App Log Processing

## Overview

This guide provides comprehensive instructions for implementing log processing with Vector (the backend processing engine used by Mezmo) for the restaurant application. It covers issue detection, data volume reduction, and optimized Mezmo integration.

## Table of Contents

1. [Vector Pipeline Architecture](#vector-pipeline-architecture)
2. [Issue Detection with VRL](#issue-detection-with-vrl)
3. [Data Volume Reduction Strategies](#data-volume-reduction-strategies)
4. [Mezmo Integration Optimization](#mezmo-integration-optimization)
5. [Monitoring and Alerting](#monitoring-and-alerting)
6. [Operational Guidelines](#operational-guidelines)

## Vector Pipeline Architecture

### Pipeline Flow Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Vector Processing Pipeline                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Source: File Logs] ──┐                                   │
│                        │                                   │
│  [Source: Metrics] ────┼──► [Parse & Normalize] ──┐       │
│                        │                           │       │
│  [Source: Internal] ───┘                           │       │
│                                                     │       │
│                                ┌────────────────────▼──┐    │
│                                │   Issue Detection    │    │
│                                │   (30+ Patterns)     │    │
│                                └────────────────────┬──┘    │
│                                                     │       │
│                                ┌────────────────────▼──┐    │
│                                │ Intelligent Sampling │    │
│                                │ (Volume Reduction)   │    │
│                                └────────────────────┬──┘    │
│                                                     │       │
│                                ┌────────────────────▼──┐    │
│                                │   Data Cleanup &     │    │
│                                │   PII Redaction      │    │
│                                └────────────────────┬──┘    │
│                                                     │       │
│                                ┌────────────────────▼──┐    │
│                                │ Context Enrichment   │    │
│                                └────────────────────┬──┘    │
│                                                     │       │
│                    ┌─────────────────────────────────▼──────┐│
│                    │           Log Routing                  ││
│                    └─┬──┬──┬─────────┬──────────┬──────────┬┘│
│                      │  │  │         │          │          │ │
│             ┌────────▼┐ │  │  ┌──────▼┐  ┌──────▼┐  ┌──────▼┐│
│             │Critical│ │  │  │Business│  │Access │  │Debug ││
│             │Events  │ │  │  │Events  │  │Logs   │  │Logs  ││
│             └────────┘ │  │  └────────┘  └───────┘  └──────┘│
│                        │  │                                 │
│                 ┌──────▼┐ │                                 │
│                 │Metrics│ │                                 │
│                 └───────┘ │                                 │
│                           │                                 │
│                    ┌──────▼┐                                │
│                    │Default│                                │
│                    └───────┘                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┤
│  │               Mezmo Pipeline Destinations               │
│  └─────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

### Configuration Structure

```bash
/app/vector/
├── vector.toml                    # Main Vector configuration
├── vrl/                          # Vector Remap Language scripts
│   ├── parse_normalize.vrl       # Multi-format log parsing
│   ├── issue_detection.vrl       # 30+ issue detection patterns
│   ├── intelligent_sampling.vrl  # Smart data volume reduction
│   ├── data_cleanup.vrl          # PII redaction & standardization  
│   └── enrich_context.vrl        # Context and metadata enrichment
├── config/                       # Additional configurations
│   ├── mezmo-routing.toml        # Mezmo pipeline routing
│   └── monitoring.toml           # Vector monitoring & alerts
└── scripts/                      # Operational scripts
    ├── deploy-vector.sh          # Deployment automation
    ├── health-check.sh           # Health monitoring
    └── troubleshoot.sh           # Troubleshooting utilities
```

## Issue Detection with VRL

### Converting Troubleshooting Patterns to Vector

The Vector implementation translates all 30+ troubleshooting patterns from the playbook into real-time detection rules using VRL (Vector Remap Language).

#### Example: Database Connection Pool Exhaustion

**Original Detection Pattern:**
```json
{
  "level": "ERROR", 
  "message": "Database connection pool exhausted",
  "poolSize": 3,
  "activeConnections": 3,
  "queueLength": 15
}
```

**Vector VRL Implementation:**
```vrl
# Database Connection Pool Exhaustion Detection
if .log_level == "error" && 
   (contains(string!(.message ?? ""), "pool exhausted") || 
    contains(string!(.message ?? ""), "connection pool") ||
    .error_code == "DB_POOL_EXHAUSTED") {
    
    .alert_generated = true
    .severity = "critical"
    .issue_category = "database"
    .alerts = push(.alerts, {
        "alert_type": "db_pool_exhausted",
        "description": "Database connection pool exhausted",
        "runbook": "https://docs.company.com/runbooks/db-pool-exhaustion",
        "immediate_action": "Check pool utilization and restart if needed"
    })
    
    # Extract pool statistics if available
    if exists(.poolSize) {
        .pool_utilization = to_float(.activeConnections ?? 0) / to_float(.poolSize)
        .alert_context.pool_stats = {
            "pool_size": .poolSize,
            "active_connections": .activeConnections,
            "queue_length": .queueLength ?? 0,
            "utilization": .pool_utilization
        }
    }
}
```

#### Key Detection Categories

1. **Database Issues (8 patterns)**
   - Connection pool exhaustion
   - Slow query performance 
   - Connection failures
   - Transaction deadlocks

2. **Payment Processing (5 patterns)**
   - Gateway failures
   - Timeout issues  
   - Declined transactions
   - Processing errors

3. **Performance Issues (7 patterns)**
   - High memory usage
   - CPU saturation
   - API response degradation
   - Disk space issues

4. **Business Logic (6 patterns)**
   - Order processing failures
   - Inventory issues
   - User registration problems
   - Reservation conflicts

5. **Security Issues (4 patterns)**
   - Authentication failures
   - Authorization violations
   - File upload validation
   - Suspicious activity

### Alert Enrichment

Each detected issue is automatically enriched with:

```vrl
# Add alert metadata
if .alert_generated {
    .alert_metadata = {
        "generated_at": now(),
        "vector_instance": get_hostname() ?? "unknown",
        "alert_count": length(.alerts),
        "correlation_id": .correlation_id ?? .trace_id ?? uuid_v4(),
        "environment": .environment ?? "unknown"
    }
    
    # Set alert priority based on severity and category
    .alert_priority = if .severity == "critical" {
        "P1"
    } else if .severity == "high" {
        "P2" 
    } else if .severity == "medium" {
        "P3"
    } else {
        "P4"
    }
    
    # Add escalation information
    .escalation_info = {
        "notify_oncall": .severity == "critical" || .severity == "high",
        "create_incident": .severity == "critical" || (.severity == "high" && .issue_category == "business"),
        "slack_channel": if .issue_category == "business" { "#business-alerts" } else { "#ops-alerts" }
    }
}
```

## Data Volume Reduction Strategies

### Intelligent Sampling Implementation

Vector implements a sophisticated sampling strategy to reduce data volume while preserving critical information:

#### 1. Priority-Based Sampling

```vrl
# Critical logs - always keep (no sampling)
if .alert_generated == true ||
   .severity == "critical" ||
   .log_level == "error" ||
   .log_level == "fatal" ||
   .issue_category == "business" ||
   .issue_category == "security" ||
   (.status_code ?? .status ?? 0) >= 400 {
    
    .should_keep = true
    .sample_reason = "critical_event"
    .sampling_metadata.sample_rate = 1.0
}
```

#### 2. Content-Based Sampling

```vrl  
# Health checks and monitoring - aggressive sampling (1%)
if contains(string!(.url ?? ""), "/health") ||
   contains(string!(.url ?? ""), "/metrics") ||
   contains(string!(.url ?? ""), "/ping") {
    
    sample_hash = hash(string!(.request_id ?? .trace_id ?? uuid_v4()))
    .should_keep = mod(sample_hash, 100) < 1  # Keep 1%
    .sample_reason = "health_check"
    .sampling_metadata.sample_rate = 0.01
}
```

#### 3. Time-Based Adaptive Sampling

```vrl
# Peak hours (9 AM - 5 PM) - reduce sampling to manage volume
current_hour_int = to_int(format_timestamp!(now(), "%H"))
if current_hour_int >= 9 && current_hour_int <= 17 {
    if .sample_reason == "general_info" || 
       .sample_reason == "general_access" {
        
        # Further reduce sampling during peak hours
        peak_hash = hash(string!(.trace_id ?? uuid_v4()))
        if mod(peak_hash, 2) != 0 {  # Keep only 50% of already sampled logs
            .should_keep = false
            .sample_reason = .sample_reason + "_peak_hours"
            .sampling_metadata.peak_hour_reduction = true
        }
    }
}
```

#### 4. Session-Based Sampling

```vrl
# Session-based sampling for user journeys  
if exists(.session_id) && .should_keep == false {
    session_hash = hash(string!(.session_id))
    
    # Keep 10% of complete user sessions
    if mod(session_hash, 10) == 0 {
        .should_keep = true
        .sample_reason = "complete_user_journey"
        .sampling_metadata.session_sampled = true
    }
}
```

### Volume Reduction Results

| Log Type | Original Volume | After Sampling | Reduction |
|----------|-----------------|-----------------|-----------|
| Debug Logs | 100% | 5-50% | 50-95% |
| Access Logs | 100% | 10-30% | 70-90% |
| Business Events | 100% | 80-100% | 0-20% |
| Error Logs | 100% | 100% | 0% |
| Health Checks | 100% | 1% | 99% |

## Mezmo Integration Optimization

### Pipeline Routing Strategy

Vector routes different log types to optimized Mezmo pipelines:

#### 1. Critical Events Pipeline
- **Purpose**: High-priority alerts and errors
- **Batch Size**: 50 events (small for fast delivery)
- **Timeout**: 5 seconds
- **Retry**: Aggressive (5 attempts)
- **Buffer**: Local disk backup

```toml
[sinks.mezmo_critical_events]
type = "http"
inputs = ["route_logs.critical", "deduplicate_errors"] 
uri = "https://pipeline.mezmo.com/v1/YOUR_CRITICAL_PIPELINE_ID"

[sinks.mezmo_critical_events.batch]
max_events = 50
timeout_secs = 5
max_bytes = 1048576  # 1MB

[sinks.mezmo_critical_events.request]
timeout_secs = 15
retry_attempts = 5
```

#### 2. Business Intelligence Pipeline  
- **Purpose**: Revenue and customer events
- **Batch Size**: 200 events
- **Timeout**: 20 seconds
- **Focus**: Complete business context

```toml
[sinks.mezmo_business_intelligence]
type = "http"
inputs = ["route_logs.business"]
uri = "https://pipeline.mezmo.com/v1/YOUR_BUSINESS_PIPELINE_ID"

[sinks.mezmo_business_intelligence.encoding]
codec = "json"
except_fields = ["stack", "parsing_metadata", "sampling_metadata"]
```

#### 3. Access Logs Pipeline
- **Purpose**: High-volume HTTP access logs
- **Batch Size**: 1000 events (large for efficiency)
- **Timeout**: 60 seconds
- **Optimization**: Field filtering

```toml
[sinks.mezmo_access_logs.encoding]
codec = "json"
only_fields = [
    "@timestamp", "method", "url", "status_code", 
    "response_time", "ip_subnet", "trace_id", 
    "user_id", "service", "environment"
]
```

### Field Optimization for Mezmo

#### Remove Unnecessary Fields
```vrl
# Remove Vector processing metadata before sending to Mezmo
del(.parsing_metadata)
del(.sampling_metadata)
del(.enrichment_latency_ms)
del(.vector_processed)
```

#### Compress Large Fields
```vrl
# Compress stack traces
if exists(.stack) && is_array(.stack) && length(.stack) > 10 {
    .stack = slice(.stack, 0, 10)
    .stack_truncated = true
}

# Truncate long messages
if exists(.message) && length(string!(.message)) > 1000 {
    .message = slice(string!(.message), 0, 997) + "..."
    .message_truncated = true
}
```

## Monitoring and Alerting

### Vector Health Monitoring

#### 1. Internal Metrics Collection
```toml
[sources.vector_internal_metrics]
type = "internal_metrics"
scrape_interval_secs = 30
namespace = "vector"
```

#### 2. Performance Metrics
Monitor key Vector performance indicators:
- **Throughput**: Events per second processed
- **Latency**: Processing delay per stage
- **Error Rate**: Failed transformations
- **Memory Usage**: Vector process memory
- **Buffer Utilization**: Queue depths

#### 3. Alert Conditions
```vrl
# High error rates
if .name == "vector_component_errors_total" && .value > 10 {
    .alert_generated = true
    .alerts = push(.alerts, {
        "type": "high_error_rate",
        "component": .component_name ?? "unknown", 
        "error_count": .value,
        "severity": "high"
    })
}

# Memory usage alerts
if contains(string!(.name ?? ""), "memory") && .value > 1073741824 {  # 1GB
    .alert_generated = true
    .alerts = push(.alerts, {
        "type": "high_memory_usage",
        "memory_bytes": .value,
        "severity": "medium"
    })
}
```

### Monitoring Dashboard Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| vector_events_processed_total | Total events processed | < 100/min |
| vector_component_errors_total | Processing errors | > 10/min |
| vector_memory_usage_bytes | Memory consumption | > 1GB |
| vector_buffer_utilization | Queue utilization | > 80% |
| mezmo_delivery_success_rate | Successful Mezmo delivery | < 95% |

## Operational Guidelines

### Deployment

#### 1. Install Vector
```bash
# Download and install Vector
curl --proto '=https' --tlsv1.2 -sSfL https://sh.vector.dev | bash -s -- -y
```

#### 2. Deploy Configuration
```bash
#!/bin/bash
# Deploy Vector configuration
cp /app/vector/vector.toml /etc/vector/
cp /app/vector/vrl/* /etc/vector/vrl/
cp /app/vector/config/* /etc/vector/config/

# Create required directories
mkdir -p /tmp/vector/{backup,metrics,alerts,failed,operations}

# Set permissions
chown -R vector:vector /etc/vector/
chown -R vector:vector /tmp/vector/
```

#### 3. Start Vector Service
```bash
# Start Vector with systemd
sudo systemctl enable vector
sudo systemctl start vector

# Verify status
sudo systemctl status vector
```

### Configuration Management

#### 1. Validation
```bash
# Validate configuration before deployment
vector validate /app/vector/vector.toml

# Test VRL scripts
vector vrl /app/vector/vrl/parse_normalize.vrl < sample_log.txt
```

#### 2. Hot Reload
```bash
# Reload configuration without restart
sudo systemctl reload vector

# Or send SIGHUP signal
sudo kill -HUP $(pgrep vector)
```

### Troubleshooting

#### 1. Common Issues

**High Memory Usage**
```bash
# Check Vector memory usage
ps aux | grep vector

# Monitor memory trends  
curl -s http://localhost:8686/metrics | grep memory
```

**Processing Delays**
```bash
# Check buffer utilization
curl -s http://localhost:8686/metrics | grep buffer

# Monitor throughput
curl -s http://localhost:8686/metrics | grep events_processed
```

**Mezmo Delivery Failures**
```bash
# Check sink error rates
curl -s http://localhost:8686/metrics | grep sink.*error

# Review failed events
tail -f /tmp/vector/failed/failed-events-$(date +%Y-%m-%d).log
```

#### 2. Health Check Endpoint
```bash
# Check Vector health
curl http://localhost:8687/health

# Response example:
{
    "status": "healthy",
    "timestamp": "2024-03-15T14:32:18.456Z",
    "vector_version": "0.34.0", 
    "pipeline": "restaurant-app",
    "components": {
        "healthy": 12,
        "total": 12,
        "percentage": 100.0
    }
}
```

#### 3. Log Analysis
```bash
# Vector process logs
journalctl -u vector -f

# Check Vector internal events
tail -f /tmp/vector/operations/host-metrics-$(date +%Y-%m-%d).log

# Monitor alerts
tail -f /tmp/vector/alerts/vector-alerts-$(date +%Y-%m-%d).log
```

### Performance Tuning

#### 1. Batch Size Optimization
```toml
# Tune batch sizes based on volume and latency requirements
[sinks.mezmo_critical_events.batch]
max_events = 50      # Small batches for low latency
timeout_secs = 5     # Quick timeout

[sinks.mezmo_access_logs.batch]  
max_events = 1000    # Large batches for throughput
timeout_secs = 60    # Longer timeout acceptable
```

#### 2. Buffer Configuration
```toml
# Configure buffers for reliability
[sinks.mezmo_critical_events.buffer]
type = "disk"
max_size = 268435456  # 256MB
when_full = "block"   # Block to prevent data loss
```

#### 3. Resource Limits
```bash
# Set Vector resource limits in systemd
[Service]
MemoryMax=2G
CPUQuota=200%
```

This Vector integration provides enterprise-grade log processing with intelligent issue detection, aggressive data volume reduction, and optimized Mezmo delivery while maintaining full observability and operational control.