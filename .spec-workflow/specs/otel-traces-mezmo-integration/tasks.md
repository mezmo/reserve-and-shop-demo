# Tasks Document

## Fix OTEL Traces Export to Mezmo Pipeline

### Phase 1: Configuration Updates (Parallel Execution)
These tasks can be executed simultaneously as they modify different files:

- [x] 1.1 Update agents-config.json with correct trace credentials
  - File: /app/agents-config.json
  - Update traces.ingestionKey to "PCptnL3ukYQec5SEDGoC+zaU643ugfQHIGM6/YhGNfs="
  - Verify pipelineId is "5c7e0854-7705-11f0-b8ef-0260f52d7685"
  - Confirm host is "pipeline.use.dev.logdna.net"
  - Purpose: Provide correct authentication for Mezmo pipeline
  - _Requirements: 1.1, 4.1_

- [x] 1.2 Update ConfigManager trace pipeline defaults
  - File: /app/server/services/configManager.js
  - Update default trace ingestion key if not loaded from file
  - Ensure trace pipeline configuration structure matches expected format
  - Add validation for required trace configuration fields
  - Purpose: Maintain correct configuration state for traces
  - _Leverage: Existing ConfigManager patterns_
  - _Requirements: 4.1, 4.2_

- [x] 1.3 Verify frontend trace initialization
  - File: /app/src/lib/tracing/config.ts
  - Confirm health check validates trace pipeline specifically
  - Ensure proper error handling for unavailable collector
  - Verify traces are sent to correct backend proxy endpoint
  - Purpose: Ensure frontend properly initializes tracing
  - _Leverage: Existing tracing initialization code_
  - _Requirements: 3.1, 3.4_

### Phase 2: Backend Fixes (Parallel Execution)
These tasks modify different parts of server/index.js and can run in parallel:

- [x] 2.1 Fix OTEL configuration generator for traces endpoint
  - File: /app/server/index.js (modify generateOTELConfig function)
  - Fix traces exporter endpoint format to include /v1/{pipelineId}
  - Ensure authorization header uses the raw ingestionKey (not Base64 encoded again)
  - Add proper content-type header (application/x-protobuf)
  - Purpose: Generate correct OTEL collector configuration for trace export
  - _Leverage: Existing generateOTELConfig function structure_
  - _Requirements: 1.1, 1.4_

- [x] 2.2 Fix OTEL collector trace receiver configuration
  - File: /app/server/index.js (within generateOTELConfig)
  - Ensure OTLP receiver is configured when traces are enabled
  - Add both gRPC (4317) and HTTP (4318) protocols
  - Configure proper CORS headers for frontend access
  - Purpose: Enable collector to receive traces from frontend via proxy
  - _Leverage: Existing receiver configuration patterns_
  - _Requirements: 1.2, 3.2_

- [x] 2.3 Add trace debug file output
  - File: /app/server/index.js (generateOTELConfig)
  - Ensure file/traces exporter is configured for debugging
  - Set output path to /tmp/codeuser/otel-traces-debug.json
  - Include in traces pipeline exporters list
  - Purpose: Enable local trace debugging and troubleshooting
  - _Leverage: Existing debug file exporter pattern_
  - _Requirements: 5.4_

### Phase 3: Proxy and Health Monitoring (Parallel Execution)
These endpoint modifications are independent:

- [x] 3.1 Enhance trace proxy endpoint error handling
  - File: /app/server/index.js (modify /api/traces/v1/traces endpoint)
  - Add validation for OTEL collector availability before forwarding
  - Implement proper error responses for different failure scenarios
  - Add request logging for debugging trace flow
  - Purpose: Ensure reliable trace forwarding with clear error reporting
  - _Leverage: Existing proxy endpoint pattern_
  - _Requirements: 1.2, 3.1, 3.3_

- [x] 3.2 Add trace pipeline health checks
  - File: /app/server/index.js (modify /api/otel/status endpoint)
  - Add specific health check for trace pipeline export
  - Report trace export errors in status response
  - Include trace pipeline state in enabledPipelines object
  - Purpose: Provide visibility into trace pipeline health
  - _Leverage: Existing status endpoint structure_
  - _Requirements: 5.1, 5.2_

### Phase 4: Testing and Validation (Sequential Execution)
These tasks should run after Phases 1-3 are complete:

- [x] 4.1 Test trace flow end-to-end
  - File: /app/tests/otel-integration-tests.js
  - Add test for trace generation and export
  - Verify traces reach Mezmo pipeline endpoint
  - Test error scenarios (collector down, bad credentials)
  - Purpose: Ensure complete trace flow works correctly
  - _Leverage: Existing test framework and utilities_
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 4.2 Test backward compatibility with logs and metrics
  - File: Run existing log and metric tests
  - Start OTEL collector with all pipelines enabled
  - Verify logs continue to flow to Mezmo
  - Confirm metrics are still collected
  - Purpose: Ensure trace fix doesn't break existing functionality
  - _Leverage: Existing test suites_
  - _Requirements: 2.1, 2.2, 2.3_

### Phase 5: UI and Documentation (Parallel Execution)
These final tasks can run in parallel after testing:

- [x] 5.1 Update UI to show trace pipeline status
  - File: Verify UI correctly displays trace configuration
  - Test enabling/disabling traces through UI
  - Confirm configuration changes trigger collector restart
  - Verify trace status is visible in agent configuration page
  - Purpose: Ensure UI properly manages trace configuration
  - _Leverage: Existing UI configuration management_
  - _Requirements: 4.3, 4.4_

- [x] 5.2 Document trace configuration and troubleshooting
  - File: Update inline comments in affected files
  - Add troubleshooting notes to test files
  - Document the correct endpoint format for future reference
  - Purpose: Prevent future configuration issues
  - _Leverage: Existing documentation patterns_
  - _Requirements: 5.3, 5.4_

## Execution Strategy

**Parallel Execution Groups:**
1. **Phase 1 (Tasks 1.1, 1.2, 1.3)**: All configuration updates can happen simultaneously
2. **Phase 2 (Tasks 2.1, 2.2, 2.3)**: Backend fixes can be applied in parallel
3. **Phase 3 (Tasks 3.1, 3.2)**: Proxy and health monitoring updates are independent
4. **Phase 4 (Tasks 4.1, 4.2)**: Run sequentially after Phases 1-3 complete
5. **Phase 5 (Tasks 5.1, 5.2)**: Documentation and UI verification in parallel

This organization allows for maximum parallelization while respecting dependencies between tasks.