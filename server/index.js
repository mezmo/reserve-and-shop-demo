import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { execSync, spawn } from 'child_process';
import os from 'os';
import yaml from 'js-yaml';
import { loggingMiddleware, errorLoggingMiddleware, logBusinessEvent, logPerformanceTiming } from './middleware/logging-middleware.js';
import { updateLogFormat, getLogFormats } from './logging/winston-config.js';
import { appLogger, serverLogger, updateLogLevel, getLogLevels } from './logging/winston-config.js';
import { startFailure, stopFailure, getFailureStatus, isFailureActive } from './services/failureSimulator.js';
import { initializeOTEL } from './telemetry-simple.js';
// Import TrafficManager using dynamic import since it uses CommonJS
let TrafficManager = null;

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Structured logging middleware (replaces basic console logging)
app.use(loggingMiddleware);

// Memory pressure delay middleware (for failure simulation)
app.use((req, res, next) => {
  if (global.memoryPressureDelay && global.memoryPressureDelay > 0) {
    setTimeout(() => {
      next();
    }, global.memoryPressureDelay);
  } else {
    next();
  }
});

// Order counter for sequential order numbers
let orderCounter = 1;

// Function to generate sequential order numbers
const generateOrderNumber = () => {
  const orderNumber = orderCounter.toString().padStart(7, '0');
  orderCounter++;
  return orderNumber;
};

// Initialize order counter based on existing orders
const initializeOrderCounter = () => {
  if (data.orders && data.orders.length > 0) {
    // Find the highest existing order number and set counter to next value
    const maxOrderNumber = Math.max(...data.orders
      .map(order => parseInt(order.id))
      .filter(num => !isNaN(num))
    );
    orderCounter = maxOrderNumber + 1;
  }
};

// In-memory data store (simulating a database)
let data = {
  products: [
    {
      id: '1',
      name: 'Margherita Pizza',
      description: 'Fresh tomato sauce, mozzarella, and basil',
      price: 18.99,
      category: 'Pizza',
      image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400&h=300&fit=crop&crop=center',
      available: true
    },
    {
      id: '2',
      name: 'Caesar Salad',
      description: 'Crisp romaine lettuce with parmesan and croutons',
      price: 14.99,
      category: 'Salads',
      image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop&crop=center',
      available: true
    },
    {
      id: '3',
      name: 'Grilled Salmon',
      description: 'Atlantic salmon with lemon herb seasoning',
      price: 28.99,
      category: 'Main Course',
      image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop&crop=center',
      available: true
    },
    {
      id: '4',
      name: 'Chocolate Brownie',
      description: 'Warm chocolate brownie with vanilla ice cream',
      price: 8.99,
      category: 'Desserts',
      image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&h=300&fit=crop&crop=center',
      available: true
    }
  ],
  reservations: [],
  orders: [],
  settings: {
    restaurantName: 'Bella Vista Restaurant',
    contactEmail: 'info@bellavista.com',
    contactPhone: '+1 (555) 123-4567'
  }
};

// API Routes

// Products
app.get('/api/products', (req, res) => {
  // Check for system failure or service-specific failures
  if (global.systemFailure || global.productServiceDown) {
    appLogger.error('Product service request failed - service unavailable', {
      requestId: req.requestId,
      service: 'products',
      failureType: global.systemFailure ? 'system_failure' : 'service_failure',
      endpoint: '/api/products'
    });
    
    return res.status(503).json({ 
      error: 'Product service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE',
      service: 'products'
    });
  }
  
  // Check for service degradation
  if (global.productServiceDegraded) {
    appLogger.warn('Product service degraded - slow response', {
      requestId: req.requestId,
      service: 'products',
      responseDelay: 5000,
      endpoint: '/api/products'
    });
    
    // Return response with delay
    setTimeout(() => {
      res.json(data.products);
    }, 5000);
    return;
  }
  
  res.json(data.products);
});

app.get('/api/products/:id', (req, res) => {
  const product = data.products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

app.post('/api/products', (req, res) => {
  const startTime = Date.now();
  const product = {
    id: Date.now().toString(),
    ...req.body
  };
  data.products.push(product);
  
  // Log business event
  logBusinessEvent('product_created', 'create', {
    productId: product.id,
    category: product.category,
    price: product.price
  }, req);
  
  const duration = Date.now() - startTime;
  logPerformanceTiming('product_creation', duration, 'products', { productId: product.id }, req);
  
  res.status(201).json(product);
});

app.put('/api/products/:id', (req, res) => {
  const index = data.products.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }
  data.products[index] = { ...data.products[index], ...req.body };
  res.json(data.products[index]);
});

// Orders
app.get('/api/orders', (req, res) => {
  res.json(data.orders);
});

app.get('/api/orders/:id', (req, res) => {
  const order = data.orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

app.post('/api/orders', async (req, res) => {
  const startTime = Date.now();
  
  // Check for system-wide failures first
  if (global.systemFailure || global.orderServiceDown) {
    appLogger.error('Order service request failed - service unavailable', {
      requestId: req.requestId,
      service: 'orders',
      failureType: global.systemFailure ? 'system_failure' : 'service_failure',
      endpoint: '/api/orders'
    });
    
    return res.status(503).json({
      error: 'Order service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE',
      service: 'orders'
    });
  }
  
  // Check for database connection pool exhaustion
  if (isFailureActive('db_pool')) {
    appLogger.error('Order creation failed - database connection pool exhausted', {
      requestId: req.requestId,
      poolSize: 3,
      activeConnections: 3,
      queueLength: Math.floor(Math.random() * 20) + 10,
      waitTime: 30000,
      errorCode: 'DB_POOL_EXHAUSTED'
    });
    
    // Simulate waiting for connection (5 second timeout)
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return res.status(503).json({
      error: 'Service temporarily unavailable - database connection timeout',
      code: 'DB_POOL_EXHAUSTED',
      details: 'Database connection pool is exhausted, please try again later'
    });
  }
  
  // Validate required fields
  const { customerName, customerEmail, items } = req.body;
  if (!customerName || !customerEmail || !items || items.length === 0) {
    appLogger.warn('Order validation failed', {
      requestId: req.requestId,
      missingFields: { customerName: !customerName, customerEmail: !customerEmail, items: !items || items.length === 0 },
      ip: req.ip
    });
    return res.status(400).json({ 
      error: 'Missing required fields: customerName, customerEmail, and items are required' 
    });
  }

  // Check for data corruption in products
  for (const item of items) {
    const product = data.products.find(p => p.id === item.productId);
    if (product) {
      if (typeof product.price !== 'number' || product.price < 0 || !product.name) {
        appLogger.error('Order creation failed - corrupted product data', {
          requestId: req.requestId,
          productId: product.id,
          corruptedFields: {
            price: typeof product.price !== 'number' ? 'invalid_type' : product.price < 0 ? 'negative' : 'valid',
            name: !product.name ? 'missing' : 'valid'
          },
          validationError: 'CORRUPTED_PRODUCT_DATA'
        });
        
        return res.status(422).json({
          error: 'Data integrity error - corrupted product information',
          code: 'CORRUPTED_PRODUCT_DATA',
          productId: product.id,
          details: `Product data is corrupted: price=${product.price}, name="${product.name}"`
        });
      }
    }
  }

  const order = {
    id: generateOrderNumber(),
    ...req.body,
    createdAt: new Date().toISOString(),
    status: 'payment_pending'
  };
  
  // Calculate order total for business metrics
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Ensure totalAmount is set correctly (use calculated total or fallback to req.body.total)
  order.totalAmount = total;
  
  // Save order immediately in payment_pending status
  data.orders.push(order);
  
  // Return order ID immediately, then process payment asynchronously
  res.json({ 
    orderId: order.id, 
    status: 'payment_pending',
    message: 'Order created, processing payment...' 
  });
  
  // Process payment asynchronously to allow orders to be visible in payment_pending state
  setTimeout(async () => {
    try {
      // Add realistic payment processing delay (2-5 seconds)
      const paymentDelay = 2000 + Math.random() * 3000;
      await new Promise(resolve => setTimeout(resolve, paymentDelay));
      
      // Random payment failures for realistic demo (10% failure rate)
      const shouldFailPayment = Math.random() < 0.1;
      
      // Check for payment gateway failure (either simulated failure or random failure)
      if (isFailureActive('payment') || shouldFailPayment) {
        const paymentStartTime = Date.now();
        
        // Simulate payment attempt with timeout
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Log payment failure
        logBusinessEvent('payment_failed', 'error', {
          orderId: order.id,
          amount: total,
          errorCode: shouldFailPayment ? 'RANDOM_PAYMENT_FAILURE' : 'GATEWAY_TIMEOUT',
          gatewayResponse: null,
          attemptDuration: Date.now() - paymentStartTime
        }, req);
        
        appLogger.error('Payment processing failed', {
          requestId: req.requestId,
          orderId: order.id,
          error: shouldFailPayment ? 'Random payment failure for demo' : 'Connection timeout',
          gateway: 'stripe',
          customerId: customerEmail,
          amount: total,
          currency: 'USD'
        });
        
        // Update order to failed payment state
        order.status = 'payment_failed';
        order.paymentError = shouldFailPayment ? 'Payment declined' : 'Payment gateway timeout';
        order.paymentErrorCode = shouldFailPayment ? 'CARD_DECLINED' : 'GATEWAY_TIMEOUT';
        
        console.log(`💳❌ Payment failed for order ${order.id} - ${order.paymentError}`);
      } else {
        // Payment successful
        order.status = 'confirmed';
        
        // Log successful business event
        logBusinessEvent('order_created', 'create', {
          orderId: order.id,
          customerEmail: customerEmail,
          totalAmount: total,
          itemCount: items.length,
          orderType: order.orderType || 'takeout'
        }, req);
        
        console.log(`💳✅ Payment confirmed for order ${order.id} - $${total}`);
      }
    } catch (error) {
      console.error(`💳⚠️ Error processing payment for order ${order.id}:`, error);
      order.status = 'payment_failed';
      order.paymentError = 'Payment processing error';
      order.paymentErrorCode = 'PROCESSING_ERROR';
    }
  }, 100); // Small delay to ensure order is saved first
  
  // Log initial order creation event (payment processing will be logged separately)
  const duration = Date.now() - startTime;
  logPerformanceTiming('order_creation', duration, 'orders', { orderId: order.id, itemCount: items.length }, req);
});

app.put('/api/orders/:id', (req, res) => {
  const index = data.orders.findIndex(o => o.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }
  data.orders[index] = { ...data.orders[index], ...req.body };
  res.json(data.orders[index]);
});

// Reservations
app.get('/api/reservations', (req, res) => {
  res.json(data.reservations);
});

app.get('/api/reservations/:id', (req, res) => {
  const reservation = data.reservations.find(r => r.id === req.params.id);
  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }
  res.json(reservation);
});

app.post('/api/reservations', async (req, res) => {
  const startTime = Date.now();
  
  // Check for system-wide failures first
  if (global.systemFailure || global.reservationServiceDown) {
    appLogger.error('Reservation service request failed - service unavailable', {
      requestId: req.requestId,
      service: 'reservations',
      failureType: global.systemFailure ? 'system_failure' : 'service_failure',
      endpoint: '/api/reservations'
    });
    
    return res.status(503).json({
      error: 'Reservation service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE',
      service: 'reservations'
    });
  }
  
  // Check for database connection pool exhaustion
  if (isFailureActive('db_pool')) {
    appLogger.error('Reservation creation failed - database connection pool exhausted', {
      requestId: req.requestId,
      poolSize: 3,
      activeConnections: 3,
      queueLength: Math.floor(Math.random() * 15) + 8,
      waitTime: 30000,
      errorCode: 'DB_POOL_EXHAUSTED'
    });
    
    // Simulate waiting for connection (4 second timeout)
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    return res.status(503).json({
      error: 'Service temporarily unavailable - database connection timeout',
      code: 'DB_POOL_EXHAUSTED',
      details: 'Unable to process reservation - database connection pool exhausted'
    });
  }
  
  // Validate required fields
  const { name, email, date, time, guests } = req.body;
  if (!name || !email || !date || !time || !guests) {
    appLogger.warn('Reservation validation failed', {
      requestId: req.requestId,
      missingFields: { name: !name, email: !email, date: !date, time: !time, guests: !guests },
      ip: req.ip
    });
    return res.status(400).json({ 
      error: 'Missing required fields: name, email, date, time, and guests are required' 
    });
  }

  const reservation = {
    id: `reservation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...req.body,
    createdAt: new Date().toISOString(),
    status: 'confirmed'
  };
  
  data.reservations.push(reservation);
  
  // Log business event
  logBusinessEvent('reservation_created', 'create', {
    reservationId: reservation.id,
    customerEmail: email,
    guests: guests,
    date: date,
    time: time
  }, req);
  
  const duration = Date.now() - startTime;
  logPerformanceTiming('reservation_processing', duration, 'reservations', { 
    reservationId: reservation.id, 
    guests: guests 
  }, req);
  
  res.status(201).json(reservation);
});

app.put('/api/reservations/:id', (req, res) => {
  const index = data.reservations.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Reservation not found' });
  }
  data.reservations[index] = { ...data.reservations[index], ...req.body };
  res.json(data.reservations[index]);
});

// Settings
app.get('/api/settings', (req, res) => {
  res.json(data.settings);
});

app.put('/api/settings', (req, res) => {
  data.settings = { ...data.settings, ...req.body };
  res.json(data.settings);
});

// DELETE endpoints for complete CRUD operations
app.delete('/api/products/:id', (req, res) => {
  const index = data.products.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  const deletedProduct = data.products.splice(index, 1)[0];
  
  appLogger.info('Product deleted', {
    requestId: req.requestId,
    productId: req.params.id,
    productName: deletedProduct.name
  });
  
  res.json({ 
    success: true, 
    message: 'Product deleted successfully',
    product: deletedProduct 
  });
});

app.delete('/api/orders/:id', (req, res) => {
  const index = data.orders.findIndex(o => o.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  const deletedOrder = data.orders.splice(index, 1)[0];
  
  appLogger.info('Order deleted', {
    requestId: req.requestId,
    orderId: req.params.id,
    orderTotal: deletedOrder.total
  });
  
  res.json({ 
    success: true, 
    message: 'Order deleted successfully',
    order: deletedOrder 
  });
});

app.delete('/api/reservations/:id', (req, res) => {
  const index = data.reservations.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Reservation not found' });
  }
  
  const deletedReservation = data.reservations.splice(index, 1)[0];
  
  appLogger.info('Reservation deleted', {
    requestId: req.requestId,
    reservationId: req.params.id,
    guestName: deletedReservation.name
  });
  
  res.json({ 
    success: true, 
    message: 'Reservation deleted successfully',
    reservation: deletedReservation 
  });
});

// Get all data (for DataStore compatibility)
app.get('/api/data', (req, res) => {
  res.json({
    success: true,
    data: {
      products: data.products,
      orders: data.orders,
      reservations: data.reservations,
      settings: data.settings
    },
    timestamp: new Date().toISOString()
  });
});

// Reset all data to defaults
app.post('/api/data/reset', (req, res) => {
  const originalData = {
    products: [
      {
        id: '1',
        name: 'Margherita Pizza',
        description: 'Fresh tomato sauce, mozzarella, and basil',
        price: 18.99,
        category: 'Pizza',
        image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400&h=300&fit=crop&crop=center',
        available: true
      },
      {
        id: '2',
        name: 'Caesar Salad',
        description: 'Crisp romaine lettuce with parmesan and croutons',
        price: 14.99,
        category: 'Salads',
        image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop&crop=center',
        available: true
      },
      {
        id: '3',
        name: 'Grilled Salmon',
        description: 'Atlantic salmon with lemon herb seasoning',
        price: 28.99,
        category: 'Main Course',
        image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop&crop=center',
        available: true
      },
      {
        id: '4',
        name: 'Chocolate Brownie',
        description: 'Warm chocolate brownie with vanilla ice cream',
        price: 8.99,
        category: 'Desserts',
        image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&h=300&fit=crop&crop=center',
        available: true
      }
    ],
    reservations: [],
    orders: [],
    settings: {
      restaurantName: 'Bella Vista Restaurant',
      contactEmail: 'info@bellavista.com',
      contactPhone: '+1 (555) 123-4567'
    }
  };
  
  data = { ...originalData };
  
  appLogger.info('Data reset to defaults', {
    requestId: req.requestId
  });
  
  res.json({
    success: true,
    message: 'Data reset to defaults successfully',
    data,
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// LogDNA Agent Management
app.get('/api/mezmo/status', async (req, res) => {
  try {
    // Check if agent is running
    const pidFile = '/tmp/codeuser/logdna-agent.pid';
    const configFile = '/etc/logdna/logdna.env';
    
    let status = 'disconnected';
    let pid = null;
    let hasConfig = false;
    let configValid = false;
    let health = null;
    
    // Safely check if config file exists and is valid
    try {
      if (fs.existsSync(configFile)) {
        hasConfig = true;
        
        // Validate configuration
        const envContent = fs.readFileSync(configFile, 'utf8');
        const configValidation = validateLogDNAConfig(envContent);
        configValid = configValidation.isValid;
      }
    } catch (configError) {
      console.warn('Error checking config file:', configError);
      hasConfig = false;
      configValid = false;
    }
    
    // Safely check PID file and process status with health validation
    try {
      if (fs.existsSync(pidFile)) {
        const pidContent = fs.readFileSync(pidFile, 'utf8').trim();
        pid = parseInt(pidContent);
        
        if (!isNaN(pid)) {
          try {
            // Check if PID is still running
            process.kill(pid, 0); // This throws if process doesn't exist
            status = 'connected';
            
            // Perform quick health check on running process
            try {
              const healthCheck = await checkAgentHealth(pid, 1500);
              health = {
                healthy: healthCheck.healthy,
                reason: healthCheck.reason,
                timestamp: new Date().toISOString()
              };
              
              // Update status based on health
              if (healthCheck.healthy === false) {
                status = 'error';
              } else if (healthCheck.healthy === null) {
                status = 'connecting'; // Status unclear
              }
            } catch (healthError) {
              console.warn('Health check failed:', healthError);
              health = {
                healthy: null,
                reason: 'Health check failed',
                error: healthError.message,
                timestamp: new Date().toISOString()
              };
            }
            
          } catch (killError) {
            // Process not running, clean up stale PID file
            console.log('🧹 Cleaning up stale PID file for non-running process');
            fs.unlinkSync(pidFile);
            status = 'disconnected';
            pid = null;
            health = null;
          }
        } else {
          // Invalid PID in file, clean up
          console.log('🧹 Cleaning up invalid PID file');
          fs.unlinkSync(pidFile);
          status = 'disconnected';
          pid = null;
          health = null;
        }
      }
    } catch (pidError) {
      // Error reading PID file or other error, clean up
      try {
        if (fs.existsSync(pidFile)) {
          console.log('🧹 Cleaning up PID file after error:', pidError.message);
          fs.unlinkSync(pidFile);
        }
      } catch (cleanupError) {
        console.warn('Error cleaning up PID file:', cleanupError);
      }
      status = 'disconnected';
      pid = null;
      health = null;
    }
    
    const response = {
      status,
      pid,
      hasConfig,
      configValid,
      health,
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error checking LogDNA status:', error);
    // Ensure we always send a valid JSON response
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to check LogDNA status',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
});

app.post('/api/mezmo/configure', (req, res) => {
  try {
    const { ingestionKey, host, tags, enabled } = req.body;
    
    if (!ingestionKey) {
      return res.status(400).json({ error: 'Ingestion key is required' });
    }
    
    const configDir = '/etc/logdna';
    const envFile = `${configDir}/logdna.env`;
    const yamlFile = `${configDir}/config.yaml`;
    
    // Ensure config directories exist with proper permissions
    const dbDir = '/var/lib/logdna';
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true, mode: 0o755 });
    }
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true, mode: 0o755 });
    }
    
    // Host-specific endpoint mapping
    const getHostConfig = (hostname) => {
      if (!hostname) hostname = 'logs.mezmo.com';
      
      if (hostname.includes('use.dev.logdna.net')) {
        return {
          endpoint: '/logs/ingest',
          ssl: true,
          timeout: 30000,
          type: 'development'
        };
      } else if (hostname.includes('use.int.logdna.net')) {
        return {
          endpoint: '/logs/ingest', 
          ssl: true,
          timeout: 30000,
          type: 'integration'
        };
      } else {
        return {
          endpoint: '/logs/ingest',
          ssl: true, 
          timeout: 30000,
          type: 'production'
        };
      }
    };
    
    const hostConfig = getHostConfig(host);
    console.log(`🌐 Mezmo host configuration: ${JSON.stringify({
      host: host || 'logs.mezmo.com',
      type: hostConfig.type,
      endpoint: hostConfig.endpoint
    })}`);
    
    // Create environment file with both LOGDNA_ and MZ_ prefixed variables
    const envContent = `
# LOGDNA_ prefixed variables (legacy)
LOGDNA_INGESTION_KEY=${ingestionKey}
LOGDNA_HOST=${host || 'logs.mezmo.com'}
LOGDNA_DB_PATH=/var/lib/logdna
LOGDNA_LOOKBACK=start
LOGDNA_LOG_LEVEL=info

# MZ_ prefixed variables (required by LogDNA Agent v2)
MZ_INGESTION_KEY=${ingestionKey}
MZ_HOST=${host || 'logs.mezmo.com'}
MZ_ENDPOINT=${hostConfig.endpoint}
MZ_DB_PATH=/var/lib/logdna
MZ_LOOKBACK=start
MZ_LOG_LEVEL=info
MZ_HOSTNAME=restaurant-app-container
MZ_BODY_SIZE=2097152
MZ_USE_SSL=${hostConfig.ssl ? 'true' : 'false'}
MZ_TIMEOUT=${hostConfig.timeout}
MZ_TAGS=${tags || 'restaurant-app,demo'}

# Specify log directories - CRITICAL for finding our application logs
LOGDNA_LOGDIR=/tmp/codeuser
MZ_LOGDIR=/tmp/codeuser
`.trim();
    
    // Create YAML configuration that explicitly targets our application logs
    const yamlContent = `
http:
  endpoint: ${hostConfig.endpoint}
  host: ${host || 'logs.mezmo.com'}
  timeout: ${hostConfig.timeout}
  use_ssl: ${hostConfig.ssl}
  use_compression: true
  gzip_level: 2
  body_size: 2097152
  ingestion_key: ${ingestionKey}
  params:
    hostname: restaurant-app-container
    tags: ${tags || 'restaurant-app,demo'}

log:
  dirs:
    - /tmp/codeuser/
  db_path: /var/lib/logdna
  metrics_port: 9898
  include:
    glob:
      - "*.log"
      - "/tmp/codeuser/*.log"
      - "/tmp/codeuser/server.log"
      - "/tmp/codeuser/app.log"
      - "/tmp/codeuser/access.log"
      - "/tmp/codeuser/events.log"
      - "/tmp/codeuser/metrics.log"
      - "/tmp/codeuser/errors.log"
      - "/tmp/codeuser/performance.log"
      - "/tmp/codeuser/restaurant-performance.log"
    regex: []
  exclude:
    glob:
      - "/tmp/codeuser/logdna-agent.log"
      - "/tmp/codeuser/logdna-agent.pid"
    regex: []
  line_exclusion_regex: []
  line_inclusion_regex: []
  lookback: start

journald: {}
startup: {}
`.trim();
    
    fs.writeFileSync(envFile, envContent);
    fs.writeFileSync(yamlFile, yamlContent);
    
    console.log('📋 LogDNA configuration updated');
    console.log('🌐 Configuration details:');
    console.log(`   Host: ${host || 'logs.mezmo.com'}`);
    console.log(`   Type: ${hostConfig.type}`);
    console.log(`   Endpoint: ${hostConfig.endpoint}`);
    console.log(`   Key: ${ingestionKey.substring(0, 8)}...`);
    
    res.json({
      success: true,
      message: `LogDNA agent configured for ${hostConfig.type} environment`,
      hostConfig: {
        host: host || 'logs.mezmo.com',
        type: hostConfig.type,
        endpoint: hostConfig.endpoint
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error configuring LogDNA:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to configure LogDNA agent',
        details: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      });
    }
  }
});

// Helper function to validate environment configuration
const validateLogDNAConfig = (envContent) => {
  const mzHostMatch = envContent.match(/MZ_HOST=([^\n]+)/);
  const mzKeyMatch = envContent.match(/MZ_INGESTION_KEY=([^\n]+)/);
  const logdnaHostMatch = envContent.match(/LOGDNA_HOST=([^\n]+)/);
  const logdnaKeyMatch = envContent.match(/LOGDNA_INGESTION_KEY=([^\n]+)/);

  const hasMzConfig = mzHostMatch && mzKeyMatch && mzKeyMatch[1].length >= 16;
  const hasLogdnaConfig = logdnaHostMatch && logdnaKeyMatch && logdnaKeyMatch[1].length >= 16;
  
  return {
    isValid: hasMzConfig || hasLogdnaConfig,
    hasMzConfig,
    hasLogdnaConfig,
    host: (mzHostMatch && mzHostMatch[1]) || (logdnaHostMatch && logdnaHostMatch[1]),
    keyLength: (mzKeyMatch && mzKeyMatch[1].length) || (logdnaKeyMatch && logdnaKeyMatch[1].length) || 0
  };
};

// Helper function to check agent health by testing log forwarding
const checkAgentHealth = async (pid, timeoutMs = 5000) => {
  return new Promise((resolve) => {
    const logFile = '/tmp/codeuser/logdna-agent.log';
    let healthCheckTimer;
    
    // Test if process is running
    try {
      process.kill(pid, 0);
    } catch (error) {
      return resolve({ healthy: false, reason: 'Process not running' });
    }
    
    // Check logs for health indicators
    const checkLogs = () => {
      try {
        if (fs.existsSync(logFile)) {
          const logContent = fs.readFileSync(logFile, 'utf8');
          const recentLogs = logContent.split('\n').slice(-20).join('\n');
          
          // Positive indicators - match actual LogDNA agent v3.x output patterns
          if (recentLogs.match(/Enabling filesystem|initializing middleware|watching.*tmp.*codeuser|files_tracked.*[1-9]/i)) {
            clearTimeout(healthCheckTimer);
            return resolve({ healthy: true, reason: 'Agent logs show filesystem monitoring active' });
          }
          
          // Negative indicators
          if (recentLogs.match(/authentication.*failed|invalid.*key|connection.*refused|unable.*connect/i)) {
            clearTimeout(healthCheckTimer);
            return resolve({ healthy: false, reason: 'Authentication or connection error detected' });
          }
        }
      } catch (error) {
        // Continue checking
      }
    };
    
    // Check immediately and then periodically
    checkLogs();
    const logCheckInterval = setInterval(checkLogs, 500);
    
    // Timeout after specified time
    healthCheckTimer = setTimeout(() => {
      clearInterval(logCheckInterval);
      resolve({ healthy: null, reason: 'Health check timeout - agent status unclear' });
    }, timeoutMs);
  });
};

// Helper function to check OTEL collector health by testing metrics endpoint and logs
const checkOtelCollectorHealth = async (pid, timeoutMs = 5000) => {
  return new Promise((resolve) => {
    const logFile = '/tmp/codeuser/otel-collector.log';
    let healthCheckTimer;
    
    // Test if process is running
    try {
      process.kill(pid, 0);
    } catch (error) {
      return resolve({ healthy: false, reason: 'Process not running' });
    }
    
    // Check logs for health indicators
    const checkLogs = () => {
      try {
        if (fs.existsSync(logFile)) {
          const logContent = fs.readFileSync(logFile, 'utf8');
          const recentLogs = logContent.split('\n').slice(-20).join('\n');
          
          // Positive indicators - OTEL collector startup success patterns
          if (recentLogs.match(/Everything is ready|Starting.*collector|Server available|receivers.*started/i)) {
            clearTimeout(healthCheckTimer);
            return resolve({ healthy: true, reason: 'OTEL Collector logs show successful startup' });
          }
          
          // Check if metrics endpoint is accessible
          if (recentLogs.match(/serving.*metrics|prometheus.*endpoint|8888.*available/i)) {
            clearTimeout(healthCheckTimer);
            return resolve({ healthy: true, reason: 'OTEL Collector metrics endpoint active' });
          }
          
          // Negative indicators - common failure patterns
          if (recentLogs.match(/failed.*start|error.*config|authentication.*failed|connection.*refused|unable.*bind|port.*already.*use/i)) {
            clearTimeout(healthCheckTimer);
            return resolve({ healthy: false, reason: 'Configuration or startup error detected in logs' });
          }
          
          // Pipeline-specific errors
          if (recentLogs.match(/exporter.*failed|pipeline.*error|receiver.*failed/i)) {
            clearTimeout(healthCheckTimer);
            return resolve({ healthy: false, reason: 'Pipeline or exporter error detected' });
          }
        }
      } catch (error) {
        // Continue checking
      }
    };
    
    // Additional check - try to ping metrics endpoint
    const checkMetricsEndpoint = async () => {
      try {
        const response = await fetch('http://localhost:8888/metrics', { timeout: 1000 });
        if (response.ok) {
          clearTimeout(healthCheckTimer);
          return resolve({ healthy: true, reason: 'OTEL Collector metrics endpoint responsive' });
        }
      } catch (error) {
        // Metrics endpoint not available, continue with log checking
      }
    };
    
    // Check immediately and then periodically
    checkLogs();
    checkMetricsEndpoint();
    const logCheckInterval = setInterval(() => {
      checkLogs();
      if (Math.random() < 0.3) { // Check metrics endpoint occasionally to avoid spam
        checkMetricsEndpoint();
      }
    }, 500);
    
    // Timeout after specified time
    healthCheckTimer = setTimeout(() => {
      clearInterval(logCheckInterval);
      resolve({ healthy: null, reason: 'Health check timeout - OTEL Collector status unclear' });
    }, timeoutMs);
  });
};

// Retry utility function for handling transient failures
const retryOperation = async (operation, maxRetries = 3, delayMs = 1000, operationName = 'operation') => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempting ${operationName} (attempt ${attempt}/${maxRetries})`);
      const result = await operation();
      if (attempt > 1) {
        console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ ${operationName} attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 1.5; // Exponential backoff
      }
    }
  }
  
  console.error(`❌ ${operationName} failed after ${maxRetries} attempts`);
  throw lastError;
};

app.post('/api/mezmo/start', (req, res) => {
  try {
    const pidFile = '/tmp/codeuser/logdna-agent.pid';
    const logFile = '/tmp/codeuser/logdna-agent.log';
    const envFile = '/etc/logdna/logdna.env';
    
    console.log('🚀 Starting LogDNA agent via API...');
    
    // Check if already running and validate health
    if (fs.existsSync(pidFile)) {
      const pidContent = fs.readFileSync(pidFile, 'utf8').trim();
      const pid = parseInt(pidContent);
      
      if (!isNaN(pid)) {
        try {
          process.kill(pid, 0);
          console.log(`⚠️  Agent already running (PID: ${pid}), checking health...`);
          
          // Check if the running agent is healthy
          checkAgentHealth(pid, 3000).then(healthCheck => {
            if (healthCheck.healthy === true) {
              console.log('✅ Running agent is healthy, no restart needed');
              if (!res.headersSent) {
                res.json({ 
                  message: 'LogDNA agent is already running and healthy', 
                  pid,
                  health: healthCheck.reason,
                  timestamp: new Date().toISOString()
                });
              }
            } else if (healthCheck.healthy === false) {
              console.log(`❌ Running agent is unhealthy: ${healthCheck.reason}`);
              console.log('🔄 Attempting to restart agent...');
              
              // Kill unhealthy agent and restart
              try {
                process.kill(pid, 'SIGTERM');
                setTimeout(() => {
                  try { process.kill(pid, 'SIGKILL'); } catch(e) {}
                }, 2000);
              } catch (killError) {
                console.log('Agent process already dead');
              }
              
              // Clean up and restart
              fs.unlinkSync(pidFile);
              // Continue to restart logic below
              startNewAgent();
            } else {
              console.log(`⚠️  Agent health unclear: ${healthCheck.reason}`);
              if (!res.headersSent) {
                res.json({ 
                  message: 'LogDNA agent is running but health status unclear', 
                  pid,
                  health: healthCheck.reason,
                  timestamp: new Date().toISOString()
                });
              }
            }
          }).catch(healthError => {
            console.error('Health check failed:', healthError);
            if (!res.headersSent) {
              res.json({ 
                message: 'LogDNA agent is running but health check failed', 
                pid,
                error: healthError.message,
                timestamp: new Date().toISOString()
              });
            }
          });
          
          return; // Exit early, health check will handle response
          
        } catch (error) {
          // Process not running, clean up
          console.log('🧹 Cleaning up stale PID file');
          fs.unlinkSync(pidFile);
        }
      } else {
        console.log('🧹 Cleaning up invalid PID file');
        fs.unlinkSync(pidFile);
      }
    }
    
    // Function to start new agent
    const startNewAgent = () => {
      // Check if configuration exists
      if (!fs.existsSync(envFile)) {
        return res.status(400).json({ error: 'LogDNA not configured. Please configure first.' });
      }
      
      // Check if LogDNA agent binary exists
      if (!fs.existsSync('/usr/bin/logdna-agent')) {
        return res.status(500).json({ 
          error: 'LogDNA agent binary not found',
          details: 'The LogDNA agent is not installed in this container. Install it first or use OTEL Collector instead.'
        });
      }
    
      try {
        // Read and validate environment configuration
        const envContent = fs.readFileSync(envFile, 'utf8');
        const configValidation = validateLogDNAConfig(envContent);
        
        console.log('🔍 Pre-start validation:');
        console.log(`   Environment file: ${fs.existsSync(envFile) ? '✅' : '❌'}`);
        console.log(`   Configuration valid: ${configValidation.isValid ? '✅' : '❌'}`);
        console.log(`   Host: ${configValidation.host || 'Not found'}`);
        console.log(`   Ingestion key length: ${configValidation.keyLength || 0} chars`);
        console.log(`   Has MZ config: ${configValidation.hasMzConfig ? '✅' : '❌'}`);
        console.log(`   Has LOGDNA config: ${configValidation.hasLogdnaConfig ? '✅' : '❌'}`);

        if (!configValidation.isValid) {
          return res.status(400).json({ 
            error: 'Invalid environment configuration',
            details: 'Need either (MZ_HOST + MZ_INGESTION_KEY) or (LOGDNA_HOST + LOGDNA_INGESTION_KEY) with valid ingestion key',
            validation: configValidation
          });
        }
      
        // Create a more robust startup script
        const startupScript = `/tmp/start-logdna-api.sh`;
        const startupScriptContent = `#!/bin/bash
set -e
echo "🚀 Starting LogDNA agent via API..."
source ${envFile}
echo "📡 Connecting to host: \${MZ_HOST:-\$LOGDNA_HOST}"
exec /usr/bin/logdna-agent
`;
        
        fs.writeFileSync(startupScript, startupScriptContent);
        fs.chmodSync(startupScript, 0o755);
        
        console.log('▶️ Starting LogDNA agent with enhanced monitoring...');
        
        // Start agent in background with better error handling
        const child = spawn(startupScript, [], {
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        // Write PID immediately
        fs.writeFileSync(pidFile, child.pid.toString());
        
        // Set up log capture
        let logBuffer = '';
        const appendToLog = (data) => {
          const content = data.toString();
          logBuffer += content;
          try {
            fs.appendFileSync(logFile, content);
          } catch (logWriteError) {
            console.warn('Failed to write to log file:', logWriteError.message);
          }
        };
        
        child.stdout.on('data', appendToLog);
        child.stderr.on('data', appendToLog);
        
        // Handle process exit
        child.on('exit', (code, signal) => {
          console.log(`LogDNA agent process exited with code ${code}, signal ${signal}`);
          // Clean up PID file if agent exits
          try {
            if (fs.existsSync(pidFile)) {
              fs.unlinkSync(pidFile);
            }
          } catch (cleanupError) {
            console.warn('Failed to clean up PID file:', cleanupError.message);
          }
        });
        
        // Allow process to run independently
        child.unref();
        
        console.log(`⏳ LogDNA agent starting with PID: ${child.pid}...`);
        
        // Enhanced validation with health checking
        setTimeout(async () => {
          // Check if response hasn't been sent yet
          if (res.headersSent) {
            return; // Response already sent, nothing to do
          }
          
          try {
            // Verify process is still running
            process.kill(child.pid, 0);
            
            // Perform health check
            const healthCheck = await checkAgentHealth(child.pid, 2000);
            
            if (healthCheck.healthy === true) {
              console.log('✅ LogDNA agent started successfully and is healthy');
              return res.json({ 
                success: true,
                message: 'LogDNA agent started successfully and is forwarding logs', 
                pid: child.pid,
                health: healthCheck.reason,
                timestamp: new Date().toISOString()
              });
            } else if (healthCheck.healthy === false) {
              console.log(`❌ LogDNA agent unhealthy: ${healthCheck.reason}`);
              
              // Get recent logs for debugging
              const recentLogs = logBuffer.split('\n').slice(-10).join('\n');
              
              return res.status(500).json({ 
                error: 'LogDNA agent started but is not healthy',
                details: healthCheck.reason,
                logs: recentLogs,
                pid: child.pid,
                timestamp: new Date().toISOString()
              });
            } else {
              console.log(`⚠️  LogDNA agent health status unclear: ${healthCheck.reason}`);
              return res.json({ 
                success: true,
                message: 'LogDNA agent started but health status unclear',
                pid: child.pid,
                health: healthCheck.reason,
                warning: 'Monitor agent logs to verify log forwarding',
                timestamp: new Date().toISOString()
              });
            }
            
          } catch (pidError) {
            // Process died during startup
            console.log('❌ LogDNA agent process died during startup');
            
            const recentLogs = logBuffer || 'No log content captured';
            
            // Clean up PID file
            try {
              if (fs.existsSync(pidFile)) {
                fs.unlinkSync(pidFile);
              }
            } catch (cleanupError) {
              console.warn('Failed to clean up PID file:', cleanupError.message);
            }
            
            return res.status(500).json({ 
              error: 'LogDNA agent failed to start',
              details: 'Process died immediately after startup. Check configuration and connectivity.',
              logs: recentLogs,
              timestamp: new Date().toISOString()
            });
          }
        }, 4000); // Wait 4 seconds for thorough validation
      
      } catch (execError) {
        console.error('Failed to execute start command:', execError);
        return res.status(500).json({ 
          error: 'Failed to execute start command',
          details: execError.message
        });
      }
    };
    
    // Start new agent if we reached here
    startNewAgent();
    
  } catch (error) {
    console.error('Error starting LogDNA agent:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to start LogDNA agent',
        details: error.message
      });
    }
  }
});

app.post('/api/mezmo/stop', (req, res) => {
  try {
    const pidFile = '/tmp/codeuser/logdna-agent.pid';
    
    if (!fs.existsSync(pidFile)) {
      return res.json({ 
        message: 'LogDNA agent is not running',
        timestamp: new Date().toISOString()
      });
    }
    
    const pidContent = fs.readFileSync(pidFile, 'utf8').trim();
    const pid = parseInt(pidContent);
    
    if (isNaN(pid)) {
      // Invalid PID, clean up file
      fs.unlinkSync(pidFile);
      return res.json({ 
        message: 'LogDNA agent was not running (invalid PID)',
        timestamp: new Date().toISOString()
      });
    }
    
    try {
      // Use sudo to kill the process if it was started with elevated privileges
      execSync(`sudo kill ${pid}`, { stdio: 'inherit' });
      fs.unlinkSync(pidFile);
      console.log('🛑 LogDNA agent stopped');
      res.json({ 
        success: true,
        message: 'LogDNA agent stopped',
        timestamp: new Date().toISOString()
      });
    } catch (killError) {
      // Process might already be dead, try regular kill and cleanup
      try {
        process.kill(pid, 'SIGTERM');
      } catch (e) {
        // Ignore if process doesn't exist
      }
      
      // Clean up PID file
      try {
        if (fs.existsSync(pidFile)) {
          fs.unlinkSync(pidFile);
        }
      } catch (cleanupError) {
        console.warn('Error cleaning up PID file:', cleanupError);
      }
      
      res.json({ 
        message: 'LogDNA agent was not running',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error stopping LogDNA agent:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to stop LogDNA agent',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
});

app.get('/api/mezmo/logs', (req, res) => {
  try {
    const logFile = '/tmp/codeuser/logdna-agent.log';
    const envFile = '/etc/logdna/logdna.env';
    const pidFile = '/tmp/codeuser/logdna-agent.pid';
    
    // Gather comprehensive debug information
    const debugInfo = {
      logFileExists: fs.existsSync(logFile),
      envFileExists: fs.existsSync(envFile),
      pidFileExists: fs.existsSync(pidFile),
      agentBinaryExists: fs.existsSync('/usr/bin/logdna-agent'),
      configValidation: null,
      processStatus: null,
      logFileAge: null,
      systemInfo: {
        timestamp: new Date().toISOString(),
        hostname: os.hostname(),
        platform: os.platform(),
        userInfo: (() => {
          try {
            return os.userInfo();
          } catch (error) {
            return { username: 'unknown', uid: -1, gid: -1, shell: null, homedir: null };
          }
        })()
      }
    };
    
    // Check file ages to understand startup sequence
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      debugInfo.logFileAge = {
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        ageMinutes: Math.round((Date.now() - stats.mtime) / 60000)
      };
    }
    
    // Validate configuration if env file exists
    if (fs.existsSync(envFile)) {
      try {
        const envContent = fs.readFileSync(envFile, 'utf8');
        const configValidation = validateLogDNAConfig(envContent);
        
        debugInfo.configValidation = {
          isValid: configValidation.isValid,
          hasMzConfig: configValidation.hasMzConfig,
          hasLogdnaConfig: configValidation.hasLogdnaConfig,
          host: configValidation.host || 'Not found',
          keyLength: configValidation.keyLength
        };
        
        debugInfo.configuredHost = configValidation.host || 'Not found';
      } catch (envError) {
        debugInfo.configuredHost = 'Error reading env file';
        debugInfo.configValidation = { error: envError.message };
      }
    }
    
    // Check process status if PID file exists
    if (fs.existsSync(pidFile)) {
      try {
        const pidContent = fs.readFileSync(pidFile, 'utf8').trim();
        const pid = parseInt(pidContent);
        
        if (!isNaN(pid)) {
          try {
            process.kill(pid, 0); // Test if process exists
            debugInfo.processStatus = {
              pid,
              running: true,
              pidFileAge: Math.round((Date.now() - fs.statSync(pidFile).mtime) / 60000)
            };
          } catch (killError) {
            debugInfo.processStatus = {
              pid,
              running: false,
              error: 'Process not found',
              pidFileAge: Math.round((Date.now() - fs.statSync(pidFile).mtime) / 60000)
            };
          }
        } else {
          debugInfo.processStatus = { 
            error: 'Invalid PID in file',
            pidContent: pidContent.substring(0, 20)
          };
        }
      } catch (pidError) {
        debugInfo.processStatus = { error: pidError.message };
      }
    }
    
    if (!fs.existsSync(logFile)) {
      return res.json({ 
        logs: 'No logs available - agent may not have started',
        debugInfo,
        timestamp: new Date().toISOString()
      });
    }
    
    const logs = fs.readFileSync(logFile, 'utf8');
    const lines = logs.split('\n').slice(-50); // Last 50 lines
    
    // Enhanced error pattern detection with categorization and startup sequence
    const errorPatterns = [
      // Authentication issues
      { pattern: /403.*forbidden/i, category: 'authentication', severity: 'high' },
      { pattern: /bad.*request.*check.*configuration/i, category: 'authentication', severity: 'high' },
      { pattern: /unauthorized/i, category: 'authentication', severity: 'high' },
      { pattern: /invalid.*key/i, category: 'authentication', severity: 'medium' },
      { pattern: /authentication.*failed/i, category: 'authentication', severity: 'high' },
      
      // Network connectivity
      { pattern: /connection.*refused/i, category: 'network', severity: 'high' },
      { pattern: /timeout/i, category: 'network', severity: 'medium' },
      { pattern: /dns.*resolution.*failed/i, category: 'network', severity: 'high' },
      { pattern: /host.*not.*found/i, category: 'network', severity: 'medium' },
      { pattern: /unable.*connect/i, category: 'network', severity: 'high' },
      { pattern: /network.*unreachable/i, category: 'network', severity: 'high' },
      
      // Security and SSL
      { pattern: /certificate/i, category: 'security', severity: 'medium' },
      { pattern: /ssl.*error/i, category: 'security', severity: 'medium' },
      { pattern: /tls.*handshake.*failed/i, category: 'security', severity: 'medium' },
      
      // Configuration issues
      { pattern: /missing.*configuration/i, category: 'configuration', severity: 'high' },
      { pattern: /invalid.*format/i, category: 'configuration', severity: 'medium' },
      { pattern: /config.*error/i, category: 'configuration', severity: 'medium' },
      { pattern: /environment.*variable.*not.*set/i, category: 'configuration', severity: 'high' },
      
      // Startup sequence issues
      { pattern: /failed.*to.*start/i, category: 'startup', severity: 'high' },
      { pattern: /agent.*exited.*immediately/i, category: 'startup', severity: 'high' },
      { pattern: /permission.*denied/i, category: 'startup', severity: 'high' },
      { pattern: /binary.*not.*found/i, category: 'startup', severity: 'high' },
      { pattern: /segmentation.*fault/i, category: 'startup', severity: 'high' },
      
      // Runtime issues
      { pattern: /buffer.*full/i, category: 'runtime', severity: 'medium' },
      { pattern: /memory.*error/i, category: 'runtime', severity: 'high' },
      { pattern: /disk.*space/i, category: 'runtime', severity: 'medium' },
      { pattern: /rate.*limit/i, category: 'runtime', severity: 'medium' }
    ];
    
    const detectedIssues = [];
    const issueCategories = { 
      authentication: [], 
      network: [], 
      security: [], 
      configuration: [], 
      startup: [], 
      runtime: [] 
    };

    lines.forEach(line => {
      errorPatterns.forEach(errorInfo => {
        if (errorInfo.pattern.test(line)) {
          const issue = { line: line.trim(), category: errorInfo.category, severity: errorInfo.severity };
          detectedIssues.push(issue);
          issueCategories[errorInfo.category].push(issue);
        }
      });
    });

    // Generate specific recommendations based on detected issues
    const recommendations = [];
    
    if (issueCategories.authentication.length > 0) {
      recommendations.push({
        issue: 'Authentication Failed (403 Forbidden)',
        cause: 'Invalid or expired ingestion key for the configured environment',
        solutions: [
          'Verify the ingestion key is valid for the configured host',
          'Check if the key is for the correct environment (dev/staging/prod)',
          'Regenerate the ingestion key in your Mezmo account if needed',
          'Ensure the key format is correct (32+ characters)'
        ]
      });
    }

    if (issueCategories.network.length > 0) {
      recommendations.push({
        issue: 'Network Connection Failed',
        cause: 'Unable to reach the configured host',
        solutions: [
          'Check internet connectivity',
          'Verify the host URL is correct for your environment',
          'Check if corporate firewall is blocking connections',
          'Test connectivity: ping logs.mezmo.com or curl -I https://logs.mezmo.com'
        ]
      });
    }

    if (issueCategories.security.length > 0) {
      recommendations.push({
        issue: 'SSL/Certificate Issues',
        cause: 'Problems with SSL/TLS connection security',
        solutions: [
          'Check system clock is accurate',
          'Verify SSL certificates are up to date',
          'Try connecting from a different network',
          'Update container base image if certificates are outdated'
        ]
      });
    }
    
    if (issueCategories.configuration.length > 0) {
      recommendations.push({
        issue: 'Configuration Problems',
        cause: 'Invalid or missing configuration settings',
        solutions: [
          'Check environment file exists: /etc/logdna/logdna.env',
          'Verify all required variables are set (MZ_INGESTION_KEY, MZ_HOST)',
          'Validate configuration format and values',
          'Restart agent after configuration changes'
        ]
      });
    }
    
    if (issueCategories.startup.length > 0) {
      recommendations.push({
        issue: 'Agent Startup Failed',
        cause: 'LogDNA agent binary cannot start or initialize properly',
        solutions: [
          'Check if LogDNA agent is installed: ls -la /usr/bin/logdna-agent',
          'Verify file permissions and execute rights',
          'Check available disk space and memory',
          'Review startup logs for specific error messages',
          'Try manual agent start: /usr/bin/logdna-agent --help'
        ]
      });
    }
    
    if (issueCategories.runtime.length > 0) {
      recommendations.push({
        issue: 'Runtime Performance Issues',
        cause: 'Agent running but experiencing performance problems',
        solutions: [
          'Check system resources (CPU, memory, disk)',
          'Monitor log buffer sizes and rates',
          'Verify log file permissions in /tmp/codeuser/',
          'Consider adjusting agent configuration parameters'
        ]
      });
    }
    
    res.json({ 
      logs: lines.join('\n'),
      debugInfo,
      detectedIssues: detectedIssues.length > 0 ? detectedIssues : [{ line: 'No obvious connection issues detected', category: 'info', severity: 'low' }],
      recommendations,
      issueCategories,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reading LogDNA logs:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to read LogDNA logs',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
});

// Frontend traces proxy endpoint - Fixed backend trace proxy
app.use('/api/traces/v1/traces', express.raw({ type: 'application/x-protobuf', limit: '10mb' }));
app.post('/api/traces/v1/traces', async (req, res) => {
  const startTime = Date.now();
  let errorDetails = null;
  
  // Log incoming trace request for flow tracking
  console.log(`📨 Trace proxy: Received ${req.body?.length || 0} bytes from ${req.ip || 'unknown'} at ${new Date().toISOString()}`);
  
  try {
    // Enhanced collector availability check
    const pidFile = '/tmp/codeuser/otel-collector.pid';
    const configFile = '/etc/otelcol/config.yaml';
    
    // Check configuration first
    if (!fs.existsSync(configFile)) {
      errorDetails = 'OTEL collector configuration file not found';
      console.warn(`⚠️ Trace proxy: Configuration check failed - ${errorDetails}`);
      return res.status(503).json({ 
        error: 'Service Unavailable', 
        details: errorDetails,
        code: 'NO_CONFIG'
      });
    }
    
    // Check if collector process is running
    if (!fs.existsSync(pidFile)) {
      errorDetails = 'OTEL collector PID file not found - service not started';
      console.warn(`⚠️ Trace proxy: Collector availability check failed - ${errorDetails}`);
      return res.status(503).json({ 
        error: 'Service Unavailable', 
        details: errorDetails,
        code: 'COLLECTOR_DOWN'
      });
    }
    
    let pid;
    try {
      pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
      if (isNaN(pid)) {
        throw new Error('Invalid PID format in collector PID file');
      }
      
      // Verify process is actually running
      process.kill(pid, 0);
    } catch (pidError) {
      // Clean up stale PID file
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
      errorDetails = `OTEL collector process not running: ${pidError.message}`;
      console.warn(`⚠️ Trace proxy: Process validation failed - ${errorDetails}`);
      return res.status(503).json({ 
        error: 'Service Unavailable', 
        details: errorDetails,
        code: 'COLLECTOR_DOWN'
      });
    }
    
    // Enhanced request forwarding with proper headers
    const collectorUrl = 'http://localhost:4318/v1/traces';
    const requestHeaders = {
      'Content-Type': req.headers['content-type'] || 'application/x-protobuf',
      'User-Agent': 'restaurant-app-trace-proxy/1.0',
      'X-Forwarded-For': req.ip || 'unknown',
      'X-Proxy-Timestamp': startTime.toString()
    };
    
    // Forward authorization headers if present
    if (req.headers.authorization) {
      requestHeaders.authorization = req.headers.authorization;
    }
    
    // Add any custom OTEL headers
    Object.keys(req.headers).forEach(header => {
      if (header.startsWith('x-otel-') || header.startsWith('otlp-')) {
        requestHeaders[header] = req.headers[header];
      }
    });
    
    console.log(`🔄 Trace proxy: Forwarding ${req.body?.length || 0} bytes to collector (PID: ${pid})`);
    
    try {
      // Forward request to OTEL collector with enhanced error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(collectorUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: req.body,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const responseStatus = response.status;
      const responseTime = Date.now() - startTime;
      
      // Handle different response scenarios
      if (response.ok) {
        // Success case - log detailed success information
        console.log(`✅ Trace proxy: Successfully forwarded traces to collector in ${responseTime}ms (status: ${responseStatus}, size: ${req.body?.length || 0} bytes)`);
        
        const responseBody = await response.text();
        res.status(responseStatus);
        if (responseBody) {
          res.send(responseBody);
        } else {
          res.end();
        }
        return;
      }
      
      // Log non-success collector responses
      console.warn(`⚠️ Trace proxy: Collector responded with ${responseStatus} in ${responseTime}ms`);
      
      // Handle collector errors
      if (responseStatus === 400) {
        errorDetails = 'Invalid trace data format';
        console.warn(`⚠️ Trace proxy: Bad request (400) - ${errorDetails}`);
      } else if (responseStatus === 429) {
        errorDetails = 'Rate limit exceeded';
        console.warn(`⚠️ Trace proxy: Rate limited (429) - ${errorDetails}`);
      } else if (responseStatus >= 500) {
        errorDetails = 'Collector internal error';
        console.error(`❌ Trace proxy: Collector error (${responseStatus}) - ${errorDetails}`);
      } else {
        errorDetails = `Unexpected collector response: ${responseStatus}`;
        console.warn(`⚠️ Trace proxy: Unexpected status (${responseStatus}) - ${errorDetails}`);
      }
      
      // Return the actual collector response
      res.status(responseStatus).json({
        error: 'Collector Error',
        details: errorDetails,
        code: 'COLLECTOR_ERROR',
        originalStatus: responseStatus
      });
      
    } catch (fetchError) {
      const responseTime = Date.now() - startTime;
      
      if (fetchError.name === 'AbortError') {
        errorDetails = 'Request timeout (>10s)';
        console.error(`❌ Trace proxy: Timeout after ${responseTime}ms`);
        return res.status(504).json({
          error: 'Gateway Timeout',
          details: errorDetails,
          code: 'TIMEOUT'
        });
      }
      
      // Connection errors (collector down, port closed, etc.)
      if (fetchError.code === 'ECONNREFUSED' || fetchError.message.includes('fetch failed')) {
        errorDetails = 'Failed to forward traces to OTEL collector on port 4318';
        console.error(`❌ Trace proxy: Forwarding failed after ${responseTime}ms - ${errorDetails}`);
        return res.status(502).json({
          error: 'Bad Gateway', 
          details: errorDetails,
          code: 'FORWARD_FAILED'
        });
      }
      
      // Other network errors - also treat as forwarding failures
      errorDetails = `Failed to forward traces due to network error: ${fetchError.message}`;
      console.error(`❌ Trace proxy: Forwarding failed after ${responseTime}ms - ${errorDetails}`);
      return res.status(502).json({
        error: 'Bad Gateway',
        details: errorDetails,
        code: 'FORWARD_FAILED'
      });
    }
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    errorDetails = `Proxy error: ${error.message}`;
    console.error(`❌ Trace proxy: Unexpected error after ${responseTime}ms - ${errorDetails}`);
    
    res.status(500).json({
      error: 'Internal Server Error',
      details: errorDetails,
      code: 'PROXY_ERROR'
    });
  }
});

// Test endpoint for generating a test trace
app.get('/api/test-trace', async (req, res) => {
  try {
    const { trace, context, SpanStatusCode } = await import('@opentelemetry/api');
    const tracer = trace.getTracer('test-tracer', '1.0.0');
    
    // Check if tracing is actually enabled
    const tracerProvider = trace.getTracerProvider();
    const isNoop = tracerProvider.constructor.name === 'NoopTracerProvider';
    
    if (isNoop) {
      return res.json({
        success: false,
        message: 'OpenTelemetry is not initialized - traces will not be generated',
        provider: 'NoopTracerProvider'
      });
    }
    
    // Create a test span
    const span = tracer.startSpan('test-trace-endpoint', {
      attributes: {
        'test.timestamp': new Date().toISOString(),
        'test.source': 'manual-test',
        'http.method': 'GET',
        'http.url': '/api/test-trace'
      }
    });
    
    // Add some events to the span
    span.addEvent('test-trace-started');
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));
    
    span.addEvent('test-work-completed', {
      'work.duration': 100,
      'work.status': 'success'
    });
    
    // Create a child span
    const childSpan = tracer.startSpan('test-child-operation', {
      attributes: {
        'operation.type': 'database-query',
        'operation.table': 'test-table'
      }
    }, trace.setSpan(context.active(), span));
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    childSpan.setStatus({ code: SpanStatusCode.OK });
    childSpan.end();
    
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
    
    const spanContext = span.spanContext();
    
    res.json({
      success: true,
      message: 'Test trace generated successfully',
      trace: {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        traceFlags: spanContext.traceFlags
      },
      provider: tracerProvider.constructor.name,
      timestamp: new Date().toISOString()
    });
    
    console.log(`✅ Test trace generated: ${spanContext.traceId}`);
  } catch (error) {
    console.error('❌ Failed to generate test trace:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// OpenTelemetry Collector Management
const generateOTELConfig = ({ 
  serviceName, 
  tags, 
  debugLevel,
  // Multi-pipeline configuration
  logsEnabled, logsIngestionKey, logsPipelineId, logsHost,
  metricsEnabled, metricsIngestionKey, metricsPipelineId, metricsHost,
  tracesEnabled, tracesIngestionKey, tracesPipelineId, tracesHost
}) => {
  const config = {
    receivers: {},
    processors: {
      batch: {
        timeout: '1s',
        send_batch_size: 1024
      },
      resource: {
        attributes: [
          { key: 'service.name', value: serviceName || 'restaurant-app', action: 'upsert' },
          { key: 'service.version', value: '1.0.0', action: 'upsert' },
          { key: 'deployment.environment', value: 'demo', action: 'upsert' },
          { key: 'service.tags', value: tags || 'restaurant-app,otel', action: 'upsert' }
        ]
      }
    },
    exporters: {},
    service: {
      pipelines: {},
      telemetry: {
        logs: {
          level: debugLevel || 'info'
        },
        metrics: {
          address: '0.0.0.0:8888'
        }
      }
    }
  };

  console.log('🔧 Multi-Pipeline OTEL Config Generation:');
  console.log('   Service Name:', serviceName);
  console.log('   Debug Level:', debugLevel);

  // LOGS PIPELINE - Multiple structured log files
  if (logsEnabled && logsIngestionKey) {
    const logsHasPipelineId = logsPipelineId && logsPipelineId.length > 0;
    const logsEndpoint = logsHasPipelineId 
      ? `https://${logsHost || 'pipeline.mezmo.com'}/v1/${logsPipelineId}`
      : `https://${logsHost || 'pipeline.mezmo.com'}`;

    console.log('   📄 Logs Pipeline:');
    console.log('     Endpoint:', logsEndpoint);
    console.log('     Pipeline ID:', logsPipelineId || 'Legacy');

    // File receiver for structured logs
    config.receivers.filelog = {
      include: [
        '/tmp/codeuser/access.log',
        '/tmp/codeuser/events.log', 
        '/tmp/codeuser/performance.log',
        '/tmp/codeuser/restaurant-performance.log',
        '/tmp/codeuser/errors.log',
        '/tmp/codeuser/metrics.log',
        '/tmp/codeuser/app.log'
      ],
      start_at: 'beginning',
      operators: [
        {
          type: 'add',
          field: 'attributes.log_type',
          value: 'structured'
        },
        {
          type: 'add', 
          field: 'attributes.service',
          value: serviceName || 'restaurant-app'
        }
      ]
    };

    // Debug exporters
    config.exporters['logging/logs'] = {
      loglevel: 'info'
    };
    
    config.exporters['file/logs'] = {
      path: '/tmp/codeuser/otel-logs-debug.json',
      format: 'json'
    };

    if (logsHasPipelineId) {
      // Mezmo Pipeline for logs
      config.exporters['otlphttp/logs'] = {
        logs_endpoint: logsEndpoint,
        headers: {
          authorization: logsIngestionKey,
          'content-type': 'application/x-protobuf'
        }
      };
    } else {
      // Legacy LogDNA for logs
      config.exporters['mezmo/logs'] = {
        ingest_url: "https://logs.mezmo.com/otel/ingest/rest",
        ingest_key: logsIngestionKey
      };
    }

    config.service.pipelines.logs = {
      receivers: ['filelog'],
      processors: ['resource', 'batch'],
      exporters: logsHasPipelineId 
        ? ['file/logs', 'otlphttp/logs'] 
        : ['logging/logs', 'mezmo/logs']
    };
  }

  // METRICS PIPELINE - System and application metrics
  if (metricsEnabled && metricsIngestionKey) {
    const metricsHasPipelineId = metricsPipelineId && metricsPipelineId.length > 0;
    const metricsEndpoint = metricsHasPipelineId 
      ? `https://${metricsHost || 'pipeline.mezmo.com'}/v1/${metricsPipelineId}`
      : `https://${metricsHost || 'pipeline.mezmo.com'}`;

    console.log('   📊 Metrics Pipeline:');
    console.log('     Endpoint:', metricsEndpoint);
    console.log('     Pipeline ID:', metricsPipelineId || 'Legacy');

    // Host metrics receiver
    config.receivers.hostmetrics = {
      collection_interval: '30s',
      scrapers: {
        cpu: { metrics: { 'system.cpu.utilization': { enabled: true } } },
        memory: { metrics: { 'system.memory.utilization': { enabled: true } } },
        disk: { metrics: { 'system.disk.io': { enabled: true } } },
        filesystem: { metrics: { 'system.filesystem.utilization': { enabled: true } } },
        network: { metrics: { 'system.network.io': { enabled: true } } }
      }
    };

    // Note: filelog receiver only supports logs, not metrics
    // metrics.log should be handled by the logs pipeline if needed

    if (metricsHasPipelineId) {
      // Mezmo Pipeline for metrics
      config.exporters['otlphttp/metrics'] = {
        endpoint: metricsEndpoint,
        headers: {
          authorization: metricsIngestionKey,
          'content-type': 'application/x-protobuf'
        }
      };
    } else {
      // Legacy LogDNA for metrics
      config.exporters['otlphttp/metrics'] = {
        endpoint: `${metricsEndpoint}/v1/metrics`,
        headers: {
          authorization: `Bearer ${metricsIngestionKey}`,
          'x-mezmo-service': serviceName || 'restaurant-app'
        }
      };
    }

    config.service.pipelines.metrics = {
      receivers: ['hostmetrics'],
      processors: ['resource', 'batch'],
      exporters: ['otlphttp/metrics']
    };
  }

  // TRACES PIPELINE - Application tracing
  if (tracesEnabled && tracesIngestionKey) {
    const tracesHasPipelineId = tracesPipelineId && tracesPipelineId.length > 0;
    const tracesEndpoint = tracesHasPipelineId 
      ? `https://${tracesHost || 'pipeline.mezmo.com'}/v1/${tracesPipelineId}`
      : `https://${tracesHost || 'pipeline.mezmo.com'}`;

    console.log('   🔍 Traces Pipeline:');
    console.log('     Endpoint:', tracesEndpoint);
    console.log('     Pipeline ID:', tracesPipelineId || 'Legacy');

    // OTLP receiver for traces
    config.receivers.otlp = {
      protocols: {
        grpc: {
          endpoint: '0.0.0.0:4317'
        },
        http: {
          endpoint: '0.0.0.0:4318',
          cors: {
            allowed_origins: ['http://localhost:8080', 'http://localhost:3000', 'http://localhost:3001'],
            allowed_headers: ['*'],
            max_age: 7200
          }
        }
      }
    };

    // Debug file exporter for traces
    config.exporters['file/traces'] = {
      path: '/tmp/codeuser/otel-traces-debug.json',
      format: 'json'
    };

    if (tracesHasPipelineId) {
      // Mezmo Pipeline for traces
      config.exporters['otlphttp/traces'] = {
        endpoint: tracesEndpoint,
        headers: {
          authorization: tracesIngestionKey,
          'content-type': 'application/x-protobuf'
        }
      };
    } else {
      // Legacy LogDNA for traces
      config.exporters['otlphttp/traces'] = {
        endpoint: `${tracesEndpoint}/v1/traces`,
        headers: {
          authorization: `Bearer ${tracesIngestionKey}`,
          'x-mezmo-service': serviceName || 'restaurant-app'
        }
      };
    }

    config.service.pipelines.traces = {
      receivers: ['otlp'],
      processors: ['resource', 'batch'],
      exporters: ['file/traces', 'otlphttp/traces']
    };
  }

  console.log('   ✅ Multi-pipeline configuration generated');
  return config;
};

app.get('/api/otel/status', async (req, res) => {
  try {
    // Check if collector is running
    const pidFile = '/tmp/codeuser/otel-collector.pid';
    const configFile = '/etc/otelcol/config.yaml';
    
    let status = 'disconnected';
    let pid = null;
    let hasConfig = false;
    let enabledPipelines = { logs: false, metrics: false, traces: false };
    let metricsData = null;
    let healthChecks = { collector: false, pipelines: {} };
    let errors = [];
    
    if (fs.existsSync(configFile)) {
      hasConfig = true;
      
      // Try to read config to determine enabled pipelines
      try {
        const configContent = fs.readFileSync(configFile, 'utf8');
        const config = yaml.load(configContent);
        if (config && config.service && config.service.pipelines) {
          enabledPipelines = {
            logs: !!config.service.pipelines.logs,
            metrics: !!config.service.pipelines.metrics,
            traces: !!config.service.pipelines.traces
          };
          
          // Validate trace pipeline configuration
          if (enabledPipelines.traces) {
            const tracePipeline = config.service.pipelines.traces;
            healthChecks.pipelines.traceConfig = {
              hasReceivers: !!(tracePipeline.receivers && tracePipeline.receivers.length > 0),
              hasProcessors: !!(tracePipeline.processors && tracePipeline.processors.length > 0),
              hasExporters: !!(tracePipeline.exporters && tracePipeline.exporters.length > 0)
            };
            
            // Check for required trace exporters
            if (tracePipeline.exporters) {
              const hasOtlpExporter = tracePipeline.exporters.includes('otlphttp/traces');
              const hasDebugExporter = tracePipeline.exporters.includes('file/traces');
              healthChecks.pipelines.traceConfig.hasOtlpExporter = hasOtlpExporter;
              healthChecks.pipelines.traceConfig.hasDebugExporter = hasDebugExporter;
              
              if (!hasOtlpExporter && !hasDebugExporter) {
                errors.push('Trace pipeline missing required exporters (otlphttp/traces or file/traces)');
              }
            } else {
              errors.push('Trace pipeline enabled but no exporters configured');
              healthChecks.pipelines.traceConfig.hasExporters = false;
            }
            
            // Validate trace receivers
            if (!tracePipeline.receivers || tracePipeline.receivers.length === 0) {
              errors.push('Trace pipeline enabled but no receivers configured');
            }
          }
        }
      } catch (error) {
        console.warn('Could not parse OTEL config:', error);
        errors.push(`Config parsing error: ${error.message}`);
      }
    } else {
      errors.push('No configuration file found');
    }
    
    if (fs.existsSync(pidFile)) {
      try {
        pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
        // Check if PID is still running
        process.kill(pid, 0); // This throws if process doesn't exist
        status = 'connected';
        
        // Perform health check using enhanced health checking
        try {
          const healthCheck = await checkOtelCollectorHealth(pid, 1500);
          healthChecks.collector = healthCheck.healthy === true;
          
          // Update status based on health
          if (healthCheck.healthy === false) {
            status = 'error';
            errors.push(`Health check failed: ${healthCheck.reason}`);
          } else if (healthCheck.healthy === null) {
            status = 'connecting'; // Status unclear
            errors.push(`Health check timeout: ${healthCheck.reason}`);
          }
        } catch (healthError) {
          console.warn('OTEL health check failed:', healthError);
          errors.push(`Health check error: ${healthError.message}`);
        }
        
        // Enhanced status monitoring - collect real-time metrics
        try {
          const metricsResponse = await fetch('http://localhost:8888/metrics');
          if (metricsResponse.ok) {
            healthChecks.collector = true;
            const metricsText = await metricsResponse.text();
            
            // Parse key metrics
            const stats = {
              logsSent: 0,
              metricsCollected: 0,
              tracesReceived: 0,
              errors: 0,
              uptime: 0
            };
            
            // Extract metrics using regex
            const logsSentMatch = metricsText.match(/otelcol_exporter_sent_log_records_total\{[^}]*exporter="otlphttp\/logs"[^}]*\}\s+(\d+)/);
            const metricsCollectedMatch = metricsText.match(/otelcol_exporter_sent_metric_points_total\{[^}]*exporter="otlphttp\/metrics"[^}]*\}\s+(\d+)/);
            const tracesReceivedMatch = metricsText.match(/otelcol_exporter_sent_spans_total\{[^}]*exporter="otlphttp\/traces"[^}]*\}\s+(\d+)/);
            const errorsMatch = metricsText.match(/otelcol_exporter_send_failed_log_records_total\{[^}]*\}\s+(\d+)/);
            
            // Trace-specific error metrics
            const traceFailedMatch = metricsText.match(/otelcol_exporter_send_failed_spans_total\{[^}]*exporter="otlphttp\/traces"[^}]*\}\s+(\d+)/);
            const traceProcessorDroppedMatch = metricsText.match(/otelcol_processor_dropped_spans_total\{[^}]*\}\s+(\d+)/);
            const traceReceiverAcceptedMatch = metricsText.match(/otelcol_receiver_accepted_spans_total\{[^}]*\}\s+(\d+)/);
            
            const uptimeMatch = metricsText.match(/otelcol_process_uptime\{\}\s+([\d.]+)/);
            
            if (logsSentMatch) stats.logsSent = parseInt(logsSentMatch[1]);
            if (metricsCollectedMatch) stats.metricsCollected = parseInt(metricsCollectedMatch[1]);
            if (tracesReceivedMatch) stats.tracesReceived = parseInt(tracesReceivedMatch[1]);
            if (errorsMatch) stats.errors = parseInt(errorsMatch[1]);
            if (uptimeMatch) stats.uptime = parseFloat(uptimeMatch[1]);
            
            // Add trace-specific metrics to stats
            stats.tracesFailed = traceFailedMatch ? parseInt(traceFailedMatch[1]) : 0;
            stats.tracesDropped = traceProcessorDroppedMatch ? parseInt(traceProcessorDroppedMatch[1]) : 0;
            stats.tracesAccepted = traceReceiverAcceptedMatch ? parseInt(traceReceiverAcceptedMatch[1]) : 0;
            
            metricsData = stats;
            
            // Health checks for pipeline connectivity
            if (enabledPipelines.logs) {
              healthChecks.pipelines.logs = stats.logsSent > 0 || stats.errors === 0;
            }
            if (enabledPipelines.metrics) {
              healthChecks.pipelines.metrics = stats.metricsCollected > 0 || stats.errors === 0;
            }
            if (enabledPipelines.traces) {
              // Enhanced trace health check with specific trace metrics
              const tracePipelineHealthy = (
                stats.tracesReceived > 0 || 
                (stats.tracesAccepted > 0 && stats.tracesFailed === 0 && stats.tracesDropped === 0)
              ) && stats.tracesFailed === 0;
              
              healthChecks.pipelines.traces = tracePipelineHealthy;
              
              // Add trace-specific error reporting
              if (stats.tracesFailed > 0) {
                errors.push(`Trace export failures: ${stats.tracesFailed} failed span exports`);
              }
              if (stats.tracesDropped > 0) {
                errors.push(`Trace processing drops: ${stats.tracesDropped} spans dropped during processing`);
              }
              
              // Report trace pipeline metrics summary
              if (stats.tracesAccepted > 0 || stats.tracesReceived > 0 || stats.tracesFailed > 0) {
                const traceHealthSummary = {
                  accepted: stats.tracesAccepted,
                  exported: stats.tracesReceived,
                  failed: stats.tracesFailed,
                  dropped: stats.tracesDropped
                };
                healthChecks.pipelines.traceMetrics = traceHealthSummary;
              }
            }
            
            // Error detection and reporting
            if (stats.errors > 0) {
              errors.push(`Pipeline errors detected: ${stats.errors} failed operations`);
            }
            
          } else {
            healthChecks.collector = false;
            errors.push('Collector metrics endpoint not responding');
          }
        } catch (metricsError) {
          healthChecks.collector = false;
          errors.push(`Metrics collection failed: ${metricsError.message}`);
        }
        
        // Check log file for recent errors
        try {
          const logFile = '/tmp/codeuser/otel-collector.log';
          if (fs.existsSync(logFile)) {
            const logs = fs.readFileSync(logFile, 'utf8');
            const recentLogs = logs.split('\n').slice(-20).join('\n');
            
            // Look for error patterns
            if (recentLogs.includes('ERROR') || recentLogs.includes('FATAL')) {
              const errorLines = recentLogs.split('\n').filter(line => 
                line.includes('ERROR') || line.includes('FATAL')
              ).slice(-3); // Last 3 error lines
              
              errorLines.forEach(errorLine => {
                errors.push(`Log error: ${errorLine.trim()}`);
              });
            }
          }
        } catch (logError) {
          errors.push(`Could not check logs: ${logError.message}`);
        }
        
        // Check trace debug file for trace-specific health indicators
        if (enabledPipelines.traces) {
          try {
            const traceDebugFile = '/tmp/codeuser/otel-traces-debug.json';
            if (fs.existsSync(traceDebugFile)) {
              healthChecks.pipelines.traceDebugFile = true;
              
              // Read recent trace debug entries for error analysis
              const traceDebugContent = fs.readFileSync(traceDebugFile, 'utf8');
              const traceLines = traceDebugContent.trim().split('\n').slice(-10); // Last 10 entries
              
              let traceExportErrors = 0;
              let recentTraceActivity = false;
              
              traceLines.forEach(line => {
                try {
                  if (line.trim()) {
                    const traceEntry = JSON.parse(line);
                    if (traceEntry.resourceSpans && traceEntry.resourceSpans.length > 0) {
                      recentTraceActivity = true;
                    }
                  }
                } catch (parseError) {
                  // Could be export error or malformed entry
                  if (line.includes('error') || line.includes('failed')) {
                    traceExportErrors++;
                  }
                }
              });
              
              // Update trace pipeline health based on debug file analysis
              if (traceExportErrors > 0) {
                errors.push(`Trace export errors detected in debug file: ${traceExportErrors} errors in recent entries`);
                healthChecks.pipelines.traces = false;
              } else if (recentTraceActivity) {
                healthChecks.pipelines.traces = true;
              }
              
            } else {
              healthChecks.pipelines.traceDebugFile = false;
              if (enabledPipelines.traces) {
                errors.push('Trace debug file not found - traces may not be configured properly');
              }
            }
          } catch (traceDebugError) {
            healthChecks.pipelines.traceDebugFile = false;
            errors.push(`Could not check trace debug file: ${traceDebugError.message}`);
          }
        }
        
      } catch (error) {
        // Process not running, clean up stale PID file
        fs.unlinkSync(pidFile);
        status = 'disconnected';
        pid = null;
        errors.push('Process not running (cleaned up stale PID file)');
      }
    } else {
      errors.push('Collector not started');
    }
    
    // Determine overall health status
    const isHealthy = status === 'connected' && 
                     healthChecks.collector && 
                     errors.length === 0 &&
                     Object.values(enabledPipelines).some(enabled => enabled);
    
    res.json({
      status,
      pid,
      hasConfig,
      enabledPipelines,
      healthChecks,
      metricsData,
      errors: errors.length > 0 ? errors : null,
      isHealthy,
      lastChecked: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking OTEL status:', error);
    res.status(500).json({ 
      error: 'Failed to check OTEL Collector status',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get OTEL Collector internal metrics
app.get('/api/otel/metrics', async (req, res) => {
  try {
    // Check if collector is running first
    const pidFile = '/tmp/codeuser/otel-collector.pid';
    if (!fs.existsSync(pidFile)) {
      return res.json({
        logsSent: 0,
        metricsCollected: 0,
        tracesReceived: 0,
        errors: 0,
        tracesFailed: 0,
        tracesDropped: 0,
        tracesAccepted: 0,
        lastError: 'Collector not running'
      });
    }

    // Scrape metrics from collector's internal endpoint
    const response = await fetch('http://localhost:8888/metrics');
    
    if (!response.ok) {
      throw new Error('Failed to fetch collector metrics');
    }
    
    const metricsText = await response.text();
    
    // Parse Prometheus-format metrics
    const stats = {
      logsSent: 0,
      metricsCollected: 0,
      tracesReceived: 0,
      errors: 0,
      tracesFailed: 0,
      tracesDropped: 0,
      tracesAccepted: 0,
      lastError: null
    };
    
    // Extract relevant metrics using regex (accounting for labels)
    const logsSentMatch = metricsText.match(/otelcol_exporter_sent_log_records_total\{[^}]*exporter="otlphttp\/logs"[^}]*\}\s+(\d+)/);
    const metricsCollectedMatch = metricsText.match(/otelcol_exporter_sent_metric_points_total\{[^}]*exporter="otlphttp\/metrics"[^}]*\}\s+(\d+)/);
    const tracesReceivedMatch = metricsText.match(/otelcol_exporter_sent_spans_total\{[^}]*exporter="otlphttp\/traces"[^}]*\}\s+(\d+)/);
    const errorsMatch = metricsText.match(/otelcol_exporter_send_failed_log_records_total\{[^}]*\}\s+(\d+)/);
    
    // Trace-specific error metrics  
    const traceFailedMatch = metricsText.match(/otelcol_exporter_send_failed_spans_total\{[^}]*exporter="otlphttp\/traces"[^}]*\}\s+(\d+)/);
    const traceProcessorDroppedMatch = metricsText.match(/otelcol_processor_dropped_spans_total\{[^}]*\}\s+(\d+)/);
    const traceReceiverAcceptedMatch = metricsText.match(/otelcol_receiver_accepted_spans_total\{[^}]*\}\s+(\d+)/);
    
    if (logsSentMatch) stats.logsSent = parseInt(logsSentMatch[1]);
    if (metricsCollectedMatch) stats.metricsCollected = parseInt(metricsCollectedMatch[1]);
    if (tracesReceivedMatch) stats.tracesReceived = parseInt(tracesReceivedMatch[1]);
    if (errorsMatch) stats.errors = parseInt(errorsMatch[1]);
    
    // Add trace-specific metrics
    stats.tracesFailed = traceFailedMatch ? parseInt(traceFailedMatch[1]) : 0;
    stats.tracesDropped = traceProcessorDroppedMatch ? parseInt(traceProcessorDroppedMatch[1]) : 0;
    stats.tracesAccepted = traceReceiverAcceptedMatch ? parseInt(traceReceiverAcceptedMatch[1]) : 0;
    
    res.json(stats);
    
  } catch (error) {
    console.error('Error fetching OTEL metrics:', error);
    res.json({
      logsSent: 0,
      metricsCollected: 0,
      tracesReceived: 0,
      errors: 0,
      tracesFailed: 0,
      tracesDropped: 0,
      tracesAccepted: 0,
      lastError: error.message
    });
  }
});

app.post('/api/otel/configure', async (req, res) => {
  try {
    console.log(`🔧 OTEL Configure Request: ${JSON.stringify({
      timestamp: new Date().toISOString(),
      source: 'ConfigManager'
    })}`);
    
    // Enhanced configuration validation with detailed error messages
    const validateConfiguration = async () => {
      try {
        const otelConfig = configManager.getConfig('otel');
        
        if (!otelConfig.enabled) {
          return {
            valid: false,
            error: 'OTEL is not enabled in configuration',
            suggestion: 'Please enable OTEL in the Agents configuration page'
          };
        }
        
        const { serviceName, tags, pipelines } = otelConfig;
        const debugLevel = req.body.debugLevel || 'info';
        
        // Extract pipeline configurations
        const logsEnabled = pipelines?.logs?.enabled || false;
        const logsIngestionKey = pipelines?.logs?.ingestionKey || '';
        const logsPipelineId = pipelines?.logs?.pipelineId || '';
        const logsHost = pipelines?.logs?.host || '';
        
        const metricsEnabled = pipelines?.metrics?.enabled || false;
        const metricsIngestionKey = pipelines?.metrics?.ingestionKey || '';
        const metricsPipelineId = pipelines?.metrics?.pipelineId || '';
        const metricsHost = pipelines?.metrics?.host || '';
        
        const tracesEnabled = pipelines?.traces?.enabled || false;
        const tracesIngestionKey = pipelines?.traces?.ingestionKey || '';
        const tracesPipelineId = pipelines?.traces?.pipelineId || '';
        const tracesHost = pipelines?.traces?.host || '';
        
        // Enhanced validation with specific error messages
        const issues = [];
        
        // Check for at least one enabled pipeline
        if (!logsEnabled && !metricsEnabled && !tracesEnabled) {
          issues.push({
            pipeline: 'general',
            error: 'No pipelines are enabled',
            suggestion: 'Enable at least one pipeline (logs, metrics, or traces) in the configuration'
          });
        }
        
        // Validate individual pipelines
        if (logsEnabled) {
          if (!logsIngestionKey) {
            issues.push({
              pipeline: 'logs',
              error: 'Logs pipeline enabled but no ingestion key provided',
              suggestion: 'Please provide a valid Mezmo logs ingestion key'
            });
          } else if (!/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[A-Za-z0-9+/]+=*)$/.test(logsIngestionKey)) {
            issues.push({
              pipeline: 'logs',
              error: 'Invalid logs ingestion key format',
              suggestion: 'Ingestion key must be a valid UUID format (e.g., 12345678-1234-1234-1234-123456789abc) or base64 encoded string'
            });
          }
          if (!logsHost) {
            issues.push({
              pipeline: 'logs',
              error: 'Logs pipeline enabled but no host provided',
              suggestion: 'Please specify the Mezmo logs host URL (e.g., logs.mezmo.com)'
            });
          }
        }
        
        if (metricsEnabled) {
          if (!metricsIngestionKey) {
            issues.push({
              pipeline: 'metrics',
              error: 'Metrics pipeline enabled but no ingestion key provided',
              suggestion: 'Please provide a valid Mezmo metrics ingestion key'
            });
          } else if (!/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[A-Za-z0-9+/]+=*)$/.test(metricsIngestionKey)) {
            issues.push({
              pipeline: 'metrics',
              error: 'Invalid metrics ingestion key format',
              suggestion: 'Ingestion key must be a valid UUID format (e.g., 12345678-1234-1234-1234-123456789abc) or base64 encoded string'
            });
          }
          if (!metricsHost) {
            issues.push({
              pipeline: 'metrics',
              error: 'Metrics pipeline enabled but no host provided',
              suggestion: 'Please specify the Mezmo metrics host URL (e.g., metrics.mezmo.com)'
            });
          }
        }
        
        if (tracesEnabled) {
          if (!tracesIngestionKey) {
            issues.push({
              pipeline: 'traces',
              error: 'Traces pipeline enabled but no ingestion key provided',
              suggestion: 'Please provide a valid Mezmo traces ingestion key'
            });
          } else if (!/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[A-Za-z0-9+/]+=*)$/.test(tracesIngestionKey)) {
            issues.push({
              pipeline: 'traces',
              error: 'Invalid traces ingestion key format',
              suggestion: 'Ingestion key must be a valid UUID format (e.g., 12345678-1234-1234-1234-123456789abc) or base64 encoded string'
            });
          }
          if (!tracesHost) {
            issues.push({
              pipeline: 'traces',
              error: 'Traces pipeline enabled but no host provided',
              suggestion: 'Please specify the Mezmo traces host URL (e.g., traces.mezmo.com)'
            });
          }
        }
        
        if (issues.length > 0) {
          return {
            valid: false,
            error: 'Configuration validation failed',
            issues,
            suggestion: 'Please fix the configuration issues listed above'
          };
        }
        
        return {
          valid: true,
          config: {
            serviceName, tags, debugLevel,
            logsEnabled, logsIngestionKey, logsPipelineId, logsHost,
            metricsEnabled, metricsIngestionKey, metricsPipelineId, metricsHost,
            tracesEnabled, tracesIngestionKey, tracesPipelineId, tracesHost
          }
        };
        
      } catch (configError) {
        return {
          valid: false,
          error: 'Failed to load OTEL configuration from ConfigManager',
          details: configError.message,
          suggestion: 'Check that ConfigManager is properly initialized and OTEL configuration exists'
        };
      }
    };
    
    // Use retry utility for configuration validation with enhanced error handling
    const validationResult = await retryOperation(
      validateConfiguration,
      2, // Max 2 retries for config validation
      500, // 500ms delay
      'OTEL configuration validation'
    );
    
    if (!validationResult.valid) {
      console.error('❌ OTEL configuration validation failed:', validationResult);
      return res.status(400).json({
        error: validationResult.error,
        details: validationResult.details,
        issues: validationResult.issues,
        suggestion: validationResult.suggestion,
        timestamp: new Date().toISOString()
      });
    }
    
    const config = validationResult.config;
    console.log(`🔧 ConfigManager Parameters: ${JSON.stringify({
      serviceName: config.serviceName, 
      tags: config.tags, 
      debugLevel: config.debugLevel,
      logsEnabled: config.logsEnabled, 
      hasLogsKey: !!config.logsIngestionKey,
      metricsEnabled: config.metricsEnabled, 
      hasMetricsKey: !!config.metricsIngestionKey,
      tracesEnabled: config.tracesEnabled, 
      hasTracesKey: !!config.tracesIngestionKey
    })}`);
    
    
    // Enhanced configuration file generation with retry logic
    const generateConfigFile = async () => {
      try {
        const configDir = '/tmp/codeuser/otelcol';
        const configFile = `${configDir}/config.yaml`;
        
        // Ensure config directory exists with proper permissions
        try {
          if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true, mode: 0o755 });
            console.log('📁 Created OTEL config directory:', configDir);
          }
        } catch (dirError) {
          throw new Error(`Failed to create config directory: ${dirError.message}`);
        }
        
        // Generate dynamic multi-pipeline configuration with enhanced validation
        let otelConfig;
        try {
          otelConfig = generateOTELConfig({
            serviceName: config.serviceName || 'restaurant-app',
            tags: config.tags || 'restaurant-app,otel',
            debugLevel: config.debugLevel || 'info',
            // Logs pipeline
            logsEnabled: config.logsEnabled,
            logsIngestionKey: config.logsIngestionKey,
            logsPipelineId: config.logsPipelineId,
            logsHost: config.logsHost,
            // Metrics pipeline
            metricsEnabled: config.metricsEnabled,
            metricsIngestionKey: config.metricsIngestionKey,
            metricsPipelineId: config.metricsPipelineId,
            metricsHost: config.metricsHost,
            // Traces pipeline
            tracesEnabled: config.tracesEnabled,
            tracesIngestionKey: config.tracesIngestionKey,
            tracesPipelineId: config.tracesPipelineId,
            tracesHost: config.tracesHost
          });
        } catch (genError) {
          throw new Error(`Failed to generate OTEL configuration: ${genError.message}`);
        }
        
        // Validate generated configuration structure
        if (!otelConfig || typeof otelConfig !== 'object') {
          throw new Error('Generated OTEL configuration is invalid or empty');
        }
        
        if (!otelConfig.receivers || !otelConfig.processors || !otelConfig.exporters || !otelConfig.service) {
          throw new Error('Generated OTEL configuration is missing required sections (receivers, processors, exporters, service)');
        }
        
        // Convert to YAML with error handling
        let yamlContent;
        try {
          yamlContent = yaml.dump(otelConfig, { indent: 2, lineWidth: 120 });
        } catch (yamlError) {
          throw new Error(`Failed to convert configuration to YAML: ${yamlError.message}`);
        }
        
        // Write configuration file with atomic operation
        const tempFile = `${configFile}.tmp`;
        try {
          fs.writeFileSync(tempFile, yamlContent, { mode: 0o644 });
          
          // Validate written file can be read
          const writtenContent = fs.readFileSync(tempFile, 'utf8');
          if (!writtenContent || writtenContent.length === 0) {
            throw new Error('Written configuration file is empty');
          }
          
          // Atomic move to final location
          fs.renameSync(tempFile, configFile);
          console.log('📝 OTEL configuration file written successfully:', configFile);
        } catch (writeError) {
          // Clean up temp file if exists
          try {
            if (fs.existsSync(tempFile)) {
              fs.unlinkSync(tempFile);
            }
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
          throw new Error(`Failed to write configuration file: ${writeError.message}`);
        }
        
        return {
          success: true,
          configFile,
          pipelines: {
            logs: config.logsEnabled,
            metrics: config.metricsEnabled,
            traces: config.tracesEnabled
          }
        };
        
      } catch (configError) {
        return {
          success: false,
          error: 'Configuration file generation failed',
          details: configError.message,
          suggestion: 'Check file system permissions and disk space'
        };
      }
    };
    
    // Generate configuration with retry logic
    const configResult = await retryOperation(
      generateConfigFile,
      3, // Max 3 retries for file operations
      1000, // 1 second delay
      'OTEL configuration file generation'
    );
    
    if (!configResult.success) {
      console.error('❌ Failed to generate OTEL configuration:', configResult);
      return res.status(500).json({
        error: configResult.error,
        details: configResult.details,
        suggestion: configResult.suggestion,
        timestamp: new Date().toISOString()
      });
    }
    
    const configFile = configResult.configFile;
    
    console.log('📊 Multi-Pipeline OpenTelemetry Collector configuration updated');
    console.log('   Logs Pipeline:', configResult.pipelines.logs ? `✅ ${config.logsPipelineId || 'Legacy'}` : '❌ Disabled');
    console.log('   Metrics Pipeline:', configResult.pipelines.metrics ? `✅ ${config.metricsPipelineId || 'Legacy'}` : '❌ Disabled');
    console.log('   Traces Pipeline:', configResult.pipelines.traces ? `✅ ${config.tracesPipelineId || 'Legacy'}` : '❌ Disabled');
    
    // Enhanced collector restart with retry logic and recovery procedures
    const manageCollectorRestart = async () => {
      const pidFile = '/tmp/codeuser/otel-collector.pid';
      const logFile = '/tmp/codeuser/otel-collector.log';
      let wasRunning = false;
      
      // Check if collector is currently running
      if (fs.existsSync(pidFile)) {
        try {
          const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
          if (isNaN(pid)) {
            throw new Error('Invalid PID in file');
          }
          
          process.kill(pid, 0); // Check if process exists
          wasRunning = true;
          console.log(`🔍 OTEL Collector is running with PID ${pid}, preparing restart...`);
          
        } catch (processError) {
          console.log('🧹 Cleaning up stale PID file (process not running)');
          try {
            fs.unlinkSync(pidFile);
          } catch (unlinkError) {
            // PID file already gone
          }
        }
      }
      
      // Stop existing collector if running
      if (wasRunning) {
        try {
          const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
          console.log(`🛑 Stopping OTEL Collector (PID ${pid}) for configuration update...`);
          
          process.kill(pid, 'SIGTERM');
          
          // Wait for graceful shutdown with timeout
          let shutdownComplete = false;
          for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
              process.kill(pid, 0);
              console.log(`   Waiting for graceful shutdown... (${i + 1}/5)`);
            } catch (error) {
              shutdownComplete = true;
              break;
            }
          }
          
          // Force kill if still running
          if (!shutdownComplete) {
            console.log('   Forcing shutdown with SIGKILL...');
            try {
              process.kill(pid, 'SIGKILL');
            } catch (forceError) {
              // Process already dead
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Clean up PID file
          if (fs.existsSync(pidFile)) {
            fs.unlinkSync(pidFile);
          }
          
          console.log('✅ OTEL Collector stopped successfully');
          
        } catch (stopError) {
          console.warn(`⚠️  Warning during collector stop: ${stopError.message}`);
          // Ensure PID file cleanup
          if (fs.existsSync(pidFile)) {
            try {
              fs.unlinkSync(pidFile);
            } catch (cleanupError) {
              // Ignore cleanup errors
            }
          }
        }
      }
      
      // Start/restart the collector if it was running or has valid configuration
      const shouldStart = wasRunning || (configResult.pipelines.logs || configResult.pipelines.metrics || configResult.pipelines.traces);
      
      if (shouldStart) {
        // Ensure log directory exists
        const logDir = '/tmp/codeuser';
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
        
        // Clear previous log file to avoid confusion
        if (fs.existsSync(logFile)) {
          try {
            fs.unlinkSync(logFile);
          } catch (logCleanError) {
            // Ignore log cleanup errors
          }
        }
        
        console.log(`🚀 ${wasRunning ? 'Restarting' : 'Starting'} OTEL Collector with new configuration...`);
        
        const startCommand = `nohup /usr/local/bin/otelcol-contrib --config="${configFile}" > ${logFile} 2>&1 & echo $! > ${pidFile}`;
        
        try {
          execSync(startCommand, { shell: '/bin/bash' });
          console.log('   Start command executed successfully');
          
          // Wait and verify startup with enhanced checking
          let startupSuccessful = false;
          let newPid = null;
          
          for (let attempt = 0; attempt < 5; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (fs.existsSync(pidFile)) {
              try {
                newPid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
                if (!isNaN(newPid)) {
                  process.kill(newPid, 0); // Verify process is running
                  startupSuccessful = true;
                  break;
                }
              } catch (verifyError) {
                console.log(`   Startup verification attempt ${attempt + 1}/5 - process not ready yet`);
              }
            }
          }
          
          if (startupSuccessful && newPid) {
            // Perform health check after startup
            try {
              const healthCheck = await checkOtelCollectorHealth(newPid, 3000);
              
              if (healthCheck.healthy === true) {
                console.log(`✅ OTEL Collector ${wasRunning ? 'restarted' : 'started'} successfully with PID ${newPid} and is healthy`);
                return {
                  success: true,
                  pid: newPid,
                  action: wasRunning ? 'restarted' : 'started',
                  health: healthCheck.reason
                };
              } else {
                console.warn(`⚠️  OTEL Collector started but health check failed: ${healthCheck.reason}`);
                return {
                  success: true,
                  pid: newPid,
                  action: wasRunning ? 'restarted' : 'started',
                  warning: healthCheck.reason
                };
              }
            } catch (healthError) {
              console.warn(`⚠️  OTEL Collector started but health check error: ${healthError.message}`);
              return {
                success: true,
                pid: newPid,
                action: wasRunning ? 'restarted' : 'started',
                warning: 'Health check failed'
              };
            }
          } else {
            throw new Error('Process did not start successfully within timeout period');
          }
          
        } catch (startError) {
          console.error(`❌ Failed to ${wasRunning ? 'restart' : 'start'} OTEL Collector:`, startError.message);
          
          // Check logs for detailed error information
          let errorLogs = 'No logs available';
          if (fs.existsSync(logFile)) {
            try {
              const logs = fs.readFileSync(logFile, 'utf8');
              errorLogs = logs.split('\n').slice(-10).join('\n');
            } catch (logReadError) {
              errorLogs = 'Could not read error logs';
            }
          }
          
          return {
            success: false,
            error: `Failed to ${wasRunning ? 'restart' : 'start'} OTEL Collector`,
            details: startError.message,
            logs: errorLogs,
            suggestion: 'Check OTEL Collector binary exists at /usr/local/bin/otelcol-contrib and configuration is valid'
          };
        }
      } else {
        console.log('ℹ️  No pipelines enabled, OTEL Collector will not be started');
        return {
          success: true,
          action: 'configuration_only',
          message: 'Configuration saved but collector not started (no pipelines enabled)'
        };
      }
    };
    
    // Execute collector management with retry logic
    const collectorResult = await retryOperation(
      manageCollectorRestart,
      2, // Max 2 retries for process management
      2000, // 2 second delay between retries
      'OTEL collector restart'
    );
    
    if (!collectorResult.success) {
      console.error('❌ Collector management failed:', collectorResult);
      return res.status(500).json({
        success: false,
        error: collectorResult.error,
        details: collectorResult.details,
        logs: collectorResult.logs,
        suggestion: collectorResult.suggestion,
        timestamp: new Date().toISOString()
      });
    }
    
    // Enhanced success response with detailed information
    const responseData = {
      success: true,
      message: 'Multi-pipeline OTEL Collector configuration saved and applied successfully',
      configFile: configFile,
      enabledPipelines: configResult.pipelines,
      pipelineDetails: {
        logs: configResult.pipelines.logs ? { 
          pipelineId: config.logsPipelineId || 'Legacy', 
          host: config.logsHost,
          enabled: true
        } : { enabled: false },
        metrics: configResult.pipelines.metrics ? { 
          pipelineId: config.metricsPipelineId || 'Legacy', 
          host: config.metricsHost,
          enabled: true
        } : { enabled: false },
        traces: configResult.pipelines.traces ? { 
          pipelineId: config.tracesPipelineId || 'Legacy', 
          host: config.tracesHost,
          enabled: true
        } : { enabled: false }
      },
      collector: {
        action: collectorResult.action,
        pid: collectorResult.pid || null,
        health: collectorResult.health || null,
        warning: collectorResult.warning || null,
        message: collectorResult.message || null
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ OTEL configuration completed successfully:', {
      action: collectorResult.action,
      pipelines: Object.keys(configResult.pipelines).filter(key => configResult.pipelines[key]).length,
      pid: collectorResult.pid
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Critical error during OTEL configuration:', error);
    
    // Enhanced error response with comprehensive debugging information
    const errorResponse = {
      success: false,
      error: 'Critical failure during OTEL configuration',
      details: error.message,
      suggestion: 'Check server logs for detailed error information and verify system requirements',
      timestamp: new Date().toISOString(),
      debugInfo: {
        errorType: error.constructor.name,
        hasStack: !!error.stack,
        configManager: {
          available: !!configManager,
          otelConfigExists: false
        },
        systemChecks: {
          configDir: '/etc/otelcol',
          configDirExists: false,
          yamlAvailable: typeof yaml?.dump === 'function',
          fsAvailable: typeof fs?.existsSync === 'function'
        },
        permissions: null
      }
    };
    
    // Safe system checks with error handling
    try {
      if (configManager) {
        errorResponse.debugInfo.configManager.otelConfigExists = !!configManager.getConfig('otel');
      }
    } catch (configError) {
      errorResponse.debugInfo.configManager.error = configError.message;
    }
    
    try {
      errorResponse.debugInfo.systemChecks.configDirExists = fs.existsSync('/etc/otelcol');
    } catch (fsError) {
      errorResponse.debugInfo.systemChecks.fsError = fsError.message;
    }
    
    try {
      const etcStats = fs.statSync('/etc');
      errorResponse.debugInfo.permissions = {
        etcDirectory: {
          exists: true,
          mode: etcStats.mode.toString(8),
          readable: true,
          writable: !!(etcStats.mode & fs.constants.S_IWUSR)
        }
      };
    } catch (permError) {
      errorResponse.debugInfo.permissions = {
        etcDirectory: {
          exists: false,
          error: permError.message
        }
      };
    }
    
    // Include stack trace only in development/debug mode
    if (process.env.NODE_ENV !== 'production') {
      errorResponse.stack = error.stack;
    }
    
    console.error('OTEL Configuration Error Response:', JSON.stringify(errorResponse, null, 2));
    res.status(500).json(errorResponse);
  }
});

app.post('/api/otel/start', async (req, res) => {
  try {
    // Check if already running with health checking (like Mezmo pattern)
    const pidFile = '/tmp/codeuser/otel-collector.pid';
    if (fs.existsSync(pidFile)) {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
      try {
        process.kill(pid, 0);
        console.log(`⚠️  OTEL Collector already running (PID: ${pid}), checking health...`);
        
        // Check if the running collector is healthy
        const healthCheck = await checkOtelCollectorHealth(pid, 3000);
        if (healthCheck.healthy === true) {
          console.log('✅ Running OTEL Collector is healthy, no restart needed');
          return res.json({ 
            message: 'OTEL Collector is already running and healthy', 
            pid,
            health: healthCheck.reason,
            alreadyRunning: true,
            timestamp: new Date().toISOString()
          });
        } else if (healthCheck.healthy === false) {
          console.log(`❌ Running OTEL Collector is unhealthy: ${healthCheck.reason}`);
          console.log('🔄 Attempting to restart collector...');
          
          // Kill unhealthy collector and restart
          try {
            process.kill(pid, 'SIGTERM');
            setTimeout(() => {
              try { process.kill(pid, 'SIGKILL'); } catch(e) {}
            }, 2000);
          } catch (killError) {
            console.log('OTEL Collector process already dead');
          }
          
          // Clean up and continue to restart logic below
          try {
            fs.unlinkSync(pidFile);
          } catch (unlinkError) {
            console.log('PID file already removed');
          }
          console.log('🔄 Proceeding with fresh start...');
        } else {
          console.log(`⚠️  OTEL Collector health unclear: ${healthCheck.reason}`);
          console.log('🔄 Restarting to ensure healthy state...');
          
          // Restart for unclear health status
          try {
            process.kill(pid, 'SIGTERM');
            setTimeout(() => {
              try { process.kill(pid, 'SIGKILL'); } catch(e) {}
            }, 2000);
            fs.unlinkSync(pidFile);
          } catch (error) {
            console.log('Error during restart preparation:', error.message);
          }
        }
        
      } catch (error) {
        // Process not running, clean up stale PID file
        console.log('🧹 Cleaning up stale PID file');
        try {
          fs.unlinkSync(pidFile);
        } catch (unlinkError) {
          // PID file already gone
        }
      }
    }
    
    // Check configuration
    const logFile = '/tmp/codeuser/otel-collector.log';
    const configFile = '/etc/otelcol/config.yaml';
    
    if (!fs.existsSync(configFile)) {
      return res.status(400).json({ error: 'OTEL Collector not configured. Please configure first.' });
    }
    
    // Ensure log directory exists
    const logDir = '/tmp/codeuser';
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Start collector with better error handling
    const startCommand = `nohup /usr/local/bin/otelcol-contrib --config="${configFile}" > ${logFile} 2>&1 & echo $! > ${pidFile}`;
    
    try {
      execSync(startCommand, { shell: '/bin/bash' });
      console.log('🚀 Started OTEL Collector process');
    } catch (execError) {
      console.error('❌ Failed to execute start command:', execError.message);
      return res.status(500).json({ 
        error: 'Failed to execute OTEL Collector start command',
        details: execError.message 
      });
    }
    
    // Wait and verify startup with multiple checks
    let pid = null;
    let startupSuccessful = false;
    
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (fs.existsSync(pidFile)) {
        pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
        try {
          process.kill(pid, 0); // Verify process is running
          startupSuccessful = true;
          break;
        } catch (error) {
          // Process died, continue waiting
          console.warn(`⚠️ OTEL Collector startup check ${i + 1} failed`);
        }
      }
    }
    
    if (startupSuccessful && pid) {
      // Perform health check after successful startup (like Mezmo pattern)
      try {
        console.log('🔍 Verifying OTEL Collector health after startup...');
        const healthCheck = await checkOtelCollectorHealth(pid, 2000);
        
        if (healthCheck.healthy === true) {
          console.log('✅ OTEL Collector started successfully and is healthy');
          return res.json({ 
            success: true,
            message: 'OTEL Collector started successfully and is healthy', 
            pid,
            health: healthCheck.reason,
            timestamp: new Date().toISOString()
          });
        } else if (healthCheck.healthy === false) {
          console.log(`❌ OTEL Collector started but is unhealthy: ${healthCheck.reason}`);
          
          // Get recent logs for debugging
          let recentLogs = 'No logs available';
          if (fs.existsSync(logFile)) {
            try {
              const logs = fs.readFileSync(logFile, 'utf8');
              recentLogs = logs.split('\n').slice(-10).join('\n');
            } catch (logError) {
              recentLogs = 'Could not read logs';
            }
          }
          
          return res.status(500).json({ 
            error: 'OTEL Collector started but is not healthy',
            details: healthCheck.reason,
            logs: recentLogs,
            pid,
            timestamp: new Date().toISOString()
          });
        } else {
          console.log(`⚠️  OTEL Collector health unclear: ${healthCheck.reason}`);
          return res.json({ 
            success: true,
            message: 'OTEL Collector started - health status unclear', 
            pid,
            health: healthCheck.reason,
            warning: 'Health check timeout - monitor collector manually',
            timestamp: new Date().toISOString()
          });
        }
      } catch (healthError) {
        console.warn('Health check failed after startup:', healthError);
        return res.json({ 
          success: true,
          message: 'OTEL Collector started - health check failed', 
          pid,
          warning: `Health check error: ${healthError.message}`,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      // Cleanup failed start
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
      
      // Try to read logs for error details
      let errorDetails = 'Unknown startup failure';
      if (fs.existsSync(logFile)) {
        try {
          const logs = fs.readFileSync(logFile, 'utf8');
          const recentLogs = logs.split('\n').slice(-10).join('\n');
          errorDetails = recentLogs || 'No error details in logs';
        } catch (logError) {
          errorDetails = 'Could not read error logs';
        }
      }
      
      console.error('❌ OTEL Collector failed to start:', errorDetails);
      res.status(500).json({ 
        error: 'OTEL Collector failed to start',
        details: errorDetails
      });
    }
    
  } catch (error) {
    console.error('Error starting OTEL Collector:', error);
    res.status(500).json({ 
      error: 'Failed to start OTEL Collector',
      details: error.message 
    });
  }
});

app.post('/api/otel/stop', async (req, res) => {
  try {
    const pidFile = '/tmp/codeuser/otel-collector.pid';
    
    if (!fs.existsSync(pidFile)) {
      return res.json({ message: 'OTEL Collector is not running' });
    }
    
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
    
    try {
      // Check if process exists first
      process.kill(pid, 0);
      
      // Send SIGTERM for graceful shutdown
      process.kill(pid, 'SIGTERM');
      console.log('🛑 Sent SIGTERM to OTEL Collector PID:', pid);
      
      // Wait for graceful shutdown (improved process cleanup)
      let shutdownComplete = false;
      for (let i = 0; i < 10; i++) { // Wait up to 10 seconds
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          process.kill(pid, 0); // Check if still running
        } catch (error) {
          // Process has stopped
          shutdownComplete = true;
          break;
        }
      }
      
      // If still running, force kill
      if (!shutdownComplete) {
        try {
          process.kill(pid, 'SIGKILL');
          console.log('⚠️ Forced OTEL Collector shutdown with SIGKILL');
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (killError) {
          // Process already gone
        }
      }
      
      // Clean up PID file
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
      
      console.log('🛑 OTEL Collector stopped successfully');
      res.json({ 
        success: true,
        message: 'OTEL Collector stopped',
        gracefulShutdown: shutdownComplete,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Process might already be dead, clean up PID file
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
      res.json({ 
        message: 'OTEL Collector was not running',
        cleaned: true 
      });
    }
  } catch (error) {
    console.error('Error stopping OTEL Collector:', error);
    res.status(500).json({ error: 'Failed to stop OTEL Collector' });
  }
});

app.get('/api/otel/logs', (req, res) => {
  try {
    const logFile = '/tmp/codeuser/otel-collector.log';
    
    if (!fs.existsSync(logFile)) {
      return res.json({ logs: 'No logs available' });
    }
    
    const logs = fs.readFileSync(logFile, 'utf8');
    const lines = logs.split('\n').slice(-50); // Last 50 lines
    
    res.json({ 
      logs: lines.join('\n'),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reading OTEL Collector logs:', error);
    res.status(500).json({ error: 'Failed to read OTEL Collector logs' });
  }
});

// Get OTEL Collector configuration
app.get('/api/otel/config', (req, res) => {
  try {
    const configFile = '/etc/otelcol/config.yaml';
    const pidFile = '/tmp/codeuser/otel-collector.pid';
    
    const configInfo = {
      timestamp: new Date().toISOString(),
      configFile: {
        exists: fs.existsSync(configFile),
        path: configFile,
        content: null
      },
      collector: {
        running: false,
        pid: null,
        pidFile: {
          exists: fs.existsSync(pidFile),
          path: pidFile
        }
      }
    };
    
    // Read config file if it exists
    if (configInfo.configFile.exists) {
      try {
        configInfo.configFile.content = fs.readFileSync(configFile, 'utf8');
      } catch (error) {
        configInfo.configFile.error = `Failed to read config: ${error.message}`;
      }
    }
    
    // Check if collector is running
    if (configInfo.collector.pidFile.exists) {
      try {
        const pidContent = fs.readFileSync(pidFile, 'utf8').trim();
        const pid = parseInt(pidContent);
        
        if (!isNaN(pid)) {
          try {
            process.kill(pid, 0); // Check if process exists
            configInfo.collector.running = true;
            configInfo.collector.pid = pid;
          } catch (killError) {
            configInfo.collector.running = false;
            configInfo.collector.error = 'Process not running';
          }
        }
      } catch (error) {
        configInfo.collector.error = `Failed to read PID file: ${error.message}`;
      }
    }
    
    res.json(configInfo);
  } catch (error) {
    console.error('Error getting OTEL Collector config:', error);
    res.status(500).json({ 
      error: 'Failed to get OTEL Collector config',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/otel/debug', (req, res) => {
  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      collector: {
        configExists: fs.existsSync('/etc/otelcol/config.yaml'),
        pidExists: fs.existsSync('/tmp/codeuser/otel-collector.pid'),
        logExists: fs.existsSync('/tmp/codeuser/otel-collector.log'),
        binary: fs.existsSync('/usr/local/bin/otelcol-contrib')
      },
      logDirectory: {
        exists: fs.existsSync('/tmp/codeuser'),
        permissions: null,
        files: []
      },
      config: null,
      recentLogs: null
    };

    // Check log directory permissions and files
    if (debugInfo.logDirectory.exists) {
      try {
        const stats = fs.statSync('/tmp/codeuser');
        debugInfo.logDirectory.permissions = stats.mode.toString(8);
        debugInfo.logDirectory.files = fs.readdirSync('/tmp/codeuser')
          .filter(file => file.endsWith('.log'))
          .map(file => {
            const filePath = `/tmp/codeuser/${file}`;
            const fileStats = fs.statSync(filePath);
            return {
              name: file,
              size: fileStats.size,
              modified: fileStats.mtime,
              readable: fs.constants.R_OK
            };
          });
      } catch (error) {
        debugInfo.logDirectory.error = error.message;
      }
    }

    // Read config if exists
    if (debugInfo.collector.configExists) {
      try {
        debugInfo.config = fs.readFileSync('/etc/otelcol/config.yaml', 'utf8');
      } catch (error) {
        debugInfo.config = `Error reading config: ${error.message}`;
      }
    }

    // Get recent collector logs
    if (debugInfo.collector.logExists) {
      try {
        const logs = fs.readFileSync('/tmp/codeuser/otel-collector.log', 'utf8');
        debugInfo.recentLogs = logs.split('\n').slice(-20).join('\n');
      } catch (error) {
        debugInfo.recentLogs = `Error reading logs: ${error.message}`;
      }
    }

    res.json(debugInfo);
  } catch (error) {
    console.error('Error getting OTEL debug info:', error);
    res.status(500).json({ error: 'Failed to get debug information' });
  }
});

// OTEL connectivity testing endpoint (similar to Mezmo test pattern)
app.post('/api/otel/test', async (req, res) => {
  try {
    const { pipelineType, ingestionKey, host, pipelineId } = req.body;
    
    if (!pipelineType || !['logs', 'metrics', 'traces'].includes(pipelineType)) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid pipeline type (logs, metrics, traces) is required' 
      });
    }
    
    if (!ingestionKey) {
      return res.status(400).json({ 
        success: false,
        error: 'Ingestion key is required for connectivity testing' 
      });
    }
    
    if (!host) {
      return res.status(400).json({ 
        success: false,
        error: 'Host URL is required for connectivity testing' 
      });
    }
    
    console.log(`🔍 Testing OTEL ${pipelineType} pipeline connectivity to ${host}`);
    
    // Test different endpoints based on pipeline type
    let testEndpoint;
    let testHeaders = {
      'Authorization': `Bearer ${ingestionKey}`,
      'Content-Type': 'application/json'
    };
    
    if (pipelineId) {
      testHeaders['X-Pipeline-Id'] = pipelineId;
    }
    
    // Determine test endpoint and payload based on pipeline type
    switch (pipelineType) {
      case 'logs':
        testEndpoint = host.includes('mezmo.com') || host.includes('logdna.com') 
          ? `${host.startsWith('http') ? host : `https://${host}`}/logs/ingest`
          : `${host.startsWith('http') ? host : `https://${host}`}/v1/logs`;
        break;
      case 'metrics':
        testEndpoint = host.includes('mezmo.com') || host.includes('logdna.com')
          ? `${host.startsWith('http') ? host : `https://${host}`}/metrics/ingest`
          : `${host.startsWith('http') ? host : `https://${host}`}/v1/metrics`;
        break;
      case 'traces':
        testEndpoint = host.includes('mezmo.com') || host.includes('logdna.com')
          ? `${host.startsWith('http') ? host : `https://${host}`}/traces/ingest`
          : `${host.startsWith('http') ? host : `https://${host}`}/v1/traces`;
        break;
    }
    
    // Create a minimal test payload
    const testPayload = {
      timestamp: new Date().toISOString(),
      message: `OTEL ${pipelineType} connectivity test`,
      level: 'info',
      source: 'otel-connectivity-test',
      app: 'restaurant-app',
      env: 'test'
    };
    
    // Perform the connectivity test
    const testStartTime = Date.now();
    let testResult;
    
    try {
      const testResponse = await fetch(testEndpoint, {
        method: 'POST',
        headers: testHeaders,
        body: JSON.stringify(testPayload),
        timeout: 10000 // 10 second timeout
      });
      
      const responseTime = Date.now() - testStartTime;
      const responseText = await testResponse.text().catch(() => '');
      
      testResult = {
        success: testResponse.ok,
        status: testResponse.status,
        statusText: testResponse.statusText,
        responseTime: responseTime,
        endpoint: testEndpoint,
        headers: Object.fromEntries(testResponse.headers.entries()),
        response: responseText.length > 500 ? responseText.substring(0, 500) + '...' : responseText
      };
      
      if (testResponse.ok) {
        console.log(`✅ OTEL ${pipelineType} connectivity test successful (${responseTime}ms)`);
      } else {
        console.log(`❌ OTEL ${pipelineType} connectivity test failed: ${testResponse.status} ${testResponse.statusText}`);
      }
      
    } catch (error) {
      const responseTime = Date.now() - testStartTime;
      testResult = {
        success: false,
        error: error.message,
        errorType: error.constructor.name,
        responseTime: responseTime,
        endpoint: testEndpoint
      };
      
      console.log(`❌ OTEL ${pipelineType} connectivity test error:`, error.message);
    }
    
    // Return comprehensive test results
    res.json({
      success: testResult.success,
      pipelineType,
      testResult,
      configuration: {
        host,
        ingestionKey: ingestionKey ? `${ingestionKey.substring(0, 8)}...` : 'Not provided',
        pipelineId: pipelineId || 'Not specified',
        endpoint: testEndpoint
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in OTEL connectivity test:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error during connectivity test',
      details: error.message 
    });
  }
});

// Testing endpoints for different HTTP error codes
app.get('/api/test/error/:code', (req, res) => {
  const code = parseInt(req.params.code);
  const delay = parseInt(req.query.delay) || 0;
  
  // Add optional delay to simulate slow responses
  setTimeout(() => {
    switch (code) {
      case 400:
        res.status(400).json({ 
          error: 'Bad Request', 
          message: 'The request was malformed or invalid',
          timestamp: new Date().toISOString()
        });
        break;
      case 401:
        res.status(401).json({ 
          error: 'Unauthorized', 
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        });
        break;
      case 403:
        res.status(403).json({ 
          error: 'Forbidden', 
          message: 'Access denied to this resource',
          timestamp: new Date().toISOString()
        });
        break;
      case 404:
        res.status(404).json({ 
          error: 'Not Found', 
          message: 'The requested resource was not found',
          timestamp: new Date().toISOString()
        });
        break;
      case 422:
        res.status(422).json({ 
          error: 'Unprocessable Entity', 
          message: 'The request was well-formed but contains semantic errors',
          timestamp: new Date().toISOString(),
          validation_errors: [
            { field: 'email', message: 'Invalid email format' },
            { field: 'phone', message: 'Phone number is required' }
          ]
        });
        break;
      case 429:
        res.status(429).json({ 
          error: 'Too Many Requests', 
          message: 'Rate limit exceeded. Please try again later',
          timestamp: new Date().toISOString(),
          retry_after: 60
        });
        break;
      case 500:
        res.status(500).json({ 
          error: 'Internal Server Error', 
          message: 'An unexpected error occurred on the server',
          timestamp: new Date().toISOString()
        });
        break;
      case 502:
        res.status(502).json({ 
          error: 'Bad Gateway', 
          message: 'The server received an invalid response from upstream',
          timestamp: new Date().toISOString()
        });
        break;
      case 503:
        res.status(503).json({ 
          error: 'Service Unavailable', 
          message: 'The server is temporarily unavailable',
          timestamp: new Date().toISOString()
        });
        break;
      case 504:
        res.status(504).json({ 
          error: 'Gateway Timeout', 
          message: 'The server did not receive a timely response from upstream',
          timestamp: new Date().toISOString()
        });
        break;
      default:
        res.status(200).json({ 
          message: 'Test endpoint - no error generated', 
          requested_code: code,
          timestamp: new Date().toISOString()
        });
    }
  }, delay);
});

// Test endpoint that randomly returns different status codes
app.get('/api/test/random-error', (req, res) => {
  const errors = [200, 400, 401, 404, 422, 500, 502, 503];
  const randomCode = errors[Math.floor(Math.random() * errors.length)];
  
  if (randomCode === 200) {
    res.json({ 
      message: 'Random test successful', 
      code: randomCode,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(randomCode).json({ 
      error: `Random error ${randomCode}`, 
      message: `This is a randomly generated ${randomCode} error for testing`,
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint that simulates network timeouts (takes a long time to respond)
app.get('/api/test/timeout', (req, res) => {
  const timeout = parseInt(req.query.timeout) || 30000; // Default 30 seconds
  
  setTimeout(() => {
    res.json({ 
      message: 'Response after timeout simulation', 
      timeout_ms: timeout,
      timestamp: new Date().toISOString()
    });
  }, timeout);
});

// Test endpoint for successful requests with different response times
app.get('/api/test/performance', (req, res) => {
  const delay = parseInt(req.query.delay) || Math.floor(Math.random() * 2000); // Random up to 2 seconds
  
  setTimeout(() => {
    res.json({ 
      message: 'Performance test response', 
      delay_ms: delay,
      timestamp: new Date().toISOString(),
      data: {
        products_count: data.products.length,
        orders_count: data.orders.length,
        reservations_count: data.reservations.length
      }
    });
  }, delay);
});

// Add new logging endpoints for dynamic configuration
app.get('/api/logging/levels', (req, res) => {
  res.json(getLogLevels());
});

app.post('/api/logging/levels', (req, res) => {
  const { loggerName, level } = req.body;
  
  if (!loggerName || !level) {
    return res.status(400).json({ error: 'Logger name and level are required' });
  }
  
  const validLevels = ['error', 'warn', 'info', 'debug', 'trace'];
  if (!validLevels.includes(level.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid log level. Must be one of: ' + validLevels.join(', ') });
  }
  
  updateLogLevel(loggerName, level.toLowerCase());
  
  logBusinessEvent('log_level_changed', 'configure', {
    loggerName,
    level: level.toLowerCase()
  }, req);
  
  res.json({ 
    success: true, 
    message: `Log level for ${loggerName} updated to ${level.toLowerCase()}`,
    levels: getLogLevels()
  });
});

// Format configuration endpoints
app.get('/api/logging/formats', (req, res) => {
  res.json(getLogFormats());
});

app.post('/api/logging/formats', (req, res) => {
  const { loggerName, format } = req.body;
  
  if (!loggerName || !format) {
    return res.status(400).json({ error: 'Logger name and format are required' });
  }
  
  const validFormats = ['json', 'clf', 'string', 'csv', 'xml'];
  if (!validFormats.includes(format.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid log format. Must be one of: ' + validFormats.join(', ') });
  }
  
  const validLoggers = ['access', 'event', 'metrics', 'error', 'performance', 'app'];
  if (!validLoggers.includes(loggerName)) {
    return res.status(400).json({ error: 'Invalid logger name. Must be one of: ' + validLoggers.join(', ') });
  }
  
  updateLogFormat(loggerName, format.toLowerCase());
  
  logBusinessEvent('log_format_changed', 'configure', {
    loggerName,
    format: format.toLowerCase()
  }, req);
  
  res.json({ 
    success: true, 
    message: `Log format for ${loggerName} updated to ${format.toLowerCase()}`,
    formats: getLogFormats()
  });
});

// Log beacon endpoint for client-side logs
app.post('/api/log-beacon', (req, res) => {
  try {
    const logFile = req.body.get('logFile');
    const filePath = req.body.get('filePath') || '/tmp/codeuser/client.log';
    const loggerType = req.body.get('loggerType') || 'client';
    
    if (logFile) {
      const logContent = logFile.stream ? logFile.stream.read() : logFile;
      
      // Write to appropriate log file
      fs.appendFileSync(filePath.replace('/logs/', '/tmp/codeuser/'), logContent);
      
      appLogger.debug('Client log received via beacon', {
        loggerType,
        filePath,
        size: logContent.length
      });
    }
    
    res.status(204).send(); // No content response for beacon
  } catch (error) {
    appLogger.error('Error processing log beacon', { error: error.message });
    res.status(500).json({ error: 'Failed to process log beacon' });
  }
});

// Failure Simulation API Endpoints
app.post('/api/simulate/failure', (req, res) => {
  try {
    const { scenario, duration } = req.body;
    
    if (!scenario) {
      return res.status(400).json({ error: 'Scenario is required' });
    }
    
    if (!duration || duration < 10 || duration > 300) {
      return res.status(400).json({ 
        error: 'Duration must be between 10 and 300 seconds' 
      });
    }
    
    const validScenarios = ['connection_pool', 'payment_gateway', 'memory_leak', 'cascading_failure', 'data_corruption'];
    if (!validScenarios.includes(scenario)) {
      return res.status(400).json({ 
        error: 'Invalid scenario',
        validScenarios 
      });
    }
    
    // Log the failure simulation request
    appLogger.warn('Failure simulation requested', {
      requestId: req.requestId,
      scenario,
      duration,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    const result = startFailure(scenario, duration, data);
    
    if (result.success) {
      logBusinessEvent('failure_simulation_started', 'start', {
        scenario,
        duration,
        simulatedFailure: true
      }, req);
      
      res.json({
        success: true,
        message: 'Failure simulation started',
        ...result
      });
    } else {
      res.status(409).json(result);
    }
    
  } catch (error) {
    appLogger.error('Error starting failure simulation', {
      requestId: req.requestId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Failed to start failure simulation',
      details: error.message
    });
  }
});

app.get('/api/simulate/status', (req, res) => {
  try {
    const status = getFailureStatus();
    res.json(status);
  } catch (error) {
    appLogger.error('Error getting failure status', {
      requestId: req.requestId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get failure status' });
  }
});

app.post('/api/simulate/stop', (req, res) => {
  try {
    const result = stopFailure(data);
    
    if (result.success) {
      logBusinessEvent('failure_simulation_stopped', 'stop', {
        scenario: result.scenario,
        runTime: result.runTime,
        simulatedFailure: true
      }, req);
      
      appLogger.info('Failure simulation stopped manually', {
        requestId: req.requestId,
        scenario: result.scenario,
        runTime: result.runTime
      });
      
      res.json({
        success: true,
        message: 'Failure simulation stopped',
        ...result
      });
    } else {
      res.status(409).json(result);
    }
    
  } catch (error) {
    appLogger.error('Error stopping failure simulation', {
      requestId: req.requestId,
      error: error.message
    });
    res.status(500).json({ 
      error: 'Failed to stop failure simulation',
      details: error.message 
    });
  }
});

// Agent Configuration Management Endpoints

// Get all available configurations from file
app.get('/api/agents/configurations', (req, res) => {
  try {
    const configPath = '/app/agents-config.json';
    
    if (fs.existsSync(configPath)) {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      res.json({
        configurations: configData.configurations || {},
        defaultConfig: configData.defaultConfig || null,
        hasFileConfig: true
      });
    } else {
      res.json({
        configurations: {},
        defaultConfig: null,
        hasFileConfig: false
      });
    }
  } catch (error) {
    console.error('Error reading agents configuration:', error);
    res.status(500).json({ 
      error: 'Failed to read agent configurations',
      hasFileConfig: false 
    });
  }
});

// Get the currently active configuration
app.get('/api/agents/active-config', (req, res) => {
  try {
    // Read from localStorage equivalent (could be enhanced to use a database)
    const mezmoConfig = {
      enabled: false,
      ingestionKey: '',
      host: 'logs.mezmo.com',
      tags: 'restaurant-app,demo'
    };
    
    const otelConfig = {
      enabled: false,
      serviceName: 'restaurant-app',
      tags: 'restaurant-app,otel',
      pipelines: {
        logs: { enabled: false, ingestionKey: '', pipelineId: '', host: 'logs.mezmo.com' },
        metrics: { enabled: false, ingestionKey: '', pipelineId: '', host: 'logs.mezmo.com' },
        traces: { enabled: false, ingestionKey: '', pipelineId: '', host: 'logs.mezmo.com' }
      }
    };
    
    res.json({
      activeConfig: 'custom',
      configuration: {
        mezmo: mezmoConfig,
        otel: otelConfig
      }
    });
  } catch (error) {
    console.error('Error getting active configuration:', error);
    res.status(500).json({ error: 'Failed to get active configuration' });
  }
});

// Apply a specific configuration from the file
app.post('/api/agents/apply-config/:configName', (req, res) => {
  try {
    const { configName } = req.params;
    const configPath = '/app/agents-config.json';
    
    if (!fs.existsSync(configPath)) {
      return res.status(404).json({ error: 'No configuration file found' });
    }
    
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (!configData.configurations || !configData.configurations[configName]) {
      return res.status(404).json({ error: `Configuration '${configName}' not found` });
    }
    
    const config = configData.configurations[configName];
    
    // Here you would typically save the configuration to persistent storage
    // For now, we'll just return success
    
    res.json({
      message: `Configuration '${configName}' applied successfully`,
      configuration: config
    });
  } catch (error) {
    console.error('Error applying configuration:', error);
    res.status(500).json({ error: 'Failed to apply configuration' });
  }
});

// Save current configuration as a custom preset
app.post('/api/agents/save-custom', (req, res) => {
  try {
    const { name, configuration } = req.body;
    
    if (!name || !configuration) {
      return res.status(400).json({ error: 'Name and configuration are required' });
    }
    
    // In a production environment, you'd save this to a database or file
    // For now, we'll just return success
    
    res.json({
      message: `Custom configuration '${name}' saved successfully`
    });
  } catch (error) {
    console.error('Error saving custom configuration:', error);
    res.status(500).json({ error: 'Failed to save custom configuration' });
  }
});

// ========== VIRTUAL TRAFFIC CONTROL ENDPOINTS ==========

// Initialize TrafficManager lazily
let trafficManager = null;
async function getTrafficManager() {
  if (!trafficManager) {
    try {
      const { TrafficManager } = await import('./services/virtualTraffic/trafficManager.js');
      trafficManager = TrafficManager.getInstance();
      console.log('🚦 TrafficManager initialized for API endpoints');
    } catch (error) {
      console.error('❌ Failed to initialize TrafficManager:', error);
      throw error;
    }
  }
  return trafficManager;
}

// Start virtual traffic
app.post('/api/traffic/start', async (req, res) => {
  try {
    const manager = await getTrafficManager();
    const config = req.body || {};
    
    // Update config and start
    manager.updateConfig({ ...config, enabled: true });
    
    res.json({
      message: 'Virtual traffic started successfully',
      config: manager.getConfig(),
      status: manager.getDetailedStatus()
    });
  } catch (error) {
    console.error('Error starting virtual traffic:', error);
    res.status(500).json({ error: 'Failed to start virtual traffic' });
  }
});

// Stop virtual traffic
app.post('/api/traffic/stop', async (req, res) => {
  try {
    const manager = await getTrafficManager();
    manager.updateConfig({ enabled: false });
    
    res.json({
      message: 'Virtual traffic stopped successfully',
      config: manager.getConfig(),
      status: manager.getDetailedStatus()
    });
  } catch (error) {
    console.error('Error stopping virtual traffic:', error);
    res.status(500).json({ error: 'Failed to stop virtual traffic' });
  }
});

// Update traffic configuration
app.post('/api/traffic/config', async (req, res) => {
  try {
    const manager = await getTrafficManager();
    const newConfig = req.body;
    
    manager.updateConfig(newConfig);
    
    res.json({
      message: 'Traffic configuration updated successfully',
      config: manager.getConfig(),
      status: manager.getDetailedStatus()
    });
  } catch (error) {
    console.error('Error updating traffic config:', error);
    res.status(500).json({ error: 'Failed to update traffic configuration' });
  }
});

// Get current traffic status
app.get('/api/traffic/status', async (req, res) => {
  try {
    const manager = await getTrafficManager();
    
    res.json({
      config: manager.getConfig(),
      stats: manager.getStats(),
      detailed: manager.getDetailedStatus()
    });
  } catch (error) {
    console.error('Error getting traffic status:', error);
    res.status(500).json({ error: 'Failed to get traffic status' });
  }
});

// Get real-time activity feed for the UI
app.get('/api/traffic/activities', async (req, res) => {
  try {
    const manager = await getTrafficManager();
    const detailed = manager.getDetailedStatus();
    
    res.json({
      activeUsers: detailed.activeUsers,
      recentlyCompleted: detailed.recentlyCompleted,
      stats: detailed.stats
    });
  } catch (error) {
    console.error('Error getting traffic activities:', error);
    res.status(500).json({ error: 'Failed to get traffic activities' });
  }
});

// Get traffic configuration (for initialization)
app.get('/api/traffic/config', async (req, res) => {
  try {
    const manager = await getTrafficManager();
    
    res.json({
      config: manager.getConfig()
    });
  } catch (error) {
    console.error('Error getting traffic config:', error);
    res.status(500).json({ error: 'Failed to get traffic configuration' });
  }
});

// Structured error handling middleware
app.use(errorLoggingMiddleware);

// =============================================================================
// CONFIGURATION MANAGEMENT API - Replace localStorage with server-side storage
// =============================================================================

const configManager = ConfigManager.getInstance();

// Get configuration by type
app.get('/api/config/:type', (req, res) => {
  try {
    const { type } = req.params;
    const config = configManager.getConfig(type);
    
    res.json({
      success: true,
      config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    appLogger.error('Error getting configuration', {
      requestId: req.requestId,
      configType: req.params.type,
      error: error.message
    });
    
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Set configuration by type
app.post('/api/config/:type', (req, res) => {
  try {
    const { type } = req.params;
    const config = configManager.setConfig(type, req.body);
    
    appLogger.info('Configuration updated', {
      requestId: req.requestId,
      configType: type,
      config: config
    });
    
    res.json({
      success: true,
      config,
      message: `${type} configuration updated successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    appLogger.error('Error setting configuration', {
      requestId: req.requestId,
      configType: req.params.type,
      error: error.message,
      requestBody: req.body
    });
    
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get all configurations
app.get('/api/config', (req, res) => {
  try {
    const configs = configManager.getAllConfigs();
    
    res.json({
      success: true,
      configs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    appLogger.error('Error getting all configurations', {
      requestId: req.requestId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve configurations',
      timestamp: new Date().toISOString()
    });
  }
});

// Reset configuration by type
app.delete('/api/config/:type', (req, res) => {
  try {
    const { type } = req.params;
    const config = configManager.resetConfig(type);
    
    appLogger.info('Configuration reset', {
      requestId: req.requestId,
      configType: type
    });
    
    res.json({
      success: true,
      config,
      message: `${type} configuration reset to defaults`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    appLogger.error('Error resetting configuration', {
      requestId: req.requestId,
      configType: req.params.type,
      error: error.message
    });
    
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================================================
// CLIENT LOG COLLECTION API - Replace localStorage logging with server storage
// =============================================================================

// Create log file writers for client logs
import path from 'path';

// Ensure log directory exists
const logDir = '/tmp/codeuser';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Write log to disk and memory buffer
function writeClientLog(logType, logEntry) {
  try {
    // Add to memory buffer for quick access
    configManager.addLogToBuffer(logType, logEntry);
    
    // Write to disk for Mezmo Agent pickup
    const logFile = path.join(logDir, `client-${logType}.log`);
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(logFile, logLine);
    
    return true;
  } catch (error) {
    console.error(`Error writing ${logType} log:`, error);
    return false;
  }
}

// Receive client performance logs
app.post('/api/logs/performance', (req, res) => {
  try {
    const logs = Array.isArray(req.body) ? req.body : [req.body];
    let successCount = 0;
    
    logs.forEach(logEntry => {
      // Ensure required fields
      if (!logEntry.timestamp) {
        logEntry.timestamp = new Date().toISOString();
      }
      
      if (writeClientLog('performance', logEntry)) {
        successCount++;
      }
    });
    
    res.json({
      success: true,
      processed: logs.length,
      successful: successCount,
      message: `${successCount}/${logs.length} performance logs written to disk`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    appLogger.error('Error processing client performance logs', {
      requestId: req.requestId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to process performance logs',
      timestamp: new Date().toISOString()
    });
  }
});

// Receive client event logs
app.post('/api/logs/events', (req, res) => {
  try {
    const logs = Array.isArray(req.body) ? req.body : [req.body];
    let successCount = 0;
    
    logs.forEach(logEntry => {
      // Ensure required fields
      if (!logEntry.timestamp) {
        logEntry.timestamp = new Date().toISOString();
      }
      
      if (writeClientLog('events', logEntry)) {
        successCount++;
      }
    });
    
    res.json({
      success: true,
      processed: logs.length,
      successful: successCount,
      message: `${successCount}/${logs.length} event logs written to disk`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    appLogger.error('Error processing client event logs', {
      requestId: req.requestId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to process event logs',
      timestamp: new Date().toISOString()
    });
  }
});

// Receive client trace logs
app.post('/api/logs/traces', (req, res) => {
  try {
    const logs = Array.isArray(req.body) ? req.body : [req.body];
    let successCount = 0;
    
    logs.forEach(logEntry => {
      // Ensure required fields
      if (!logEntry.timestamp) {
        logEntry.timestamp = new Date().toISOString();
      }
      
      if (writeClientLog('traces', logEntry)) {
        successCount++;
      }
    });
    
    res.json({
      success: true,
      processed: logs.length,
      successful: successCount,
      message: `${successCount}/${logs.length} trace logs written to disk`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    appLogger.error('Error processing client trace logs', {
      requestId: req.requestId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to process trace logs',
      timestamp: new Date().toISOString()
    });
  }
});

// Get recent logs from memory buffer (for debugging/UI)
app.get('/api/logs/recent/:type', (req, res) => {
  try {
    const { type } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const logs = configManager.getRecentLogs(type, limit);
    
    res.json({
      success: true,
      type,
      count: logs.length,
      logs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    appLogger.error('Error getting recent logs', {
      requestId: req.requestId,
      logType: req.params.type,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve recent logs',
      timestamp: new Date().toISOString()
    });
  }
});

// Get log buffer statistics
app.get('/api/logs/stats', (req, res) => {
  try {
    const stats = configManager.getBufferStats();
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    appLogger.error('Error getting log statistics', {
      requestId: req.requestId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve log statistics',
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================================================
// SESSION MANAGEMENT API - Replace localStorage auth with server sessions
// =============================================================================

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Simple auth check (same as client-side)
    if (username === 'admin' && password === 'password') {
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      configManager.createSession(sessionId, {
        username,
        loginTime: new Date(),
        isAuthenticated: true
      });
      
      res.json({
        success: true,
        sessionId,
        message: 'Login successful',
        timestamp: new Date().toISOString()
      });
      
      appLogger.info('User logged in', {
        requestId: req.requestId,
        sessionId,
        username
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        timestamp: new Date().toISOString()
      });
      
      appLogger.warn('Failed login attempt', {
        requestId: req.requestId,
        username
      });
    }
  } catch (error) {
    appLogger.error('Error during login', {
      requestId: req.requestId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Login failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Check session status
app.get('/api/auth/status', (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!sessionId) {
      return res.json({
        success: true,
        isAuthenticated: false,
        message: 'No session ID provided',
        timestamp: new Date().toISOString()
      });
    }
    
    const session = configManager.getSession(sessionId);
    
    if (session && session.isAuthenticated) {
      res.json({
        success: true,
        isAuthenticated: true,
        session: {
          username: session.username,
          loginTime: session.createdAt,
          lastAccess: session.lastAccess
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: true,
        isAuthenticated: false,
        message: 'Invalid or expired session',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    appLogger.error('Error checking auth status', {
      requestId: req.requestId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to check authentication status',
      timestamp: new Date().toISOString()
    });
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (sessionId) {
      const destroyed = configManager.destroySession(sessionId);
      
      if (destroyed) {
        appLogger.info('User logged out', {
          requestId: req.requestId,
          sessionId
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    appLogger.error('Error during logout', {
      requestId: req.requestId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Get system status (including config manager stats)
app.get('/api/system/status', (req, res) => {
  try {
    const status = configManager.getSystemStatus();
    
    res.json({
      success: true,
      system: {
        ...status,
        serverUptime: process.uptime(),
        serverMemory: process.memoryUsage(),
        nodeVersion: process.version
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    appLogger.error('Error getting system status', {
      requestId: req.requestId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get system status',
      timestamp: new Date().toISOString()
    });
  }
});

// Final error handler
app.use((err, req, res, next) => {
  // Winston logging is handled by errorLoggingMiddleware
  // This is just the final response handler
  if (!res.headersSent) {
    res.status(500).json({ 
      error: 'Internal server error',
      requestId: req.requestId || 'unknown',
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================================================
// REAL USER ACTIVITY TRACKING API - Rich Logging Like Virtual Users
// =============================================================================

// Import performance logger for consistent logging format
import PerformanceLogger from './services/virtualTraffic/performanceLogger.js';

// Import simulator manager for cart checkout and stress test simulators
import SimulatorManager from './services/simulators/simulatorManager.js';

// Import configuration manager
import ConfigManager from './services/configManager.js';

// Create user session tracking
const userSessions = new Map(); // sessionId -> { userId, startTime, lastActivity, customerProfile }

// Generate user session ID
function generateUserSessionId() {
  return `real-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// User session initialization
app.post('/api/track/session/start', async (req, res) => {
  try {
    const sessionId = generateUserSessionId();
    const { userAgent, viewport, language, timezone } = req.body;
    
    const performanceLogger = new PerformanceLogger();
    
    // Create user session tracking
    const sessionData = {
      sessionId,
      userId: `real-user-${sessionId}`,
      startTime: Date.now(),
      lastActivity: Date.now(),
      browserFingerprint: {
        userAgent: userAgent || req.get('User-Agent'),
        language: language || 'en-US',
        viewport: viewport || { width: 1920, height: 1080 },
        timezone: timezone || 'America/New_York'
      },
      performanceLogger,
      interactions: 0,
      pageViews: 0
    };
    
    userSessions.set(sessionId, sessionData);
    
    // Log session start using same format as virtual users
    performanceLogger.logSensitiveCustomerData({
      fullName: 'Real User',
      firstName: 'Real',
      lastName: 'User',
      email: 'real.user@example.com',
      phone: '000-000-0000',
      address: { street: 'Unknown', city: 'Unknown', state: 'Unknown', zipCode: '00000' },
      creditCard: { number: '0000000000000000', type: 'unknown', expiryMonth: '00', expiryYear: '00', cvv: '000', holderName: 'Real User' },
      sensitiveData: { ssn: '000-00-0000', driversLicense: 'UNKNOWN', bankAccount: { routingNumber: '000000000', accountNumber: '0000000000' } }
    }, 'real_user_session_started');
    
    console.log(`🧑 Real user session started: ${sessionId}`);
    
    res.json({ 
      sessionId,
      message: 'Session tracking started',
      userId: sessionData.userId
    });
  } catch (error) {
    console.error('Error starting user session:', error);
    res.status(500).json({ error: 'Failed to start session tracking' });
  }
});

// User interaction tracking (clicks, hovers, etc.)
app.post('/api/track/interaction', async (req, res) => {
  try {
    const { sessionId, interactionType, element, duration, metadata } = req.body;
    
    if (!sessionId || !userSessions.has(sessionId)) {
      return res.status(400).json({ error: 'Invalid or missing session ID' });
    }
    
    const session = userSessions.get(sessionId);
    session.lastActivity = Date.now();
    session.interactions++;
    
    // Log interaction using same format as virtual users
    session.performanceLogger.logUserInteraction(
      interactionType || 'click',
      element || 'unknown-element',
      duration || 0
    );
    
    console.log(`🖱️ Real user ${session.userId} ${interactionType}: ${element}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking interaction:', error);
    res.status(500).json({ error: 'Failed to track interaction' });
  }
});

// Page navigation tracking
app.post('/api/track/navigation', async (req, res) => {
  try {
    const { sessionId, fromPath, toPath, loadTime } = req.body;
    
    if (!sessionId || !userSessions.has(sessionId)) {
      return res.status(400).json({ error: 'Invalid or missing session ID' });
    }
    
    const session = userSessions.get(sessionId);
    session.lastActivity = Date.now();
    session.pageViews++;
    
    // Log navigation using same format as virtual users
    session.performanceLogger.logUserInteraction(
      'navigate',
      `page-${toPath}`,
      loadTime || 0
    );
    
    console.log(`🔄 Real user ${session.userId} navigated: ${fromPath} → ${toPath}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking navigation:', error);
    res.status(500).json({ error: 'Failed to track navigation' });
  }
});

// Cart action tracking
app.post('/api/track/cart', async (req, res) => {
  try {
    const { sessionId, action, productId, productName, quantity, price, cartTotal } = req.body;
    
    if (!sessionId || !userSessions.has(sessionId)) {
      return res.status(400).json({ error: 'Invalid or missing session ID' });
    }
    
    const session = userSessions.get(sessionId);
    session.lastActivity = Date.now();
    
    // Log cart action using same format as virtual users
    session.performanceLogger.logCartAction(
      action || 'add',
      productId || 'unknown',
      productName || 'Unknown Product',
      quantity || 1,
      cartTotal || 0,
      0 // duration
    );
    
    console.log(`🛒 Real user ${session.userId} ${action}: ${quantity}x ${productName} (cart total: ${cartTotal})`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking cart action:', error);
    res.status(500).json({ error: 'Failed to track cart action' });
  }
});

// Customer profile capture (when user enters personal info)
app.post('/api/track/customer-profile', async (req, res) => {
  try {
    const { sessionId, customerData } = req.body;
    
    if (!sessionId || !userSessions.has(sessionId)) {
      return res.status(400).json({ error: 'Invalid or missing session ID' });
    }
    
    const session = userSessions.get(sessionId);
    session.lastActivity = Date.now();
    session.customerProfile = customerData;
    
    // Log customer profile with sensitive data using same format as virtual users
    session.performanceLogger.logSensitiveCustomerData(customerData, 'real_user_profile_captured');
    
    console.log(`👤 Real user ${session.userId} profile captured: ${customerData.fullName}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking customer profile:', error);
    res.status(500).json({ error: 'Failed to track customer profile' });
  }
});

// Payment attempt tracking
app.post('/api/track/payment', async (req, res) => {
  try {
    const { sessionId, paymentData, customerData, transactionData, status } = req.body;
    
    if (!sessionId || !userSessions.has(sessionId)) {
      return res.status(400).json({ error: 'Invalid or missing session ID' });
    }
    
    const session = userSessions.get(sessionId);
    session.lastActivity = Date.now();
    
    // Log payment attempt using same format as virtual users
    session.performanceLogger.logPaymentAttempt(
      paymentData,
      customerData || session.customerProfile,
      transactionData,
      status || 'initiated',
      0 // duration
    );
    
    console.log(`💳 Real user ${session.userId} payment ${status}: $${transactionData?.amount || 0}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking payment:', error);
    res.status(500).json({ error: 'Failed to track payment' });
  }
});

// Reservation tracking
app.post('/api/track/reservation', async (req, res) => {
  try {
    const { sessionId, reservationData } = req.body;
    
    if (!sessionId || !userSessions.has(sessionId)) {
      return res.status(400).json({ error: 'Invalid or missing session ID' });
    }
    
    const session = userSessions.get(sessionId);
    session.lastActivity = Date.now();
    
    // Log reservation using same format as virtual users
    session.performanceLogger.logReservationData(
      session.customerProfile || {
        fullName: 'Real User',
        email: 'real.user@example.com',
        phone: '000-000-0000',
        sensitiveData: { ssn: '000-00-0000', driversLicense: 'UNKNOWN' }
      },
      reservationData
    );
    
    console.log(`📅 Real user ${session.userId} made reservation: ${reservationData.date} ${reservationData.time}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking reservation:', error);
    res.status(500).json({ error: 'Failed to track reservation' });
  }
});

// Form field focus/blur tracking
app.post('/api/track/form-interaction', async (req, res) => {
  try {
    const { sessionId, fieldName, action, value, duration } = req.body;
    
    if (!sessionId || !userSessions.has(sessionId)) {
      return res.status(400).json({ error: 'Invalid or missing session ID' });
    }
    
    const session = userSessions.get(sessionId);
    session.lastActivity = Date.now();
    
    // Log form interaction using same format as virtual users
    if (action === 'focus') {
      console.log(`📝 Real user ${session.userId} focused: ${fieldName}`);
    } else if (action === 'blur') {
      console.log(`📤 Real user ${session.userId} completed: ${fieldName}`);
    }
    
    session.performanceLogger.logUserInteraction(action, fieldName, duration || 0);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking form interaction:', error);
    res.status(500).json({ error: 'Failed to track form interaction' });
  }
});

// Session end tracking
app.post('/api/track/session/end', async (req, res) => {
  try {
    const { sessionId, reason } = req.body;
    
    if (!sessionId || !userSessions.has(sessionId)) {
      return res.status(400).json({ error: 'Invalid or missing session ID' });
    }
    
    const session = userSessions.get(sessionId);
    const sessionDuration = Date.now() - session.startTime;
    
    console.log(`✅ Real user ${session.userId} session ended (${Math.round(sessionDuration / 1000)}s) - ${reason || 'unknown'}`);
    
    // Clean up session
    userSessions.delete(sessionId);
    
    res.json({ 
      success: true,
      sessionDuration: sessionDuration,
      totalInteractions: session.interactions,
      totalPageViews: session.pageViews
    });
  } catch (error) {
    console.error('Error ending user session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Get active real user sessions (for monitoring)
app.get('/api/track/sessions', async (req, res) => {
  try {
    const activeSessions = Array.from(userSessions.values()).map(session => ({
      sessionId: session.sessionId,
      userId: session.userId,
      startTime: session.startTime,
      lastActivity: session.lastActivity,
      duration: Date.now() - session.startTime,
      interactions: session.interactions,
      pageViews: session.pageViews,
      customerName: session.customerProfile?.fullName || 'Unknown'
    }));
    
    res.json({
      activeSessions: activeSessions.length,
      sessions: activeSessions
    });
  } catch (error) {
    console.error('Error getting active sessions:', error);
    res.status(500).json({ error: 'Failed to get active sessions' });
  }
});

// =============================================================================
// SIMULATOR API ENDPOINTS - Cart Checkout & Stress Test Simulators
// =============================================================================

// Initialize simulator manager
const simulatorManager = SimulatorManager.getInstance();

// Cart Checkout Simulator APIs
app.post('/api/simulator/cart-checkout/start', async (req, res) => {
  try {
    const config = req.body || {};
    console.log(`🚀 Starting Cart Checkout Simulator with config: ${JSON.stringify(config)}`);
    
    await simulatorManager.startCartCheckoutSimulator(config);
    
    res.json({ 
      success: true,
      message: 'Cart Checkout Simulator started',
      status: simulatorManager.getCartCheckoutStatus()
    });
  } catch (error) {
    console.error('Error starting cart checkout simulator:', error);
    res.status(500).json({ error: 'Failed to start cart checkout simulator' });
  }
});

app.post('/api/simulator/cart-checkout/stop', (req, res) => {
  try {
    console.log('🛑 Stopping Cart Checkout Simulator');
    simulatorManager.stopCartCheckoutSimulator();
    
    res.json({ 
      success: true,
      message: 'Cart Checkout Simulator stopped',
      status: simulatorManager.getCartCheckoutStatus()
    });
  } catch (error) {
    console.error('Error stopping cart checkout simulator:', error);
    res.status(500).json({ error: 'Failed to stop cart checkout simulator' });
  }
});

app.get('/api/simulator/cart-checkout/status', (req, res) => {
  try {
    const status = simulatorManager.getCartCheckoutStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting cart checkout status:', error);
    res.status(500).json({ error: 'Failed to get cart checkout status' });
  }
});

app.post('/api/simulator/cart-checkout/config', (req, res) => {
  try {
    const config = req.body || {};
    console.log(`🔧 Updating Cart Checkout Simulator config: ${JSON.stringify(config)}`);
    
    simulatorManager.updateCartCheckoutConfig(config);
    
    res.json({ 
      success: true,
      message: 'Cart Checkout Simulator config updated',
      config: simulatorManager.getCartCheckoutStatus().config
    });
  } catch (error) {
    console.error('Error updating cart checkout config:', error);
    res.status(500).json({ error: 'Failed to update cart checkout config' });
  }
});

// Stress Test Simulator APIs
app.post('/api/simulator/stress-test/start', async (req, res) => {
  try {
    const config = req.body || {};
    console.log(`🚀 Starting Stress Test Simulator with config: ${JSON.stringify(config)}`);
    
    await simulatorManager.startStressTestSimulator(config);
    
    res.json({ 
      success: true,
      message: 'Stress Test Simulator started',
      status: simulatorManager.getStressTestStatus()
    });
  } catch (error) {
    console.error('Error starting stress test simulator:', error);
    res.status(500).json({ error: 'Failed to start stress test simulator' });
  }
});

app.post('/api/simulator/stress-test/stop', (req, res) => {
  try {
    console.log('🛑 Stopping Stress Test Simulator');
    simulatorManager.stopStressTestSimulator();
    
    res.json({ 
      success: true,
      message: 'Stress Test Simulator stopped',
      status: simulatorManager.getStressTestStatus()
    });
  } catch (error) {
    console.error('Error stopping stress test simulator:', error);
    res.status(500).json({ error: 'Failed to stop stress test simulator' });
  }
});

app.get('/api/simulator/stress-test/status', (req, res) => {
  try {
    const status = simulatorManager.getStressTestStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting stress test status:', error);
    res.status(500).json({ error: 'Failed to get stress test status' });
  }
});

app.get('/api/simulator/stress-test/detailed-stats', (req, res) => {
  try {
    const stats = simulatorManager.getStressTestDetailedStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting stress test detailed stats:', error);
    res.status(500).json({ error: 'Failed to get stress test detailed stats' });
  }
});

app.post('/api/simulator/stress-test/config', (req, res) => {
  try {
    const config = req.body || {};
    console.log(`🔧 Updating Stress Test Simulator config: ${JSON.stringify(config)}`);
    
    simulatorManager.updateStressTestConfig(config);
    
    res.json({ 
      success: true,
      message: 'Stress Test Simulator config updated',
      config: simulatorManager.getStressTestStatus().config
    });
  } catch (error) {
    console.error('Error updating stress test config:', error);
    res.status(500).json({ error: 'Failed to update stress test config' });
  }
});

// Combined Simulator Management APIs
app.get('/api/simulator/status', (req, res) => {
  try {
    const status = simulatorManager.getAllSimulatorStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting simulator status:', error);
    res.status(500).json({ error: 'Failed to get simulator status' });
  }
});

app.get('/api/simulator/active', (req, res) => {
  try {
    const active = simulatorManager.getActiveSimulators();
    res.json(active);
  } catch (error) {
    console.error('Error getting active simulators:', error);
    res.status(500).json({ error: 'Failed to get active simulators' });
  }
});

app.post('/api/simulator/stop-all', (req, res) => {
  try {
    console.log('🛑 Stopping all simulators');
    simulatorManager.stopAllSimulators();
    
    res.json({ 
      success: true,
      message: 'All simulators stopped',
      status: simulatorManager.getAllSimulatorStatus()
    });
  } catch (error) {
    console.error('Error stopping all simulators:', error);
    res.status(500).json({ error: 'Failed to stop all simulators' });
  }
});

app.get('/api/simulator/stats', (req, res) => {
  try {
    const stats = simulatorManager.getSystemStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting system stats:', error);
    res.status(500).json({ error: 'Failed to get system stats' });
  }
});

app.get('/api/simulator/health', async (req, res) => {
  try {
    const health = await simulatorManager.healthCheck();
    res.json(health);
  } catch (error) {
    console.error('Error checking simulator health:', error);
    res.status(500).json({ error: 'Failed to check simulator health' });
  }
});

// Start server
app.listen(PORT, async () => {
  // Initialize order counter based on existing orders
  initializeOrderCounter();
  
  // Initialize OpenTelemetry SDK BEFORE starting virtual traffic
  const tracerProvider = await initializeOTEL();
  if (tracerProvider) {
    console.log('🔍 OpenTelemetry tracing enabled for backend and virtual users');
  } else {
    console.log('⚠️ OpenTelemetry tracing disabled - traces will not be generated');
  }
  
  appLogger.info('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    pid: process.pid,
    logLevels: getLogLevels(),
    nextOrderNumber: orderCounter.toString().padStart(7, '0'),
    otelEnabled: !!tracerProvider
  });
  
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`📊 Logging levels:`, getLogLevels());
  console.log(`📝 Next order number: #${orderCounter.toString().padStart(7, '0')}`);
  
  // Log server startup as business event
  logBusinessEvent('server_started', 'startup', {
    port: PORT,
    timestamp: new Date().toISOString()
  });

  // Also log to server operational log
  serverLogger.info('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    pid: process.pid,
    logLevels: getLogLevels(),
    timestamp: new Date().toISOString()
  });

  // Auto-start virtual traffic for demo-friendly experience
  if (process.env.DISABLE_AUTO_TRAFFIC !== 'true') {
    try {
      console.log('🎭 Auto-starting virtual traffic for demo...');
      const manager = await getTrafficManager();
      const config = manager.getConfig();
      
      if (config.enabled) {
        manager.start();
        console.log(`✅ Virtual traffic started with ${config.targetConcurrentUsers} users (${config.journeyPattern} behavior, ${config.trafficTiming} timing)`);
        console.log('💡 Orders will start appearing in the Orders page within minutes');
        console.log(`⚙️  Configure virtual traffic at: http://localhost:${PORT}/agents`);
      }
    } catch (error) {
      console.warn('⚠️  Failed to auto-start virtual traffic:', error.message);
      console.log('💡 You can manually start virtual traffic from the Virtual Users page');
    }
  } else {
    console.log('🚫 Auto-traffic disabled via DISABLE_AUTO_TRAFFIC environment variable');
  }
});