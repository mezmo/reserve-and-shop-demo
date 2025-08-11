# Vector-Specific Troubleshooting Addendum

This addendum extends the main troubleshooting playbook with Vector-specific detection methods and solutions for the issues identified in the original playbook.

## Vector Detection Enhancement

For each issue in the troubleshooting playbook, Vector now provides:
1. **Real-time Detection**: VRL patterns that detect issues as they occur
2. **Automated Alerting**: Structured alerts with escalation information
3. **Context Enrichment**: Additional metadata for faster resolution
4. **Correlation**: Links related events across the system

## Issue Detection Mapping

### Database & Connection Issues

#### 1. Database Connection Pool Exhaustion

**Vector Detection (VRL)**:
```vrl
if .log_level == "error" && 
   (contains(string!(.message ?? ""), "pool exhausted") || 
    .error_code == "DB_POOL_EXHAUSTED") {
    
    .alert_generated = true
    .severity = "critical"
    .issue_category = "database"
    .alerts = push(.alerts, {
        "alert_type": "db_pool_exhausted",
        "runbook": "https://docs.company.com/runbooks/db-pool-exhaustion",
        "immediate_action": "Check pool utilization and restart if needed"
    })
    
    if exists(.poolSize) {
        .pool_utilization = to_float(.activeConnections ?? 0) / to_float(.poolSize)
    }
}
```

**Vector Query for Detection**:
```bash
# Query Vector for pool exhaustion alerts
curl -s http://localhost:8686/metrics | grep -E "(db_pool_utilization|vector_component_errors_total)" | grep database

# Check processing latency
curl -s "http://localhost:8686/graphql" -d '{"query":"query { metrics { name value } }"}'
```

**Mezmo Query (using Vector tags)**:
```sql
SELECT * FROM logs 
WHERE tags CONTAINS 'issue_category:database' 
  AND tags CONTAINS 'alert:generated'
  AND timestamp > NOW() - INTERVAL '1 HOUR'
ORDER BY timestamp DESC
```

#### 2. Slow Database Queries  

**Vector Detection**:
```vrl
if (.duration ?? .responseTime ?? .response_time ?? 0) > 1000 && 
   (contains(string!(.message ?? ""), "query") || exists(.query)) {
    
    .alert_generated = true
    .severity = if (.duration ?? .responseTime ?? .response_time ?? 0) > 5000 { "high" } else { "medium" }
    .issue_category = "performance" 
    .alerts = push(.alerts, {
        "alert_type": "slow_database_query",
        "description": "Database query performance degraded",
        "threshold": 1000,
        "actual_duration": .duration ?? .responseTime ?? .response_time
    })
}
```

### Payment & Financial Processing

#### 4. Payment Gateway Failures

**Vector Detection**:
```vrl
if .log_level == "error" && 
   contains(string!(.message ?? ""), "payment") &&
   (.error_code == "PAYMENT_GATEWAY_ERROR" || contains(string!(.message ?? ""), "declined")) {
    
    .alert_generated = true
    .severity = "high"
    .issue_category = "payment"
    .alerts = push(.alerts, {
        "alert_type": "payment_failure",
        "description": "Payment processing failure detected", 
        "business_impact": true
    })
    
    if exists(.amount) {
        .alert_context.financial_impact = {
            "amount": .amount,
            "currency": .currency ?? "USD",
            "order_id": .order_id
        }
    }
}
```

**Vector Business Impact Query**:
```bash
# Get payment failure business impact
curl -s http://localhost:8686/metrics | grep "restaurant_app_errors_total" | grep payment
```

### Performance & Memory Problems

#### 6. High Memory Usage

**Vector Detection**:
```vrl
if exists(.memory_usage) && .memory_usage > 80.0 {
    .alert_generated = true
    .severity = if .memory_usage > 90.0 { "critical" } else { "medium" }
    .issue_category = "performance"
    .alerts = push(.alerts, {
        "alert_type": "high_memory_usage",
        "description": "Memory usage exceeded threshold",
        "threshold": 80.0,
        "current_usage": .memory_usage
    })
}
```

**Vector System Monitoring**:
```bash
# Check Vector's own memory usage
ps aux | grep vector
curl -s http://localhost:8686/metrics | grep vector_memory_usage_bytes
```

### Service Reliability Issues

#### 9. High Error Rate

**Vector Detection**:
```vrl
if (.status_code ?? .status ?? 0) >= 500 {
    .alert_generated = true
    .severity = "high"
    .issue_category = "reliability"
    .alerts = push(.alerts, {
        "alert_type": "server_error",
        "description": "Server error detected",
        "status_code": .status_code ?? .status,
        "endpoint": .url ?? .endpoint
    })
}
```

**Vector Error Rate Analysis**:
```bash
# Get error rate metrics from Vector
curl -s http://localhost:8686/metrics | grep "restaurant_app_errors_total" | \
  awk '{print $1, $2}' | sort -k2 -n
```

## Vector-Specific Troubleshooting

### Vector Pipeline Issues

#### V1. Vector Service Not Starting

**Detection**:
```bash
systemctl status vector
journalctl -u vector -n 50
```

**Common Causes**:
1. Configuration syntax errors
2. Permission issues
3. Port conflicts
4. VRL script errors

**Solutions**:
```bash
# Validate configuration
vector validate /etc/vector/vector.toml

# Check VRL scripts
for vrl in /etc/vector/vrl/*.vrl; do
    echo "Checking $vrl"
    vector vrl "$vrl" --input '{}'
done

# Fix permissions
chown -R vector:vector /etc/vector/
chown -R vector:vector /tmp/vector/
```

#### V2. High Vector Memory Usage

**Detection**:
```vrl
# In Vector monitoring transform
if contains(string!(.name ?? ""), "memory") && .value > 1073741824 {  # 1GB
    .alert_generated = true
    .alerts = push(.alerts, {
        "type": "high_vector_memory_usage",
        "memory_bytes": .value,
        "severity": "medium"
    })
}
```

**Solutions**:
```toml
# Reduce batch sizes
[sinks.mezmo_access_logs.batch]
max_events = 500  # Reduce from 1000
timeout_secs = 30

# Add memory limiter
[transforms.memory_limit]
type = "reduce"
group_by = ["session_id"]
```

#### V3. Vector Processing Delays

**Detection**:
```bash
# Check processing latency
curl -s http://localhost:8686/metrics | grep component_received_events_total
curl -s http://localhost:8686/metrics | grep component_sent_events_total

# Calculate processing rate
echo "Events received: $(curl -s http://localhost:8686/metrics | grep received_events_total | tail -1 | awk '{print $2}')"
echo "Events sent: $(curl -s http://localhost:8686/metrics | grep sent_events_total | tail -1 | awk '{print $2}')"
```

**Solutions**:
```toml
# Increase parallelism
[sources.restaurant_app_logs]
max_read_bytes = 2048
concurrency = 4

# Optimize transforms
[transforms.intelligent_sampling]
# Use more efficient sampling logic
drop_on_abort = true
```

#### V4. Mezmo Delivery Failures

**Detection**:
```vrl
# In Vector sink monitoring
if contains(string!(.name ?? ""), "sink") && 
   contains(string!(.name ?? ""), "error") && 
   .value > 5 {
    .alert_generated = true
    .alerts = push(.alerts, {
        "type": "mezmo_delivery_failures",
        "component": .component_name ?? "unknown",
        "error_count": .value,
        "severity": "high"
    })
}
```

**Solutions**:
```bash
# Check Mezmo connectivity
curl -v https://pipeline.mezmo.com/v1/health

# Verify authentication
curl -X POST https://pipeline.mezmo.com/v1/YOUR_PIPELINE_ID \
  -H "authorization: YOUR_INGESTION_KEY" \
  -H "content-type: application/json" \
  -d '{"test": "connectivity"}'

# Check Vector sink errors
journalctl -u vector | grep -i mezmo | grep -i error
```

```toml
# Improve retry configuration
[sinks.mezmo_critical_events.request]
retry_attempts = 5
retry_initial_backoff_secs = 1
retry_max_duration_secs = 300

# Add buffer for reliability  
[sinks.mezmo_critical_events.buffer]
type = "disk"
max_size = 268435456  # 256MB
when_full = "block"
```

## Vector Monitoring Queries

### Essential Vector Metrics

```bash
# Vector health check
curl http://localhost:8687/health

# Component status
curl -s http://localhost:8686/metrics | grep "vector_component_errors_total"

# Processing throughput
curl -s http://localhost:8686/metrics | grep "vector_component_received_events_total"

# Memory usage
curl -s http://localhost:8686/metrics | grep "vector_memory_usage_bytes"

# Buffer utilization
curl -s http://localhost:8686/metrics | grep "vector_buffer_"
```

### Mezmo Integration Status

```bash
# Check Mezmo delivery success
curl -s http://localhost:8686/metrics | grep "vector_component_sent_events_total" | grep mezmo

# Monitor delivery errors
curl -s http://localhost:8686/metrics | grep "vector_sink_send_errors_total"

# Check batch processing
curl -s http://localhost:8686/metrics | grep "vector_sink_batch_"
```

## Operational Runbooks

### Vector Restart Procedure

```bash
# 1. Validate configuration before restart
vector validate /etc/vector/vector.toml

# 2. Backup current state
cp /tmp/vector/metrics/performance-$(date +%Y-%m-%d).log /tmp/vector-backup/

# 3. Graceful restart
systemctl reload vector  # Preferred method

# 4. Force restart if needed
systemctl restart vector

# 5. Verify startup
sleep 10
systemctl status vector
curl http://localhost:8686/health
```

### Vector Configuration Update

```bash
# 1. Backup current config
cp /etc/vector/vector.toml /etc/vector/vector.toml.backup.$(date +%Y%m%d_%H%M%S)

# 2. Deploy new configuration
cp /app/vector/vector.toml /etc/vector/

# 3. Validate new configuration
vector validate /etc/vector/vector.toml

# 4. Reload configuration
systemctl reload vector

# 5. Monitor for issues
watch -n 5 'curl -s http://localhost:8686/metrics | grep errors_total'
```

### Emergency Procedures

#### Vector Complete Failure
```bash
# 1. Stop Vector to prevent further issues
systemctl stop vector

# 2. Start backup log forwarding
rsyslog_forward_setup.sh  # Emergency log forwarding

# 3. Diagnose issue
/app/vector/scripts/troubleshoot.sh full

# 4. Fix and restart
systemctl start vector

# 5. Verify recovery
curl http://localhost:8686/health
```

#### High Resource Usage
```bash
# 1. Check Vector resource usage
ps aux | grep vector
curl -s http://localhost:8686/metrics | grep memory

# 2. Reduce processing load
# Edit configuration to reduce batch sizes
systemctl reload vector

# 3. Clear buffers if needed
find /tmp/vector -name "*.buf" -delete

# 4. Monitor recovery
watch -n 5 'ps aux | grep vector'
```

This Vector-specific troubleshooting addendum provides comprehensive detection and resolution procedures that integrate seamlessly with the existing troubleshooting playbook while leveraging Vector's powerful processing capabilities.