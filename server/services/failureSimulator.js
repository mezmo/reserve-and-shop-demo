import { appLogger, serverLogger, errorLogger, metricsLogger, eventLogger, performanceLogger } from '../logging/winston-config.js';
import { logBusinessEvent, logPerformanceTiming } from '../middleware/logging-middleware.js';

// Global failure state
const failureState = {
  active: false,
  scenario: null,
  startTime: null,
  duration: 0,
  autoStopTimer: null,
  // Specific failure flags
  dbPoolExhausted: false,
  paymentGatewayDown: false,
  memoryLeaking: false,
  cascadingFailure: false,
  dataCorrupted: false,
  // Memory leak specific
  memoryLeakArrays: [],
  memoryLeakInterval: null,
  // Cascading failure specific
  cascadeStage: 0,
  cascadeInterval: null,
  // Connection pool simulation
  activeConnections: 0,
  maxConnections: 3,
  connectionQueue: []
};

// Export state for global access
export const getFailureState = () => failureState;

// Check if a specific failure is active
export const isFailureActive = (type) => {
  switch(type) {
    case 'db_pool': return failureState.dbPoolExhausted;
    case 'payment': return failureState.paymentGatewayDown;
    case 'memory': return failureState.memoryLeaking;
    case 'cascade': return failureState.cascadingFailure;
    case 'data': return failureState.dataCorrupted;
    default: return failureState.active;
  }
};

// Database Connection Pool Exhaustion
export const startConnectionPoolExhaustion = (duration = 60) => {
  appLogger.warn('Starting database connection pool exhaustion simulation', {
    duration,
    maxConnections: failureState.maxConnections,
    scenario: 'connection_pool_exhaustion'
  });

  failureState.dbPoolExhausted = true;
  global.dbPoolExhausted = true; // Also set global flag
  failureState.activeConnections = failureState.maxConnections; // Immediately exhaust pool
  
  // Log initial pool exhaustion
  errorLogger.error('Database connection pool exhausted', {
    poolSize: failureState.maxConnections,
    activeConnections: failureState.activeConnections,
    queueLength: 0,
    errorCode: 'POOL_EXHAUSTED',
    severity: 'high'
  });

  // Simulate growing queue
  const queueInterval = setInterval(() => {
    if (!failureState.dbPoolExhausted) {
      clearInterval(queueInterval);
      return;
    }
    
    failureState.connectionQueue.push({
      timestamp: Date.now(),
      waiting: true
    });
    
    metricsLogger.warn('Database pool metrics', {
      metricName: 'db_pool_queue_size',
      value: failureState.connectionQueue.length,
      unit: 'connections',
      poolUtilization: 100,
      activeConnections: failureState.activeConnections,
      maxConnections: failureState.maxConnections
    });
    
    // Log critical state if queue is too long
    if (failureState.connectionQueue.length > 10) {
      errorLogger.error('Critical: Database connection queue overflow', {
        queueSize: failureState.connectionQueue.length,
        waitTime: Date.now() - failureState.connectionQueue[0].timestamp,
        errorCode: 'QUEUE_OVERFLOW',
        severity: 'critical'
      });
    }
  }, 2000);

  // Store interval for cleanup
  failureState.connectionQueueInterval = queueInterval;
};

// Payment Gateway Failure
export const startPaymentGatewayFailure = (duration = 45) => {
  appLogger.warn('Starting payment gateway failure simulation', {
    duration,
    gateway: 'stripe',
    scenario: 'payment_gateway_failure'
  });

  failureState.paymentGatewayDown = true;
  global.paymentGatewayDown = true; // Also set global flag
  
  // Log gateway down event
  errorLogger.error('Payment gateway connection failed', {
    gateway: 'stripe',
    endpoint: 'https://api.stripe.com/v1/charges',
    error: 'ECONNREFUSED',
    errorCode: 'GATEWAY_UNREACHABLE',
    severity: 'high'
  });

  // Simulate periodic retry attempts
  const retryInterval = setInterval(() => {
    if (!failureState.paymentGatewayDown) {
      clearInterval(retryInterval);
      return;
    }
    
    errorLogger.warn('Payment gateway retry attempt failed', {
      gateway: 'stripe',
      retryCount: Math.floor((Date.now() - failureState.startTime) / 5000),
      lastError: 'Connection timeout',
      nextRetry: 5000
    });
    
    metricsLogger.error('Payment failures metric', {
      metricName: 'payment_gateway_failures',
      value: 1,
      unit: 'count',
      gateway: 'stripe',
      errorType: 'connection_timeout'
    });
  }, 5000);

  failureState.paymentRetryInterval = retryInterval;
};

// Memory Leak Simulation
export const startMemoryLeak = (duration = 120) => {
  appLogger.warn('Starting memory leak simulation', {
    duration,
    scenario: 'memory_leak'
  });

  failureState.memoryLeaking = true;
  global.memoryLeaking = true; // Also set global flag
  failureState.memoryLeakArrays = [];
  
  // Aggressive memory consumption
  failureState.memoryLeakInterval = setInterval(() => {
    if (!failureState.memoryLeaking) {
      clearInterval(failureState.memoryLeakInterval);
      return;
    }
    
    // Allocate 10MB of memory each second
    const leak = new Array(1250000).fill(Math.random().toString());
    failureState.memoryLeakArrays.push(leak);
    
    const memUsage = process.memoryUsage();
    const heapPercentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    
    // Log memory metrics
    metricsLogger.warn('Memory usage increasing', {
      metricName: 'memory_heap_used',
      value: memUsage.heapUsed,
      unit: 'bytes',
      heapTotal: memUsage.heapTotal,
      heapPercentage,
      rss: memUsage.rss,
      external: memUsage.external,
      leakArrayCount: failureState.memoryLeakArrays.length,
      estimatedLeakSize: failureState.memoryLeakArrays.length * 10 * 1024 * 1024 // Approximate
    });
    
    // Log warnings at different thresholds
    if (heapPercentage > 60 && heapPercentage <= 80) {
      appLogger.warn('Memory usage high', {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        percentage: heapPercentage,
        threshold: 'warning'
      });
    } else if (heapPercentage > 80 && heapPercentage <= 90) {
      errorLogger.error('Critical memory pressure', {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        percentage: heapPercentage,
        threshold: 'critical',
        severity: 'high'
      });
      
      // Set global flag for request delays
      global.memoryPressureDelay = 1000;
    } else if (heapPercentage > 90) {
      errorLogger.error('CRITICAL: Out of memory imminent', {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        percentage: heapPercentage,
        threshold: 'fatal',
        severity: 'critical'
      });
      
      // Severe performance impact
      global.memoryPressureDelay = 3000;
    }
    
    // Simulate GC pressure
    if (failureState.memoryLeakArrays.length % 10 === 0) {
      performanceLogger.warn('Garbage collection pressure detected', {
        metric: 'gc_pause_time',
        value: 150 + (failureState.memoryLeakArrays.length * 10),
        unit: 'milliseconds',
        gcType: 'major',
        heapPercentage
      });
    }
  }, 1000);
};

// Cascading Service Failure
export const startCascadingFailure = (duration = 30) => {
  appLogger.warn('Starting cascading service failure simulation', {
    duration,
    scenario: 'cascading_failure'
  });

  failureState.cascadingFailure = true;
  global.cascadingFailure = true; // Also set global flag
  failureState.cascadeStage = 0;
  
  // Progressive failure stages
  failureState.cascadeInterval = setInterval(() => {
    if (!failureState.cascadingFailure) {
      clearInterval(failureState.cascadeInterval);
      return;
    }
    
    failureState.cascadeStage++;
    
    switch(failureState.cascadeStage) {
      case 1:
        // Stage 1: Product service starts degrading
        global.productServiceDegraded = true;
        appLogger.warn('Product service degradation detected', {
          service: 'products',
          responseTime: 5000,
          errorRate: 0.3,
          cascadeStage: 1,
          status: 'degraded'
        });
        
        metricsLogger.warn('Service degradation metrics', {
          metricName: 'service_response_time',
          value: 5000,
          unit: 'milliseconds',
          service: 'products',
          status: 'degraded'
        });
        break;
        
      case 2:
        // Stage 2: Product service fails
        global.productServiceDown = true;
        errorLogger.error('Product service failure', {
          service: 'products',
          status: 'DOWN',
          cascadeStage: 2,
          errorCode: 'SERVICE_UNAVAILABLE',
          severity: 'high',
          lastHealthCheck: new Date().toISOString()
        });
        
        logBusinessEvent('service_failure', 'error', {
          service: 'products',
          impact: 'menu_unavailable',
          cascadeStage: 2
        });
        break;
        
      case 3:
        // Stage 3: Order service fails (depends on products)
        global.orderServiceDown = true;
        errorLogger.error('Order service failure - cascade from product service', {
          service: 'orders',
          dependency: 'products',
          cascadeStage: 3,
          rootCause: 'product_service_failure',
          errorCode: 'CASCADE_FAILURE',
          severity: 'high'
        });
        
        logBusinessEvent('service_failure', 'error', {
          service: 'orders',
          impact: 'checkout_unavailable',
          cascadeStage: 3,
          rootCause: 'products'
        });
        break;
        
      case 4:
        // Stage 4: Reservation service fails (cascade continues)
        global.reservationServiceDown = true;
        errorLogger.error('Reservation service failure - cascade effect', {
          service: 'reservations',
          cascadeStage: 4,
          affectedServices: ['products', 'orders', 'reservations'],
          errorCode: 'CASCADE_FAILURE',
          severity: 'critical'
        });
        break;
        
      case 5:
        // Stage 5: Complete system failure
        global.systemFailure = true;
        errorLogger.error('CRITICAL: Complete system failure', {
          services: ['products', 'orders', 'reservations', 'health'],
          cascadeStage: 5,
          severity: 'critical',
          errorCode: 'SYSTEM_FAILURE',
          alert: 'immediate_action_required'
        });
        
        serverLogger.error('System-wide outage detected', {
          startTime: failureState.startTime,
          duration: Date.now() - failureState.startTime,
          affectedEndpoints: ['/api/products', '/api/orders', '/api/reservations'],
          status: 'CRITICAL'
        });
        break;
    }
    
    // Stop progressing after stage 5
    if (failureState.cascadeStage >= 5) {
      clearInterval(failureState.cascadeInterval);
    }
  }, 5000); // Progress every 5 seconds
};

// Data Corruption Simulation
export const startDataCorruption = (duration = 90, data) => {
  appLogger.warn('Starting data corruption simulation', {
    duration,
    scenario: 'data_corruption'
  });

  failureState.dataCorrupted = true;
  global.dataCorrupted = true; // Also set global flag
  
  // Corrupt product data
  if (data.products && data.products.length > 2) {
    const originalPrices = {};
    
    // Save original prices for restoration
    data.products.forEach(p => {
      originalPrices[p.id] = p.price;
    });
    
    // Store for restoration
    failureState.originalProductPrices = originalPrices;
    
    // Corrupt data
    data.products[0].price = -99.99;
    data.products[1].price = "CORRUPTED";
    data.products[2].price = null;
    
    errorLogger.error('Data corruption detected in products table', {
      corruptedFields: ['price'],
      affectedIds: [data.products[0].id, data.products[1].id, data.products[2].id],
      corruptionType: 'invalid_values',
      details: {
        negative_price: data.products[0].id,
        string_price: data.products[1].id,
        null_price: data.products[2].id
      },
      severity: 'high'
    });
    
    // Also corrupt some product names
    if (data.products.length > 3) {
      data.products[3].name = null;
      data.products[3].description = "🚫 ERROR: Buffer overflow at 0x" + Math.random().toString(16).substr(2, 8);
      
      errorLogger.error('Additional data corruption in product metadata', {
        productId: data.products[3].id,
        corruptedFields: ['name', 'description'],
        errorPattern: 'buffer_overflow_simulation'
      });
    }
  }
  
  // Corrupt order data
  if (data.orders && data.orders.length > 0) {
    const corruptedOrders = [];
    
    data.orders.forEach((order, index) => {
      if (index % 3 === 0) {
        // Save original for restoration
        if (!failureState.originalOrders) {
          failureState.originalOrders = {};
        }
        failureState.originalOrders[order.id] = {
          total: order.total,
          items: order.items
        };
        
        // Corrupt the order
        order.total = NaN;
        order.items = null;
        corruptedOrders.push(order.id);
        
        errorLogger.error('Order data integrity violation', {
          orderId: order.id,
          violations: ['total_is_NaN', 'items_is_null'],
          customerId: order.customerEmail || 'unknown',
          originalTotal: failureState.originalOrders[order.id].total,
          severity: 'high'
        });
      }
    });
    
    if (corruptedOrders.length > 0) {
      appLogger.error('Batch data corruption detected in orders', {
        affectedOrderCount: corruptedOrders.length,
        orderIds: corruptedOrders,
        corruptionType: 'data_integrity_violation'
      });
    }
  }
  
  // Log overall corruption event
  logBusinessEvent('data_corruption', 'error', {
    affectedTables: ['products', 'orders'],
    corruptionLevel: 'severe',
    estimatedImpact: 'high'
  });
};

// Start a failure scenario
export const startFailure = (scenario, duration, data) => {
  if (failureState.active) {
    return {
      success: false,
      error: 'A failure simulation is already active',
      currentScenario: failureState.scenario
    };
  }
  
  // Initialize failure state
  failureState.active = true;
  failureState.scenario = scenario;
  failureState.startTime = Date.now();
  failureState.duration = duration * 1000; // Convert to ms
  
  // Log failure start
  serverLogger.warn('System failure simulation started', {
    scenario,
    duration,
    startTime: new Date(failureState.startTime).toISOString(),
    expectedEndTime: new Date(failureState.startTime + failureState.duration).toISOString()
  });
  
  // Start specific failure scenario
  switch(scenario) {
    case 'connection_pool':
      startConnectionPoolExhaustion(duration);
      break;
    case 'payment_gateway':
      startPaymentGatewayFailure(duration);
      break;
    case 'memory_leak':
      startMemoryLeak(duration);
      break;
    case 'cascading_failure':
      startCascadingFailure(duration);
      break;
    case 'data_corruption':
      startDataCorruption(duration, data);
      break;
    default:
      failureState.active = false;
      return {
        success: false,
        error: 'Unknown failure scenario'
      };
  }
  
  // Set auto-stop timer
  failureState.autoStopTimer = setTimeout(() => {
    stopFailure(data);
    appLogger.info('Failure simulation auto-stopped after duration', {
      scenario,
      duration,
      runTime: Date.now() - failureState.startTime
    });
  }, failureState.duration);
  
  return {
    success: true,
    scenario,
    startTime: failureState.startTime,
    duration: failureState.duration,
    expectedEndTime: failureState.startTime + failureState.duration
  };
};

// Stop all failure simulations
export const stopFailure = (data) => {
  if (!failureState.active) {
    return {
      success: false,
      error: 'No failure simulation is active'
    };
  }
  
  const scenario = failureState.scenario;
  const runTime = Date.now() - failureState.startTime;
  
  // Clear timers
  if (failureState.autoStopTimer) {
    clearTimeout(failureState.autoStopTimer);
  }
  if (failureState.memoryLeakInterval) {
    clearInterval(failureState.memoryLeakInterval);
  }
  if (failureState.cascadeInterval) {
    clearInterval(failureState.cascadeInterval);
  }
  if (failureState.connectionQueueInterval) {
    clearInterval(failureState.connectionQueueInterval);
  }
  if (failureState.paymentRetryInterval) {
    clearInterval(failureState.paymentRetryInterval);
  }
  
  // Clear global flags
  global.dbPoolExhausted = false;
  global.paymentGatewayDown = false;
  global.memoryLeaking = false;
  global.cascadingFailure = false;
  global.dataCorrupted = false;
  global.memoryPressureDelay = 0;
  global.productServiceDegraded = false;
  global.productServiceDown = false;
  global.orderServiceDown = false;
  global.reservationServiceDown = false;
  global.systemFailure = false;
  
  // Restore corrupted data
  if (failureState.dataCorrupted && data) {
    // Restore product prices
    if (failureState.originalProductPrices && data.products) {
      Object.keys(failureState.originalProductPrices).forEach(productId => {
        const product = data.products.find(p => p.id === productId);
        if (product) {
          product.price = failureState.originalProductPrices[productId];
        }
      });
      appLogger.info('Product data restored after corruption simulation', {
        restoredCount: Object.keys(failureState.originalProductPrices).length
      });
    }
    
    // Restore order data
    if (failureState.originalOrders && data.orders) {
      Object.keys(failureState.originalOrders).forEach(orderId => {
        const order = data.orders.find(o => o.id === orderId);
        if (order) {
          order.total = failureState.originalOrders[orderId].total;
          order.items = failureState.originalOrders[orderId].items;
        }
      });
      appLogger.info('Order data restored after corruption simulation', {
        restoredCount: Object.keys(failureState.originalOrders).length
      });
    }
  }
  
  // Clear memory leak arrays
  if (failureState.memoryLeakArrays.length > 0) {
    const leakSize = failureState.memoryLeakArrays.length;
    failureState.memoryLeakArrays = [];
    global.gc && global.gc(); // Force garbage collection if available
    appLogger.info('Memory leak arrays cleared', {
      arraysCleared: leakSize,
      estimatedMemoryFreed: leakSize * 10 * 1024 * 1024
    });
  }
  
  // Reset all failure state
  failureState.active = false;
  failureState.scenario = null;
  failureState.startTime = null;
  failureState.duration = 0;
  failureState.dbPoolExhausted = false;
  failureState.paymentGatewayDown = false;
  failureState.memoryLeaking = false;
  failureState.cascadingFailure = false;
  failureState.dataCorrupted = false;
  failureState.cascadeStage = 0;
  failureState.activeConnections = 0;
  failureState.connectionQueue = [];
  failureState.originalProductPrices = null;
  failureState.originalOrders = null;
  
  // Log failure stop
  serverLogger.info('System failure simulation stopped', {
    scenario,
    runTime,
    manualStop: runTime < failureState.duration
  });
  
  return {
    success: true,
    scenario,
    runTime,
    stopped: new Date().toISOString()
  };
};

// Get current failure status
export const getFailureStatus = () => {
  if (!failureState.active) {
    return {
      active: false,
      scenario: null
    };
  }
  
  const elapsed = Date.now() - failureState.startTime;
  const remaining = Math.max(0, failureState.duration - elapsed);
  
  return {
    active: true,
    scenario: failureState.scenario,
    startTime: failureState.startTime,
    elapsed,
    remaining,
    duration: failureState.duration,
    progress: Math.min(100, Math.round((elapsed / failureState.duration) * 100)),
    details: {
      dbPoolExhausted: failureState.dbPoolExhausted,
      paymentGatewayDown: failureState.paymentGatewayDown,
      memoryLeaking: failureState.memoryLeaking,
      cascadingFailure: failureState.cascadingFailure,
      cascadeStage: failureState.cascadeStage,
      dataCorrupted: failureState.dataCorrupted,
      connectionQueueLength: failureState.connectionQueue.length,
      memoryLeakArrays: failureState.memoryLeakArrays.length
    }
  };
};