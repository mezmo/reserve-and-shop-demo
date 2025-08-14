import { trace, context, SpanStatusCode } from '@opentelemetry/api';

class SessionTracker {
  constructor() {
    this.tracer = trace.getTracer('restaurant-app-session', '1.0.0');
    this.sessionSpan = null;
    this.navigationSpan = null;
    this.sessionId = this.generateSessionId();
    this.sessionContext = context.active();
    this.startTime = Date.now();
    this.pageViews = 0;
    this.interactions = 0;
    this.initializeSession();
  }

  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  initializeSession() {
    // Create root session span
    this.sessionSpan = this.tracer.startSpan('user_session', {
      attributes: {
        'session.id': this.sessionId,
        'session.start_time': new Date().toISOString(),
        'app.version': '1.0.0',
        'app.environment': 'demo'
      }
    });

    // Store context for propagation
    this.sessionContext = trace.setSpan(context.active(), this.sessionSpan);
  }

  startNavigation(path, previousPath) {
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
    if (this.sessionSpan) {
      this.sessionSpan.addEvent('page_navigation', {
        'route.from': previousPath || 'initial',
        'route.to': path,
        'timestamp': new Date().toISOString()
      });
    }
  }

  startCheckout(orderId, totalAmount, itemCount) {
    if (!this.navigationSpan) {
      console.warn('No active navigation span for checkout, creating one');
      this.startNavigation('/checkout', 'unknown');
    }

    const checkoutContext = trace.setSpan(this.sessionContext, this.navigationSpan);
    
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
    if (this.sessionSpan) {
      this.sessionSpan.addEvent('checkout_started', {
        'order.id': orderId,
        'order.value': totalAmount
      });
    }

    return checkoutSpan;
  }

  recordInteraction(interactionType, elementInfo) {
    this.interactions++;
    
    if (this.navigationSpan) {
      this.navigationSpan.addEvent('user_interaction', {
        'interaction.type': interactionType,
        'interaction.element': elementInfo,
        'interaction.count': this.interactions
      });
    }
  }

  getActiveContext() {
    return this.navigationSpan 
      ? trace.setSpan(this.sessionContext, this.navigationSpan)
      : this.sessionContext;
  }

  getSessionId() {
    return this.sessionId;
  }

  getTraceId() {
    return this.sessionSpan ? this.sessionSpan.spanContext().traceId : undefined;
  }

  endSession(reason = 'normal') {
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

  // For stress testing: create a standalone session with realistic browser context
  static createStandaloneSession(userId, journeyName, browserFingerprint) {
    const tracker = new SessionTracker();
    // Use standard session ID format to match real users
    tracker.sessionId = tracker.generateSessionId();
    
    // Apply realistic browser fingerprint if provided
    if (tracker.sessionSpan && browserFingerprint) {
      tracker.sessionSpan.setAttributes({
        'user.id': userId,
        'user.journey.type': journeyName,
        'browser.user_agent': browserFingerprint.userAgent,
        'browser.language': browserFingerprint.language,
        'browser.viewport.width': browserFingerprint.viewport.width,
        'browser.viewport.height': browserFingerprint.viewport.height,
        'browser.platform': browserFingerprint.platform,
        'browser.cookie_enabled': browserFingerprint.cookieEnabled,
        'browser.do_not_track': browserFingerprint.doNotTrack,
        'browser.timezone': browserFingerprint.timezone
      });
    } else if (tracker.sessionSpan) {
      // Fallback to just journey type
      tracker.sessionSpan.setAttributes({
        'user.id': userId,
        'user.journey.type': journeyName
      });
    }
    
    return tracker;
  }
}

export {
  SessionTracker
};