# Developer Integration Guide

## Overview

This comprehensive guide provides developers with everything needed to integrate logging, metrics, and tracing into the restaurant application. It covers both frontend and backend integration patterns, best practices, and step-by-step implementation instructions.

## Table of Contents

1. [Backend Integration](#backend-integration)
2. [Frontend Integration](#frontend-integration) 
3. [Correlation and Context](#correlation-and-context)
4. [Error Handling and Recovery](#error-handling-and-recovery)
5. [Performance Considerations](#performance-considerations)
6. [Testing and Validation](#testing-and-validation)
7. [Deployment and Operations](#deployment-and-operations)

## Backend Integration

### Express.js Middleware Setup

#### Request Logging Middleware

```javascript
const express = require('express');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

// Create access logger using CLF format
const accessLogger = winston.createLogger({
  format: winston.format.printf(({ timestamp, ip, method, url, status, responseTime, userAgent, contentLength }) => {
    const host = ip || '-';
    const ident = '-';
    const authuser = '-';
    const timestampFormatted = new Date(timestamp).toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const httpRequest = `"${method || 'GET'} ${url || '/'} HTTP/1.1"`;
    const statusCode = status || 200;
    const size = contentLength || '-';
    
    return `${host} ${ident} ${authuser} [${timestampFormatted}] ${httpRequest} ${statusCode} ${size}`;
  }),
  transports: [
    new winston.transports.File({ filename: '/tmp/codeuser/access.log' })
  ]
});

// Request correlation middleware
function correlationMiddleware(req, res, next) {
  // Extract or generate correlation IDs
  req.requestId = req.headers['x-request-id'] || uuidv4();
  req.traceId = req.headers['x-trace-id'] || `trace_${uuidv4()}`;
  req.sessionId = req.headers['x-session-id'] || extractSessionFromCookies(req);
  
  // Add to response headers for client-side correlation
  res.set('X-Request-Id', req.requestId);
  res.set('X-Trace-Id', req.traceId);
  
  // Store in async local storage for access by other middleware/handlers
  const asyncLocalStorage = require('async_hooks').AsyncLocalStorage;
  const store = new Map();
  store.set('requestId', req.requestId);
  store.set('traceId', req.traceId);
  store.set('sessionId', req.sessionId);
  
  asyncLocalStorage.run(store, () => next());
}

// Access logging middleware
function accessLoggingMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Capture response details
  const originalSend = res.send;
  res.send = function(body) {
    const responseTime = Date.now() - startTime;
    
    // Log access entry
    accessLogger.info('', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTime,
      userAgent: req.get('User-Agent'),
      contentLength: body ? Buffer.byteLength(body) : 0,
      traceId: req.traceId,
      sessionId: req.sessionId,
      requestId: req.requestId
    });
    
    originalSend.call(this, body);
  };
  
  next();
}

// Apply middleware
app.use(correlationMiddleware);
app.use(accessLoggingMiddleware);
```

#### Business Event Logging

```javascript
const businessLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '/tmp/codeuser/events.log' })
  ]
});

function logBusinessEvent(eventType, action, eventData, req) {
  const correlationId = `corr_${uuidv4()}`;
  
  businessLogger.info({
    timestamp: new Date().toISOString(),
    eventType,
    action,
    level: 'info',
    service: 'restaurant-app',
    userId: req.user?.id || 'anonymous',
    sessionId: req.sessionId,
    orderId: eventData.orderId,
    productId: eventData.productId,
    amount: eventData.amount,
    currency: eventData.currency || 'USD',
    correlationId,
    traceId: req.traceId,
    eventData,
    duration: eventData.duration,
    count: eventData.count || 1,
    message: `${eventType}.${action} event processed`
  });
  
  return correlationId;
}

// Usage in route handlers
app.post('/api/orders', async (req, res) => {
  try {
    const startTime = Date.now();
    const order = await OrderService.createOrder(req.body);
    const duration = Date.now() - startTime;
    
    // Log business event
    logBusinessEvent('order', 'created', {
      orderId: order.id,
      amount: order.total,
      currency: 'USD',
      duration,
      items: order.items
    }, req);
    
    res.status(201).json(order);
  } catch (error) {
    logError('Order creation failed', error, req);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

#### Error Logging with Context

```javascript
const errorLogger = winston.createLogger({
  level: 'warn',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '/tmp/codeuser/errors.log' })
  ]
});

function logError(message, error, req, context = {}) {
  const errorEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message,
    errorCode: error.code || 'UNKNOWN_ERROR',
    severity: error.severity || 'medium',
    context: context.context || 'application',
    service: 'restaurant-app',
    correlationId: `corr_error_${uuidv4()}`,
    stack: error.stack ? error.stack.split('\\n').map(line => line.trim()) : undefined,
    
    // Request context
    requestId: req?.requestId,
    traceId: req?.traceId,
    sessionId: req?.sessionId,
    userId: req?.user?.id,
    method: req?.method,
    url: req?.originalUrl,
    
    // Additional context
    ...context,
    
    // Error details
    errorName: error.name,
    errorMessage: error.message
  };
  
  errorLogger.error(errorEntry);
  return errorEntry.correlationId;
}

// Global error handler
app.use((error, req, res, next) => {
  const correlationId = logError('Unhandled application error', error, req, {
    context: 'global_error_handler',
    severity: 'high'
  });
  
  res.status(500).json({
    error: 'Internal server error',
    correlationId,
    requestId: req.requestId
  });
});
```

### Database Integration

#### Connection Pool Monitoring

```javascript
const { Pool } = require('pg');

class MonitoredPool extends Pool {
  constructor(config) {
    super(config);
    this.metricsLogger = winston.createLogger({
      format: winston.format.json(),
      transports: [
        new winston.transports.File({ filename: '/tmp/codeuser/metrics.log' })
      ]
    });
    
    this.setupMonitoring();
  }
  
  setupMonitoring() {
    // Monitor connection events
    this.on('connect', (client) => {
      this.metricsLogger.info({
        timestamp: new Date().toISOString(),
        metric: 'db_connection_acquired',
        poolSize: this.totalCount,
        idleConnections: this.idleCount,
        waitingClients: this.waitingCount
      });
    });
    
    this.on('error', (err, client) => {
      logError('Database connection error', err, null, {
        context: 'database_pool',
        severity: 'critical'
      });
    });
    
    // Periodic metrics collection
    setInterval(() => {
      this.metricsLogger.info({
        timestamp: new Date().toISOString(),
        metric: 'db_pool_status',
        totalConnections: this.totalCount,
        idleConnections: this.idleCount,
        waitingClients: this.waitingCount
      });
    }, 30000); // Every 30 seconds
  }
}

const pool = new MonitoredPool({
  user: 'restaurant_user',
  host: 'localhost',
  database: 'restaurant_demo',
  password: process.env.DB_PASSWORD,
  port: 5432,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

#### Query Performance Monitoring

```javascript
const performanceLogger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: '/tmp/codeuser/performance.log' })
  ]
});

async function executeQuery(query, params = [], context = {}) {
  const startTime = Date.now();
  const queryId = `query_${uuidv4()}`;
  
  try {
    const result = await pool.query(query, params);
    const duration = Date.now() - startTime;
    
    // Log performance metrics
    performanceLogger.info({
      timestamp: new Date().toISOString(),
      metric: 'database_query',
      queryId,
      duration,
      rowCount: result.rowCount,
      query: query.substring(0, 100) + '...', // Truncate for logging
      context: context.context || 'unknown',
      traceId: context.traceId,
      requestId: context.requestId
    });
    
    // Warn on slow queries
    if (duration > 1000) {
      logError('Slow database query detected', new Error('Query performance issue'), null, {
        context: 'database_performance',
        severity: 'medium',
        queryId,
        duration,
        threshold: 1000,
        query: query.substring(0, 200)
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logError('Database query failed', error, null, {
      context: 'database_query',
      severity: 'high',
      queryId,
      duration,
      query: query.substring(0, 200),
      params: JSON.stringify(params)
    });
    
    throw error;
  }
}
```

## Frontend Integration

### Session Tracking Service

```typescript
// src/services/SessionTracker.ts
export class SessionTracker {
  private traceId: string;
  private sessionId: string;
  private userId: string | null = null;
  
  constructor() {
    this.traceId = this.generateTraceId();
    this.sessionId = this.getOrCreateSessionId();
    this.initializeTracking();
  }
  
  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }
  
  private initializeTracking() {
    // Track page views
    this.trackPageView(window.location.pathname);
    
    // Track navigation
    window.addEventListener('popstate', () => {
      this.trackPageView(window.location.pathname);
    });
  }
  
  trackPageView(path: string) {
    this.logEvent('page_view', {
      path,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      referrer: document.referrer
    });
  }
  
  trackUserAction(action: string, details: any = {}) {
    this.logEvent('user_action', {
      action,
      ...details,
      timestamp: new Date().toISOString()
    });
  }
  
  private logEvent(eventType: string, data: any) {
    // Send to backend logging endpoint
    fetch('/api/frontend-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Trace-Id': this.traceId,
        'X-Session-Id': this.sessionId
      },
      body: JSON.stringify({
        eventType,
        data,
        traceId: this.traceId,
        sessionId: this.sessionId,
        userId: this.userId
      })
    }).catch(error => {
      console.warn('Failed to send frontend log:', error);
    });
  }
  
  setUserId(userId: string) {
    this.userId = userId;
  }
  
  getTraceId(): string {
    return this.traceId;
  }
  
  getSessionId(): string {
    return this.sessionId;
  }
}

// Global instance
export const sessionTracker = new SessionTracker();
```

### API Client with Correlation

```typescript
// src/services/ApiClient.ts
import { sessionTracker } from './SessionTracker';

export class ApiClient {
  private baseURL: string;
  
  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
  }
  
  private async request<T>(
    method: string, 
    endpoint: string, 
    data?: any,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const startTime = Date.now();
    
    const requestHeaders = {
      'Content-Type': 'application/json',
      'X-Trace-Id': sessionTracker.getTraceId(),
      'X-Session-Id': sessionTracker.getSessionId(),
      ...options.headers
    };
    
    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: data ? JSON.stringify(data) : undefined,
        ...options
      });
      
      const responseTime = Date.now() - startTime;
      
      // Log API call
      sessionTracker.trackUserAction('api_call', {
        method,
        endpoint,
        status: response.status,
        responseTime,
        success: response.ok
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          `API call failed: ${response.status}`,
          response.status,
          errorData,
          {
            method,
            endpoint,
            traceId: sessionTracker.getTraceId(),
            requestId: response.headers.get('X-Request-Id')
          }
        );
      }
      
      return await response.json();
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Log API error
      sessionTracker.trackUserAction('api_error', {
        method,
        endpoint,
        error: error.message,
        responseTime
      });
      
      throw error;
    }
  }
  
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, options);
  }
  
  async post<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>('POST', endpoint, data, options);
  }
  
  async put<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>('PUT', endpoint, data, options);
  }
  
  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: any,
    public context: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

### Error Boundary with Logging

```typescript
// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { sessionTracker } from '../services/SessionTracker';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorId: null };
  }
  
  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.state.errorId;
    
    // Log error to backend
    sessionTracker.trackUserAction('frontend_error', {
      errorId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });
    
    // Also log to console for development
    console.error('React Error Boundary caught error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className=\"error-boundary\">
          <h2>Something went wrong</h2>
          <p>We've logged this error and will look into it.</p>
          <p>Error ID: {this.state.errorId}</p>
          <button onClick={() => this.setState({ hasError: false, errorId: null })}>
            Try again
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

## Correlation and Context

### Request Context Propagation

```javascript
// Backend: Context propagation through async operations
const { AsyncLocalStorage } = require('async_hooks');

const requestContext = new AsyncLocalStorage();

function withRequestContext(req, callback) {
  const context = {
    requestId: req.requestId,
    traceId: req.traceId,
    sessionId: req.sessionId,
    userId: req.user?.id
  };
  
  return requestContext.run(context, callback);
}

function getRequestContext() {
  return requestContext.getStore();
}

// Usage in service layers
class OrderService {
  async createOrder(orderData) {
    const context = getRequestContext();
    
    // All database operations include context
    const order = await executeQuery(
      'INSERT INTO orders (user_id, total, created_at) VALUES ($1, $2, NOW()) RETURNING *',
      [context.userId, orderData.total],
      context
    );
    
    // Business event logging includes context
    logBusinessEvent('order', 'created', {
      orderId: order.id,
      amount: order.total
    }, { ...context });
    
    return order;
  }
}
```

### Cross-Service Correlation

```javascript
// HTTP client with correlation headers
const axios = require('axios');

function createCorrelatedHttpClient() {
  const client = axios.create();
  
  client.interceptors.request.use((config) => {
    const context = getRequestContext();
    if (context) {
      config.headers['X-Trace-Id'] = context.traceId;
      config.headers['X-Request-Id'] = context.requestId;
      config.headers['X-Session-Id'] = context.sessionId;
    }
    return config;
  });
  
  client.interceptors.response.use(
    (response) => {
      // Log successful external API calls
      performanceLogger.info({
        timestamp: new Date().toISOString(),
        metric: 'external_api_call',
        url: response.config.url,
        method: response.config.method,
        status: response.status,
        responseTime: response.config.metadata?.endTime - response.config.metadata?.startTime,
        traceId: response.config.headers['X-Trace-Id']
      });
      
      return response;
    },
    (error) => {
      // Log failed external API calls
      logError('External API call failed', error, null, {
        context: 'external_api',
        severity: 'medium',
        url: error.config?.url,
        method: error.config?.method,
        traceId: error.config?.headers?.['X-Trace-Id']
      });
      
      return Promise.reject(error);
    }
  );
  
  return client;
}
```

## Error Handling and Recovery

### Graceful Degradation Patterns

```javascript
// Circuit breaker for external services
class CircuitBreaker {
  constructor(options = {}) {
    this.threshold = options.threshold || 5;
    this.timeout = options.timeout || 60000;
    this.monitor = options.monitor || false;
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.nextAttempt = Date.now();
    this.name = options.name || 'circuit-breaker';
  }
  
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        const error = new Error(`Circuit breaker ${this.name} is OPEN`);
        error.code = 'CIRCUIT_BREAKER_OPEN';
        
        logError('Circuit breaker blocked request', error, null, {
          context: 'circuit_breaker',
          severity: 'medium',
          breakerName: this.name,
          state: this.state,
          failureCount: this.failureCount
        });
        
        throw error;
      } else {
        this.state = 'HALF_OPEN';
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    
    if (this.monitor) {
      performanceLogger.info({
        timestamp: new Date().toISOString(),
        metric: 'circuit_breaker_success',
        breakerName: this.name,
        state: this.state,
        failureCount: this.failureCount
      });
    }
  }
  
  onFailure() {
    this.failureCount++;
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      
      logError('Circuit breaker opened', new Error('Failure threshold reached'), null, {
        context: 'circuit_breaker',
        severity: 'high',
        breakerName: this.name,
        failureCount: this.failureCount,
        threshold: this.threshold
      });
    }
  }
}

// Usage with payment gateway
const paymentGatewayCircuit = new CircuitBreaker({
  name: 'payment_gateway',
  threshold: 3,
  timeout: 30000,
  monitor: true
});

async function processPayment(paymentData) {
  try {
    return await paymentGatewayCircuit.execute(async () => {
      return await paymentGateway.charge(paymentData);
    });
  } catch (error) {
    if (error.code === 'CIRCUIT_BREAKER_OPEN') {
      // Graceful degradation: queue payment for later processing
      await queuePaymentForLater(paymentData);
      return { status: 'queued', message: 'Payment queued for processing' };
    }
    throw error;
  }
}
```

### Retry Logic with Exponential Backoff

```javascript
async function retryWithBackoff(operation, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 1000;
  const maxDelay = options.maxDelay || 30000;
  const jitter = options.jitter || true;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      
      // Log successful retry
      if (attempt > 0) {
        performanceLogger.info({
          timestamp: new Date().toISOString(),
          metric: 'retry_success',
          operation: options.name || 'unknown',
          attempt,
          totalAttempts: attempt + 1
        });
      }
      
      return result;
    } catch (error) {
      if (attempt === maxRetries) {
        logError('All retry attempts failed', error, null, {
          context: 'retry_exhausted',
          severity: 'high',
          operation: options.name || 'unknown',
          totalAttempts: attempt + 1,
          maxRetries
        });
        throw error;
      }
      
      // Calculate delay with exponential backoff
      let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      if (jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }
      
      logError(`Operation failed, retrying in ${delay}ms`, error, null, {
        context: 'retry_attempt',
        severity: 'medium',
        operation: options.name || 'unknown',
        attempt,
        nextRetryIn: delay
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## Performance Considerations

### Metrics Collection

```javascript
const metricsLogger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: '/tmp/codeuser/metrics.log' })
  ]
});

class MetricsCollector {
  constructor() {
    this.counters = new Map();
    this.timers = new Map();
    this.gauges = new Map();
  }
  
  incrementCounter(name, value = 1, labels = {}) {
    const key = `${name}:${JSON.stringify(labels)}`;
    this.counters.set(key, (this.counters.get(key) || 0) + value);
    
    metricsLogger.info({
      timestamp: new Date().toISOString(),
      metricType: 'counter',
      name,
      value: this.counters.get(key),
      labels
    });
  }
  
  startTimer(name, labels = {}) {
    const key = `${name}:${JSON.stringify(labels)}`;
    this.timers.set(key, Date.now());
  }
  
  endTimer(name, labels = {}) {
    const key = `${name}:${JSON.stringify(labels)}`;
    const startTime = this.timers.get(key);
    
    if (startTime) {
      const duration = Date.now() - startTime;
      this.timers.delete(key);
      
      metricsLogger.info({
        timestamp: new Date().toISOString(),
        metricType: 'timer',
        name,
        duration,
        labels
      });
      
      return duration;
    }
  }
  
  setGauge(name, value, labels = {}) {
    const key = `${name}:${JSON.stringify(labels)}`;
    this.gauges.set(key, value);
    
    metricsLogger.info({
      timestamp: new Date().toISOString(),
      metricType: 'gauge',
      name,
      value,
      labels
    });
  }
}

// Global metrics instance
const metrics = new MetricsCollector();

// Usage in application
app.use('/api/orders', (req, res, next) => {
  metrics.incrementCounter('api_requests_total', 1, {
    method: req.method,
    endpoint: '/api/orders'
  });
  
  metrics.startTimer('request_duration', {
    method: req.method,
    endpoint: '/api/orders'
  });
  
  res.on('finish', () => {
    metrics.endTimer('request_duration', {
      method: req.method,
      endpoint: '/api/orders'
    });
    
    metrics.incrementCounter('api_responses_total', 1, {
      method: req.method,
      endpoint: '/api/orders',
      status: res.statusCode
    });
  });
  
  next();
});
```

### Log Sampling for High Volume

```javascript
class SamplingLogger {
  constructor(baseLogger, samplingRate = 0.1) {
    this.baseLogger = baseLogger;
    this.samplingRate = samplingRate;
    this.sampleCount = 0;
    this.totalCount = 0;
  }
  
  shouldSample(level = 'info', context = {}) {
    this.totalCount++;
    
    // Always log errors and warnings
    if (level === 'error' || level === 'warn') {
      return true;
    }
    
    // Always log business-critical events
    if (context.critical) {
      return true;
    }
    
    // Sample based on configured rate
    if (Math.random() < this.samplingRate) {
      this.sampleCount++;
      return true;
    }
    
    return false;
  }
  
  log(level, message, context = {}) {
    if (this.shouldSample(level, context)) {
      this.baseLogger[level](message, {
        ...context,
        _sampled: true,
        _sampleRate: this.samplingRate,
        _sampleCount: this.sampleCount,
        _totalCount: this.totalCount
      });
    }
  }
  
  info(message, context = {}) {
    this.log('info', message, context);
  }
  
  warn(message, context = {}) {
    this.log('warn', message, context);
  }
  
  error(message, context = {}) {
    this.log('error', message, context);
  }
}
```

## Testing and Validation

### Log Testing Utilities

```javascript
const winston = require('winston');

class TestLogCapture extends winston.Transport {
  constructor(opts) {
    super(opts);
    this.logs = [];
  }
  
  log(info, callback) {
    this.logs.push(info);
    callback();
  }
  
  getLogs() {
    return this.logs;
  }
  
  clearLogs() {
    this.logs = [];
  }
  
  findLogs(predicate) {
    return this.logs.filter(predicate);
  }
  
  hasLogWithMessage(message) {
    return this.logs.some(log => log.message === message);
  }
  
  hasLogWithLevel(level) {
    return this.logs.some(log => log.level === level);
  }
}

// Test setup
describe('Order Service Logging', () => {
  let testCapture;
  let orderService;
  
  beforeEach(() => {
    testCapture = new TestLogCapture();
    
    // Replace logger with test capture
    const testLogger = winston.createLogger({
      transports: [testCapture]
    });
    
    orderService = new OrderService(testLogger);
  });
  
  afterEach(() => {
    testCapture.clearLogs();
  });
  
  test('should log business event when order is created', async () => {
    const orderData = { total: 25.99, items: [{ id: 1, quantity: 2 }] };
    
    await orderService.createOrder(orderData);
    
    expect(testCapture.hasLogWithMessage('order.created event processed')).toBe(true);
    
    const businessLogs = testCapture.findLogs(log => 
      log.eventType === 'order' && log.action === 'created'
    );
    
    expect(businessLogs).toHaveLength(1);
    expect(businessLogs[0].amount).toBe(25.99);
  });
  
  test('should log error when database fails', async () => {
    // Mock database failure
    jest.spyOn(pool, 'query').mockRejectedValue(new Error('Connection failed'));
    
    await expect(orderService.createOrder({})).rejects.toThrow();
    
    expect(testCapture.hasLogWithLevel('error')).toBe(true);
    
    const errorLogs = testCapture.findLogs(log => log.level === 'error');
    expect(errorLogs[0].context).toBe('database_query');
  });
});
```

### Integration Test Helpers

```javascript
// Test utilities for log validation
class LogTestUtils {
  static async waitForLog(logger, predicate, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      
      const checkForLog = () => {
        const logs = logger.getLogs();
        const matchingLog = logs.find(predicate);
        
        if (matchingLog) {
          resolve(matchingLog);
        } else if (Date.now() - start > timeout) {
          reject(new Error('Timeout waiting for log'));
        } else {
          setTimeout(checkForLog, 100);
        }
      };
      
      checkForLog();
    });
  }
  
  static validateCorrelationIds(logs) {
    const correlationIds = logs.map(log => log.correlationId).filter(Boolean);
    const traceIds = logs.map(log => log.traceId).filter(Boolean);
    
    // All logs should have correlation IDs
    expect(correlationIds).toHaveLength(logs.length);
    
    // All logs should have consistent trace IDs within a request
    const uniqueTraceIds = [...new Set(traceIds)];
    expect(uniqueTraceIds).toHaveLength(1);
  }
  
  static validateLogFormat(log, format = 'json') {
    switch (format) {
      case 'json':
        expect(log).toHaveProperty('timestamp');
        expect(log).toHaveProperty('level');
        expect(log).toHaveProperty('message');
        expect(log).toHaveProperty('service', 'restaurant-app');
        break;
      case 'clf':
        expect(typeof log).toBe('string');
        expect(log).toMatch(/^\\S+ \\S+ \\S+ \\[.+\\] ".+" \\d+ \\S+/);
        break;
    }
  }
}
```

## Deployment and Operations

### Environment-Specific Configuration

```javascript
// config/logging.js
const winston = require('winston');

function createLogger(environment = process.env.NODE_ENV || 'development') {
  const transports = [];
  
  switch (environment) {
    case 'production':
      transports.push(
        new winston.transports.File({
          filename: '/var/log/restaurant-app/app.log',
          level: 'info',
          format: winston.format.json(),
          maxsize: 100 * 1024 * 1024, // 100MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: '/var/log/restaurant-app/errors.log',
          level: 'error',
          format: winston.format.json(),
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 10
        })
      );
      break;
      
    case 'staging':
      transports.push(
        new winston.transports.File({
          filename: '/tmp/codeuser/staging.log',
          level: 'debug',
          format: winston.format.json()
        }),
        new winston.transports.Console({
          level: 'info',
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      );
      break;
      
    case 'development':
    default:
      transports.push(
        new winston.transports.Console({
          level: 'debug',
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              let output = `${timestamp} ${level}: ${message}`;
              if (Object.keys(meta).length > 0) {
                output += `\\n${JSON.stringify(meta, null, 2)}`;
              }
              return output;
            })
          )
        }),
        new winston.transports.File({
          filename: '/tmp/codeuser/development.log',
          level: 'debug',
          format: winston.format.json()
        })
      );
      break;
  }
  
  return winston.createLogger({
    level: environment === 'production' ? 'info' : 'debug',
    defaultMeta: {
      service: 'restaurant-app',
      environment,
      version: process.env.APP_VERSION || '1.0.0',
      instance: process.env.INSTANCE_ID || 'unknown'
    },
    transports,
    handleExceptions: true,
    handleRejections: true,
    exitOnError: false
  });
}

module.exports = { createLogger };
```

### Health Checks and Monitoring

```javascript
// Health check endpoint
app.get('/health', async (req, res) => {
  const healthChecks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    version: process.env.APP_VERSION || '1.0.0',
    uptime: process.uptime(),
    checks: {}
  };
  
  try {
    // Database health check
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    healthChecks.checks.database = {
      status: 'healthy',
      responseTime: Date.now() - dbStart
    };
    
    // External service health checks
    const paymentStart = Date.now();
    const paymentHealth = await checkPaymentGatewayHealth();
    healthChecks.checks.paymentGateway = {
      status: paymentHealth ? 'healthy' : 'degraded',
      responseTime: Date.now() - paymentStart
    };
    
    // Memory usage check
    const memUsage = process.memoryUsage();
    healthChecks.checks.memory = {
      status: memUsage.rss < 512 * 1024 * 1024 ? 'healthy' : 'warning', // 512MB
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal
    };
    
    // Determine overall status
    const allChecks = Object.values(healthChecks.checks);
    const hasUnhealthy = allChecks.some(check => check.status === 'unhealthy');
    const hasWarning = allChecks.some(check => check.status === 'warning' || check.status === 'degraded');
    
    if (hasUnhealthy) {
      healthChecks.status = 'unhealthy';
      res.status(503);
    } else if (hasWarning) {
      healthChecks.status = 'degraded';
      res.status(200);
    }
    
    res.json(healthChecks);
    
  } catch (error) {
    healthChecks.status = 'unhealthy';
    healthChecks.error = error.message;
    
    logError('Health check failed', error, req, {
      context: 'health_check',
      severity: 'critical'
    });
    
    res.status(503).json(healthChecks);
  }
});

async function checkPaymentGatewayHealth() {
  try {
    // Simple ping to payment gateway
    await axios.get(`${process.env.PAYMENT_GATEWAY_URL}/health`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}
```

This comprehensive developer integration guide provides everything needed to implement consistent, correlated, and observable logging throughout the restaurant application stack.

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Create comprehensive log format analysis documentation", "status": "completed", "id": "1"}, {"content": "Document data pipeline integration strategies", "status": "completed", "id": "2"}, {"content": "Build parsing implementation guide with examples", "status": "completed", "id": "3"}, {"content": "Create troubleshooting playbook with 25+ telemetry problems", "status": "completed", "id": "4"}, {"content": "Generate configuration examples for all formats", "status": "completed", "id": "5"}, {"content": "Organize sample log repository with real examples", "status": "completed", "id": "6"}, {"content": "Write developer integration guide", "status": "completed", "id": "7"}]