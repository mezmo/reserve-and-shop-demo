import { PerformanceConfig, PerformanceLogEntry, PerformanceEventType, NavigationTiming } from '@/types/performance';

const DEFAULT_CONFIG: PerformanceConfig = {
  enabled: true,
  format: 'string',
  level: 'basic',
  sessionTracking: true,
  logRotation: false
};

class PerformanceLogger {
  private static instance: PerformanceLogger;
  private config: PerformanceConfig;
  private sessionId: string;
  private logFile = '/tmp/codeuser/restaurant-performance.log';
  private logBuffer: string[] = [];
  private requestId: string;
  private correlationId: string;
  private logCounter: number = 0;

  private constructor() {
    this.config = this.loadConfig();
    this.sessionId = this.generateSessionId();
    this.requestId = this.generateRequestId();
    this.correlationId = this.generateCorrelationId();
    this.initializeLogging();
  }

  static getInstance(): PerformanceLogger {
    if (!PerformanceLogger.instance) {
      PerformanceLogger.instance = new PerformanceLogger();
    }
    return PerformanceLogger.instance;
  }

  private loadConfig(): PerformanceConfig {
    try {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('performance-config');
        if (stored) {
          return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
        }
      }
    } catch (error) {
      console.error('Error loading performance config:', error);
    }
    return DEFAULT_CONFIG;
  }

  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    try {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('performance-config', JSON.stringify(this.config));
      }
    } catch (error) {
      console.error('Error saving performance config:', error);
    }
  }

  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private getLogLevel(eventType: string, context?: any): string {
    // Realistic log level distribution for production systems
    // INFO: 70%, WARN: 20%, DEBUG: 8%, ERROR: 2%
    
    const errorEvents = ['ERROR', 'HTTP_ERROR', 'PAYMENT_PROCESSING_FAILED', 'NETWORK_ERROR'];
    const warnEvents = ['HTTP_REQUEST', 'SLOW_RESPONSE', 'RETRY_ATTEMPT', 'RATE_LIMIT_APPROACHED'];
    const debugEvents = ['USER_INTERACTION', 'COMPONENT_MOUNT', 'NAVIGATION'];
    
    if (errorEvents.includes(eventType)) {
      return 'ERROR';
    } else if (warnEvents.includes(eventType) || (context?.duration && context.duration > 1000)) {
      return 'WARN';
    } else if (debugEvents.includes(eventType)) {
      return 'DEBUG';
    } else {
      return 'INFO'; // Default for most business events
    }
  }

  private getStandardFields(): any {
    return {
      'service.name': 'restaurant-app',
      'service.version': '1.2.4',
      'service.environment': 'demo',
      'deployment.version': 'v2024.11.1',
      'host.name': 'web-server-01',
      'container.id': `cnt_${Math.random().toString(36).substr(2, 12)}`,
      'x-request-id': this.requestId,
      'x-correlation-id': this.correlationId,
      'log.sequence': ++this.logCounter
    };
  }

  private getPerformanceMetrics(): any {
    // Simulate realistic system metrics
    if (typeof performance !== 'undefined' && performance.memory) {
      return {
        'memory.used': Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
        'memory.total': Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), // MB
        'memory.limit': Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024), // MB
        'performance.now': Math.round(performance.now())
      };
    }
    return {
      'memory.used': Math.floor(Math.random() * 200) + 100, // 100-300MB
      'memory.total': Math.floor(Math.random() * 100) + 300, // 300-400MB
      'cpu.usage': Math.round(Math.random() * 30 + 10), // 10-40%
      'gc.collections': Math.floor(Math.random() * 5) // 0-5 recent collections
    };
  }

  private getBusinessContext(): any {
    const customerTiers = ['free', 'premium', 'enterprise'];
    const regions = ['us-east-1', 'us-west-2', 'eu-west-1'];
    const featureFlags = {
      'new_checkout_flow': Math.random() > 0.5,
      'ab_test_new_ui': Math.random() > 0.7,
      'payment_retry_enabled': Math.random() > 0.2,
      'advanced_analytics': Math.random() > 0.3
    };
    
    return {
      'customer.tier': customerTiers[Math.floor(Math.random() * customerTiers.length)],
      'region': regions[Math.floor(Math.random() * regions.length)],
      'feature_flags': featureFlags,
      'ab_test.cohort': Math.random() > 0.5 ? 'control' : 'variant',
      'data.classification': 'pii_sensitive' // Mark logs containing sensitive data
    };
  }

  private initializeLogging(): void {
    if (this.config.enabled) {
      this.logEntry({
        timestamp: new Date().toISOString(),
        event: 'SESSION_START',
        sessionId: this.sessionId,
        details: {
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          url: window.location.href
        }
      });
    }
  }

  private formatLogEntry(entry: PerformanceLogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify(entry);
    } else if (this.config.format === 'clf' && this.isHttpRequest(entry)) {
      // Common Log Format: host ident authuser [timestamp] "method url protocol" status size
      return this.formatCLF(entry);
    } else {
      // String format: timestamp - event - path - duration - session
      const parts = [
        entry.timestamp,
        entry.event,
        entry.path || '',
        entry.duration ? `${entry.duration}ms` : '',
        this.config.sessionTracking ? entry.sessionId : ''
      ].filter(Boolean);
      
      return parts.join(' - ');
    }
  }

  private isHttpRequest(entry: PerformanceLogEntry): boolean {
    return entry.event === 'HTTP_REQUEST' || 
           entry.event === 'PAGE_LOAD' || 
           entry.event === 'ROUTE_CHANGE' ||
           entry.event === 'DATA_FETCH';
  }

  private formatCLF(entry: PerformanceLogEntry): string {
    const host = window.location.hostname || 'localhost';
    const ident = '-'; // Usually unavailable in web context
    const authuser = '-'; // Could be enhanced to use actual user if available
    const timestamp = new Date(entry.timestamp).toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const method = entry.details?.method || 'GET';
    const url = entry.path || window.location.pathname;
    const protocol = 'HTTP/1.1';
    const status = entry.details?.status || '200';
    const size = entry.details?.size || entry.duration || '-';
    
    return `${host} ${ident} ${authuser} [${timestamp}] "${method} ${url} ${protocol}" ${status} ${size}`;
  }

  private async writeToFile(content: string): Promise<void> {
    try {
      // Enhanced console logging for better visibility
      console.group(`🚀 PERFORMANCE LOG - ${new Date().toLocaleTimeString()}`);
      console.log(`📊 ${content}`);
      console.groupEnd();
      
      // Store logs in localStorage for persistence and debugging
      try {
        const existingLogs = localStorage.getItem('performance-logs') || '[]';
        const logs = JSON.parse(existingLogs);
        logs.push({
          timestamp: new Date().toISOString(),
          content,
          session: this.sessionId
        });
        
        // Keep only last 100 logs to prevent storage overflow
        if (logs.length > 100) {
          logs.splice(0, logs.length - 100);
        }
        
        localStorage.setItem('performance-logs', JSON.stringify(logs));
      } catch (storageError) {
        console.warn('Could not store performance log in localStorage:', storageError);
      }
      
      // Buffer content for batch writing to file
      this.bufferLogEntry(content);
    } catch (error) {
      console.error('Error writing performance log:', error);
    }
  }

  logEntry(entry: Omit<PerformanceLogEntry, 'sessionId'>): void {
    if (!this.config.enabled) return;

    // Create enhanced entry with production-ready fields
    const enhancedEntry: PerformanceLogEntry = {
      ...entry,
      sessionId: this.config.sessionTracking ? this.sessionId : undefined,
      level: entry.level || this.getLogLevel(entry.event, entry.details),
      ...this.getStandardFields(),
      system: this.getPerformanceMetrics(),
      business: this.getBusinessContext(),
      // Add structured message template
      message_template: this.getMessageTemplate(entry.event),
      // Add sampling flag for high-frequency events
      sampled: this.shouldSample(entry.event),
      // Add error classification if applicable
      ...(entry.event.includes('ERROR') && { error_code: this.getErrorCode(entry.event) })
    };

    const formattedEntry = this.formatLogEntry(enhancedEntry);
    this.writeToFile(formattedEntry);
  }

  private shouldSample(eventType: string): boolean {
    // Sample high-frequency events to reduce log volume
    const highFrequencyEvents = ['USER_INTERACTION', 'COMPONENT_MOUNT', 'NAVIGATION'];
    if (highFrequencyEvents.includes(eventType)) {
      return Math.random() > 0.7; // Only log 30% of high-frequency events
    }
    return true; // Always log business and error events
  }

  private getMessageTemplate(eventType: string): string {
    const templates = {
      'SESSION_START': 'User session initiated for {sessionId}',
      'USER_INTERACTION': 'User performed {interactionType} on {element}',
      'HTTP_REQUEST': 'HTTP {method} request to {url} completed with status {status}',
      'PAYMENT_PROCESSING': 'Payment {status} for order {orderId} amount {amount} {currency}',
      'CART_ACTION': 'User {action} product {productName} quantity {quantity}',
      'ERROR': 'Error occurred: {error} in context {context}',
      'COMPONENT_MOUNT': 'Component {componentName} mounted in {duration}ms'
    };
    return templates[eventType] || 'Event {event} occurred';
  }

  private getErrorCode(eventType: string): string {
    const errorCodes = {
      'HTTP_ERROR': 'HTTP_REQUEST_FAILED',
      'PAYMENT_PROCESSING_FAILED': 'PAYMENT_DECLINED',
      'NETWORK_ERROR': 'NETWORK_TIMEOUT',
      'ERROR': 'GENERAL_ERROR'
    };
    return errorCodes[eventType] || 'UNKNOWN_ERROR';
  }

  private getPaymentErrorCode(cardNumber: string): string {
    // Simulate realistic payment error codes based on card type/number
    const errorCodes = [
      'INSUFFICIENT_FUNDS',
      'CARD_DECLINED',
      'EXPIRED_CARD',
      'INVALID_CVV',
      'PROCESSING_ERROR',
      'FRAUD_SUSPECTED',
      'VELOCITY_LIMIT_EXCEEDED',
      'CARD_NOT_SUPPORTED'
    ];
    
    // Use card number to deterministically assign error code for consistency
    const index = parseInt(cardNumber.slice(-2)) % errorCodes.length;
    return errorCodes[index];
  }

  logPageLoad(path: string): void {
    if (!this.config.enabled) return;

    const timing = this.getNavigationTiming();
    const loadTime = timing.loadComplete - timing.navigationStart;
    const responseSize = this.getDocumentSize();

    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'HTTP_REQUEST',
      path,
      duration: loadTime,
      details: {
        method: 'GET',
        status: 200,
        size: responseSize,
        navigationTiming: this.config.level === 'detailed' || this.config.level === 'debug' ? timing : undefined,
        performanceEntries: this.config.level === 'detailed' || this.config.level === 'debug' ? this.getPerformanceEntries() : undefined
      }
    });
  }

  logRouteChange(fromPath: string, toPath: string, duration: number): void {
    if (!this.config.enabled) return;

    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'ROUTE_CHANGE',
      path: `${fromPath} -> ${toPath}`,
      duration,
      details: this.config.level === 'debug' ? {
        fromPath,
        toPath,
        memoryUsage: this.getMemoryUsage()
      } : undefined
    });
  }

  logComponentMount(componentName: string, duration: number): void {
    if (!this.config.enabled || this.config.level === 'basic') return;

    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'COMPONENT_MOUNT',
      component: componentName,
      duration,
      details: this.config.level === 'debug' ? {
        memoryUsage: this.getMemoryUsage()
      } : undefined
    });
  }

  logUserInteraction(event: string, element: string, duration?: number): void {
    if (!this.config.enabled) return;

    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'USER_INTERACTION',
      duration,
      details: {
        interactionType: event,
        element,
        path: window.location.pathname
      }
    });
  }

  logDataFetch(operation: string, duration: number, method: string = 'GET', status: number = 200, size?: number): void {
    if (!this.config.enabled) return;

    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'HTTP_REQUEST',
      path: window.location.pathname,
      duration,
      details: {
        operation,
        method,
        status,
        size,
        path: window.location.pathname
      }
    });
  }

  logError(error: Error, context?: string): void {
    if (!this.config.enabled) return;

    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'ERROR',
      details: {
        error: error.message,
        stack: error.stack,
        context,
        path: window.location.pathname
      }
    });
  }

  logHttpSuccess(method: string, url: string, status: number, duration: number, size?: number, attempt?: number): void {
    if (!this.config.enabled) return;

    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'HTTP_REQUEST',
      path: url,
      duration,
      details: {
        method,
        status,
        size,
        attempt,
        success: true,
        statusText: this.getStatusText(status),
        path: window.location.pathname,
        // Add production HTTP logging fields
        response_time_category: this.categorizeResponseTime(duration),
        cache_status: Math.random() > 0.7 ? 'HIT' : 'MISS',
        cdn_pop: this.getRandomCdnPop(),
        user_agent_category: this.categorizeUserAgent(),
        rate_limit_remaining: Math.floor(Math.random() * 100) + 900, // 900-1000 requests remaining
        circuit_breaker_state: 'CLOSED',
        retry_after: attempt && attempt > 1 ? `${Math.pow(2, attempt - 1)}s` : null
      }
    });
  }

  private categorizeResponseTime(duration: number): string {
    if (duration < 100) return 'fast';
    if (duration < 300) return 'normal';
    if (duration < 1000) return 'slow';
    return 'critical';
  }

  private getRandomCdnPop(): string {
    const pops = ['NYC1', 'LAX1', 'CHI1', 'DFW1', 'ATL1', 'SEA1', 'MIA1'];
    return pops[Math.floor(Math.random() * pops.length)];
  }

  private categorizeUserAgent(): string {
    const categories = ['desktop_chrome', 'mobile_safari', 'desktop_firefox', 'mobile_chrome', 'tablet_safari'];
    return categories[Math.floor(Math.random() * categories.length)];
  }

  logHttpError(method: string, url: string, status: number, statusText: string, duration: number, response?: any, attempt?: number): void {
    if (!this.config.enabled) return;

    const errorType = status >= 500 ? 'SERVER_ERROR' : 'CLIENT_ERROR';
    
    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'HTTP_ERROR',
      path: url,
      duration,
      details: {
        method,
        status,
        statusText,
        attempt,
        errorType,
        response: this.config.level === 'debug' ? response : undefined,
        success: false,
        path: window.location.pathname
      }
    });

    // Also log as a general error for error tracking
    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'ERROR',
      details: {
        error: `HTTP ${status}: ${statusText}`,
        context: `${method} ${url}`,
        httpStatus: status,
        path: window.location.pathname
      }
    });
  }

  logHttpTimeout(method: string, url: string, timeout: number, attempt?: number): void {
    if (!this.config.enabled) return;

    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'HTTP_TIMEOUT',
      path: url,
      duration: timeout,
      details: {
        method,
        timeout,
        attempt,
        success: false,
        path: window.location.pathname
      }
    });

    // Also log as a general error
    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'ERROR',
      details: {
        error: `Request timeout after ${timeout}ms`,
        context: `${method} ${url}`,
        path: window.location.pathname
      }
    });
  }

  logHttpNetworkError(method: string, url: string, errorMessage: string, duration: number, attempt?: number): void {
    if (!this.config.enabled) return;

    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'HTTP_NETWORK_ERROR',
      path: url,
      duration,
      details: {
        method,
        errorMessage,
        attempt,
        success: false,
        path: window.location.pathname
      }
    });

    // Also log as a general error
    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'ERROR',
      details: {
        error: errorMessage,
        context: `${method} ${url}`,
        path: window.location.pathname
      }
    });
  }

  private getStatusText(status: number): string {
    const statusTexts: { [key: number]: string } = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout'
    };
    return statusTexts[status] || 'Unknown';
  }

  private getNavigationTiming(): NavigationTiming {
    try {
      // Use modern Navigation Timing API
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        return {
          loadStart: navigation.loadEventStart,
          domContentLoaded: navigation.domContentLoadedEventEnd,
          loadComplete: navigation.loadEventEnd,
          navigationStart: navigation.navigationStart,
          fetchStart: navigation.fetchStart,
          connectStart: navigation.connectStart,
          connectEnd: navigation.connectEnd,
          requestStart: navigation.requestStart,
          responseStart: navigation.responseStart,
          responseEnd: navigation.responseEnd,
          domInteractive: navigation.domInteractive
        };
      }
    } catch (error) {
      console.warn('Modern Navigation Timing API not available, falling back to deprecated API');
    }
    
    // Fallback to deprecated API
    const timing = performance.timing;
    return {
      loadStart: timing.loadEventStart - timing.navigationStart,
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      loadComplete: timing.loadEventEnd - timing.navigationStart,
      navigationStart: 0,
      fetchStart: timing.fetchStart - timing.navigationStart,
      connectStart: timing.connectStart - timing.navigationStart,
      connectEnd: timing.connectEnd - timing.navigationStart,
      requestStart: timing.requestStart - timing.navigationStart,
      responseStart: timing.responseStart - timing.navigationStart,
      responseEnd: timing.responseEnd - timing.navigationStart,
      domInteractive: timing.domInteractive - timing.navigationStart
    };
  }

  private getPerformanceEntries(): any[] {
    try {
      return performance.getEntriesByType('navigation').map(entry => ({
        name: entry.name,
        duration: entry.duration,
        startTime: entry.startTime
      }));
    } catch {
      return [];
    }
  }

  private getMemoryUsage(): any {
    try {
      // @ts-ignore - performance.memory is not in all browsers
      const memory = performance.memory;
      if (memory) {
        return {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        };
      }
    } catch {
      // Memory API not available
    }
    return null;
  }

  private getDocumentSize(): number {
    try {
      // Estimate document size from performance entries
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigationEntry && navigationEntry.transferSize) {
        return navigationEntry.transferSize;
      }
      
      // Fallback: estimate based on document length
      return document.documentElement.outerHTML.length;
    } catch {
      return 0;
    }
  }

  // Get current session ID
  getSessionId(): string {
    return this.sessionId;
  }

  // Manual log rotation
  rotateLogFile(): void {
    const timestamp = new Date().toISOString().split('T')[0];
    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'LOG_ROTATION',
      details: { newFile: `${this.logFile}-${timestamp}` }
    });
  }

  // Get stored logs from localStorage
  getStoredLogs(): any[] {
    try {
      const logs = localStorage.getItem('performance-logs');
      return logs ? JSON.parse(logs) : [];
    } catch {
      return [];
    }
  }

  // Clear stored logs
  clearStoredLogs(): void {
    try {
      localStorage.removeItem('performance-logs');
      console.log('🧹 Performance logs cleared from localStorage');
    } catch (error) {
      console.error('Error clearing performance logs:', error);
    }
  }

  // Buffer log entry for batch writing
  private bufferLogEntry(content: string): void {
    this.logBuffer.push(content);
    
    // Auto-flush buffer when it gets too large
    if (this.logBuffer.length >= 10) {
      this.flushLogBuffer();
    }
  }

  // Flush log buffer to file
  private async flushLogBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const content = this.logBuffer.join('\n') + '\n';
    const bufferCopy = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        // Browser environment: use sendBeacon
        const blob = new Blob([content], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('logFile', blob, 'performance.log');
        formData.append('filePath', this.logFile);
        
        const success = navigator.sendBeacon('/api/log-beacon', formData);
        if (!success) {
          throw new Error('sendBeacon failed');
        }
      } else if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        // Browser without sendBeacon or virtual user: use fetch
        const blob = new Blob([content], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('logFile', blob, 'performance.log');
        formData.append('filePath', this.logFile);
        
        // Use fetch as fallback for virtual users
        const response = await fetch('/api/log-beacon', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`Fetch failed: ${response.status}`);
        }
        
        console.log('✅ Performance logs sent via fetch');
      } else if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
        // Browser fallback: create a downloadable file for manual inspection
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        // Store the URL in sessionStorage for later retrieval
        const existingUrls = JSON.parse(sessionStorage.getItem('performance-log-urls') || '[]');
        existingUrls.push({
          url,
          timestamp: new Date().toISOString(),
          session: this.sessionId
        });
        sessionStorage.setItem('performance-log-urls', JSON.stringify(existingUrls));
        
        console.log(`📁 Performance log blob created: ${url}`);
        console.log('💡 You can download this from the Config page or access via sessionStorage');
      } else {
        // Server-side environment: log to console
        console.log('📝 Performance Log Buffer:', content);
      }
    } catch (error) {
      console.warn('Could not flush log buffer:', error);
      // Re-buffer the content for later retry
      this.logBuffer.unshift(...bufferCopy);
    }
  }

  // Manual flush method
  public async flushLogs(): Promise<void> {
    await this.flushLogBuffer();
  }

  // Enhanced cart action logging
  logCartAction(
    action: 'ADD' | 'REMOVE', 
    product: { id: string; name: string; price: number; category: string },
    quantityBefore: number,
    quantityAfter: number,
    cartTotal: number,
    duration?: number
  ): void {
    if (!this.config.enabled) return;

    const quantityChange = `${quantityBefore}->${quantityAfter}`;
    const actionType = action === 'ADD' ? 'CART_ADD' : 'CART_REMOVE';
    
    this.logEntry({
      timestamp: new Date().toISOString(),
      event: actionType,
      path: window.location.pathname,
      duration,
      details: {
        productId: product.id,
        productName: product.name,
        productPrice: product.price,
        productCategory: product.category,
        quantityBefore,
        quantityAfter,
        quantityChange,
        cartTotal: cartTotal.toFixed(2),
        action,
        path: window.location.pathname
      }
    });

    // Also log as user interaction for backwards compatibility with product ID
    this.logUserInteraction(
      'cart-action',
      `${action.toLowerCase()}-${product.id}-${product.name}-${product.category}`,
      duration
    );
  }

  // Cart session analytics
  logCartSession(itemCount: number, totalValue: number, sessionDuration: number): void {
    if (!this.config.enabled) return;

    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'CART_SESSION',
      duration: sessionDuration,
      details: {
        itemCount,
        totalValue: totalValue.toFixed(2),
        averageItemValue: itemCount > 0 ? (totalValue / itemCount).toFixed(2) : '0.00',
        path: window.location.pathname
      }
    });
  }

  logPaymentAttempt(
    paymentData: {
      cardNumber: string;
      expiryDate: string;
      cvv: string;
      cardHolderName: string;
    },
    customerData: {
      name: string;
      email: string;
      phone: string;
    },
    transactionData: {
      orderId: string;
      amount: number;
      currency: string;
      orderType: string;
      traceId?: string;
      spanId?: string;
      retryAttempt?: number;
    },
    status: 'initiated' | 'processing' | 'success' | 'failed',
    duration?: number
  ): void {
    if (!this.config.enabled) return;

    // Create structured log entry with enhanced error classification
    const logDetails: any = {
      // Business context
      status,
      orderId: transactionData.orderId,
      amount: transactionData.amount,
      currency: transactionData.currency,
      orderType: transactionData.orderType,
      paymentMethod: 'credit_card',
      processorUsed: 'stripe_demo',
      merchantId: 'MERCHANT_RESTAURANT_001',
      acquirer: 'FIRST_DATA',
      
      // Correlation fields
      traceId: transactionData.traceId,
      spanId: transactionData.spanId,
      parentSpanId: `span_${Math.random().toString(36).substr(2, 16)}`,
      
      // Error classification
      ...(status === 'failed' && {
        error_code: this.getPaymentErrorCode(paymentData.cardNumber),
        error_category: 'PAYMENT_PROCESSING',
        error_subcategory: 'CARD_DECLINED',
        retry_eligible: true,
        retry_attempt: transactionData.retryAttempt || 0
      }),
      
      // SLA and compliance tracking
      sla_threshold: 3000, // 3 second SLA for payment processing
      sla_exceeded: duration && duration > 3000,
      compliance_flags: {
        pci_dss_scope: true,
        data_retention_days: 90,
        audit_required: status === 'failed'
      },
      
      // Data classification markers
      data_classification: {
        level: 'restricted',
        contains_pii: true,
        contains_pci: true,
        redaction_required: true,
        retention_policy: 'payment_data_7_years'
      },
      
      path: window.location.pathname
    };

    // Add payment data based on status - more data as process progresses
    if (status === 'initiated') {
      logDetails.customerName = customerData.name;
      logDetails.email = customerData.email;
      logDetails.phone = customerData.phone;
    } else if (status === 'processing') {
      // Include payment details during processing
      logDetails.customerName = customerData.name;
      logDetails.email = customerData.email;
      logDetails.phone = customerData.phone;
      logDetails.creditCard = paymentData.cardNumber;
      logDetails.cvv = paymentData.cvv;
      logDetails.expiryDate = paymentData.expiryDate;
      logDetails.cardHolderName = paymentData.cardHolderName;
    } else if (status === 'success' || status === 'failed') {
      // Final status with complete transaction record
      logDetails.customerName = customerData.name;
      logDetails.email = customerData.email;
      logDetails.phone = customerData.phone;
      logDetails.creditCard = paymentData.cardNumber;
      logDetails.cvv = paymentData.cvv;
      logDetails.expiryDate = paymentData.expiryDate;
      logDetails.cardHolderName = paymentData.cardHolderName;
      logDetails.transactionComplete = true;
      logDetails.processingTime = duration;
    }

    // Use appropriate log level based on status
    const logLevel = status === 'failed' ? 'ERROR' : 
                    status === 'processing' && duration && duration > 2000 ? 'WARN' : 'INFO';

    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'PAYMENT_PROCESSING',
      level: logLevel,
      duration,
      details: logDetails
    });

    // Log additional audit event for compliance if payment contains sensitive operations
    if (status === 'success' || status === 'failed') {
      this.logAuditEvent('PAYMENT_COMPLETED', {
        orderId: transactionData.orderId,
        amount: transactionData.amount,
        result: status,
        customerName: customerData.name,
        creditCard: paymentData.cardNumber,
        compliance_required: true
      });
    }
  }

  private logAuditEvent(auditType: string, auditData: any): void {
    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'SECURITY_AUDIT',
      level: 'INFO',
      details: {
        audit_type: auditType,
        audit_data: auditData,
        audit_timestamp: new Date().toISOString(),
        audit_source: 'performance_logger',
        compliance_flags: {
          gdpr_applicable: true,
          pci_dss_required: auditType.includes('PAYMENT'),
          sox_compliance: auditType.includes('PAYMENT'),
          data_subject_rights: 'anonymization_required'
        }
      }
    });
  }

  // Security event logging
  logSecurityEvent(eventType: 'LOGIN_ATTEMPT' | 'PERMISSION_CHANGE' | 'SUSPICIOUS_ACTIVITY' | 'DATA_ACCESS', 
                   details: any): void {
    if (!this.config.enabled) return;

    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'SECURITY_EVENT',
      level: eventType === 'SUSPICIOUS_ACTIVITY' ? 'WARN' : 'INFO',
      details: {
        security_event_type: eventType,
        ...details,
        alert_required: eventType === 'SUSPICIOUS_ACTIVITY',
        investigation_id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        risk_score: this.calculateRiskScore(eventType, details)
      }
    });
  }

  private calculateRiskScore(eventType: string, details: any): number {
    // Simple risk scoring algorithm
    let score = 0;
    
    if (eventType === 'SUSPICIOUS_ACTIVITY') score += 70;
    if (eventType === 'LOGIN_ATTEMPT' && details.failed) score += 30;
    if (details.from_new_ip) score += 20;
    if (details.unusual_time) score += 15;
    if (details.multiple_attempts) score += 25;
    
    return Math.min(score, 100); // Cap at 100
  }

  logDataOperation(
    operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
    entityType: 'order' | 'reservation' | 'product' | 'settings',
    entityId: string,
    data?: any,
    duration?: number
  ): void {
    if (!this.config.enabled) return;

    // Create structured log with entity-specific data for Mezmo redaction demo
    const logDetails: any = {
      operation,
      entityType,
      entityId,
      path: window.location.pathname,
      storageType: 'localStorage'
    };

    // Include sensitive customer data in dataSnapshot for redaction testing
    if (data) {
      if (entityType === 'order') {
        // Extract key sensitive fields for clear redaction targets
        logDetails.customerName = data.customerName;
        logDetails.customerEmail = data.customerEmail;
        logDetails.customerPhone = data.customerPhone;
        logDetails.orderTotal = data.totalAmount;
        logDetails.orderType = data.type;
        logDetails.orderItems = data.items?.length || 0;
        logDetails.orderNotes = data.notes;
        // Full data snapshot for complete record
        logDetails.dataSnapshot = JSON.stringify(data);
      } else if (entityType === 'reservation') {
        // Extract reservation PII
        logDetails.customerName = data.customerName;
        logDetails.customerEmail = data.customerEmail;
        logDetails.customerPhone = data.customerPhone;
        logDetails.reservationDate = data.date;
        logDetails.reservationTime = data.time;
        logDetails.partySize = data.partySize;
        logDetails.dataSnapshot = JSON.stringify(data);
      } else {
        // For products/settings, just include the data
        logDetails.dataSnapshot = JSON.stringify(data);
      }
    }

    this.logEntry({
      timestamp: new Date().toISOString(),
      event: 'DATA_OPERATION',
      duration,
      details: logDetails
    });
  }
}

export default PerformanceLogger;