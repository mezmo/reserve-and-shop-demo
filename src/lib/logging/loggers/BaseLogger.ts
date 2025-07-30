import { BaseFormatter } from '../formatters/BaseFormatter';
import { FormatRegistry } from '../FormatRegistry';
import { LogData, LogLevel, LoggerConfig } from '../config/LoggerConfig';

export abstract class BaseLogger {
  protected config: LoggerConfig;
  protected formatter: BaseFormatter;
  protected sessionId: string;
  private logBuffer: string[] = [];

  constructor(config: LoggerConfig, sessionId: string) {
    this.config = config;
    this.sessionId = sessionId;
    this.formatter = this.initializeFormatter();
  }

  private initializeFormatter(): BaseFormatter {
    const registry = FormatRegistry.getInstance();
    const formatter = registry.getFormatter(this.config.format);
    
    if (!formatter) {
      console.warn(`Formatter '${this.config.format}' not found, falling back to 'string'`);
      const fallback = registry.getFormatter('string');
      if (!fallback) {
        throw new Error('No fallback formatter available');
      }
      return fallback;
    }
    
    // Apply format-specific configuration
    if (this.config.formatOptions) {
      formatter.setConfig(this.config.formatOptions);
    }
    
    return formatter;
  }

  abstract getLoggerType(): string;

  log(level: LogLevel, message: string, data?: Record<string, any>): void {
    if (!this.config.enabled) return;
    if (!this.shouldLog(level)) return;

    const logData = this.createLogData(level, message, data);
    const formattedLog = this.formatter.format(logData);
    
    this.writeLog(formattedLog);
  }

  protected createLogData(level: LogLevel, message: string, data?: Record<string, any>): LogData {
    const baseData: LogData = {
      timestamp: new Date().toISOString(),
      level,
      message,
      sessionId: this.sessionId,
      ...data
    };

    return this.enrichLogData(baseData);
  }

  // Override in subclasses to add logger-specific enrichment
  protected enrichLogData(data: LogData): LogData {
    return data;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  private writeLog(formattedLog: string): void {
    // Enhanced console logging for better visibility
    console.log(`📝 ${this.getLoggerType()}: ${formattedLog}`);
    
    // Buffer the log for batch writing
    this.bufferLog(formattedLog);
  }

  private bufferLog(content: string): void {
    this.logBuffer.push(content);
    
    // Auto-flush buffer when it gets too large
    if (this.logBuffer.length >= 10) {
      this.flushBuffer();
    }
  }

  public flushBuffer(): void {
    if (this.logBuffer.length === 0) return;

    const content = this.logBuffer.join('\n') + '\n';
    this.logBuffer = [];

    try {
      // Store logs in localStorage for persistence and debugging
      this.storeInLocalStorage(content);
      
      // Try to write using navigator.sendBeacon for reliable delivery  
      this.sendToServer(content);
    } catch (error) {
      console.warn(`Could not flush ${this.getLoggerType()} log buffer:`, error);
    }
  }

  private storeInLocalStorage(content: string): void {
    try {
      const storageKey = `${this.getLoggerType()}-logs`;
      const existingLogs = localStorage.getItem(storageKey) || '[]';
      const logs = JSON.parse(existingLogs);
      
      logs.push({
        timestamp: new Date().toISOString(),
        content,
        session: this.sessionId,
        loggerType: this.getLoggerType()
      });
      
      // Keep only last 100 logs to prevent storage overflow
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      
      localStorage.setItem(storageKey, JSON.stringify(logs));
    } catch (error) {
      console.warn(`Could not store ${this.getLoggerType()} logs in localStorage:`, error);
    }
  }

  private sendToServer(content: string): void {
    if ('sendBeacon' in navigator) {
      const blob = new Blob([content], { type: 'text/plain' });
      const formData = new FormData();
      formData.append('logFile', blob, `${this.getLoggerType()}.log`);
      formData.append('filePath', this.config.destination);
      formData.append('loggerType', this.getLoggerType());
      
      navigator.sendBeacon('/api/log-beacon', formData);
    }
  }

  // Configuration management
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize formatter if format changed
    if (newConfig.format && newConfig.format !== this.formatter.getDisplayName().toLowerCase()) {
      this.formatter = this.initializeFormatter();
    }
    
    // Update formatter config if format options changed
    if (newConfig.formatOptions) {
      this.formatter.setConfig(newConfig.formatOptions);
    }
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  // Get stored logs from localStorage
  getStoredLogs(): any[] {
    try {
      const storageKey = `${this.getLoggerType()}-logs`;
      const logs = localStorage.getItem(storageKey);
      return logs ? JSON.parse(logs) : [];
    } catch {
      return [];
    }
  }

  // Clear stored logs
  clearStoredLogs(): void {
    try {
      const storageKey = `${this.getLoggerType()}-logs`;
      localStorage.removeItem(storageKey);
      console.log(`🧹 ${this.getLoggerType()} logs cleared from localStorage`);
    } catch (error) {
      console.error(`Error clearing ${this.getLoggerType()} logs:`, error);
    }
  }

  // Convenience methods for different log levels
  trace(message: string, data?: Record<string, any>): void {
    this.log('TRACE', message, data);
  }

  debug(message: string, data?: Record<string, any>): void {
    this.log('DEBUG', message, data);
  }

  info(message: string, data?: Record<string, any>): void {
    this.log('INFO', message, data);
  }

  warn(message: string, data?: Record<string, any>): void {
    this.log('WARN', message, data);
  }

  error(message: string, data?: Record<string, any>): void {
    this.log('ERROR', message, data);
  }

  fatal(message: string, data?: Record<string, any>): void {
    this.log('FATAL', message, data);
  }
}