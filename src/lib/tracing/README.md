# OpenTelemetry Tracing Implementation

This directory contains the complete OpenTelemetry tracing implementation for the restaurant application, providing comprehensive distributed tracing capabilities.

## Architecture Overview

The tracing system consists of several key components:

### 1. Configuration (`config.ts`)
- Initializes OpenTelemetry Web SDK
- Configures OTLP HTTP exporter to send traces to the local collector
- Sets up automatic instrumentation for fetch, XHR, and user interactions
- Conditional initialization based on OTEL configuration state

### 2. Session Tracking (`sessionTracker.ts`)
- Manages user session spans that encompass entire user journeys
- Tracks navigation between pages as child spans
- Provides checkout span management for e-commerce flows
- Handles session lifecycle and cleanup

### 3. Virtual Users (`virtualUser.ts`)
- Simulates realistic user behavior for stress testing
- Creates complete traces for automated user journeys
- Includes cart management, browsing, and checkout simulation
- Provides proper trace context for all simulated actions

### 4. User Journeys (`userJourneys.ts`)
- Defines realistic user behavior patterns
- Weighted journey selection for diverse testing scenarios
- Configurable think times and action probabilities
- Support for different user personas (Quick Buyer, Browser, Researcher, etc.)

## Trace Hierarchy

```
Session Trace (User Journey)
├── Navigation Span (Home)
├── Navigation Span (Menu)
├── Navigation Span (Menu with Checkout)
│   └── Checkout Span
│       ├── Payment Initiation Event
│       ├── Payment Processing Event
│       └── Payment Result Event
└── Navigation Span (Config)
```

## Integration Points

### Real User Tracking
- **App.tsx**: Initializes tracing and tracks navigation changes
- **CheckoutDialog.tsx**: Creates checkout spans with payment flow tracking
- **SessionTracker**: Manages real user session spans

### Stress Testing
- **Config.tsx**: Enhanced stress testing with virtual users
- **VirtualUser**: Simulates realistic user journeys with complete tracing
- **UserJourneys**: Defines behavior patterns for different user types

### Sample Order Generation
- **Config.tsx**: Sample order creation with full trace context
- **Performance Integration**: Links traces with existing performance logging

## Span Attributes

### Session Spans
- `session.id`: Unique session identifier
- `session.start_time`: Session start timestamp
- `browser.user_agent`: User's browser information
- `app.version`: Application version
- `session.page_views`: Number of pages visited
- `session.duration_ms`: Total session duration

### Navigation Spans
- `route.path`: Current page path
- `route.previous`: Previous page path
- `navigation.type`: Type of navigation (spa_route_change)
- `navigation.duration_ms`: Time spent on page
- `navigation.interactions`: Number of user interactions

### Checkout Spans
- `checkout.order_id`: Order identifier
- `checkout.amount`: Order total amount
- `checkout.currency`: Payment currency
- `checkout.item_count`: Number of items
- `payment.method`: Payment method used
- `payment.card_type`: Type of credit card

### Virtual User Spans
- `user.type`: 'virtual' for simulated users
- `user.id`: Unique virtual user identifier
- `user.journey`: Name of the journey being executed
- `test.type`: 'stress_test' for stress testing scenarios

## Events

### Payment Events
- `payment_initiated`: Payment process started
- `payment_processing`: Payment being processed
- `payment_success`: Payment completed successfully
- `payment_failed`: Payment failed with error details

### Navigation Events
- `page_navigation`: User navigated to a new page
- `user_interaction`: User clicked, submitted, or changed something

### Session Events
- `session_ended`: Session terminated with reason and duration

## Configuration

Tracing is automatically enabled when:
1. OTEL configuration exists in localStorage
2. OTEL is enabled in the configuration
3. Traces pipeline is enabled

The configuration is managed through the Config page UI.

## Data Flow

1. **Frontend** → Generates traces with OTLP HTTP exporter
2. **OTEL Collector** → Receives traces on port 4318
3. **Mezmo Pipeline** → Forwards traces to Mezmo (if configured)

## Usage Examples

### Manual Span Creation
```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('my-component', '1.0.0');
const span = tracer.startSpan('my-operation', {
  attributes: {
    'operation.type': 'business_logic',
    'user.id': 'user123'
  }
});

try {
  // Your operation here
  span.setStatus({ code: SpanStatusCode.OK });
} catch (error) {
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR });
} finally {
  span.end();
}
```

### Using Session Tracker
```typescript
import { useSessionTracker } from '@/hooks/useSessionTracker';

const sessionTracker = useSessionTracker();
if (sessionTracker) {
  const checkoutSpan = sessionTracker.startCheckout(orderId, totalAmount, itemCount);
  // ... checkout logic ...
  checkoutSpan.end();
}
```

### Virtual User Testing
```typescript
import { VirtualUser, selectWeightedJourney, USER_JOURNEYS } from '@/lib/tracing';

const journey = selectWeightedJourney(USER_JOURNEYS);
const user = new VirtualUser('test-user-1', journey);
await user.executeJourney();
```

## Monitoring and Debugging

- Check browser console for tracing initialization messages
- Use browser dev tools Network tab to see OTLP exports
- Monitor OTEL Collector logs at `/tmp/codeuser/otel-collector.log`
- View traces in Mezmo or any OpenTelemetry-compatible backend

## Performance Considerations

- Traces are batched before export (500ms intervals)
- Maximum queue size of 100 spans
- Automatic cleanup on session end
- Think time simulation for realistic load testing
- Conditional tracing based on configuration state

## Security Notes

- Trace data may contain sensitive information (order details, customer names)
- Use Mezmo's data redaction features to protect sensitive fields
- Virtual users use simulated data, not real customer information
- Traces are only generated when explicitly enabled by configuration