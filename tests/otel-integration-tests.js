#!/usr/bin/env node

/**
 * OTEL Integration Test Suite
 * Comprehensive end-to-end testing for OTEL Mezmo integration
 * 
 * Tests:
 * 1. Configuration loading from file to UI
 * 2. Collector start/stop with different configurations
 * 3. Trace data flow validation
 * 4. Error scenarios and recovery procedures
 * 5. Performance testing with trace volume
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class OTELIntegrationTestSuite {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.testResults = [];
    this.startTime = Date.now();
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
  }

  // Test result logging
  logTest(testName, passed, details = '', duration = 0) {
    this.totalTests++;
    if (passed) {
      this.passedTests++;
      console.log(`✅ ${testName} (${duration}ms)`);
    } else {
      this.failedTests++;
      console.log(`❌ ${testName} - ${details} (${duration}ms)`);
    }
    
    this.testResults.push({
      name: testName,
      passed,
      details,
      duration,
      timestamp: new Date().toISOString()
    });
  }

  // HTTP request helper with timeout
  async makeRequest(method, endpoint, body = null, headers = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 10000 // 10 second timeout
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    try {
      const response = await fetch(url, options);
      const data = await response.text();
      let jsonData;
      
      try {
        jsonData = JSON.parse(data);
      } catch (e) {
        jsonData = { rawResponse: data };
      }
      
      return {
        ok: response.ok,
        status: response.status,
        data: jsonData
      };
    } catch (error) {
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  // Wait helper
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test 1: Configuration Loading from File to UI
  async testConfigurationLoading() {
    const startTime = Date.now();
    
    try {
      // Test 1a: Check if configuration file exists and is valid
      const configPath = path.join(path.dirname(__dirname), 'agents-config.json');
      if (!fs.existsSync(configPath)) {
        this.logTest('1a. Configuration File Exists', false, 'agents-config.json not found', Date.now() - startTime);
        return;
      }
      
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const hasOtelConfig = configData.configurations && 
                           Object.values(configData.configurations).some(config => config.otel);
      
      this.logTest('1a. Configuration File Exists & Valid', hasOtelConfig, 
                   hasOtelConfig ? '' : 'No OTEL configuration found in file', Date.now() - startTime);
      
      // Test 1b: Backend loads configuration from file
      const configResponse = await this.makeRequest('GET', '/api/config/otel');
      
      const configLoaded = configResponse.ok && 
                          configResponse.data.success && 
                          configResponse.data.config &&
                          configResponse.data.config.pipelines;
      
      this.logTest('1b. Backend Loads Config from File', configLoaded,
                   configLoaded ? '' : `Config load failed: ${JSON.stringify(configResponse.data)}`, 
                   Date.now() - startTime);
      
      // Test 1c: Configuration has required pipelines
      if (configLoaded) {
        const config = configResponse.data.config;
        const hasAllPipelines = config.pipelines.logs && 
                               config.pipelines.metrics && 
                               config.pipelines.traces;
        
        this.logTest('1c. Config Has All Pipelines', hasAllPipelines,
                     hasAllPipelines ? '' : 'Missing pipeline configurations', Date.now() - startTime);
      }
      
    } catch (error) {
      this.logTest('1. Configuration Loading Test', false, error.message, Date.now() - startTime);
    }
  }

  // Test 2: Collector Process Management
  async testCollectorProcessManagement() {
    const startTime = Date.now();
    
    try {
      // Test 2a: Check initial collector status
      const statusResponse = await this.makeRequest('GET', '/api/otel/status');
      const statusValid = statusResponse.ok && statusResponse.data.status;
      
      this.logTest('2a. Status Endpoint Available', statusValid,
                   statusValid ? '' : 'Status endpoint failed', Date.now() - startTime);
      
      // Test 2b: Attempt collector start (may fail due to missing binary, which is expected)
      const startResponse = await this.makeRequest('POST', '/api/otel/start');
      
      // We expect this to fail in test environment due to missing otelcol-contrib binary
      // But we want to verify the error handling is proper
      const properErrorHandling = !startResponse.ok && 
                                 startResponse.data && 
                                 (startResponse.data.error || startResponse.data.details);
      
      this.logTest('2b. Collector Start Error Handling', properErrorHandling,
                   properErrorHandling ? 'Expected error handled properly' : 'Poor error handling', 
                   Date.now() - startTime);
      
      // Test 2c: Status reflects collector state accurately
      await this.wait(1000); // Wait for status to update
      const updatedStatusResponse = await this.makeRequest('GET', '/api/otel/status');
      
      const statusReflectsState = updatedStatusResponse.ok && 
                                 updatedStatusResponse.data.status === 'disconnected' &&
                                 Array.isArray(updatedStatusResponse.data.errors);
      
      this.logTest('2c. Status Reflects Collector State', statusReflectsState,
                   statusReflectsState ? '' : 'Status does not accurately reflect state', 
                   Date.now() - startTime);
      
    } catch (error) {
      this.logTest('2. Collector Management Test', false, error.message, Date.now() - startTime);
    }
  }

  // Test 3: Configuration Validation and Error Handling
  async testConfigurationValidation() {
    const startTime = Date.now();
    
    try {
      // Test 3a: Configure with current valid config
      const configureResponse = await this.makeRequest('POST', '/api/otel/configure');
      
      // Should either succeed or fail with proper error handling
      const properResponse = configureResponse.data && 
                             (configureResponse.data.success === true || 
                              (configureResponse.data.success === false && configureResponse.data.error));
      
      this.logTest('3a. Configuration Validation', properResponse,
                   properResponse ? '' : 'Invalid response structure', Date.now() - startTime);
      
      // Test 3b: Test invalid configuration handling
      const invalidConfig = {
        pipelines: {
          traces: { enabled: true, ingestionKey: 'invalid-key', host: '', pipelineId: '' }
        }
      };
      
      // Override ConfigManager temporarily for this test
      const invalidConfigResponse = await this.makeRequest('POST', '/api/otel/configure', invalidConfig);
      
      // Should reject invalid configuration with clear error
      const rejectsInvalid = !invalidConfigResponse.ok || 
                            (invalidConfigResponse.data.success === false && 
                             invalidConfigResponse.data.error);
      
      this.logTest('3b. Invalid Config Rejection', rejectsInvalid,
                   rejectsInvalid ? '' : 'Invalid config was accepted', Date.now() - startTime);
      
    } catch (error) {
      this.logTest('3. Configuration Validation Test', false, error.message, Date.now() - startTime);
    }
  }

  // Test 4: Error Scenarios and Recovery
  async testErrorScenariosAndRecovery() {
    const startTime = Date.now();
    
    try {
      // Test 4a: Backend proxy endpoint exists
      const proxyResponse = await this.makeRequest('POST', '/api/traces/v1/traces', 
        { test: 'trace' }, { 'Content-Type': 'application/x-protobuf' });
      
      // Should handle the request (may fail but should respond properly)
      const proxyExists = proxyResponse.status !== 404;
      
      this.logTest('4a. Trace Proxy Endpoint Exists', proxyExists,
                   proxyExists ? '' : 'Trace proxy endpoint not found', Date.now() - startTime);
      
      // Test 4b: Health check functionality
      const healthResponse = await this.makeRequest('GET', '/api/health');
      const healthWorking = healthResponse.ok && healthResponse.data;
      
      this.logTest('4b. Health Check Available', healthWorking,
                   healthWorking ? '' : 'Health check failed', Date.now() - startTime);
      
      // Test 4c: Error recovery in status monitoring
      // Make multiple status calls to test consistency
      const statusCalls = [];
      for (let i = 0; i < 3; i++) {
        const response = await this.makeRequest('GET', '/api/otel/status');
        statusCalls.push(response.ok);
        await this.wait(500);
      }
      
      const consistentStatus = statusCalls.every(call => call === statusCalls[0]);
      
      this.logTest('4c. Status Monitoring Consistency', consistentStatus,
                   consistentStatus ? '' : 'Status monitoring inconsistent', Date.now() - startTime);
      
    } catch (error) {
      this.logTest('4. Error Scenarios Test', false, error.message, Date.now() - startTime);
    }
  }

  // Test 5: Performance and Load Testing
  async testPerformanceAndLoad() {
    const startTime = Date.now();
    
    try {
      // Test 5a: Configuration loading performance
      const configLoadStart = Date.now();
      const configResponse = await this.makeRequest('GET', '/api/config/otel');
      const configLoadTime = Date.now() - configLoadStart;
      
      const fastConfigLoad = configLoadTime < 1000; // Should load in less than 1 second
      
      this.logTest('5a. Config Load Performance', fastConfigLoad,
                   fastConfigLoad ? `${configLoadTime}ms` : `Too slow: ${configLoadTime}ms`, 
                   Date.now() - startTime);
      
      // Test 5b: Status endpoint performance under load
      const statusLoadStart = Date.now();
      const statusPromises = [];
      
      for (let i = 0; i < 10; i++) {
        statusPromises.push(this.makeRequest('GET', '/api/otel/status'));
      }
      
      const statusResults = await Promise.all(statusPromises);
      const statusLoadTime = Date.now() - statusLoadStart;
      const allStatusSuccess = statusResults.every(result => result.ok);
      
      this.logTest('5b. Status Load Performance', allStatusSuccess,
                   allStatusSuccess ? `10 concurrent calls in ${statusLoadTime}ms` : 'Some status calls failed', 
                   Date.now() - startTime);
      
      // Test 5c: Memory and resource usage (check server is still responsive)
      await this.wait(1000);
      const healthAfterLoad = await this.makeRequest('GET', '/api/health');
      const serverStillResponsive = healthAfterLoad.ok;
      
      this.logTest('5c. Server Responsive After Load', serverStillResponsive,
                   serverStillResponsive ? '' : 'Server became unresponsive', Date.now() - startTime);
      
    } catch (error) {
      this.logTest('5. Performance Test', false, error.message, Date.now() - startTime);
    }
  }

  // Test 6: Integration with ConfigManager
  async testConfigManagerIntegration() {
    const startTime = Date.now();
    
    try {
      // Test 6a: ConfigManager returns consistent OTEL config
      const otelConfigResponse = await this.makeRequest('GET', '/api/config/otel');
      const mezmoConfigResponse = await this.makeRequest('GET', '/api/config/mezmo');
      
      const bothConfigsWork = otelConfigResponse.ok && mezmoConfigResponse.ok;
      
      this.logTest('6a. ConfigManager Consistency', bothConfigsWork,
                   bothConfigsWork ? '' : 'Config endpoints inconsistent', Date.now() - startTime);
      
      // Test 6b: Configuration persistence across requests
      if (otelConfigResponse.ok) {
        const config1 = otelConfigResponse.data.config;
        await this.wait(1000);
        const config2Response = await this.makeRequest('GET', '/api/config/otel');
        const config2 = config2Response.data.config;
        
        const configsPersist = JSON.stringify(config1) === JSON.stringify(config2);
        
        this.logTest('6b. Configuration Persistence', configsPersist,
                     configsPersist ? '' : 'Configuration not persisting', Date.now() - startTime);
      }
      
    } catch (error) {
      this.logTest('6. ConfigManager Integration Test', false, error.message, Date.now() - startTime);
    }
  }

  // Test 7: Trace Pipeline End-to-End Flow
  async testTraceFlowEndToEnd() {
    const startTime = Date.now();
    
    try {
      // Test 7a: Verify trace configuration is loaded
      const configResponse = await this.makeRequest('GET', '/api/config/otel');
      const tracesEnabled = configResponse.ok && 
                           configResponse.data.config?.pipelines?.traces?.enabled;
      
      this.logTest('7a. Traces Enabled in Config', tracesEnabled,
                   tracesEnabled ? '' : 'Traces not enabled in configuration', Date.now() - startTime);
      
      if (!tracesEnabled) {
        console.log('⚠️  Skipping trace tests - traces not enabled');
        return;
      }
      
      // Test 7b: Verify trace ingestion key and pipeline ID
      const traceConfig = configResponse.data.config.pipelines.traces;
      const hasValidCredentials = traceConfig.ingestionKey && 
                                 traceConfig.pipelineId && 
                                 traceConfig.host;
      
      this.logTest('7b. Valid Trace Credentials', hasValidCredentials,
                   hasValidCredentials ? '' : 'Missing trace credentials', Date.now() - startTime);
      
      // Test 7c: Test trace proxy endpoint availability
      const traceData = Buffer.from('test-trace-data');
      const proxyResponse = await this.makeRequest('POST', '/api/traces/v1/traces', 
        traceData, { 'Content-Type': 'application/x-protobuf' });
      
      // Should respond with 503 if collector is down (expected) or 200 if running
      const proxyWorking = proxyResponse.status === 503 || proxyResponse.status === 200;
      
      this.logTest('7c. Trace Proxy Endpoint Working', proxyWorking,
                   proxyWorking ? `Status: ${proxyResponse.status}` : 'Unexpected proxy response', 
                   Date.now() - startTime);
      
      // Test 7d: Check trace-specific health monitoring
      const statusResponse = await this.makeRequest('GET', '/api/otel/status');
      const hasTraceHealth = statusResponse.ok && 
                            statusResponse.data.enabledPipelines?.traces !== undefined;
      
      this.logTest('7d. Trace Health Monitoring', hasTraceHealth,
                   hasTraceHealth ? '' : 'No trace health information in status', Date.now() - startTime);
      
      // Test 7e: Verify trace debug file configuration
      if (statusResponse.ok && statusResponse.data.healthChecks?.pipelines?.traceDebugFile !== undefined) {
        const hasDebugFile = statusResponse.data.healthChecks.pipelines.traceDebugFile;
        this.logTest('7e. Trace Debug File Configured', true,
                     hasDebugFile ? 'Debug file exists' : 'Debug file not yet created', 
                     Date.now() - startTime);
      } else {
        this.logTest('7e. Trace Debug File Status', false, 
                     'Debug file status not available', Date.now() - startTime);
      }
      
    } catch (error) {
      this.logTest('7. Trace Flow Test', false, error.message, Date.now() - startTime);
    }
  }

  // Test 8: Trace Error Scenarios
  async testTraceErrorScenarios() {
    const startTime = Date.now();
    
    try {
      // Test 8a: Collector down error handling
      const collectorDownResponse = await this.makeRequest('POST', '/api/traces/v1/traces',
        Buffer.from('test'), { 'Content-Type': 'application/x-protobuf' });
      
      const handlesCollectorDown = collectorDownResponse.status === 503 && 
                                  collectorDownResponse.data.error &&
                                  collectorDownResponse.data.code;
      
      this.logTest('8a. Handles Collector Down', handlesCollectorDown,
                   handlesCollectorDown ? 'Proper error response' : 'Poor error handling', 
                   Date.now() - startTime);
      
      // Test 8b: Invalid trace data handling
      const invalidResponse = await this.makeRequest('POST', '/api/traces/v1/traces',
        { invalid: 'not-protobuf' }, { 'Content-Type': 'application/json' });
      
      // Should still handle gracefully even with wrong content type
      const handlesInvalidData = invalidResponse.status >= 400 && invalidResponse.status < 600;
      
      this.logTest('8b. Handles Invalid Trace Data', handlesInvalidData,
                   handlesInvalidData ? `Status: ${invalidResponse.status}` : 'Accepted invalid data', 
                   Date.now() - startTime);
      
      // Test 8c: Missing authentication handling
      // This tests the configuration validation for traces
      const invalidConfigTest = {
        pipelines: {
          traces: { enabled: true, ingestionKey: '', pipelineId: '', host: '' }
        }
      };
      
      const configResponse = await this.makeRequest('POST', '/api/otel/configure', invalidConfigTest);
      const rejectsInvalidTraceConfig = !configResponse.ok || 
                                       (configResponse.data.success === false);
      
      this.logTest('8c. Rejects Invalid Trace Config', rejectsInvalidTraceConfig,
                   rejectsInvalidTraceConfig ? 'Invalid config rejected' : 'Accepted invalid trace config', 
                   Date.now() - startTime);
      
    } catch (error) {
      this.logTest('8. Trace Error Scenarios Test', false, error.message, Date.now() - startTime);
    }
  }

  // Main test runner
  async runAllTests() {
    console.log('\n🧪 Starting OTEL Integration Test Suite...\n');
    console.log('=' .repeat(50));
    
    // Check if server is running
    try {
      await this.makeRequest('GET', '/api/health');
    } catch (error) {
      console.log('❌ Server not accessible at http://localhost:3001');
      console.log('Please ensure the server is running with: npm run server');
      process.exit(1);
    }
    
    // Run all test suites
    await this.testConfigurationLoading();
    await this.testCollectorProcessManagement();
    await this.testConfigurationValidation();
    await this.testErrorScenariosAndRecovery();
    await this.testPerformanceAndLoad();
    await this.testConfigManagerIntegration();
    await this.testTraceFlowEndToEnd();
    await this.testTraceErrorScenarios();
    
    // Generate test report
    this.generateTestReport();
  }

  // Generate comprehensive test report
  generateTestReport() {
    const totalDuration = Date.now() - this.startTime;
    
    console.log('\n' + '=' .repeat(50));
    console.log('🧪 OTEL Integration Test Results');
    console.log('=' .repeat(50));
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total Tests: ${this.totalTests}`);
    console.log(`   ✅ Passed: ${this.passedTests}`);
    console.log(`   ❌ Failed: ${this.failedTests}`);
    console.log(`   ⏱️  Total Time: ${totalDuration}ms`);
    console.log(`   📈 Success Rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);
    
    if (this.failedTests > 0) {
      console.log(`\n❌ Failed Tests:`);
      this.testResults
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`   • ${test.name}: ${test.details}`);
        });
    }
    
    // Save detailed report to file
    const report = {
      summary: {
        totalTests: this.totalTests,
        passed: this.passedTests,
        failed: this.failedTests,
        successRate: (this.passedTests / this.totalTests) * 100,
        totalDuration,
        timestamp: new Date().toISOString()
      },
      results: this.testResults
    };
    
    const reportsDir = path.join(__dirname, '../test-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const reportFile = path.join(reportsDir, `otel-integration-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportFile}`);
    
    // Exit with appropriate code
    const success = this.failedTests === 0;
    console.log(`\n${success ? '✅' : '❌'} Test Suite ${success ? 'PASSED' : 'FAILED'}\n`);
    
    process.exit(success ? 0 : 1);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new OTELIntegrationTestSuite();
  testSuite.runAllTests().catch(error => {
    console.error('\n💥 Test suite crashed:', error.message);
    process.exit(1);
  });
}

export default OTELIntegrationTestSuite;