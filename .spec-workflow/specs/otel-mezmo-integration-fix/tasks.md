# OTEL Mezmo Integration Fix - Implementation Plan

## Task Overview

This implementation plan fixes the OTEL integration with Mezmo by following the proven patterns established by the working Mezmo agent. The tasks are organized to first establish the configuration foundation, then fix the backend processes, and finally restore frontend integration. Each task includes specific testing steps to verify completion before proceeding to the next task.

## Tasks

- [ ] 1. Update agents-config.json template with OTEL preset configurations
  - File: agents-config.json.template (modify existing)
  - Add comprehensive OTEL configuration examples for all environments
  - Include placeholder values and documentation comments
  - Ensure structure matches current agents-config.json format
  - **Testing Steps:**
    - Verify JSON syntax is valid using `node -c agents-config.json.template`
    - Compare structure with existing agents-config.json to ensure compatibility
    - Validate all required OTEL fields are present in template
  - Purpose: Provide clear template for OTEL configuration setup
  - _Leverage: existing agents-config.json structure_
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Enhance ConfigManager to load OTEL defaults from config file
  - File: server/services/configManager.js (modify existing)
  - Add method to initialize OTEL config from file presets
  - Implement configuration merging logic (file > storage > defaults)
  - Update getConfig method to return merged OTEL configuration
  - **Testing Steps:**
    - Add unit tests for config merging logic
    - Test with mock config file data to verify priority order
    - Verify getConfig('otel') returns merged configuration
    - Test fallback behavior when config file is missing
  - Purpose: Ensure OTEL configuration follows same patterns as Mezmo agent
  - _Leverage: existing ConfigManager class structure_
  - _Requirements: 1.1, 1.5, 2.1, 2.5_

- [ ] 3. Fix OTEL configuration loading endpoint
  - File: server/index.js (modify existing /api/config/otel endpoint)
  - Update endpoint to return merged configuration from ConfigManager
  - Ensure configuration includes values from agents-config.json file
  - Add proper error handling for missing or invalid configurations
  - **Testing Steps:**
    - Test endpoint with curl: `curl http://localhost:3001/api/config/otel`
    - Verify response includes file-based configuration values
    - Test error handling with invalid configuration data
    - Confirm frontend can load configuration successfully
  - Purpose: Provide frontend with complete OTEL configuration data
  - _Leverage: existing /api/config/otel endpoint structure_
  - _Requirements: 2.1, 2.4, 8.3_

- [ ] 4. Fix OTEL collector configuration generation
  - File: server/index.js (modify generateOTELConfig function)
  - Update YAML generation to use current ConfigManager OTEL settings
  - Ensure multi-pipeline support for logs, metrics, and traces
  - Add environment-specific pipeline host configuration
  - **Testing Steps:**
    - Generate config with test data and validate YAML syntax
    - Verify all enabled pipelines are included in output
    - Test with different environment settings (dev/int/prod)
    - Check generated config against working OTEL collector
  - Purpose: Generate correct OTEL collector configuration from current settings
  - _Leverage: existing generateOTELConfig function_
  - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2_

- [ ] 5. Improve OTEL collector process management
  - File: server/index.js (modify /api/otel/start and /api/otel/stop endpoints)
  - Fix PID file handling and process tracking
  - Add automatic restart when configuration changes
  - Implement proper process cleanup on stop
  - **Testing Steps:**
    - Test start endpoint: `curl -X POST http://localhost:3001/api/otel/start`
    - Verify PID file is created and process is running
    - Test stop endpoint and confirm clean shutdown
    - Test restart behavior when configuration changes
    - Monitor process with `ps aux | grep otel` during testing
  - Purpose: Ensure reliable OTEL collector lifecycle management
  - _Leverage: existing OTEL process management endpoints_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 6. Enhance OTEL status monitoring
  - File: server/index.js (modify /api/otel/status endpoint)
  - Add real-time metrics collection from collector
  - Implement health checks for pipeline connectivity
  - Add error detection and reporting
  - **Testing Steps:**
    - Test status endpoint: `curl http://localhost:3001/api/otel/status`
    - Verify status updates when collector starts/stops
    - Test metrics collection from collector's metrics endpoint
    - Confirm error states are properly reported
  - Purpose: Provide accurate real-time status information like Mezmo agent
  - _Leverage: existing /api/otel/status endpoint_
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 7. Fix backend trace proxy endpoint
  - File: server/index.js (modify /api/traces/v1/traces endpoint)
  - Fix connection to OTEL collector on port 4318
  - Add proper error handling for collector unavailability
  - Implement request forwarding with appropriate headers
  - **Testing Steps:**
    - Test proxy with sample trace data: `curl -X POST http://localhost:3001/api/traces/v1/traces -H "Content-Type: application/x-protobuf"`
    - Verify requests are forwarded to OTEL collector port 4318
    - Test error handling when collector is unavailable
    - Check OTEL collector logs to confirm trace receipt
  - Purpose: Restore frontend trace data flow to OTEL collector
  - _Leverage: existing trace proxy endpoint structure_
  - _Requirements: 6.1, 6.5_

- [ ] 8. Update frontend OTEL configuration loading
  - File: src/pages/Agents.tsx (modify existing OTEL section)
  - Update useEffect hooks to load configuration from backend
  - Implement preset configuration handling matching Mezmo pattern
  - Add configuration merging and fallback logic
  - **Testing Steps:**
    - Open Agents page and verify OTEL configuration loads
    - Test preset switching functionality
    - Verify configuration values match backend data
    - Test loading behavior with different config file setups
  - Purpose: Load OTEL configuration from backend including file presets
  - _Leverage: existing Mezmo agent configuration loading pattern_
  - _Requirements: 1.1, 1.6, 2.1, 9.1_

- [ ] 9. Implement OTEL configuration save functionality
  - File: src/pages/Agents.tsx (modify saveOtelConfig function)
  - Update function to save configuration to backend ConfigManager
  - Add validation before saving configuration
  - Implement error handling and success feedback
  - **Testing Steps:**
    - Modify OTEL configuration and click save button
    - Verify success toast appears
    - Check backend ConfigManager has updated values
    - Test validation with invalid configuration data
    - Verify configuration persists after page refresh
  - Purpose: Persist OTEL configuration changes server-side like Mezmo agent
  - _Leverage: existing saveMezmoConfig function pattern_
  - _Requirements: 2.1, 2.3, 8.1, 8.4_

- [ ] 10. Add OTEL preset configuration support
  - File: src/pages/Agents.tsx (modify OTEL configuration UI)
  - Add preset selector dropdown matching Mezmo agent pattern
  - Implement read-only mode for preset configurations
  - Add configuration switching between preset and custom modes
  - **Testing Steps:**
    - Test preset dropdown appears with available options
    - Verify switching presets updates configuration values
    - Confirm preset mode shows read-only fields
    - Test switching between preset and custom modes
  - Purpose: Provide same preset experience as Mezmo agent
  - _Leverage: existing Mezmo preset configuration UI pattern_
  - _Requirements: 1.5, 1.6, 9.2, 9.4_

- [ ] 11. Update OTEL status display
  - File: src/pages/Agents.tsx (modify OTEL status section)
  - Add real-time status updates from backend
  - Display pipeline-specific status indicators
  - Show collector PID and runtime metrics
  - **Testing Steps:**
    - Start OTEL collector and verify status shows "connected"
    - Check PID display matches actual process ID
    - Test pipeline status indicators for enabled/disabled states
    - Verify metrics display updates in real-time
  - Purpose: Provide comprehensive status information like Mezmo agent
  - _Leverage: existing Mezmo status display patterns_
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 12. Fix frontend tracing initialization
  - File: src/lib/tracing/config.ts (modify initializeTracing function)
  - Update health check to verify collector availability before initialization
  - Fix backend configuration loading endpoint call
  - Add proper error handling for unavailable collector
  - **Testing Steps:**
    - Enable OTEL and verify tracing initializes automatically
    - Check browser console for tracing initialization logs
    - Test trace generation with network requests
    - Verify graceful handling when collector is unavailable
  - Purpose: Restore automatic tracing initialization when OTEL is enabled
  - _Leverage: existing tracing initialization logic_
  - _Requirements: 6.1, 6.2, 6.5_

- [ ] 13. Add OTEL configuration validation
  - File: src/pages/Agents.tsx (add validation functions)
  - Implement ingestion key format validation
  - Add pipeline ID validation for Mezmo format
  - Create host URL validation for different environments
  - **Testing Steps:**
    - Test validation with invalid ingestion keys
    - Enter malformed pipeline IDs and verify error messages
    - Test host URL validation with different formats
    - Confirm valid configurations pass validation
  - Purpose: Provide immediate feedback on configuration errors
  - _Leverage: existing Mezmo validation patterns_
  - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [ ] 14. Implement OTEL connectivity testing
  - File: src/pages/Agents.tsx (add test connection functionality)
  - Add test buttons for each pipeline (logs, metrics, traces)
  - Implement backend connectivity verification
  - Display test results with success/failure indicators
  - **Testing Steps:**
    - Click test buttons for each pipeline
    - Verify successful connections show green indicators
    - Test with invalid credentials to confirm error handling
    - Check backend logs during connectivity tests
  - Purpose: Allow testing of OTEL configuration before enabling
  - _Leverage: existing Mezmo connectivity testing patterns_
  - _Requirements: 8.2, 8.4_

- [ ] 15. Fix environment switching for OTEL
  - File: src/pages/Agents.tsx (modify environment selection)
  - Update host URL configuration for different environments
  - Add automatic host selection when switching environments
  - Implement custom host input for flexibility
  - **Testing Steps:**
    - Switch between dev/int/prod environments
    - Verify host URLs update automatically for each environment
    - Test custom host input functionality
    - Confirm environment changes are reflected in collector config
  - Purpose: Enable easy switching between dev/int/prod Mezmo environments
  - _Leverage: existing Mezmo environment switching logic_
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 16. Add OTEL error handling and recovery
  - File: server/index.js (enhance error handling in OTEL endpoints)
  - Implement automatic retry logic for transient failures
  - Add detailed error messages for common configuration issues
  - Create recovery procedures for crashed collectors
  - **Testing Steps:**
    - Simulate collector crashes and verify recovery
    - Test retry logic with network failures
    - Verify helpful error messages for common issues
    - Test automatic recovery after transient failures
  - Purpose: Provide robust error handling matching Mezmo agent reliability
  - _Leverage: existing error handling patterns_
  - _Requirements: 8.4, 3.3_

- [ ] 17. Create comprehensive integration tests
  - Files: Add test files for end-to-end OTEL flow validation
  - Create tests for configuration loading from file to UI
  - Test collector start/stop with different configurations
  - Validate trace data flow from frontend to Mezmo
  - **Testing Steps:**
    - Run full integration test suite
    - Test configuration persistence across restarts
    - Verify trace data reaches Mezmo dashboard
    - Test error scenarios and recovery procedures
    - Performance test with high trace volume
  - Purpose: Ensure complete OTEL integration works end-to-end
  - _Leverage: existing debugging and testing utilities_
  - _Requirements: All requirements_

- [ ] 18. Update OTEL collector configuration templates and documentation
  - File: log_info/config-examples/otel-collector-configs.yaml (modify existing)
  - Update templates to match generated configuration
  - Add comments explaining configuration options
  - Ensure consistency with runtime configuration generation
  - **Testing Steps:**
    - Validate YAML syntax of updated templates
    - Compare templates with generated configurations
    - Verify examples work with actual OTEL collector
    - Test template configurations against Mezmo endpoints
  - Purpose: Keep documentation aligned with implementation
  - _Leverage: existing OTEL configuration templates_
  - _Requirements: 3.1, 4.1_

## Implementation Notes

### Task Dependencies
- Tasks 1-3 establish configuration foundation and should be completed first
- Tasks 4-7 fix backend functionality and depend on configuration foundation
- Tasks 8-15 restore frontend functionality and depend on backend fixes
- Tasks 16-18 are final improvements and comprehensive testing

### Testing Philosophy
- Each task must be fully tested and working before marking complete
- Use existing Mezmo agent as reference for expected behavior
- Verify configuration changes persist across application restarts
- Test error scenarios to ensure graceful handling
- Include both unit tests and integration tests where applicable

### Test Environment Setup
- Ensure development environment has access to Mezmo dev pipelines
- Set up test data and mock configurations for isolated testing
- Use existing agents-config.json dev configuration for testing
- Monitor OTEL collector logs during testing: `tail -f /tmp/codeuser/otel-collector.log`

### Rollback Plan
- Each task modifies existing files rather than creating new ones
- Git commits for each completed task allow easy rollback if needed
- Existing Mezmo agent functionality serves as fallback reference
- Maintain backup of working configuration before changes

### Success Criteria
- All tasks completed with passing tests
- OTEL configuration loads from agents-config.json file
- Frontend traces successfully reach Mezmo dashboard
- Status monitoring shows accurate real-time information
- Error handling matches Mezmo agent reliability standards