import { accessLogger, eventLogger, performanceLogger, errorLogger, metricsLogger } from '../logging/winston-config.js';

// Request ID generator
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
};

// Extract client IP address
const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
};

// Get user agent
const getUserAgent = (req) => {
  return req.headers['user-agent'] || 'unknown';
};

// Categorize HTTP status codes
const categorizeStatus = (status) => {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'client_error';
  if (status >= 500) return 'server_error';
  return 'unknown';
};

// Extract URL pattern for metrics
const extractUrlPattern = (url) => {
  return url
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
    .replace(/\?.*$/, ''); // Remove query parameters
};

// Main logging middleware
export const loggingMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  // Add request ID to request object for use in routes
  req.requestId = requestId;
  req.startTime = startTime;

  // Capture original end method
  const originalEnd = res.end;
  const originalSend = res.send;
  const originalJson = res.json;

  let responseBody = null;
  let bodySize = 0;

  // Override res.send to capture response body
  res.send = function(body) {
    if (body && typeof body === 'string') {
      responseBody = body.length > 1000 ? body.substring(0, 1000) + '...' : body;
      bodySize = Buffer.byteLength(body, 'utf8');
    }
    return originalSend.call(this, body);
  };

  // Override res.json to capture JSON responses
  res.json = function(obj) {
    if (obj) {
      const jsonString = JSON.stringify(obj);
      responseBody = jsonString.length > 1000 ? jsonString.substring(0, 1000) + '...' : jsonString;
      bodySize = Buffer.byteLength(jsonString, 'utf8');
    }
    return originalJson.call(this, obj);
  };

  // Override res.end to capture final metrics
  res.end = function(chunk, encoding) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const ip = getClientIP(req);
    const userAgent = getUserAgent(req);
    const urlPattern = extractUrlPattern(req.url);

    // If chunk is provided and we don't have response body, capture it
    if (chunk && !responseBody) {
      if (typeof chunk === 'string') {
        responseBody = chunk.length > 1000 ? chunk.substring(0, 1000) + '...' : chunk;
        bodySize = Buffer.byteLength(chunk, encoding || 'utf8');
      }
    }

    // Common log data
    const logData = {
      requestId,
      method: req.method,
      url: req.url,
      urlPattern,
      status: res.statusCode,
      responseTime,
      ip,
      userAgent,
      referer: req.headers.referer || '-',
      contentLength: bodySize || parseInt(res.get('content-length') || '0'),
      timestamp: new Date().toISOString(),
      statusCategory: categorizeStatus(res.statusCode)
    };

    // Log to access logger (CLF-style)
    accessLogger.info('HTTP request processed', logData);

    // Log to event logger (application event)
    eventLogger.info('HTTP request processed', {
      eventType: 'http_request',
      action: `${req.method} ${urlPattern}`,
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      statusCategory: categorizeStatus(res.statusCode),
      userAgent: req.headers['user-agent'],
      ip,
      timestamp: new Date().toISOString()
    });

    // Log to performance logger (timing data only)
    performanceLogger.info('HTTP request timing', {
      operationType: 'http_request',
      operation: `${req.method} ${urlPattern}`,
      duration: responseTime,
      durationUnit: 'milliseconds',
      throughput: bodySize / Math.max(responseTime, 1) * 1000, // bytes per second
      throughputUnit: 'bytes_per_second',
      slowRequest: responseTime > 1000,
      requestId,
      timestamp: new Date().toISOString()
    });

    // Log to metrics logger (quantitative metrics)
    metricsLogger.info('HTTP request counter', {
      metricName: `http_requests_total`,
      metricType: 'counter',
      value: 1,
      unit: 'requests',
      labels: {
        method: req.method.toLowerCase(),
        status_code: res.statusCode.toString(),
        status_category: categorizeStatus(res.statusCode),
        endpoint: urlPattern
      },
      requestId,
      timestamp: new Date().toISOString()
    });

    // Log response time as a separate metric
    metricsLogger.info('HTTP response time', {
      metricName: 'http_request_duration',
      metricType: 'histogram',
      value: responseTime,
      unit: 'milliseconds',
      labels: {
        method: req.method.toLowerCase(),
        status_code: res.statusCode.toString(),
        endpoint: urlPattern
      },
      requestId,
      timestamp: new Date().toISOString()
    });

    // Log errors if status >= 400
    if (res.statusCode >= 400) {
      const errorLevel = res.statusCode >= 500 ? 'error' : 'warn';
      errorLogger[errorLevel]('HTTP error response', {
        ...logData,
        errorType: res.statusCode >= 500 ? 'server_error' : 'client_error',
        errorCode: `HTTP_${res.statusCode}`,
        responseBody: responseBody || 'No response body captured',
        severity: res.statusCode >= 500 ? 'high' : 'medium'
      });
    }

    // Call original end method
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Error handling middleware
export const errorLoggingMiddleware = (err, req, res, next) => {
  const requestId = req.requestId || 'unknown';
  const responseTime = req.startTime ? Date.now() - req.startTime : 0;

  // Log the error
  errorLogger.error('Unhandled error in request', {
    requestId,
    method: req.method,
    url: req.url,
    status: 500,
    responseTime,
    ip: getClientIP(req),
    userAgent: getUserAgent(req),
    errorType: 'unhandled_exception',
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: err.message,
    stack: err.stack,
    severity: 'high',
    timestamp: new Date().toISOString()
  });

  // Log error metrics
  metricsLogger.error('Server error occurred', {
    metricName: 'server_errors',
    value: 1,
    unit: 'count',
    tags: {
      method: req.method,
      url: req.url,
      errorType: err.name || 'Error'
    },
    aggregationType: 'sum',
    requestId,
    timestamp: new Date().toISOString()
  });

  // Set response status if not already set
  if (!res.statusCode || res.statusCode === 200) {
    res.statusCode = 500;
  }

  next(err);
};

// Business event logging helper
export const logBusinessEvent = (eventType, action, data = {}, req = null) => {
  const requestId = req?.requestId || 'system';
  const userId = data.userId || req?.userId || 'anonymous';

  // Log to event logger (business event)
  eventLogger.info('Business event occurred', {
    eventType: eventType || 'business',
    action,
    userId,
    requestId,
    component: 'business_logic',
    ...data.context,
    timestamp: new Date().toISOString()
  });

  // Log to metrics logger (quantitative business metrics)
  if (data.value && typeof data.value === 'number') {
    metricsLogger.info('Business metric', {
      metricName: `business_${eventType}_${action}`,
      metricType: 'counter',
      value: data.value,
      unit: data.unit || 'count',
      labels: {
        event_type: eventType || 'business',
        action,
        user_id: userId,
        ...data.labels
      },
      requestId,
      timestamp: new Date().toISOString()
    });
  }
};

// Performance timing helper
export const logPerformanceTiming = (name, duration, component = 'server', metadata = {}, req = null) => {
  const requestId = req?.requestId || 'system';

  // Log to performance logger (timing data only)
  performanceLogger.info('Performance timing measured', {
    operationType: 'custom_timing',
    operation: name,
    duration,
    durationUnit: 'milliseconds',
    component,
    requestId,
    ...metadata,
    timestamp: new Date().toISOString()
  });

  // Log to metrics logger (quantitative timing metric)
  metricsLogger.info('Performance timing metric', {
    metricName: `performance_duration_${name}`,
    metricType: 'histogram',
    value: duration,
    unit: 'milliseconds',
    labels: {
      operation: name,
      component,
      ...metadata.labels
    },
    requestId,
    timestamp: new Date().toISOString()
  });
};