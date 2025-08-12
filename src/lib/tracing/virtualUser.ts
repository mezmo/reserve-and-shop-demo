import { trace, context, SpanStatusCode, Span, Context } from '@opentelemetry/api';
import { UserJourney, JourneyStep, getThinkTime, shouldExecuteStep } from './userJourneys';
import { SessionTracker } from './sessionTracker';
import PerformanceLogger from '@/lib/performanceLogger';
import { DataStore } from '@/stores/dataStore';
import { generateCustomerProfile, generateSpecialRequest, formatCreditCardNumber, generateOrderType, generatePartySize, generateBrowserFingerprint, generateNetworkTiming, addTimingJitter, type CustomerProfile, type BrowserFingerprint, type NetworkTiming } from '@/lib/utils/fakeDataGenerator';
import { MetricsLogger } from '@/lib/logging/loggers/MetricsLogger';

export class VirtualUser {
  private tracer = trace.getTracer('virtual-user', '1.0.0');
  private sessionTracker: SessionTracker;
  private performanceLogger: PerformanceLogger;
  private trafficManager?: any; // TrafficManager reference for activity updates
  private userId: string;
  private journey: UserJourney;
  private currentStep: number = 0;
  private cart: Map<string, number> = new Map();
  private products: any[] = [];
  private aborted: boolean = false;
  private customerProfile: CustomerProfile;
  private browserFingerprint: BrowserFingerprint;
  private metricsLogger: MetricsLogger;

  constructor(userId: string, journey: UserJourney, trafficManager?: any) {
    this.userId = userId;
    this.journey = journey;
    this.trafficManager = trafficManager;
    
    // Verify that OpenTelemetry tracer provider is registered
    const tracerProvider = trace.getTracerProvider();
    if (!tracerProvider || tracerProvider.constructor.name === 'NoopTracerProvider') {
      console.warn(`⚠️ Virtual user ${userId}: OpenTelemetry tracer provider not initialized. Traces will be no-ops.`);
    } else {
      console.log(`🔍 Virtual user ${userId}: Using tracer provider: ${tracerProvider.constructor.name}`);
    }
    
    // Generate realistic customer profile and browser fingerprint
    this.customerProfile = generateCustomerProfile();
    this.browserFingerprint = generateBrowserFingerprint();
    
    // Create session with realistic browser context
    this.sessionTracker = SessionTracker.createStandaloneSession(userId, journey.name, this.browserFingerprint);
    
    // Use simplified performance logger for virtual users to avoid sendBeacon errors
    this.performanceLogger = {
      logUserInteraction: (event: string, element: string, duration?: number) => {
        console.log(`🖱️ Virtual User Interaction: ${event} on ${element} (${duration || 0}ms)`);
      },
      logRouteChange: (from: string, to: string, duration?: number) => {
        console.log(`🧭 Virtual User Route: ${from} → ${to} (${duration || 0}ms)`);
      },
      logComponentMount: (component: string, duration?: number) => {
        console.log(`⚡ Virtual User Component: ${component} mounted (${duration || 0}ms)`);
      },
      logDataFetch: (operation: string, duration?: number) => {
        console.log(`📡 Virtual User Data: ${operation} (${duration || 0}ms)`);
      },
      logError: (error: Error, context?: string) => {
        console.log(`❌ Virtual User Error: ${error.message} ${context ? `(${context})` : ''}`);
      },
      logCartAction: (action: string, product: any, quantityBefore: number, quantityAfter: number, cartTotal: number, duration?: number) => {
        console.log(`🛒 Virtual User Cart: ${action} ${product.name} (${quantityBefore}→${quantityAfter}, total: $${cartTotal}, ${duration || 0}ms)`);
      },
      logCartSession: (itemCount: number, totalValue: number, sessionDuration: number) => {
        console.log(`🛒 Virtual User Session: ${itemCount} items, $${totalValue}, ${sessionDuration}ms`);
      }
    } as any;
    
    // Initialize metrics logger for trace-to-metrics correlation  
    // Use simplified fallback approach to avoid browser compatibility issues
    console.log(`📊 Using fallback MetricsLogger for virtual user ${this.customerProfile.fullName}`);
    this.metricsLogger = {
      logCounter: (name: string, value: number, tags?: Record<string, string>) => {
        console.log(`📊 Virtual User Metric Counter: ${name} = ${value}`, tags);
      },
      logGauge: (name: string, value: number, unit?: string, tags?: Record<string, string>) => {
        console.log(`📊 Virtual User Metric Gauge: ${name} = ${value} ${unit || 'units'}`, tags);
      },
      logBusinessMetric: (name: string, value: number, currency?: string, tags?: Record<string, string>) => {
          console.log(`📊 Business Metric: ${name} = ${value} ${currency || 'units'}`, tags);
        },
        logPerformanceMetric: (name: string, duration: number, tags?: Record<string, string>) => {
          console.log(`📊 Performance Metric: ${name} = ${duration}ms`, tags);
        }
      } as any;
    
    // Initialize with sample products for cart operations
    this.initializeProducts();
    
    // Emit session start metrics
    try {
      this.metricsLogger.logCounter('user_sessions', 1, {
        'user.journey': this.journey.name,
        'browser.platform': this.browserFingerprint.platform,
        'browser.language': this.browserFingerprint.language,
        'trace.id': this.sessionTracker.getTraceId() || '',
        'session.id': this.sessionTracker.getSessionId()
      });
    } catch (error) {
      console.warn(`⚠️ Failed to log session start metrics for user ${userId}:`, error);
    }
  }

  private initializeProducts() {
    // Use real products from DataStore to match exactly what real users see
    const dataStore = DataStore.getInstance();
    const realProducts = dataStore.getProducts();
    
    // Map to the format needed by virtual user while preserving real data
    this.products = realProducts.map(product => ({
      id: product.id,
      name: product.name,
      price: product.price,
      category: product.category
    }));
    
    console.log(`🏪 Virtual user ${this.customerProfile.fullName} (${this.userId}) initialized with ${this.products.length} real products:`, 
                this.products.map(p => `${p.id}: ${p.name} ($${p.price})`));
  }

  async executeJourney(): Promise<void> {
    try {
      console.log(`🎭 ${this.customerProfile.fullName} (${this.userId}) starting journey: ${this.journey.name} with ${this.journey.steps.length} steps`);
      
      // Verify OTEL is ready for trace generation
      const tracerProvider = trace.getTracerProvider();
      console.log(`🔍 Virtual User ${this.userId} trace provider status:`, {
        providerType: tracerProvider.constructor.name,
        isNoopProvider: tracerProvider.constructor.name === 'NoopTracerProvider'
      });
      
      this.updateActivity(`starting_${this.journey.name.toLowerCase().replace(/\s+/g, '_')}`);
      
      for (let i = 0; i < this.journey.steps.length && !this.aborted; i++) {
        const step = this.journey.steps[i];
        this.currentStep = i;
        
        if (!shouldExecuteStep(step)) {
          console.log(`⏭️ ${this.customerProfile.fullName} (${this.userId}) skipping step ${i + 1}: ${step.action}`);
          continue;
        }

        console.log(`🔄 ${this.customerProfile.fullName} (${this.userId}) executing step ${i + 1}/${this.journey.steps.length}: ${step.action}`);
        this.updateActivity(this.getActivityForStep(step), i, this.journey.steps.length);
        await this.executeStep(step, i);
        console.log(`  ✓ Step ${i + 1} completed: ${step.action}`);
        
        // Simulate think time between actions
        const thinkTime = getThinkTime(step);
        console.log(`🤔 ${this.customerProfile.fullName} thinking for ${thinkTime}ms`);
        this.updateActivity(`thinking_after_${step.action}`, i, this.journey.steps.length);
        await this.sleep(thinkTime);
      }

      console.log(`✅ ${this.customerProfile.fullName} (${this.userId}) completed journey: ${this.journey.name}`);
      this.updateActivity('journey_completed');
    } catch (error) {
      console.error(`❌ ${this.customerProfile.fullName} journey failed:`, error);
      console.error(`   Step: ${this.currentStep}/${this.journey.steps.length}`);
      console.error(`   Journey: ${this.journey.name}`);
      this.updateActivity('journey_failed');
      throw error;
    } finally {
      this.sessionTracker.endSession('journey_complete');
    }
  }

  private async executeStep(step: JourneyStep, stepIndex: number): Promise<void> {
    const activeContext = this.sessionTracker.getActiveContext();
    
    const stepSpan = this.tracer.startSpan(
      `step_${stepIndex}_${step.action}`,
      {
        attributes: {
          'step.index': stepIndex,
          'step.action': step.action,
          'step.target': step.target || 'unknown',
          'user.id': this.userId,
          'journey.name': this.journey.name
        }
      },
      activeContext
    );
    
    // Verify trace generation
    const spanContext = stepSpan.spanContext();
    console.log(`🔍 Virtual User ${this.userId} generated trace:`, {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      spanName: `step_${stepIndex}_${step.action}`,
      isRecording: stepSpan.isRecording()
    });

    try {
      switch (step.action) {
        case 'navigate':
          await this.navigate(step.target!, stepSpan);
          break;
        case 'browse':
          await this.browseProducts(stepSpan);
          break;
        case 'add_to_cart':
          await this.addToCart(stepSpan);
          break;
        case 'remove_from_cart':
          await this.removeFromCart(stepSpan);
          break;
        case 'checkout':
          await this.checkout(stepSpan);
          break;
        case 'view_details':
          await this.viewProductDetails(stepSpan);
          break;
        case 'make_reservation':
          await this.makeReservation(stepSpan);
          break;
      }

      stepSpan.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      stepSpan.recordException(error as Error);
      stepSpan.setStatus({ 
        code: SpanStatusCode.ERROR,
        message: (error as Error).message 
      });
      throw error;
    } finally {
      stepSpan.end();
    }
  }

  private async navigate(path: string, parentSpan: Span): Promise<void> {
    const ctx = trace.setSpan(context.active(), parentSpan);
    
    // Simulate clicking navigation link before navigating
    const linkSelector = this.getNavigationLinkSelector(path);
    this.simulateClick(linkSelector, path);
    
    // Small delay after click before navigation
    await this.sleep(100 + Math.random() * 200);
    
    // Log user interaction for navigation
    this.performanceLogger.logUserInteraction('navigate', `page-${path}`, 0);
    
    // Update session tracker
    this.sessionTracker.startNavigation(path);

    // Simulate API calls that would happen on this page
    await this.simulatePageLoad(path, ctx);
  }

  private async simulatePageLoad(path: string, ctx: Context): Promise<void> {
    const promises: Promise<any>[] = [];

    switch (path) {
      case '/':
        promises.push(this.fetchWithTracing('/api/health', 'GET', ctx));
        break;
      case '/menu':
        promises.push(this.fetchWithTracing('/api/products', 'GET', ctx));
        // Note: /api/categories doesn't exist, removed to prevent 404s
        break;
      case '/reservations':
        promises.push(this.fetchWithTracing('/api/reservations', 'GET', ctx));
        // Note: /api/availability doesn't exist, removed to prevent 404s
        break;
      case '/config':
        promises.push(this.fetchWithTracing('/api/settings', 'GET', ctx));
        break;
    }

    await Promise.all(promises);
  }

  private async browseProducts(parentSpan: Span): Promise<void> {
    // Simulate scrolling to product section first
    await this.simulateScrolling('down');
    
    // Simulate clicking on product grid or menu section first
    this.simulateClick('div.no-id.grid.md.grid.cols.2.lg.grid.cols.3.gap.6', 'Product Grid');
    await this.sleep(addTimingJitter(300, 0.4));
    
    // Log user interaction for browsing
    this.performanceLogger.logUserInteraction('browse', 'product-catalog', 0);
    
    // Simulate browsing behavior - browse 2-5 products
    const browseCount = Math.floor(Math.random() * 4) + 2;
    
    for (let i = 0; i < browseCount; i++) {
      const product = this.products[Math.floor(Math.random() * this.products.length)];
      
      // Occasionally scroll to see more products
      if (i > 0 && Math.random() > 0.7) {
        await this.simulateScrolling('down');
      }
      
      // Simulate clicking on product card (matches Card component from Menu.tsx)
      const productCardSelector = `div.no-id.overflow.hidden.hover.shadow.warm.transition.all.duration.300`;
      this.simulateClick(productCardSelector, product.name);
      await this.sleep(addTimingJitter(200, 0.3));
      
      // Log user interaction for each product view
      this.performanceLogger.logUserInteraction('view', `product-${product.id}`, 0);
      
      parentSpan.addEvent('product_viewed', {
        'product.id': product.id,
        'product.name': product.name,
        'product.price': product.price
      });

      // Emit correlated metrics for product views
      this.metricsLogger.logCounter('product_views', 1, {
        'product.id': product.id,
        'product.category': product.category,
        'user.journey': this.journey.name,
        'trace.id': this.sessionTracker.getTraceId() || '',
        'session.id': this.sessionTracker.getSessionId()
      });
      
      const engagementTime = addTimingJitter(2500, 0.6);
      this.metricsLogger.logGauge('product_engagement_time', engagementTime, 'milliseconds', {
        'product.id': product.id,
        'trace.id': this.sessionTracker.getTraceId() || ''
      });

      // Simulate reading product description and price with more realistic timing
      await this.sleep(engagementTime);
    }
  }

  private async addToCart(parentSpan: Span): Promise<void> {
    const product = this.products[Math.floor(Math.random() * this.products.length)];
    const quantity = Math.floor(Math.random() * 3) + 1;
    
    // Simulate clicking the "Add to Cart" button for this product (matches Menu.tsx structure)
    const addButtonSelector = `button.no-id.bg.primary.hover.bg.primary.90.text.primary.foreground.shadow.md`;
    this.simulateClick(addButtonSelector, `Add ${product.name} to Cart`);
    
    // Small delay after click before updating cart
    await this.sleep(150 + Math.random() * 100);
    
    const quantityBefore = this.cart.get(product.id) || 0;
    this.cart.set(product.id, quantityBefore + quantity);
    const quantityAfter = this.cart.get(product.id) || 0;
    
    const cartTotal = Array.from(this.cart.entries()).reduce((total, [productId, qty]) => {
      const prod = this.products.find(p => p.id === productId);
      return total + (prod?.price || 0) * qty;
    }, 0);
    
    const totalItems = Array.from(this.cart.values()).reduce((a, b) => a + b, 0);
    
    // Log cart action with all required data using real product data
    this.performanceLogger.logCartAction(
      'ADD',
      { id: product.id, name: product.name, price: product.price, category: product.category },
      quantityBefore,
      quantityAfter,
      cartTotal,
      0
    );
    
    console.log(`🛒 ${this.customerProfile.fullName} added ${quantity}x ${product.name} to cart (${totalItems} total items)`);
    
    parentSpan.addEvent('item_added_to_cart', {
      'product.id': product.id,
      'product.name': product.name,
      'quantity': quantity,
      'cart.total_items': totalItems
    });

    // Emit correlated metrics for cart operations
    this.metricsLogger.logCounter('cart_add_item', quantity, {
      'product.id': product.id,
      'product.category': product.category,
      'user.journey': this.journey.name,
      'trace.id': this.sessionTracker.getTraceId() || '',
      'session.id': this.sessionTracker.getSessionId()
    });
    
    this.metricsLogger.logGauge('cart_total_value', cartTotal, 'USD', {
      'trace.id': this.sessionTracker.getTraceId() || '',
      'session.id': this.sessionTracker.getSessionId()
    });
    
    this.metricsLogger.logGauge('cart_item_count', totalItems, 'items', {
      'trace.id': this.sessionTracker.getTraceId() || ''
    });

    this.sessionTracker.recordInteraction('add_to_cart', { productId: product.id, quantity });
  }

  private async removeFromCart(parentSpan: Span): Promise<void> {
    if (this.cart.size === 0) return;
    
    const cartItems = Array.from(this.cart.keys());
    const productId = cartItems[Math.floor(Math.random() * cartItems.length)];
    const quantityBefore = this.cart.get(productId) || 0;
    const product = this.products.find(p => p.id === productId);
    
    if (!product) return;
    
    // Simulate clicking the "Remove" button for this product (matches Menu.tsx structure)
    const removeButtonSelector = `button.no-id.border.primary.text.primary.hover.bg.primary.hover.text.primary.foreground`;
    this.simulateClick(removeButtonSelector, `Remove ${product.name} from Cart`);
    
    // Small delay after click before updating cart
    await this.sleep(100 + Math.random() * 80);
    
    let quantityAfter = quantityBefore;
    if (quantityBefore > 1) {
      this.cart.set(productId, quantityBefore - 1);
      quantityAfter = quantityBefore - 1;
    } else {
      this.cart.delete(productId);
      quantityAfter = 0;
    }
    
    const cartTotal = Array.from(this.cart.entries()).reduce((total, [prodId, qty]) => {
      const prod = this.products.find(p => p.id === prodId);
      return total + (prod?.price || 0) * qty;
    }, 0);
    
    // Log cart action with all required data using real product data
    this.performanceLogger.logCartAction(
      'REMOVE',
      { id: product.id, name: product.name, price: product.price, category: product.category },
      quantityBefore,
      quantityAfter,
      cartTotal,
      0
    );
    
    parentSpan.addEvent('item_removed_from_cart', {
      'product.id': productId,
      'cart.total_items': Array.from(this.cart.values()).reduce((a, b) => a + b, 0)
    });

    this.sessionTracker.recordInteraction('remove_from_cart', { productId });
  }

  private async checkout(parentSpan: Span): Promise<void> {
    this.updateActivity('preparing_checkout');
    
    if (this.cart.size === 0) {
      // Add something to cart first
      this.updateActivity('adding_items_for_checkout');
      await this.addToCart(parentSpan);
    }

    const totalAmount = Array.from(this.cart.entries()).reduce((total, [productId, quantity]) => {
      const product = this.products.find(p => p.id === productId);
      return total + (product?.price || 0) * quantity;
    }, 0);

    const orderId = `virtual-order-${this.userId}-${Date.now()}`;
    const itemCount = Array.from(this.cart.values()).reduce((a, b) => a + b, 0);

    console.log(`💳 ${this.customerProfile.fullName} starting checkout - ${itemCount} items, $${totalAmount.toFixed(2)}`);
    this.updateActivity('starting_payment_process');

    // Start checkout span
    const checkoutSpan = this.sessionTracker.startCheckout(orderId, totalAmount, itemCount);

    try {
      // Simulate checkout steps
      const paymentSucceeded = await this.simulatePaymentProcess(checkoutSpan);
      
      if (paymentSucceeded) {
        checkoutSpan.setStatus({ code: SpanStatusCode.OK });
        console.log(`✅ ${this.customerProfile.fullName} completed checkout - Order ${orderId}`);
        this.updateActivity('checkout_completed');
        this.cart.clear();
      } else {
        // Payment was declined but handled gracefully
        checkoutSpan.setStatus({ code: SpanStatusCode.OK });
        console.log(`🛒 ${this.customerProfile.fullName} checkout abandoned after payment decline`);
      }
    } catch (error) {
      console.log(`❌ ${this.customerProfile.fullName} checkout failed - ${error.message}`);
      this.updateActivity('checkout_failed');
      checkoutSpan.recordException(error as Error);
      checkoutSpan.setStatus({ code: SpanStatusCode.ERROR });
      // Don't re-throw to prevent 404 errors
    } finally {
      checkoutSpan.end();
    }
  }

  private async simulatePaymentProcess(checkoutSpan: Span): Promise<boolean> {
    const ctx = trace.setSpan(context.active(), checkoutSpan);

    // Use realistic customer data from profile
    const paymentData = {
      cardNumber: formatCreditCardNumber(this.customerProfile.creditCard.number),
      expiryDate: `${this.customerProfile.creditCard.expiryMonth}/${this.customerProfile.creditCard.expiryYear}`,
      cvv: this.customerProfile.creditCard.cvv,
      cardHolderName: this.customerProfile.creditCard.holderName
    };

    const customerData = {
      name: this.customerProfile.fullName,
      email: this.customerProfile.email,
      phone: this.customerProfile.phone
    };

    const orderId = `virtual-order-${this.userId}-${Date.now()}`;
    const totalAmount = Array.from(this.cart.entries()).reduce((total, [productId, quantity]) => {
      const product = this.products.find(p => p.id === productId);
      return total + (product?.price || 0) * quantity;
    }, 0);

    const transactionData = {
      orderId,
      amount: totalAmount,
      currency: 'USD',
      orderType: generateOrderType()
    };

    // Stage 1: Payment initiated
    this.updateActivity('entering_payment_details');
    
    // Simulate realistic form filling with focus/blur events
    await this.simulateFormFocus('input.no-id.flex.h.10.w.full.rounded.md.border', 'Card Number Field');
    this.performanceLogger.logUserInteraction('input', 'card-number-field', addTimingJitter(500, 0.3));
    
    await this.sleep(addTimingJitter(800, 0.5));
    await this.simulateFormFocus('input.no-id.flex.h.10.w.full.rounded.md.border', 'Expiry Date Field');
    this.performanceLogger.logUserInteraction('input', 'expiry-date-field', addTimingJitter(300, 0.3));
    
    await this.sleep(addTimingJitter(600, 0.4));
    await this.simulateFormFocus('input.no-id.flex.h.10.w.full.rounded.md.border', 'CVV Field');
    this.performanceLogger.logUserInteraction('input', 'cvv-field', addTimingJitter(200, 0.3));
    
    await this.sleep(addTimingJitter(700, 0.5));
    await this.simulateFormFocus('input.no-id.flex.h.10.w.full.rounded.md.border', 'Cardholder Name Field');
    this.performanceLogger.logUserInteraction('input', 'cardholder-name-field', addTimingJitter(800, 0.4));
    
    checkoutSpan.addEvent('payment_initiated', {
      'payment.method': 'credit_card',
      'payment.card_type': 'visa'
    });
    
    this.performanceLogger.logPaymentAttempt(
      paymentData,
      customerData,
      transactionData,
      'initiated'
    );

    // Simulate clicking "Process Payment" button
    await this.sleep(1000 + Math.random() * 500);
    this.simulateClick('button.no-id.inline.flex.items.center.justify.center.rounded.md', 'Process Payment');
    
    // Simulate payment validation (1-2 seconds after form submission)
    await this.sleep(1000 + Math.random() * 1000);
    
    // Stage 2: Payment processing
    this.updateActivity('processing_payment');
    checkoutSpan.addEvent('payment_processing');
    
    this.performanceLogger.logPaymentAttempt(
      paymentData,
      customerData,
      transactionData,
      'processing',
      1500
    );
    
    // Simulate payment processing (4-6 seconds)
    await this.sleep(4000 + Math.random() * 2000);

    // Stage 3: Payment success/failure with realistic error rates
    const success = this.simulatePaymentResult();
    
    if (success) {
      this.updateActivity('payment_successful');
      checkoutSpan.addEvent('payment_success');
      
      this.performanceLogger.logPaymentAttempt(
        paymentData,
        customerData,
        transactionData,
        'success',
        addTimingJitter(2500, 0.3)
      );

      // Emit business metrics for successful payment
      this.metricsLogger.logBusinessMetric('payment_success', totalAmount, 'USD', {
        'payment.method': 'credit_card',
        'payment.card_type': this.customerProfile.creditCard.type,
        'order.type': transactionData.orderType,
        'user.journey': this.journey.name,
        'trace.id': this.sessionTracker.getTraceId() || '',
        'session.id': this.sessionTracker.getSessionId()
      });
      
      this.metricsLogger.logCounter('payment_attempts', 1, {
        'payment.result': 'success',
        'payment.method': 'credit_card',
        'trace.id': this.sessionTracker.getTraceId() || ''
      });
      
      console.log(`💰 User ${this.customerProfile.fullName} payment successful, posting order to /api/orders`);
      this.updateActivity('creating_order');
      
      // Occasionally simulate API retries even on success
      const orderResponse = await this.fetchWithRetries('/api/orders', 'POST', ctx, 1);
      
      // Log data operation for order creation
      if (orderResponse && !orderResponse.failed) {
        this.performanceLogger.logDataOperation(
          'CREATE',
          'order',
          orderId,
          {
            items: Array.from(this.cart.entries()).map(([productId, quantity]) => ({
              productId,
              quantity,
              price: this.products.find(p => p.id === productId)?.price || 0
            })),
            totalAmount,
            customerName: customerData.name,
            customerEmail: customerData.email,
            customerPhone: customerData.phone,
            orderType: transactionData.orderType,
            notes: transactionData.orderType === 'delivery' ? 'Please call when arriving' : 'Will pick up at store'
          },
          300
        );
      }
      
      console.log(`📦 ${this.customerProfile.fullName} order successfully posted to API`);
      this.updateActivity('order_confirmed');
      return true; // Payment succeeded
    } else {
      this.updateActivity('payment_declined');
      checkoutSpan.addEvent('payment_failed', {
        'error.code': 'payment_declined',
        'error.message': 'Card declined'
      });
      
      this.performanceLogger.logPaymentAttempt(
        paymentData,
        customerData,
        transactionData,
        'failed',
        2500
      );

      // Emit failure metrics
      this.metricsLogger.logCounter('payment_attempts', 1, {
        'payment.result': 'failed',
        'payment.method': 'credit_card',
        'payment.card_type': this.customerProfile.creditCard.type,
        'failure.reason': 'card_declined',
        'trace.id': this.sessionTracker.getTraceId() || '',
        'session.id': this.sessionTracker.getSessionId()
      });
      
      this.metricsLogger.logBusinessMetric('payment_failed_amount', totalAmount, 'USD', {
        'user.journey': this.journey.name,
        'trace.id': this.sessionTracker.getTraceId() || ''
      });
      
      console.log(`💸 ${this.customerProfile.fullName} payment failed - card declined`);
      
      // Simulate realistic retry behavior
      const shouldRetry = Math.random() > 0.4; // 60% of users retry after failure
      
      if (shouldRetry) {
        console.log(`🔄 ${this.customerProfile.fullName} attempting payment retry`);
        this.updateActivity('retrying_payment');
        checkoutSpan.addEvent('payment_retry_attempt');
        
        // Simulate user fixing payment details
        await this.sleep(addTimingJitter(3000, 0.5));
        await this.simulateFormFocus('input.no-id.flex.h.10.w.full.rounded.md.border', 'Card Number Field');
        await this.sleep(addTimingJitter(2000, 0.4));
        
        // Second attempt (higher success rate: 70%)
        const retrySuccess = Math.random() > 0.3;
        
        if (retrySuccess) {
          this.updateActivity('payment_successful');
          checkoutSpan.addEvent('payment_success_after_retry');
          
          this.performanceLogger.logPaymentAttempt(
            paymentData,
            customerData,
            { ...transactionData, retryAttempt: 1 },
            'success',
            addTimingJitter(2800, 0.3)
          );
          
          console.log(`💰 ${this.customerProfile.fullName} payment successful on retry`);
          this.updateActivity('creating_order');
          const orderResponse = await this.fetchWithRetries('/api/orders', 'POST', ctx, 1);
          
          // Handle order creation similar to first attempt
          if (orderResponse && !orderResponse.failed) {
            this.performanceLogger.logDataOperation('CREATE', 'order', orderId, {
              items: Array.from(this.cart.entries()).map(([productId, quantity]) => ({
                productId, quantity, 
                price: this.products.find(p => p.id === productId)?.price || 0
              })),
              totalAmount,
              customerName: customerData.name,
              retryAttempt: 1
            });
            this.updateActivity('order_confirmed');
            return true;
          }
        } else {
          checkoutSpan.addEvent('payment_failed_after_retry');
          this.performanceLogger.logPaymentAttempt(
            paymentData, customerData, 
            { ...transactionData, retryAttempt: 1 }, 
            'failed', 
            addTimingJitter(2500, 0.3)
          );
        }
      }
      
      // Final abandonment
      await this.sleep(addTimingJitter(2000, 0.5));
      this.updateActivity('checkout_abandoned');
      checkoutSpan.addEvent('checkout_abandoned');
      
      return false;
    }
  }

  private async viewProductDetails(parentSpan: Span): Promise<void> {
    const product = this.products[Math.floor(Math.random() * this.products.length)];
    
    // Simulate clicking on product title for detailed view (matches CardTitle)
    const detailLinkSelector = `h3.no-id.text.lg.font.semibold.leading.none.tracking.tight`;
    this.simulateClick(detailLinkSelector, `View ${product.name} Details`);
    await this.sleep(400 + Math.random() * 300);
    
    // Log user interaction for viewing product details
    this.performanceLogger.logUserInteraction('view_details', `product-details-${product.id}`, 0);
    
    // Simulate interacting with different parts of the product details page
    if (Math.random() > 0.4) {
      // Simulate clicking on product images
      this.simulateClick(`img.no-id.w.full.h.full.object.cover`, 'Product Image');
      await this.sleep(600 + Math.random() * 400);
    }
    
    if (Math.random() > 0.6) {
      // Simulate scrolling through description or ingredients
      this.performanceLogger.logUserInteraction('scroll', `p.no-id.text.muted.foreground.mb.4`, 0);
      await this.sleep(1000 + Math.random() * 800);
    }
    
    if (Math.random() > 0.7) {
      // Simulate clicking on nutritional info or reviews tab
      this.simulateClick(`div.no-id.rounded.lg.border.bg.card.text.card.foreground.shadow.sm`, 'Product Details Section');
      await this.sleep(800 + Math.random() * 600);
    }
    
    parentSpan.addEvent('product_details_viewed', {
      'product.id': product.id,
      'product.name': product.name
    });

    // Don't call /api/products/:id since virtual users use fake IDs
    // Just simulate viewing without API call to avoid 404s
    console.log(`👀 ${this.customerProfile.fullName} viewing product details: ${product.name}`);
    // Simulate reading product details, ingredients, reviews (2-4 seconds remaining)
    await this.sleep(2000 + Math.random() * 2000);
  }

  private async makeReservation(parentSpan: Span): Promise<void> {
    this.updateActivity('starting_reservation');
    parentSpan.addEvent('reservation_started');
    
    // Log user interaction for starting reservation
    this.performanceLogger.logUserInteraction('start_reservation', 'reservation-form', 0);
    
    // Simulate reservation form filling with individual field interactions
    this.updateActivity('filling_reservation_form');
    
    // Simulate clicking and filling reservation form fields
    this.simulateClick('input.no-id.flex.h.10.w.full.rounded.md.border', 'Date Field');
    await this.sleep(300 + Math.random() * 200);
    this.performanceLogger.logUserInteraction('input', 'input#reservation-date', 400);
    
    await this.sleep(800 + Math.random() * 400);
    this.simulateClick('select.no-id.flex.h.10.w.full.rounded.md.border', 'Time Field');
    await this.sleep(200 + Math.random() * 100);
    this.performanceLogger.logUserInteraction('input', 'select#reservation-time', 300);
    
    await this.sleep(600 + Math.random() * 300);
    this.simulateClick('input.no-id.flex.h.10.w.full.rounded.md.border', 'Guest Count Field');
    await this.sleep(200 + Math.random() * 100);
    this.performanceLogger.logUserInteraction('input', 'input#guest-count', 200);
    
    await this.sleep(900 + Math.random() * 500);
    this.simulateClick('input.no-id.flex.h.10.w.full.rounded.md.border', 'Name Field');
    await this.sleep(300 + Math.random() * 200);
    this.performanceLogger.logUserInteraction('input', 'input#customer-name', 600);
    
    await this.sleep(700 + Math.random() * 300);
    this.simulateClick('input.no-id.flex.h.10.w.full.rounded.md.border', 'Email Field');
    await this.sleep(300 + Math.random() * 200);
    this.performanceLogger.logUserInteraction('input', 'input#customer-email', 800);
    
    await this.sleep(600 + Math.random() * 300);
    this.simulateClick('input.no-id.flex.h.10.w.full.rounded.md.border', 'Phone Field');
    await this.sleep(300 + Math.random() * 200);
    this.performanceLogger.logUserInteraction('input', 'input#customer-phone', 500);
    
    await this.sleep(800 + Math.random() * 400);
    this.simulateClick('textarea.no-id.flex.min.h.24.w.full.rounded.md.border', 'Special Requests Field');
    await this.sleep(200 + Math.random() * 100);
    this.performanceLogger.logUserInteraction('input', 'textarea#special-requests', 600);
    
    const ctx = trace.setSpan(context.active(), parentSpan);
    
    const reservationId = `virtual-reservation-${this.userId}-${Date.now()}`;
    
    try {
      // Simulate clicking "Submit Reservation" button
      await this.sleep(1000 + Math.random() * 500);
      this.simulateClick('button.no-id.inline.flex.items.center.justify.center.rounded.md', 'Submit Reservation');
      
      this.updateActivity('submitting_reservation');
      const reservationResponse = await this.fetchWithTracing('/api/reservations', 'POST', ctx);
      
      // Log data operation for reservation creation
      if (reservationResponse && !reservationResponse.failed) {
        this.updateActivity('reservation_confirmed');
        // Get the same data that was sent to the API
        const reservationBody = this.getRequestBody('/api/reservations') as any;
        this.performanceLogger.logDataOperation(
          'CREATE',
          'reservation',
          reservationId,
          {
            date: reservationBody.date,
            time: reservationBody.time,
            guests: reservationBody.guests,
            customerName: reservationBody.name,
            customerEmail: reservationBody.email,
            customerPhone: reservationBody.phone,
            specialRequests: reservationBody.specialRequests
          },
          200
        );
      } else {
        this.updateActivity('reservation_failed');
      }
      
      parentSpan.addEvent('reservation_completed');
    } catch (error) {
      this.updateActivity('reservation_error');
      parentSpan.addEvent('reservation_failed');
      throw error;
    }
  }

  private async fetchWithTracing(url: string, method: string, ctx: Context): Promise<any> {
    // Generate realistic network timing before request
    const networkTiming = generateNetworkTiming();
    const startTime = performance.now();
    
    const fetchSpan = this.tracer.startSpan(
      `http_${method.toLowerCase()}`,
      {
        attributes: {
          'http.method': method,
          'http.url': `http://localhost:3001${url}`,
          'http.target': url,
          'http.user_agent': this.browserFingerprint.userAgent,
          // Add realistic network timing attributes
          'network.domain_lookup_duration': networkTiming.domainLookupEnd - networkTiming.domainLookupStart,
          'network.connect_duration': networkTiming.connectEnd - networkTiming.connectStart,
          'network.request_start': networkTiming.requestStart,
          'network.response_start': networkTiming.responseStart
        }
      },
      ctx
    );

    try {
      const requestBody = method === 'POST' ? this.getRequestBody(url) : undefined;
      console.log(`🌐 ${this.customerProfile.fullName} making ${method} request to ${url}`, requestBody ? { body: requestBody } : '');
      
      // Simulate realistic network delays
      const networkDelay = addTimingJitter(networkTiming.responseStart - networkTiming.fetchStart, 0.4);
      await this.sleep(Math.max(10, networkDelay));
      
      // Make actual HTTP request to real endpoints
      const response = await fetch(`http://localhost:3001${url}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.browserFingerprint.userAgent,
          'Accept-Language': this.browserFingerprint.language,
          'X-Virtual-User': this.userId,
          'X-Request-Source': 'virtual-traffic-simulator'
        },
        // Add appropriate body for POST requests based on endpoint
        body: method === 'POST' ? JSON.stringify(requestBody) : undefined
      });
      
      const statusCode = response.status;
      const responseText = await response.text();
      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      
      console.log(`📡 ${this.customerProfile.fullName} received ${statusCode} response from ${url} (${responseText.length} bytes)`);
      
      fetchSpan.setAttributes({
        'http.status_code': statusCode,
        'http.response_content_length': responseText.length,
        // Add realistic transfer timing attributes
        'network.transfer_size': networkTiming.transferSize,
        'network.encoded_body_size': networkTiming.encodedBodySize,
        'network.decoded_body_size': networkTiming.decodedBodySize,
        'network.total_duration': totalDuration,
        'network.response_time': addTimingJitter(networkTiming.responseEnd - networkTiming.responseStart, 0.2)
      });

      // Emit performance metrics correlated with trace
      this.metricsLogger.logPerformanceMetric('http_request_duration', totalDuration, {
        'http.method': method,
        'http.url': url,
        'http.status_code': statusCode.toString(),
        'trace.id': this.sessionTracker.getTraceId() || '',
        'span.id': fetchSpan.spanContext().spanId
      });
      
      this.metricsLogger.logCounter('http_requests', 1, {
        'http.method': method,
        'http.status_class': `${Math.floor(statusCode / 100)}xx`,
        'trace.id': this.sessionTracker.getTraceId() || ''
      });
      
      this.metricsLogger.logGauge('response_size_bytes', responseText.length, 'bytes', {
        'http.url': url,
        'trace.id': this.sessionTracker.getTraceId() || ''
      });

      if (!response.ok) {
        console.log(`⚠️ ${this.customerProfile.fullName} API error: ${statusCode} ${response.statusText} for ${url} - continuing session`);
        fetchSpan.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${statusCode}` });
        // Don't throw error - let user session continue
        return { 
          status: statusCode, 
          data: { error: response.statusText },
          failed: true
        };
      }

      return { 
        status: statusCode, 
        data: responseText ? JSON.parse(responseText) : {} 
      };
    } catch (error) {
      console.log(`🚫 ${this.customerProfile.fullName} network error for ${url}: ${error.message} - continuing session`);
      fetchSpan.recordException(error as Error);
      fetchSpan.setStatus({ code: SpanStatusCode.ERROR });
      // Don't throw error - let user session continue
      return { 
        status: 0, 
        data: { error: error.message },
        failed: true
      };
    } finally {
      fetchSpan.end();
    }
  }

  private getRequestBody(url: string): any {
    if (url === '/api/orders') {
      // Order data for checkout using realistic customer data
      const orderType = generateOrderType();
      return {
        items: Array.from(this.cart.entries()).map(([productId, quantity]) => ({
          productId,
          quantity,
          price: this.products.find(p => p.id === productId)?.price || 0
        })),
        total: Array.from(this.cart.entries()).reduce((total, [productId, quantity]) => {
          const product = this.products.find(p => p.id === productId);
          return total + (product?.price || 0) * quantity;
        }, 0),
        customerName: this.customerProfile.fullName,
        customerEmail: this.customerProfile.email,
        customerPhone: this.customerProfile.phone,
        orderType: orderType,
        deliveryAddress: orderType === 'delivery' ? {
          street: this.customerProfile.address.street,
          city: this.customerProfile.address.city,
          state: this.customerProfile.address.state,
          zipCode: this.customerProfile.address.zipCode
        } : undefined
      };
    } else if (url === '/api/reservations') {
      // Reservation data using realistic customer data
      const futureDate = new Date(Date.now() + (Math.floor(Math.random() * 14) + 1) * 24 * 60 * 60 * 1000); // 1-14 days ahead
      const times = ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];
      const specialRequest = generateSpecialRequest();
      
      return {
        date: futureDate.toISOString().split('T')[0], // YYYY-MM-DD format
        time: times[Math.floor(Math.random() * times.length)],
        guests: generatePartySize(),
        name: this.customerProfile.fullName,
        email: this.customerProfile.email,
        phone: this.customerProfile.phone,
        specialRequests: specialRequest
      };
    }
    
    // Default empty body for other POST endpoints
    return {};
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private simulatePaymentResult(): boolean {
    // More realistic payment failure rates based on card type and amount
    const { creditCard } = this.customerProfile;
    const totalAmount = Array.from(this.cart.entries()).reduce((total, [productId, qty]) => {
      const product = this.products.find(p => p.id === productId);
      return total + (product?.price || 0) * qty;
    }, 0);

    // Higher failure rates for higher amounts
    let baseSuccessRate = 0.95; // 95% base success rate
    if (totalAmount > 100) baseSuccessRate -= 0.05; // 90% for orders > $100
    if (totalAmount > 200) baseSuccessRate -= 0.05; // 85% for orders > $200

    // Different failure rates by card type (realistic banking scenarios)
    if (creditCard.type === 'amex') baseSuccessRate -= 0.02; // AMEX slightly higher decline
    if (creditCard.type === 'discover') baseSuccessRate -= 0.01; // Discover slightly higher decline

    return Math.random() < baseSuccessRate;
  }

  private async fetchWithRetries(url: string, method: string, ctx: Context, maxRetries = 2): Promise<any> {
    let attempt = 0;
    let lastError = null;

    while (attempt <= maxRetries) {
      try {
        const result = await this.fetchWithTracing(url, method, ctx);
        
        // Simulate occasional network errors that require retry
        if (attempt === 0 && Math.random() < 0.05) { // 5% chance of network error on first attempt
          console.log(`🔄 ${this.customerProfile.fullName} simulating network error on attempt ${attempt + 1}`);
          throw new Error('Network timeout - simulated');
        }
        
        return result;
      } catch (error) {
        lastError = error;
        attempt++;
        
        if (attempt <= maxRetries) {
          const retryDelay = addTimingJitter(1000 * attempt, 0.5); // Exponential backoff with jitter
          console.log(`🔄 ${this.customerProfile.fullName} retrying ${url} in ${retryDelay}ms (attempt ${attempt})`);
          await this.sleep(retryDelay);
        }
      }
    }

    // All retries failed
    console.log(`🚫 ${this.customerProfile.fullName} all retries failed for ${url}`);
    return { status: 500, data: { error: lastError?.message || 'Network error' }, failed: true };
  }

  private updateActivity(activity: string, stepIndex?: number, totalSteps?: number): void {
    if (this.trafficManager && this.trafficManager.updateUserActivity) {
      this.trafficManager.updateUserActivity(this.userId, activity, stepIndex, totalSteps);
    }
  }

  private getActivityForStep(step: JourneyStep): string {
    switch (step.action) {
      case 'navigate':
        const target = step.target?.replace('/', '') || 'page';
        const targetName = target === '' ? 'home' : target;
        return `navigating_to_${targetName}`;
      case 'browse':
        return 'browsing_menu';
      case 'add_to_cart':
        return 'adding_item_to_cart';
      case 'remove_from_cart':
        return 'removing_item_from_cart';
      case 'checkout':
        return 'starting_checkout';
      case 'view_details':
        return 'examining_product_details';
      case 'make_reservation':
        return 'booking_table';
      default:
        return step.action.replace('_', ' ');
    }
  }

  private simulateClick(elementSelector: string, elementText?: string): void {
    // Extract tag, id, and class from selector to match real user format exactly
    // Real users generate: tagName#id.class1.class2 (spaces in className replaced with dots)
    let realUserFormat = elementSelector;
    
    // Parse selector like "button#add-prod-1.add-to-cart-btn" or "button.no-id.flex.items.center"
    const selectorMatch = elementSelector.match(/^([a-z]+)(?:#([^.]+))?(?:\.(.+))?$/);
    if (selectorMatch) {
      const [, tag, id, classes] = selectorMatch;
      const idPart = id || 'no-id';
      // Keep classes as-is since they're already in the correct format (dots separated)
      const classPart = classes || 'no-class';
      realUserFormat = `${tag}#${idPart}.${classPart}`;
    }
    
    // Simulate realistic pre-click interactions
    if (Math.random() > 0.6) { // 40% chance of hover before click
      this.simulateHover(realUserFormat, elementText);
    }
    
    // Simulate a realistic click event matching real user format exactly
    this.performanceLogger.logUserInteraction('click', realUserFormat, 0);
    this.sessionTracker.recordInteraction('click', { element: realUserFormat, text: elementText });
    console.log(`🖱️ ${this.customerProfile.fullName} clicked: ${realUserFormat}${elementText ? ` (${elementText})` : ''}`);
  }

  private simulateHover(elementSelector: string, elementText?: string): void {
    // Simulate hover with realistic timing jitter
    const hoverDuration = addTimingJitter(800, 0.5); // Base 800ms hover
    this.performanceLogger.logUserInteraction('hover', elementSelector, hoverDuration);
    this.sessionTracker.recordInteraction('hover', { element: elementSelector, text: elementText, duration: hoverDuration });
    console.log(`🎯 ${this.customerProfile.fullName} hovered: ${elementSelector} for ${hoverDuration}ms`);
  }

  private async simulateFormFocus(elementSelector: string, fieldName: string): Promise<void> {
    // Simulate form field focus with realistic behavior
    const focusDuration = addTimingJitter(200, 0.3);
    this.performanceLogger.logUserInteraction('focus', elementSelector, focusDuration);
    this.sessionTracker.recordInteraction('focus', { element: elementSelector, field: fieldName });
    console.log(`📝 ${this.customerProfile.fullName} focused: ${fieldName}`);
    
    // Simulate typing delay after focus
    await this.sleep(focusDuration);
    
    // Add blur event when done with field
    setTimeout(() => {
      this.performanceLogger.logUserInteraction('blur', elementSelector, 0);
      this.sessionTracker.recordInteraction('blur', { element: elementSelector, field: fieldName });
    }, addTimingJitter(3000, 0.6));
  }

  private async simulateScrolling(direction: 'down' | 'up' = 'down'): Promise<void> {
    // Simulate realistic scrolling behavior
    const scrollAmount = Math.floor(Math.random() * 500) + 200; // 200-700px scroll
    const scrollDuration = addTimingJitter(1200, 0.4);
    
    this.performanceLogger.logUserInteraction('scroll', `window.${direction}`, scrollDuration);
    this.sessionTracker.recordInteraction('scroll', { 
      direction, 
      amount: scrollAmount, 
      duration: scrollDuration 
    });
    
    console.log(`📜 ${this.customerProfile.fullName} scrolled ${direction} ${scrollAmount}px in ${scrollDuration}ms`);
    await this.sleep(scrollDuration);
  }

  private getNavigationLinkSelector(path: string): string {
    // Generate realistic navigation link selectors based on actual Navigation component
    // Real navigation uses Link + Button components with classes like "flex items-center space-x-2"
    switch (path) {
      case '/':
        return 'button.no-id.flex.items.center.space.x.2'; // Home button
      case '/menu':
        return 'button.no-id.flex.items.center.space.x.2'; // Menu button  
      case '/reservations':
        return 'button.no-id.flex.items.center.space.x.2'; // Reservations button
      case '/config':
        return 'button.no-id.flex.items.center.space.x.2'; // Config button
      default:
        return 'button.no-id.flex.items.center.space.x.2';
    }
  }

  abort(): void {
    this.aborted = true;
    this.sessionTracker.endSession('aborted');
  }

  getSessionId(): string {
    return this.sessionTracker.getSessionId();
  }

  getTraceId(): string | undefined {
    return this.sessionTracker.getTraceId();
  }

  getJourneyName(): string {
    return this.journey.name;
  }

  getCurrentStep(): number {
    return this.currentStep;
  }

  getJourneyProgress(): { current: number; total: number; percentage: number } {
    const total = this.journey.steps.length;
    const percentage = total > 0 ? Math.round((this.currentStep / total) * 100) : 0;
    return {
      current: this.currentStep,
      total,
      percentage
    };
  }

  // Getter method for TrafficManager
  getJourneyName(): string {
    return this.journey.name;
  }

  // Debug method to get current status
  getStatus(): { userId: string; journey: string; step: number; activity: string } {
    return {
      userId: this.userId,
      journey: this.journey.name,
      step: this.currentStep,
      activity: this.trafficManager?.activeUsers?.get(this.userId)?.currentActivity || 'unknown'
    };
  }
}