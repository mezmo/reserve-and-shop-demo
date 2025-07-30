// Main PerformanceManager - Primary interface for the logging system
export { PerformanceManager } from './PerformanceManager';
export type { PerformanceManagerConfig } from './PerformanceManager';

// Logger classes - For direct usage if needed
export { AccessLogger } from './loggers/AccessLogger';
export { EventLogger } from './loggers/EventLogger';
export { MetricsLogger } from './loggers/MetricsLogger';
export { ErrorLogger } from './loggers/ErrorLogger';
export { BaseLogger } from './loggers/BaseLogger';

// Formatter classes and registry
export { BaseFormatter } from './formatters/BaseFormatter';
export { FormatRegistry } from './FormatRegistry';
export { JSONFormatter } from './formatters/JSONFormatter';
export { CLFFormatter } from './formatters/CLFFormatter';
export { StringFormatter } from './formatters/StringFormatter';
export { CSVFormatter } from './formatters/CSVFormatter';
export { XMLFormatter } from './formatters/XMLFormatter';
export { CustomFormatter } from './formatters/CustomFormatter';

// Configuration types and interfaces
export type {
  LogLevel,
  LogFormat,
  LoggerType,
  LoggerConfig,
  LogData,
  AccessLogData,
  EventLogData,
  MetricsLogData,
  ErrorLogData,
  FormatConfigOption,
  ValidationResult,
  PerformanceCharacteristics
} from './config/LoggerConfig';

// Convenience function to get a configured PerformanceManager instance
export function createPerformanceManager(config?: {
  sessionId?: string;
  logLevel?: LogLevel;
  enableAll?: boolean;
  formats?: {
    access?: LogFormat;
    event?: LogFormat;
    metrics?: LogFormat;
    error?: LogFormat;
  };
}) {
  const sessionId = config?.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const defaultLevel = config?.logLevel || 'INFO';
  const enabled = config?.enableAll !== false;

  return PerformanceManager.getInstance({
    sessionId,
    defaultLogLevel: defaultLevel,
    loggers: {
      access: {
        level: defaultLevel,
        format: config?.formats?.access || 'clf',
        enabled
      },
      event: {
        level: defaultLevel,
        format: config?.formats?.event || 'json',
        enabled
      },
      metrics: {
        level: defaultLevel,
        format: config?.formats?.metrics || 'json',
        enabled
      },
      error: {
        level: config?.logLevel === 'DEBUG' ? 'DEBUG' : 'WARN',
        format: config?.formats?.error || 'json',
        enabled
      }
    }
  });
}

// Convenience function to get format registry
export function getFormatRegistry() {
  return FormatRegistry.getInstance();
}

// Available log levels in order
export const LOG_LEVELS: LogLevel[] = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

// Available formats
export const LOG_FORMATS: LogFormat[] = ['json', 'clf', 'string', 'csv', 'xml', 'custom'];

// Available logger types
export const LOGGER_TYPES: LoggerType[] = ['access', 'event', 'metrics', 'error'];

// Quick start example for documentation
export const QUICK_START_EXAMPLE = `
import { createPerformanceManager } from '@/lib/logging';

// Initialize the performance manager
const perf = createPerformanceManager({
  logLevel: 'INFO',
  formats: {
    access: 'clf',
    event: 'json',
    metrics: 'json',
    error: 'json'
  }
});

// Log different types of events
perf.logUserAction('click', 'button', 'user123', { buttonId: 'submit' });
perf.logHttpRequest('GET', '/api/users', 200, 150);
perf.logError(new Error('Something went wrong'), { component: 'user-service' });

// Start and end timers
const timerId = perf.startTimer('database_query');
// ... do work ...
const duration = perf.endTimer(timerId, { query: 'SELECT * FROM users' });

// Get analytics
const analytics = perf.getAnalytics();
console.log('Error rate:', analytics.errors.totalErrors);
console.log('Average response time:', analytics.access.avgResponseTime);
`;