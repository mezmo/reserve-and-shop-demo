import { LogData, LoggerType, FormatConfigOption, ValidationResult } from '../config/LoggerConfig';

export abstract class BaseFormatter {
  protected config: Record<string, any> = {};

  abstract format(data: LogData): string | Buffer;
  abstract getDisplayName(): string;
  abstract getFileExtension(): string;
  abstract supportsLoggerType(type: LoggerType): boolean;

  // Optional methods that can be overridden
  getConfigOptions(): FormatConfigOption[] {
    return [];
  }

  validate(data: LogData): ValidationResult {
    return { isValid: true, errors: [] };
  }

  setConfig(config: Record<string, any>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): Record<string, any> {
    return { ...this.config };
  }

  // Helper method for common timestamp formatting
  protected formatTimestamp(timestamp: string, format?: string): string {
    const date = new Date(timestamp);
    
    switch (format) {
      case 'iso':
        return date.toISOString();
      case 'epoch':
        return Math.floor(date.getTime() / 1000).toString();
      case 'clf':
        return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
      default:
        return timestamp;
    }
  }

  // Helper method for safe string escaping
  protected escapeString(str: string, escapeType: 'json' | 'csv' | 'xml' = 'json'): string {
    if (!str) return '';
    
    switch (escapeType) {
      case 'json':
        return str.replace(/\\/g, '\\\\')
                  .replace(/"/g, '\\"')
                  .replace(/\n/g, '\\n')
                  .replace(/\r/g, '\\r')
                  .replace(/\t/g, '\\t');
      case 'csv':
        return str.includes(',') || str.includes('"') || str.includes('\n') 
          ? `"${str.replace(/"/g, '""')}"` 
          : str;
      case 'xml':
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#39;');
      default:
        return str;
    }
  }

  // Helper method for template substitution
  protected substituteTemplate(template: string, data: LogData): string {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      const value = this.getNestedValue(data, key);
      return value !== undefined ? String(value) : match;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // Performance characteristics (can be overridden)
  getPerformanceCharacteristics(): {
    cpuUsage: 'low' | 'medium' | 'high';
    memoryUsage: 'low' | 'medium' | 'high';
    parseability: 'low' | 'medium' | 'high';
    compression: 'poor' | 'good' | 'excellent';
  } {
    return {
      cpuUsage: 'medium',
      memoryUsage: 'medium',
      parseability: 'medium',
      compression: 'good'
    };
  }
}