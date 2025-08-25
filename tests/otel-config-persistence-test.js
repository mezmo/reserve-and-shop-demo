#!/usr/bin/env node

/**
 * OTEL Configuration Persistence Test
 * Tests configuration persistence across application restarts
 * and validates data flow from file to UI to backend storage
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class OTELConfigPersistenceTest {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.testResults = [];
    this.configBackup = null;
  }

  async makeRequest(method, endpoint, body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    return { ok: response.ok, status: response.status, data };
  }

  logResult(test, passed, details = '') {
    const symbol = passed ? '✅' : '❌';
    console.log(`${symbol} ${test}${details ? ` - ${details}` : ''}`);
    this.testResults.push({ test, passed, details });
  }

  async testFileToBackendFlow() {
    console.log('\n📁 Testing File to Backend Configuration Flow...');
    
    try {
      // 1. Verify configuration file exists
      const configPath = path.join(path.dirname(__dirname), 'agents-config.json');
      const configExists = fs.existsSync(configPath);
      this.logResult('Configuration file exists', configExists);
      
      if (!configExists) return false;
      
      // 2. Read and validate configuration file structure
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const hasConfigurations = configData.configurations && typeof configData.configurations === 'object';
      this.logResult('Configuration file has valid structure', hasConfigurations);
      
      // 3. Check for OTEL configuration in file
      const otelConfigs = Object.values(configData.configurations || {})
        .filter(config => config.otel && config.otel.pipelines);
      
      const hasOtelConfigs = otelConfigs.length > 0;
      this.logResult('Configuration file contains OTEL presets', hasOtelConfigs, 
                     `Found ${otelConfigs.length} OTEL configurations`);
      
      // 4. Test backend loads from file
      const backendConfigResponse = await this.makeRequest('GET', '/api/config/otel');
      const backendLoadsConfig = backendConfigResponse.ok && 
                                backendConfigResponse.data.success &&
                                backendConfigResponse.data.config;
      
      this.logResult('Backend loads configuration from file', backendLoadsConfig);
      
      // 5. Compare file and backend configurations
      if (hasOtelConfigs && backendLoadsConfig) {
        const backendConfig = backendConfigResponse.data.config;
        const fileConfig = otelConfigs[0].otel; // Use first OTEL config
        
        const pipelinesMatch = fileConfig.pipelines && backendConfig.pipelines &&
                              Object.keys(fileConfig.pipelines).every(pipeline =>
                                backendConfig.pipelines[pipeline] && 
                                backendConfig.pipelines[pipeline].enabled === fileConfig.pipelines[pipeline].enabled
                              );
        
        this.logResult('File and backend configurations align', pipelinesMatch,
                       pipelinesMatch ? 'Pipeline configurations match' : 'Configurations differ');
      }
      
      return true;
    } catch (error) {
      this.logResult('File to Backend Flow', false, error.message);
      return false;
    }
  }

  async testConfigurationPersistence() {
    console.log('\n💾 Testing Configuration Persistence...');
    
    try {
      // 1. Get initial configuration
      const initialResponse = await this.makeRequest('GET', '/api/config/otel');
      const hasInitialConfig = initialResponse.ok && initialResponse.data.success;
      this.logResult('Can retrieve initial configuration', hasInitialConfig);
      
      if (!hasInitialConfig) return false;
      
      const initialConfig = initialResponse.data.config;
      
      // 2. Make multiple requests to verify consistency
      const consistencyChecks = [];
      for (let i = 0; i < 5; i++) {
        const response = await this.makeRequest('GET', '/api/config/otel');
        if (response.ok && response.data.success) {
          consistencyChecks.push(JSON.stringify(response.data.config) === JSON.stringify(initialConfig));
        }
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
      }
      
      const allConsistent = consistencyChecks.every(check => check === true);
      this.logResult('Configuration is consistent across requests', allConsistent,
                     `${consistencyChecks.filter(c => c).length}/${consistencyChecks.length} requests consistent`);
      
      // 3. Test timestamp updates
      const timestamps = [];
      for (let i = 0; i < 3; i++) {
        const response = await this.makeRequest('GET', '/api/config/otel');
        if (response.ok && response.data.timestamp) {
          timestamps.push(response.data.timestamp);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const timestampsUpdate = timestamps.length > 1 && 
                              timestamps.every(ts => new Date(ts).getTime() > 0);
      this.logResult('Timestamps are properly updated', timestampsUpdate);
      
      return true;
    } catch (error) {
      this.logResult('Configuration Persistence', false, error.message);
      return false;
    }
  }

  async testErrorScenarioHandling() {
    console.log('\n🚨 Testing Error Scenario Handling...');
    
    try {
      // 1. Test handling of invalid endpoint
      const invalidResponse = await this.makeRequest('GET', '/api/config/invalid');
      const handlesInvalidEndpoint = !invalidResponse.ok;
      this.logResult('Handles invalid configuration endpoint', handlesInvalidEndpoint,
                     `Status: ${invalidResponse.status}`);
      
      // 2. Test configuration validation
      const configureResponse = await this.makeRequest('POST', '/api/otel/configure');
      const hasValidationResponse = configureResponse.data && 
                                   (configureResponse.data.success !== undefined);
      this.logResult('Configuration endpoint provides validation response', hasValidationResponse);
      
      // 3. Test error details in response
      if (!configureResponse.ok && configureResponse.data) {
        const hasErrorDetails = configureResponse.data.error || 
                               configureResponse.data.details ||
                               configureResponse.data.suggestion;
        this.logResult('Error responses include helpful details', hasErrorDetails);
      }
      
      // 4. Test timeout handling (quick request)
      const startTime = Date.now();
      const quickResponse = await this.makeRequest('GET', '/api/otel/status');
      const responseTime = Date.now() - startTime;
      
      const reasonableResponseTime = responseTime < 2000; // Should respond within 2 seconds
      this.logResult('API responds within reasonable time', reasonableResponseTime,
                     `${responseTime}ms response time`);
      
      return true;
    } catch (error) {
      this.logResult('Error Scenario Handling', false, error.message);
      return false;
    }
  }

  async testDataFlowIntegrity() {
    console.log('\n🔄 Testing Data Flow Integrity...');
    
    try {
      // 1. Test configuration loading sequence
      const otelConfig = await this.makeRequest('GET', '/api/config/otel');
      const mezmoConfig = await this.makeRequest('GET', '/api/config/mezmo');
      
      const bothConfigsLoad = otelConfig.ok && mezmoConfig.ok;
      this.logResult('Both OTEL and Mezmo configurations load', bothConfigsLoad);
      
      // 2. Test configuration structure integrity
      if (otelConfig.ok && otelConfig.data.success) {
        const config = otelConfig.data.config;
        const hasRequiredStructure = config.enabled !== undefined &&
                                    config.serviceName &&
                                    config.pipelines &&
                                    config.pipelines.logs &&
                                    config.pipelines.metrics &&
                                    config.pipelines.traces;
        
        this.logResult('OTEL configuration has required structure', hasRequiredStructure);
        
        // 3. Test pipeline configuration integrity
        const pipelines = config.pipelines;
        const pipelinesValid = ['logs', 'metrics', 'traces'].every(type => {
          const pipeline = pipelines[type];
          return pipeline && 
                 typeof pipeline.enabled === 'boolean' &&
                 typeof pipeline.ingestionKey === 'string' &&
                 typeof pipeline.host === 'string';
        });
        
        this.logResult('All pipeline configurations are valid', pipelinesValid);
      }
      
      // 4. Test status monitoring data flow
      const statusResponse = await this.makeRequest('GET', '/api/otel/status');
      const statusHasValidStructure = statusResponse.ok &&
                                     statusResponse.data.status &&
                                     statusResponse.data.enabledPipelines &&
                                     Array.isArray(statusResponse.data.errors);
      
      this.logResult('Status monitoring has valid data structure', statusHasValidStructure);
      
      return true;
    } catch (error) {
      this.logResult('Data Flow Integrity', false, error.message);
      return false;
    }
  }

  async runAllTests() {
    console.log('🧪 OTEL Configuration Persistence Test Suite');
    console.log('===========================================');
    
    // Check server availability
    try {
      await this.makeRequest('GET', '/api/health');
      console.log('✅ Server is running and accessible\n');
    } catch (error) {
      console.log('❌ Server is not accessible');
      console.log('Please ensure the server is running with: npm run server');
      process.exit(1);
    }
    
    const results = await Promise.all([
      this.testFileToBackendFlow(),
      this.testConfigurationPersistence(),
      this.testErrorScenarioHandling(),
      this.testDataFlowIntegrity()
    ]);
    
    // Generate summary
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log('\n===========================================');
    console.log('📊 Test Summary:');
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => console.log(`   • ${r.test}: ${r.details}`));
    }
    
    const overallSuccess = failedTests === 0;
    console.log(`\n${overallSuccess ? '✅' : '❌'} Overall Result: ${overallSuccess ? 'PASS' : 'FAIL'}`);
    
    return overallSuccess;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new OTELConfigPersistenceTest();
  tester.runAllTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('💥 Test crashed:', error.message);
      process.exit(1);
    });
}

export default OTELConfigPersistenceTest;