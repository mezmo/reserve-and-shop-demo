import { AccessLogger } from './loggers/AccessLogger';
import { EventLogger } from './loggers/EventLogger';
import { MetricsLogger } from './loggers/MetricsLogger';
import { ErrorLogger } from './loggers/ErrorLogger';
import { LoggerConfig, LogLevel, LogFormat, LoggerType } from './config/LoggerConfig';

export interface PerformanceManagerConfig {
  sessionId?: string;
  defaultLogLevel?: LogLevel;
  loggers?: {
    access?: Partial<LoggerConfig>;
    event?: Partial<LoggerConfig>;
    metrics?: Partial<LoggerConfig>;
    error?: Partial<LoggerConfig>;
  };
}

export class PerformanceManager {
  private static instance: PerformanceManager | null = null;
  
  private sessionId: string;
  private accessLogger: AccessLogger;
  private eventLogger: EventLogger;
  private metricsLogger: MetricsLogger;
  private errorLogger: ErrorLogger;
  private requestTimers: Map<string, number> = new Map();

  private constructor(config: PerformanceManagerConfig = {}) {
    this.sessionId = config.sessionId || this.generateSessionId();
    
    // Initialize loggers with provided configs or defaults
    this.accessLogger = this.createAccessLogger(config.loggers?.access);
    this.eventLogger = this.createEventLogger(config.loggers?.event);
    this.metricsLogger = this.createMetricsLogger(config.loggers?.metrics);
    this.errorLogger = this.createErrorLogger(config.loggers?.error);

    this.setupGlobalErrorHandling();
    this.setupPerformanceMonitoring();
  }

  public static getInstance(config?: PerformanceManagerConfig): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager(config);
    }
    return PerformanceManager.instance;
  }

  public static resetInstance(): void {
    PerformanceManager.instance = null;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createAccessLogger(config?: Partial<LoggerConfig>): AccessLogger {
    const defaultConfig: LoggerConfig = {
      type: 'access',
      level: 'INFO',
      format: 'clf',
      enabled: true,
      destination: '/logs/access.log',
      formatOptions: { includeExtended: true }
    };
    
    return new AccessLogger({ ...defaultConfig, ...config }, this.sessionId);
  }

  private createEventLogger(config?: Partial<LoggerConfig>): EventLogger {
    const defaultConfig: LoggerConfig = {
      type: 'event',
      level: 'DEBUG',
      format: 'json',
      enabled: true,
      destination: '/logs/events.log',
      formatOptions: { pretty: true, includeMetadata: true }
    };
    
    return new EventLogger({ ...defaultConfig, ...config }, this.sessionId);
  }

  private createMetricsLogger(config?: Partial<LoggerConfig>): MetricsLogger {
    const defaultConfig: LoggerConfig = {
      type: 'metrics',
      level: 'INFO',
      format: 'json',
      enabled: true,
      destination: '/logs/metrics.log',
      formatOptions: { pretty: false, includeMetadata: true }
    };
    
    return new MetricsLogger({ ...defaultConfig, ...config }, this.sessionId);
  }

  private createErrorLogger(config?: Partial<LoggerConfig>): ErrorLogger {
    const defaultConfig: LoggerConfig = {
      type: 'error',
      level: 'WARN',
      format: 'json',
      enabled: true,
      destination: '/logs/errors.log',
      formatOptions: { pretty: true, includeMetadata: true, includeStack: true }
    };
    
    return new ErrorLogger({ ...defaultConfig, ...config }, this.sessionId);
  }

  private setupGlobalErrorHandling(): void {
    if (typeof window !== 'undefined') {
      // Handle uncaught JavaScript errors
      window.addEventListener('error', (event) => {
        this.errorLogger.logJavaScriptError(event.error || new Error(event.message), {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          url: window.location.href
        });
      });

      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.errorLogger.error('Unhandled promise rejection', {
          errorType: 'unhandled_promise_rejection',
          reason: String(event.reason),
          url: window.location.href
        });
      });

      // Handle network errors on fetch
      this.interceptFetch();
    }
  }

  private interceptFetch(): void {
    if (typeof window !== 'undefined' && window.fetch) {
      const originalFetch = window.fetch;
      
      window.fetch = async (...args) => {
        const [resource, options] = args;
        const url = typeof resource === 'string' ? resource : resource.url;
        const method = options?.method || 'GET';
        const startTime = performance.now();
        const requestId = this.generateRequestId();

        this.requestTimers.set(requestId, startTime);

        try {
          const response = await originalFetch(...args);
          const endTime = performance.now();
          const responseTime = Math.round(endTime - startTime);

          // Log successful request
          this.logHttpRequest(method, url, response.status, responseTime, {
            requestId,
            contentLength: parseInt(response.headers.get('content-length') || '0')
          });

          // Log performance metrics
          this.metricsLogger.logTimer(`http_request_${method.toLowerCase()}`, startTime, {
            url,
            status: response.status.toString(),
            success: 'true'
          });

          this.requestTimers.delete(requestId);
          return response;
        } catch (error) {
          const endTime = performance.now();
          const responseTime = Math.round(endTime - startTime);

          // Log failed request
          this.errorLogger.logNetworkError(url, method, 0, error.message, {
            requestId,
            responseTime
          });

          // Log failure metrics
          this.metricsLogger.logCounter('http_request_failures', 1, {
            method: method.toLowerCase(),
            url,
            error_type: 'network_error'
          });

          this.requestTimers.delete(requestId);
          throw error;
        }
      };
    }
  }

  private setupPerformanceMonitoring(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        // Monitor navigation timing
        const navObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              this.logPageLoadMetrics(navEntry);
            }
          });
        });
        navObserver.observe({ entryTypes: ['navigation'] });

        // Monitor resource loading
        const resourceObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'resource') {
              this.logResourceLoadMetrics(entry as PerformanceResourceTiming);
            }
          });
        });
        resourceObserver.observe({ entryTypes: ['resource'] });

        // Monitor long tasks
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            this.logLongTask(entry);
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        console.warn('Performance monitoring setup failed:', error);
      }
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  // Public API methods for logging different types of events

  public logHttpRequest(method: string, url: string, status: number, responseTime: number, additionalData?: Record<string, any>): void {
    this.accessLogger.logRequest(method, url, status, responseTime, additionalData);
    
    // Also log as metrics
    this.metricsLogger.logTimer(`http_response_time`, Date.now() - responseTime, {
      method: method.toLowerCase(),
      status: status.toString(),
      url_pattern: this.extractUrlPattern(url)
    });
  }

  public logUserAction(action: string, component: string, userId?: string, metadata?: Record<string, any>): void {
    this.eventLogger.logUserAction(userId || 'anonymous', action, component, metadata);
    this.metricsLogger.logCounter('user_actions', 1, {
      action,
      component,
      user_id: userId || 'anonymous'
    });
  }

  public logBusinessEvent(eventType: string, action: string, value?: number, metadata?: Record<string, any>): void {
    this.eventLogger.logBusinessEvent(eventType, action, metadata?.userId, metadata);
    
    if (typeof value === 'number') {
      this.metricsLogger.logBusinessMetric(`business_${eventType}`, value, metadata?.currency, {
        action,
        ...metadata
      });
    }
  }

  public logError(error: Error | string, context?: Record<string, any>): void {
    if (error instanceof Error) {
      this.errorLogger.logJavaScriptError(error, context);
    } else {
      this.errorLogger.error(error, {
        errorType: 'generic_error',
        ...context
      });
    }
    
    this.metricsLogger.logCounter('errors', 1, {
      error_type: context?.errorType || 'generic',
      component: context?.component || 'unknown'
    });
  }

  public logPerformanceEvent(name: string, duration: number, component: string, metadata?: Record<string, any>): void {
    this.eventLogger.logPerformanceEvent(name, duration, component, metadata);
    this.metricsLogger.logPerformanceMetric(name, duration, {
      component,
      ...metadata
    });
  }

  public startTimer(name: string): string {
    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.requestTimers.set(timerId, performance.now());
    return timerId;
  }

  public endTimer(timerId: string, metadata?: Record<string, any>): number {
    const startTime = this.requestTimers.get(timerId);
    if (!startTime) {
      console.warn(`Timer ${timerId} not found`);
      return 0;
    }

    const duration = Math.round(performance.now() - startTime);
    this.requestTimers.delete(timerId);

    const timerName = timerId.split('_')[0];
    this.metricsLogger.logTimer(timerName, startTime, metadata);

    return duration;
  }

  // Configuration management methods

  public updateLoggerConfig(loggerType: LoggerType, config: Partial<LoggerConfig>): void {
    switch (loggerType) {
      case 'access':
        this.accessLogger.updateConfig(config);
        break;
      case 'event':
        this.eventLogger.updateConfig(config);
        break;
      case 'metrics':
        this.metricsLogger.updateConfig(config);
        break;
      case 'error':
        this.errorLogger.updateConfig(config);
        break;
    }
  }

  public getLoggerConfig(loggerType: LoggerType): LoggerConfig {
    switch (loggerType) {
      case 'access':
        return this.accessLogger.getConfig();
      case 'event':
        return this.eventLogger.getConfig();
      case 'metrics':
        return this.metricsLogger.getConfig();
      case 'error':
        return this.errorLogger.getConfig();
    }
  }

  public setLogLevel(loggerType: LoggerType, level: LogLevel): void {
    this.updateLoggerConfig(loggerType, { level });
  }

  public setLogFormat(loggerType: LoggerType, format: LogFormat): void {
    this.updateLoggerConfig(loggerType, { format });
  }

  public enableLogger(loggerType: LoggerType, enabled: boolean = true): void {
    this.updateLoggerConfig(loggerType, { enabled });
  }

  // Analytics and monitoring methods

  public getAnalytics(): {
    access: ReturnType<AccessLogger['getAccessStats']>;
    events: ReturnType<EventLogger['getEventAnalytics']>;
    metrics: ReturnType<MetricsLogger['getMetricsAnalytics']>;
    errors: ReturnType<ErrorLogger['getErrorAnalytics']>;
  } {
    return {
      access: this.accessLogger.getAccessStats(),
      events: this.eventLogger.getEventAnalytics(),
      metrics: this.metricsLogger.getMetricsAnalytics(),
      errors: this.errorLogger.getErrorAnalytics()
    };
  }

  public flushAllBuffers(): void {
    this.accessLogger.flushBuffer();
    this.eventLogger.flushBuffer();
    this.metricsLogger.flushBuffer();
    this.errorLogger.flushBuffer();
  }

  public clearAllStoredLogs(): void {
    this.accessLogger.clearStoredLogs();
    this.eventLogger.clearStoredLogs();
    this.metricsLogger.clearStoredLogs();
    this.errorLogger.clearStoredLogs();
  }

  // Private helper methods for performance monitoring

  private logPageLoadMetrics(navEntry: PerformanceNavigationTiming): void {
    const metrics = {
      dns_lookup: Math.round(navEntry.domainLookupEnd - navEntry.domainLookupStart),
      tcp_connect: Math.round(navEntry.connectEnd - navEntry.connectStart),
      ssl_handshake: navEntry.secureConnectionStart > 0 ? Math.round(navEntry.connectEnd - navEntry.secureConnectionStart) : 0,
      ttfb: Math.round(navEntry.responseStart - navEntry.requestStart),
      dom_content_loaded: Math.round(navEntry.domContentLoadedEventEnd - navEntry.navigationStart),
      page_load: Math.round(navEntry.loadEventEnd - navEntry.navigationStart)
    };

    Object.entries(metrics).forEach(([metric, value]) => {
      if (value > 0) {
        this.metricsLogger.logGauge(`page_${metric}`, value, 'milliseconds', {
          url: window.location.pathname,
          navigation_type: navEntry.type.toString()
        });
      }
    });

    this.eventLogger.logPerformanceEvent('page_load', metrics.page_load, 'navigation', {
      url: window.location.href,
      ...metrics
    });
  }

  private logResourceLoadMetrics(entry: PerformanceResourceTiming): void {
    const duration = Math.round(entry.responseEnd - entry.startTime);
    const resourceType = this.getResourceType(entry.name);

    this.metricsLogger.logTimer(`resource_load_${resourceType}`, entry.startTime, {
      resource_type: resourceType,
      url: entry.name,
      transfer_size: entry.transferSize.toString()
    });

    if (duration > 1000) { // Log slow resources
      this.eventLogger.logPerformanceEvent('slow_resource_load', duration, 'resource_loader', {
        url: entry.name,
        resourceType,
        transferSize: entry.transferSize
      });
    }
  }

  private logLongTask(entry: PerformanceEntry): void {
    const duration = Math.round(entry.duration);
    
    this.eventLogger.warn('Long task detected', {
      eventType: 'performance',
      action: 'long_task',
      component: 'main_thread',
      duration,
      name: entry.name,
      startTime: entry.startTime
    });

    this.metricsLogger.logGauge('long_task_duration', duration, 'milliseconds', {
      task_name: entry.name
    });
  }

  private extractUrlPattern(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.replace(/\/\d+/g, '/:id').replace(/\/[a-f0-9-]{36}/g, '/:uuid');
    } catch {
      return url;
    }
  }

  private getResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    
    if (['js', 'mjs'].includes(extension || '')) return 'javascript';
    if (['css'].includes(extension || '')) return 'stylesheet';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(extension || '')) return 'image';
    if (['woff', 'woff2', 'ttf', 'otf'].includes(extension || '')) return 'font';
    if (['json', 'xml'].includes(extension || '')) return 'xhr';
    
    return 'other';
  }

  // Getters for direct logger access (if needed)
  public get access(): AccessLogger { return this.accessLogger; }
  public get event(): EventLogger { return this.eventLogger; }
  public get metrics(): MetricsLogger { return this.metricsLogger; }
  public get error(): ErrorLogger { return this.errorLogger; }
  public getSessionId(): string { return this.sessionId; }
}