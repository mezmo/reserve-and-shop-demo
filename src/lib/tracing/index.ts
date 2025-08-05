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
export { TrafficManager } from './trafficManager';
export type { TrafficStats, TrafficConfig } from './trafficManager';

// Re-export commonly used OpenTelemetry types
export { trace, context, SpanStatusCode } from '@opentelemetry/api';
export type { Span, Context } from '@opentelemetry/api';