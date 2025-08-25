#!/usr/bin/env node

/**
 * OTEL Trace Performance Test
 * Tests the system's ability to handle high trace volumes
 * and validates trace data flow under load
 */

import fetch from 'node-fetch';
import { randomBytes } from 'crypto';

class OTELTracePerformanceTest {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.results = {
      totalTraces: 0,
      successfulTraces: 0,
      failedTraces: 0,
      averageResponseTime: 0,
      responseTimes: []
    };
  }

  // Generate mock trace data
  generateMockTrace() {
    const traceId = randomBytes(16).toString('hex');
    const spanId = randomBytes(8).toString('hex');
    
    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              {
                key: "service.name",
                value: { stringValue: "restaurant-app-test" }
              },
              {
                key: "service.version", 
                value: { stringValue: "1.0.0" }
              }
            ]
          },
          instrumentationLibrarySpans: [
            {
              instrumentationLibrary: {
                name: "test-tracer",
                version: "1.0.0"
              },
              spans: [
                {
                  traceId: traceId,
                  spanId: spanId,
                  name: "test-span",
                  kind: 1,
                  startTimeUnixNano: Date.now() * 1000000,
                  endTimeUnixNano: (Date.now() + 100) * 1000000,
                  attributes: [
                    {
                      key: "http.method",
                      value: { stringValue: "GET" }
                    },
                    {
                      key: "http.url",
                      value: { stringValue: "/api/test" }
                    }
                  ],
                  status: {
                    code: 1
                  }
                }
              ]
            }
          ]
        }
      ]
    };
  }

  // Send a single trace
  async sendTrace(traceData) {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/api/traces/v1/traces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-protobuf',
          'X-Test-Trace': 'true'
        },
        body: JSON.stringify(traceData),
        timeout: 5000
      });
      
      const responseTime = Date.now() - startTime;
      this.results.responseTimes.push(responseTime);
      
      if (response.ok || response.status === 503) { // 503 expected when collector unavailable
        this.results.successfulTraces++;
        return { success: true, responseTime, status: response.status };
      } else {
        this.results.failedTraces++;
        return { success: false, responseTime, status: response.status };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.results.responseTimes.push(responseTime);
      this.results.failedTraces++;
      return { success: false, responseTime, error: error.message };
    }
  }

  // Test burst load
  async testBurstLoad(numTraces = 50, concurrency = 10) {
    console.log(`\n⚡ Testing burst load: ${numTraces} traces with concurrency ${concurrency}`);
    
    const startTime = Date.now();
    const promises = [];
    
    for (let i = 0; i < numTraces; i++) {
      const traceData = this.generateMockTrace();
      promises.push(this.sendTrace(traceData));
      
      // Control concurrency
      if (promises.length >= concurrency) {
        const batch = await Promise.all(promises.splice(0, concurrency));
        this.results.totalTraces += batch.length;
      }
    }
    
    // Process remaining promises
    if (promises.length > 0) {
      const remaining = await Promise.all(promises);
      this.results.totalTraces += remaining.length;
    }
    
    const totalTime = Date.now() - startTime;
    const tracesPerSecond = (numTraces / totalTime) * 1000;
    
    console.log(`✅ Burst test completed in ${totalTime}ms`);
    console.log(`📊 Throughput: ${tracesPerSecond.toFixed(2)} traces/second`);
    
    return { totalTime, tracesPerSecond };
  }

  // Test sustained load
  async testSustainedLoad(durationSeconds = 10, tracesPerSecond = 5) {
    console.log(`\n🔄 Testing sustained load: ${tracesPerSecond} traces/second for ${durationSeconds} seconds`);
    
    const startTime = Date.now();
    const endTime = startTime + (durationSeconds * 1000);
    const intervalMs = 1000 / tracesPerSecond;
    
    let tracesSent = 0;
    
    while (Date.now() < endTime) {
      const traceData = this.generateMockTrace();
      const result = await this.sendTrace(traceData);
      
      tracesSent++;
      this.results.totalTraces++;
      
      // Wait for next interval
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    const actualDuration = Date.now() - startTime;
    const actualThroughput = (tracesSent / actualDuration) * 1000;
    
    console.log(`✅ Sustained test completed: ${tracesSent} traces in ${actualDuration}ms`);
    console.log(`📊 Actual throughput: ${actualThroughput.toFixed(2)} traces/second`);
    
    return { tracesSent, actualDuration, actualThroughput };
  }

  // Test server responsiveness under load
  async testServerResponsiveness() {
    console.log('\n🏃 Testing server responsiveness under trace load');
    
    // Start sending traces in background
    const tracePromises = [];
    for (let i = 0; i < 20; i++) {
      tracePromises.push(this.sendTrace(this.generateMockTrace()));
    }
    
    // Test other endpoints during trace load
    const testEndpoints = [
      '/api/health',
      '/api/config/otel',
      '/api/otel/status'
    ];
    
    const responseTimes = {};
    
    for (const endpoint of testEndpoints) {
      const startTime = Date.now();
      try {
        const response = await fetch(`${this.baseUrl}${endpoint}`, { timeout: 3000 });
        const responseTime = Date.now() - startTime;
        responseTimes[endpoint] = {
          success: response.ok,
          responseTime,
          status: response.status
        };
      } catch (error) {
        responseTimes[endpoint] = {
          success: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    }
    
    // Wait for trace promises to complete
    await Promise.all(tracePromises);
    
    // Analyze results
    const allEndpointsResponsive = Object.values(responseTimes).every(result => 
      result.success && result.responseTime < 2000
    );
    
    console.log('📊 Endpoint response times during trace load:');
    for (const [endpoint, result] of Object.entries(responseTimes)) {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${endpoint}: ${result.responseTime}ms`);
    }
    
    return allEndpointsResponsive;
  }

  // Calculate statistics
  calculateStatistics() {
    if (this.results.responseTimes.length === 0) return {};
    
    const times = this.results.responseTimes;
    const sum = times.reduce((a, b) => a + b, 0);
    const avg = sum / times.length;
    
    const sorted = [...times].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    
    // Calculate percentiles
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    return { avg, median, min, max, p95, p99 };
  }

  // Run all performance tests
  async runPerformanceTests() {
    console.log('🚀 OTEL Trace Performance Test Suite');
    console.log('====================================');
    
    // Check if server is running
    try {
      const healthResponse = await fetch(`${this.baseUrl}/api/health`, { timeout: 3000 });
      if (!healthResponse.ok) throw new Error('Health check failed');
      console.log('✅ Server is running and accessible');
    } catch (error) {
      console.log('❌ Server is not accessible');
      console.log('Please ensure the server is running with: npm run server');
      process.exit(1);
    }
    
    // Check trace endpoint availability
    try {
      const traceResponse = await fetch(`${this.baseUrl}/api/traces/v1/traces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-protobuf' },
        body: JSON.stringify({}),
        timeout: 3000
      });
      // Any response (including error) means endpoint exists
      console.log(`✅ Trace endpoint available (status: ${traceResponse.status})`);
    } catch (error) {
      console.log('❌ Trace endpoint not accessible');
    }
    
    console.log(''); // Spacing
    
    // Run performance tests
    const testResults = {};
    
    try {
      // Test 1: Burst load
      testResults.burstLoad = await this.testBurstLoad(30, 5);
      
      // Test 2: Sustained load
      testResults.sustainedLoad = await this.testSustainedLoad(5, 3);
      
      // Test 3: Server responsiveness
      testResults.responsiveness = await this.testServerResponsiveness();
      
    } catch (error) {
      console.log(`❌ Performance test failed: ${error.message}`);
    }
    
    // Calculate and display statistics
    const stats = this.calculateStatistics();
    
    console.log('\n====================================');
    console.log('📈 Performance Test Results');
    console.log('====================================');
    
    console.log(`\n📊 Trace Statistics:`);
    console.log(`   Total Traces Sent: ${this.results.totalTraces}`);
    console.log(`   ✅ Successful: ${this.results.successfulTraces}`);
    console.log(`   ❌ Failed: ${this.results.failedTraces}`);
    console.log(`   Success Rate: ${((this.results.successfulTraces / this.results.totalTraces) * 100).toFixed(1)}%`);
    
    if (stats.avg) {
      console.log(`\n⏱️  Response Time Statistics:`);
      console.log(`   Average: ${stats.avg.toFixed(2)}ms`);
      console.log(`   Median: ${stats.median}ms`);
      console.log(`   Min: ${stats.min}ms`);
      console.log(`   Max: ${stats.max}ms`);
      console.log(`   95th percentile: ${stats.p95}ms`);
      console.log(`   99th percentile: ${stats.p99}ms`);
    }
    
    // Performance assessment
    const performanceGood = stats.avg < 500 && // Average response under 500ms
                           stats.p95 < 1000 &&  // 95th percentile under 1s
                           (this.results.successfulTraces / this.results.totalTraces) > 0.8; // 80%+ success rate
    
    console.log(`\n${performanceGood ? '✅' : '⚠️ '} Overall Performance: ${performanceGood ? 'GOOD' : 'NEEDS ATTENTION'}`);
    
    if (!performanceGood) {
      console.log('\n⚠️  Performance Recommendations:');
      if (stats.avg >= 500) console.log('   • Average response time is high - check server resources');
      if (stats.p95 >= 1000) console.log('   • 95th percentile response time is high - investigate bottlenecks');
      if ((this.results.successfulTraces / this.results.totalTraces) <= 0.8) console.log('   • High failure rate - check error handling');
    }
    
    // Save detailed results
    const reportData = {
      timestamp: new Date().toISOString(),
      testResults,
      statistics: stats,
      traceResults: this.results,
      performance: performanceGood ? 'GOOD' : 'NEEDS_ATTENTION'
    };
    
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const reportsDir = path.join(path.dirname(__dirname), 'test-reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      const reportFile = path.join(reportsDir, `otel-performance-${Date.now()}.json`);
      fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
      console.log(`\n📄 Detailed report saved to: ${reportFile}`);
    } catch (error) {
      console.log('⚠️  Could not save detailed report');
    }
    
    return performanceGood;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new OTELTracePerformanceTest();
  tester.runPerformanceTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('💥 Performance test crashed:', error.message);
      process.exit(1);
    });
}

export default OTELTracePerformanceTest;