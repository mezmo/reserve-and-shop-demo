import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';

// Check if OTEL collector is available - Updated for enhanced status monitoring
async function checkOTELCollectorHealth(): Promise<boolean> {
  try {
    const response = await fetch('/api/otel/status');
    if (!response.ok) {
      console.warn('OTEL collector health check failed: HTTP', response.status);
      return false;
    }
    
    const status = await response.json();
    
    // Enhanced health check using new status response format
    const isCollectorRunning = status.status === 'connected' && status.pid;
    const isCollectorHealthy = status.healthChecks?.collector === true;
    const hasTracesEnabled = status.enabledPipelines?.traces === true;
    const isOverallHealthy = status.isHealthy === true;
    
    const healthStatus = isCollectorRunning && isCollectorHealthy && hasTracesEnabled && isOverallHealthy;
    
    if (!healthStatus) {
      console.warn('OTEL collector health check failed:', {
        running: isCollectorRunning,
        healthy: isCollectorHealthy, 
        tracesEnabled: hasTracesEnabled,
        overall: isOverallHealthy,
        errors: status.errors
      });
    }
    
    return healthStatus;
  } catch (error) {
    console.warn('OTEL collector health check failed:', error);
    return false;
  }
}

export async function initializeTracing() {
  try {
    // Enhanced backend configuration loading with proper error handling
    console.log('🔄 Initializing OTEL tracing - loading configuration from backend...');
    
    const configUrl = `${window.location.origin.replace(':8080', ':3001')}/api/config/otel`;
    const response = await fetch(configUrl);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('OTEL tracing not initialized: Configuration endpoint not found');
      } else if (response.status === 503) {
        console.log('OTEL tracing not initialized: Configuration service unavailable');
      } else {
        console.log(`OTEL tracing not initialized: Configuration request failed (HTTP ${response.status})`);
      }
      return null;
    }
    
    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      console.error('OTEL tracing not initialized: Invalid configuration response format');
      return null;
    }
    
    if (!result.success) {
      console.log('OTEL tracing not initialized: Configuration marked as failed:', result.error || 'Unknown error');
      return null;
    }
    
    const config = result.config;
    if (!config) {
      console.log('OTEL tracing not initialized: No configuration data received');
      return null;
    }
    
    if (!config.enabled) {
      console.log('OTEL tracing not initialized: OTEL disabled in configuration');
      return null;
    }
    
    if (!config.pipelines?.traces?.enabled) {
      console.log('OTEL tracing not initialized: Traces pipeline disabled in configuration');
      return null;
    }
    
    if (!config.pipelines.traces.ingestionKey) {
      console.log('OTEL tracing not initialized: No traces ingestion key configured');
      return null;
    }
    
    // Enhanced collector availability check with detailed error reporting
    console.log('🔍 Verifying OTEL collector availability...');
    const isHealthy = await checkOTELCollectorHealth();
    if (!isHealthy) {
      console.log('OTEL tracing disabled: Collector health check failed - see previous warnings for details');
      return null;
    }

    console.log('Initializing OTEL tracing with config:', {
      serviceName: config.serviceName,
      tracesEnabled: config.pipelines?.traces?.enabled
    });

    // Create resource identifying the service
    const resource = Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName || 'restaurant-app-frontend',
        [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 'demo',
        'service.tags': config.tags || 'restaurant-app,otel,frontend',
        'service.instance.id': `frontend-${Date.now()}`
      })
    );

    // Configure OTLP exporter to send via backend proxy
    // This avoids direct browser connection to OTEL collector port
    const baseUrl = window.location.origin.replace(':8080', ':3001');
    const exporter = new OTLPTraceExporter({
      url: `${baseUrl}/api/traces/v1/traces`, // Proxy through backend
      headers: {
        'Content-Type': 'application/x-protobuf'
      }
    });

    // Create tracer provider
    const provider = new WebTracerProvider({
      resource,
    });

    // Add batch processor for efficient trace export with error handling
    provider.addSpanProcessor(new BatchSpanProcessor(exporter, {
      maxQueueSize: 100,
      maxExportBatchSize: 50,
      scheduledDelayMillis: 2000, // Send every 2 seconds (less aggressive)
      exportTimeoutMillis: 10000, // Shorter timeout
    }));
    
    // Add error handler for export failures
    provider.addSpanProcessor({
      onStart: () => {},
      onEnd: () => {},
      forceFlush: async () => {},
      shutdown: async () => {},
      export: (spans, resultCallback) => {
        // This is a fallback - the actual export happens in BatchSpanProcessor
        resultCallback({ code: 0 }); // Success
      }
    });

    // Set global propagator for trace context
    provider.register({
      propagator: new W3CTraceContextPropagator(),
    });

    // Register automatic instrumentations
    registerInstrumentations({
      instrumentations: [
        new FetchInstrumentation({
          propagateTraceHeaderCorsUrls: [
            'http://localhost:3001', // Backend API
            /.*/  // For stress testing, propagate to all URLs
          ],
          clearTimingResources: true,
          applyCustomAttributesOnSpan: (span, request, response) => {
            const url = new URL(request.url || request);
            span.setAttributes({
              'http.request.body.size': request.headers?.get?.('content-length') || 0,
              'http.response.body.size': response?.headers?.get?.('content-length') || 0,
              'http.url.path': url.pathname,
              'http.url.host': url.host,
            });
          },
        }),
        new XMLHttpRequestInstrumentation({
          propagateTraceHeaderCorsUrls: [
            'http://localhost:3001',
            /.*/
          ],
        }),
        new UserInteractionInstrumentation({
          eventNames: ['click', 'submit', 'change'],
          shouldPreventSpanCreation: (eventType, element, span) => {
            // Prevent spans for noise elements
            const tagName = element.tagName?.toUpperCase();
            return tagName === 'HTML' || tagName === 'BODY';
          },
        }),
      ],
    });

    // Add global error handler for tracing issues
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const reasonStr = typeof reason === 'string' ? reason : reason?.message || '';
      
      if (reasonStr.includes('4318') || 
          reasonStr.includes('traces') || 
          reasonStr.includes('503') ||
          reasonStr.includes('Service Unavailable')) {
        console.warn('OTEL trace export failed - OTEL collector not available, silencing errors');
        event.preventDefault(); // Prevent console spam
      }
    });
    
    // Also handle fetch errors specifically for the traces endpoint
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        // Don't log 503 errors for trace endpoints
        if (response.status === 503 && args[0]?.toString().includes('/api/traces/')) {
          return response; // Return quietly
        }
        return response;
      } catch (error) {
        // Silently handle trace export failures
        if (args[0]?.toString().includes('/api/traces/')) {
          console.warn('Trace export failed silently - OTEL collector unavailable');
          return new Response('', { status: 503 });
        }
        throw error;
      }
    };
    
    console.log('OTEL tracing initialized successfully');
    console.log(`Traces will be sent via backend proxy to: ${baseUrl}/api/traces/v1/traces`);
    return provider;
  } catch (error) {
    // Enhanced error handling for unavailable collector
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('❌ Failed to initialize OTEL tracing: Network error - backend unreachable');
    } else if (error instanceof SyntaxError) {
      console.error('❌ Failed to initialize OTEL tracing: Invalid response format from backend');
    } else {
      console.error('❌ Failed to initialize OTEL tracing:', error.message || error);
    }
    
    // Log additional debugging information
    console.warn('OTEL tracing initialization failed - check:');
    console.warn('  • Backend server is running on port 3001');
    console.warn('  • OTEL collector is configured and running');
    console.warn('  • Network connectivity to backend');
    console.warn('  • Console for additional error details above');
    
    return null;
  }
}

// Helper to check if tracing is enabled
export async function isTracingEnabled(): Promise<boolean> {
  try {
    const response = await fetch(`${window.location.origin.replace(':8080', ':3001')}/api/config/otel`);
    if (!response.ok) return false;
    
    const result = await response.json();
    if (!result.success) return false;
    
    const config = result.config;
    return config.enabled && config.pipelines?.traces?.enabled;
  } catch {
    return false;
  }
}

// Helper to reinitialize tracing when configuration changes
export function reinitializeTracing() {
  console.log('Reinitializing OTEL tracing after configuration change...');
  return initializeTracing();
}