import { trace, context, SpanStatusCode, Span, Context } from '@opentelemetry/api';
import { UserJourney, JourneyStep, getThinkTime, shouldExecuteStep } from './userJourneys';
import { SessionTracker } from './sessionTracker';
import PerformanceLogger from '@/lib/performanceLogger';
import { DataStore } from '@/stores/dataStore';
import { generateCustomerProfile, generateSpecialRequest, formatCreditCardNumber, generateOrderType, generatePartySize, type CustomerProfile } from '@/lib/utils/fakeDataGenerator';

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

  constructor(userId: string, journey: UserJourney, trafficManager?: any) {
    this.userId = userId;
    this.journey = journey;
    this.trafficManager = trafficManager;
    this.sessionTracker = SessionTracker.createStandaloneSession(userId, journey.name);
    this.performanceLogger = PerformanceLogger.getInstance();
    
    // Generate realistic customer profile for this virtual user
    this.customerProfile = generateCustomerProfile();
    
    // Initialize with sample products for cart operations
    this.initializeProducts();
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
      console.log(`🎭 ${this.customerProfile.fullName} starting journey: ${this.journey.name}`);
      this.updateActivity(`starting_${this.journey.name.toLowerCase().replace(/\s+/g, '_')}`);
      
      for (let i = 0; i < this.journey.steps.length && !this.aborted; i++) {
        const step = this.journey.steps[i];
        this.currentStep = i;
        
        if (!shouldExecuteStep(step)) {
          console.log(`⏭️ ${this.customerProfile.fullName} skipping step ${i}: ${step.action}`);
          continue;
        }

        console.log(`🔄 ${this.customerProfile.fullName} executing step ${i}: ${step.action}`);
        this.updateActivity(this.getActivityForStep(step), i, this.journey.steps.length);
        await this.executeStep(step, i);
        
        // Simulate think time between actions
        const thinkTime = getThinkTime(step);
        console.log(`🤔 ${this.customerProfile.fullName} thinking for ${thinkTime}ms`);
        this.updateActivity(`thinking_after_${step.action}`, i, this.journey.steps.length);
        await this.sleep(thinkTime);
      }

      console.log(`✅ ${this.customerProfile.fullName} completed journey: ${this.journey.name}`);
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
    // Simulate clicking on product grid or menu section first
    this.simulateClick('div.no-id.grid.md.grid.cols.2.lg.grid.cols.3.gap.6', 'Product Grid');
    await this.sleep(300 + Math.random() * 200);
    
    // Log user interaction for browsing
    this.performanceLogger.logUserInteraction('browse', 'product-catalog', 0);
    
    // Simulate browsing behavior - browse 2-5 products
    const browseCount = Math.floor(Math.random() * 4) + 2;
    
    for (let i = 0; i < browseCount; i++) {
      const product = this.products[Math.floor(Math.random() * this.products.length)];
      
      // Simulate clicking on product card (matches Card component from Menu.tsx)
      const productCardSelector = `div.no-id.overflow.hidden.hover.shadow.warm.transition.all.duration.300`;
      this.simulateClick(productCardSelector, product.name);
      await this.sleep(200 + Math.random() * 150);
      
      // Log user interaction for each product view
      this.performanceLogger.logUserInteraction('view', `product-${product.id}`, 0);
      
      // Simulate hovering over price or other elements
      if (Math.random() > 0.5) {
        this.performanceLogger.logUserInteraction('hover', `span.no-id.text.2xl.font.bold.text.primary`, 0);
        await this.sleep(400 + Math.random() * 300);
      }
      
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
    
    // Simulate clicking and filling payment form fields (realistic form structure)
    this.simulateClick('input.no-id.flex.h.10.w.full.rounded.md.border', 'Card Number Field');
    await this.sleep(200 + Math.random() * 100);
    this.performanceLogger.logUserInteraction('input', 'input.no-id.flex.h.10.w.full.rounded.md.border', 500);
    
    await this.sleep(800 + Math.random() * 400);
    this.simulateClick('input.no-id.flex.h.10.w.full.rounded.md.border', 'Expiry Date Field');
    await this.sleep(200 + Math.random() * 100);
    this.performanceLogger.logUserInteraction('input', 'input#expiry-date', 300);
    
    await this.sleep(600 + Math.random() * 300);
    this.simulateClick('input.no-id.flex.h.10.w.full.rounded.md.border', 'CVV Field');
    await this.sleep(200 + Math.random() * 100);
    this.performanceLogger.logUserInteraction('input', 'input#cvv', 200);
    
    await this.sleep(700 + Math.random() * 400);
    this.simulateClick('input.no-id.flex.h.10.w.full.rounded.md.border', 'Cardholder Name Field');
    await this.sleep(200 + Math.random() * 100);
    this.performanceLogger.logUserInteraction('input', 'input.no-id.flex.h.10.w.full.rounded.md.border', 800);
    
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
      
      console.log(`💰 User ${this.customerProfile.fullName} payment successful, posting order to /api/orders`);
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
      
      console.log(`💸 ${this.customerProfile.fullName} payment failed - card declined`);
      
      // Don't throw error - just log the failure and continue
      // This prevents 404 errors from propagating up
      this.updateActivity('retrying_payment');
      
      // Simulate user deciding not to retry
      await this.sleep(2000 + Math.random() * 2000);
      this.updateActivity('checkout_abandoned');
      
      // Return false to indicate payment failed
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
      console.log(`🌐 ${this.customerProfile.fullName} making ${method} request to ${url}`, requestBody ? { body: requestBody } : '');
      
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
      
      console.log(`📡 ${this.customerProfile.fullName} received ${statusCode} response from ${url} (${responseText.length} bytes)`);
      
      fetchSpan.setAttributes({
        'http.status_code': statusCode,
        'http.response_content_length': responseText.length
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
    
    // Simulate a realistic click event matching real user format exactly
    this.performanceLogger.logUserInteraction('click', realUserFormat, 0);
    console.log(`🖱️ ${this.customerProfile.fullName} clicked: ${realUserFormat}${elementText ? ` (${elementText})` : ''}`);
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
}