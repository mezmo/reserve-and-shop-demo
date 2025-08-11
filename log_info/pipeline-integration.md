# Data Pipeline Integration Guide

## Overview

This guide covers integration strategies for telemetry data pipelines, focusing on OpenTelemetry Collector configuration, Mezmo pipeline setup, and end-to-end data flow optimization for the restaurant application.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │    │ OTEL Collector  │    │ Mezmo Platform  │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Logs      │─┼───▶│ │ File Recv   │ │    │ │ Log Pipeline│ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │        │        │    │        │        │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │  Metrics    │─┼───▶│ │ Host Recv   │─┼───▶│ │Metric Pipeline│ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │        │        │    │        │        │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Traces    │─┼───▶│ │ OTLP Recv   │ │    │ │Trace Pipeline│ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## OpenTelemetry Collector Configuration

### Multi-Pipeline Setup

The OTEL Collector is configured with separate pipelines for logs, metrics, and traces, each optimized for different data types and processing requirements.

#### Complete Configuration Example

```yaml
# /etc/otelcol/config.yaml
receivers:
  # Logs from structured log files
  filelog:
    include:
      - /tmp/codeuser/access.log
      - /tmp/codeuser/events.log
      - /tmp/codeuser/performance.log
      - /tmp/codeuser/restaurant-performance.log
      - /tmp/codeuser/errors.log
      - /tmp/codeuser/metrics.log
      - /tmp/codeuser/app.log
    start_at: beginning
    operators:
      - type: add
        field: attributes.log_type
        value: structured
      - type: add
        field: attributes.service
        value: restaurant-app

  # Host system metrics
  hostmetrics:
    collection_interval: 30s
    scrapers:
      cpu:
        metrics:
          system.cpu.utilization:
            enabled: true
      memory:
        metrics:
          system.memory.utilization:
            enabled: true
      disk:
        metrics:
          system.disk.io:
            enabled: true
      filesystem:
        metrics:
          system.filesystem.utilization:
            enabled: true
      network:
        metrics:
          system.network.io:
            enabled: true

  # Application traces from browser and server
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318
        cors:
          allowed_origins:
            - http://localhost:8080
            - http://localhost:3000
          allowed_headers: ['*']
          max_age: 7200

processors:
  # Batch processing for efficiency
  batch:
    timeout: 1s
    send_batch_size: 1024

  # Resource attribution and correlation
  resource:
    attributes:
      - key: service.name
        value: restaurant-app
        action: upsert
      - key: service.version
        value: 1.0.0
        action: upsert
      - key: deployment.environment
        value: demo
        action: upsert
      - key: service.tags
        value: restaurant-app,otel
        action: upsert

exporters:
  # Debug exporters for troubleshooting
  logging/logs:
    loglevel: info
  
  file/logs:
    path: /tmp/codeuser/otel-logs-debug.json
    format: json

  # Modern Mezmo Pipeline export (preferred)
  otlphttp/logs:
    logs_endpoint: https://pipeline.mezmo.com/v1/YOUR_PIPELINE_ID
    headers:
      authorization: YOUR_INGESTION_KEY
      content-type: application/x-protobuf

  otlphttp/metrics:
    endpoint: https://pipeline.mezmo.com/v1/YOUR_METRICS_PIPELINE_ID
    headers:
      authorization: YOUR_METRICS_INGESTION_KEY
      content-type: application/x-protobuf

  otlphttp/traces:
    endpoint: https://pipeline.mezmo.com/v1/YOUR_TRACES_PIPELINE_ID
    headers:
      authorization: YOUR_TRACES_INGESTION_KEY
      content-type: application/x-protobuf

  # Legacy LogDNA export (fallback)
  mezmo/logs:
    ingest_url: "https://logs.mezmo.com/otel/ingest/rest"
    ingest_key: YOUR_LEGACY_INGESTION_KEY

service:
  pipelines:
    # Logs pipeline: File → Resource → Batch → Export
    logs:
      receivers: [filelog]
      processors: [resource, batch]
      exporters: [file/logs, otlphttp/logs]

    # Metrics pipeline: Host → Resource → Batch → Export  
    metrics:
      receivers: [hostmetrics]
      processors: [resource, batch]
      exporters: [otlphttp/metrics]

    # Traces pipeline: OTLP → Resource → Batch → Export
    traces:
      receivers: [otlp]
      processors: [resource, batch]
      exporters: [otlphttp/traces]

  telemetry:
    logs:
      level: info
    metrics:
      address: 0.0.0.0:8888
```

## Mezmo Integration Strategies

### Modern Pipeline vs Legacy Integration

#### Modern Pipeline Approach (Recommended)

**Advantages**:
- Advanced data transformation capabilities
- Real-time processing and routing
- Enhanced correlation and enrichment
- Better performance and scalability

**Configuration**:
```javascript
// Modern pipeline configuration
const modernConfig = {
  logsEnabled: true,
  logsIngestionKey: "YOUR_LOGS_INGESTION_KEY",
  logsPipelineId: "YOUR_LOGS_PIPELINE_ID",
  logsHost: "pipeline.mezmo.com",
  
  metricsEnabled: true,
  metricsIngestionKey: "YOUR_METRICS_INGESTION_KEY", 
  metricsPipelineId: "YOUR_METRICS_PIPELINE_ID",
  
  tracesEnabled: true,
  tracesIngestionKey: "YOUR_TRACES_INGESTION_KEY",
  tracesPipelineId: "YOUR_TRACES_PIPELINE_ID"
};
```

**Pipeline Endpoints**:
- Logs: `https://pipeline.mezmo.com/v1/{PIPELINE_ID}`
- Metrics: `https://pipeline.mezmo.com/v1/{METRICS_PIPELINE_ID}`
- Traces: `https://pipeline.mezmo.com/v1/{TRACES_PIPELINE_ID}`

#### Legacy LogDNA Integration

**Use Cases**:
- Backwards compatibility
- Simple log ingestion requirements
- Migration scenarios

**Configuration**:
```javascript
// Legacy LogDNA configuration
const legacyConfig = {
  logsEnabled: true,
  logsIngestionKey: "YOUR_LEGACY_INGESTION_KEY",
  logsHost: "logs.mezmo.com"
};
```

**Legacy Endpoints**:
- Logs: `https://logs.mezmo.com/otel/ingest/rest`
- Metrics: `https://logs.mezmo.com/v1/metrics`
- Traces: `https://logs.mezmo.com/v1/traces`

### Authentication Methods

#### Modern Pipeline Authentication
```yaml
headers:
  authorization: YOUR_INGESTION_KEY
  content-type: application/x-protobuf
```

#### Legacy Authentication
```yaml
headers:
  authorization: Bearer YOUR_LEGACY_INGESTION_KEY
  x-mezmo-service: restaurant-app
```

## Data Flow Optimization

### Log File Management

#### Structured Log Files
The application generates multiple structured log files, each optimized for different use cases:

```bash
/tmp/codeuser/
├── access.log          # CLF format access logs
├── events.log          # JSON format business events  
├── performance.log     # JSON format performance metrics
├── restaurant-performance.log  # Application-specific metrics
├── errors.log          # JSON format error logs
├── metrics.log         # JSON format system metrics
└── app.log            # JSON format application logs
```

#### File Rotation Strategy
```yaml
# Logrotate configuration
/tmp/codeuser/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 app app
}
```

### Real-Time Data Processing

#### Batch Processing Configuration
```yaml
processors:
  batch:
    timeout: 1s                 # Process every second
    send_batch_size: 1024       # Or when 1024 records accumulated
    send_batch_max_size: 2048   # Maximum batch size limit
```

#### Resource Attribution
```yaml
processors:
  resource:
    attributes:
      # Service identification
      - key: service.name
        value: restaurant-app
        action: upsert
      - key: service.version  
        value: 1.0.0
        action: upsert
      # Environment context
      - key: deployment.environment
        value: demo
        action: upsert
      # Custom tags for filtering
      - key: service.tags
        value: restaurant-app,otel,nodejs
        action: upsert
      # Instance identification
      - key: service.instance.id
        value: restaurant-app-001
        action: upsert
```

## Correlation Strategies

### Trace-to-Log Correlation

#### Frontend Trace Context
```typescript
// SessionTracker generates correlated identifiers
const sessionTracker = new SessionTracker();
const traceId = sessionTracker.getTraceId();
const sessionId = sessionTracker.getSessionId();

// Include in all log entries
logger.info('User interaction', {
  traceId,
  sessionId,
  event: 'checkout_started',
  userId: 'virtual_user_001'
});
```

#### Backend Correlation
```javascript
// Express middleware adds correlation context
app.use((req, res, next) => {
  req.requestId = generateRequestId();
  req.traceId = extractTraceId(req.headers);
  req.sessionId = extractSessionId(req.headers);
  next();
});

// Loggers include correlation IDs
appLogger.info('Order processed', {
  requestId: req.requestId,
  traceId: req.traceId,
  sessionId: req.sessionId,
  orderId: order.id
});
```

### Business Event Correlation

#### Virtual User Journey Tracking
```javascript
// VirtualUser class correlates all actions
class VirtualUser {
  async executeJourney() {
    // All interactions include journey context
    this.metricsLogger.logCounter('user_sessions', 1, {
      'user.journey': this.journey.name,
      'trace.id': this.sessionTracker.getTraceId(),
      'session.id': this.sessionTracker.getSessionId()
    });
  }
}
```

#### Cross-Service Correlation
```javascript
// Business events include multiple correlation dimensions
logBusinessEvent('order_created', 'create', {
  orderId: order.id,
  customerEmail: customer.email,
  traceId: req.traceId,
  sessionId: req.sessionId,
  journeyType: 'checkout',
  value: order.total,
  unit: 'USD'
}, req);
```

## Performance Optimization

### Collection Intervals

#### Host Metrics Collection
```yaml
hostmetrics:
  collection_interval: 30s    # Balance between accuracy and overhead
  scrapers:
    cpu:
      metrics:
        system.cpu.utilization:
          enabled: true
```

#### File Monitoring
```yaml
filelog:
  poll_interval: 200ms        # Check for new log entries every 200ms
  start_at: beginning         # Process existing logs on startup
  max_log_size: 1MiB         # Skip very large log entries
```

### Network Optimization

#### Compression and Batching
```yaml
exporters:
  otlphttp/logs:
    compression: gzip         # Compress data in transit
    timeout: 30s             # Request timeout
    retry_on_failure:
      enabled: true
      initial_interval: 1s
      max_interval: 30s
      max_elapsed_time: 300s
```

#### Connection Pooling
```yaml
exporters:
  otlphttp/metrics:
    sending_queue:
      enabled: true
      num_consumers: 2        # Parallel export workers
      queue_size: 1000       # Buffer size
```

## Monitoring and Alerting

### Collector Health Monitoring

#### Internal Metrics
```yaml
service:
  telemetry:
    metrics:
      address: 0.0.0.0:8888  # Expose internal metrics
      level: detailed
```

#### Health Check Endpoints
```bash
# Check collector status
curl http://localhost:8888/metrics

# Key metrics to monitor
curl http://localhost:8888/metrics | grep -E "(otelcol_exporter_sent|otelcol_processor_batch)"
```

### Pipeline Monitoring

#### Export Success Rates
```
# Logs successfully sent
otelcol_exporter_sent_log_records_total{exporter="otlphttp/logs"} 15420

# Metrics successfully sent  
otelcol_exporter_sent_metric_points_total{exporter="otlphttp/metrics"} 8934

# Traces successfully sent
otelcol_exporter_sent_spans_total{exporter="otlphttp/traces"} 2156
```

#### Error Monitoring
```
# Failed exports requiring attention
otelcol_exporter_send_failed_log_records_total 23
otelcol_exporter_send_failed_metric_points_total 5
otelcol_exporter_send_failed_spans_total 0
```

## Troubleshooting Guide

### Common Issues

#### 1. Pipeline Not Receiving Data
**Symptoms**: Zero metrics in `otelcol_exporter_sent_*`
**Diagnosis**:
```bash
# Check if files are being read
curl http://localhost:8888/metrics | grep filelog_receiver

# Check processor metrics
curl http://localhost:8888/metrics | grep processor_batch
```
**Solutions**:
- Verify file paths exist and are readable
- Check file permissions (644 recommended)
- Confirm log rotation isn't interfering

#### 2. Export Failures
**Symptoms**: High `send_failed_*` metrics
**Diagnosis**:
```bash
# Check collector logs
tail -f /tmp/codeuser/otel-collector.log

# Look for authentication errors, network timeouts
```
**Solutions**:
- Verify ingestion keys are correct
- Check network connectivity to Mezmo endpoints
- Confirm pipeline IDs exist and are active

#### 3. High Resource Usage
**Symptoms**: High CPU or memory usage by collector
**Diagnosis**:
```bash
# Monitor collector process
top -p $(cat /tmp/codeuser/otel-collector.pid)

# Check queue sizes
curl http://localhost:8888/metrics | grep queue_size
```
**Solutions**:
- Reduce collection intervals
- Increase batch sizes
- Enable compression
- Add more export workers

### Performance Tuning

#### For High Volume Scenarios
```yaml
receivers:
  filelog:
    poll_interval: 500ms      # Reduce polling frequency
    
processors:
  batch:
    timeout: 5s              # Larger batches
    send_batch_size: 2048    # More data per request
    
exporters:
  otlphttp/logs:
    sending_queue:
      queue_size: 5000       # Larger buffer
      num_consumers: 4       # More workers
```

#### For Low Latency Requirements
```yaml
processors:
  batch:
    timeout: 100ms           # Send data quickly
    send_batch_size: 100     # Smaller batches for low latency

exporters:
  otlphttp/logs:
    timeout: 5s              # Faster timeout
```

## Integration Examples

### Restaurant App Specific Configuration

#### Business Metrics Pipeline
```yaml
# Custom attributes for restaurant app
processors:
  resource:
    attributes:
      - key: business.type
        value: restaurant
        action: upsert
      - key: business.location
        value: demo_location
        action: upsert
      - key: app.features
        value: ordering,reservations,payments
        action: upsert
```

#### Customer Journey Correlation
```yaml
# Enrichment processor for customer data
processors:
  transform:
    log_statements:
      - context: log
        statements:
          - set(attributes["customer.journey.stage"], "checkout") where attributes["event"] == "CART_ADD"
          - set(attributes["customer.journey.stage"], "payment") where attributes["event"] == "payment_initiated"
```

This comprehensive pipeline integration guide ensures optimal data flow from the restaurant application through OpenTelemetry Collector to Mezmo platform, with proper correlation, monitoring, and troubleshooting capabilities.