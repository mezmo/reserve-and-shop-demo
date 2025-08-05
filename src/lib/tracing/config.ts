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

export function initializeTracing() {
  try {
    // Check if OTEL is enabled in config
    const otelConfig = localStorage.getItem('otel-config');
    if (!otelConfig) {
      console.log('OTEL tracing not initialized: No configuration found');
      return null;
    }
    
    const config = JSON.parse(otelConfig);
    if (!config.enabled || !config.pipelines?.traces?.enabled) {
      console.log('OTEL tracing not initialized: Disabled in configuration');
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

    // Configure OTLP exporter to send to local collector
    // Use the same base URL as the frontend to ensure proper routing
    const baseUrl = window.location.origin.replace(':8080', ':4318');
    const exporter = new OTLPTraceExporter({
      url: `${baseUrl}/v1/traces`, // HTTP endpoint  
      headers: {}, // Collector handles authentication to Mezmo
    });

    // Create tracer provider
    const provider = new WebTracerProvider({
      resource,
    });

    // Add batch processor for efficient trace export
    provider.addSpanProcessor(new BatchSpanProcessor(exporter, {
      maxQueueSize: 100,
      maxExportBatchSize: 50,
      scheduledDelayMillis: 500, // Send every 500ms
      exportTimeoutMillis: 30000,
    }));

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

    console.log('OTEL tracing initialized successfully');
    return provider;
  } catch (error) {
    console.error('Failed to initialize OTEL tracing:', error);
    return null;
  }
}

// Helper to check if tracing is enabled
export function isTracingEnabled(): boolean {
  try {
    const otelConfig = localStorage.getItem('otel-config');
    if (!otelConfig) return false;
    
    const config = JSON.parse(otelConfig);
    return config.enabled && config.pipelines?.traces?.enabled;
  } catch {
    return false;
  }
}