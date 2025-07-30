import { BaseLogger } from './BaseLogger';
import { LogData, MetricsLogData } from '../config/LoggerConfig';

export class MetricsLogger extends BaseLogger {
  private metricsBuffer: Map<string, number[]> = new Map();
  private metricsTimestamps: Map<string, number[]> = new Map();

  getLoggerType(): string {
    return 'metrics';
  }

  protected enrichLogData(data: LogData): LogData {
    const metricsData: MetricsLogData = {
      ...data,
      metricName: data.metricName || 'unnamed_metric',
      value: data.value || 0,
      unit: data.unit || 'count',
      tags: data.tags || {},
      aggregationType: data.aggregationType || 'instant'
    };

    // Add metrics-specific enrichment
    metricsData.hostname = this.getHostname();
    metricsData.processId = this.getProcessId();
    
    // Calculate aggregated values if this is a recurring metric
    if (metricsData.aggregationType !== 'instant') {
      const aggregatedData = this.calculateAggregation(metricsData);
      metricsData.aggregatedValue = aggregatedData.value;
      metricsData.sampleCount = aggregatedData.count;
      metricsData.timeWindow = aggregatedData.timeWindow;
    }

    // Add performance context
    if (typeof performance !== 'undefined') {
      metricsData.performanceNow = performance.now();
    }

    return metricsData;
  }

  private getHostname(): string {
    if (typeof window !== 'undefined') {
      return window.location.hostname;
    }
    return 'localhost';
  }

  private getProcessId(): string {
    // In browser context, we'll use a session-based identifier
    return this.sessionId;
  }

  private calculateAggregation(data: MetricsLogData): { value: number; count: number; timeWindow: number } {
    const metricKey = `${data.metricName}_${JSON.stringify(data.tags)}`;
    const now = Date.now();
    const timeWindow = 60000; // 1 minute window
    
    // Initialize buffers if needed
    if (!this.metricsBuffer.has(metricKey)) {
      this.metricsBuffer.set(metricKey, []);
      this.metricsTimestamps.set(metricKey, []);
    }

    const values = this.metricsBuffer.get(metricKey)!;
    const timestamps = this.metricsTimestamps.get(metricKey)!;

    // Add current value
    values.push(data.value);
    timestamps.push(now);

    // Remove old values outside the time window
    while (timestamps.length > 0 && timestamps[0] < now - timeWindow) {
      timestamps.shift();
      values.shift();
    }

    // Calculate aggregated value based on type
    let aggregatedValue = 0;
    switch (data.aggregationType) {
      case 'sum':
        aggregatedValue = values.reduce((sum, val) => sum + val, 0);
        break;
      case 'average':
        aggregatedValue = values.reduce((sum, val) => sum + val, 0) / values.length;
        break;
      case 'max':
        aggregatedValue = Math.max(...values);
        break;
      case 'min':
        aggregatedValue = Math.min(...values);
        break;
      case 'count':
        aggregatedValue = values.length;
        break;
      default:
        aggregatedValue = data.value;
    }

    return {
      value: aggregatedValue,
      count: values.length,
      timeWindow
    };
  }

  // Convenience methods for common metric types
  logCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.info('Counter metric', {
      metricName: name,
      value,
      unit: 'count',
      aggregationType: 'sum',
      tags: tags || {}
    });
  }

  logGauge(name: string, value: number, unit: string = 'units', tags?: Record<string, string>): void {
    this.info('Gauge metric', {
      metricName: name,
      value,
      unit,
      aggregationType: 'instant',
      tags: tags || {}
    });
  }

  logTimer(name: string, startTime: number, tags?: Record<string, string>): void {
    const duration = Date.now() - startTime;
    this.info('Timer metric', {
      metricName: name,
      value: duration,
      unit: 'milliseconds',
      aggregationType: 'average',
      tags: tags || {}
    });
  }

  logHistogram(name: string, value: number, buckets: number[] = [10, 50, 100, 500, 1000], tags?: Record<string, string>): void {
    const bucket = this.findHistogramBucket(value, buckets);
    this.info('Histogram metric', {
      metricName: name,
      value,
      unit: 'distribution',
      aggregationType: 'histogram',
      tags: {
        ...tags,
        bucket: bucket.toString()
      },
      histogramBuckets: buckets
    });
  }

  logBusinessMetric(name: string, value: number, currency?: string, tags?: Record<string, string>): void {
    this.info('Business metric', {
      metricName: name,
      value,
      unit: currency || 'units',
      aggregationType: 'sum',
      tags: {
        ...tags,
        category: 'business'
      }
    });
  }

  logSystemMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    this.info('System metric', {
      metricName: name,
      value,
      unit,
      aggregationType: 'average',
      tags: {
        ...tags,
        category: 'system'
      }
    });
  }

  logPerformanceMetric(name: string, duration: number, tags?: Record<string, string>): void {
    const level = duration > 1000 ? 'WARN' : 'INFO';
    this.log(level, 'Performance metric', {
      metricName: name,
      value: duration,
      unit: 'milliseconds',
      aggregationType: 'average',
      tags: {
        ...tags,
        category: 'performance',
        performanceLevel: this.categorizePerformance(duration)
      }
    });
  }

  private findHistogramBucket(value: number, buckets: number[]): number {
    for (const bucket of buckets.sort((a, b) => a - b)) {
      if (value <= bucket) {
        return bucket;
      }
    }
    return Infinity; // For values larger than all buckets
  }

  private categorizePerformance(duration: number): string {
    if (duration < 100) return 'excellent';
    if (duration < 300) return 'good';
    if (duration < 1000) return 'acceptable';
    if (duration < 3000) return 'slow';
    return 'critical';
  }

  // Static factory method for creating metrics logger with common defaults
  static createDefault(sessionId: string): MetricsLogger {
    return new MetricsLogger({
      type: 'metrics',
      level: 'INFO',
      format: 'json', // JSON is ideal for metrics data
      enabled: true,
      destination: '/logs/metrics.log',
      formatOptions: {
        pretty: false, // Compact JSON for metrics
        includeMetadata: true
      }
    }, sessionId);
  }

  // Get metrics summary from stored logs
  getMetricsAnalytics(): {
    totalMetrics: number;
    metricTypes: Record<string, number>;
    avgValues: Record<string, number>;
    recentTrends: Record<string, { trend: 'up' | 'down' | 'stable'; change: number }>;
    topMetrics: Array<{ name: string; count: number; avgValue: number }>;
  } {
    const logs = this.getStoredLogs();
    const parsedLogs = logs.map(log => {
      try {
        return JSON.parse(log.content);
      } catch {
        return null;
      }
    }).filter(Boolean);

    const totalMetrics = parsedLogs.length;
    
    // Count metric types
    const metricTypes = parsedLogs.reduce((acc, log) => {
      const name = log.metricName || 'unknown';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate average values per metric
    const avgValues: Record<string, number> = {};
    const metricValues: Record<string, number[]> = {};
    
    parsedLogs.forEach(log => {
      const name = log.metricName || 'unknown';
      if (!metricValues[name]) {
        metricValues[name] = [];
      }
      if (typeof log.value === 'number') {
        metricValues[name].push(log.value);
      }
    });

    Object.entries(metricValues).forEach(([name, values]) => {
      avgValues[name] = values.reduce((sum, val) => sum + val, 0) / values.length;
    });

    // Calculate recent trends (compare last 10 values to previous 10)
    const recentTrends: Record<string, { trend: 'up' | 'down' | 'stable'; change: number }> = {};
    
    Object.entries(metricValues).forEach(([name, values]) => {
      if (values.length >= 10) {
        const recent = values.slice(-10);
        const previous = values.slice(-20, -10);
        
        if (previous.length >= 5) {
          const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
          const previousAvg = previous.reduce((sum, val) => sum + val, 0) / previous.length;
          const change = ((recentAvg - previousAvg) / previousAvg) * 100;
          
          let trend: 'up' | 'down' | 'stable';
          if (Math.abs(change) < 5) {
            trend = 'stable';
          } else if (change > 0) {
            trend = 'up';
          } else {
            trend = 'down';
          }
          
          recentTrends[name] = { trend, change: Math.round(change * 100) / 100 };
        }
      }
    });

    // Get top metrics by frequency and average value
    const topMetrics = Object.entries(metricTypes)
      .map(([name, count]) => ({
        name,
        count,
        avgValue: Math.round((avgValues[name] || 0) * 100) / 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalMetrics,
      metricTypes,
      avgValues: Object.fromEntries(
        Object.entries(avgValues).map(([key, value]) => [key, Math.round(value * 100) / 100])
      ),
      recentTrends,
      topMetrics
    };
  }

  // Clear metrics buffers (useful for testing or memory management)
  clearMetricsBuffers(): void {
    this.metricsBuffer.clear();
    this.metricsTimestamps.clear();
    console.log('📊 Metrics buffers cleared');
  }

  // Get current buffer status
  getBufferStatus(): Record<string, { values: number; oldestTimestamp: number; newestTimestamp: number }> {
    const status: Record<string, { values: number; oldestTimestamp: number; newestTimestamp: number }> = {};
    
    this.metricsBuffer.forEach((values, key) => {
      const timestamps = this.metricsTimestamps.get(key) || [];
      status[key] = {
        values: values.length,
        oldestTimestamp: timestamps.length > 0 ? timestamps[0] : 0,
        newestTimestamp: timestamps.length > 0 ? timestamps[timestamps.length - 1] : 0
      };
    });
    
    return status;
  }
}