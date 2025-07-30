import { BaseFormatter } from './BaseFormatter';
import { LogData, LoggerType, FormatConfigOption } from '../config/LoggerConfig';

export class CSVFormatter extends BaseFormatter {
  private static headerWritten: Set<string> = new Set();

  format(data: LogData): string {
    const includeHeader = this.config.includeHeader && !CSVFormatter.headerWritten.has(this.config.destination || 'default');
    const separator = this.config.separator || ',';
    const fields = this.config.fields || this.getDefaultFields(data);
    
    let output = '';
    
    // Add header if needed
    if (includeHeader) {
      output += this.formatHeader(fields, separator) + '\n';
      CSVFormatter.headerWritten.add(this.config.destination || 'default');
    }
    
    // Add data row
    output += this.formatDataRow(data, fields, separator);
    
    return output;
  }

  private getDefaultFields(data: LogData): string[] {
    // Use the keys from the data object as default fields
    return Object.keys(data).sort();
  }

  private formatHeader(fields: string[], separator: string): string {
    return fields.map(field => this.escapeString(field, 'csv')).join(separator);
  }

  private formatDataRow(data: LogData, fields: string[], separator: string): string {
    const values = fields.map(field => {
      const value = this.getNestedValue(data, field);
      return this.formatValue(value);
    });
    
    return values.join(separator);
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return this.config.nullValue || '';
    }
    
    if (typeof value === 'object') {
      // Convert objects to JSON strings
      return this.escapeString(JSON.stringify(value), 'csv');
    }
    
    const stringValue = String(value);
    return this.escapeString(stringValue, 'csv');
  }

  // Static method to reset header tracking (useful for testing or log rotation)
  static resetHeaderTracking(): void {
    CSVFormatter.headerWritten.clear();
  }

  getDisplayName(): string {
    return 'CSV (Comma Separated Values)';
  }

  getFileExtension(): string {
    return '.csv';
  }

  supportsLoggerType(type: LoggerType): boolean {
    // CSV is great for analytics but works with all types
    return true;
  }

  getConfigOptions(): FormatConfigOption[] {
    return [
      {
        key: 'includeHeader',
        label: 'Include Header Row',
        type: 'boolean',
        defaultValue: true,
        description: 'Include column headers as first row'
      },
      {
        key: 'separator',
        label: 'Field Separator',
        type: 'select',
        options: [',', ';', '\t', '|'],
        defaultValue: ',',
        description: 'Character used to separate fields'
      },
      {
        key: 'fields',
        label: 'Field Order',
        type: 'string',
        defaultValue: '',
        description: 'Comma-separated list of fields to include (leave empty for auto-detect)'
      },
      {
        key: 'nullValue',
        label: 'Null Value Representation',
        type: 'string',
        defaultValue: '',
        description: 'How to represent null/undefined values'
      }
    ];
  }

  getPerformanceCharacteristics() {
    return {
      cpuUsage: 'low' as const,
      memoryUsage: 'low' as const,
      parseability: 'excellent' as const,
      compression: 'good' as const
    };
  }
}