import { BaseLogger } from './BaseLogger';
import { LogData, AccessLogData } from '../config/LoggerConfig';

export class AccessLogger extends BaseLogger {
  getLoggerType(): string {
    return 'access';
  }

  protected enrichLogData(data: LogData): LogData {
    const accessData: AccessLogData = {
      ...data,
      ip: data.ip || this.extractIpFromRequest(),
      userAgent: data.userAgent || this.extractUserAgent(),
      method: data.method || 'GET',
      url: data.url || 'unknown',
      status: data.status || 200,
      responseTime: data.responseTime || 0,
      contentLength: data.contentLength || 0,
      referer: data.referer || '-'
    };

    // Add additional access-specific enrichment
    if (accessData.status >= 400) {
      accessData.errorCategory = this.categorizeHttpError(accessData.status);
    }

    if (accessData.responseTime > 1000) {
      accessData.slowRequest = true;
    }

    return accessData;
  }

  private extractIpFromRequest(): string {
    // In a real application, this would extract from request headers
    // For demo purposes, we'll use a placeholder
    return '127.0.0.1';
  }

  private extractUserAgent(): string {
    if (typeof navigator !== 'undefined') {
      return navigator.userAgent;
    }
    return 'Unknown';
  }

  private categorizeHttpError(status: number): string {
    if (status >= 400 && status < 500) {
      return 'client_error';
    } else if (status >= 500) {
      return 'server_error';
    }
    return 'unknown';
  }

  // Convenience methods for common access log scenarios
  logRequest(method: string, url: string, status: number, responseTime: number, additionalData?: Record<string, any>): void {
    this.info('HTTP request processed', {
      method,
      url,
      status,
      responseTime,
      contentLength: additionalData?.contentLength || 0,
      userAgent: additionalData?.userAgent || this.extractUserAgent(),
      ip: additionalData?.ip || this.extractIpFromRequest(),
      referer: additionalData?.referer || '-',
      ...additionalData
    });
  }

  logError(method: string, url: string, status: number, error: string, additionalData?: Record<string, any>): void {
    this.error('HTTP request failed', {
      method,
      url,
      status,
      error,
      userAgent: additionalData?.userAgent || this.extractUserAgent(),
      ip: additionalData?.ip || this.extractIpFromRequest(),
      referer: additionalData?.referer || '-',
      ...additionalData
    });
  }

  logSlowRequest(method: string, url: string, responseTime: number, threshold: number = 1000, additionalData?: Record<string, any>): void {
    this.warn('Slow HTTP request detected', {
      method,
      url,
      responseTime,
      threshold,
      slowRequest: true,
      userAgent: additionalData?.userAgent || this.extractUserAgent(),
      ip: additionalData?.ip || this.extractIpFromRequest(),
      ...additionalData
    });
  }

  // Static factory method for creating access logger with common defaults
  static createDefault(sessionId: string): AccessLogger {
    return new AccessLogger({
      type: 'access',
      level: 'INFO',
      format: 'clf', // Common Log Format is standard for access logs
      enabled: true,
      destination: '/logs/access.log',
      formatOptions: {
        includeExtended: true
      }
    }, sessionId);
  }

  // Get access log statistics from stored logs
  getAccessStats(): {
    totalRequests: number;
    errorRate: number;
    avgResponseTime: number;
    slowRequests: number;
    statusCodes: Record<string, number>;
  } {
    const logs = this.getStoredLogs();
    const parsedLogs = logs.map(log => {
      try {
        return JSON.parse(log.content);
      } catch {
        return null;
      }
    }).filter(Boolean);

    const totalRequests = parsedLogs.length;
    const errors = parsedLogs.filter(log => log.status >= 400).length;
    const slowRequests = parsedLogs.filter(log => log.slowRequest || log.responseTime > 1000).length;
    
    const responseTimes = parsedLogs
      .map(log => log.responseTime)
      .filter(time => typeof time === 'number' && time > 0);
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    const statusCodes = parsedLogs.reduce((acc, log) => {
      const status = String(log.status || 'unknown');
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRequests,
      errorRate: totalRequests > 0 ? (errors / totalRequests) * 100 : 0,
      avgResponseTime: Math.round(avgResponseTime),
      slowRequests,
      statusCodes
    };
  }
}