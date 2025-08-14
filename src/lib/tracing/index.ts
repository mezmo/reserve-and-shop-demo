// OpenTelemetry Tracing Implementation for Restaurant App
export { initializeTracing, isTracingEnabled } from './config';
export { SessionTracker, createSessionTrackerContext } from './sessionTracker';

// Re-export commonly used OpenTelemetry types
export { trace, context, SpanStatusCode } from '@opentelemetry/api';
export type { Span, Context } from '@opentelemetry/api';