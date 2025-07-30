import { BaseFormatter } from './BaseFormatter';
import { LogData, LoggerType, FormatConfigOption, ValidationResult } from '../config/LoggerConfig';

export class CustomFormatter extends BaseFormatter {
  format(data: LogData): string {
    const template = this.config.template || '{timestamp} - {level} - {message}';
    
    // Handle different template types
    switch (this.config.templateType) {
      case 'mustache':
        return this.formatMustacheTemplate(template, data);
      case 'simple':
      default:
        return this.substituteTemplate(template, data);
    }
  }

  private formatMustacheTemplate(template: string, data: LogData): string {
    // Simple mustache-like templating
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      
      // Handle special functions
      if (trimmedKey.startsWith('#if ')) {
        const field = trimmedKey.substring(4);
        const value = this.getNestedValue(data, field);
        return value ? '' : match; // Return empty for true conditions, original for false
      }
      
      if (trimmedKey.startsWith('#unless ')) {
        const field = trimmedKey.substring(8);
        const value = this.getNestedValue(data, field);
        return !value ? '' : match;
      }
      
      // Handle formatters
      if (trimmedKey.includes('|')) {
        const [field, formatter] = trimmedKey.split('|').map(s => s.trim());
        const value = this.getNestedValue(data, field);
        return this.applyFormatter(value, formatter);
      }
      
      // Regular substitution
      const value = this.getNestedValue(data, trimmedKey);
      return value !== undefined ? String(value) : match;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private applyFormatter(value: any, formatter: string): string {
    if (value === undefined || value === null) return '';
    
    switch (formatter.toLowerCase()) {
      case 'upper':
        return String(value).toUpperCase();
      case 'lower':
        return String(value).toLowerCase();
      case 'date':
        return new Date(value).toISOString();
      case 'localdate':
        return new Date(value).toLocaleString();
      case 'json':
        return JSON.stringify(value);
      case 'truncate':
        const str = String(value);
        return str.length > 50 ? str.substring(0, 47) + '...' : str;
      default:
        return String(value);
    }
  }

  validate(data: LogData): ValidationResult {
    const errors: string[] = [];
    const template = this.config.template;
    
    if (!template) {
      errors.push('Template is required for custom formatter');
      return { isValid: false, errors };
    }
    
    // Check for valid template syntax
    try {
      this.substituteTemplate(template, data);
    } catch (error) {
      errors.push(`Template syntax error: ${error.message}`);
    }
    
    // Check for unresolved placeholders
    const unresolvedPlaceholders = this.findUnresolvedPlaceholders(template, data);
    if (unresolvedPlaceholders.length > 0) {
      errors.push(`Unresolved placeholders: ${unresolvedPlaceholders.join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private findUnresolvedPlaceholders(template: string, data: LogData): string[] {
    const placeholderRegex = /\{([^}]+)\}/g;
    const unresolved: string[] = [];
    let match;
    
    while ((match = placeholderRegex.exec(template)) !== null) {
      const placeholder = match[1];
      const value = this.getNestedValue(data, placeholder);
      
      if (value === undefined) {
        unresolved.push(placeholder);
      }
    }
    
    return unresolved;
  }

  getDisplayName(): string {
    return 'Custom Template';
  }

  getFileExtension(): string {
    return this.config.fileExtension || '.log';
  }

  supportsLoggerType(type: LoggerType): boolean {
    // Custom formatter supports all logger types
    return true;
  }

  getConfigOptions(): FormatConfigOption[] {
    return [
      {
        key: 'template',
        label: 'Template',
        type: 'string',
        defaultValue: '{timestamp} - {level} - {message}',
        description: 'Custom template using {fieldName} placeholders'
      },
      {
        key: 'templateType',
        label: 'Template Type',
        type: 'select',
        options: ['simple', 'mustache'],
        defaultValue: 'simple',
        description: 'Template engine to use (simple = {field}, mustache = {{field}})'
      },
      {
        key: 'fileExtension',
        label: 'File Extension',
        type: 'string',
        defaultValue: '.log',
        description: 'File extension for log files using this format'
      }
    ];
  }

  getPerformanceCharacteristics() {
    return {
      cpuUsage: this.config.templateType === 'mustache' ? 'high' as const : 'medium' as const,
      memoryUsage: 'medium' as const,
      parseability: 'low' as const, // Depends on template complexity
      compression: 'good' as const
    };
  }

  // Helper method to get example templates
  static getExampleTemplates(): { name: string; template: string; description: string }[] {
    return [
      {
        name: 'Basic',
        template: '{timestamp} - {level} - {message}',
        description: 'Simple timestamp, level, and message'
      },
      {
        name: 'Detailed',
        template: '[{timestamp}] {level} ({sessionId}): {message} - {details}',
        description: 'Includes session ID and additional details'
      },
      {
        name: 'Apache-like',
        template: '{ip} - - [{timestamp}] "{method} {url}" {status} {size}',
        description: 'Apache web server log format'
      },
      {
        name: 'Syslog-like',
        template: '{timestamp} {hostname} {service}[{pid}]: {level} - {message}',
        description: 'Unix syslog format style'
      },
      {
        name: 'JSON-like',
        template: '{"time":"{timestamp}","level":"{level}","msg":"{message}"}',
        description: 'JSON-style but as string (for systems that need JSON-like but not actual JSON)'
      }
    ];
  }
}