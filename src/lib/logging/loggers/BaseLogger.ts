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
      // Send logs to server instead of localStorage
      this.sendToServerLog(content);
      
      // Also try sendBeacon for reliability (backup method)
      this.sendToServer(content);
    } catch (error) {
      console.warn(`Could not flush ${this.getLoggerType()} log buffer:`, error);
    }
  }

  private sendToServerLog(content: string): void {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        content,
        session: this.sessionId,
        loggerType: this.getLoggerType(),
        type: this.getLoggerType()
      };
      
      // Send to appropriate server endpoint based on logger type
      const endpoint = this.getLoggerType() === 'event' ? 'events' : this.getLoggerType();
      
      fetch(`${window.location.origin.replace(':8080', ':3001')}/api/logs/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      }).catch(error => {
        console.warn(`Could not send ${this.getLoggerType()} log to server:`, error);
      });
    } catch (error) {
      console.warn(`Error preparing ${this.getLoggerType()} log for server:`, error);
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

  // Get stored logs from server
  async getStoredLogs(): Promise<any[]> {
    try {
      const endpoint = this.getLoggerType() === 'event' ? 'events' : this.getLoggerType();
      const response = await fetch(`${window.location.origin.replace(':8080', ':3001')}/api/logs/recent/${endpoint}`);
      
      if (response.ok) {
        const result = await response.json();
        return result.success ? result.logs : [];
      }
    } catch (error) {
      console.error(`Error fetching ${this.getLoggerType()} logs from server:`, error);
    }
    return [];
  }

  // Clear stored logs (server memory buffer only)
  async clearStoredLogs(): Promise<void> {
    try {
      console.log(`🧹 ${this.getLoggerType()} logs clear requested (server-side memory buffer only)`);
      // Server doesn't implement clear functionality yet, but logs are rotated automatically
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