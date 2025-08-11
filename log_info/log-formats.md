# Log Formats Analysis

## Overview

The restaurant application generates telemetry data in multiple formats across frontend and backend components. This comprehensive analysis covers all log formats, their characteristics, parsing strategies, and optimal use cases.

## Backend Winston Log Formats

### 1. JSON Format

**Structure**: Structured JSON with metadata, timestamps, and correlation IDs
```json
{
  "timestamp": "2025-08-07T14:30:45.123Z",
  "level": "INFO",
  "message": "HTTP request processed",
  "service": "app",
  "loggerType": "access",
  "requestId": "req_1691416245123_abc123",
  "method": "POST",
  "url": "/api/orders",
  "status": 201,
  "responseTime": 245,
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "contentLength": 1247,
  "traceId": "4f2b8c1a9d3e6f8b2c4a9e7f1d5c3b8a",
  "spanId": "2c4a9e7f1d5c3b8a"
}
```

**Characteristics**:
- CPU Usage: Medium
- Memory Usage: Medium  
- Parseability: Excellent
- Compression: Good
- Best for: Structured analysis, correlation, machine processing

**Configuration Options**:
- `indent`: 0 (compact), 2, or 4 spaces
- `includeStackTrace`: Include full error stack traces
- `includeMetadata`: Add format metadata to entries

### 2. Common Log Format (CLF)

**Structure**: Standard web server access log format
```
192.168.1.100 - user123 [07/Aug/2025:14:30:45 +0000] "POST /api/orders HTTP/1.1" 201 1247
```

**Extended CLF**:
```
192.168.1.100 - user123 [07/Aug/2025:14:30:45 +0000] "POST /api/orders HTTP/1.1" 201 1247 "http://localhost:8080/menu" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" 245ms
```

**Characteristics**:
- CPU Usage: Low
- Memory Usage: Low
- Parseability: Good  
- Compression: Excellent
- Best for: Access log analysis, log aggregation tools, space efficiency

**Fields**:
1. Client IP address
2. Identity (usually -)
3. Authenticated user (or -)
4. Timestamp [DD/MMM/YYYY:HH:mm:ss +0000]
5. HTTP request "METHOD /path PROTOCOL"
6. Status code
7. Response size in bytes
8. Referer (extended)
9. User-Agent (extended)
10. Response time (extended)

### 3. String Format

**Structure**: Human-readable timestamped logs with JSON metadata
```
2025-08-07 14:30:45 [INFO] HTTP request processed {"requestId":"req_1691416245123_abc123","method":"POST","url":"/api/orders","status":201,"responseTime":245}
```

**Characteristics**:
- CPU Usage: Low
- Memory Usage: Low
- Parseability: Good
- Compression: Good
- Best for: Human debugging, quick analysis, development environments

### 4. CSV Format

**Structure**: Comma-separated values with proper escaping
```csv
"2025-08-07T14:30:45.123Z","INFO","HTTP request processed","{""requestId"":""req_1691416245123_abc123"",""method"":""POST""}"
```

**Characteristics**:
- CPU Usage: Low
- Memory Usage: Low
- Parseability: Good
- Compression: Good  
- Best for: Spreadsheet analysis, data import, statistical analysis

**Parsing Considerations**:
- Fields wrapped in double quotes
- Internal quotes escaped as ""
- Metadata stored as escaped JSON string in last column

### 5. XML Format

**Structure**: XML with proper entity escaping
```xml
<log>
  <timestamp>2025-08-07T14:30:45.123Z</timestamp>
  <level>INFO</level>
  <message>HTTP request processed</message>
  <meta>{"requestId":"req_1691416245123_abc123","method":"POST"}</meta>
</log>
```

**Characteristics**:
- CPU Usage: Medium
- Memory Usage: Medium
- Parseability: Good
- Compression: Poor
- Best for: Enterprise systems, SOAP integration, XML processing pipelines

## Frontend Performance Logs

### Session-Based JSON Logging

**Structure**: Client-side performance and interaction tracking
```json
{
  "timestamp": "2025-07-29T16:58:40.038Z",
  "event": "SESSION_START",
  "sessionId": "session_1753808320038_k2nt27g3y",
  "details": {
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "viewport": "1947x1277",
    "url": "http://localhost:8080/menu"
  }
}
```

### User Journey Tracking

**Navigation Events**:
```json
{
  "timestamp": "2025-07-29T17:00:29.693Z",
  "event": "ROUTE_CHANGE",
  "path": "/menu -> /reservations",
  "duration": 25592.30000000447,
  "details": {
    "fromPath": "/menu",
    "toPath": "/reservations",
    "memoryUsage": {
      "usedJSHeapSize": 22209769,
      "totalJSHeapSize": 24205081,
      "jsHeapSizeLimit": 4294705152
    }
  },
  "sessionId": "session_1753808320038_k2nt27g3y"
}
```

**User Interactions**:
```json
{
  "timestamp": "2025-07-29T17:00:05.970Z",
  "event": "USER_INTERACTION",
  "duration": 1.1000000014901161,
  "details": {
    "interactionType": "click",
    "element": "add-to-cart-Margherita Pizza",
    "path": "/menu"
  },
  "sessionId": "session_1753808320038_k2nt27g3y"
}
```

**Cart Operations**:
```json
{
  "timestamp": "2025-07-29T17:00:05.969Z",
  "event": "CART_ADD",
  "path": "/menu",
  "duration": 0.10000000149011612,
  "details": {
    "productId": "1",
    "productName": "Margherita Pizza",
    "productPrice": 18.99,
    "productCategory": "Pizza",
    "quantityBefore": 0,
    "quantityAfter": 1,
    "quantityChange": "0->1",
    "cartTotal": "18.99",
    "action": "ADD",
    "path": "/menu"
  },
  "sessionId": "session_1753808320038_k2nt27g3y"
}
```

## OpenTelemetry Trace Format

### Distributed Tracing Structure

**Span Context**:
```json
{
  "traceId": "4f2b8c1a9d3e6f8b2c4a9e7f1d5c3b8a",
  "spanId": "2c4a9e7f1d5c3b8a",
  "parentSpanId": "1d5c3b8a2c4a9e7f",
  "flags": 1
}
```

**Span Attributes**:
```json
{
  "service.name": "restaurant-app",
  "service.version": "1.0.0",
  "http.method": "POST",
  "http.url": "/api/orders",
  "http.status_code": 201,
  "user.id": "virtual_user_001",
  "session.id": "session_1753808320038_k2nt27g3y",
  "custom.order_amount": 37.98
}
```

## System Failure Simulation Logs

### Database Connection Pool Exhaustion
```json
{
  "timestamp": "2025-08-07T14:35:12.456Z",
  "level": "ERROR",
  "message": "Database connection pool exhausted",
  "service": "errors",
  "poolSize": 3,
  "activeConnections": 3,
  "queueLength": 15,
  "errorCode": "POOL_EXHAUSTED",
  "severity": "high"
}
```

### Payment Gateway Failures
```json
{
  "timestamp": "2025-08-07T14:40:33.789Z",
  "level": "ERROR", 
  "message": "Payment gateway connection failed",
  "service": "errors",
  "gateway": "stripe",
  "endpoint": "https://api.stripe.com/v1/charges",
  "error": "ECONNREFUSED",
  "errorCode": "GATEWAY_UNREACHABLE",
  "severity": "high"
}
```

### Memory Pressure Events
```json
{
  "timestamp": "2025-08-07T14:42:15.123Z",
  "level": "WARN",
  "message": "Memory usage increasing",
  "service": "metrics",
  "metricName": "memory_heap_used",
  "value": 89456123,
  "unit": "bytes",
  "heapTotal": 104857600,
  "heapPercentage": 85,
  "leakArrayCount": 42,
  "estimatedLeakSize": 419430400
}
```

### Cascading Service Failures
```json
{
  "timestamp": "2025-08-07T14:45:44.567Z",
  "level": "ERROR",
  "message": "CRITICAL: Complete system failure",
  "service": "errors",
  "services": ["products", "orders", "reservations", "health"],
  "cascadeStage": 5,
  "severity": "critical",
  "errorCode": "SYSTEM_FAILURE",
  "alert": "immediate_action_required"
}
```

## Log Format Selection Guide

### By Use Case

**Development & Debugging**:
- **Primary**: String format for readability
- **Secondary**: JSON for structured analysis

**Production Access Logs**:
- **Primary**: CLF for efficiency and compatibility
- **Secondary**: JSON for detailed analysis

**Business Analytics**:
- **Primary**: JSON for correlation and analysis
- **Secondary**: CSV for spreadsheet import

**Enterprise Integration**:
- **Primary**: XML for SOAP/enterprise systems
- **Secondary**: JSON for modern APIs

**Storage Optimization**:
- **Primary**: CLF for compression efficiency  
- **Secondary**: CSV for structured storage

### By Log Volume

**High Volume (>10k entries/min)**:
- CLF or CSV for minimal CPU overhead
- Avoid XML due to parsing costs

**Medium Volume (1k-10k entries/min)**:
- JSON recommended for balance of features/performance
- String format acceptable for development

**Low Volume (<1k entries/min)**:
- Any format suitable
- Choose based on downstream processing needs

## Format Performance Comparison

| Format | CPU Usage | Memory Usage | Parse Speed | Storage Size | Features |
|--------|-----------|--------------|-------------|--------------|----------|
| JSON   | Medium    | Medium       | Fast        | Medium       | ★★★★★ |
| CLF    | Low       | Low          | Very Fast   | Small        | ★★★ |
| String | Low       | Low          | Fast        | Medium       | ★★ |
| CSV    | Low       | Low          | Fast        | Small        | ★★★ |
| XML    | Medium    | Medium       | Slow        | Large        | ★★★★ |

## Dynamic Format Switching

### Runtime Configuration

The application supports dynamic format switching via API:

```bash
# Change access logger to CLF format
curl -X POST http://localhost:3001/api/logging/formats \
  -H "Content-Type: application/json" \
  -d '{"loggerName": "access", "format": "clf"}'

# Change metrics logger to CSV format  
curl -X POST http://localhost:3001/api/logging/formats \
  -H "Content-Type: application/json" \
  -d '{"loggerName": "metrics", "format": "csv"}'
```

### Format-Specific Configuration

Each format supports customization through `formatOptions`:

```javascript
// JSON formatter options
{
  indent: 2,
  includeStackTrace: true,
  includeMetadata: false
}

// CLF formatter options
{
  extended: true,
  forceCompatibility: false
}
```

## Best Practices

### Production Recommendations

1. **Access Logs**: Use CLF extended format for web server compatibility
2. **Error Logs**: Use JSON format for structured error analysis  
3. **Performance Logs**: Use JSON format for timing correlation
4. **Business Events**: Use JSON format for analytics integration
5. **Debug Logs**: Use String format for human readability

### Correlation Strategies

1. **Request ID**: Include consistent requestId across all log entries
2. **Session Tracking**: Maintain sessionId for user journey correlation
3. **Trace Propagation**: Include traceId and spanId for distributed tracing
4. **Business Context**: Add relevant business identifiers (orderId, userId)

### Storage Optimization

1. **Log Rotation**: Implement size and time-based rotation
2. **Compression**: Enable gzip compression for archived logs  
3. **Format Selection**: Choose most compact format suitable for use case
4. **Field Filtering**: Only log essential fields in high-volume scenarios

This comprehensive format analysis enables optimal log format selection based on specific requirements, performance constraints, and integration needs.