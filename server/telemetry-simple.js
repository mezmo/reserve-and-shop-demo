import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import fs from 'fs';

// Simple OpenTelemetry initialization focused on getting traces to the collector
export async function initializeOTEL() {
  try {
    console.log('🔧 Initializing OpenTelemetry SDK (simplified) for backend server...');
    
    // Read configuration from ConfigManager (loaded from agents-config.json)
    const ConfigManager = (await import('./services/configManager.js')).default;
    const configManager = ConfigManager.getInstance();
    const otelConfig = configManager.getConfig('otel');
    
    if (!otelConfig.enabled) {
      console.log('OTEL tracing disabled in configuration');
      return null;
    }
    
    if (!otelConfig.pipelines?.traces?.enabled) {
      console.log('OTEL traces pipeline disabled in configuration');
      return null;
    }
    
    console.log('📊 OTEL configuration loaded:', {
      serviceName: otelConfig.serviceName,
      tracesEnabled: otelConfig.pipelines?.traces?.enabled
    });
    
    // Create resource
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: otelConfig.serviceName || 'restaurant-app-backend',
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 'demo',
      'service.tags': otelConfig.tags || 'restaurant-app,otel,backend',
    });
    
    // Create provider
    const provider = new NodeTracerProvider({
      resource: resource,
    });
    
    // Configure OTLP HTTP exporter - simplified configuration
    // Note: If collector is not running, traces will fail gracefully
    const otlpExporter = new OTLPTraceExporter({
      url: 'http://localhost:4318/v1/traces',
      headers: {},
      concurrencyLimit: 10,
    });
    
    // Add console exporter for debugging
    const consoleExporter = new ConsoleSpanExporter();
    
    // Add batch processor with OTLP exporter
    provider.addSpanProcessor(
      new BatchSpanProcessor(otlpExporter, {
        maxQueueSize: 100,
        maxExportBatchSize: 10,
        scheduledDelayMillis: 1000,
        exportTimeoutMillis: 30000,
      })
    );
    
    // Optionally add console output for debugging
    if (process.env.OTEL_DEBUG === 'true') {
      provider.addSpanProcessor(new BatchSpanProcessor(consoleExporter));
    }
    
    // Register the provider
    provider.register();
    
    // Register instrumentations
    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation({
          enabled: true,
          ignoreIncomingPaths: [
            /\/health/,
            /\/metrics/,
            /\/api\/otel\/status/,
          ],
          ignoreOutgoingUrls: [
            /localhost:4318/,
            /localhost:4317/,
            /localhost:8888/,
          ],
        }),
        new ExpressInstrumentation({
          enabled: true,
        }),
      ],
    });
    
    console.log('✅ OpenTelemetry SDK initialized successfully (simplified)');
    console.log('   Service Name:', otelConfig.serviceName || 'restaurant-app-backend');
    console.log('   Traces endpoint: http://localhost:4318/v1/traces');
    console.log('   Debug mode:', process.env.OTEL_DEBUG === 'true' ? 'enabled' : 'disabled');
    
    // Test the exporter
    setTimeout(async () => {
      console.log('🔍 Testing OTLP exporter...');
      try {
        const { trace } = await import('@opentelemetry/api');
        const tracer = trace.getTracer('telemetry-test', '1.0.0');
        const span = tracer.startSpan('telemetry-initialization-test');
        span.setAttribute('test', true);
        span.setAttribute('timestamp', new Date().toISOString());
        span.end();
        console.log('✅ Test span created and sent');
      } catch (error) {
        console.error('❌ Test span failed:', error);
      }
    }, 2000);
    
    return provider;
  } catch (error) {
    console.error('❌ Failed to initialize OpenTelemetry:', error);
    return null;
  }
}

// Helper to check if tracing is enabled
export function isTracingEnabled() {
  try {
    const ConfigManager = require('./services/configManager.js').default;
    const configManager = ConfigManager.getInstance();
    const otelConfig = configManager.getConfig('otel');
    return otelConfig.enabled && otelConfig.pipelines?.traces?.enabled;
  } catch {
    return false;
  }
}