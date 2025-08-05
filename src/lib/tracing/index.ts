// OpenTelemetry Tracing Implementation for Restaurant App
export { initializeTracing, isTracingEnabled } from './config';
export { SessionTracker, createSessionTrackerContext } from './sessionTracker';
export { VirtualUser } from './virtualUser';
export { 
  UserJourney, 
  JourneyStep, 
  USER_JOURNEYS, 
  selectWeightedJourney, 
  getThinkTime, 
  shouldExecuteStep 
} from './userJourneys';

// Re-export commonly used OpenTelemetry types
export { trace, context, SpanStatusCode } from '@opentelemetry/api';
export type { Span, Context } from '@opentelemetry/api';