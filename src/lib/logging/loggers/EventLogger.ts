import { BaseLogger } from './BaseLogger';
import { LogData, EventLogData } from '../config/LoggerConfig';

export class EventLogger extends BaseLogger {
  getLoggerType(): string {
    return 'event';
  }

  protected enrichLogData(data: LogData): LogData {
    const eventData: EventLogData = {
      ...data,
      eventType: data.eventType || 'generic',
      userId: data.userId || 'anonymous',
      component: data.component || 'unknown',
      action: data.action || data.message || 'action',
      metadata: data.metadata || {},
      duration: data.duration || 0
    };

    // Add event-specific enrichment
    eventData.eventId = this.generateEventId();
    
    // Track event frequency for rate limiting or analytics
    if (eventData.eventType) {
      eventData.eventFrequency = this.getEventFrequency(eventData.eventType);
    }

    // Add correlation ID for tracing related events
    if (data.correlationId) {
      eventData.correlationId = data.correlationId;
    } else if (this.shouldGenerateCorrelationId(eventData.eventType)) {
      eventData.correlationId = this.generateCorrelationId();
    }

    return eventData;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private shouldGenerateCorrelationId(eventType: string): boolean {
    // Generate correlation IDs for events that typically occur in sequences
    const correlatedEventTypes = ['user_journey', 'transaction', 'workflow', 'api_call'];
    return correlatedEventTypes.includes(eventType);
  }

  private getEventFrequency(eventType: string): number {
    // In a real implementation, this would query a cache or database
    // For demo purposes, we'll use localStorage
    try {
      const key = `event_frequency_${eventType}`;
      const count = parseInt(localStorage.getItem(key) || '0', 10);
      const newCount = count + 1;
      localStorage.setItem(key, String(newCount));
      return newCount;
    } catch {
      return 1;
    }
  }

  // Convenience methods for common event scenarios
  logUserAction(userId: string, action: string, component: string, metadata?: Record<string, any>): void {
    this.info('User action performed', {
      eventType: 'user_action',
      userId,
      action,
      component,
      metadata: metadata || {}
    });
  }

  logSystemEvent(eventType: string, component: string, details: string, metadata?: Record<string, any>): void {
    this.info('System event occurred', {
      eventType: eventType || 'system',
      component,
      action: 'system_event',
      message: details,
      metadata: metadata || {}
    });
  }

  logBusinessEvent(eventType: string, action: string, userId?: string, metadata?: Record<string, any>): void {
    this.info('Business event tracked', {
      eventType: eventType || 'business',
      action,
      userId: userId || 'system',
      component: 'business_logic',
      metadata: metadata || {}
    });
  }

  logPerformanceEvent(action: string, duration: number, component: string, metadata?: Record<string, any>): void {
    const level = duration > 1000 ? 'WARN' : 'INFO';
    this.log(level, 'Performance event measured', {
      eventType: 'performance',
      action,
      component,
      duration,
      metadata: {
        ...metadata,
        performanceCategory: this.categorizePerformance(duration)
      }
    });
  }

  logSecurityEvent(eventType: string, severity: 'low' | 'medium' | 'high' | 'critical', details: string, metadata?: Record<string, any>): void {
    const logLevel = this.mapSecuritySeverityToLogLevel(severity);
    this.log(logLevel, 'Security event detected', {
      eventType: `security_${eventType}`,
      action: 'security_alert',
      component: 'security',
      severity,
      message: details,
      metadata: {
        ...metadata,
        requiresReview: severity === 'high' || severity === 'critical'
      }
    });
  }

  private categorizePerformance(duration: number): string {
    if (duration < 100) return 'fast';
    if (duration < 500) return 'normal';
    if (duration < 1000) return 'slow';
    if (duration < 5000) return 'very_slow';
    return 'critical';
  }

  private mapSecuritySeverityToLogLevel(severity: string): 'INFO' | 'WARN' | 'ERROR' | 'FATAL' {
    switch (severity) {
      case 'low': return 'INFO';
      case 'medium': return 'WARN';
      case 'high': return 'ERROR';
      case 'critical': return 'FATAL';
      default: return 'WARN';
    }
  }

  // Static factory method for creating event logger with common defaults
  static createDefault(sessionId: string): EventLogger {
    return new EventLogger({
      type: 'event',
      level: 'DEBUG',
      format: 'json', // JSON is ideal for structured event data
      enabled: true,
      destination: '/logs/events.log',
      formatOptions: {
        pretty: true,
        includeMetadata: true
      }
    }, sessionId);
  }

  // Get event analytics from stored logs
  getEventAnalytics(): {
    totalEvents: number;
    eventTypes: Record<string, number>;
    topUsers: Array<{ userId: string; count: number }>;
    topComponents: Array<{ component: string; count: number }>;
    avgDuration: number;
    securityEvents: number;
  } {
    const logs = this.getStoredLogs();
    const parsedLogs = logs.map(log => {
      try {
        return JSON.parse(log.content);
      } catch {
        return null;
      }
    }).filter(Boolean);

    const totalEvents = parsedLogs.length;
    
    // Count event types
    const eventTypes = parsedLogs.reduce((acc, log) => {
      const type = log.eventType || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Count by users
    const userCounts = parsedLogs.reduce((acc, log) => {
      const userId = log.userId || 'anonymous';
      acc[userId] = (acc[userId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topUsers = Object.entries(userCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }));

    // Count by components
    const componentCounts = parsedLogs.reduce((acc, log) => {
      const component = log.component || 'unknown';
      acc[component] = (acc[component] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topComponents = Object.entries(componentCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([component, count]) => ({ component, count }));

    // Calculate average duration
    const durations = parsedLogs
      .map(log => log.duration)
      .filter(duration => typeof duration === 'number' && duration > 0);
    
    const avgDuration = durations.length > 0 
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length 
      : 0;

    // Count security events
    const securityEvents = parsedLogs.filter(log => 
      log.eventType && log.eventType.startsWith('security_')
    ).length;

    return {
      totalEvents,
      eventTypes,
      topUsers,
      topComponents,
      avgDuration: Math.round(avgDuration),
      securityEvents
    };
  }

  // Method to find related events by correlation ID
  findRelatedEvents(correlationId: string): any[] {
    const logs = this.getStoredLogs();
    return logs
      .map(log => {
        try {
          return JSON.parse(log.content);
        } catch {
          return null;
        }
      })
      .filter(log => log && log.correlationId === correlationId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
}