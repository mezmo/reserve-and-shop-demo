export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
export type LogFormat = 'json' | 'clf' | 'string' | 'csv' | 'xml' | 'custom';
export type LoggerType = 'access' | 'event' | 'metrics' | 'error' | 'trace';

export interface FormatConfigOption {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  options?: string[];
  defaultValue: any;
  description?: string;
}

export interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  format: LogFormat;
  destination: string;
  customTemplate?: string;
  formatOptions?: Record<string, any>;
}

export interface PerformanceConfig {
  enabled: boolean;
  sessionTracking: boolean;
  loggers: {
    access: LoggerConfig;
    event: LoggerConfig;
    metrics: LoggerConfig;
    error: LoggerConfig;
    trace: LoggerConfig;
  };
}

export interface LogData {
  timestamp: string;
  level: LogLevel;
  message: string;
  sessionId?: string;
  [key: string]: any;
}

export interface AccessLogData extends LogData {
  method: string;
  url: string;
  status: number;
  duration: number;
  ip: string;
  userAgent?: string;
  size?: number;
}

export interface EventLogData extends LogData {
  event: string;
  userId?: string;
  details?: Record<string, any>;
}

export interface MetricsLogData extends LogData {
  metric: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
}

export interface ErrorLogData extends LogData {
  error: string;
  stack?: string;
  context?: string;
  httpStatus?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}