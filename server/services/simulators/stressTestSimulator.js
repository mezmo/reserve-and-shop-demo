import fetch from 'node-fetch';
import PerformanceLogger from '../virtualTraffic/performanceLogger.js';

/**
 * Stress Test Simulator - Server-Side Implementation
 * Generates load against API endpoints with detailed logging
 */
class StressTestSimulator {
  constructor() {
    this.performanceLogger = new PerformanceLogger();
    this.isRunning = false;
    this.sessionId = null;
    this.startTime = 0;
    this.stats = {
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      timeRemaining: 0
    };
    this.config = {
      duration: 30,        // seconds
      rps: 5,             // requests per second
      concurrent: 3,      // concurrent requests
      errorRate: 20       // percentage of requests that should error
    };
    this.intervalRef = null;
    this.requestCounts = { total: 0, success: 0, error: 0, responseTimes: [] };
    this.activeRequests = new Set();
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log(`🔧 Stress Test config updated: ${JSON.stringify(this.config)}`);
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Stress Test already running');
      return;
    }

    this.isRunning = true;
    this.sessionId = `stress-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.startTime = Date.now();
    this.requestCounts = { total: 0, success: 0, error: 0, responseTimes: [] };
    this.stats = {
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      timeRemaining: this.config.duration
    };

    console.log(`🚀 Stress Test started: ${this.config.duration}s at ${this.config.rps} RPS with ${this.config.concurrent} concurrent requests`);

    // Log test initiation
    this.performanceLogger.logDataOperation(
      'START',
      'stress_test',
      this.sessionId,
      {
        duration: this.config.duration,
        rps: this.config.rps,
        concurrent: this.config.concurrent,
        errorRate: this.config.errorRate
      },
      0
    );

    // Start the stress test loop
    const intervalMs = 1000 / this.config.rps; // Convert RPS to interval
    
    this.intervalRef = setInterval(() => {
      this.executeStressTestCycle();
    }, intervalMs);

    // Schedule test completion
    setTimeout(() => {
      this.stop();
    }, this.config.duration * 1000);
  }

  async executeStressTestCycle() {
    if (!this.isRunning) return;

    const elapsed = (Date.now() - this.startTime) / 1000;
    const progress = Math.min((elapsed / this.config.duration) * 100, 100);
    const timeRemaining = Math.max(this.config.duration - elapsed, 0);
    
    // Update real-time stats
    const avgResponseTime = this.requestCounts.responseTimes.length > 0
      ? this.requestCounts.responseTimes.reduce((a, b) => a + b, 0) / this.requestCounts.responseTimes.length
      : 0;
    
    this.stats = {
      totalRequests: this.requestCounts.total,
      successCount: this.requestCounts.success,
      errorCount: this.requestCounts.error,
      avgResponseTime: Math.round(avgResponseTime),
      timeRemaining: Math.round(timeRemaining)
    };
    
    if (elapsed >= this.config.duration) {
      this.stop();
      return;
    }
    
    // Make concurrent requests
    const promises = [];
    for (let i = 0; i < this.config.concurrent; i++) {
      const endpoint = this.getRandomEndpoint();
      promises.push(this.makeStressTestRequest(endpoint));
    }
    
    // Fire and forget - don't await to maintain rate
    Promise.allSettled(promises);
  }

  getRandomEndpoint() {
    const shouldError = Math.random() * 100 < this.config.errorRate;
    
    if (shouldError) {
      // Real endpoints that can naturally return errors
      const errorEndpoints = [
        { endpoint: 'products', id: '999999', expectedStatus: 404 },      // Non-existent product
        { endpoint: 'orders', id: 'invalid-id', expectedStatus: 404 },    // Invalid order ID
        { endpoint: 'reservations', id: 'fake-res', expectedStatus: 404 }, // Non-existent reservation
        { endpoint: 'products', method: 'PUT', body: { invalid: 'data' }, expectedStatus: 400 }, // Invalid update
        { endpoint: 'orders', method: 'POST', body: {}, expectedStatus: 400 }, // Missing required fields
        { endpoint: 'reservations', method: 'POST', body: { incomplete: 'data' }, expectedStatus: 400 } // Missing fields
      ];
      const randomError = errorEndpoints[Math.floor(Math.random() * errorEndpoints.length)];
      return { type: 'error', ...randomError };
    } else {
      // Only real endpoints that return successful responses
      const successEndpoints = [
        { endpoint: 'health', expectedStatus: 200 },           // GET /api/health
        { endpoint: 'products', expectedStatus: 200 },         // GET /api/products
        { endpoint: 'orders', expectedStatus: 200 },           // GET /api/orders
        { endpoint: 'reservations', expectedStatus: 200 },     // GET /api/reservations
        { endpoint: 'settings', expectedStatus: 200 }          // GET /api/settings
      ];
      const randomEndpoint = successEndpoints[Math.floor(Math.random() * successEndpoints.length)];
      return { type: 'success', ...randomEndpoint };
    }
  }

  async makeStressTestRequest(endpoint) {
    const startTime = Date.now();
    const requestId = `stress-req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    this.requestCounts.total++;
    this.activeRequests.add(requestId);
    
    try {
      let url = `http://localhost:3001/api/${endpoint.endpoint}`;
      let options = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Stress-Test': 'true',
          'X-Request-ID': requestId
        }
      };

      if (endpoint.type === 'error') {
        const { endpoint: ep, id, method, body } = endpoint;
        
        if (id) {
          // GET requests to non-existent resources
          url = `http://localhost:3001/api/${ep}/${id}`;
        } else if (method === 'POST') {
          // POST requests with invalid/incomplete data
          options.method = 'POST';
          options.body = JSON.stringify(body);
        } else if (method === 'PUT') {
          // PUT requests with invalid data
          url = `http://localhost:3001/api/${ep}/1`;
          options.method = 'PUT';
          options.body = JSON.stringify(body);
        }
      }

      const response = await fetch(url, options);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      this.requestCounts.responseTimes.push(duration);

      if (response.ok) {
        this.requestCounts.success++;
        
        // Log successful request
        this.performanceLogger.logDataOperation(
          'REQUEST',
          'api_endpoint',
          requestId,
          {
            endpoint: url,
            method: options.method,
            statusCode: response.status,
            responseTime: duration,
            success: true
          },
          duration
        );
        
        console.log(`✅ Stress Test: ${options.method} ${url} → ${response.status} (${duration}ms)`);
      } else {
        this.requestCounts.error++;
        
        // Use dedicated API error logging method for better error tracking
        this.performanceLogger.logApiError(
          requestId,
          url,
          options.method,
          response.status,
          `HTTP ${response.status}`,
          duration
        );
        
        // Also log as data operation for consistency
        this.performanceLogger.logDataOperation(
          'REQUEST',
          'api_endpoint',
          requestId,
          {
            endpoint: url,
            method: options.method,
            statusCode: response.status,
            responseTime: duration,
            success: false,
            error: `HTTP ${response.status}`
          },
          duration
        );
        
        console.log(`❌ Stress Test: ${options.method} ${url} → ${response.status} (${duration}ms)`);
      }

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      this.requestCounts.error++;
      this.requestCounts.responseTimes.push(duration);
      
      // Use dedicated system error logging method for network errors
      this.performanceLogger.logSystemError(
        'stress-test-simulator',
        'network_error',
        error.message,
        {
          endpoint: url,
          method: options.method,
          requestId,
          duration
        }
      );
      
      // Also log as data operation for consistency
      this.performanceLogger.logDataOperation(
        'REQUEST',
        'api_endpoint',
        requestId,
        {
          endpoint: url,
          method: options.method,
          responseTime: duration,
          success: false,
          error: error.message
        },
        duration
      );
      
      console.log(`🚫 Stress Test: ${options.method} ${url} → ERROR: ${error.message} (${duration}ms)`);
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  stop() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
    
    this.isRunning = false;
    
    const duration = (Date.now() - this.startTime) / 1000;
    const { total, success, error } = this.requestCounts;
    const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : '0';
    const avgResponseTime = this.requestCounts.responseTimes.length > 0
      ? this.requestCounts.responseTimes.reduce((a, b) => a + b, 0) / this.requestCounts.responseTimes.length
      : 0;
    
    // Log test completion
    this.performanceLogger.logDataOperation(
      'COMPLETE',
      'stress_test',
      this.sessionId,
      {
        duration: Math.round(duration),
        totalRequests: total,
        successCount: success,
        errorCount: error,
        successRate: parseFloat(successRate),
        avgResponseTime: Math.round(avgResponseTime),
        requestsPerSecond: total / duration
      },
      Math.round(duration * 1000)
    );
    
    console.log(`✅ Stress Test completed: ${total} requests in ${Math.round(duration)}s (${successRate}% success rate, ${Math.round(avgResponseTime)}ms avg)`);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      sessionId: this.sessionId,
      config: this.config,
      stats: this.stats,
      duration: this.isRunning ? (Date.now() - this.startTime) / 1000 : 0,
      activeRequests: this.activeRequests.size
    };
  }

  getDetailedStats() {
    const duration = this.isRunning ? (Date.now() - this.startTime) / 1000 : 0;
    const { total, success, error, responseTimes } = this.requestCounts;
    
    // Calculate percentiles
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const p50 = this.getPercentile(sortedTimes, 50);
    const p95 = this.getPercentile(sortedTimes, 95);
    const p99 = this.getPercentile(sortedTimes, 99);
    
    return {
      ...this.getStatus(),
      detailedStats: {
        requestsPerSecond: duration > 0 ? total / duration : 0,
        successRate: total > 0 ? (success / total) * 100 : 0,
        minResponseTime: Math.min(...responseTimes) || 0,
        maxResponseTime: Math.max(...responseTimes) || 0,
        p50ResponseTime: p50,
        p95ResponseTime: p95,
        p99ResponseTime: p99
      }
    };
  }

  getPercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }
}

export default StressTestSimulator;