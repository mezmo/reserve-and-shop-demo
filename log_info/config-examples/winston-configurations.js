/**
 * Winston Configuration Examples
 * Complete configuration examples for all log formats supported by the restaurant application
 */

const winston = require('winston');
const fs = require('fs');
const path = require('path');

// ===== BASIC CONFIGURATIONS =====

/**
 * JSON Format Configuration
 * Best for: Structured analysis, machine processing, correlation
 */
const jsonLoggerConfig = {
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'restaurant-app', 
    loggerType: 'json',
    version: '1.0.0'
  },
  transports: [
    new winston.transports.File({ 
      filename: '/tmp/codeuser/json-format.log',
      level: 'info'
    }),
    new winston.transports.Console({ 
      level: 'error',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
};

/**
 * Common Log Format (CLF) Configuration
 * Best for: Access logs, web server compatibility, log aggregation
 */
const clfLoggerConfig = {
  level: 'info',
  format: winston.format.printf(({ message, ip, method, url, status, contentLength, userAgent, referer, timestamp, responseTime }) => {
    // Standard CLF: host ident authuser [timestamp] "method url protocol" status size
    const host = ip || '-';
    const ident = '-';
    const authuser = '-'; // Could be extracted from request context
    const timestampFormatted = new Date(timestamp).toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const httpRequest = `"${method || 'GET'} ${url || '/'} HTTP/1.1"`;
    const statusCode = status || 200;
    const size = contentLength || '-';
    
    // Extended format includes referer, user-agent, and response time
    const extended = referer && userAgent && responseTime;
    if (extended) {
      return `${host} ${ident} ${authuser} [${timestampFormatted}] ${httpRequest} ${statusCode} ${size} "${referer}" "${userAgent}" ${responseTime}ms`;
    }
    
    return `${host} ${ident} ${authuser} [${timestampFormatted}] ${httpRequest} ${statusCode} ${size}`;
  }),
  defaultMeta: { 
    service: 'restaurant-app-access',
    loggerType: 'clf'
  },
  transports: [
    new winston.transports.File({ 
      filename: '/tmp/codeuser/access.log'
    })
  ]
};

/**
 * String Format Configuration
 * Best for: Human debugging, development environments
 */
const stringLoggerConfig = {
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let output = `${timestamp} [${level.toUpperCase()}] ${message}`;
      if (Object.keys(meta).length > 0) {
        output += ` ${JSON.stringify(meta)}`;
      }
      return output;
    })
  ),
  defaultMeta: { 
    service: 'restaurant-app',
    loggerType: 'string'
  },
  transports: [
    new winston.transports.File({ 
      filename: '/tmp/codeuser/string-format.log'
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
};

/**
 * CSV Format Configuration  
 * Best for: Spreadsheet analysis, data import, statistical analysis
 */
const csvLoggerConfig = {
  level: 'info',
  format: winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const csvSafeString = (str) => `"${String(str).replace(/"/g, '""')}"`;
    return `${csvSafeString(timestamp)},${csvSafeString(level)},${csvSafeString(message)},${csvSafeString(JSON.stringify(meta))}`;
  }),
  defaultMeta: { 
    service: 'restaurant-app',
    loggerType: 'csv'
  },
  transports: [
    new winston.transports.File({ 
      filename: '/tmp/codeuser/csv-format.log'
    })
  ]
};

/**
 * XML Format Configuration
 * Best for: Enterprise systems, SOAP integration
 */
const xmlLoggerConfig = {
  level: 'info',
  format: winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const xmlEscape = (str) => String(str).replace(/[<>&'"]/g, (c) => ({ 
      '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' 
    }[c]));
    
    return `<log><timestamp>${xmlEscape(timestamp)}</timestamp><level>${xmlEscape(level)}</level><message>${xmlEscape(message)}</message><meta>${xmlEscape(JSON.stringify(meta))}</meta></log>`;
  }),
  defaultMeta: { 
    service: 'restaurant-app',
    loggerType: 'xml'
  },
  transports: [
    new winston.transports.File({ 
      filename: '/tmp/codeuser/xml-format.log'
    })
  ]
};

// ===== ADVANCED CONFIGURATIONS =====

/**
 * Multi-Format Logger Configuration
 * Logs to different formats simultaneously based on log level and content
 */
const multiFormatLoggerConfig = {
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  defaultMeta: { 
    service: 'restaurant-app',
    loggerType: 'multi-format'
  },
  transports: [
    // JSON format for structured analysis
    new winston.transports.File({
      filename: '/tmp/codeuser/structured.log',
      level: 'info',
      format: winston.format.json()
    }),
    
    // CLF format for access logs only
    new winston.transports.File({
      filename: '/tmp/codeuser/access-multi.log',
      level: 'info',
      format: winston.format.printf(({ timestamp, level, message, method, url, status, ip }) => {
        if (method && url && status) {
          // This is an access log entry
          const host = ip || '-';
          const timestampFormatted = new Date(timestamp).toISOString().replace(/T/, ' ').replace(/\..+/, '');
          return `${host} - - [${timestampFormatted}] "${method} ${url} HTTP/1.1" ${status} -`;
        }
        // Skip non-access log entries for CLF file
        return null;
      })
    }),
    
    // String format for errors and warnings
    new winston.transports.File({
      filename: '/tmp/codeuser/errors-multi.log',
      level: 'warn',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
          let output = `${timestamp} [${level.toUpperCase()}] ${message}`;
          if (stack) output += `\nStack: ${stack}`;
          if (Object.keys(meta).length > 0) output += `\nMeta: ${JSON.stringify(meta, null, 2)}`;
          return output;
        })
      )
    }),
    
    // Console output for development
    new winston.transports.Console({
      level: 'debug',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} ${level}: ${message}`;
        })
      )
    })
  ]
};

/**
 * Performance-Optimized Configuration
 * Optimized for high-volume logging scenarios
 */
const performanceLoggerConfig = {
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'restaurant-app',
    loggerType: 'performance'
  },
  transports: [
    new winston.transports.File({
      filename: '/tmp/codeuser/performance.log',
      
      // Performance optimizations
      options: {
        flags: 'a',           // Append mode
        highWaterMark: 16384  // 16KB buffer
      },
      
      // Larger buffer for batch writes
      handleExceptions: false,  // Don't handle exceptions for performance
      maxsize: 100 * 1024 * 1024, // 100MB max file size
      maxFiles: 5,              // Keep 5 rotated files
      
      // Custom formatting for minimal overhead
      format: winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `${timestamp}|${level}|${message}|${JSON.stringify(meta)}`;
      })
    })
  ]
};

/**
 * Correlation-Aware Logger Configuration
 * Automatically includes correlation IDs for distributed tracing
 */
const correlationLoggerConfig = {
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, correlationId, traceId, spanId, ...meta }) => {
      const correlation = {
        correlationId: correlationId || 'none',
        traceId: traceId || 'none',
        spanId: spanId || 'none'
      };
      
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...correlation,
        ...meta
      });
    })
  ),
  defaultMeta: function() {
    // Dynamic metadata that includes correlation context
    const asyncLocalStorage = require('async_hooks').AsyncLocalStorage;
    const context = asyncLocalStorage.getStore?.();
    
    return {
      service: 'restaurant-app',
      loggerType: 'correlation',
      correlationId: context?.get?.('correlationId'),
      traceId: context?.get?.('traceId'),
      spanId: context?.get?.('spanId'),
      requestId: context?.get?.('requestId')
    };
  }(),
  transports: [
    new winston.transports.File({ 
      filename: '/tmp/codeuser/correlated.log'
    }),
    new winston.transports.Console({
      level: 'warn',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
};

// ===== SPECIALIZED LOGGER CONFIGURATIONS =====

/**
 * Access Logger Configuration
 * Specialized for HTTP request/response logging
 */
const accessLoggerConfig = {
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, message, method, url, status, responseTime, ip, userAgent, contentLength }) => {
      // Enhanced CLF with additional fields
      const host = ip || '-';
      const ident = '-';
      const authuser = '-';
      const timestampFormatted = new Date(timestamp).toISOString().replace(/T/, ' ').replace(/\..+/, '');
      const httpRequest = `"${method || 'GET'} ${url || '/'} HTTP/1.1"`;
      const statusCode = status || 200;
      const size = contentLength || '-';
      const referer = '"-"'; // Could be extracted from request
      const agent = userAgent ? `"${userAgent}"` : '"-"';
      const duration = responseTime || '-';
      
      return `${host} ${ident} ${authuser} [${timestampFormatted}] ${httpRequest} ${statusCode} ${size} ${referer} ${agent} ${duration}ms`;
    })
  ),
  defaultMeta: { 
    service: 'restaurant-app-access',
    loggerType: 'access'
  },
  transports: [
    new winston.transports.File({ 
      filename: '/tmp/codeuser/access-specialized.log'
    }),
    // Real-time monitoring console output for errors
    new winston.transports.Console({
      level: 'error',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, method, url, status, responseTime }) => {
          return `🚨 ${method} ${url} → ${status} (${responseTime}ms)`;
        })
      )
    })
  ]
};

/**
 * Business Events Logger Configuration  
 * For tracking business-critical events with enhanced metadata
 */
const businessEventsLoggerConfig = {
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf((info) => {
      // Enhanced business event format
      const businessEvent = {
        timestamp: info.timestamp,
        eventType: info.eventType || 'business',
        action: info.action,
        level: info.level,
        service: info.service || 'restaurant-app',
        
        // Business context
        userId: info.userId,
        sessionId: info.sessionId,
        orderId: info.orderId,
        productId: info.productId,
        
        // Financial data
        amount: info.amount,
        currency: info.currency || 'USD',
        
        // Correlation
        correlationId: info.correlationId,
        traceId: info.traceId,
        
        // Event-specific data
        eventData: info.eventData || {},
        
        // Metrics
        duration: info.duration,
        count: info.count || 1,
        
        message: info.message
      };
      
      // Remove null/undefined values
      Object.keys(businessEvent).forEach(key => {
        if (businessEvent[key] === undefined || businessEvent[key] === null) {
          delete businessEvent[key];
        }
      });
      
      return JSON.stringify(businessEvent);
    })
  ),
  defaultMeta: { 
    service: 'restaurant-app',
    loggerType: 'business-events'
  },
  transports: [
    new winston.transports.File({ 
      filename: '/tmp/codeuser/business-events.log'
    }),
    // High-value events to console
    new winston.transports.Console({
      level: 'info',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ eventType, action, amount, currency, message }) => {
          if (amount) {
            return `💰 ${eventType}.${action}: ${currency} ${amount} - ${message}`;
          }
          return `📊 ${eventType}.${action} - ${message}`;
        })
      ),
      // Only log high-value business events to console
      filter: winston.format((info) => {
        const highValueEvents = ['order_created', 'payment_processed', 'reservation_created'];
        return highValueEvents.includes(`${info.eventType}_${info.action}`) ? info : false;
      })()
    })
  ]
};

/**
 * Error Logger Configuration
 * Specialized for error tracking and alerting
 */
const errorLoggerConfig = {
  level: 'warn',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, errorCode, severity, context, correlationId, ...meta }) => {
      const errorEntry = {
        timestamp,
        level,
        message,
        errorCode: errorCode || 'UNKNOWN_ERROR',
        severity: severity || 'medium',
        
        // Error context
        context: context || 'application',
        service: 'restaurant-app',
        
        // Correlation
        correlationId,
        
        // Stack trace (formatted for readability)
        stack: stack ? stack.split('\n').map(line => line.trim()) : undefined,
        
        // Additional metadata
        metadata: Object.keys(meta).length > 0 ? meta : undefined
      };
      
      return JSON.stringify(errorEntry, null, 2);
    })
  ),
  defaultMeta: { 
    service: 'restaurant-app',
    loggerType: 'error'
  },
  transports: [
    new winston.transports.File({ 
      filename: '/tmp/codeuser/errors-specialized.log'
    }),
    
    // Critical errors to separate file
    new winston.transports.File({
      filename: '/tmp/codeuser/critical-errors.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    
    // Real-time console alerts
    new winston.transports.Console({
      level: 'error',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, message, errorCode, severity, correlationId }) => {
          const severityEmoji = {
            low: '⚠️',
            medium: '🚨', 
            high: '🔥',
            critical: '💥'
          };
          
          return `${severityEmoji[severity] || '⚠️'} [${errorCode}] ${message} (${correlationId})`;
        })
      )
    })
  ],
  
  // Exception handling
  handleExceptions: true,
  handleRejections: true,
  exitOnError: false
};

// ===== DYNAMIC CONFIGURATION EXAMPLES =====

/**
 * Environment-Based Configuration Factory
 */
function createEnvironmentConfig(env = 'development') {
  const baseConfig = {
    level: env === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true })
    ),
    defaultMeta: {
      service: 'restaurant-app',
      environment: env,
      version: process.env.APP_VERSION || '1.0.0'
    }
  };
  
  switch (env) {
    case 'production':
      return {
        ...baseConfig,
        format: winston.format.combine(
          baseConfig.format,
          winston.format.json()
        ),
        transports: [
          new winston.transports.File({
            filename: '/tmp/codeuser/production.log',
            level: 'info',
            maxsize: 50 * 1024 * 1024, // 50MB
            maxFiles: 10
          }),
          new winston.transports.File({
            filename: '/tmp/codeuser/production-errors.log',
            level: 'error'
          })
        ]
      };
      
    case 'staging':
      return {
        ...baseConfig,
        format: winston.format.combine(
          baseConfig.format,
          winston.format.json()
        ),
        transports: [
          new winston.transports.File({
            filename: '/tmp/codeuser/staging.log',
            level: 'debug'
          }),
          new winston.transports.Console({
            level: 'info',
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            )
          })
        ]
      };
      
    case 'development':
    default:
      return {
        ...baseConfig,
        level: 'debug',
        format: winston.format.combine(
          baseConfig.format,
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            let output = `${timestamp} [${level.toUpperCase()}] ${message}`;
            if (Object.keys(meta).length > 0) {
              output += `\n${JSON.stringify(meta, null, 2)}`;
            }
            return output;
          })
        ),
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            )
          }),
          new winston.transports.File({
            filename: '/tmp/codeuser/development.log'
          })
        ]
      };
  }
}

/**
 * Runtime Format Switching Configuration
 */
class DynamicFormatLogger {
  constructor() {
    this.currentFormat = 'json';
    this.formats = {
      json: winston.format.json(),
      string: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}] ${message} ${JSON.stringify(meta)}`;
        })
      ),
      clf: winston.format.printf(({ timestamp, ip, method, url, status, contentLength }) => {
        const host = ip || '-';
        const timestampFormatted = new Date(timestamp).toISOString().replace(/T/, ' ').replace(/\..+/, '');
        return `${host} - - [${timestampFormatted}] "${method} ${url} HTTP/1.1" ${status} ${contentLength || '-'}`;
      })
    };
    
    this.logger = winston.createLogger({
      level: 'info',
      format: this.formats[this.currentFormat],
      defaultMeta: { service: 'restaurant-app' },
      transports: [
        new winston.transports.File({
          filename: '/tmp/codeuser/dynamic-format.log'
        })
      ]
    });
  }
  
  switchFormat(newFormat) {
    if (this.formats[newFormat]) {
      this.currentFormat = newFormat;
      
      // Update all transports with new format
      this.logger.transports.forEach(transport => {
        transport.format = this.formats[newFormat];
      });
      
      this.logger.info('Format switched', { 
        newFormat, 
        timestamp: new Date().toISOString() 
      });
    } else {
      this.logger.error('Invalid format requested', { 
        requestedFormat: newFormat,
        availableFormats: Object.keys(this.formats)
      });
    }
  }
  
  getCurrentFormat() {
    return this.currentFormat;
  }
  
  // Proxy logger methods
  info(message, meta) { this.logger.info(message, meta); }
  warn(message, meta) { this.logger.warn(message, meta); }
  error(message, meta) { this.logger.error(message, meta); }
  debug(message, meta) { this.logger.debug(message, meta); }
}

// ===== USAGE EXAMPLES =====

// Export all configurations for use in the application
module.exports = {
  // Basic configurations
  jsonLoggerConfig,
  clfLoggerConfig,
  stringLoggerConfig,
  csvLoggerConfig,
  xmlLoggerConfig,
  
  // Advanced configurations
  multiFormatLoggerConfig,
  performanceLoggerConfig,
  correlationLoggerConfig,
  
  // Specialized configurations
  accessLoggerConfig,
  businessEventsLoggerConfig,
  errorLoggerConfig,
  
  // Dynamic configurations
  createEnvironmentConfig,
  DynamicFormatLogger,
  
  // Factory functions
  createLogger: (config) => winston.createLogger(config),
  createDynamicLogger: () => new DynamicFormatLogger(),
  
  // Utility functions
  ensureLogDirectories: () => {
    const logDir = '/tmp/codeuser';
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }
};

// Example usage:
/*
const { createEnvironmentConfig, DynamicFormatLogger, ensureLogDirectories } = require('./winston-configurations');

// Ensure log directories exist
ensureLogDirectories();

// Create environment-specific logger
const productionLogger = winston.createLogger(createEnvironmentConfig('production'));

// Create dynamic format logger
const dynamicLogger = new DynamicFormatLogger();

// Log some events
productionLogger.info('Application started', { port: 3001 });
dynamicLogger.info('Dynamic logger initialized');

// Switch formats at runtime
dynamicLogger.switchFormat('clf');
dynamicLogger.info('Format switched to CLF');

// Switch back to JSON
dynamicLogger.switchFormat('json');
dynamicLogger.info('Format switched back to JSON');
*/