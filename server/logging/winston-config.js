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
  format: structuredFormat,
  defaultMeta: { service: 'access', loggerType: 'access' },
  transports: [
    new winston.transports.File({ filename: '/tmp/codeuser/access.log' }),
    new winston.transports.Console({ format: consoleFormat, level: 'info' })
  ],
});

export const eventLogger = winston.createLogger({
  level: 'debug',
  format: structuredFormat,
  defaultMeta: { service: 'events', loggerType: 'event' },
  transports: [
    new winston.transports.File({ filename: '/tmp/codeuser/events.log' }),
    new winston.transports.Console({ format: consoleFormat, level: 'info' })
  ],
});

export const metricsLogger = winston.createLogger({
  level: 'info',
  format: structuredFormat,
  defaultMeta: { service: 'metrics', loggerType: 'metrics' },
  transports: [
    new winston.transports.File({ filename: '/tmp/codeuser/metrics.log' }),
    new winston.transports.Console({ format: consoleFormat, level: 'warn' })
  ],
});

export const errorLogger = winston.createLogger({
  level: 'warn',
  format: structuredFormat,
  defaultMeta: { service: 'errors', loggerType: 'error' },
  transports: [
    new winston.transports.File({ filename: '/tmp/codeuser/errors.log' }),
    new winston.transports.Console({ format: consoleFormat, level: 'error' })
  ],
});

// Performance logger (combines access, metrics, and events)
export const performanceLogger = winston.createLogger({
  level: 'info',
  format: structuredFormat,
  defaultMeta: { service: 'performance', loggerType: 'performance' },
  transports: [
    new winston.transports.File({ filename: '/tmp/codeuser/performance.log' }),
    new winston.transports.Console({ format: consoleFormat, level: 'info' })
  ],
});

// Application logger (general purpose)
export const appLogger = winston.createLogger({
  level: 'info',
  format: structuredFormat,
  defaultMeta: { service: 'app', loggerType: 'app' },
  transports: [
    new winston.transports.File({ filename: '/tmp/codeuser/app.log' }),
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

// Export a default logger for general use
export default appLogger;