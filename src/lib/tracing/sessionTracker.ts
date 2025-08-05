import { trace, context, SpanStatusCode, Span, Context } from '@opentelemetry/api';

export class SessionTracker {
  private tracer = trace.getTracer('restaurant-app-session', '1.0.0');
  private sessionSpan: Span | null = null;
  private navigationSpan: Span | null = null;
  private sessionId: string;
  private sessionContext: Context;
  private startTime: number;
  private pageViews: number = 0;
  private interactions: number = 0;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.sessionContext = context.active();
    this.initializeSession();
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeSession() {
    // Create root session span
    this.sessionSpan = this.tracer.startSpan('user_session', {
      attributes: {
        'session.id': this.sessionId,
        'session.start_time': new Date().toISOString(),
        'browser.user_agent': navigator.userAgent,
        'browser.language': navigator.language,
        'browser.viewport.width': window.innerWidth,
        'browser.viewport.height': window.innerHeight,
        'app.version': '1.0.0',
        'app.environment': 'demo'
      }
    });

    // Store context for propagation
    this.sessionContext = trace.setSpan(context.active(), this.sessionSpan);
  }

  startNavigation(path: string, previousPath?: string): void {
    // End previous navigation span if exists
    if (this.navigationSpan) {
      this.navigationSpan.setAttributes({
        'navigation.duration_ms': Date.now() - this.startTime,
        'navigation.interactions': this.interactions
      });
      this.navigationSpan.end();
      this.interactions = 0; // Reset interactions for new page
    }

    this.pageViews++;
    this.startTime = Date.now();

    // Start new navigation span as child of session
    this.navigationSpan = this.tracer.startSpan(
      `navigation_${path}`,
      {
        attributes: {
          'route.path': path,
          'route.previous': previousPath || 'unknown',
          'navigation.type': 'spa_route_change',
          'navigation.page_view_count': this.pageViews
        }
      },
      this.sessionContext
    );

    // Log navigation event
    this.sessionSpan?.addEvent('page_navigation', {
      'route.from': previousPath || 'initial',
      'route.to': path,
      'timestamp': new Date().toISOString()
    });
  }

  startCheckout(orderId: string, totalAmount: number, itemCount: number): Span {
    if (!this.navigationSpan) {
      console.warn('No active navigation span for checkout, creating one');
      this.startNavigation('/checkout', 'unknown');
    }

    const checkoutContext = trace.setSpan(this.sessionContext, this.navigationSpan!);
    
    const checkoutSpan = this.tracer.startSpan(
      'checkout_process',
      {
        attributes: {
          'checkout.order_id': orderId,
          'checkout.amount': totalAmount,
          'checkout.currency': 'USD',
          'checkout.item_count': itemCount,
          'checkout.start_time': new Date().toISOString()
        }
      },
      checkoutContext
    );

    // Add checkout event to session
    this.sessionSpan?.addEvent('checkout_started', {
      'order.id': orderId,
      'order.value': totalAmount
    });

    return checkoutSpan;
  }

  recordInteraction(interactionType: string, elementInfo?: any): void {
    this.interactions++;
    
    if (this.navigationSpan) {
      this.navigationSpan.addEvent('user_interaction', {
        'interaction.type': interactionType,
        'interaction.element': elementInfo,
        'interaction.count': this.interactions
      });
    }
  }

  getActiveContext(): Context {
    return this.navigationSpan 
      ? trace.setSpan(this.sessionContext, this.navigationSpan)
      : this.sessionContext;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getTraceId(): string | undefined {
    return this.sessionSpan?.spanContext().traceId;
  }

  endSession(reason: string = 'normal'): void {
    const sessionDuration = Date.now() - this.startTime;

    if (this.navigationSpan) {
      this.navigationSpan.setAttributes({
        'navigation.duration_ms': sessionDuration,
        'navigation.interactions': this.interactions
      });
      this.navigationSpan.end();
    }

    if (this.sessionSpan) {
      this.sessionSpan.setAttributes({
        'session.end_time': new Date().toISOString(),
        'session.duration_ms': sessionDuration,
        'session.page_views': this.pageViews,
        'session.end_reason': reason
      });
      
      this.sessionSpan.addEvent('session_ended', {
        'reason': reason,
        'duration_ms': sessionDuration,
        'pages_visited': this.pageViews
      });

      this.sessionSpan.setStatus({ code: SpanStatusCode.OK });
      this.sessionSpan.end();
    }
  }

  // For stress testing: create a standalone session
  static createStandaloneSession(userId: string, journeyName: string): SessionTracker {
    const tracker = new SessionTracker();
    tracker.sessionId = `stress-session-${userId}-${Date.now()}`;
    
    if (tracker.sessionSpan) {
      tracker.sessionSpan.setAttributes({
        'user.type': 'virtual',
        'user.id': userId,
        'user.journey': journeyName,
        'test.type': 'stress_test'
      });
    }
    
    return tracker;
  }
}

// Context hook helper
export function createSessionTrackerContext() {
  let tracker: SessionTracker | null = null;

  return {
    getTracker: () => tracker,
    initializeTracker: () => {
      if (!tracker) {
        tracker = new SessionTracker();
      }
      return tracker;
    },
    destroyTracker: () => {
      if (tracker) {
        tracker.endSession('app_unmount');
        tracker = null;
      }
    }
  };
}