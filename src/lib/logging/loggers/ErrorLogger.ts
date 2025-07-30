import { BaseLogger } from './BaseLogger';
import { LogData, ErrorLogData } from '../config/LoggerConfig';

export class ErrorLogger extends BaseLogger {
  private errorCounts: Map<string, number> = new Map();
  private lastErrorTimestamps: Map<string, number> = new Map();

  getLoggerType(): string {
    return 'error';
  }

  protected enrichLogData(data: LogData): LogData {
    const errorData: ErrorLogData = {
      ...data,
      errorType: data.errorType || this.classifyError(data.message),
      errorCode: data.errorCode || 'UNKNOWN',
      stack: data.stack || this.captureStackTrace(),
      userAgent: data.userAgent || this.getUserAgent(),
      url: data.url || this.getCurrentUrl(),
      userId: data.userId || 'anonymous',
      severity: data.severity || this.inferSeverity(data.level, data.message)
    };

    // Add error-specific enrichment
    errorData.errorId = this.generateErrorId();
    errorData.fingerprint = this.generateErrorFingerprint(errorData);
    
    // Track error frequency for rate limiting and alerting
    const frequency = this.trackErrorFrequency(errorData.fingerprint);
    errorData.frequency = frequency;
    
    // Check if this is a recurring error
    if (frequency > 1) {
      errorData.isRecurring = true;
      errorData.firstOccurrence = this.getFirstOccurrence(errorData.fingerprint);
    }

    // Add context about similar recent errors
    errorData.similarRecentErrors = this.findSimilarRecentErrors(errorData.fingerprint);

    // Determine if this error requires immediate attention
    errorData.requiresAttention = this.shouldRequireAttention(errorData);

    return errorData;
  }

  private classifyError(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('xhr')) {
      return 'network_error';
    }
    if (lowerMessage.includes('permission') || lowerMessage.includes('unauthorized') || lowerMessage.includes('forbidden')) {
      return 'permission_error';
    }
    if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
      return 'not_found_error';
    }
    if (lowerMessage.includes('timeout') || lowerMessage.includes('abort')) {
      return 'timeout_error';
    }
    if (lowerMessage.includes('parse') || lowerMessage.includes('json') || lowerMessage.includes('syntax')) {
      return 'parse_error';
    }
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
      return 'validation_error';
    }
    if (lowerMessage.includes('database') || lowerMessage.includes('sql')) {
      return 'database_error';
    }
    if (lowerMessage.includes('memory') || lowerMessage.includes('out of')) {
      return 'resource_error';
    }
    
    return 'generic_error';
  }

  private captureStackTrace(): string {
    if (typeof Error !== 'undefined') {
      const error = new Error();
      if (error.stack) {
        // Remove the first few lines that are from this logger
        const lines = error.stack.split('\n');
        return lines.slice(3).join('\n');
      }
    }
    return 'Stack trace not available';
  }

  private getUserAgent(): string {
    if (typeof navigator !== 'undefined') {
      return navigator.userAgent;
    }
    return 'Unknown';
  }

  private getCurrentUrl(): string {
    if (typeof window !== 'undefined') {
      return window.location.href;
    }
    return 'Unknown';
  }

  private inferSeverity(level: string, message: string): 'low' | 'medium' | 'high' | 'critical' {
    if (level === 'FATAL') return 'critical';
    if (level === 'ERROR') {
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('critical') || lowerMessage.includes('fatal') || lowerMessage.includes('crash')) {
        return 'critical';
      }
      if (lowerMessage.includes('security') || lowerMessage.includes('unauthorized') || lowerMessage.includes('breach')) {
        return 'high';
      }
      return 'medium';
    }
    if (level === 'WARN') return 'low';
    return 'low';
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateErrorFingerprint(errorData: ErrorLogData): string {
    // Create a fingerprint based on error type, message, and stack trace location
    const components = [
      errorData.errorType,
      errorData.message.substring(0, 100), // First 100 chars of message
      this.extractStackLocation(errorData.stack)
    ];
    
    // Create a hash-like fingerprint
    const combined = components.join('|');
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `fp_${Math.abs(hash).toString(36)}`;
  }

  private extractStackLocation(stack: string): string {
    // Extract the first meaningful line from stack trace
    const lines = stack.split('\n');
    for (const line of lines) {
      if (line.trim() && !line.includes('ErrorLogger') && !line.includes('BaseLogger')) {
        return line.trim().substring(0, 50);
      }
    }
    return 'unknown_location';
  }

  private trackErrorFrequency(fingerprint: string): number {
    const current = this.errorCounts.get(fingerprint) || 0;
    const newCount = current + 1;
    this.errorCounts.set(fingerprint, newCount);
    this.lastErrorTimestamps.set(fingerprint, Date.now());
    return newCount;
  }

  private getFirstOccurrence(fingerprint: string): number {
    // In a real implementation, this would be stored persistently
    // For demo purposes, we'll approximate based on current data
    const logs = this.getStoredLogs();
    for (const log of logs) {
      try {
        const parsed = JSON.parse(log.content);
        if (parsed.fingerprint === fingerprint) {
          return new Date(parsed.timestamp).getTime();
        }
      } catch {
        // Ignore parsing errors
      }
    }
    return Date.now();
  }

  private findSimilarRecentErrors(currentFingerprint: string): number {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let count = 0;
    
    this.lastErrorTimestamps.forEach((timestamp, fingerprint) => {
      if (fingerprint !== currentFingerprint && timestamp > oneHourAgo) {
        count++;
      }
    });
    
    return count;
  }

  private shouldRequireAttention(errorData: ErrorLogData): boolean {
    return (
      errorData.severity === 'critical' ||
      errorData.severity === 'high' ||
      (errorData.frequency && errorData.frequency > 5) ||
      errorData.errorType === 'security_error'
    );
  }

  // Convenience methods for common error scenarios
  logJavaScriptError(error: Error, context?: Record<string, any>): void {
    this.error('JavaScript error occurred', {
      errorType: 'javascript_error',
      errorCode: error.name,
      message: error.message,
      stack: error.stack || this.captureStackTrace(),
      ...context
    });
  }

  logNetworkError(url: string, method: string, status: number, error: string, context?: Record<string, any>): void {
    this.error('Network request failed', {
      errorType: 'network_error',
      errorCode: `HTTP_${status}`,
      url,
      method,
      message: error,
      ...context
    });
  }

  logValidationError(field: string, value: any, rule: string, context?: Record<string, any>): void {
    this.warn('Validation error occurred', {
      errorType: 'validation_error',
      errorCode: 'VALIDATION_FAILED',
      message: `Validation failed for field '${field}' with rule '${rule}'`,
      field,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      rule,
      ...context
    });
  }

  logSecurityError(threatType: string, details: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'high', context?: Record<string, any>): void {
    const level = severity === 'critical' ? 'FATAL' : 'ERROR';
    this.log(level, 'Security threat detected', {
      errorType: 'security_error',
      errorCode: `SECURITY_${threatType.toUpperCase()}`,
      message: details,
      severity,
      threatType,
      requiresAttention: true,
      ...context
    });
  }

  logBusinessLogicError(operation: string, reason: string, context?: Record<string, any>): void {
    this.error('Business logic error', {
      errorType: 'business_logic_error',
      errorCode: 'BUSINESS_RULE_VIOLATION',
      message: `Business logic error in ${operation}: ${reason}`,
      operation,
      reason,
      ...context
    });
  }

  // Static factory method for creating error logger with common defaults
  static createDefault(sessionId: string): ErrorLogger {
    return new ErrorLogger({
      type: 'error',
      level: 'WARN',
      format: 'json', // JSON is ideal for structured error data
      enabled: true,
      destination: '/logs/errors.log',
      formatOptions: {
        pretty: true,
        includeMetadata: true,
        includeStack: true
      }
    }, sessionId);
  }

  // Get error analytics from stored logs
  getErrorAnalytics(): {
    totalErrors: number;
    errorTypes: Record<string, number>;
    severityDistribution: Record<string, number>;
    recurringErrors: Array<{ fingerprint: string; count: number; lastSeen: string }>;
    errorTrends: { increasing: string[]; decreasing: string[]; stable: string[] };
    topErrorMessages: Array<{ message: string; count: number; errorType: string }>;
    criticalErrors: number;
  } {
    const logs = this.getStoredLogs();
    const parsedLogs = logs.map(log => {
      try {
        return JSON.parse(log.content);
      } catch {
        return null;
      }
    }).filter(Boolean);

    const totalErrors = parsedLogs.length;
    
    // Count error types
    const errorTypes = parsedLogs.reduce((acc, log) => {
      const type = log.errorType || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Count severity distribution
    const severityDistribution = parsedLogs.reduce((acc, log) => {
      const severity = log.severity || 'unknown';
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Find recurring errors
    const fingerprintCounts = parsedLogs.reduce((acc, log) => {
      const fp = log.fingerprint;
      if (fp) {
        if (!acc[fp]) {
          acc[fp] = { count: 0, lastSeen: log.timestamp };
        }
        acc[fp].count++;
        if (new Date(log.timestamp) > new Date(acc[fp].lastSeen)) {
          acc[fp].lastSeen = log.timestamp;
        }
      }
      return acc;
    }, {} as Record<string, { count: number; lastSeen: string }>);

    const recurringErrors = Object.entries(fingerprintCounts)
      .filter(([, data]) => data.count > 1)
      .map(([fingerprint, data]) => ({ fingerprint, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate error trends (simplified)
    const errorTrends = {
      increasing: [] as string[],
      decreasing: [] as string[],
      stable: [] as string[]
    };

    // Get top error messages
    const messageCounts = parsedLogs.reduce((acc, log) => {
      const message = log.message.substring(0, 100); // Truncate for grouping
      const key = `${message}|${log.errorType}`;
      if (!acc[key]) {
        acc[key] = { count: 0, message, errorType: log.errorType };
      }
      acc[key].count++;
      return acc;
    }, {} as Record<string, { count: number; message: string; errorType: string }>);

    const topErrorMessages = Object.values(messageCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Count critical errors
    const criticalErrors = parsedLogs.filter(log => 
      log.severity === 'critical' || log.level === 'FATAL'
    ).length;

    return {
      totalErrors,
      errorTypes,
      severityDistribution,
      recurringErrors,
      errorTrends,
      topErrorMessages,
      criticalErrors
    };
  }

  // Clear error tracking state (useful for testing)
  clearErrorTracking(): void {
    this.errorCounts.clear();
    this.lastErrorTimestamps.clear();
    console.log('🧹 Error tracking state cleared');
  }

  // Get current error frequency state
  getErrorFrequencyState(): Record<string, { count: number; lastSeen: number }> {
    const state: Record<string, { count: number; lastSeen: number }> = {};
    
    this.errorCounts.forEach((count, fingerprint) => {
      const lastSeen = this.lastErrorTimestamps.get(fingerprint) || 0;
      state[fingerprint] = { count, lastSeen };
    });
    
    return state;
  }

  // Check if error rate is above threshold (for alerting)
  isErrorRateHigh(timeWindowMs: number = 60000, threshold: number = 10): boolean {
    const now = Date.now();
    const recentErrors = Array.from(this.lastErrorTimestamps.values())
      .filter(timestamp => timestamp > now - timeWindowMs);
    
    return recentErrors.length > threshold;
  }
}