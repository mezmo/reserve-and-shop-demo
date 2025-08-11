# Telemetry Troubleshooting Playbook

## Overview

This comprehensive playbook provides step-by-step solutions for 30+ telemetry problems commonly encountered in the restaurant application, with detection patterns, root cause analysis, and resolution procedures.

## Table of Contents

1. [Database & Connection Issues](#database--connection-issues)
2. [Payment & Financial Processing](#payment--financial-processing)
3. [Performance & Memory Problems](#performance--memory-problems)
4. [Service Reliability Issues](#service-reliability-issues)
5. [User Experience Problems](#user-experience-problems)
6. [Integration & API Issues](#integration--api-issues)
7. [Logging & Telemetry Problems](#logging--telemetry-problems)
8. [Security & Authentication Issues](#security--authentication-issues)

## Database & Connection Issues

### 1. Database Connection Pool Exhaustion

**Detection Pattern**:
```json
{
  "level": "ERROR",
  "message": "Database connection pool exhausted",
  "poolSize": 3,
  "activeConnections": 3,
  "queueLength": 15,
  "errorCode": "POOL_EXHAUSTED"
}
```

**Symptoms**:
- API responses timing out (>5 seconds)
- Queue length continuously growing
- New connections failing immediately

**Root Cause Analysis**:
1. Check active connection count vs pool size
2. Identify long-running transactions
3. Verify connection cleanup in application code
4. Monitor for connection leaks

**Immediate Actions**:
```bash
# Check current pool status
curl http://localhost:3001/api/simulate/status | jq '.details.connectionQueueLength'

# Stop failure simulation if active
curl -X POST http://localhost:3001/api/simulate/stop

# Restart application to reset pool
docker restart restaurant-app
```

**Long-term Solutions**:
1. **Increase Pool Size**:
   ```javascript
   const dbConfig = {
     max: 10,        // Increase from 3 to 10
     min: 2,         // Keep minimum connections
     acquireTimeoutMillis: 30000,
     createTimeoutMillis: 3000,
     destroyTimeoutMillis: 5000
   };
   ```

2. **Implement Connection Monitoring**:
   ```javascript
   setInterval(() => {
     const stats = pool.getPoolStatistics();
     if (stats.usedConnections / stats.totalConnections > 0.8) {
       logger.warn('High connection pool usage', stats);
     }
   }, 10000);
   ```

3. **Add Circuit Breaker**:
   ```javascript
   const CircuitBreaker = require('opossum');
   const dbBreaker = new CircuitBreaker(dbQuery, {
     timeout: 3000,
     errorThresholdPercentage: 50,
     resetTimeout: 30000
   });
   ```

**Monitoring Setup**:
```yaml
# Grafana alert
- alert: DatabasePoolExhaustion
  expr: db_pool_utilization > 0.9
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Database connection pool near exhaustion"
```

### 2. Slow Database Queries

**Detection Pattern**:
```json
{
  "level": "WARN",
  "message": "Slow query detected",
  "query": "SELECT * FROM orders WHERE customer_email = ?",
  "duration": 5432,
  "threshold": 1000
}
```

**Symptoms**:
- API response times >1 second
- Database CPU usage >80%
- Query queue building up

**Root Cause Analysis**:
1. **Missing Indexes**:
   ```sql
   EXPLAIN SELECT * FROM orders WHERE customer_email = 'test@example.com';
   -- Look for "Seq Scan" indicating missing index
   ```

2. **Query Analysis**:
   ```sql
   -- Check slow query log
   SELECT query, mean_time, calls 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC LIMIT 10;
   ```

**Solutions**:
1. **Add Database Indexes**:
   ```sql
   CREATE INDEX idx_orders_customer_email ON orders(customer_email);
   CREATE INDEX idx_orders_created_at ON orders(created_at);
   CREATE INDEX idx_products_category ON products(category);
   ```

2. **Query Optimization**:
   ```javascript
   // Before: N+1 query problem
   const orders = await Order.findAll();
   for (const order of orders) {
     order.customer = await Customer.findById(order.customerId);
   }

   // After: Single query with JOIN
   const orders = await Order.findAll({
     include: [Customer]
   });
   ```

3. **Implement Query Caching**:
   ```javascript
   const redis = require('redis');
   const client = redis.createClient();
   
   async function getCachedQuery(key, queryFn, ttl = 300) {
     const cached = await client.get(key);
     if (cached) return JSON.parse(cached);
     
     const result = await queryFn();
     await client.setex(key, ttl, JSON.stringify(result));
     return result;
   }
   ```

### 3. Database Deadlocks

**Detection Pattern**:
```json
{
  "level": "ERROR",
  "message": "Deadlock detected",
  "errorCode": "DEADLOCK_DETECTED",
  "victim": "transaction_abc123",
  "duration": 15000
}
```

**Root Cause Analysis**:
1. **Identify Deadlock Pattern**:
   ```sql
   -- PostgreSQL deadlock query
   SELECT blocked_locks.pid AS blocked_pid,
          blocking_locks.pid AS blocking_pid,
          blocked_activity.query AS blocked_statement
   FROM pg_catalog.pg_locks blocked_locks
   JOIN pg_catalog.pg_stat_activity blocked_activity 
     ON blocked_activity.pid = blocked_locks.pid;
   ```

**Solutions**:
1. **Consistent Lock Ordering**:
   ```javascript
   // Always acquire locks in same order: orders -> products -> customers
   await db.transaction(async (t) => {
     const order = await Order.findById(orderId, { transaction: t, lock: true });
     const product = await Product.findById(productId, { transaction: t, lock: true });
     // Process update
   });
   ```

2. **Implement Retry Logic**:
   ```javascript
   async function retryOnDeadlock(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (error.code === 'DEADLOCK_DETECTED' && i < maxRetries - 1) {
           await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
           continue;
         }
         throw error;
       }
     }
   }
   ```

## Payment & Financial Processing

### 4. Payment Gateway Timeouts

**Detection Pattern**:
```json
{
  "level": "ERROR",
  "message": "Payment gateway connection failed",
  "gateway": "stripe",
  "error": "ECONNREFUSED",
  "timeout": 8000,
  "attempt": 1
}
```

**Symptoms**:
- Checkout completion rate <85%
- Payment processing taking >10 seconds
- Gateway error rates >5%

**Root Cause Analysis**:
1. **Network Connectivity**:
   ```bash
   # Test gateway connectivity
   curl -I https://api.stripe.com/v1/charges
   traceroute api.stripe.com
   ```

2. **API Key Validation**:
   ```bash
   # Test API key
   curl https://api.stripe.com/v1/charges \
     -H "Authorization: Bearer sk_test_..." \
     -d "amount=100" -d "currency=usd"
   ```

**Solutions**:
1. **Implement Circuit Breaker**:
   ```javascript
   const paymentBreaker = new CircuitBreaker(processPayment, {
     timeout: 5000,
     errorThresholdPercentage: 30,
     resetTimeout: 60000
   });
   
   paymentBreaker.on('open', () => {
     logger.error('Payment gateway circuit breaker opened');
   });
   ```

2. **Add Retry with Exponential Backoff**:
   ```javascript
   async function retryPayment(paymentData, maxRetries = 3) {
     for (let attempt = 1; attempt <= maxRetries; attempt++) {
       try {
         return await processPayment(paymentData);
       } catch (error) {
         if (attempt === maxRetries) throw error;
         
         const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
         await new Promise(resolve => setTimeout(resolve, delay));
       }
     }
   }
   ```

3. **Implement Failover Gateway**:
   ```javascript
   const gateways = ['stripe', 'paypal', 'square'];
   
   async function processPaymentWithFailover(paymentData) {
     for (const gateway of gateways) {
       try {
         return await processPayment(paymentData, gateway);
       } catch (error) {
         logger.warn(`Payment failed with ${gateway}`, error);
         continue;
       }
     }
     throw new Error('All payment gateways failed');
   }
   ```

### 5. High Payment Decline Rates

**Detection Pattern**:
```json
{
  "level": "WARN",
  "message": "High payment decline rate detected",
  "declineRate": 0.15,
  "threshold": 0.05,
  "period": "1hour"
}
```

**Analysis Queries**:
```sql
-- Analyze decline reasons
SELECT decline_reason, COUNT(*) as count,
       COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
FROM payment_attempts 
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND status = 'declined'
GROUP BY decline_reason
ORDER BY count DESC;
```

**Solutions**:
1. **Decline Reason Analysis**:
   ```javascript
   const declineReasons = await PaymentAttempt.groupBy('decline_reason', {
     where: {
       status: 'declined',
       created_at: { [Op.gte]: new Date(Date.now() - 3600000) }
     }
   });
   
   // Alert if insufficient_funds > 50% of declines
   if (declineReasons.insufficient_funds / totalDeclines > 0.5) {
     // Suggest payment plan or alternative amount
   }
   ```

2. **Implement Smart Retry Logic**:
   ```javascript
   const retryableDeclines = ['insufficient_funds', 'card_declined'];
   
   if (retryableDeclines.includes(declineReason)) {
     // Suggest customer retry with different card
     return {
       shouldRetry: true,
       message: 'Please try a different payment method'
     };
   }
   ```

### 6. Fraudulent Transaction Detection

**Detection Pattern**:
```json
{
  "level": "ALERT",
  "message": "Potential fraud detected",
  "riskScore": 85,
  "indicators": ["velocity", "geolocation", "card_testing"],
  "customerId": "cust_abc123"
}
```

**Real-time Fraud Detection**:
```javascript
function calculateRiskScore(paymentData, customerHistory) {
  let riskScore = 0;
  
  // Velocity check - multiple attempts in short time
  const recentAttempts = customerHistory.paymentAttempts
    .filter(a => a.timestamp > Date.now() - 300000); // 5 minutes
  if (recentAttempts.length > 3) riskScore += 30;
  
  // Amount anomaly - unusually large order
  const avgOrderValue = customerHistory.avgOrderValue || 50;
  if (paymentData.amount > avgOrderValue * 3) riskScore += 25;
  
  // Geolocation check
  if (paymentData.ipCountry !== customerHistory.usualCountry) {
    riskScore += 20;
  }
  
  return riskScore;
}
```

**Automated Responses**:
```javascript
if (riskScore > 70) {
  // High risk - require additional verification
  return { action: 'verify', method: '3ds' };
} else if (riskScore > 40) {
  // Medium risk - manual review
  return { action: 'review', queue: 'fraud_team' };
} else {
  // Low risk - proceed
  return { action: 'approve' };
}
```

## Performance & Memory Problems

### 7. Memory Leaks

**Detection Pattern**:
```json
{
  "level": "WARN",
  "message": "Memory usage increasing",
  "heapUsed": 89456123,
  "heapTotal": 104857600,
  "heapPercentage": 85,
  "trend": "increasing"
}
```

**Diagnostic Steps**:
1. **Generate Heap Dump**:
   ```bash
   # Generate heap dump for analysis
   node --inspect app.js
   # In Chrome DevTools, go to Memory tab and take heap snapshot
   ```

2. **Memory Usage Monitoring**:
   ```javascript
   setInterval(() => {
     const usage = process.memoryUsage();
     const percentage = (usage.heapUsed / usage.heapTotal) * 100;
     
     logger.info('Memory usage', {
       heapUsed: usage.heapUsed,
       heapTotal: usage.heapTotal,
       percentage: percentage.toFixed(2),
       rss: usage.rss,
       external: usage.external
     });
     
     if (percentage > 85) {
       logger.error('High memory usage detected', usage);
     }
   }, 30000);
   ```

**Common Leak Patterns & Solutions**:

1. **Event Listener Leaks**:
   ```javascript
   // Problem: Not removing event listeners
   class DataProcessor {
     constructor() {
       this.eventEmitter.on('data', this.processData.bind(this));
     }
     
     destroy() {
       // Solution: Remove listeners
       this.eventEmitter.removeAllListeners('data');
     }
   }
   ```

2. **Closure Leaks**:
   ```javascript
   // Problem: Closures holding references to large objects
   function createProcessor(largeData) {
     return function(item) {
       // Large data is kept in memory even if not used
       return item.id;
     };
   }
   
   // Solution: Extract only needed data
   function createProcessor(largeData) {
     const neededData = largeData.importantField;
     return function(item) {
       return item.id + neededData;
     };
   }
   ```

3. **Cache Without Expiration**:
   ```javascript
   // Problem: Cache grows indefinitely
   const cache = new Map();
   
   // Solution: Implement LRU cache with size limit
   const LRU = require('lru-cache');
   const cache = new LRU({
     max: 1000,
     ttl: 1000 * 60 * 10 // 10 minutes
   });
   ```

### 8. High CPU Usage

**Detection Pattern**:
```json
{
  "level": "WARN",
  "message": "High CPU usage detected",
  "cpuUsage": 92.5,
  "threshold": 80,
  "duration": 300
}
```

**Diagnostic Tools**:
```bash
# CPU profiling
node --prof app.js
# Process the profile
node --prof-process isolate-*.log > profile.txt

# Real-time monitoring
top -p $(pgrep -f "node app.js")
htop -p $(pgrep -f "node app.js")
```

**Common Causes & Solutions**:

1. **Synchronous Operations Blocking Event Loop**:
   ```javascript
   // Problem: Synchronous file operations
   const data = fs.readFileSync('large-file.json');
   
   // Solution: Use async operations
   const data = await fs.promises.readFile('large-file.json');
   ```

2. **Inefficient Algorithms**:
   ```javascript
   // Problem: O(n²) loop for search
   function findUser(users, email) {
     for (const user of users) {
       if (user.email === email) return user;
     }
   }
   
   // Solution: Use Map for O(1) lookup
   const userMap = new Map(users.map(u => [u.email, u]));
   function findUser(email) {
     return userMap.get(email);
   }
   ```

3. **Excessive Logging**:
   ```javascript
   // Problem: Debug logging in production
   logger.debug('Processing item', largeObject); // Called millions of times
   
   // Solution: Conditional logging
   if (logger.level === 'debug') {
     logger.debug('Processing item', largeObject);
   }
   ```

### 9. Event Loop Lag

**Detection Pattern**:
```json
{
  "level": "WARN",
  "message": "Event loop lag detected",
  "lag": 156,
  "threshold": 100,
  "requests_queued": 23
}
```

**Monitoring Setup**:
```javascript
const { monitorEventLoopDelay } = require('perf_hooks');
const histogram = monitorEventLoopDelay();
histogram.enable();

setInterval(() => {
  const lag = histogram.mean / 1000000; // Convert to milliseconds
  
  if (lag > 100) {
    logger.warn('Event loop lag detected', {
      lag: lag.toFixed(2),
      percentiles: {
        p50: histogram.percentile(50) / 1000000,
        p95: histogram.percentile(95) / 1000000,
        p99: histogram.percentile(99) / 1000000
      }
    });
  }
  
  histogram.reset();
}, 10000);
```

**Solutions**:
1. **Break Up CPU-Intensive Tasks**:
   ```javascript
   // Problem: Long-running synchronous operation
   function processLargeArray(items) {
     return items.map(processItem);
   }
   
   // Solution: Process in batches
   async function processLargeArrayAsync(items, batchSize = 100) {
     const results = [];
     
     for (let i = 0; i < items.length; i += batchSize) {
       const batch = items.slice(i, i + batchSize);
       const batchResults = batch.map(processItem);
       results.push(...batchResults);
       
       // Yield control to event loop
       if (i + batchSize < items.length) {
         await new Promise(resolve => setImmediate(resolve));
       }
     }
     
     return results;
   }
   ```

2. **Use Worker Threads for CPU-Intensive Tasks**:
   ```javascript
   const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
   
   if (isMainThread) {
     // Main thread
     function processCPUIntensiveTask(data) {
       return new Promise((resolve, reject) => {
         const worker = new Worker(__filename, { workerData: data });
         
         worker.on('message', resolve);
         worker.on('error', reject);
         worker.on('exit', (code) => {
           if (code !== 0) {
             reject(new Error(`Worker stopped with exit code ${code}`));
           }
         });
       });
     }
   } else {
     // Worker thread
     const result = performComplexCalculation(workerData);
     parentPort.postMessage(result);
   }
   ```

## Service Reliability Issues

### 10. Cascading Service Failures

**Detection Pattern**:
```json
{
  "level": "ERROR",
  "message": "Cascading service failure detected",
  "failedServices": ["products", "orders", "reservations"],
  "cascadeStage": 3,
  "rootCause": "database_connection_failure"
}
```

**Prevention Strategies**:

1. **Circuit Breaker Pattern**:
   ```javascript
   class ServiceCircuitBreaker {
     constructor(service, options = {}) {
       this.service = service;
       this.failureThreshold = options.failureThreshold || 5;
       this.resetTimeout = options.resetTimeout || 60000;
       this.state = 'CLOSED';
       this.failures = 0;
       this.lastFailTime = 0;
     }
     
     async execute(...args) {
       if (this.state === 'OPEN') {
         if (Date.now() - this.lastFailTime > this.resetTimeout) {
           this.state = 'HALF_OPEN';
         } else {
           throw new Error('Circuit breaker is OPEN');
         }
       }
       
       try {
         const result = await this.service(...args);
         this.onSuccess();
         return result;
       } catch (error) {
         this.onFailure();
         throw error;
       }
     }
     
     onSuccess() {
       this.failures = 0;
       this.state = 'CLOSED';
     }
     
     onFailure() {
       this.failures++;
       this.lastFailTime = Date.now();
       
       if (this.failures >= this.failureThreshold) {
         this.state = 'OPEN';
       }
     }
   }
   ```

2. **Bulkhead Pattern**:
   ```javascript
   // Separate connection pools for different services
   const pools = {
     orders: new Pool({ connectionString: DB_URL, max: 5 }),
     products: new Pool({ connectionString: DB_URL, max: 3 }),
     users: new Pool({ connectionString: DB_URL, max: 2 })
   };
   
   // Separate thread pools for different operations
   const threadPools = {
     imageProcessing: new ThreadPool(2),
     emailSending: new ThreadPool(3),
     reporting: new ThreadPool(1)
   };
   ```

3. **Graceful Degradation**:
   ```javascript
   async function getProductRecommendations(userId) {
     try {
       return await mlService.getRecommendations(userId);
     } catch (error) {
       logger.warn('ML service unavailable, falling back to popular products');
       return await getPopularProducts();
     }
   }
   ```

### 11. Service Discovery Issues

**Detection Pattern**:
```json
{
  "level": "ERROR",
  "message": "Service discovery failure",
  "service": "payment-service",
  "lastKnownEndpoint": "http://payment:3000",
  "error": "SERVICE_UNREACHABLE"
}
```

**Health Check Implementation**:
```javascript
const express = require('express');
const app = express();

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };
  
  // Database connectivity
  try {
    await db.query('SELECT 1');
    health.checks.database = { status: 'healthy' };
  } catch (error) {
    health.checks.database = { status: 'unhealthy', error: error.message };
    health.status = 'unhealthy';
  }
  
  // External service connectivity
  try {
    await fetch('http://payment-service/health', { timeout: 2000 });
    health.checks.paymentService = { status: 'healthy' };
  } catch (error) {
    health.checks.paymentService = { status: 'unhealthy', error: error.message };
  }
  
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
```

### 12. Load Balancer Issues

**Detection Pattern**:
```json
{
  "level": "ERROR",
  "message": "Uneven load distribution detected",
  "instances": {
    "app-1": { "requests": 1000, "cpu": "95%" },
    "app-2": { "requests": 100, "cpu": "20%" },
    "app-3": { "requests": 150, "cpu": "25%" }
  }
}
```

**Solutions**:
1. **Health Check Tuning**:
   ```yaml
   # nginx.conf
   upstream backend {
     server app-1:3000 weight=1 max_fails=3 fail_timeout=30s;
     server app-2:3000 weight=1 max_fails=3 fail_timeout=30s;
     server app-3:3000 weight=1 max_fails=3 fail_timeout=30s;
     
     # Health check
     check interval=3000 rise=2 fall=5 timeout=1000 type=http;
   }
   ```

2. **Session Affinity**:
   ```javascript
   // Consistent hashing for session affinity
   const crypto = require('crypto');
   
   function getServerForSession(sessionId, servers) {
     const hash = crypto.createHash('sha1').update(sessionId).digest('hex');
     const serverIndex = parseInt(hash.substr(0, 8), 16) % servers.length;
     return servers[serverIndex];
   }
   ```

## User Experience Problems

### 13. High Page Load Times

**Detection Pattern**:
```json
{
  "event": "HTTP_REQUEST",
  "duration": 4567,
  "details": {
    "navigationTiming": {
      "loadStart": 771.2,
      "domContentLoaded": 770.4,
      "loadComplete": 771.2
    }
  }
}
```

**Performance Analysis**:
```javascript
// Frontend performance monitoring
class PerformanceMonitor {
  static measurePageLoad() {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      
      const metrics = {
        dns: navigation.domainLookupEnd - navigation.domainLookupStart,
        connect: navigation.connectEnd - navigation.connectStart,
        request: navigation.responseStart - navigation.requestStart,
        response: navigation.responseEnd - navigation.responseStart,
        dom: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        load: navigation.loadEventEnd - navigation.loadEventStart,
        total: navigation.loadEventEnd - navigation.navigationStart
      };
      
      logger.info('Page load metrics', metrics);
      
      if (metrics.total > 3000) {
        logger.warn('Slow page load detected', metrics);
      }
    });
  }
}
```

**Optimization Strategies**:
1. **Critical Resource Optimization**:
   ```html
   <!-- Preload critical resources -->
   <link rel="preload" href="/critical.css" as="style">
   <link rel="preload" href="/critical.js" as="script">
   
   <!-- DNS prefetch for external resources -->
   <link rel="dns-prefetch" href="//fonts.googleapis.com">
   <link rel="dns-prefetch" href="//api.stripe.com">
   ```

2. **Code Splitting**:
   ```javascript
   // Dynamic imports for route-based splitting
   const Home = lazy(() => import('./pages/Home'));
   const Menu = lazy(() => import('./pages/Menu'));
   const Checkout = lazy(() => import('./pages/Checkout'));
   
   // Suspense wrapper
   <Suspense fallback={<LoadingSpinner />}>
     <Routes>
       <Route path="/" element={<Home />} />
       <Route path="/menu" element={<Menu />} />
       <Route path="/checkout" element={<Checkout />} />
     </Routes>
   </Suspense>
   ```

3. **Image Optimization**:
   ```javascript
   // Progressive image loading
   const LazyImage = ({ src, alt, placeholder }) => {
     const [imageSrc, setImageSrc] = useState(placeholder);
     const [imageRef, isInView] = useInView({ threshold: 0.1 });
     
     useEffect(() => {
       if (isInView) {
         const img = new Image();
         img.src = src;
         img.onload = () => setImageSrc(src);
       }
     }, [isInView, src]);
     
     return <img ref={imageRef} src={imageSrc} alt={alt} />;
   };
   ```

### 14. High Bounce Rate

**Detection Pattern**:
```json
{
  "event": "SESSION_START",
  "sessionId": "session_123",
  "bounceRate": 0.65,
  "avgSessionDuration": 45,
  "exitPage": "/"
}
```

**Analysis & Solutions**:
```javascript
// Bounce rate analysis
class BounceAnalytics {
  static analyzeBounce(sessions) {
    const bounces = sessions.filter(s => 
      s.pageViews === 1 && s.duration < 30000
    );
    
    const bouncesByPage = bounces.reduce((acc, session) => {
      acc[session.landingPage] = (acc[session.landingPage] || 0) + 1;
      return acc;
    }, {});
    
    return {
      totalBounceRate: bounces.length / sessions.length,
      bouncesByPage,
      avgBounceTime: bounces.reduce((sum, s) => sum + s.duration, 0) / bounces.length
    };
  }
}

// Exit intent detection
document.addEventListener('mouseleave', (event) => {
  if (event.clientY <= 0) {
    // Mouse left through top of screen - likely closing tab
    logger.info('Exit intent detected');
    
    // Show exit intent popup or offer
    showExitIntentOffer();
  }
});
```

### 15. Poor Mobile Performance

**Detection Pattern**:
```json
{
  "userAgent": "Mobile Safari",
  "viewport": "375x667",
  "connectionType": "4g",
  "performanceScore": 45,
  "issues": ["layout_shift", "large_images", "blocking_resources"]
}
```

**Mobile Optimization**:
```javascript
// Responsive image loading
const ResponsiveImage = ({ src, alt, sizes }) => {
  const [imageSet, setImageSet] = useState('');
  
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const isRetina = window.devicePixelRatio > 1;
    
    let optimalSrc = src;
    if (isMobile) {
      optimalSrc = src.replace('.jpg', '_mobile.jpg');
    }
    if (isRetina && !isMobile) {
      optimalSrc = src.replace('.jpg', '_2x.jpg');
    }
    
    setImageSet(optimalSrc);
  }, [src]);
  
  return <img src={imageSet} alt={alt} sizes={sizes} />;
};

// Touch gesture optimization
const useTouch = () => {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    if (isLeftSwipe) handleLeftSwipe();
    if (isRightSwipe) handleRightSwipe();
  };
  
  return { onTouchStart, onTouchMove, onTouchEnd };
};
```

## Integration & API Issues

### 16. API Rate Limiting

**Detection Pattern**:
```json
{
  "level": "WARN",
  "message": "API rate limit exceeded",
  "endpoint": "/api/orders",
  "clientIp": "192.168.1.100",
  "requestsPerMinute": 150,
  "limit": 100
}
```

**Rate Limiting Implementation**:
```javascript
const rateLimit = require('express-rate-limit');
const redis = require('redis');
const client = redis.createClient();

// Advanced rate limiter with Redis
const createRateLimit = (windowMs, max, keyGenerator) => {
  return rateLimit({
    windowMs,
    max,
    keyGenerator,
    store: {
      incr: async (key) => {
        const current = await client.incr(key);
        if (current === 1) {
          await client.expire(key, Math.ceil(windowMs / 1000));
        }
        return { totalHits: current };
      },
      decrement: async (key) => {
        return await client.decr(key);
      },
      resetKey: async (key) => {
        return await client.del(key);
      }
    },
    onLimitReached: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        endpoint: req.path,
        userAgent: req.get('User-Agent')
      });
    }
  });
};

// Different limits for different endpoints
app.use('/api/orders', createRateLimit(60 * 1000, 30, req => req.ip)); // 30/min
app.use('/api/products', createRateLimit(60 * 1000, 100, req => req.ip)); // 100/min
app.use('/api/auth', createRateLimit(60 * 1000, 5, req => req.ip)); // 5/min
```

**Client-Side Rate Limit Handling**:
```javascript
class APIClient {
  constructor() {
    this.requestQueue = [];
    this.isRateLimited = false;
    this.retryAfter = 0;
  }
  
  async makeRequest(url, options = {}) {
    if (this.isRateLimited) {
      const waitTime = this.retryAfter - Date.now();
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        this.handleRateLimit(response);
        throw new Error('Rate limited');
      }
      
      this.isRateLimited = false;
      return response;
      
    } catch (error) {
      if (error.message === 'Rate limited') {
        // Exponential backoff retry
        const delay = Math.min(1000 * Math.pow(2, options.retryAttempt || 0), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.makeRequest(url, { 
          ...options, 
          retryAttempt: (options.retryAttempt || 0) + 1 
        });
      }
      throw error;
    }
  }
  
  handleRateLimit(response) {
    this.isRateLimited = true;
    const retryAfterHeader = response.headers.get('Retry-After');
    this.retryAfter = Date.now() + (parseInt(retryAfterHeader) * 1000 || 60000);
  }
}
```

### 17. Third-Party Service Outages

**Detection Pattern**:
```json
{
  "level": "ERROR",
  "message": "Third-party service unavailable",
  "service": "payment_processor",
  "endpoint": "https://api.stripe.com/v1/charges",
  "statusCode": 503,
  "consecutiveFailures": 5
}
```

**Resilience Strategies**:
```javascript
class ThirdPartyServiceWrapper {
  constructor(serviceName, config) {
    this.serviceName = serviceName;
    this.config = config;
    this.circuitBreaker = new CircuitBreaker(this.makeRequest.bind(this), {
      timeout: config.timeout || 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });
    
    this.fallbackStrategies = config.fallbacks || [];
  }
  
  async execute(operation, data) {
    try {
      return await this.circuitBreaker.fire(operation, data);
    } catch (error) {
      logger.error(`${this.serviceName} failed`, { operation, error: error.message });
      return await this.executeFallback(operation, data, error);
    }
  }
  
  async executeFallback(operation, data, originalError) {
    for (const strategy of this.fallbackStrategies) {
      try {
        logger.info(`Attempting fallback: ${strategy.name}`);
        return await strategy.execute(operation, data);
      } catch (fallbackError) {
        logger.warn(`Fallback ${strategy.name} failed`, fallbackError);
        continue;
      }
    }
    
    // All fallbacks failed, throw original error
    throw originalError;
  }
  
  async makeRequest(operation, data) {
    const url = `${this.config.baseURL}/${operation}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }
}

// Usage example
const paymentService = new ThirdPartyServiceWrapper('stripe', {
  baseURL: 'https://api.stripe.com/v1',
  apiKey: process.env.STRIPE_SECRET_KEY,
  timeout: 5000,
  fallbacks: [
    {
      name: 'paypal',
      execute: async (operation, data) => {
        // PayPal API call
        return await paypalAPI.processPayment(data);
      }
    },
    {
      name: 'offline_queue',
      execute: async (operation, data) => {
        // Queue for later processing
        await paymentQueue.add('process_payment', data);
        return { status: 'queued', id: generateId() };
      }
    }
  ]
});
```

## Logging & Telemetry Problems

### 18. Log Volume Explosion

**Detection Pattern**:
```json
{
  "level": "ALERT",
  "message": "Log volume spike detected",
  "currentRate": "50MB/min",
  "normalRate": "5MB/min",
  "diskUsage": "85%"
}
```

**Log Management Solutions**:
```javascript
// Adaptive logging based on system load
class AdaptiveLogger {
  constructor() {
    this.currentLevel = 'INFO';
    this.systemLoad = 0;
    this.diskUsage = 0;
    this.logRateLimit = new Map();
    
    // Monitor system metrics
    setInterval(() => this.adjustLogLevel(), 30000);
  }
  
  adjustLogLevel() {
    const load = os.loadavg()[0];
    const stats = fs.statSync('/tmp/codeuser');
    const diskUsage = stats.size / (1024 * 1024 * 1024); // GB
    
    if (diskUsage > 10 || load > 2.0) {
      this.currentLevel = 'WARN'; // Reduce logging
    } else if (diskUsage < 5 && load < 0.5) {
      this.currentLevel = 'INFO'; // Normal logging
    }
  }
  
  shouldLog(level, key) {
    // Rate limiting for noisy log entries
    const now = Date.now();
    const lastLog = this.logRateLimit.get(key);
    
    if (lastLog && now - lastLog < 60000) { // 1 minute
      return false;
    }
    
    this.logRateLimit.set(key, now);
    return this.getLevelPriority(level) >= this.getLevelPriority(this.currentLevel);
  }
  
  getLevelPriority(level) {
    const priorities = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    return priorities[level] || 0;
  }
}
```

**Log Rotation & Cleanup**:
```javascript
// Intelligent log rotation
class LogRotationManager {
  constructor(config) {
    this.config = config;
    this.rotationSchedule = cron.schedule('0 */6 * * *', () => {
      this.rotateLogsIfNeeded();
    });
  }
  
  async rotateLogsIfNeeded() {
    const logFiles = await glob('/tmp/codeuser/*.log');
    
    for (const file of logFiles) {
      const stats = await fs.promises.stat(file);
      const sizeMB = stats.size / (1024 * 1024);
      
      if (sizeMB > this.config.maxSizeMB) {
        await this.rotateFile(file);
      }
    }
  }
  
  async rotateFile(filePath) {
    const timestamp = new Date().toISOString().split('T')[0];
    const rotatedPath = `${filePath}.${timestamp}`;
    
    // Rotate current log
    await fs.promises.rename(filePath, rotatedPath);
    
    // Compress rotated log
    const gzip = zlib.createGzip();
    const source = fs.createReadStream(rotatedPath);
    const destination = fs.createWriteStream(`${rotatedPath}.gz`);
    
    source.pipe(gzip).pipe(destination);
    
    // Clean up old rotated logs
    setTimeout(() => fs.promises.unlink(rotatedPath), 5000);
  }
}
```

### 19. Missing Correlation IDs

**Detection Pattern**:
```json
{
  "level": "WARN",
  "message": "Log entry without correlation ID",
  "percentage": 23.5,
  "affectedServices": ["orders", "payments"],
  "impact": "difficult_debugging"
}
```

**Correlation ID Implementation**:
```javascript
// Express middleware for correlation IDs
const correlationIdMiddleware = (req, res, next) => {
  // Check for existing correlation ID in headers
  let correlationId = req.headers['x-correlation-id'] || 
                     req.headers['x-request-id'] ||
                     req.headers['traceparent'];
  
  if (!correlationId) {
    correlationId = generateCorrelationId();
  }
  
  // Add to request
  req.correlationId = correlationId;
  req.traceId = extractTraceId(correlationId);
  
  // Add to response headers
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Store in async local storage for automatic inclusion in logs
  asyncLocalStorage.run(new Map([
    ['correlationId', correlationId],
    ['traceId', req.traceId]
  ]), () => {
    next();
  });
};

// Logger wrapper that automatically includes correlation context
class CorrelatedLogger {
  static log(level, message, data = {}) {
    const context = asyncLocalStorage.getStore();
    const correlationId = context?.get('correlationId');
    const traceId = context?.get('traceId');
    
    logger[level](message, {
      ...data,
      correlationId,
      traceId,
      timestamp: new Date().toISOString()
    });
  }
  
  static info(message, data) { this.log('info', message, data); }
  static warn(message, data) { this.log('warn', message, data); }
  static error(message, data) { this.log('error', message, data); }
}
```

### 20. Telemetry Data Drift

**Detection Pattern**:
```json
{
  "level": "ALERT",
  "message": "Telemetry schema drift detected",
  "field": "responseTime",
  "expectedType": "number",
  "actualType": "string",
  "affectedLogs": 1247
}
```

**Schema Validation**:
```javascript
const Ajv = require('ajv');
const ajv = new Ajv();

// Define schemas for different log types
const schemas = {
  httpRequest: {
    type: 'object',
    required: ['timestamp', 'method', 'url', 'status', 'responseTime'],
    properties: {
      timestamp: { type: 'string', format: 'date-time' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
      url: { type: 'string' },
      status: { type: 'integer', minimum: 100, maximum: 599 },
      responseTime: { type: 'number', minimum: 0 }
    }
  },
  businessEvent: {
    type: 'object',
    required: ['timestamp', 'eventType', 'action'],
    properties: {
      timestamp: { type: 'string', format: 'date-time' },
      eventType: { type: 'string' },
      action: { type: 'string' },
      value: { type: 'number', minimum: 0 }
    }
  }
};

// Compile validators
const validators = {};
for (const [name, schema] of Object.entries(schemas)) {
  validators[name] = ajv.compile(schema);
}

// Validation middleware
function validateLogEntry(type, data) {
  const validator = validators[type];
  if (!validator) {
    return { valid: false, errors: [`Unknown log type: ${type}`] };
  }
  
  const valid = validator(data);
  return {
    valid,
    errors: valid ? [] : validator.errors.map(err => 
      `${err.instancePath} ${err.message}`
    )
  };
}

// Enhanced logger with validation
class ValidatedLogger extends CorrelatedLogger {
  static logWithValidation(type, level, message, data) {
    const validation = validateLogEntry(type, data);
    
    if (!validation.valid) {
      // Log validation error
      super.error('Schema validation failed', {
        logType: type,
        originalData: data,
        validationErrors: validation.errors
      });
      
      // Try to sanitize and log anyway
      const sanitizedData = this.sanitizeData(data, type);
      super.log(level, message, sanitizedData);
    } else {
      super.log(level, message, data);
    }
  }
  
  static sanitizeData(data, expectedType) {
    const sanitized = { ...data };
    const schema = schemas[expectedType];
    
    if (schema && schema.properties) {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        if (field in sanitized) {
          sanitized[field] = this.coerceType(sanitized[field], fieldSchema.type);
        }
      }
    }
    
    sanitized._sanitized = true;
    return sanitized;
  }
  
  static coerceType(value, expectedType) {
    switch (expectedType) {
      case 'number':
        const num = Number(value);
        return isNaN(num) ? 0 : num;
      case 'string':
        return String(value);
      case 'boolean':
        return Boolean(value);
      default:
        return value;
    }
  }
}
```

This comprehensive troubleshooting playbook provides detailed detection patterns, analysis procedures, and step-by-step solutions for the most common telemetry and operational issues in the restaurant application. Each problem includes monitoring setup, immediate response procedures, and long-term prevention strategies.