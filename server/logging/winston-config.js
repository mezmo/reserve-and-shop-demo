import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Ensure log directories exist
const ensureLogDirectories = () => {
  const logDirs = ['/tmp/codeuser'];
  logDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

ensureLogDirectories();

// Custom log format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Format factory - creates formats based on type
const createFormat = (formatType) => {
  switch (formatType) {
    case 'json':
      return winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      );
      
    case 'clf':
      return winston.format.printf(({ message, ip, method, url, status, contentLength, userAgent, referer, timestamp, ...meta }) => {
        // CLF Format: host ident authuser [timestamp] "method url protocol" status size "referer" "user-agent"
        const host = ip || '-';
        const ident = '-';
        const authuser = meta.userId || '-';
        const timestampFormatted = new Date(timestamp).toISOString().replace(/T/, ' ').replace(/\..+/, '');
        const httpRequest = `"${method || 'GET'} ${url || '/'} HTTP/1.1"`;
        const statusCode = status || 200;
        const size = contentLength || 0;
        const refererField = referer ? `"${referer}"` : '"-"';
        const userAgentField = userAgent ? `"${userAgent}"` : '"-"';
        
        return `${host} ${ident} ${authuser} [${timestampFormatted}] ${httpRequest} ${statusCode} ${size} ${refererField} ${userAgentField}`;
      });
      
    case 'string':
      return winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let output = `${timestamp} [${level}] ${message}`;
          if (Object.keys(meta).length > 0) {
            output += ` ${JSON.stringify(meta)}`;
          }
          return output;
        })
      );
      
    case 'csv':
      return winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const csvSafeString = (str) => `"${String(str).replace(/"/g, '""')}"`;
        return `${csvSafeString(timestamp)},${csvSafeString(level)},${csvSafeString(message)},${csvSafeString(JSON.stringify(meta))}`;
      });
      
    case 'xml':
      return winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const xmlEscape = (str) => String(str).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
        return `<log><timestamp>${xmlEscape(timestamp)}</timestamp><level>${xmlEscape(level)}</level><message>${xmlEscape(message)}</message><meta>${xmlEscape(JSON.stringify(meta))}</meta></log>`;
      });
      
    default:
      return structuredFormat; // Default to JSON
  }
};

// Store current format configurations
const formatConfigs = {
  access: 'clf',
  event: 'json',
  metrics: 'json',
  error: 'json',
  performance: 'json',
  app: 'json'
};

// Human readable format for console
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let output = `${timestamp} [${level}] ${message}`;
    if (Object.keys(meta).length > 0) {
      output += ` ${JSON.stringify(meta)}`;
    }
    return output;
  })
);

// Create separate loggers for different types
export const accessLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  defaultMeta: { service: 'access', loggerType: 'access' },
  transports: [
    new winston.transports.File({ 
      filename: '/tmp/codeuser/access.log',
      format: createFormat(formatConfigs.access)
    }),
    new winston.transports.Console({ 
      format: consoleFormat, 
      level: 'info' 
    })
  ],
});

export const eventLogger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  defaultMeta: { service: 'events', loggerType: 'event' },
  transports: [
    new winston.transports.File({ 
      filename: '/tmp/codeuser/events.log',
      format: createFormat(formatConfigs.event)
    }),
    new winston.transports.Console({ format: consoleFormat, level: 'info' })
  ],
});

export const metricsLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  defaultMeta: { service: 'metrics', loggerType: 'metrics' },
  transports: [
    new winston.transports.File({ 
      filename: '/tmp/codeuser/metrics.log',
      format: createFormat(formatConfigs.metrics)
    }),
    new winston.transports.Console({ format: consoleFormat, level: 'warn' })
  ],
});

export const errorLogger = winston.createLogger({
  level: 'warn',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  defaultMeta: { service: 'errors', loggerType: 'error' },
  transports: [
    new winston.transports.File({ 
      filename: '/tmp/codeuser/errors.log',
      format: createFormat(formatConfigs.error)
    }),
    new winston.transports.Console({ format: consoleFormat, level: 'error' })
  ],
});

export const performanceLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  defaultMeta: { service: 'performance', loggerType: 'performance' },
  transports: [
    new winston.transports.File({ 
      filename: '/tmp/codeuser/performance.log',
      format: createFormat(formatConfigs.performance)
    }),
    new winston.transports.Console({ format: consoleFormat, level: 'info' })
  ],
});

export const appLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  defaultMeta: { service: 'app', loggerType: 'app' },
  transports: [
    new winston.transports.File({ 
      filename: '/tmp/codeuser/app.log',
      format: createFormat(formatConfigs.app)
    }),
    new winston.transports.Console({ format: consoleFormat })
  ],
});

// Server operational logger (separate from application logic)
export const serverLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'server', loggerType: 'server' },
  transports: [
    new winston.transports.File({ filename: '/tmp/codeuser/server-winston.log' }),
    new winston.transports.Console({ format: consoleFormat })
  ],
});

// Function to update log levels dynamically
export const updateLogLevel = (loggerName, level) => {
  const loggers = {
    access: accessLogger,
    event: eventLogger,
    metrics: metricsLogger,
    error: errorLogger,
    performance: performanceLogger,
    app: appLogger
  };

  const logger = loggers[loggerName];
  if (logger) {
    logger.level = level;
    logger.transports.forEach(transport => {
      if (transport.level !== undefined) {
        transport.level = level;
      }
    });
    appLogger.info('Log level updated', { loggerName, level });
  }
};

// Function to update log formats dynamically
export const updateLogFormat = (loggerName, format) => {
  const loggers = {
    access: accessLogger,
    event: eventLogger,
    metrics: metricsLogger,
    error: errorLogger,
    performance: performanceLogger,
    app: appLogger
  };

  const logger = loggers[loggerName];
  if (logger && formatConfigs[loggerName] !== undefined) {
    // Update the format config
    formatConfigs[loggerName] = format;
    
    // Update the file transport format (first transport is always file)
    const fileTransport = logger.transports.find(t => t.filename);
    if (fileTransport) {
      fileTransport.format = createFormat(format);
    }
    
    appLogger.info('Log format updated', { loggerName, format });
  }
};

// Function to get current log levels
export const getLogLevels = () => {
  return {
    access: accessLogger.level,
    event: eventLogger.level,
    metrics: metricsLogger.level,
    error: errorLogger.level,
    performance: performanceLogger.level,
    app: appLogger.level
  };
};

// Function to get current log formats
export const getLogFormats = () => {
  return { ...formatConfigs };
};

// Export a default logger for general use
export default appLogger;