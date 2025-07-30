import { BaseFormatter } from './BaseFormatter';
import { LogData, LoggerType, FormatConfigOption } from '../config/LoggerConfig';

export class XMLFormatter extends BaseFormatter {
  format(data: LogData): string {
    const rootElement = this.config.rootElement || 'logEntry';
    const indent = this.config.indent ? '  ' : '';
    const includeDeclaration = this.config.includeDeclaration !== false;
    
    let output = '';
    
    // Add XML declaration if requested
    if (includeDeclaration) {
      output += '<?xml version="1.0" encoding="UTF-8"?>\n';
    }
    
    // Format the log entry as XML
    output += this.formatAsXML(data, rootElement, 0, indent);
    
    return output;
  }

  private formatAsXML(data: any, elementName: string, depth: number, indent: string): string {
    const indentation = indent.repeat(depth);
    const childIndentation = indent.repeat(depth + 1);
    
    if (data === null || data === undefined) {
      return `${indentation}<${elementName} />\n`;
    }
    
    if (typeof data === 'object' && !Array.isArray(data)) {
      // Handle objects
      let xml = `${indentation}<${elementName}>\n`;
      
      for (const [key, value] of Object.entries(data)) {
        const sanitizedKey = this.sanitizeElementName(key);
        xml += this.formatAsXML(value, sanitizedKey, depth + 1, indent);
      }
      
      xml += `${indentation}</${elementName}>\n`;
      return xml;
    }
    
    if (Array.isArray(data)) {
      // Handle arrays
      let xml = `${indentation}<${elementName}>\n`;
      
      data.forEach((item, index) => {
        const itemElement = this.config.arrayItemElement || 'item';
        xml += this.formatAsXML(item, `${itemElement}_${index}`, depth + 1, indent);
      });
      
      xml += `${indentation}</${elementName}>\n`;
      return xml;
    }
    
    // Handle primitive values
    const escapedValue = this.escapeString(String(data), 'xml');
    
    if (this.config.useAttributes && this.shouldUseAttribute(data)) {
      return `${indentation}<${elementName} value="${escapedValue}" />\n`;
    }
    
    return `${indentation}<${elementName}>${escapedValue}</${elementName}>\n`;
  }

  private sanitizeElementName(name: string): string {
    // XML element names must follow specific rules
    return name
      .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace invalid characters
      .replace(/^[^a-zA-Z_]/, '_$&')   // Ensure it starts with letter or underscore
      .replace(/^xml/i, '_xml');       // XML prefix is reserved
  }

  private shouldUseAttribute(value: any): boolean {
    // Use attributes for simple primitive values if configured
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  }

  getDisplayName(): string {
    return 'XML';
  }

  getFileExtension(): string {
    return '.xml';
  }

  supportsLoggerType(type: LoggerType): boolean {
    // XML works well for structured data but might be overkill for simple access logs
    return ['event', 'error', 'metrics'].includes(type) || this.config.forceCompatibility;
  }

  getConfigOptions(): FormatConfigOption[] {
    return [
      {
        key: 'rootElement',
        label: 'Root Element Name',
        type: 'string',
        defaultValue: 'logEntry',
        description: 'Name of the root XML element for each log entry'
      },
      {
        key: 'includeDeclaration',
        label: 'Include XML Declaration',
        type: 'boolean',
        defaultValue: true,
        description: 'Include <?xml version="1.0" encoding="UTF-8"?> header'
      },
      {
        key: 'indent',
        label: 'Pretty Print',
        type: 'boolean',
        defaultValue: true,
        description: 'Format XML with proper indentation'
      },
      {
        key: 'useAttributes',
        label: 'Use Attributes',
        type: 'boolean',
        defaultValue: false,
        description: 'Use XML attributes for simple values instead of child elements'
      },
      {
        key: 'arrayItemElement',
        label: 'Array Item Element',
        type: 'string',
        defaultValue: 'item',
        description: 'Element name for array items'
      },
      {
        key: 'forceCompatibility',
        label: 'Force Compatibility',
        type: 'boolean',
        defaultValue: false,
        description: 'Allow XML format for all log types'
      }
    ];
  }

  getPerformanceCharacteristics() {
    return {
      cpuUsage: 'high' as const,
      memoryUsage: 'high' as const,
      parseability: 'good' as const,
      compression: 'poor' as const
    };
  }
}