import PerformanceLogger from '../virtualTraffic/performanceLogger.js';
import { generateCustomerProfile, generateOrderType, addTimingJitter } from '../virtualTraffic/fakeDataGenerator.js';
import fetch from 'node-fetch';

/**
 * Cart Checkout Simulator - Server-Side Implementation
 * Generates identical logs to virtual user cart and checkout activities
 */
class CartCheckoutSimulator {
  constructor() {
    this.performanceLogger = new PerformanceLogger();
    this.isRunning = false;
    this.sessionId = null;
    this.startTime = 0;
    this.stats = {
      ordersCreated: 0,
      ordersSuccessful: 0,
      ordersFailed: 0,
      currentOrder: '',
      timeRemaining: 0
    };
    this.config = {
      orderCount: 10,
      delayBetweenOrders: 2000, // 2 seconds
      orderType: 'random' // 'random', 'takeout', 'delivery'
    };
    this.intervalRef = null;
    this.products = [];
  }

  async initialize() {
    // Fetch available products like virtual users do
    try {
      const response = await fetch('http://localhost:3001/api/products');
      if (response.ok) {
        const data = await response.json();
        this.products = data.filter(p => p.available);
        console.log(`🛍️ Cart Simulator initialized with ${this.products.length} available products`);
      }
    } catch (error) {
      console.error('Cart Simulator: Failed to fetch products:', error);
      // Use default products if API fails
      this.products = [
        { id: '1', name: 'Margherita Pizza', price: 18.99, category: 'pizza', available: true },
        { id: '2', name: 'Caesar Salad', price: 12.99, category: 'salad', available: true },
        { id: '3', name: 'Chocolate Cake', price: 8.99, category: 'dessert', available: true }
      ];
    }
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log(`🔧 Cart Simulator config updated: ${JSON.stringify(this.config)}`);
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Cart Simulator already running');
      return;
    }

    await this.initialize();

    this.isRunning = true;
    this.sessionId = `cart-sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.startTime = Date.now();
    this.stats = {
      ordersCreated: 0,
      ordersSuccessful: 0,
      ordersFailed: 0,
      currentOrder: '',
      timeRemaining: this.config.orderCount * (this.config.delayBetweenOrders / 1000)
    };

    console.log(`🚀 Cart Checkout Simulator started: ${this.config.orderCount} orders with ${this.config.delayBetweenOrders / 1000}s delay`);

    // Start the simulation loop
    this.simulationLoop();
  }

  async simulationLoop() {
    if (!this.isRunning || this.stats.ordersCreated >= this.config.orderCount) {
      this.stop();
      return;
    }

    try {
      // Generate customer profile identical to virtual users
      const customerProfile = generateCustomerProfile();
      
      // Log customer profile creation (same as virtual users)
      this.performanceLogger.logSensitiveCustomerData(customerProfile, 'cart_simulator_profile_created');
      
      this.stats.currentOrder = `${customerProfile.fullName}`;
      
      // Simulate cart actions
      const cart = await this.simulateCartActions(customerProfile);
      
      // Simulate checkout process
      const checkoutResult = await this.simulateCheckoutProcess(cart, customerProfile);
      
      this.stats.ordersCreated++;
      if (checkoutResult.success) {
        this.stats.ordersSuccessful++;
      } else {
        this.stats.ordersFailed++;
      }

      // Update time remaining
      const elapsed = (Date.now() - this.startTime) / 1000;
      const remaining = Math.max(this.config.orderCount - this.stats.ordersCreated, 0);
      this.stats.timeRemaining = remaining * (this.config.delayBetweenOrders / 1000);

      // Schedule next order
      if (this.isRunning && this.stats.ordersCreated < this.config.orderCount) {
        this.intervalRef = setTimeout(() => {
          this.simulationLoop();
        }, this.config.delayBetweenOrders);
      }

    } catch (error) {
      console.error(`❌ Cart Simulator error: ${error.message}`);
      this.stats.ordersFailed++;
      
      // Continue simulation despite errors
      if (this.isRunning && this.stats.ordersCreated < this.config.orderCount) {
        this.intervalRef = setTimeout(() => {
          this.simulationLoop();
        }, this.config.delayBetweenOrders);
      }
    }
  }

  async simulateCartActions(customerProfile) {
    const cart = new Map();
    
    // Select 1-4 random products (like virtual users)
    const itemCount = Math.floor(Math.random() * 4) + 1;
    const selectedProducts = this.selectRandomProducts(itemCount);
    
    for (const { product, quantity } of selectedProducts) {
      const quantityBefore = cart.get(product.id) || 0;
      const quantityAfter = quantityBefore + quantity;
      cart.set(product.id, quantityAfter);
      
      const cartTotal = this.calculateCartTotal(cart);
      
      // IDENTICAL cart action logging to virtual users
      this.performanceLogger.logCartAction(
        'ADD',
        { 
          id: product.id, 
          name: product.name, 
          price: product.price, 
          category: product.category 
        },
        quantityBefore,
        quantityAfter,
        cartTotal,
        0
      );
      
      const totalItems = Array.from(cart.values()).reduce((a, b) => a + b, 0);
      console.log(`🛒 Cart Simulator added ${quantity}x ${product.name} to cart (${totalItems} total items)`);
      
      // Small delay between cart actions
      await this.sleep(addTimingJitter(500, 0.3));
    }
    
    return cart;
  }

  async simulateCheckoutProcess(cart, customerProfile) {
    const orderId = `simulator-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const totalAmount = this.calculateCartTotal(cart);
    const itemCount = Array.from(cart.values()).reduce((a, b) => a + b, 0);
    
    console.log(`💳 Cart Simulator starting checkout - ${itemCount} items, $${totalAmount.toFixed(2)}`);
    
    // IDENTICAL payment data structure to virtual users
    const paymentData = {
      cardNumber: customerProfile.creditCard.number,
      expiryDate: `${customerProfile.creditCard.expiryMonth}/${customerProfile.creditCard.expiryYear}`,
      cvv: customerProfile.creditCard.cvv,
      cardHolderName: customerProfile.creditCard.holderName
    };
    
    const customerData = {
      name: customerProfile.fullName,
      email: customerProfile.email,
      phone: customerProfile.phone
    };
    
    const transactionData = {
      orderId,
      amount: totalAmount,
      currency: 'USD',
      orderType: this.getOrderType()
    };
    
    try {
      // IDENTICAL payment logging sequence as virtual users
      
      // 1. Payment Initiated
      this.performanceLogger.logPaymentAttempt(
        paymentData, customerData, transactionData, 'initiated', 0
      );
      
      await this.sleep(addTimingJitter(1000, 0.3));
      
      // 2. Payment Processing  
      this.performanceLogger.logPaymentAttempt(
        paymentData, customerData, transactionData, 'processing', 1500
      );
      
      await this.sleep(addTimingJitter(3000, 0.5));
      
      // 3. Payment Result (90% success rate like virtual users)
      const paymentSucceeded = Math.random() > 0.1;
      
      if (paymentSucceeded) {
        this.performanceLogger.logPaymentAttempt(
          paymentData, customerData, transactionData, 'successful', 4200
        );
        
        console.log(`💰 Cart Simulator payment successful, posting order to /api/orders`);
        
        // IDENTICAL order creation like virtual users
        const orderResponse = await this.createOrder(orderId, cart, customerProfile);
        
        if (orderResponse.success) {
          // IDENTICAL order logging as virtual users
          this.performanceLogger.logDataOperation(
            'CREATE',
            'order', 
            orderId,
            {
              items: Array.from(cart.entries()).map(([productId, quantity]) => ({
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
          
          console.log(`📦 Cart Simulator order successfully posted to API`);
          return { success: true, orderId };
        } else {
          throw new Error('Failed to create order via API');
        }
      } else {
        this.performanceLogger.logPaymentAttempt(
          paymentData, customerData, transactionData, 'failed', 4200
        );
        
        console.log(`💸 Cart Simulator payment failed - card declined`);
        return { success: false, reason: 'payment_failed' };
      }
    } catch (error) {
      console.log(`❌ Cart Simulator checkout failed - ${error.message}`);
      
      this.performanceLogger.logPaymentAttempt(
        paymentData, customerData, transactionData, 'failed', 4200
      );
      
      return { success: false, reason: 'error', error: error.message };
    }
  }

  async createOrder(orderId, cart, customerProfile) {
    try {
      const orderData = {
        id: orderId,
        items: Array.from(cart.entries()).map(([productId, quantity]) => ({
          productId,
          quantity,
          price: this.products.find(p => p.id === productId)?.price || 0
        })),
        customerName: customerProfile.fullName,
        customerEmail: customerProfile.email,
        customerPhone: customerProfile.phone,
        type: this.getOrderType(),
        totalAmount: this.calculateCartTotal(cart),
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      const response = await fetch('http://localhost:3001/api/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Simulator-Source': 'cart-checkout-simulator'
        },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        return { success: true, orderId };
      } else {
        throw new Error(`API Error: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ Cart Simulator: Failed to post order to API:`, error.message);
      return { success: false, error: error.message };
    }
  }

  selectRandomProducts(count) {
    const selectedProducts = [];
    const availableProducts = [...this.products];
    
    for (let i = 0; i < count && availableProducts.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * availableProducts.length);
      const product = availableProducts.splice(randomIndex, 1)[0];
      const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 items
      
      selectedProducts.push({ product, quantity });
    }
    
    return selectedProducts;
  }

  calculateCartTotal(cart) {
    return Array.from(cart.entries()).reduce((total, [productId, quantity]) => {
      const product = this.products.find(p => p.id === productId);
      return total + (product?.price || 0) * quantity;
    }, 0);
  }

  getOrderType() {
    if (this.config.orderType === 'random') {
      return generateOrderType();
    }
    return this.config.orderType;
  }

  stop() {
    if (this.intervalRef) {
      clearTimeout(this.intervalRef);
      this.intervalRef = null;
    }
    
    this.isRunning = false;
    
    const duration = (Date.now() - this.startTime) / 1000;
    const successRate = this.stats.ordersCreated > 0 
      ? ((this.stats.ordersSuccessful / this.stats.ordersCreated) * 100).toFixed(1) 
      : '0';
    
    console.log(`✅ Cart Checkout Simulator completed: ${this.stats.ordersCreated} orders in ${Math.round(duration)}s (${successRate}% success rate)`);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      sessionId: this.sessionId,
      config: this.config,
      stats: this.stats,
      duration: this.isRunning ? (Date.now() - this.startTime) / 1000 : 0
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default CartCheckoutSimulator;