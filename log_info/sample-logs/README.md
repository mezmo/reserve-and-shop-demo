# Sample Log Repository

## Overview

This directory contains real log examples from the restaurant application, organized by format and use case. These samples demonstrate the actual data structures, patterns, and edge cases encountered in production.

## Directory Structure

```
sample-logs/
├── json/               # JSON format examples
│   ├── access/         # API access logs
│   ├── business/       # Business event logs
│   ├── errors/         # Error and exception logs
│   ├── performance/    # Performance metrics
│   └── traces/         # Distributed tracing logs
├── clf/                # Common Log Format examples
│   ├── standard/       # Standard CLF format
│   └── extended/       # Extended CLF with additional fields
├── csv/                # CSV format examples
│   ├── metrics/        # System metrics in CSV
│   └── reports/        # Business reports in CSV
├── xml/                # XML format examples
│   └── events/         # Business events in XML
├── string/             # String format examples
│   ├── debug/          # Debug and development logs
│   └── legacy/         # Legacy log formats
├── mixed/              # Multi-format log files
├── edge-cases/         # Problematic and edge case examples
└── failure-simulations/ # Logs from failure scenarios
```

## Usage Guidelines

### For Developers
- Use these samples to test parsing implementations
- Reference edge cases for robust error handling
- Copy patterns for consistent logging in new features

### For Operations
- Use for troubleshooting common issues
- Reference for alerting rule development
- Training material for log analysis

### For Testing
- Input data for unit tests
- Integration test scenarios
- Performance benchmarking data

## Sample Selection Criteria

All samples are:
- **Real**: Actual output from the restaurant application
- **Anonymized**: Sensitive data removed or masked
- **Representative**: Cover common patterns and edge cases
- **Documented**: Each sample includes context and explanation

## Log Volume Statistics

Based on actual application usage:
- JSON logs: ~1,000 entries/hour (normal operation)
- CLF access logs: ~500 entries/hour 
- Error logs: ~10-50 entries/hour
- Business events: ~200 entries/hour
- Performance metrics: ~100 entries/hour

## Common Patterns

### Correlation IDs
All logs include correlation identifiers:
- `traceId`: Distributed tracing ID
- `sessionId`: User session identifier
- `requestId`: Individual request ID
- `journeyId`: Business process tracking

### Timestamp Formats
- JSON: ISO 8601 with milliseconds
- CLF: Standard CLF timestamp format
- String: Human-readable format
- CSV: ISO 8601 for consistency

### Error Patterns
- Structured error objects with stack traces
- HTTP error responses with context
- Database connection failures
- Third-party service timeouts

## Integration Examples

Each sample directory includes:
- Raw log files
- Parsed JSON representations
- Parser configuration examples
- Pipeline integration snippets
- Common query patterns