import { BaseFormatter } from './BaseFormatter';
import { LogData, LoggerType, FormatConfigOption } from '../config/LoggerConfig';

export class StringFormatter extends BaseFormatter {
  format(data: LogData): string {
    const template = this.config.template || this.getDefaultTemplate();
    const includeDetails = this.config.includeDetails !== false;
    const maxLength = this.config.maxLength || 0;
    
    let output = this.substituteTemplate(template, data);
    
    // Add additional details if requested
    if (includeDetails && this.hasAdditionalDetails(data)) {
      const details = this.formatAdditionalDetails(data);
      output += details ? ` ${details}` : '';
    }
    
    // Truncate if max length specified
    if (maxLength > 0 && output.length > maxLength) {
      output = output.substring(0, maxLength - 3) + '...';
    }
    
    return output;
  }

  private getDefaultTemplate(): string {
    return '{timestamp} - {level} - {message}';
  }

  private hasAdditionalDetails(data: LogData): boolean {
    const coreFields = ['timestamp', 'level', 'message', 'sessionId'];
    return Object.keys(data).some(key => !coreFields.includes(key));
  }

  private formatAdditionalDetails(data: LogData): string {
    const coreFields = ['timestamp', 'level', 'message', 'sessionId'];
    const additionalFields = Object.entries(data)
      .filter(([key]) => !coreFields.includes(key))
      .filter(([, value]) => value !== undefined && value !== null);
    
    if (additionalFields.length === 0) return '';
    
    const detailStyle = this.config.detailStyle || 'brackets';
    
    switch (detailStyle) {
      case 'brackets':
        return `[${additionalFields.map(([key, value]) => `${key}=${this.formatValue(value)}`).join(', ')}]`;
      case 'json':
        return JSON.stringify(Object.fromEntries(additionalFields));
      case 'keyvalue':
        return additionalFields.map(([key, value]) => `${key}=${this.formatValue(value)}`).join(' ');
      default:
        return `(${additionalFields.map(([key, value]) => `${key}: ${this.formatValue(value)}`).join(', ')})`;
    }
  }

  private formatValue(value: any): string {
    if (typeof value === 'string') {
      return value.includes(' ') ? `"${value}"` : value;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  getDisplayName(): string {
    return 'Human Readable String';
  }

  getFileExtension(): string {
    return '.log';
  }

  supportsLoggerType(type: LoggerType): boolean {
    // String format supports all logger types
    return true;
  }

  getConfigOptions(): FormatConfigOption[] {
    return [
      {
        key: 'template',
        label: 'Log Template',
        type: 'string',
        defaultValue: '{timestamp} - {level} - {message}',
        description: 'Template for log format. Use {fieldName} for substitution.'
      },
      {
        key: 'includeDetails',
        label: 'Include Additional Details',
        type: 'boolean',
        defaultValue: true,
        description: 'Include extra fields beyond the basic template'
      },
      {
        key: 'detailStyle',
        label: 'Detail Style',
        type: 'select',
        options: ['brackets', 'json', 'keyvalue', 'parentheses'],
        defaultValue: 'brackets',
        description: 'How to format additional details'
      },
      {
        key: 'maxLength',
        label: 'Maximum Length',
        type: 'number',
        defaultValue: 0,
        description: 'Maximum line length (0 = unlimited)'
      }
    ];
  }

  getPerformanceCharacteristics() {
    return {
      cpuUsage: 'low' as const,
      memoryUsage: 'low' as const,
      parseability: 'low' as const,
      compression: 'good' as const
    };
  }
}