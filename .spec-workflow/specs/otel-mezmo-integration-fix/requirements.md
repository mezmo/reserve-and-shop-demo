# OTEL Mezmo Integration Fix - Requirements Document

## Introduction

The OpenTelemetry (OTEL) integration with Mezmo in the restaurant application has stopped working after implementing the Node.js backend server set. This feature previously functioned correctly and needs to be debugged and fixed to restore telemetry data flow to Mezmo. The existing Mezmo agent integration works perfectly and serves as the template for the required OTEL functionality.

The OTEL integration provides distributed tracing, metrics collection, and log forwarding through the OpenTelemetry Collector to Mezmo's pipeline infrastructure. This is critical for monitoring application performance, debugging issues, and providing sales demonstrations of Mezmo's capabilities.

## Alignment with Product Vision

This feature directly supports the product vision by:
- **Demonstration Reliability**: Ensuring OTEL data flows reliably for client demonstrations
- **Multi-Agent Support**: Maintaining compatibility with multiple telemetry collection agents (Mezmo Agent, OTEL Collector)
- **Professional Appearance**: Providing working telemetry dashboards suitable for sales presentations
- **Technical Completeness**: Demonstrating full observability stack integration

## Requirements

### Requirement 1: Configuration File Integration

**User Story:** As a sales engineer, I want OTEL configuration to load defaults from the agents-config.json file just like the Mezmo agent, so that backend and frontend configurations stay synchronized.

#### Acceptance Criteria

1. WHEN the application starts THEN the system SHALL load OTEL configuration from agents-config.json file
2. WHEN preset configurations exist in the file THEN the system SHALL populate server-side ConfigManager with these defaults
3. WHEN switching between preset configurations THEN the system SHALL apply the OTEL settings from the config file
4. IF no config file exists THEN the system SHALL fall back to built-in defaults
5. WHEN using preset configurations THEN the UI SHALL display values as read-only just like Mezmo presets
6. WHEN selecting "custom" configuration THEN the system SHALL allow editing all OTEL settings

### Requirement 2: Server-Side OTEL Configuration Management

**User Story:** As a sales engineer, I want OTEL configuration to be managed server-side just like the Mezmo agent, so that settings persist and can be managed consistently across the application.

#### Acceptance Criteria

1. WHEN the user saves OTEL configuration THEN the system SHALL store the configuration in the server-side ConfigManager
2. WHEN the application restarts THEN the system SHALL restore OTEL configuration from server storage
3. WHEN OTEL configuration changes THEN the system SHALL immediately apply changes to the running collector
4. WHEN multiple users access the configuration THEN the system SHALL show the same consistent settings
5. WHEN loading configuration THEN the system SHALL prioritize: config file presets > server storage > built-in defaults

### Requirement 3: OTEL Collector Process Management

**User Story:** As a sales engineer, I want OTEL Collector to start/stop reliably like the Mezmo agent, so that I can control telemetry collection during demonstrations.

#### Acceptance Criteria

1. WHEN the user enables OTEL THEN the system SHALL start the OTEL Collector process automatically
2. WHEN the user disables OTEL THEN the system SHALL stop the OTEL Collector process cleanly
3. IF the OTEL Collector crashes THEN the system SHALL detect the failure and update status accordingly
4. WHEN the collector is running THEN the system SHALL display process ID and runtime status
5. WHEN configuration changes THEN the system SHALL restart the collector with new settings

### Requirement 4: Multi-Pipeline Configuration Support

**User Story:** As a sales engineer, I want to configure separate Mezmo pipelines for logs, metrics, and traces, so that I can demonstrate different aspects of the observability platform.

#### Acceptance Criteria

1. WHEN configuring OTEL THEN the system SHALL support separate pipeline configurations for logs, metrics, and traces
2. WHEN enabling a pipeline THEN the system SHALL require valid ingestion key and pipeline ID
3. WHEN selecting environment THEN the system SHALL automatically configure the correct Mezmo pipeline host
4. IF pipeline credentials are invalid THEN the system SHALL provide clear validation feedback
5. WHEN pipelines are disabled THEN the system SHALL not attempt to send data to those endpoints
6. WHEN using preset configurations THEN pipeline settings SHALL be loaded from the config file

### Requirement 5: Environment-Aware Configuration

**User Story:** As a sales engineer, I want to easily switch between development, integration, and production Mezmo environments, so that I can demonstrate against appropriate endpoints.

#### Acceptance Criteria

1. WHEN selecting an environment THEN the system SHALL automatically configure the correct pipeline host URLs
2. WHEN choosing "development" THEN the system SHALL use pipeline.use.dev.logdna.net endpoints
3. WHEN choosing "integration" THEN the system SHALL use pipeline.use.int.logdna.net endpoints
4. WHEN choosing "production" THEN the system SHALL use pipeline.mezmo.com endpoints
5. WHEN selecting "custom" THEN the system SHALL allow manual host configuration
6. WHEN using preset configurations THEN environment settings SHALL come from the config file

### Requirement 6: Frontend Tracing Integration

**User Story:** As a sales engineer, I want frontend traces to flow through the OTEL Collector to Mezmo, so that I can demonstrate full-stack distributed tracing capabilities.

#### Acceptance Criteria

1. WHEN OTEL is enabled THEN the frontend SHALL initialize tracing automatically
2. WHEN the collector is unavailable THEN the frontend SHALL handle errors gracefully without impacting user experience
3. WHEN network requests occur THEN the system SHALL generate trace spans automatically
4. WHEN user interactions happen THEN the system SHALL create appropriate trace data
5. IF the backend proxy is unreachable THEN the system SHALL fail silently and log appropriate warnings

### Requirement 7: Status Monitoring and Health Checks

**User Story:** As a sales engineer, I want real-time status information about OTEL Collector connectivity, so that I can verify the setup is working before client demonstrations.

#### Acceptance Criteria

1. WHEN OTEL Collector is running THEN the system SHALL show "connected" status
2. WHEN pipeline connectivity is verified THEN the system SHALL display success indicators
3. WHEN there are connection issues THEN the system SHALL show specific error messages
4. WHEN data is flowing THEN the system SHALL display metrics about logs, traces, and metrics sent
5. IF collector stops responding THEN the system SHALL update status within 30 seconds

### Requirement 8: Configuration Validation and Error Handling

**User Story:** As a sales engineer, I want clear validation feedback when configuring OTEL settings, so that I can quickly identify and fix configuration issues.

#### Acceptance Criteria

1. WHEN entering invalid ingestion keys THEN the system SHALL provide immediate validation feedback
2. WHEN testing connectivity THEN the system SHALL verify pipeline accessibility and report results
3. IF configuration is incomplete THEN the system SHALL prevent activation until all required fields are filled
4. WHEN errors occur THEN the system SHALL provide actionable guidance for resolution
5. IF service name is invalid THEN the system SHALL suggest valid alternatives

### Requirement 9: Configuration Synchronization

**User Story:** As a sales engineer, I want OTEL configuration to stay synchronized between the config file, server storage, and UI, so that settings remain consistent across system restarts.

#### Acceptance Criteria

1. WHEN loading preset configurations from file THEN the system SHALL populate server-side storage with these values
2. WHEN switching from preset to custom THEN the system SHALL copy preset values as starting point
3. WHEN custom configuration is saved THEN the system SHALL store it separately from file presets
4. WHEN returning to a preset THEN the system SHALL reload values from the config file
5. IF config file is updated THEN the system SHALL reload presets on next application start

## Non-Functional Requirements

### Code Architecture and Modularity
- **Configuration File Priority**: Must load configuration from agents-config.json file as primary source, falling back to server storage then built-in defaults
- **Server-Side Management**: All OTEL configuration and process management must be handled server-side, mirroring the Mezmo agent implementation
- **Configuration Consistency**: OTEL configuration APIs must follow the same patterns as existing Mezmo configuration APIs
- **Error Handling**: Must implement the same graceful error handling patterns used by the working Mezmo agent
- **Status Reporting**: Must provide the same level of status detail and real-time updates as the Mezmo agent

### Performance
- **Startup Time**: OTEL Collector must start within 10 seconds of enabling
- **Resource Usage**: Collector process must use less than 100MB RAM and 10% CPU during normal operation
- **Network Efficiency**: Must batch telemetry data efficiently to minimize network overhead
- **Frontend Impact**: Tracing initialization must not add more than 100ms to application startup
- **Configuration Loading**: Config file parsing must complete within 1 second

### Security
- **Credential Storage**: Ingestion keys must be stored securely server-side, not in frontend localStorage
- **Process Management**: Collector process must run with minimal required privileges
- **Network Access**: Must only connect to configured Mezmo pipeline endpoints
- **Configuration Validation**: Must validate all configuration inputs to prevent injection attacks
- **Config File Security**: Must validate config file schema to prevent malicious configurations

### Reliability
- **Process Recovery**: Must detect and recover from collector process failures automatically
- **Connection Resilience**: Must handle network connectivity issues gracefully
- **Configuration Persistence**: Must maintain configuration across application restarts
- **Fallback Behavior**: Must degrade gracefully when collector is unavailable
- **Config File Handling**: Must handle missing or malformed config files gracefully

### Usability
- **Configuration UI**: Must provide the same intuitive configuration experience as the working Mezmo agent
- **Status Visibility**: Must clearly indicate OTEL status at all times
- **Error Messages**: Must provide clear, actionable error messages for common issues
- **Environment Switching**: Must make it easy to switch between development, integration, and production environments
- **Preset Management**: Must clearly indicate when using preset vs custom configurations