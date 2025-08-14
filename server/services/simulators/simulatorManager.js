import CartCheckoutSimulator from './cartCheckoutSimulator.js';
import StressTestSimulator from './stressTestSimulator.js';

/**
 * Simulator Manager - Centralized control for all simulators
 * Similar to traffic manager but for checkout and stress test simulators
 */
class SimulatorManager {
  constructor() {
    this.cartCheckoutSimulator = new CartCheckoutSimulator();
    this.stressTestSimulator = new StressTestSimulator();
    this.isInitialized = false;
  }

  static getInstance() {
    if (!SimulatorManager.instance) {
      SimulatorManager.instance = new SimulatorManager();
    }
    return SimulatorManager.instance;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🔧 Initializing Simulator Manager');
    
    // Initialize both simulators
    await this.cartCheckoutSimulator.initialize();
    
    this.isInitialized = true;
    console.log('✅ Simulator Manager initialized');
  }

  // Cart Checkout Simulator Methods
  async startCartCheckoutSimulator(config = {}) {
    if (!this.isInitialized) await this.initialize();
    
    if (config && Object.keys(config).length > 0) {
      this.cartCheckoutSimulator.updateConfig(config);
    }
    
    return await this.cartCheckoutSimulator.start();
  }

  stopCartCheckoutSimulator() {
    return this.cartCheckoutSimulator.stop();
  }

  getCartCheckoutStatus() {
    return this.cartCheckoutSimulator.getStatus();
  }

  updateCartCheckoutConfig(config) {
    return this.cartCheckoutSimulator.updateConfig(config);
  }

  // Stress Test Simulator Methods
  async startStressTestSimulator(config = {}) {
    if (!this.isInitialized) await this.initialize();
    
    if (config && Object.keys(config).length > 0) {
      this.stressTestSimulator.updateConfig(config);
    }
    
    return await this.stressTestSimulator.start();
  }

  stopStressTestSimulator() {
    return this.stressTestSimulator.stop();
  }

  getStressTestStatus() {
    return this.stressTestSimulator.getStatus();
  }

  getStressTestDetailedStats() {
    return this.stressTestSimulator.getDetailedStats();
  }

  updateStressTestConfig(config) {
    return this.stressTestSimulator.updateConfig(config);
  }

  // Combined Status and Control Methods
  getAllSimulatorStatus() {
    return {
      cartCheckout: this.getCartCheckoutStatus(),
      stressTest: this.getStressTestStatus(),
      managerInitialized: this.isInitialized
    };
  }

  stopAllSimulators() {
    console.log('🛑 Stopping all simulators');
    
    this.stopCartCheckoutSimulator();
    this.stopStressTestSimulator();
    
    console.log('✅ All simulators stopped');
  }

  getActiveSimulators() {
    const active = [];
    
    if (this.cartCheckoutSimulator.getStatus().isRunning) {
      active.push({
        type: 'cart-checkout',
        sessionId: this.cartCheckoutSimulator.getStatus().sessionId,
        stats: this.cartCheckoutSimulator.getStatus().stats
      });
    }
    
    if (this.stressTestSimulator.getStatus().isRunning) {
      active.push({
        type: 'stress-test',
        sessionId: this.stressTestSimulator.getStatus().sessionId,
        stats: this.stressTestSimulator.getStatus().stats
      });
    }
    
    return {
      activeCount: active.length,
      simulators: active
    };
  }

  isAnySimulatorRunning() {
    return this.cartCheckoutSimulator.getStatus().isRunning || 
           this.stressTestSimulator.getStatus().isRunning;
  }

  getSystemStats() {
    const cartStatus = this.getCartCheckoutStatus();
    const stressStatus = this.getStressTestStatus();
    
    return {
      simulatorManager: {
        initialized: this.isInitialized,
        activeSimulators: this.getActiveSimulators().activeCount
      },
      cartCheckout: {
        isRunning: cartStatus.isRunning,
        ordersCreated: cartStatus.stats?.ordersCreated || 0,
        successRate: cartStatus.stats?.ordersCreated > 0 
          ? ((cartStatus.stats.ordersSuccessful / cartStatus.stats.ordersCreated) * 100).toFixed(1)
          : '0'
      },
      stressTest: {
        isRunning: stressStatus.isRunning,
        totalRequests: stressStatus.stats?.totalRequests || 0,
        successRate: stressStatus.stats?.totalRequests > 0
          ? ((stressStatus.stats.successCount / stressStatus.stats.totalRequests) * 100).toFixed(1)
          : '0',
        avgResponseTime: stressStatus.stats?.avgResponseTime || 0
      }
    };
  }

  // Health check method
  async healthCheck() {
    const status = this.getAllSimulatorStatus();
    
    return {
      healthy: true,
      initialized: this.isInitialized,
      simulators: {
        cartCheckout: {
          available: true,
          running: status.cartCheckout.isRunning
        },
        stressTest: {
          available: true,
          running: status.stressTest.isRunning
        }
      },
      timestamp: new Date().toISOString()
    };
  }
}

export default SimulatorManager;