import { trace, context, SpanStatusCode, Span, Context } from '@opentelemetry/api';
import { UserJourney, JourneyStep, getThinkTime, shouldExecuteStep } from './userJourneys';
import { SessionTracker } from './sessionTracker';

export class VirtualUser {
  private tracer = trace.getTracer('virtual-user', '1.0.0');
  private sessionTracker: SessionTracker;
  private userId: string;
  private journey: UserJourney;
  private currentStep: number = 0;
  private cart: Map<string, number> = new Map();
  private products: any[] = [];
  private aborted: boolean = false;

  constructor(userId: string, journey: UserJourney) {
    this.userId = userId;
    this.journey = journey;
    this.sessionTracker = SessionTracker.createStandaloneSession(userId, journey.name);
    
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
      console.log(`Virtual user ${this.userId} starting journey: ${this.journey.name}`);
      
      for (let i = 0; i < this.journey.steps.length && !this.aborted; i++) {
        const step = this.journey.steps[i];
        
        if (!shouldExecuteStep(step)) {
          console.log(`Virtual user ${this.userId} skipping step ${i}: ${step.action}`);
          continue;
        }

        await this.executeStep(step, i);
        
        // Simulate think time between actions
        const thinkTime = getThinkTime(step);
        await this.sleep(thinkTime);
      }

      console.log(`Virtual user ${this.userId} completed journey`);
    } catch (error) {
      console.error(`Virtual user ${this.userId} journey failed:`, error);
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
    const context = trace.setSpan(context.active(), parentSpan);
    
    // Update session tracker
    this.sessionTracker.startNavigation(path);

    // Simulate API calls that would happen on this page
    await this.simulatePageLoad(path, context);
  }

  private async simulatePageLoad(path: string, ctx: Context): Promise<void> {
    const promises: Promise<any>[] = [];

    switch (path) {
      case '/':
        promises.push(this.fetchWithTracing('/api/health', 'GET', ctx));
        break;
      case '/menu':
        promises.push(this.fetchWithTracing('/api/products', 'GET', ctx));
        promises.push(this.fetchWithTracing('/api/categories', 'GET', ctx));
        break;
      case '/reservations':
        promises.push(this.fetchWithTracing('/api/reservations', 'GET', ctx));
        promises.push(this.fetchWithTracing('/api/availability', 'GET', ctx));
        break;
      case '/config':
        promises.push(this.fetchWithTracing('/api/config', 'GET', ctx));
        break;
    }

    await Promise.all(promises);
  }

  private async browseProducts(parentSpan: Span): Promise<void> {
    // Simulate browsing behavior
    const browseCount = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < browseCount; i++) {
      const product = this.products[Math.floor(Math.random() * this.products.length)];
      
      parentSpan.addEvent('product_viewed', {
        'product.id': product.id,
        'product.name': product.name,
        'product.price': product.price
      });

      await this.sleep(500 + Math.random() * 1000);
    }
  }

  private async addToCart(parentSpan: Span): Promise<void> {
    const product = this.products[Math.floor(Math.random() * this.products.length)];
    const quantity = Math.floor(Math.random() * 3) + 1;
    
    this.cart.set(product.id, (this.cart.get(product.id) || 0) + quantity);
    
    parentSpan.addEvent('item_added_to_cart', {
      'product.id': product.id,
      'product.name': product.name,
      'quantity': quantity,
      'cart.total_items': Array.from(this.cart.values()).reduce((a, b) => a + b, 0)
    });

    this.sessionTracker.recordInteraction('add_to_cart', { productId: product.id, quantity });
  }

  private async removeFromCart(parentSpan: Span): Promise<void> {
    if (this.cart.size === 0) return;
    
    const cartItems = Array.from(this.cart.keys());
    const productId = cartItems[Math.floor(Math.random() * cartItems.length)];
    const currentQuantity = this.cart.get(productId) || 0;
    
    if (currentQuantity > 1) {
      this.cart.set(productId, currentQuantity - 1);
    } else {
      this.cart.delete(productId);
    }
    
    parentSpan.addEvent('item_removed_from_cart', {
      'product.id': productId,
      'cart.total_items': Array.from(this.cart.values()).reduce((a, b) => a + b, 0)
    });

    this.sessionTracker.recordInteraction('remove_from_cart', { productId });
  }

  private async checkout(parentSpan: Span): Promise<void> {
    if (this.cart.size === 0) {
      // Add something to cart first
      await this.addToCart(parentSpan);
    }

    const totalAmount = Array.from(this.cart.entries()).reduce((total, [productId, quantity]) => {
      const product = this.products.find(p => p.id === productId);
      return total + (product?.price || 0) * quantity;
    }, 0);

    const orderId = `virtual-order-${this.userId}-${Date.now()}`;
    const itemCount = Array.from(this.cart.values()).reduce((a, b) => a + b, 0);

    // Start checkout span
    const checkoutSpan = this.sessionTracker.startCheckout(orderId, totalAmount, itemCount);

    try {
      // Simulate checkout steps
      await this.simulatePaymentProcess(checkoutSpan);
      
      checkoutSpan.setStatus({ code: SpanStatusCode.OK });
      this.cart.clear();
    } catch (error) {
      checkoutSpan.recordException(error as Error);
      checkoutSpan.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      checkoutSpan.end();
    }
  }

  private async simulatePaymentProcess(checkoutSpan: Span): Promise<void> {
    const ctx = trace.setSpan(context.active(), checkoutSpan);

    // Payment initiation
    checkoutSpan.addEvent('payment_initiated', {
      'payment.method': 'credit_card',
      'payment.card_type': 'visa'
    });

    // Simulate payment validation
    await this.sleep(1000 + Math.random() * 1000);
    
    // Payment processing
    checkoutSpan.addEvent('payment_processing');
    await this.sleep(1500 + Math.random() * 1500);

    // Simulate payment success/failure (90% success rate)
    const success = Math.random() > 0.1;
    
    if (success) {
      checkoutSpan.addEvent('payment_success');
      await this.fetchWithTracing('/api/orders', 'POST', ctx);
    } else {
      checkoutSpan.addEvent('payment_failed', {
        'error.code': 'payment_declined',
        'error.message': 'Card declined'
      });
      throw new Error('Payment failed');
    }
  }

  private async viewProductDetails(parentSpan: Span): Promise<void> {
    const product = this.products[Math.floor(Math.random() * this.products.length)];
    
    parentSpan.addEvent('product_details_viewed', {
      'product.id': product.id,
      'product.name': product.name
    });

    const ctx = trace.setSpan(context.active(), parentSpan);
    await this.fetchWithTracing(`/api/products/${product.id}`, 'GET', ctx);
  }

  private async makeReservation(parentSpan: Span): Promise<void> {
    parentSpan.addEvent('reservation_started');
    
    // Simulate reservation form filling
    await this.sleep(2000 + Math.random() * 3000);
    
    const ctx = trace.setSpan(context.active(), parentSpan);
    
    try {
      await this.fetchWithTracing('/api/reservations', 'POST', ctx);
      parentSpan.addEvent('reservation_completed');
    } catch (error) {
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
      // Simulate network delay
      await this.sleep(100 + Math.random() * 300);
      
      // Simulate response (90% success rate for API calls)
      const success = Math.random() > 0.1;
      const statusCode = success ? 200 : 500;
      
      fetchSpan.setAttributes({
        'http.status_code': statusCode,
        'http.response_content_length': 1000 + Math.random() * 5000
      });

      if (!success) {
        throw new Error(`HTTP ${statusCode}: Server Error`);
      }

      return { status: statusCode, data: {} };
    } catch (error) {
      fetchSpan.recordException(error as Error);
      fetchSpan.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      fetchSpan.end();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
}