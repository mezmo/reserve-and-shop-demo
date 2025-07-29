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
  private logFile = '/tmp/restaurant-performance.log';
  private logBuffer: string[] = [];

  private constructor() {
    this.config = this.loadConfig();
    this.sessionId = this.generateSessionId();
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
      const stored = localStorage.getItem('performance-config');
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading performance config:', error);
    }
    return DEFAULT_CONFIG;
  }

  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem('performance-config', JSON.stringify(this.config));
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

    const fullEntry: PerformanceLogEntry = {
      ...entry,
      sessionId: this.config.sessionTracking ? this.sessionId : undefined
    };

    const formattedEntry = this.formatLogEntry(fullEntry);
    this.writeToFile(formattedEntry);
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
      // Try to write using navigator.sendBeacon for reliable delivery
      if ('sendBeacon' in navigator) {
        const blob = new Blob([content], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('logFile', blob, 'performance.log');
        formData.append('filePath', this.logFile);
        
        const success = navigator.sendBeacon('/api/log-beacon', formData);
        if (!success) {
          throw new Error('sendBeacon failed');
        }
      } else {
        // Fallback: create a downloadable file for manual inspection
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
}

export default PerformanceLogger;