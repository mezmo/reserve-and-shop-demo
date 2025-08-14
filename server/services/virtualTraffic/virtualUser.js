import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { USER_JOURNEYS, getThinkTime, shouldExecuteStep } from './userJourneys.js';
import { SessionTracker } from './sessionTracker.js';
import PerformanceLogger from './performanceLogger.js';
import { DataStore } from './dataStore.js';
import { 
  generateCustomerProfile, 
  generateSpecialRequest, 
  formatCreditCardNumber, 
  generateOrderType, 
  generatePartySize, 
  generateBrowserFingerprint, 
  generateNetworkTiming, 
  addTimingJitter 
} from './fakeDataGenerator.js';

class VirtualUser {
  constructor(userId, journey, trafficManager) {
    this.tracer = trace.getTracer('virtual-user', '1.0.0');
    this.sessionTracker = null;
    this.performanceLogger = null;
    this.trafficManager = trafficManager;
    this.userId = userId;
    this.journey = journey;
    this.currentStep = 0;
    this.cart = new Map();
    this.products = [];
    this.aborted = false;
    this.customerProfile = null;
    this.browserFingerprint = null;
    this.metricsLogger = null;

    // Verify OpenTelemetry
    const tracerProvider = trace.getTracerProvider();
    if (!tracerProvider || tracerProvider.constructor.name === 'NoopTracerProvider') {
      console.warn(`⚠️ Virtual user ${userId}: OpenTelemetry tracer provider not initialized.`);
    } else {
      console.log(`🔍 Virtual user ${userId}: Using tracer provider: ${tracerProvider.constructor.name}`);
    }

    // Generate realistic customer profile and browser fingerprint
    this.customerProfile = generateCustomerProfile();
    this.browserFingerprint = generateBrowserFingerprint();
    
    // Create session with realistic browser context
    this.sessionTracker = SessionTracker.createStandaloneSession(userId, journey.name, this.browserFingerprint);
    
    // Use the real performance logger instance
    this.performanceLogger = PerformanceLogger.getInstance();
    
    // Initialize simple metrics logger (console-based for server-side)
    this.metricsLogger = {
      logCounter: (name, value, tags) => {
        console.log(`📊 Virtual User Metric Counter: ${name} = ${value}`, tags);
      },
      logGauge: (name, value, unit, tags) => {
        console.log(`📊 Virtual User Metric Gauge: ${name} = ${value} ${unit || 'units'}`, tags);
      },
      logBusinessMetric: (name, value, currency, tags) => {
        console.log(`📊 Business Metric: ${name} = ${value} ${currency || 'units'}`, tags);
      },
      logPerformanceMetric: (name, duration, tags) => {
        console.log(`📊 Performance Metric: ${name} = ${duration}ms`, tags);
      }
    };
    
    // Initialize with sample products
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

  initializeProducts() {
    const dataStore = DataStore.getInstance();
    const realProducts = dataStore.getProducts();
    
    this.products = realProducts.map(product => ({
      id: product.id,
      name: product.name,
      price: product.price,
      category: product.category
    }));
    
    console.log(`🏪 Virtual user ${this.customerProfile.fullName} (${this.userId}) initialized with ${this.products.length} real products`);
    
    // Log complete sensitive customer profile for downstream filtering tests
    this.performanceLogger.logSensitiveCustomerData(this.customerProfile, 'virtual_user_created');
  }

  async executeJourney() {
    try {
      console.log(`🎭 ${this.customerProfile.fullName} (${this.userId}) starting journey: ${this.journey.name} with ${this.journey.steps.length} steps`);
      
      const tracerProvider = trace.getTracerProvider();
      console.log(`🔍 Virtual User ${this.userId} trace provider status: ${JSON.stringify({
        providerType: tracerProvider.constructor.name,
        isNoopProvider: tracerProvider.constructor.name === 'NoopTracerProvider'
      })}`);
      
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
      this.updateActivity('journey_failed');
      throw error;
    } finally {
      this.sessionTracker.endSession('journey_complete');
    }
  }

  async executeStep(step, stepIndex) {
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
    
    const spanContext = stepSpan.spanContext();
    console.log(`🔍 Virtual User ${this.userId} generated trace: ${JSON.stringify({
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      spanName: `step_${stepIndex}_${step.action}`,
      isRecording: stepSpan.isRecording()
    })}`);

    try {
      switch (step.action) {
        case 'navigate':
          await this.navigate(step.target, stepSpan);
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
      stepSpan.recordException(error);
      stepSpan.setStatus({ 
        code: SpanStatusCode.ERROR,
        message: error.message 
      });
      throw error;
    } finally {
      stepSpan.end();
    }
  }

  async navigate(path, parentSpan) {
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

  async simulatePageLoad(path, ctx) {
    const promises = [];

    switch (path) {
      case '/':
        promises.push(this.fetchWithTracing('/api/health', 'GET', ctx));
        break;
      case '/menu':
        promises.push(this.fetchWithTracing('/api/products', 'GET', ctx));
        break;
      case '/reservations':
        promises.push(this.fetchWithTracing('/api/reservations', 'GET', ctx));
        break;
      case '/config':
        promises.push(this.fetchWithTracing('/api/settings', 'GET', ctx));
        break;
    }

    await Promise.all(promises);
  }

  async browseProducts(parentSpan) {
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
      
      // Simulate clicking on product card
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

      // Simulate reading product description and price
      await this.sleep(engagementTime);
    }
  }

  async addToCart(parentSpan) {
    const product = this.products[Math.floor(Math.random() * this.products.length)];
    const quantity = Math.floor(Math.random() * 3) + 1;
    
    // Simulate clicking the "Add to Cart" button
    const addButtonSelector = `button.no-id.bg.primary.hover.bg.primary.90.text.primary.foreground.shadow.md`;
    this.simulateClick(addButtonSelector, `Add ${product.name} to Cart`);
    
    await this.sleep(150 + Math.random() * 100);
    
    const quantityBefore = this.cart.get(product.id) || 0;
    this.cart.set(product.id, quantityBefore + quantity);
    const quantityAfter = this.cart.get(product.id) || 0;
    
    const cartTotal = Array.from(this.cart.entries()).reduce((total, [productId, qty]) => {
      const prod = this.products.find(p => p.id === productId);
      return total + (prod?.price || 0) * qty;
    }, 0);
    
    const totalItems = Array.from(this.cart.values()).reduce((a, b) => a + b, 0);
    
    // Log cart action with all required data
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

    this.sessionTracker.recordInteraction('add_to_cart', { productId: product.id, quantity });
  }

  async removeFromCart(parentSpan) {
    if (this.cart.size === 0) return;
    
    const cartItems = Array.from(this.cart.keys());
    const productId = cartItems[Math.floor(Math.random() * cartItems.length)];
    const quantityBefore = this.cart.get(productId) || 0;
    const product = this.products.find(p => p.id === productId);
    
    if (!product) return;
    
    // Simulate clicking the "Remove" button
    const removeButtonSelector = `button.no-id.border.primary.text.primary.hover.bg.primary.hover.text.primary.foreground`;
    this.simulateClick(removeButtonSelector, `Remove ${product.name} from Cart`);
    
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
    
    // Log cart action
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

  async checkout(parentSpan) {
    this.updateActivity('preparing_checkout');
    
    if (this.cart.size === 0) {
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

    const checkoutSpan = this.sessionTracker.startCheckout(orderId, totalAmount, itemCount);

    try {
      const paymentSucceeded = await this.simulatePaymentProcess(checkoutSpan);
      
      if (paymentSucceeded) {
        checkoutSpan.setStatus({ code: SpanStatusCode.OK });
        console.log(`✅ ${this.customerProfile.fullName} completed checkout - Order ${orderId}`);
        this.updateActivity('checkout_completed');
        this.cart.clear();
      } else {
        checkoutSpan.setStatus({ code: SpanStatusCode.OK });
        console.log(`🛒 ${this.customerProfile.fullName} checkout abandoned after payment decline`);
      }
    } catch (error) {
      console.log(`❌ ${this.customerProfile.fullName} checkout failed - ${error.message}`);
      this.updateActivity('checkout_failed');
      checkoutSpan.recordException(error);
      checkoutSpan.setStatus({ code: SpanStatusCode.ERROR });
    } finally {
      checkoutSpan.end();
    }
  }

  async simulatePaymentProcess(checkoutSpan) {
    const ctx = trace.setSpan(context.active(), checkoutSpan);

    const paymentData = {
      cardNumber: this.customerProfile.creditCard.number, // Raw card number for logging (no formatting)
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
    
    // Simulate form filling
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
    
    // Simulate payment validation
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
    
    // Simulate payment processing
    await this.sleep(4000 + Math.random() * 2000);

    // Stage 3: Payment success/failure
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

      console.log(`💰 User ${this.customerProfile.fullName} payment successful, posting order to /api/orders`);
      this.updateActivity('creating_order');
      
      const orderResponse = await this.fetchWithRetries('/api/orders', 'POST', ctx, 1);
      
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
            orderType: transactionData.orderType
          },
          300
        );
      }
      
      console.log(`📦 ${this.customerProfile.fullName} order successfully posted to API`);
      this.updateActivity('order_confirmed');
      return true;
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
      
      console.log(`💸 ${this.customerProfile.fullName} payment failed - card declined`);
      
      // Simulate retry behavior
      const shouldRetry = Math.random() > 0.4;
      
      if (shouldRetry) {
        console.log(`🔄 ${this.customerProfile.fullName} attempting payment retry`);
        this.updateActivity('retrying_payment');
        checkoutSpan.addEvent('payment_retry_attempt');
        
        await this.sleep(addTimingJitter(3000, 0.5));
        await this.simulateFormFocus('input.no-id.flex.h.10.w.full.rounded.md.border', 'Card Number Field');
        await this.sleep(addTimingJitter(2000, 0.4));
        
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
      
      await this.sleep(addTimingJitter(2000, 0.5));
      this.updateActivity('checkout_abandoned');
      checkoutSpan.addEvent('checkout_abandoned');
      
      return false;
    }
  }

  async viewProductDetails(parentSpan) {
    const product = this.products[Math.floor(Math.random() * this.products.length)];
    
    const detailLinkSelector = `h3.no-id.text.lg.font.semibold.leading.none.tracking.tight`;
    this.simulateClick(detailLinkSelector, `View ${product.name} Details`);
    await this.sleep(400 + Math.random() * 300);
    
    this.performanceLogger.logUserInteraction('view_details', `product-details-${product.id}`, 0);
    
    if (Math.random() > 0.4) {
      this.simulateClick(`img.no-id.w.full.h.full.object.cover`, 'Product Image');
      await this.sleep(600 + Math.random() * 400);
    }
    
    if (Math.random() > 0.6) {
      this.performanceLogger.logUserInteraction('scroll', `p.no-id.text.muted.foreground.mb.4`, 0);
      await this.sleep(1000 + Math.random() * 800);
    }
    
    if (Math.random() > 0.7) {
      this.simulateClick(`div.no-id.rounded.lg.border.bg.card.text.card.foreground.shadow.sm`, 'Product Details Section');
      await this.sleep(800 + Math.random() * 600);
    }
    
    parentSpan.addEvent('product_details_viewed', {
      'product.id': product.id,
      'product.name': product.name
    });

    console.log(`👀 ${this.customerProfile.fullName} viewing product details: ${product.name}`);
    await this.sleep(2000 + Math.random() * 2000);
  }

  async makeReservation(parentSpan) {
    this.updateActivity('starting_reservation');
    parentSpan.addEvent('reservation_started');
    
    this.performanceLogger.logUserInteraction('start_reservation', 'reservation-form', 0);
    
    this.updateActivity('filling_reservation_form');
    
    // Simulate form filling
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
      await this.sleep(1000 + Math.random() * 500);
      this.simulateClick('button.no-id.inline.flex.items.center.justify.center.rounded.md', 'Submit Reservation');
      
      this.updateActivity('submitting_reservation');
      const reservationResponse = await this.fetchWithTracing('/api/reservations', 'POST', ctx);
      
      if (reservationResponse && !reservationResponse.failed) {
        this.updateActivity('reservation_confirmed');
        const reservationBody = this.getRequestBody('/api/reservations');
        
        // Log reservation with sensitive customer data for downstream filtering tests
        this.performanceLogger.logReservationData(this.customerProfile, {
          reservationId: reservationId,
          date: reservationBody.date,
          time: reservationBody.time,
          guests: reservationBody.guests,
          customerName: reservationBody.name,
          customerEmail: reservationBody.email,
          customerPhone: reservationBody.phone,
          specialRequests: reservationBody.specialRequests
        });
        
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

  async fetchWithTracing(url, method, ctx) {
    const networkTiming = generateNetworkTiming();
    const startTime = Date.now();
    
    const fetchSpan = this.tracer.startSpan(
      `http_${method.toLowerCase()}`,
      {
        attributes: {
          'http.method': method,
          'http.url': `http://localhost:3001${url}`,
          'http.target': url,
          'http.user_agent': this.browserFingerprint.userAgent,
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
      
      const networkDelay = addTimingJitter(networkTiming.responseStart - networkTiming.fetchStart, 0.4);
      await this.sleep(Math.max(10, networkDelay));
      
      // Make actual HTTP request to real endpoints (server-side fetch)
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`http://localhost:3001${url}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.browserFingerprint.userAgent,
          'Accept-Language': this.browserFingerprint.language,
          'X-Virtual-User': this.userId,
          'X-Request-Source': 'virtual-traffic-simulator'
        },
        body: method === 'POST' ? JSON.stringify(requestBody) : undefined
      });
      
      const statusCode = response.status;
      const responseText = await response.text();
      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      
      console.log(`📡 ${this.customerProfile.fullName} received ${statusCode} response from ${url} (${responseText.length} bytes)`);
      
      fetchSpan.setAttributes({
        'http.status_code': statusCode,
        'http.response_content_length': responseText.length,
        'network.transfer_size': networkTiming.transferSize,
        'network.encoded_body_size': networkTiming.encodedBodySize,
        'network.decoded_body_size': networkTiming.decodedBodySize,
        'network.total_duration': totalDuration,
        'network.response_time': addTimingJitter(networkTiming.responseEnd - networkTiming.responseStart, 0.2)
      });

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
      fetchSpan.recordException(error);
      fetchSpan.setStatus({ code: SpanStatusCode.ERROR });
      return { 
        status: 0, 
        data: { error: error.message },
        failed: true
      };
    } finally {
      fetchSpan.end();
    }
  }

  getRequestBody(url) {
    if (url === '/api/orders') {
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
      const futureDate = new Date(Date.now() + (Math.floor(Math.random() * 14) + 1) * 24 * 60 * 60 * 1000);
      const times = ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];
      const specialRequest = generateSpecialRequest();
      
      return {
        date: futureDate.toISOString().split('T')[0],
        time: times[Math.floor(Math.random() * times.length)],
        guests: generatePartySize(),
        name: this.customerProfile.fullName,
        email: this.customerProfile.email,
        phone: this.customerProfile.phone,
        specialRequests: specialRequest
      };
    }
    
    return {};
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  simulatePaymentResult() {
    const { creditCard } = this.customerProfile;
    const totalAmount = Array.from(this.cart.entries()).reduce((total, [productId, qty]) => {
      const product = this.products.find(p => p.id === productId);
      return total + (product?.price || 0) * qty;
    }, 0);

    let baseSuccessRate = 0.95;
    if (totalAmount > 100) baseSuccessRate -= 0.05;
    if (totalAmount > 200) baseSuccessRate -= 0.05;

    if (creditCard.type === 'amex') baseSuccessRate -= 0.02;
    if (creditCard.type === 'discover') baseSuccessRate -= 0.01;

    return Math.random() < baseSuccessRate;
  }

  async fetchWithRetries(url, method, ctx, maxRetries = 2) {
    let attempt = 0;
    let lastError = null;

    while (attempt <= maxRetries) {
      try {
        const result = await this.fetchWithTracing(url, method, ctx);
        
        if (attempt === 0 && Math.random() < 0.05) {
          console.log(`🔄 ${this.customerProfile.fullName} simulating network error on attempt ${attempt + 1}`);
          throw new Error('Network timeout - simulated');
        }
        
        return result;
      } catch (error) {
        lastError = error;
        attempt++;
        
        if (attempt <= maxRetries) {
          const retryDelay = addTimingJitter(1000 * attempt, 0.5);
          console.log(`🔄 ${this.customerProfile.fullName} retrying ${url} in ${retryDelay}ms (attempt ${attempt})`);
          await this.sleep(retryDelay);
        }
      }
    }

    console.log(`🚫 ${this.customerProfile.fullName} all retries failed for ${url}`);
    return { status: 500, data: { error: lastError?.message || 'Network error' }, failed: true };
  }

  updateActivity(activity, stepIndex, totalSteps) {
    if (this.trafficManager && this.trafficManager.updateUserActivity) {
      this.trafficManager.updateUserActivity(this.userId, activity, stepIndex, totalSteps);
    }
  }

  getActivityForStep(step) {
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

  simulateClick(elementSelector, elementText) {
    let realUserFormat = elementSelector;
    
    const selectorMatch = elementSelector.match(/^([a-z]+)(?:#([^.]+))?(?:\.(.+))?$/);
    if (selectorMatch) {
      const [, tag, id, classes] = selectorMatch;
      const idPart = id || 'no-id';
      const classPart = classes || 'no-class';
      realUserFormat = `${tag}#${idPart}.${classPart}`;
    }
    
    if (Math.random() > 0.6) {
      this.simulateHover(realUserFormat, elementText);
    }
    
    this.performanceLogger.logUserInteraction('click', realUserFormat, 0);
    this.sessionTracker.recordInteraction('click', { element: realUserFormat, text: elementText });
    console.log(`🖱️ ${this.customerProfile.fullName} clicked: ${realUserFormat}${elementText ? ` (${elementText})` : ''}`);
  }

  simulateHover(elementSelector, elementText) {
    const hoverDuration = addTimingJitter(800, 0.5);
    this.performanceLogger.logUserInteraction('hover', elementSelector, hoverDuration);
    this.sessionTracker.recordInteraction('hover', { element: elementSelector, text: elementText, duration: hoverDuration });
    console.log(`🎯 ${this.customerProfile.fullName} hovered: ${elementSelector} for ${hoverDuration}ms`);
  }

  async simulateFormFocus(elementSelector, fieldName) {
    const focusDuration = addTimingJitter(200, 0.3);
    this.performanceLogger.logUserInteraction('focus', elementSelector, focusDuration);
    this.sessionTracker.recordInteraction('focus', { element: elementSelector, field: fieldName });
    console.log(`📝 ${this.customerProfile.fullName} focused: ${fieldName}`);
    
    await this.sleep(focusDuration);
    
    setTimeout(() => {
      this.performanceLogger.logUserInteraction('blur', elementSelector, 0);
      this.sessionTracker.recordInteraction('blur', { element: elementSelector, field: fieldName });
    }, addTimingJitter(3000, 0.6));
  }

  async simulateScrolling(direction = 'down') {
    const scrollAmount = Math.floor(Math.random() * 500) + 200;
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

  getNavigationLinkSelector(path) {
    switch (path) {
      case '/':
        return 'button.no-id.flex.items.center.space.x.2';
      case '/menu':
        return 'button.no-id.flex.items.center.space.x.2';
      case '/reservations':
        return 'button.no-id.flex.items.center.space.x.2';
      case '/config':
        return 'button.no-id.flex.items.center.space.x.2';
      default:
        return 'button.no-id.flex.items.center.space.x.2';
    }
  }

  abort() {
    this.aborted = true;
    this.sessionTracker.endSession('aborted');
  }

  getSessionId() {
    return this.sessionTracker.getSessionId();
  }

  getTraceId() {
    return this.sessionTracker.getTraceId();
  }

  getJourneyName() {
    return this.journey.name;
  }

  getCurrentStep() {
    return this.currentStep;
  }

  getJourneyProgress() {
    const total = this.journey.steps.length;
    const percentage = total > 0 ? Math.round((this.currentStep / total) * 100) : 0;
    return {
      current: this.currentStep,
      total,
      percentage
    };
  }

  getStatus() {
    return {
      userId: this.userId,
      journey: this.journey.name,
      step: this.currentStep,
      activity: this.trafficManager?.activeUsers?.get(this.userId)?.currentActivity || 'unknown'
    };
  }
}

export {
  VirtualUser
};