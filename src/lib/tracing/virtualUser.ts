import { trace, context, SpanStatusCode, Span, Context } from '@opentelemetry/api';
import { UserJourney, JourneyStep, getThinkTime, shouldExecuteStep } from './userJourneys';
import { SessionTracker } from './sessionTracker';
import PerformanceLogger from '@/lib/performanceLogger';

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

  constructor(userId: string, journey: UserJourney, trafficManager?: any) {
    this.userId = userId;
    this.journey = journey;
    this.trafficManager = trafficManager;
    this.sessionTracker = SessionTracker.createStandaloneSession(userId, journey.name);
    this.performanceLogger = PerformanceLogger.getInstance();
    
    // Initialize with sample products for cart operations
    this.initializeProducts();
  }

  private initializeProducts() {
    // Sample products for virtual user interactions
    this.products = [
      { id: 'prod-1', name: 'Margherita Pizza', price: 14.99 },
      { id: 'prod-2', name: 'Caesar Salad', price: 11.99 },
      { id: 'prod-3', name: 'Spaghetti Carbonara', price: 16.99 },
      { id: 'prod-4', name: 'Grilled Salmon', price: 24.99 },
      { id: 'prod-5', name: 'Chicken Parmesan', price: 19.99 },
      { id: 'prod-6', name: 'Tiramisu', price: 7.99 }
    ];
  }

  async executeJourney(): Promise<void> {
    try {
      console.log(`🎭 Virtual user ${this.userId} starting journey: ${this.journey.name}`);
      this.updateActivity(`starting_${this.journey.name.toLowerCase().replace(/\s+/g, '_')}`);
      
      for (let i = 0; i < this.journey.steps.length && !this.aborted; i++) {
        const step = this.journey.steps[i];
        this.currentStep = i;
        
        if (!shouldExecuteStep(step)) {
          console.log(`⏭️ Virtual user ${this.userId} skipping step ${i}: ${step.action}`);
          continue;
        }

        console.log(`🔄 Virtual user ${this.userId} executing step ${i}: ${step.action}`);
        this.updateActivity(this.getActivityForStep(step), i, this.journey.steps.length);
        await this.executeStep(step, i);
        
        // Simulate think time between actions
        const thinkTime = getThinkTime(step);
        console.log(`🤔 Virtual user ${this.userId} thinking for ${thinkTime}ms`);
        this.updateActivity(`thinking_after_${step.action}`, i, this.journey.steps.length);
        await this.sleep(thinkTime);
      }

      console.log(`✅ Virtual user ${this.userId} completed journey: ${this.journey.name}`);
      this.updateActivity('journey_completed');
    } catch (error) {
      console.error(`❌ Virtual user ${this.userId} journey failed:`, error);
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
    // Log user interaction for browsing
    this.performanceLogger.logUserInteraction('browse', 'product-catalog', 0);
    
    // Simulate browsing behavior - browse 2-5 products
    const browseCount = Math.floor(Math.random() * 4) + 2;
    
    for (let i = 0; i < browseCount; i++) {
      const product = this.products[Math.floor(Math.random() * this.products.length)];
      
      // Log user interaction for each product view
      this.performanceLogger.logUserInteraction('view', `product-${product.id}`, 0);
      
      parentSpan.addEvent('product_viewed', {
        'product.id': product.id,
        'product.name': product.name,
        'product.price': product.price
      });

      // Simulate reading product description and price (2-5 seconds per product)
      await this.sleep(2000 + Math.random() * 3000);
    }
  }

  private async addToCart(parentSpan: Span): Promise<void> {
    const product = this.products[Math.floor(Math.random() * this.products.length)];
    const quantity = Math.floor(Math.random() * 3) + 1;
    
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
      { id: product.id, name: product.name, price: product.price, category: 'main' },
      quantityBefore,
      quantityAfter,
      cartTotal,
      0
    );
    
    console.log(`🛒 User ${this.userId} added ${quantity}x ${product.name} to cart (${totalItems} total items)`);
    
    parentSpan.addEvent('item_added_to_cart', {
      'product.id': product.id,
      'product.name': product.name,
      'quantity': quantity,
      'cart.total_items': totalItems
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
    
    // Log cart action with all required data
    this.performanceLogger.logCartAction(
      'REMOVE',
      { id: product.id, name: product.name, price: product.price, category: 'main' },
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

    console.log(`💳 User ${this.userId} starting checkout - ${itemCount} items, $${totalAmount.toFixed(2)}`);
    this.updateActivity('starting_payment_process');

    // Start checkout span
    const checkoutSpan = this.sessionTracker.startCheckout(orderId, totalAmount, itemCount);

    try {
      // Simulate checkout steps
      await this.simulatePaymentProcess(checkoutSpan);
      
      checkoutSpan.setStatus({ code: SpanStatusCode.OK });
      console.log(`✅ User ${this.userId} completed checkout - Order ${orderId}`);
      this.updateActivity('checkout_completed');
      this.cart.clear();
    } catch (error) {
      console.log(`❌ User ${this.userId} checkout failed - ${error.message}`);
      this.updateActivity('checkout_failed');
      checkoutSpan.recordException(error as Error);
      checkoutSpan.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      checkoutSpan.end();
    }
  }

  private async simulatePaymentProcess(checkoutSpan: Span): Promise<void> {
    const ctx = trace.setSpan(context.active(), checkoutSpan);

    // Generate fake payment and customer data for logging
    const paymentData = {
      cardNumber: '4532-1234-5678-9012',
      expiryDate: '12/25',
      cvv: '123',
      cardHolderName: `Virtual User ${this.userId}`
    };

    const customerData = {
      name: `Virtual User ${this.userId}`,
      email: `${this.userId}@example.com`,
      phone: '555-0123'
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
      orderType: 'delivery'
    };

    // Stage 1: Payment initiated
    this.updateActivity('entering_payment_details');
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

    // Simulate payment validation (3-5 seconds)
    await this.sleep(3000 + Math.random() * 2000);
    
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

    // Stage 3: Payment success/failure (90% success rate)
    const success = Math.random() > 0.1;
    
    if (success) {
      this.updateActivity('payment_successful');
      checkoutSpan.addEvent('payment_success');
      
      this.performanceLogger.logPaymentAttempt(
        paymentData,
        customerData,
        transactionData,
        'success',
        2500
      );
      
      console.log(`💰 User ${this.userId} payment successful, posting order to /api/orders`);
      this.updateActivity('creating_order');
      const orderResponse = await this.fetchWithTracing('/api/orders', 'POST', ctx);
      
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
            notes: 'Virtual user order'
          },
          300
        );
      }
      
      console.log(`📦 User ${this.userId} order successfully posted to API`);
      this.updateActivity('order_confirmed');
    } else {
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
      
      console.log(`💸 User ${this.userId} payment failed - card declined`);
      throw new Error('Payment failed');
    }
  }

  private async viewProductDetails(parentSpan: Span): Promise<void> {
    const product = this.products[Math.floor(Math.random() * this.products.length)];
    
    // Log user interaction for viewing product details
    this.performanceLogger.logUserInteraction('view_details', `product-details-${product.id}`, 0);
    
    parentSpan.addEvent('product_details_viewed', {
      'product.id': product.id,
      'product.name': product.name
    });

    // Don't call /api/products/:id since virtual users use fake IDs
    // Just simulate viewing without API call to avoid 404s
    console.log(`👀 User ${this.userId} viewing product details: ${product.name}`);
    // Simulate reading product details, ingredients, reviews (3-8 seconds)
    await this.sleep(3000 + Math.random() * 5000);
  }

  private async makeReservation(parentSpan: Span): Promise<void> {
    this.updateActivity('starting_reservation');
    parentSpan.addEvent('reservation_started');
    
    // Log user interaction for starting reservation
    this.performanceLogger.logUserInteraction('start_reservation', 'reservation-form', 0);
    
    // Simulate reservation form filling (more realistic: 5-10 seconds)
    this.updateActivity('filling_reservation_form');
    await this.sleep(5000 + Math.random() * 5000);
    
    const ctx = trace.setSpan(context.active(), parentSpan);
    
    const reservationId = `virtual-reservation-${this.userId}-${Date.now()}`;
    
    try {
      this.updateActivity('submitting_reservation');
      const reservationResponse = await this.fetchWithTracing('/api/reservations', 'POST', ctx);
      
      // Log data operation for reservation creation
      if (reservationResponse && !reservationResponse.failed) {
        this.updateActivity('reservation_confirmed');
        this.performanceLogger.logDataOperation(
          'CREATE',
          'reservation',
          reservationId,
          {
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            time: '19:00',
            guests: Math.floor(Math.random() * 6) + 2,
            customerName: `Virtual User ${this.userId}`,
            customerEmail: `${this.userId}@example.com`,
            customerPhone: '555-0123',
            specialRequests: 'Virtual user reservation'
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
    const fetchSpan = this.tracer.startSpan(
      `http_${method.toLowerCase()}`,
      {
        attributes: {
          'http.method': method,
          'http.url': `http://localhost:3001${url}`,
          'http.target': url,
          'http.user_agent': 'virtual-user-agent'
        }
      },
      ctx
    );

    try {
      const requestBody = method === 'POST' ? this.getRequestBody(url) : undefined;
      console.log(`🌐 User ${this.userId} making ${method} request to ${url}`, requestBody ? { body: requestBody } : '');
      
      // Make actual HTTP request to real endpoints
      const response = await fetch(`http://localhost:3001${url}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'virtual-user-agent',
          'X-Virtual-User': this.userId,
          'X-Request-Source': 'virtual-traffic-simulator'
        },
        // Add appropriate body for POST requests based on endpoint
        body: method === 'POST' ? JSON.stringify(requestBody) : undefined
      });
      
      const statusCode = response.status;
      const responseText = await response.text();
      
      console.log(`📡 User ${this.userId} received ${statusCode} response from ${url} (${responseText.length} bytes)`);
      
      fetchSpan.setAttributes({
        'http.status_code': statusCode,
        'http.response_content_length': responseText.length
      });

      if (!response.ok) {
        console.log(`⚠️ User ${this.userId} API error: ${statusCode} ${response.statusText} for ${url} - continuing session`);
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
      console.log(`🚫 User ${this.userId} network error for ${url}: ${error.message} - continuing session`);
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
      // Order data for checkout
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
        customerName: `Virtual User ${this.userId}`,
        customerEmail: `${this.userId}@example.com`,
        customerPhone: '555-0123',
        orderType: 'delivery'
      };
    } else if (url === '/api/reservations') {
      // Reservation data - match server's expected fields
      return {
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // YYYY-MM-DD format
        time: '19:00',
        guests: Math.floor(Math.random() * 6) + 2, // Server expects 'guests', not 'partySize'
        name: `Virtual User ${this.userId}`,
        email: `${this.userId}@example.com`,
        phone: '555-0123',
        specialRequests: 'Virtual user reservation'
      };
    }
    
    // Default empty body for other POST endpoints
    return {};
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
}