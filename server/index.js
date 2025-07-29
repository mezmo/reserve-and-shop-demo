import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { execSync, spawn } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// In-memory data store (simulating a database)
let data = {
  products: [
    {
      id: '1',
      name: 'Margherita Pizza',
      description: 'Fresh tomato sauce, mozzarella, and basil',
      price: 18.99,
      category: 'Pizza',
      image: '/placeholder.svg',
      available: true
    },
    {
      id: '2',
      name: 'Caesar Salad',
      description: 'Crisp romaine lettuce with parmesan and croutons',
      price: 14.99,
      category: 'Salads',
      image: '/placeholder.svg',
      available: true
    },
    {
      id: '3',
      name: 'Grilled Salmon',
      description: 'Atlantic salmon with lemon herb seasoning',
      price: 28.99,
      category: 'Main Course',
      image: '/placeholder.svg',
      available: true
    },
    {
      id: '4',
      name: 'Chocolate Brownie',
      description: 'Warm chocolate brownie with vanilla ice cream',
      price: 8.99,
      category: 'Desserts',
      image: '/placeholder.svg',
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
  const product = {
    id: Date.now().toString(),
    ...req.body
  };
  data.products.push(product);
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

app.post('/api/orders', (req, res) => {
  // Validate required fields
  const { customerName, customerEmail, items } = req.body;
  if (!customerName || !customerEmail || !items || items.length === 0) {
    return res.status(400).json({ 
      error: 'Missing required fields: customerName, customerEmail, and items are required' 
    });
  }

  const order = {
    id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...req.body,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };
  
  data.orders.push(order);
  res.status(201).json(order);
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

app.post('/api/reservations', (req, res) => {
  // Validate required fields
  const { name, email, date, time, guests } = req.body;
  if (!name || !email || !date || !time || !guests) {
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// LogDNA Agent Management
app.get('/api/mezmo/status', (req, res) => {
  try {
    // Check if agent is running
    const pidFile = '/tmp/codeuser/logdna-agent.pid';
    const configFile = '/etc/logdna/logdna.env';
    
    let status = 'disconnected';
    let pid = null;
    let hasConfig = false;
    
    if (fs.existsSync(configFile)) {
      hasConfig = true;
    }
    
    if (fs.existsSync(pidFile)) {
      try {
        pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
        // Check if PID is still running
        process.kill(pid, 0); // This throws if process doesn't exist
        status = 'connected';
      } catch (error) {
        // Process not running, clean up stale PID file
        fs.unlinkSync(pidFile);
        status = 'disconnected';
        pid = null;
      }
    }
    
    res.json({
      status,
      pid,
      hasConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking LogDNA status:', error);
    res.status(500).json({ error: 'Failed to check LogDNA status' });
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
    
    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Create environment file with both LOGDNA_ and MZ_ prefixed variables
    const endpointPath = '/logs/ingest';
    const envContent = `
# LOGDNA_ prefixed variables (legacy)
LOGDNA_INGESTION_KEY=${ingestionKey}
LOGDNA_HOST=${host || 'logs.mezmo.com'}
LOGDNA_DB_PATH=/var/lib/logdna
LOGDNA_LOG_DIRS=/tmp/codeuser
LOGDNA_LOOKBACK=start
LOGDNA_LOG_LEVEL=info

# MZ_ prefixed variables (required by LogDNA Agent v2)
MZ_INGESTION_KEY=${ingestionKey}
MZ_ENDPOINT=${endpointPath}
MZ_DB_PATH=/var/lib/logdna
MZ_LOG_DIRS=/tmp/codeuser
MZ_LOOKBACK=start
MZ_LOG_LEVEL=info
MZ_HOSTNAME=restaurant-app-container
MZ_BODY_SIZE=2097152
`.trim();
    
    // Create YAML configuration
    const yamlContent = `
http:
  endpoint: ${endpointPath}
  host: ${host || 'logs.mezmo.com'}
  timeout: 30000
  use_ssl: true
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
      - "/tmp/codeuser/*.log"
      - "/tmp/codeuser/restaurant-performance.log"
      - "/tmp/codeuser/app.log"
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
    
    res.json({
      success: true,
      message: 'LogDNA configuration saved',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error configuring LogDNA:', error);
    res.status(500).json({ error: 'Failed to configure LogDNA agent' });
  }
});

app.post('/api/mezmo/start', (req, res) => {
  try {
    // Check if already running
    const pidFile = '/tmp/codeuser/logdna-agent.pid';
    if (fs.existsSync(pidFile)) {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
      try {
        process.kill(pid, 0);
        return res.json({ message: 'LogDNA agent is already running', pid });
      } catch (error) {
        // Process not running, clean up
        fs.unlinkSync(pidFile);
      }
    }
    
    // Start the agent
    const logFile = '/tmp/codeuser/logdna-agent.log';
    const envFile = '/etc/logdna/logdna.env';
    
    if (!fs.existsSync(envFile)) {
      return res.status(400).json({ error: 'LogDNA not configured. Please configure first.' });
    }
    
    // Source environment variables and start agent
    const startCommand = `
set -a
source ${envFile}
set +a
nohup /usr/bin/logdna-agent > ${logFile} 2>&1 & echo $! > ${pidFile}
`;
    
    execSync(startCommand, { shell: '/bin/bash' });
    
    // Give it a moment to start
    setTimeout(() => {
      if (fs.existsSync(pidFile)) {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
        console.log('✅ LogDNA agent started with PID:', pid);
        res.json({ 
          success: true,
          message: 'LogDNA agent started', 
          pid,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({ error: 'Failed to start LogDNA agent' });
      }
    }, 1000);
    
  } catch (error) {
    console.error('Error starting LogDNA agent:', error);
    res.status(500).json({ error: 'Failed to start LogDNA agent' });
  }
});

app.post('/api/mezmo/stop', (req, res) => {
  try {
    const pidFile = '/tmp/codeuser/logdna-agent.pid';
    
    if (!fs.existsSync(pidFile)) {
      return res.json({ message: 'LogDNA agent is not running' });
    }
    
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
    
    try {
      process.kill(pid, 'SIGTERM');
      fs.unlinkSync(pidFile);
      console.log('🛑 LogDNA agent stopped');
      res.json({ 
        success: true,
        message: 'LogDNA agent stopped',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Process might already be dead
      fs.unlinkSync(pidFile);
      res.json({ message: 'LogDNA agent was not running' });
    }
  } catch (error) {
    console.error('Error stopping LogDNA agent:', error);
    res.status(500).json({ error: 'Failed to stop LogDNA agent' });
  }
});

app.get('/api/mezmo/logs', (req, res) => {
  try {
    const logFile = '/tmp/codeuser/logdna-agent.log';
    
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
    console.error('Error reading LogDNA logs:', error);
    res.status(500).json({ error: 'Failed to read LogDNA logs' });
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});