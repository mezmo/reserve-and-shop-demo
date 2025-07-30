import { BaseFormatter } from './formatters/BaseFormatter';
import { LoggerType } from './config/LoggerConfig';

export class FormatRegistry {
  private static instance: FormatRegistry;
  private formatters: Map<string, BaseFormatter> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): FormatRegistry {
    if (!FormatRegistry.instance) {
      FormatRegistry.instance = new FormatRegistry();
    }
    return FormatRegistry.instance;
  }

  register(name: string, formatter: BaseFormatter): void {
    this.formatters.set(name, formatter);
    console.log(`📝 Registered formatter: ${name} (${formatter.getDisplayName()})`);
  }

  unregister(name: string): void {
    this.formatters.delete(name);
    console.log(`🗑️ Unregistered formatter: ${name}`);
  }

  getFormatter(name: string): BaseFormatter | undefined {
    return this.formatters.get(name);
  }

  getAllFormatters(): { name: string; formatter: BaseFormatter }[] {
    return Array.from(this.formatters.entries()).map(([name, formatter]) => ({
      name,
      formatter
    }));
  }

  getFormattersForLoggerType(loggerType: LoggerType): { name: string; formatter: BaseFormatter }[] {
    return this.getAllFormatters().filter(({ formatter }) => 
      formatter.supportsLoggerType(loggerType)
    );
  }

  getFormatterNames(): string[] {
    return Array.from(this.formatters.keys());
  }

  getFormatterNamesForLoggerType(loggerType: LoggerType): string[] {
    return this.getFormattersForLoggerType(loggerType).map(({ name }) => name);
  }

  // Auto-discovery method (for future extensibility)
  discoverFormatters(): void {
    // This would scan the formatters directory for new formatter classes
    // For now, we'll manually register the built-in formatters
    console.log('🔍 Discovering formatters...');
    
    // Import and register built-in formatters
    this.loadBuiltInFormatters();
  }

  private async loadBuiltInFormatters(): Promise<void> {
    try {
      // Dynamic imports for built-in formatters
      const { JSONFormatter } = await import('./formatters/JSONFormatter');
      const { CLFFormatter } = await import('./formatters/CLFFormatter');
      const { StringFormatter } = await import('./formatters/StringFormatter');
      const { CSVFormatter } = await import('./formatters/CSVFormatter');
      const { XMLFormatter } = await import('./formatters/XMLFormatter');
      const { CustomFormatter } = await import('./formatters/CustomFormatter');

      // Register all built-in formatters
      this.register('json', new JSONFormatter());
      this.register('clf', new CLFFormatter());
      this.register('string', new StringFormatter());
      this.register('csv', new CSVFormatter());
      this.register('xml', new XMLFormatter());
      this.register('custom', new CustomFormatter());

      console.log(`✅ Loaded ${this.formatters.size} built-in formatters`);
    } catch (error) {
      console.warn('⚠️ Some formatters failed to load:', error);
    }
  }

  // Utility methods for format comparison
  compareFormats(loggerType: LoggerType, sampleData: any): {
    formatName: string;
    output: string;
    characteristics: any;
  }[] {
    const results = [];
    const formatters = this.getFormattersForLoggerType(loggerType);

    for (const { name, formatter } of formatters) {
      try {
        const output = formatter.format(sampleData);
        const characteristics = formatter.getPerformanceCharacteristics();
        
        results.push({
          formatName: name,
          output: typeof output === 'string' ? output : '[Binary Data]',
          characteristics
        });
      } catch (error) {
        results.push({
          formatName: name,
          output: `Error: ${error.message}`,
          characteristics: null
        });
      }
    }

    return results;
  }

  // Get format recommendations based on use case
  getRecommendations(useCase: 'development' | 'production' | 'analytics' | 'debugging'): {
    loggerType: LoggerType;
    recommendedFormat: string;
    reason: string;
  }[] {
    const recommendations = [];

    switch (useCase) {
      case 'development':
        recommendations.push(
          { loggerType: 'access', recommendedFormat: 'string', reason: 'Human readable for debugging' },
          { loggerType: 'event', recommendedFormat: 'json', reason: 'Structured but readable' },
          { loggerType: 'metrics', recommendedFormat: 'json', reason: 'Easy to parse and visualize' },
          { loggerType: 'error', recommendedFormat: 'string', reason: 'Stack traces readable' }
        );
        break;
      case 'production':
        recommendations.push(
          { loggerType: 'access', recommendedFormat: 'clf', reason: 'Industry standard, efficient' },
          { loggerType: 'event', recommendedFormat: 'json', reason: 'Structured for analysis' },
          { loggerType: 'metrics', recommendedFormat: 'json', reason: 'Machine parseable' },
          { loggerType: 'error', recommendedFormat: 'json', reason: 'Structured error handling' }
        );
        break;
      case 'analytics':
        recommendations.push(
          { loggerType: 'access', recommendedFormat: 'csv', reason: 'Easy import to analytics tools' },
          { loggerType: 'event', recommendedFormat: 'json', reason: 'Rich event data structure' },
          { loggerType: 'metrics', recommendedFormat: 'csv', reason: 'Time series analysis' },
          { loggerType: 'error', recommendedFormat: 'json', reason: 'Error pattern analysis' }
        );
        break;
      case 'debugging':
        recommendations.push(
          { loggerType: 'access', recommendedFormat: 'string', reason: 'Quick visual inspection' },
          { loggerType: 'event', recommendedFormat: 'string', reason: 'Easy to follow event flow' },
          { loggerType: 'metrics', recommendedFormat: 'string', reason: 'Quick performance checks' },
          { loggerType: 'error', recommendedFormat: 'string', reason: 'Stack trace visibility' }
        );
        break;
    }

    return recommendations;
  }
}