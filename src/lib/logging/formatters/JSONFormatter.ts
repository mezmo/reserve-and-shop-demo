import { BaseFormatter } from './BaseFormatter';
import { LogData, LoggerType, FormatConfigOption } from '../config/LoggerConfig';

export class JSONFormatter extends BaseFormatter {
  format(data: LogData): string {
    const indent = this.config.indent ? this.config.indent : 0;
    const includeStackTrace = this.config.includeStackTrace !== false;
    
    // Create a clean copy of the data
    const cleanData = { ...data };
    
    // Handle stack traces based on configuration
    if (!includeStackTrace && 'stack' in cleanData) {
      delete cleanData.stack;
    }
    
    // Add format metadata if requested
    if (this.config.includeMetadata) {
      cleanData._metadata = {
        format: 'json',
        version: '1.0',
        generatedAt: new Date().toISOString()
      };
    }
    
    try {
      return JSON.stringify(cleanData, null, indent);
    } catch (error) {
      // Fallback for circular references or other JSON issues
      return JSON.stringify({
        ...cleanData,
        _error: `JSON serialization failed: ${error.message}`,
        _originalData: String(data)
      }, null, indent);
    }
  }

  getDisplayName(): string {
    return 'JSON';
  }

  getFileExtension(): string {
    return '.json';
  }

  supportsLoggerType(type: LoggerType): boolean {
    // JSON supports all logger types
    return true;
  }

  getConfigOptions(): FormatConfigOption[] {
    return [
      {
        key: 'indent',
        label: 'Indentation',
        type: 'select',
        options: ['0', '2', '4'],
        defaultValue: 0,
        description: 'Number of spaces for JSON indentation (0 = compact)'
      },
      {
        key: 'includeStackTrace',
        label: 'Include Stack Traces',
        type: 'boolean',
        defaultValue: true,
        description: 'Include full stack traces in error logs'
      },
      {
        key: 'includeMetadata',
        label: 'Include Metadata',
        type: 'boolean',
        defaultValue: false,
        description: 'Add format metadata to each log entry'
      }
    ];
  }

  getPerformanceCharacteristics() {
    return {
      cpuUsage: 'medium' as const,
      memoryUsage: 'medium' as const,
      parseability: 'excellent' as const,
      compression: 'good' as const
    };
  }
}