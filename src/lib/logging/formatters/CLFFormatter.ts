import { BaseFormatter } from './BaseFormatter';
import { LogData, LoggerType, AccessLogData, FormatConfigOption } from '../config/LoggerConfig';

export class CLFFormatter extends BaseFormatter {
  format(data: LogData): string {
    // CLF is primarily designed for access logs
    if (this.isAccessLogData(data)) {
      return this.formatAccessLog(data);
    }
    
    // For non-access logs, create a CLF-like format
    return this.formatGenericLog(data);
  }

  private isAccessLogData(data: LogData): data is AccessLogData {
    return 'method' in data && 'url' in data && 'status' in data;
  }

  private formatAccessLog(data: AccessLogData): string {
    // Common Log Format: host ident authuser [timestamp] "method url protocol" status size
    const host = data.ip || '-';
    const ident = '-'; // Usually unavailable in web context
    const authuser = data.userId || '-';
    const timestamp = this.formatTimestamp(data.timestamp, 'clf');
    const method = data.method || 'GET';
    const url = data.url || '/';
    const protocol = 'HTTP/1.1';
    const status = data.status || 200;
    const size = data.size || '-';
    
    // Extended format can include additional fields
    if (this.config.extended) {
      const referer = data.referer || '-';
      const userAgent = data.userAgent || '-';
      const duration = data.duration || '-';
      
      return `${host} ${ident} ${authuser} [${timestamp}] "${method} ${url} ${protocol}" ${status} ${size} "${referer}" "${userAgent}" ${duration}ms`;
    }
    
    return `${host} ${ident} ${authuser} [${timestamp}] "${method} ${url} ${protocol}" ${status} ${size}`;
  }

  private formatGenericLog(data: LogData): string {
    // Adapt non-access logs to CLF-like format
    const host = 'localhost';
    const ident = '-';
    const authuser = data.sessionId || '-';
    const timestamp = this.formatTimestamp(data.timestamp, 'clf');
    const request = `"${data.level} ${data.message}"`;
    const status = this.getStatusFromLevel(data.level);
    const size = JSON.stringify(data).length;
    
    return `${host} ${ident} ${authuser} [${timestamp}] ${request} ${status} ${size}`;
  }

  private getStatusFromLevel(level: string): number {
    switch (level) {
      case 'ERROR':
      case 'FATAL':
        return 500;
      case 'WARN':
        return 400;
      case 'INFO':
      case 'DEBUG':
      case 'TRACE':
      default:
        return 200;
    }
  }

  getDisplayName(): string {
    return 'Common Log Format (CLF)';
  }

  getFileExtension(): string {
    return '.log';
  }

  supportsLoggerType(type: LoggerType): boolean {
    // CLF is best suited for access logs, but can adapt others
    return type === 'access' || this.config.forceCompatibility;
  }

  getConfigOptions(): FormatConfigOption[] {
    return [
      {
        key: 'extended',
        label: 'Extended Format',
        type: 'boolean',
        defaultValue: false,
        description: 'Include additional fields like referer, user-agent, and duration'
      },
      {
        key: 'forceCompatibility',
        label: 'Force Compatibility',
        type: 'boolean',
        defaultValue: false,
        description: 'Allow CLF format for non-access log types (with adaptations)'
      }
    ];
  }

  getPerformanceCharacteristics() {
    return {
      cpuUsage: 'low' as const,
      memoryUsage: 'low' as const,
      parseability: 'good' as const,
      compression: 'excellent' as const
    };
  }
}