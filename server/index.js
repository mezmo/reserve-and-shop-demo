import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { execSync, spawn } from 'child_process';
import yaml from 'js-yaml';
import { loggingMiddleware, errorLoggingMiddleware, logBusinessEvent, logPerformanceTiming } from './middleware/logging-middleware.js';
import { appLogger, updateLogLevel, getLogLevels } from './logging/winston-config.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Structured logging middleware (replaces basic console logging)
app.use(loggingMiddleware);

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

app.post('/api/orders', (req, res) => {
  const startTime = Date.now();
  
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

  const order = {
    id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...req.body,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };
  
  data.orders.push(order);
  
  // Calculate order total for business metrics
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Log business event
  logBusinessEvent('order_created', 'create', {
    orderId: order.id,
    customerEmail: customerEmail,
    itemCount: items.length,
    value: total,
    unit: 'USD'
  }, req);
  
  const duration = Date.now() - startTime;
  logPerformanceTiming('order_processing', duration, 'orders', { orderId: order.id, itemCount: items.length }, req);
  
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
  const startTime = Date.now();
  
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
    
    // Safely check if config file exists
    try {
      if (fs.existsSync(configFile)) {
        hasConfig = true;
      }
    } catch (configError) {
      console.warn('Error checking config file:', configError);
      hasConfig = false;
    }
    
    // Safely check PID file and process status
    try {
      if (fs.existsSync(pidFile)) {
        const pidContent = fs.readFileSync(pidFile, 'utf8').trim();
        pid = parseInt(pidContent);
        
        if (!isNaN(pid)) {
          // Check if PID is still running
          process.kill(pid, 0); // This throws if process doesn't exist
          status = 'connected';
        } else {
          // Invalid PID in file, clean up
          fs.unlinkSync(pidFile);
          status = 'disconnected';
          pid = null;
        }
      }
    } catch (pidError) {
      // Process not running or other error, clean up stale PID file
      try {
        if (fs.existsSync(pidFile)) {
          fs.unlinkSync(pidFile);
        }
      } catch (cleanupError) {
        console.warn('Error cleaning up PID file:', cleanupError);
      }
      status = 'disconnected';
      pid = null;
    }
    
    const response = {
      status,
      pid,
      hasConfig,
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

app.post('/api/mezmo/start', (req, res) => {
  try {
    const pidFile = '/tmp/codeuser/logdna-agent.pid';
    const logFile = '/tmp/codeuser/logdna-agent.log';
    const envFile = '/etc/logdna/logdna.env';
    
    // Check if already running
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
      // Source environment variables and start agent
      // Note: LogDNA agent might need elevated privileges
      const startCommand = `
set -a
source ${envFile}
set +a
nohup /usr/bin/logdna-agent > ${logFile} 2>&1 & echo $! > ${pidFile}
`;
      
      execSync(startCommand, { shell: '/bin/bash' });
      
      // Give it a moment to start and verify
      setTimeout(() => {
        // Check if response hasn't been sent yet
        if (res.headersSent) {
          return; // Response already sent, nothing to do
        }
        
        if (fs.existsSync(pidFile)) {
          const pidContent = fs.readFileSync(pidFile, 'utf8').trim();
          const pid = parseInt(pidContent);
          
          if (!isNaN(pid)) {
            try {
              // Check if process is actually running
              process.kill(pid, 0);
              console.log('✅ LogDNA agent started with PID:', pid);
              return res.json({ 
                success: true,
                message: 'LogDNA agent started successfully', 
                pid,
                timestamp: new Date().toISOString()
              });
            } catch (killError) {
              // Process not running
              return res.status(500).json({ 
                error: 'LogDNA agent failed to start',
                details: 'Process started but is not running. Check logs for details.'
              });
            }
          } else {
            return res.status(500).json({ 
              error: 'Invalid PID in pid file',
              details: `PID file contains: ${pidContent}`
            });
          }
        } else {
          return res.status(500).json({ 
            error: 'Failed to start LogDNA agent',
            details: 'PID file was not created. Check if the binary exists and has proper permissions.'
          });
        }
      }, 1000);
      
    } catch (execError) {
      return res.status(500).json({ 
        error: 'Failed to execute start command',
        details: execError.message
      });
    }
    
  } catch (error) {
    console.error('Error starting LogDNA agent:', error);
    return res.status(500).json({ 
      error: 'Failed to start LogDNA agent',
      details: error.message
    });
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
    
    if (!fs.existsSync(logFile)) {
      return res.json({ 
        logs: 'No logs available',
        timestamp: new Date().toISOString()
      });
    }
    
    const logs = fs.readFileSync(logFile, 'utf8');
    const lines = logs.split('\n').slice(-50); // Last 50 lines
    
    res.json({ 
      logs: lines.join('\n'),
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
      ? `https://pipeline.mezmo.com/v1/${logsPipelineId}`
      : `https://${logsHost || 'logs.mezmo.com'}`;

    console.log('   📄 Logs Pipeline:');
    console.log('     Endpoint:', logsEndpoint);
    console.log('     Pipeline ID:', logsPipelineId || 'Legacy');

    // File receiver for structured logs
    config.receivers.filelog = {
      include: [
        '/tmp/codeuser/access.log',
        '/tmp/codeuser/events.log', 
        '/tmp/codeuser/performance.log',
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
      ? `https://pipeline.mezmo.com/v1/${metricsPipelineId}`
      : `https://${metricsHost || 'logs.mezmo.com'}`;

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
      ? `https://pipeline.mezmo.com/v1/${tracesPipelineId}`
      : `https://${tracesHost || 'logs.mezmo.com'}`;

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
          endpoint: '0.0.0.0:4318'
        }
      }
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
      exporters: ['otlphttp/traces']
    };
  }

  console.log('   ✅ Multi-pipeline configuration generated');
  return config;
};

app.get('/api/otel/status', (req, res) => {
  try {
    // Check if collector is running
    const pidFile = '/tmp/codeuser/otel-collector.pid';
    const configFile = '/etc/otelcol/config.yaml';
    
    let status = 'disconnected';
    let pid = null;
    let hasConfig = false;
    let enabledPipelines = { logs: false, metrics: false, traces: false };
    
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
        }
      } catch (error) {
        console.warn('Could not parse OTEL config:', error);
      }
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
      enabledPipelines,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking OTEL status:', error);
    res.status(500).json({ error: 'Failed to check OTEL Collector status' });
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
      lastError: null
    };
    
    // Extract relevant metrics using regex (accounting for labels)
    const logsSentMatch = metricsText.match(/otelcol_exporter_sent_log_records_total\{[^}]*exporter="otlphttp\/logs"[^}]*\}\s+(\d+)/);
    const metricsCollectedMatch = metricsText.match(/otelcol_exporter_sent_metric_points_total\{[^}]*exporter="otlphttp\/metrics"[^}]*\}\s+(\d+)/);
    const tracesReceivedMatch = metricsText.match(/otelcol_exporter_sent_spans_total\{[^}]*exporter="otlphttp\/traces"[^}]*\}\s+(\d+)/);
    const errorsMatch = metricsText.match(/otelcol_exporter_send_failed_log_records_total\{[^}]*\}\s+(\d+)/);
    
    if (logsSentMatch) stats.logsSent = parseInt(logsSentMatch[1]);
    if (metricsCollectedMatch) stats.metricsCollected = parseInt(metricsCollectedMatch[1]);
    if (tracesReceivedMatch) stats.tracesReceived = parseInt(tracesReceivedMatch[1]);
    if (errorsMatch) stats.errors = parseInt(errorsMatch[1]);
    
    res.json(stats);
    
  } catch (error) {
    console.error('Error fetching OTEL metrics:', error);
    res.json({
      logsSent: 0,
      metricsCollected: 0,
      tracesReceived: 0,
      errors: 0,
      lastError: error.message
    });
  }
});

app.post('/api/otel/configure', (req, res) => {
  try {
    const { 
      serviceName, 
      tags,
      debugLevel,
      // Multi-pipeline parameters
      logsEnabled, logsIngestionKey, logsPipelineId, logsHost,
      metricsEnabled, metricsIngestionKey, metricsPipelineId, metricsHost,
      tracesEnabled, tracesIngestionKey, tracesPipelineId, tracesHost
    } = req.body;
    
    // Validate that at least one pipeline is enabled with a key
    const hasValidLogs = logsEnabled && logsIngestionKey;
    const hasValidMetrics = metricsEnabled && metricsIngestionKey;
    const hasValidTraces = tracesEnabled && tracesIngestionKey;
    
    if (!hasValidLogs && !hasValidMetrics && !hasValidTraces) {
      return res.status(400).json({ 
        error: 'At least one pipeline must be enabled with a valid ingestion key' 
      });
    }
    
    const configDir = '/etc/otelcol';
    const configFile = `${configDir}/config.yaml`;
    
    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Generate dynamic multi-pipeline configuration
    const config = generateOTELConfig({
      serviceName: serviceName || 'restaurant-app',
      tags: tags || 'restaurant-app,otel',
      debugLevel: debugLevel || 'info',
      // Logs pipeline
      logsEnabled: hasValidLogs,
      logsIngestionKey,
      logsPipelineId,
      logsHost: logsHost || 'logs.mezmo.com',
      // Metrics pipeline
      metricsEnabled: hasValidMetrics,
      metricsIngestionKey,
      metricsPipelineId,
      metricsHost: metricsHost || 'logs.mezmo.com',
      // Traces pipeline
      tracesEnabled: hasValidTraces,
      tracesIngestionKey,
      tracesPipelineId,
      tracesHost: tracesHost || 'logs.mezmo.com'
    });
    
    // Write configuration file
    const yamlContent = yaml.dump(config, { indent: 2 });
    fs.writeFileSync(configFile, yamlContent);
    
    console.log('📊 Multi-Pipeline OpenTelemetry Collector configuration updated');
    console.log('   Logs Pipeline:', hasValidLogs ? `✅ ${logsPipelineId || 'Legacy'}` : '❌ Disabled');
    console.log('   Metrics Pipeline:', hasValidMetrics ? `✅ ${metricsPipelineId || 'Legacy'}` : '❌ Disabled');
    console.log('   Traces Pipeline:', hasValidTraces ? `✅ ${tracesPipelineId || 'Legacy'}` : '❌ Disabled');
    
    res.json({
      success: true,
      message: 'Multi-pipeline OTEL Collector configuration saved',
      enabledPipelines: { 
        logs: hasValidLogs, 
        metrics: hasValidMetrics, 
        traces: hasValidTraces 
      },
      pipelineDetails: {
        logs: hasValidLogs ? { pipelineId: logsPipelineId, host: logsHost } : null,
        metrics: hasValidMetrics ? { pipelineId: metricsPipelineId, host: metricsHost } : null,
        traces: hasValidTraces ? { pipelineId: tracesPipelineId, host: tracesHost } : null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error configuring OTEL Collector:', error);
    res.status(500).json({ error: 'Failed to configure OTEL Collector' });
  }
});

app.post('/api/otel/start', (req, res) => {
  try {
    // Check if already running
    const pidFile = '/tmp/codeuser/otel-collector.pid';
    if (fs.existsSync(pidFile)) {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
      try {
        process.kill(pid, 0);
        return res.json({ message: 'OTEL Collector is already running', pid });
      } catch (error) {
        // Process not running, clean up
        fs.unlinkSync(pidFile);
      }
    }
    
    // Start the collector
    const logFile = '/tmp/codeuser/otel-collector.log';
    const configFile = '/etc/otelcol/config.yaml';
    
    if (!fs.existsSync(configFile)) {
      return res.status(400).json({ error: 'OTEL Collector not configured. Please configure first.' });
    }
    
    // Start collector
    const startCommand = `nohup /usr/local/bin/otelcol-contrib --config="${configFile}" > ${logFile} 2>&1 & echo $! > ${pidFile}`;
    
    execSync(startCommand, { shell: '/bin/bash' });
    
    // Give it a moment to start
    setTimeout(() => {
      if (fs.existsSync(pidFile)) {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
        console.log('✅ OTEL Collector started with PID:', pid);
        res.json({ 
          success: true,
          message: 'OTEL Collector started', 
          pid,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({ error: 'Failed to start OTEL Collector' });
      }
    }, 1000);
    
  } catch (error) {
    console.error('Error starting OTEL Collector:', error);
    res.status(500).json({ error: 'Failed to start OTEL Collector' });
  }
});

app.post('/api/otel/stop', (req, res) => {
  try {
    const pidFile = '/tmp/codeuser/otel-collector.pid';
    
    if (!fs.existsSync(pidFile)) {
      return res.json({ message: 'OTEL Collector is not running' });
    }
    
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
    
    try {
      process.kill(pid, 'SIGTERM');
      fs.unlinkSync(pidFile);
      console.log('🛑 OTEL Collector stopped');
      res.json({ 
        success: true,
        message: 'OTEL Collector stopped',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Process might already be dead
      fs.unlinkSync(pidFile);
      res.json({ message: 'OTEL Collector was not running' });
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
    message: `Log level for ${loggerName} updated to ${level}`,
    levels: getLogLevels()
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

// Structured error handling middleware
app.use(errorLoggingMiddleware);

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

// Start server
app.listen(PORT, () => {
  appLogger.info('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    pid: process.pid,
    logLevels: getLogLevels()
  });
  
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`📊 Logging levels:`, getLogLevels());
  
  // Log server startup as business event
  logBusinessEvent('server_started', 'startup', {
    port: PORT,
    timestamp: new Date().toISOString()
  });
});