import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { DataStore } from '@/stores/dataStore';
import PerformanceLogger from '@/lib/performanceLogger';
import { Download, Upload, RefreshCw, Settings, AlertTriangle, Activity, FileText, Monitor, Zap, Play, Square, Cloud, CloudOff, CheckCircle, XCircle, Eye, EyeOff, Info, ShoppingCart, Skull, StopCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePerformance } from '@/hooks/usePerformance';
import { useTestError, useTestRandomError, useTestTimeout, useTestPerformance, useHealthCheck } from '@/services/apiService';
import HttpClient from '@/lib/httpClient';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const Config = () => {
  const [importData, setImportData] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Stress test state
  const [stressTestRunning, setStressTestRunning] = useState(false);
  const [stressTestProgress, setStressTestProgress] = useState(0);
  const [stressTestDuration, setStressTestDuration] = useState(30);
  const [stressTestRPS, setStressTestRPS] = useState(5);
  const [stressTestConcurrent, setStressTestConcurrent] = useState(3);
  const [stressTestErrorRate, setStressTestErrorRate] = useState(20);
  const [stressTestStats, setStressTestStats] = useState({
    totalRequests: 0,
    successCount: 0,
    errorCount: 0,
    avgResponseTime: 0,
    timeRemaining: 0
  });

  // Sample order generation state
  const [sampleOrdersRunning, setSampleOrdersRunning] = useState(false);
  const [sampleOrdersProgress, setSampleOrdersProgress] = useState(0);
  const [sampleOrdersCount, setSampleOrdersCount] = useState(10);
  const [sampleOrdersDelay, setSampleOrdersDelay] = useState(2);
  const [sampleOrdersType, setSampleOrdersType] = useState<'random' | 'takeout' | 'delivery'>('random');
  const [sampleOrdersStats, setSampleOrdersStats] = useState({
    ordersCreated: 0,
    ordersSuccessful: 0,
    ordersFailed: 0,
    currentOrder: '',
    timeRemaining: 0
  });

  // Virtual traffic simulator state
  const [trafficEnabled, setTrafficEnabled] = useState(false);
  const [trafficTargetUsers, setTrafficTargetUsers] = useState(5);
  const [trafficPattern, setTrafficPattern] = useState<'mixed' | 'buyers' | 'browsers' | 'researchers'>('mixed');
  const [trafficTiming, setTrafficTiming] = useState<'steady' | 'normal' | 'peak' | 'low' | 'burst'>('steady');
  const [trafficStats, setTrafficStats] = useState({
    activeUsers: 0,
    totalSessionsToday: 0,
    averageSessionDuration: 0,
    currentActivities: [] as string[],
    totalOrders: 0,
    bounceRate: 0
  });

  // Mezmo configuration state
  const [mezmoEnabled, setMezmoEnabled] = useState(false);
  const [mezmoIngestionKey, setMezmoIngestionKey] = useState('');
  const [mezmoHost, setMezmoHost] = useState('logs.mezmo.com');
  const [mezmoTags, setMezmoTags] = useState('restaurant-app,demo');
  const [mezmoStatus, setMezmoStatus] = useState('disconnected'); // connected, disconnected, error
  const [mezmoPid, setMezmoPid] = useState<number | null>(null);
  const [mezmoLastSync, setMezmoLastSync] = useState<string | null>(null);
  const [mezmoStats, setMezmoStats] = useState({
    logsSent: 0,
    errors: 0,
    lastError: null as string | null
  });

  // OpenTelemetry Collector configuration state
  const [otelEnabled, setOtelEnabled] = useState(false);
  const [otelServiceName, setOtelServiceName] = useState('restaurant-app');
  const [otelTags, setOtelTags] = useState('restaurant-app,otel');
  const [otelDebugLevel, setOtelDebugLevel] = useState('info');
  
  // Multi-pipeline configuration - separate endpoints for each telemetry type
  const [otelPipelines, setOtelPipelines] = useState({
    logs: {
      enabled: true,
      ingestionKey: '',
      pipelineId: '',
      host: 'logs.mezmo.com',
      endpoint: '', // Will be auto-generated from pipelineId
      showKey: false
    },
    metrics: {
      enabled: true,
      ingestionKey: '',
      pipelineId: '',
      host: 'logs.mezmo.com',
      endpoint: '',
      showKey: false
    },
    traces: {
      enabled: false,
      ingestionKey: '',
      pipelineId: '',
      host: 'logs.mezmo.com',
      endpoint: '',
      showKey: false
    }
  });
  const [otelStatus, setOtelStatus] = useState('disconnected');
  const [otelPid, setOtelPid] = useState<number | null>(null);
  const [otelLastSync, setOtelLastSync] = useState<string | null>(null);
  const [otelStats, setOtelStats] = useState({
    logsSent: 0,
    metricsCollected: 0,
    tracesReceived: 0,
    errors: 0,
    lastError: null as string | null
  });
  const [otelLogs, setOtelLogs] = useState('');
  const [showOtelLogs, setShowOtelLogs] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Individual pipeline state setters for backward compatibility
  const [otelLogsEnabled, setOtelLogsEnabled] = useState(true);
  const [otelMetricsEnabled, setOtelMetricsEnabled] = useState(true);
  const [otelTracesEnabled, setOtelTracesEnabled] = useState(false);

  // Computed values for backward compatibility
  const otelIngestionKey = otelPipelines.logs.ingestionKey || otelPipelines.metrics.ingestionKey || otelPipelines.traces.ingestionKey;
  const otelHost = otelPipelines.logs.host || otelPipelines.metrics.host || otelPipelines.traces.host;
  const otelPipelineId = otelPipelines.logs.pipelineId || otelPipelines.metrics.pipelineId || otelPipelines.traces.pipelineId;
  
  const { toast } = useToast();
  const { getConfig, updateConfig, getSessionId, getStoredLogs, clearStoredLogs, flushLogs } = usePerformance();
  
  // Failure simulation state
  const [failureScenario, setFailureScenario] = useState('');
  const [failureDuration, setFailureDuration] = useState(60);
  const [failureActive, setFailureActive] = useState(false);
  const [failureStatus, setFailureStatus] = useState(null);
  const [showFailureDialog, setShowFailureDialog] = useState(false);
  
  // Failure scenario definitions
  const failureScenarios = [
    {
      id: 'connection_pool',
      name: 'Database Connection Pool Exhaustion',
      description: 'Exhausts database connection pool causing timeouts',
      impact: 'Orders and reservations will fail with 503 errors',
      icon: '🗄️',
      severity: 'high',
      defaultDuration: 60
    },
    {
      id: 'payment_gateway',
      name: 'Payment Gateway Failure',
      description: 'Simulates payment provider outage and timeouts',
      impact: 'All checkout attempts will fail with payment errors',
      icon: '💳',
      severity: 'high',
      defaultDuration: 45
    },
    {
      id: 'memory_leak',
      name: 'Memory Leak',
      description: 'Gradually consumes memory causing performance degradation',
      impact: 'All API calls will slow down progressively, may crash if not stopped',
      icon: '🧠',
      severity: 'critical',
      defaultDuration: 120
    },
    {
      id: 'cascading_failure',
      name: 'Cascading Service Failure',
      description: 'Progressive failure starting with products, spreading to all services',
      impact: 'Menu → Orders → Reservations will fail in sequence over 25 seconds',
      icon: '⛓️',
      severity: 'critical',
      defaultDuration: 30
    },
    {
      id: 'data_corruption',
      name: 'Data Corruption',
      description: 'Corrupts product and order data causing validation failures',
      impact: 'Orders will fail validation, incorrect prices displayed in UI',
      icon: '💀',
      severity: 'high',
      defaultDuration: 90
    }
  ];
  
  const performanceConfig = getConfig();
  
  // New structured logging configuration state
  const [loggingEnabled, setLoggingEnabled] = useState(true);

  // Sync PerformanceLogger with main logging toggle on mount
  useEffect(() => {
    const performanceLogger = PerformanceLogger.getInstance();
    performanceLogger.updateConfig({ enabled: loggingEnabled });
  }, [loggingEnabled]);
  const [loggerConfigs, setLoggerConfigs] = useState({
    access: { level: 'INFO', format: 'clf', enabled: true },
    event: { level: 'DEBUG', format: 'json', enabled: true },
    metrics: { level: 'INFO', format: 'json', enabled: true },
    error: { level: 'WARN', format: 'json', enabled: true }
  });

  // Define appropriate formats for each logger type
  const getAvailableFormats = (loggerType) => {
    switch (loggerType) {
      case 'access':
        return [
          { value: 'clf', label: 'CLF (Common Log Format)', description: 'Standard web server format' },
          { value: 'json', label: 'JSON (Structured)', description: 'Machine-readable structured data' }
        ];
      case 'event':
        return [
          { value: 'json', label: 'JSON (Structured)', description: 'Perfect for business events' },
          { value: 'csv', label: 'CSV (Spreadsheet)', description: 'Easy analysis in Excel/sheets' },
          { value: 'xml', label: 'XML (Markup)', description: 'Enterprise integration format' },
          { value: 'string', label: 'STRING (Human Readable)', description: 'Easy to read logs' }
        ];
      case 'metrics':
        return [
          { value: 'json', label: 'JSON (Structured)', description: 'Standard metrics format' },
          { value: 'csv', label: 'CSV (Spreadsheet)', description: 'Perfect for data analysis' },
          { value: 'string', label: 'STRING (Human Readable)', description: 'Easy to read metrics' }
        ];
      case 'error':
        return [
          { value: 'json', label: 'JSON (Structured)', description: 'Structured error data' },
          { value: 'string', label: 'STRING (Human Readable)', description: 'Easy to read errors' }
        ];
      default:
        return [
          { value: 'json', label: 'JSON (Structured)', description: 'Default structured format' }
        ];
    }
  };
  const [loggingAnalytics, setLoggingAnalytics] = useState(null);
  
  // HTTP testing mutations
  const testError = useTestError();
  const testRandomError = useTestRandomError();
  const testTimeout = useTestTimeout();
  const testPerformance = useTestPerformance();
  const { data: healthData, isLoading: healthLoading, error: healthError } = useHealthCheck();


  // Handlers for new logging configuration
  const handleLoggingToggle = (enabled) => {
    setLoggingEnabled(enabled);
    
    // Also sync with PerformanceLogger config to ensure CheckoutDialog logs work
    const performanceLogger = PerformanceLogger.getInstance();
    performanceLogger.updateConfig({ enabled });
    
    toast({
      title: enabled ? "Logging Enabled" : "Logging Disabled",
      description: enabled ? "All logging systems activated (including performance/payment logs)" : "All logging systems deactivated"
    });
  };

  const handleLoggerConfigChange = async (loggerType, key, value) => {
    // Store previous value for rollback
    const previousValue = loggerConfigs[loggerType]?.[key];
    
    setLoggerConfigs(prev => ({
      ...prev,
      [loggerType]: {
        ...prev[loggerType],
        [key]: value
      }
    }));

    try {
      // Send the configuration change to the server
      const endpoint = key === 'level' ? '/api/logging/levels' : '/api/logging/formats';
      const payload = key === 'level' 
        ? { loggerName: loggerType, level: value }
        : { loggerName: loggerType, format: value };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Logger Configuration Updated",
          description: `${loggerType} logger ${key} set to ${value} on server`
        });
      } else {
        throw new Error(result.error || 'Failed to update configuration');
      }
    } catch (error) {
      toast({
        title: "Configuration Update Failed",
        description: error.message,
        variant: "destructive"
      });
      
      // Revert the local state change on error
      setLoggerConfigs(prev => ({
        ...prev,
        [loggerType]: {
          ...prev[loggerType],
          [key]: previousValue
        }
      }));
    }
  };

  const handleRefreshAnalytics = () => {
    toast({
      title: "Analytics Refreshed",
      description: "Logging analytics have been updated"
    });
  };

  const handleClearAllLogs = () => {
    toast({
      title: "All Logs Cleared",
      description: "All stored logs have been cleared"
    });
  };

  const handleFlushAllLogs = () => {
    toast({
      title: "All Logs Flushed",
      description: "All buffered logs have been written to files"
    });
  };

  const handleExport = () => {
    const dataStore = DataStore.getInstance();
    const jsonData = dataStore.exportData();
    
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `restaurant-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    toast({
      title: "Data Exported",
      description: "Your restaurant data has been downloaded as a JSON file."
    });
  };

  const handleImport = () => {
    if (!importData.trim()) {
      toast({
        title: "No Data",
        description: "Please paste JSON data to import.",
        variant: "destructive"
      });
      return;
    }

    const dataStore = DataStore.getInstance();
    const success = dataStore.importData(importData);
    
    if (success) {
      setImportData('');
      toast({
        title: "Data Imported Successfully",
        description: "Your restaurant data has been restored from the JSON file."
      });
      // Refresh the page to show updated data
      window.location.reload();
    } else {
      toast({
        title: "Import Failed",
        description: "Invalid JSON format. Please check your data and try again.",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a JSON file.",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportData(content);
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    const dataStore = DataStore.getInstance();
    dataStore.resetData();
    toast({
      title: "Data Reset",
      description: "All data has been reset to default values."
    });
    // Refresh the page to show reset data
    window.location.reload();
  };

  const handleRefreshLocalStorage = () => {
    const dataStore = DataStore.getInstance();
    dataStore.refreshFromDefaults();
    toast({
      title: "Local Storage Refreshed",
      description: "All cached data has been refreshed with latest defaults."
    });
    // Refresh the page to show updated data
    window.location.reload();
  };

  const [summaryRefresh, setSummaryRefresh] = useState(0);

  const getCurrentDataSummary = () => {
    const dataStore = DataStore.getInstance();
    const data = dataStore.getAllData();
    return {
      products: data.products.length,
      reservations: data.reservations.length,
      orders: data.orders.length
    };
  };

  const summary = useMemo(() => getCurrentDataSummary(), [summaryRefresh]);

  const handlePerformanceConfigChange = (key: string, value: any) => {
    updateConfig({ [key]: value });
    toast({
      title: "Performance Settings Updated",
      description: `${key} has been ${value ? 'enabled' : 'disabled'}.`
    });
  };

  const handleDownloadPerformanceLogs = () => {
    const logs = getStoredLogs();
    if (logs.length === 0) {
      toast({
        title: "No Logs Available",
        description: "No performance logs found. Try navigating around the app first.",
        variant: "destructive"
      });
      return;
    }

    const logContent = logs.map(log => `${log.timestamp} - ${log.content} - Session: ${log.session}`).join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `performance-logs-${new Date().toISOString().split('T')[0]}.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    toast({
      title: "Performance Logs Downloaded",
      description: `Downloaded ${logs.length} log entries.`
    });
  };

  const handleClearPerformanceLogs = () => {
    clearStoredLogs();
    toast({
      title: "Performance Logs Cleared",
      description: "All stored performance logs have been cleared."
    });
  };

  const handleFlushLogs = async () => {
    try {
      await flushLogs();
      toast({
        title: "Logs Flushed",
        description: "Performance logs have been flushed to file system."
      });
    } catch (error) {
      toast({
        title: "Flush Failed",
        description: "Could not flush logs to file system.",
        variant: "destructive"
      });
    }
  };

  // HTTP error testing functions using real endpoints
  const handleTestError = async (statusCode: number, delay: number = 0) => {
    const httpClient = HttpClient.getInstance();
    
    try {
      // Map status codes to real endpoint calls that naturally produce those errors
      let response;
      
      switch (statusCode) {
        case 400:
          // Bad Request - POST with missing required fields
          response = await httpClient.post('/orders', {});
          break;
        case 401:
          // Unauthorized - Try to access a protected resource (simulate with invalid product update)
          response = await httpClient.put('/products/1', { price: 'invalid-price' });
          break;
        case 404:
          // Not Found - Try to get non-existent resource
          response = await httpClient.get('/products/999999');
          break;
        case 422:
          // Unprocessable Entity - POST with invalid data
          response = await httpClient.post('/reservations', { name: '', email: 'invalid-email' });
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          // For server errors, try an endpoint that might cause server issues
          // (Note: These won't actually produce server errors in our demo, but will be logged as attempts)
          response = await httpClient.get('/products/999999');
          break;
        default:
          // Default to 404 test
          response = await httpClient.get('/products/999999');
      }
      
      toast({
        title: "Test Successful",
        description: `Successfully handled ${statusCode} response. Check the performance logs.`
      });
    } catch (error: any) {
      toast({
        title: "HTTP Error Logged",
        description: `${error.status} ${error.statusText} - Error has been logged for analysis.`,
        variant: "destructive"
      });
    }
  };

  const handleTestRandomError = async () => {
    const httpClient = HttpClient.getInstance();
    
    // Array of real endpoint calls that can produce various errors
    const errorCalls = [
      () => httpClient.get('/products/999999'),              // 404
      () => httpClient.get('/orders/invalid-id'),            // 404
      () => httpClient.get('/reservations/fake-res'),        // 404
      () => httpClient.post('/orders', {}),                  // 400 - missing fields
      () => httpClient.post('/reservations', { incomplete: 'data' }), // 400 - missing fields
    ];
    
    try {
      const randomCall = errorCalls[Math.floor(Math.random() * errorCalls.length)];
      await randomCall();
      
      toast({
        title: "Random Test Successful",
        description: "Random test completed successfully. Check the performance logs."
      });
    } catch (error: any) {
      toast({
        title: "Random HTTP Error Logged",
        description: `${error.status} ${error.statusText} - Error has been logged for analysis.`,
        variant: "destructive"
      });
    }
  };

  const handleTestTimeout = async () => {
    const httpClient = HttpClient.getInstance();
    
    try {
      // Set a very short timeout on a real endpoint to force a timeout
      await httpClient.get('/products', { timeout: 1 }); // 1ms timeout will likely timeout
      
      toast({
        title: "Timeout Test Successful",
        description: "Timeout test completed successfully."
      });
    } catch (error: any) {
      toast({
        title: "Timeout Error Logged",
        description: "Timeout error has been logged for analysis.",
        variant: "destructive"
      });
    }
  };

  const handleTestPerformance = async () => {
    const httpClient = HttpClient.getInstance();
    const startTime = performance.now();
    
    
    try {
      // Make multiple real API calls to test performance
      await Promise.all([
        httpClient.get('/products'),
        httpClient.get('/orders'),
        httpClient.get('/reservations'),
        httpClient.get('/settings')
      ]);
      
      const endTime = performance.now();
      const totalTime = Math.round(endTime - startTime);
      
      
      toast({
        title: "Performance Test Complete",
        description: `4 concurrent API calls completed in ${totalTime}ms. Check structured logs for details.`
      });
    } catch (error: any) {
      const totalTime = Math.round(performance.now() - startTime);
      
      
      toast({
        title: "Performance Test Failed",
        description: "Performance test failed. Error has been logged to structured logs.",
        variant: "destructive"
      });
    }
  };

  // Stress test engine
  const stressTestIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stressTestStartTime = useRef<number>(0);
  const stressTestRequestCounts = useRef({ total: 0, success: 0, error: 0, responseTimes: [] as number[] });

  // Sample order generation engine
  const sampleOrdersIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sampleOrdersStartTime = useRef<number>(0);
  const sampleOrdersCounts = useRef({ created: 0, successful: 0, failed: 0 });

  const handleStartSampleOrders = async () => {
    setSampleOrdersRunning(true);
    setSampleOrdersProgress(0);
    sampleOrdersStartTime.current = Date.now();
    sampleOrdersCounts.current = { created: 0, successful: 0, failed: 0 };

    // Check if tracing is enabled
    const tracingEnabled = localStorage.getItem('otel-config') && 
                          JSON.parse(localStorage.getItem('otel-config') || '{}').enabled &&
                          JSON.parse(localStorage.getItem('otel-config') || '{}').pipelines?.traces?.enabled;

    const generateOrder = async () => {
      if (sampleOrdersCounts.current.created >= sampleOrdersCount) {
        handleStopSampleOrders();
        return;
      }

      try {
        const customer = generateRandomCustomer();
        const paymentInfo = generateRandomPaymentInfo();
        const orderData = generateRandomOrder(customer, sampleOrdersType);

        // Create order using DataStore (like CheckoutDialog does)
        const dataStore = DataStore.getInstance();
        const order = {
          id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ...orderData,
          status: 'pending' as const,
          createdAt: new Date().toISOString()
        };

        let orderSpan = null;
        
        if (tracingEnabled) {
          // Create tracing for sample order generation
          const { trace } = await import('@opentelemetry/api');
          const tracer = trace.getTracer('sample-order-generator', '1.0.0');
          
          orderSpan = tracer.startSpan('sample_order_generation', {
            attributes: {
              'order.id': order.id,
              'order.type': order.type,
              'customer.name': customer.name,
              'order.total_amount': order.totalAmount,
              'generator.type': 'automated',
              'generator.batch_id': `batch-${sampleOrdersStartTime.current}`
            }
          });
        }

        // Get performance logger for payment logging
        const performanceLogger = PerformanceLogger.getInstance();
        const paymentStartTime = Date.now();

        // Add tracing event
        if (orderSpan) {
          orderSpan.addEvent('payment_initiated', {
            'payment.method': 'credit_card',
            'payment.card_type': paymentInfo.cardNumber.startsWith('4') ? 'visa' : 'mastercard'
          });
        }

        // Log payment initiation (like CheckoutDialog does)
        performanceLogger.logPaymentAttempt(
          paymentInfo,
          customer,
          {
            orderId: order.id,
            amount: order.totalAmount,
            currency: 'USD',
            orderType: order.type,
            traceId: orderSpan?.spanContext().traceId,
            spanId: orderSpan?.spanContext().spanId
          },
          'initiated'
        );

        // Simulate payment processing time
        const processingTime = Math.random() * 1500 + 500;
        await new Promise(resolve => setTimeout(resolve, processingTime));

        if (orderSpan) {
          orderSpan.addEvent('payment_processing', {
            'processing.duration_ms': processingTime
          });
        }

        // Log payment processing
        performanceLogger.logPaymentAttempt(
          paymentInfo,
          customer,
          {
            orderId: order.id,
            amount: order.totalAmount,
            currency: 'USD',
            orderType: order.type,
            traceId: orderSpan?.spanContext().traceId,
            spanId: orderSpan?.spanContext().spanId
          },
          'processing'
        );

        // Simulate additional processing time
        const additionalProcessingTime = Math.random() * 300 + 50;
        await new Promise(resolve => setTimeout(resolve, additionalProcessingTime));

        // Randomly simulate payment failures (10% chance)
        const paymentEndTime = Date.now();
        const paymentFailed = Math.random() < 0.1;

        if (paymentFailed) {
          if (orderSpan) {
            const { SpanStatusCode } = await import('@opentelemetry/api');
            orderSpan.addEvent('payment_failed', {
              'error.code': 'payment_declined',
              'error.message': 'Card declined',
              'payment.total_duration_ms': paymentEndTime - paymentStartTime
            });
            orderSpan.setStatus({ 
              code: SpanStatusCode.ERROR,
              message: 'Payment failed'
            });
          }

          // Log failed payment
          performanceLogger.logPaymentAttempt(
            paymentInfo,
            customer,
            {
              orderId: order.id,
              amount: order.totalAmount,
              currency: 'USD',
              orderType: order.type,
              traceId: orderSpan?.spanContext().traceId,
              spanId: orderSpan?.spanContext().spanId
            },
            'failed',
            paymentEndTime - paymentStartTime
          );

          sampleOrdersCounts.current.failed++;
        } else {
          if (orderSpan) {
            const { SpanStatusCode } = await import('@opentelemetry/api');
            orderSpan.addEvent('payment_success', {
              'order.created': true,
              'payment.total_duration_ms': paymentEndTime - paymentStartTime
            });
            orderSpan.setStatus({ code: SpanStatusCode.OK });
          }

          // Log successful payment
          performanceLogger.logPaymentAttempt(
            paymentInfo,
            customer,
            {
              orderId: order.id,
              amount: order.totalAmount,
              currency: 'USD',
              orderType: order.type,
              traceId: orderSpan?.spanContext().traceId,
              spanId: orderSpan?.spanContext().spanId
            },
            'success',
            paymentEndTime - paymentStartTime
          );

          // Save order to both API and client-side store (like real checkout does)
          try {
            const response = await fetch('/api/orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(order)
            });
            
            if (!response.ok) {
              throw new Error(`API Error: ${response.status}`);
            }
            
            console.log(`✅ Sample order ${order.id} successfully posted to /api/orders`);
          } catch (apiError) {
            console.error(`❌ Failed to post sample order to API:`, apiError);
            // Still add to local store even if API fails
          }
          
          dataStore.addOrder(order);

          // Trigger summary refresh
          setSummaryRefresh(prev => prev + 1);

          sampleOrdersCounts.current.successful++;
        }

        sampleOrdersCounts.current.created++;
        setSampleOrdersProgress((sampleOrdersCounts.current.created / sampleOrdersCount) * 100);
        setSampleOrdersStats({
          created: sampleOrdersCounts.current.created,
          successful: sampleOrdersCounts.current.successful,
          failed: sampleOrdersCounts.current.failed,
        });

        // End tracing span
        if (orderSpan) {
          orderSpan.end();
        }

      } catch (error) {
        // Handle tracing for unexpected errors
        if (orderSpan) {
          orderSpan.recordException(error as Error);
          orderSpan.addEvent('order_generation_failed', {
            'error.message': (error as Error).message
          });
          const { SpanStatusCode } = await import('@opentelemetry/api');
          orderSpan.setStatus({ 
            code: SpanStatusCode.ERROR,
            message: (error as Error).message
          });
          orderSpan.end();
        }

        sampleOrdersCounts.current.failed++;
        sampleOrdersCounts.current.created++;
        setSampleOrdersProgress((sampleOrdersCounts.current.created / sampleOrdersCount) * 100);
        setSampleOrdersStats({
          created: sampleOrdersCounts.current.created,
          successful: sampleOrdersCounts.current.successful,
          failed: sampleOrdersCounts.current.failed,
        });
      }
    };

    sampleOrdersIntervalRef.current = setInterval(generateOrder, sampleOrdersDelay);
  };

  const handleStopSampleOrders = () => {
    setSampleOrdersRunning(false);
    if (sampleOrdersIntervalRef.current) {
      clearInterval(sampleOrdersIntervalRef.current);
      sampleOrdersIntervalRef.current = null;
    }
  };

  const getRandomEndpoint = (errorRate: number) => {
    const shouldError = Math.random() * 100 < errorRate;
    
    if (shouldError) {
      // Real endpoints that can naturally return errors
      const errorEndpoints = [
        { endpoint: 'products', id: '999999' },      // Non-existent product -> 404
        { endpoint: 'orders', id: 'invalid-id' },    // Invalid order ID -> 404
        { endpoint: 'reservations', id: 'fake-res' }, // Non-existent reservation -> 404
        { endpoint: 'products', method: 'PUT', body: { invalid: 'data' } }, // Invalid update -> 400
        { endpoint: 'orders', method: 'POST', body: {} }, // Missing required fields -> 400
        { endpoint: 'reservations', method: 'POST', body: { incomplete: 'data' } } // Missing fields -> 400
      ];
      const randomError = errorEndpoints[Math.floor(Math.random() * errorEndpoints.length)];
      return { type: 'error', ...randomError };
    } else {
      // Only real endpoints that return successful responses
      const successEndpoints = [
        'health',           // GET /api/health
        'products',         // GET /api/products
        'orders',           // GET /api/orders
        'reservations',     // GET /api/reservations
        'settings'          // GET /api/settings
      ];
      const randomEndpoint = successEndpoints[Math.floor(Math.random() * successEndpoints.length)];
      return { type: 'success', endpoint: randomEndpoint };
    }
  };

  const makeStressTestRequest = async (endpoint: any) => {
    const startTime = performance.now();
    const httpClient = HttpClient.getInstance();
    
    try {
      if (endpoint.type === 'error') {
        // Handle real endpoint errors using actual API calls
        const { endpoint: ep, id, method, body } = endpoint;
        
        if (id) {
          // GET requests to non-existent resources
          await httpClient.get(`/${ep}/${id}`);
        } else if (method === 'POST') {
          // POST requests with invalid/incomplete data
          await httpClient.post(`/${ep}`, body);
        } else if (method === 'PUT') {
          // PUT requests with invalid data
          await httpClient.put(`/${ep}/1`, body);
        }
      } else {
        // Handle successful real endpoint requests
        switch (endpoint.endpoint) {
          case 'health':
            await httpClient.get('/health');
            break;
          case 'products':
            await httpClient.get('/products');
            break;
          case 'orders':
            await httpClient.get('/orders');
            break;
          case 'reservations':
            await httpClient.get('/reservations');
            break;
          case 'settings':
            await httpClient.get('/settings');
            break;
          default:
            await httpClient.get('/health');
        }
      }
      
      const responseTime = performance.now() - startTime;
      stressTestRequestCounts.current.success++;
      stressTestRequestCounts.current.responseTimes.push(responseTime);
      
      
    } catch (error) {
      const responseTime = performance.now() - startTime;
      stressTestRequestCounts.current.error++;
      stressTestRequestCounts.current.responseTimes.push(responseTime);
      
    }
    
    stressTestRequestCounts.current.total++;
  };

  const handleStartStressTest = async () => {
    if (stressTestRunning) return;
    
    // Reset counters
    stressTestRequestCounts.current = { total: 0, success: 0, error: 0, responseTimes: [] };
    setStressTestStats({
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      timeRemaining: stressTestDuration
    });
    
    setStressTestRunning(true);
    setStressTestProgress(0);
    stressTestStartTime.current = Date.now();
    
    // Traditional API stress test logic
    const intervalMs = 1000 / stressTestRPS; // Convert RPS to interval
    
    stressTestIntervalRef.current = setInterval(async () => {
      const elapsed = (Date.now() - stressTestStartTime.current) / 1000;
      const progress = Math.min((elapsed / stressTestDuration) * 100, 100);
      const timeRemaining = Math.max(stressTestDuration - elapsed, 0);
      
      setStressTestProgress(progress);
      
      // Update real-time stats
      const avgResponseTime = stressTestRequestCounts.current.responseTimes.length > 0
        ? stressTestRequestCounts.current.responseTimes.reduce((a, b) => a + b, 0) / stressTestRequestCounts.current.responseTimes.length
        : 0;
      
      setStressTestStats({
        totalRequests: stressTestRequestCounts.current.total,
        successCount: stressTestRequestCounts.current.success,
        errorCount: stressTestRequestCounts.current.error,
        avgResponseTime: Math.round(avgResponseTime),
        timeRemaining: Math.round(timeRemaining)
      });
      
      if (elapsed >= stressTestDuration) {
        handleStopStressTest();
        return;
      }
      
      // Make concurrent requests
      const promises = [];
      for (let i = 0; i < stressTestConcurrent; i++) {
        const endpoint = getRandomEndpoint(stressTestErrorRate);
        promises.push(makeStressTestRequest(endpoint));
      }
      
      // Fire and forget - don't await to maintain rate
      Promise.allSettled(promises);
      
    }, intervalMs);
    
    toast({
      title: "Stress Test Started",
      description: `Running for ${stressTestDuration}s at ${stressTestRPS} RPS with ${stressTestConcurrent} concurrent requests.`
    });
  };

  const handleStopStressTest = () => {
    if (stressTestIntervalRef.current) {
      clearInterval(stressTestIntervalRef.current);
      stressTestIntervalRef.current = null;
    }
    
    setStressTestRunning(false);
    setStressTestProgress(100);
    
    const { total, success, error } = stressTestRequestCounts.current;
    const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : '0';
    const avgResponseTime = stressTestRequestCounts.current.responseTimes.length > 0
      ? stressTestRequestCounts.current.responseTimes.reduce((a, b) => a + b, 0) / stressTestRequestCounts.current.responseTimes.length
      : 0;
    
    
    toast({
      title: "Stress Test Complete",
      description: `${total} requests sent. ${successRate}% success rate. Check structured logs for details.`
    });
  };

  // Sample order generation functions
  const generateRandomCustomer = () => {
    const firstNames = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Oliver', 'Sophia', 'Elijah', 'Charlotte', 'William', 'Amelia', 'James', 'Isabella', 'Benjamin', 'Mia', 'Lucas', 'Harper', 'Henry', 'Evelyn', 'Alexander'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
    const emailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'protonmail.com'];
    
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const domain = emailDomains[Math.floor(Math.random() * emailDomains.length)];
    const randomNum = Math.floor(Math.random() * 999) + 1;
    
    // Generate realistic phone number
    const areaCode = Math.floor(Math.random() * 900) + 100;
    const exchange = Math.floor(Math.random() * 900) + 100;
    const number = Math.floor(Math.random() * 9000) + 1000;
    
    return {
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomNum}@${domain}`,
      phone: `+1 (${areaCode}) ${exchange}-${number}`
    };
  };

  const generateRandomPaymentInfo = () => {
    const cardHolders = ['Emma Smith', 'John Doe', 'Sarah Johnson', 'Michael Brown', 'Lisa Davis', 'David Wilson', 'Emily Taylor', 'Chris Anderson', 'Jessica Martinez', 'Ryan Thompson'];
    // Test credit card numbers that pass validation
    const testCards = ['4532015112830366', '4556737586899855', '4916592289993918', '4024007120251892'];
    
    const currentYear = new Date().getFullYear();
    const expiryMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const expiryYear = String(currentYear + Math.floor(Math.random() * 5) + 1).slice(-2);
    
    return {
      cardNumber: testCards[Math.floor(Math.random() * testCards.length)],
      expiryDate: `${expiryMonth}/${expiryYear}`,
      cvv: String(Math.floor(Math.random() * 900) + 100),
      cardHolderName: cardHolders[Math.floor(Math.random() * cardHolders.length)]
    };
  };

  const generateRandomOrder = (customer: any, orderType: string) => {
    const dataStore = DataStore.getInstance();
    const availableProducts = dataStore.getProducts().filter(p => p.available);
    
    if (availableProducts.length === 0) {
      throw new Error('No available products to create orders');
    }
    
    // Generate 1-4 random items
    const itemCount = Math.floor(Math.random() * 4) + 1;
    const selectedProducts = [];
    const usedProductIds = new Set();
    
    for (let i = 0; i < itemCount; i++) {
      let product;
      let attempts = 0;
      do {
        product = availableProducts[Math.floor(Math.random() * availableProducts.length)];
        attempts++;
      } while (usedProductIds.has(product.id) && attempts < 10);
      
      if (!usedProductIds.has(product.id)) {
        usedProductIds.add(product.id);
        const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 quantity
        selectedProducts.push({
          productId: product.id,
          quantity,
          price: product.price
        });
      }
    }
    
    const notes = [
      '', '', '', // Higher chance of no notes
      'Extra napkins please',
      'Call when ready',
      'No onions',
      'Extra sauce on the side',
      'Make it spicy',
      'Light on the salt',
      'Well done',
      'Leave at door'
    ];
    
    const orderTypes = orderType === 'random' 
      ? ['takeout', 'delivery'][Math.floor(Math.random() * 2)]
      : orderType;
    
    const totalAmount = selectedProducts.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    return {
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      items: selectedProducts,
      totalAmount: Math.round(totalAmount * 100) / 100,
      type: orderTypes,
      notes: notes[Math.floor(Math.random() * notes.length)] || undefined
    };
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stressTestIntervalRef.current) {
        clearInterval(stressTestIntervalRef.current);
      }
      if (sampleOrdersIntervalRef.current) {
        clearInterval(sampleOrdersIntervalRef.current);
      }
    };
  }, []);

  // Handlers for multi-pipeline OTEL configuration
  const updateOtelPipeline = (pipelineType: 'logs' | 'metrics' | 'traces', field: string, value: any) => {
    setOtelPipelines(prev => ({
      ...prev,
      [pipelineType]: {
        ...prev[pipelineType],
        [field]: value,
        // Auto-generate endpoint URL when pipelineId changes
        ...(field === 'pipelineId' && value ? {
          endpoint: `https://pipeline.mezmo.com/v1/${value}`
        } : {})
      }
    }));
  };

  const handleOtelConfigure = async () => {
    try {
      // Prepare the configuration with multi-pipeline support
      const config = {
        serviceName: otelServiceName,
        tags: otelTags,
        debugLevel: otelDebugLevel,
        // Individual pipeline configurations
        logsEnabled: otelPipelines.logs.enabled,
        logsIngestionKey: otelPipelines.logs.ingestionKey,
        logsPipelineId: otelPipelines.logs.pipelineId,
        logsHost: otelPipelines.logs.host,
        
        metricsEnabled: otelPipelines.metrics.enabled,
        metricsIngestionKey: otelPipelines.metrics.ingestionKey,
        metricsPipelineId: otelPipelines.metrics.pipelineId,
        metricsHost: otelPipelines.metrics.host,
        
        tracesEnabled: otelPipelines.traces.enabled,
        tracesIngestionKey: otelPipelines.traces.ingestionKey,
        tracesPipelineId: otelPipelines.traces.pipelineId,
        tracesHost: otelPipelines.traces.host
      };

      const response = await fetch('/api/otel/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "OTEL Configuration Saved",
          description: "Multi-pipeline OpenTelemetry configuration has been saved successfully."
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: "Configuration Failed", 
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Load Mezmo configuration on mount
  useEffect(() => {
    // First check if the service is actually running
    const checkServiceStatus = async () => {
      try {
        const statusResponse = await fetch('/api/mezmo/status');
        const status = await statusResponse.json();
        
        if (statusResponse.ok) {
          // Set toggle based on actual running status
          const isRunning = status.status === 'connected' && status.pid !== null;
          setMezmoEnabled(isRunning);
          setMezmoPid(status.pid);
          setMezmoStatus(status.status);
          
          // Load configuration data from localStorage (but not the enabled state)
          const savedMezmoConfig = localStorage.getItem('mezmo-config');
          if (savedMezmoConfig) {
            const config = JSON.parse(savedMezmoConfig);
            setMezmoIngestionKey(config.ingestionKey || '');
            setMezmoHost(config.host || 'logs.mezmo.com');
            setMezmoTags(config.tags || 'restaurant-app,demo');
          }
        }
      } catch (error) {
        console.error('Error checking Mezmo service status:', error);
        // Fallback to localStorage if status check fails
        try {
          const savedMezmoConfig = localStorage.getItem('mezmo-config');
          if (savedMezmoConfig) {
            const config = JSON.parse(savedMezmoConfig);
            setMezmoIngestionKey(config.ingestionKey || '');
            setMezmoHost(config.host || 'logs.mezmo.com');
            setMezmoTags(config.tags || 'restaurant-app,demo');
            // Don't set enabled state from localStorage
          }
        } catch (storageError) {
          console.error('Error loading Mezmo configuration:', storageError);
        }
      }
    };
    
    checkServiceStatus();
  }, []);

  // Load OTEL configuration on mount
  useEffect(() => {
    // First check if the service is actually running
    const checkServiceStatus = async () => {
      try {
        const statusResponse = await fetch('/api/otel/status');
        const status = await statusResponse.json();
        
        if (statusResponse.ok) {
          // Set toggle based on actual running status
          const isRunning = status.status === 'connected' && status.pid !== null;
          setOtelEnabled(isRunning);
          setOtelPid(status.pid);
          setOtelStatus(status.status);
          
          // Load configuration data from localStorage (but not the enabled state)
          const savedOtelConfig = localStorage.getItem('otel-config');
          if (savedOtelConfig) {
            const config = JSON.parse(savedOtelConfig);
            
            // Load basic configuration
            setOtelServiceName(config.serviceName || 'restaurant-app');
            setOtelTags(config.tags || 'restaurant-app,otel');
            setOtelDebugLevel(config.debugLevel || 'info');
            
            // Handle both old single-pipeline and new multi-pipeline formats
            if (config.pipelines) {
              // New multi-pipeline format
              setOtelPipelines(prev => ({
                logs: {
                  ...prev.logs,
                  enabled: config.pipelines.logs?.enabled !== false,
                  ingestionKey: config.pipelines.logs?.ingestionKey || '',
                  pipelineId: config.pipelines.logs?.pipelineId || '',
                  host: config.pipelines.logs?.host || 'logs.mezmo.com',
                  endpoint: config.pipelines.logs?.endpoint || ''
                },
                metrics: {
                  ...prev.metrics,
                  enabled: config.pipelines.metrics?.enabled !== false,
                  ingestionKey: config.pipelines.metrics?.ingestionKey || '',
                  pipelineId: config.pipelines.metrics?.pipelineId || '',
                  host: config.pipelines.metrics?.host || 'logs.mezmo.com',
                  endpoint: config.pipelines.metrics?.endpoint || ''
                },
                traces: {
                  ...prev.traces,
                  enabled: config.pipelines.traces?.enabled || false,
                  ingestionKey: config.pipelines.traces?.ingestionKey || '',
                  pipelineId: config.pipelines.traces?.pipelineId || '',
                  host: config.pipelines.traces?.host || 'logs.mezmo.com',
                  endpoint: config.pipelines.traces?.endpoint || ''
                }
              }));
            } else {
              // Legacy single-pipeline format - migrate to logs pipeline
              const ingestionKey = config.ingestionKey || '';
              const pipelineId = config.pipelineId || '';
              const host = config.host || 'logs.mezmo.com';
              
              setOtelPipelines(prev => ({
                ...prev,
                logs: {
                  ...prev.logs,
                  enabled: config.enabled !== false,
                  ingestionKey,
                  pipelineId,
                  host,
                  endpoint: pipelineId ? `https://pipeline.mezmo.com/v1/${pipelineId}` : ''
                }
              }));
            }
          }
        }
      } catch (error) {
        console.error('Error checking OTEL service status:', error);
        // Fallback to localStorage if status check fails
        try {
          const savedOtelConfig = localStorage.getItem('otel-config');
          if (savedOtelConfig) {
            const config = JSON.parse(savedOtelConfig);
            
            // Load basic configuration (but not enabled state)
            setOtelServiceName(config.serviceName || 'restaurant-app');
            setOtelTags(config.tags || 'restaurant-app,otel');
            setOtelDebugLevel(config.debugLevel || 'info');
            
            // Load pipeline configurations
            if (config.pipelines) {
              setOtelPipelines(prev => ({
                logs: {
                  ...prev.logs,
                  enabled: config.pipelines.logs?.enabled !== false,
                  ingestionKey: config.pipelines.logs?.ingestionKey || '',
                  pipelineId: config.pipelines.logs?.pipelineId || '',
                  host: config.pipelines.logs?.host || 'logs.mezmo.com',
                  endpoint: config.pipelines.logs?.endpoint || ''
                },
                metrics: {
                  ...prev.metrics,
                  enabled: config.pipelines.metrics?.enabled !== false,
                  ingestionKey: config.pipelines.metrics?.ingestionKey || '',
                  pipelineId: config.pipelines.metrics?.pipelineId || '',
                  host: config.pipelines.metrics?.host || 'logs.mezmo.com',
                  endpoint: config.pipelines.metrics?.endpoint || ''
                },
                traces: {
                  ...prev.traces,
                  enabled: config.pipelines.traces?.enabled || false,
                  ingestionKey: config.pipelines.traces?.ingestionKey || '',
                  pipelineId: config.pipelines.traces?.pipelineId || '',
                  host: config.pipelines.traces?.host || 'logs.mezmo.com',
                  endpoint: config.pipelines.traces?.endpoint || ''
                }
              }));
            }
          }
        } catch (storageError) {
          console.error('Error loading OTEL configuration:', storageError);
        }
      }
    };
    
    checkServiceStatus();
  }, []);

  // Mezmo configuration management
  const saveMezmoConfig = () => {
    const config = {
      enabled: mezmoEnabled,
      ingestionKey: mezmoIngestionKey,
      host: mezmoHost,
      tags: mezmoTags,
      lastUpdated: new Date().toISOString()
    };
    
    try {
      localStorage.setItem('mezmo-config', JSON.stringify(config));
      toast({
        title: "Mezmo Configuration Saved",
        description: "Your Mezmo settings have been saved locally."
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Could not save Mezmo configuration.",
        variant: "destructive"
      });
    }
  };

  const handleMezmoToggle = (enabled: boolean) => {
    setMezmoEnabled(enabled);
    if (enabled && mezmoIngestionKey) {
      // Auto-save when enabling with valid key
      setTimeout(() => saveMezmoConfig(), 100);
      handleStartMezmoAgent();
    } else if (!enabled) {
      handleStopMezmoAgent();
    }
  };

  const validateMezmoConfig = () => {
    if (!mezmoIngestionKey.trim()) {
      toast({
        title: "Missing Ingestion Key",
        description: "Please enter your Mezmo ingestion key.",
        variant: "destructive"
      });
      return false;
    }
    
    if (!mezmoHost.trim()) {
      toast({
        title: "Missing Host",
        description: "Please enter your Mezmo host URL.",
        variant: "destructive"
      });
      return false;
    }
    
    return true;
  };

  const handleStartMezmoAgent = async () => {
    if (!validateMezmoConfig()) return;
    
    setMezmoStatus('connecting');
    
    try {
      // First configure the agent
      const configResponse = await fetch('/api/mezmo/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingestionKey: mezmoIngestionKey,
          host: mezmoHost,
          tags: mezmoTags,
          enabled: true
        })
      });
      
      if (!configResponse.ok) {
        const errorData = await configResponse.json();
        throw new Error(errorData.details || errorData.error || 'Failed to configure LogDNA agent');
      }
      
      // Then start the agent
      const startResponse = await fetch('/api/mezmo/start', {
        method: 'POST'
      });
      
      const result = await startResponse.json();
      
      if (startResponse.ok) {
        setMezmoStatus('connected');
        setMezmoLastSync(new Date().toISOString());
        setMezmoStats(prev => ({ ...prev, logsSent: prev.logsSent + 1 }));
        toast({
          title: "Mezmo Agent Started",
          description: `LogDNA agent is now forwarding logs to Mezmo (PID: ${result.pid}).`
        });
      } else {
        throw new Error(result.error || 'Failed to start agent');
      }
    } catch (error) {
      setMezmoStatus('error');
      setMezmoStats(prev => ({ 
        ...prev, 
        errors: prev.errors + 1,
        lastError: error.message
      }));
      toast({
        title: "Agent Start Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleStopMezmoAgent = async () => {
    try {
      const response = await fetch('/api/mezmo/stop', {
        method: 'POST'
      });
      
      const result = await response.json();
      
      setMezmoStatus('disconnected');
      toast({
        title: "Mezmo Agent Stopped",
        description: result.message || "Log forwarding to Mezmo has been disabled."
      });
    } catch (error) {
      toast({
        title: "Stop Failed",
        description: "Could not stop LogDNA agent.",
        variant: "destructive"
      });
    }
  };

  const handleTestMezmoConnection = async () => {
    if (!validateMezmoConfig()) return;
    
    setMezmoStatus('connecting');
    
    try {
      // Configure and test the connection
      const configResponse = await fetch('/api/mezmo/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingestionKey: mezmoIngestionKey,
          host: mezmoHost,
          tags: mezmoTags,
          enabled: false // Just test, don't enable
        })
      });
      
      if (!configResponse.ok) {
        const errorData = await configResponse.json();
        throw new Error(errorData.details || errorData.error || 'Failed to configure LogDNA agent');
      }
      
      // Check status
      const statusResponse = await fetch('/api/mezmo/status');
      const status = await statusResponse.json();
      
      if (statusResponse.ok && status.hasConfig) {
        setMezmoStatus('connected');
        setMezmoLastSync(new Date().toISOString());
        toast({
          title: "Connection Test Successful",
          description: "Configuration is valid. You can now enable the agent."
        });
      } else {
        throw new Error('Configuration test failed');
      }
    } catch (error) {
      setMezmoStatus('error');
      setMezmoStats(prev => ({ 
        ...prev, 
        errors: prev.errors + 1,
        lastError: error.message
      }));
      toast({
        title: "Connection Test Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const [showIngestionKey, setShowIngestionKey] = useState(false);

  // OTEL configuration management
  const saveOtelConfig = async () => {
    const config = {
      enabled: otelEnabled,
      serviceName: otelServiceName,
      tags: otelTags,
      debugLevel: otelDebugLevel,
      pipelines: {
        logs: {
          enabled: otelPipelines.logs.enabled,
          ingestionKey: otelPipelines.logs.ingestionKey,
          pipelineId: otelPipelines.logs.pipelineId,
          host: otelPipelines.logs.host,
          endpoint: otelPipelines.logs.endpoint
        },
        metrics: {
          enabled: otelPipelines.metrics.enabled,
          ingestionKey: otelPipelines.metrics.ingestionKey,
          pipelineId: otelPipelines.metrics.pipelineId,
          host: otelPipelines.metrics.host,
          endpoint: otelPipelines.metrics.endpoint
        },
        traces: {
          enabled: otelPipelines.traces.enabled,
          ingestionKey: otelPipelines.traces.ingestionKey,
          pipelineId: otelPipelines.traces.pipelineId,
          host: otelPipelines.traces.host,
          endpoint: otelPipelines.traces.endpoint
        }
      },
      lastUpdated: new Date().toISOString()
    };
    
    try {
      // Save to localStorage
      localStorage.setItem('otel-config', JSON.stringify(config));
      
      // Also save to server if we have required fields
      if (otelIngestionKey.trim() && (otelLogsEnabled || otelMetricsEnabled || otelTracesEnabled)) {
        try {
          const configResponse = await fetch('/api/otel/configure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              serviceName: otelServiceName,
              tags: otelTags,
              debugLevel: otelDebugLevel,
              // Logs pipeline
              logsEnabled: otelPipelines.logs.enabled,
              logsIngestionKey: otelPipelines.logs.ingestionKey,
              logsPipelineId: otelPipelines.logs.pipelineId,
              logsHost: otelPipelines.logs.host,
              // Metrics pipeline
              metricsEnabled: otelPipelines.metrics.enabled,
              metricsIngestionKey: otelPipelines.metrics.ingestionKey,
              metricsPipelineId: otelPipelines.metrics.pipelineId,
              metricsHost: otelPipelines.metrics.host,
              // Traces pipeline
              tracesEnabled: otelPipelines.traces.enabled,
              tracesIngestionKey: otelPipelines.traces.ingestionKey,
              tracesPipelineId: otelPipelines.traces.pipelineId,
              tracesHost: otelPipelines.traces.host
            })
          });
          
          if (!configResponse.ok) {
            const errorData = await configResponse.json();
            throw new Error(errorData.error || 'Failed to configure collector');
          }
          
          toast({
            title: "OTEL Configuration Saved",
            description: "Configuration saved to server and generated /etc/otelcol/config.yaml file."
          });
        } catch (serverError: any) {
          console.error('Failed to save OTEL config to server:', serverError);
          toast({
            title: "Server Configuration Failed",
            description: `Configuration saved locally but server update failed: ${serverError.message}`,
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "OTEL Configuration Saved Locally",
          description: "Configuration saved to browser. Add ingestion key and enable pipelines to save to server."
        });
      }
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Could not save OTEL Collector configuration.",
        variant: "destructive"
      });
    }
  };

  const handleOtelToggle = async (enabled: boolean) => {
    setOtelEnabled(enabled);
    
    // Immediately save the enabled state change
    const config = {
      enabled: enabled,
      serviceName: otelServiceName,
      tags: otelTags,
      debugLevel: otelDebugLevel,
      pipelines: {
        logs: {
          enabled: otelPipelines.logs.enabled,
          ingestionKey: otelPipelines.logs.ingestionKey,
          pipelineId: otelPipelines.logs.pipelineId,
          host: otelPipelines.logs.host,
          endpoint: otelPipelines.logs.endpoint
        },
        metrics: {
          enabled: otelPipelines.metrics.enabled,
          ingestionKey: otelPipelines.metrics.ingestionKey,
          pipelineId: otelPipelines.metrics.pipelineId,
          host: otelPipelines.metrics.host,
          endpoint: otelPipelines.metrics.endpoint
        },
        traces: {
          enabled: otelPipelines.traces.enabled,
          ingestionKey: otelPipelines.traces.ingestionKey,
          pipelineId: otelPipelines.traces.pipelineId,
          host: otelPipelines.traces.host,
          endpoint: otelPipelines.traces.endpoint
        }
      },
      lastUpdated: new Date().toISOString()
    };
    
    localStorage.setItem('otel-config', JSON.stringify(config));
    console.log('OTEL config saved with enabled:', enabled);
    
    if (enabled && otelIngestionKey) {
      // Start collector if we have ingestion key
      handleStartOtelCollector();
    } else if (!enabled) {
      // Stop collector when disabling
      handleStopOtelCollector();
    }
  };

  const validateOtelConfig = () => {
    // Check if at least one pipeline is enabled
    const enabledPipelines = Object.entries(otelPipelines).filter(([_, pipeline]) => pipeline.enabled);
    
    if (enabledPipelines.length === 0) {
      toast({
        title: "No Pipelines Enabled",
        description: "Please enable at least one telemetry pipeline (logs, metrics, or traces).",
        variant: "destructive"
      });
      return false;
    }

    // Validate each enabled pipeline has required configuration
    for (const [pipelineType, pipeline] of enabledPipelines) {
      if (!pipeline.ingestionKey.trim()) {
        toast({
          title: "Missing Ingestion Key",
          description: `Please enter an ingestion key for the ${pipelineType} pipeline.`,
          variant: "destructive"
        });
        return false;
      }
      
      if (!pipeline.pipelineId.trim()) {
        toast({
          title: "Missing Pipeline ID",
          description: `Please enter a pipeline ID for the ${pipelineType} pipeline.`,
          variant: "destructive"
        });
        return false;
      }
    }
    
    return true;
  };

  const handleStartOtelCollector = async () => {
    if (!validateOtelConfig()) return;
    
    setOtelStatus('connecting');
    
    try {
      // First configure the collector
      const configResponse = await fetch('/api/otel/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName: otelServiceName,
          tags: otelTags,
          debugLevel: otelDebugLevel,
          // Logs pipeline
          logsEnabled: otelPipelines.logs.enabled,
          logsIngestionKey: otelPipelines.logs.ingestionKey,
          logsPipelineId: otelPipelines.logs.pipelineId,
          logsHost: otelPipelines.logs.host,
          // Metrics pipeline
          metricsEnabled: otelPipelines.metrics.enabled,
          metricsIngestionKey: otelPipelines.metrics.ingestionKey,
          metricsPipelineId: otelPipelines.metrics.pipelineId,
          metricsHost: otelPipelines.metrics.host,
          // Traces pipeline
          tracesEnabled: otelPipelines.traces.enabled,
          tracesIngestionKey: otelPipelines.traces.ingestionKey,
          tracesPipelineId: otelPipelines.traces.pipelineId,
          tracesHost: otelPipelines.traces.host
        })
      });
      
      if (!configResponse.ok) {
        throw new Error('Failed to configure OTEL Collector');
      }
      
      // Then start the collector
      const startResponse = await fetch('/api/otel/start', {
        method: 'POST'
      });
      
      const result = await startResponse.json();
      
      if (startResponse.ok) {
        setOtelStatus('connected');
        setOtelLastSync(new Date().toISOString());
        toast({
          title: "OTEL Collector Started",
          description: `OpenTelemetry Collector is now forwarding telemetry to Mezmo (PID: ${result.pid}).`
        });
      } else {
        throw new Error(result.error || 'Failed to start collector');
      }
    } catch (error) {
      setOtelStatus('error');
      toast({
        title: "Collector Start Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleStopOtelCollector = async () => {
    try {
      const response = await fetch('/api/otel/stop', {
        method: 'POST'
      });
      
      const result = await response.json();
      
      setOtelStatus('disconnected');
      toast({
        title: "OTEL Collector Stopped",
        description: result.message || "Telemetry forwarding to Mezmo has been disabled."
      });
    } catch (error) {
      toast({
        title: "Stop Failed",
        description: "Could not stop OTEL Collector.",
        variant: "destructive"
      });
    }
  };

  const handleTestOtelConnection = async () => {
    if (!validateOtelConfig()) return;
    
    setOtelStatus('connecting');
    
    try {
      // Configure and test the connection
      const configResponse = await fetch('/api/otel/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName: otelServiceName,
          tags: otelTags,
          debugLevel: otelDebugLevel,
          // Logs pipeline
          logsEnabled: otelPipelines.logs.enabled,
          logsIngestionKey: otelPipelines.logs.ingestionKey,
          logsPipelineId: otelPipelines.logs.pipelineId,
          logsHost: otelPipelines.logs.host,
          // Metrics pipeline
          metricsEnabled: otelPipelines.metrics.enabled,
          metricsIngestionKey: otelPipelines.metrics.ingestionKey,
          metricsPipelineId: otelPipelines.metrics.pipelineId,
          metricsHost: otelPipelines.metrics.host,
          // Traces pipeline
          tracesEnabled: otelPipelines.traces.enabled,
          tracesIngestionKey: otelPipelines.traces.ingestionKey,
          tracesPipelineId: otelPipelines.traces.pipelineId,
          tracesHost: otelPipelines.traces.host
        })
      });
      
      if (!configResponse.ok) {
        throw new Error('Failed to configure OTEL Collector');
      }
      
      // Check status
      const statusResponse = await fetch('/api/otel/status');
      const status = await statusResponse.json();
      
      if (statusResponse.ok && status.hasConfig) {
        setOtelStatus('connected');
        setOtelLastSync(new Date().toISOString());
        toast({
          title: "Connection Test Successful",
          description: "Configuration is valid. You can now enable the collector."
        });
      } else {
        throw new Error('Configuration test failed');
      }
    } catch (error) {
      setOtelStatus('error');
      toast({
        title: "Connection Test Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleViewOtelLogs = async () => {
    try {
      const response = await fetch('/api/otel/logs');
      const result = await response.json();
      
      if (response.ok) {
        setOtelLogs(result.logs || 'No logs available');
        setShowOtelLogs(true);
      } else {
        toast({
          title: "Failed to Load Logs",
          description: "Could not retrieve OTEL Collector logs.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error Loading Logs",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDebugOtel = async () => {
    try {
      const response = await fetch('/api/otel/debug');
      const result = await response.json();
      
      if (response.ok) {
        setDebugInfo(result);
        setShowDebugInfo(true);
      } else {
        toast({
          title: "Failed to Load Debug Info",
          description: "Could not retrieve OTEL Collector debug information.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error Loading Debug Info",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Failure Simulation Functions
  const pollFailureStatus = async () => {
    try {
      const response = await fetch('/api/simulate/status');
      if (response.ok) {
        const status = await response.json();
        setFailureStatus(status);
        setFailureActive(status.active);
      }
    } catch (error) {
      console.warn('Could not check failure status:', error);
    }
  };

  const triggerFailure = async () => {
    if (!failureScenario) {
      toast({
        title: "No Scenario Selected",
        description: "Please select a failure scenario first.",
        variant: "destructive"
      });
      return;
    }

    // Check current status before starting
    await pollFailureStatus();
    if (failureActive || failureStatus?.active) {
      toast({
        title: "Simulation Already Active",
        description: "Please stop the current simulation before starting a new one.",
        variant: "destructive"
      });
      return;
    }

    const selectedScenario = failureScenarios.find(s => s.id === failureScenario);
    
    try {
      const response = await fetch('/api/simulate/failure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: failureScenario,
          duration: failureDuration
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setFailureActive(true);
        setShowFailureDialog(false);
        
        toast({
          title: "🚨 Failure Simulation Started",
          description: `${selectedScenario?.name} will run for ${failureDuration} seconds`,
          variant: "destructive"
        });
        
        // Start polling status
        pollFailureStatus();
        const pollInterval = setInterval(pollFailureStatus, 2000);
        
        // Stop polling when failure ends
        setTimeout(() => {
          clearInterval(pollInterval);
          setFailureActive(false);
          setFailureStatus(null);
        }, failureDuration * 1000 + 5000);
        
      } else {
        toast({
          title: "Failed to Start Simulation",
          description: result.error || 'Unknown error occurred',
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Simulation Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const stopFailure = async () => {
    try {
      const response = await fetch('/api/simulate/stop', {
        method: 'POST'
      });

      const result = await response.json();
      
      if (response.ok) {
        setFailureActive(false);
        setFailureStatus(null);
        
        // Poll status after a short delay to ensure backend is updated
        setTimeout(() => {
          pollFailureStatus();
        }, 1000);
        
        toast({
          title: "✅ Failure Simulation Stopped",
          description: `${result.scenario} simulation stopped after ${Math.round(result.runTime / 1000)} seconds`,
        });
      } else {
        toast({
          title: "Failed to Stop Simulation",
          description: result.error || 'Unknown error occurred',
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Stop Error", 
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleScenarioChange = (scenarioId) => {
    setFailureScenario(scenarioId);
    const scenario = failureScenarios.find(s => s.id === scenarioId);
    if (scenario) {
      setFailureDuration(scenario.defaultDuration);
    }
  };

  // Poll agent status periodically
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch('/api/mezmo/status');
        const status = await response.json();
        
        if (response.ok) {
          setMezmoStatus(status.status);
          setMezmoPid(status.pid);
          
          // Update toggle state based on actual service status
          const isRunning = status.status === 'connected' && status.pid !== null;
          setMezmoEnabled(isRunning);
          
          if (status.status === 'connected' && !mezmoLastSync) {
            setMezmoLastSync(new Date().toISOString());
          }
        }
      } catch (error) {
        // Silently fail - don't spam the user with errors
        console.warn('Could not check LogDNA status:', error);
      }
    };

    // Poll every 10 seconds
    pollStatus(); // Check immediately
    const interval = setInterval(pollStatus, 10000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mezmoLastSync]);

  // Poll OTEL Collector status periodically
  useEffect(() => {
    const pollOtelStatus = async () => {
      try {
        const response = await fetch('/api/otel/status');
        const status = await response.json();
        
        if (response.ok) {
          setOtelStatus(status.status);
          setOtelPid(status.pid);
          
          // Update toggle state based on actual service status
          const isRunning = status.status === 'connected' && status.pid !== null;
          setOtelEnabled(isRunning);
          
          if (status.status === 'connected' && !otelLastSync) {
            setOtelLastSync(new Date().toISOString());
          }
          // Update pipeline settings from server config
          if (status.enabledPipelines) {
            setOtelLogsEnabled(status.enabledPipelines.logs);
            setOtelMetricsEnabled(status.enabledPipelines.metrics);
            setOtelTracesEnabled(status.enabledPipelines.traces);
          }

          // Fetch real collector metrics if running
          if (status.status === 'connected') {
            try {
              const metricsResponse = await fetch('/api/otel/metrics');
              const metricsData = await metricsResponse.json();
              if (metricsResponse.ok) {
                setOtelStats(metricsData);
              }
            } catch (error) {
              console.warn('Could not fetch OTEL metrics:', error);
            }
          }
        }
      } catch (error) {
        // Silently fail - don't spam the user with errors
        console.warn('Could not check OTEL Collector status:', error);
      }
    };

    // Poll every 10 seconds to check actual process status
    // This ensures UI stays in sync with actual running state
    pollOtelStatus(); // Check immediately on mount/change
    const otelInterval = setInterval(pollOtelStatus, 10000);

    return () => {
      if (otelInterval) clearInterval(otelInterval);
    };
  }, [otelLastSync]);

  // Poll failure simulation status on mount and periodically
  useEffect(() => {
    // Check status immediately on mount
    pollFailureStatus();
    
    // Poll every 5 seconds when UI is loaded
    const failureStatusInterval = setInterval(pollFailureStatus, 5000);
    
    return () => {
      clearInterval(failureStatusInterval);
    };
  }, []);

  // Initialize traffic manager and poll stats
  useEffect(() => {
    let trafficManager: any = null;
    let statsInterval: NodeJS.Timeout | null = null;

    const initTraffic = async () => {
      try {
        console.log('🔧 Initializing Traffic Manager...');
        const { TrafficManager } = await import('@/lib/tracing/trafficManager');
        trafficManager = TrafficManager.getInstance();
        
        // Load saved configuration
        const config = trafficManager.getConfig();
        console.log('📋 Loaded traffic config:', config);
        
        setTrafficEnabled(config.enabled);
        setTrafficTargetUsers(config.targetConcurrentUsers);
        setTrafficPattern(config.journeyPattern);
        setTrafficTiming(config.trafficTiming);
        
        console.log(`🎛️ UI State set - Enabled: ${config.enabled}, Users: ${config.targetConcurrentUsers}, Pattern: ${config.journeyPattern}, Timing: ${config.trafficTiming}`);
        
        // Start traffic if enabled
        if (config.enabled) {
          console.log('▶️ Auto-starting traffic manager...');
          trafficManager.start();
        } else {
          console.log('⏸️ Traffic manager disabled, not starting');
        }

        // Poll stats every 5 seconds
        const updateStats = () => {
          const stats = trafficManager.getStats();
          setTrafficStats(stats);
          if (stats.activeUsers > 0) {
            console.log('📊 Traffic stats:', stats);
          }
        };

        updateStats(); // Initial update
        statsInterval = setInterval(updateStats, 5000);

      } catch (error) {
        console.error('❌ Error initializing traffic manager:', error);
      }
    };

    initTraffic();

    return () => {
      if (statsInterval) {
        clearInterval(statsInterval);
      }
      // Don't destroy the traffic manager - let it persist globally
    };
  }, []);

  // Traffic manager controls
  const handleTrafficToggle = async (enabled: boolean) => {
    try {
      console.log(`🔄 Toggling traffic: ${enabled ? 'ON' : 'OFF'}`);
      const { TrafficManager } = await import('@/lib/tracing/trafficManager');
      const trafficManager = TrafficManager.getInstance();
      
      setTrafficEnabled(enabled);
      
      const config = {
        enabled,
        targetConcurrentUsers: trafficTargetUsers,
        journeyPattern: trafficPattern,
        trafficTiming: trafficTiming
      };

      console.log('🔧 Updating traffic config:', config);
      trafficManager.updateConfig(config);

      toast({
        title: enabled ? "Virtual Traffic Started" : "Virtual Traffic Stopped",
        description: enabled 
          ? `Simulating ${trafficTargetUsers} concurrent users browsing the site (${trafficPattern} pattern, ${trafficTiming} timing)`
          : "Allowing existing virtual users to complete their sessions"
      });

    } catch (error) {
      console.error('❌ Error toggling traffic:', error);
      toast({
        title: "Error",
        description: "Failed to toggle virtual traffic",
        variant: "destructive"
      });
    }
  };

  const handleTrafficUsersChange = async (users: number) => {
    try {
      const { TrafficManager } = await import('@/lib/tracing/trafficManager');
      const trafficManager = TrafficManager.getInstance();
      
      setTrafficTargetUsers(users);
      
      trafficManager.updateConfig({
        targetConcurrentUsers: users,
        journeyPattern: trafficPattern,
        trafficTiming: trafficTiming
      });

    } catch (error) {
      console.error('Error updating traffic users:', error);
    }
  };

  const handleTrafficPatternChange = async (pattern: 'mixed' | 'buyers' | 'browsers' | 'researchers') => {
    try {
      const { TrafficManager } = await import('@/lib/tracing/trafficManager');
      const trafficManager = TrafficManager.getInstance();
      
      setTrafficPattern(pattern);
      
      trafficManager.updateConfig({
        enabled: trafficEnabled,
        targetConcurrentUsers: trafficTargetUsers,
        journeyPattern: pattern,
        trafficTiming: trafficTiming
      });

    } catch (error) {
      console.error('Error updating traffic pattern:', error);
    }
  };

  const handleTrafficTimingChange = async (timing: 'steady' | 'normal' | 'peak' | 'low' | 'burst') => {
    try {
      const { TrafficManager } = await import('@/lib/tracing/trafficManager');
      const trafficManager = TrafficManager.getInstance();
      
      setTrafficTiming(timing);
      
      trafficManager.updateConfig({
        enabled: trafficEnabled,
        targetConcurrentUsers: trafficTargetUsers,
        journeyPattern: trafficPattern,
        trafficTiming: timing
      });

    } catch (error) {
      console.error('Error updating traffic timing:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4 text-foreground">Configuration</h1>
        <p className="text-lg text-muted-foreground">Manage your restaurant data and settings</p>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Data Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Current Data Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">{summary.products}</div>
                <div className="text-sm text-muted-foreground">Products</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">{summary.reservations}</div>
                <div className="text-sm text-muted-foreground">Reservations</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">{summary.orders}</div>
                <div className="text-sm text-muted-foreground">Orders</div>
              </div>
            </div>
            <div className="flex justify-center">
              <Button 
                onClick={handleRefreshLocalStorage}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Local Storage
              </Button>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Clears cached data and reloads with latest defaults (including updated menu images)
            </p>
          </CardContent>
        </Card>

        {/* Structured Logging Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Structured Logging System</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Master Logging Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium">Enable Structured Logging</Label>
                <p className="text-sm text-muted-foreground">
                  Activate comprehensive logging with access, event, metrics, and error logs
                </p>
              </div>
              <Switch
                checked={loggingEnabled}
                onCheckedChange={handleLoggingToggle}
              />
            </div>

            {/* Per-Logger Configuration */}
            {loggingEnabled && (
              <div className="space-y-6">
                {['access', 'event', 'metrics', 'error'].map((loggerType) => (
                  <div key={loggerType} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-base font-medium capitalize">
                          {loggerType} Logger
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {loggerType === 'access' && 'HTTP requests, response times, status codes'}
                          {loggerType === 'event' && 'User actions, business events, system events'}
                          {loggerType === 'metrics' && 'Performance metrics, counters, gauges'}
                          {loggerType === 'error' && 'Errors, exceptions, failures'}
                        </p>
                      </div>
                      <Switch
                        checked={loggerConfigs[loggerType]?.enabled || false}
                        onCheckedChange={(checked) => handleLoggerConfigChange(loggerType, 'enabled', checked)}
                      />
                    </div>

                    {loggerConfigs[loggerType]?.enabled && (
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Log Level */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Log Level</Label>
                          <Select
                            value={loggerConfigs[loggerType]?.level || 'INFO'}
                            onValueChange={(value) => handleLoggerConfigChange(loggerType, 'level', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {['DEBUG', 'INFO', 'WARN', 'ERROR'].map((level) => (
                                <SelectItem key={level} value={level}>
                                  {level}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Log Format */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Format</Label>
                          <Select
                            value={loggerConfigs[loggerType]?.format || 'json'}
                            onValueChange={(value) => handleLoggerConfigChange(loggerType, 'format', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableFormats(loggerType).map((format) => (
                                <SelectItem key={format.value} value={format.value}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{format.label}</span>
                                    <span className="text-xs text-muted-foreground">{format.description}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Configuration Help */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-start space-x-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-blue-900">Configuration Guide</p>
                      <div className="text-blue-800 space-y-1">
                        <p><strong>Log Level:</strong> Controls verbosity - DEBUG (most detailed) {'>'} INFO (standard) {'>'} WARN (warnings only) {'>'} ERROR (errors only)</p>
                        <p><strong>Format:</strong> Output structure - JSON for machine parsing, CLF for web servers, String for human reading</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Logging Architecture Documentation */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start space-x-2">
                    <FileText className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2 text-sm">
                      <p className="font-medium text-gray-900">Logging Architecture</p>
                      <div className="text-gray-700 space-y-2">
                        <div>
                          <p className="font-medium">Log Files & Purpose:</p>
                          <ul className="ml-4 space-y-1 text-xs">
                            <li><strong>access.log</strong> - HTTP requests (CLF format)</li>
                            <li><strong>events.log</strong> - Application & business events</li>
                            <li><strong>performance.log</strong> - Timing & performance data</li>
                            <li><strong>metrics.log</strong> - Quantitative metrics & KPIs</li>
                            <li><strong>errors.log</strong> - Application errors & exceptions</li>
                            <li><strong>app.log</strong> - General application logs</li>
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium">Log Forwarding:</p>
                          <ul className="ml-4 space-y-1 text-xs">
                            <li><strong>Mezmo Log Forwarder</strong> - Sends all 6 log files to Mezmo logs</li>
                            <li><strong>OTEL Logs Pipeline</strong> - Forwards all 6 log files as structured logs</li>
                            <li><strong>OTEL Metrics Pipeline</strong> - Collects system metrics (CPU, memory, disk, network)</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Analytics Dashboard */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Monitor className="h-4 w-4" />
                      <span className="font-medium">Logging Analytics</span>
                    </div>
                    <Button
                      onClick={handleRefreshAnalytics}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                  </div>

                  {loggingAnalytics && (
                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-background rounded border">
                        <div className="text-lg font-bold text-blue-600">
                          {loggingAnalytics.access?.totalRequests || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">HTTP Requests</div>
                      </div>
                      <div className="text-center p-3 bg-background rounded border">
                        <div className="text-lg font-bold text-green-600">
                          {loggingAnalytics.events?.totalEvents || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Events Logged</div>
                      </div>
                      <div className="text-center p-3 bg-background rounded border">
                        <div className="text-lg font-bold text-purple-600">
                          {loggingAnalytics.metrics?.totalMetrics || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Metrics Captured</div>
                      </div>
                      <div className="text-center p-3 bg-background rounded border">
                        <div className="text-lg font-bold text-red-600">
                          {loggingAnalytics.errors?.totalErrors || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Errors Detected</div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 text-sm text-muted-foreground">
                    <strong>Session ID:</strong> <code className="bg-background px-1 rounded">{getSessionId()}</code>
                  </div>
                </div>

                {/* Log Management Actions */}
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      onClick={handleFlushAllLogs}
                      variant="outline"
                      size="sm"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Flush All Logs
                    </Button>
                    <Button 
                      onClick={handleClearAllLogs}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Clear All Logs
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Flush: Write buffered logs to files • Clear: Remove all stored logs from localStorage
                  </p>
                </div>

                {/* Docker Log Information */}
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-800">Docker Container Log Files</span>
                  </div>
                  <div className="space-y-2 text-sm text-blue-700">
                    <div><strong>Access:</strong> <code className="bg-blue-100 px-1 rounded">/tmp/codeuser/access.log</code></div>
                    <div><strong>Events:</strong> <code className="bg-blue-100 px-1 rounded">/tmp/codeuser/events.log</code></div>
                    <div><strong>Metrics:</strong> <code className="bg-blue-100 px-1 rounded">/tmp/codeuser/metrics.log</code></div>
                    <div><strong>Errors:</strong> <code className="bg-blue-100 px-1 rounded">/tmp/codeuser/errors.log</code></div>
                    <div><strong>Performance:</strong> <code className="bg-blue-100 px-1 rounded">/tmp/codeuser/performance.log</code></div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-blue-200">
                    <div><strong>View logs:</strong> <code className="bg-blue-100 px-1 rounded">docker exec -it &lt;container&gt; tail -f /tmp/codeuser/*.log</code></div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mezmo Log Forwarding */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Cloud className="h-5 w-5" />
              <span>Mezmo Log Forwarding</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Forward your performance logs to Mezmo (LogDNA) for centralized log management and analysis.
            </p>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium">Enable Mezmo Forwarding</Label>
                <p className="text-sm text-muted-foreground">
                  Forward logs from /tmp/codeuser/ to your Mezmo account
                </p>
              </div>
              <Switch
                checked={mezmoEnabled}
                onCheckedChange={handleMezmoToggle}
              />
            </div>

            {/* Configuration Form */}
            <div className="space-y-4">
              {/* Ingestion Key */}
              <div className="space-y-2">
                <Label htmlFor="mezmo-key">Ingestion Key</Label>
                <div className="relative">
                  <Input
                    id="mezmo-key"
                    type={showIngestionKey ? "text" : "password"}
                    value={mezmoIngestionKey}
                    onChange={(e) => setMezmoIngestionKey(e.target.value)}
                    placeholder="Enter your Mezmo ingestion key"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowIngestionKey(!showIngestionKey)}
                  >
                    {showIngestionKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your ingestion key from your Mezmo account settings
                </p>
              </div>

              {/* Host */}
              <div className="space-y-2">
                <Label htmlFor="mezmo-host">Mezmo Host</Label>
                <Input
                  id="mezmo-host"
                  type="text"
                  value={mezmoHost}
                  onChange={(e) => setMezmoHost(e.target.value)}
                  placeholder="logs.mezmo.com"
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="mezmo-tags">Tags (comma-separated)</Label>
                <Input
                  id="mezmo-tags"
                  type="text"
                  value={mezmoTags}
                  onChange={(e) => setMezmoTags(e.target.value)}
                  placeholder="restaurant-app,demo,production"
                />
                <p className="text-xs text-muted-foreground">
                  Tags help organize and filter your logs in Mezmo
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={saveMezmoConfig}
                disabled={!mezmoIngestionKey.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Settings className="mr-2 h-4 w-4" />
                Save Configuration
              </Button>
              
              <Button
                onClick={handleTestMezmoConnection}
                disabled={!mezmoIngestionKey.trim() || mezmoStatus === 'connecting'}
                variant="outline"
              >
                <Monitor className="mr-2 h-4 w-4" />
                Test Connection
              </Button>
            </div>

            {/* Status Display */}
            <div className="space-y-4">
              {/* Connection Status */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  {mezmoStatus === 'connected' && <CheckCircle className="h-5 w-5 text-green-600" />}
                  {mezmoStatus === 'disconnected' && <CloudOff className="h-5 w-5 text-gray-500" />}
                  {mezmoStatus === 'connecting' && <Monitor className="h-5 w-5 text-blue-600 animate-pulse" />}
                  {mezmoStatus === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
                  <span className="font-medium">
                    Agent Status: {mezmoStatus.charAt(0).toUpperCase() + mezmoStatus.slice(1)}
                  </span>
                  {mezmoPid && (
                    <span className="text-sm text-muted-foreground ml-2">
                      (PID: {mezmoPid})
                    </span>
                  )}
                </div>
                
                {mezmoLastSync && (
                  <p className="text-sm text-muted-foreground">
                    Last sync: {new Date(mezmoLastSync).toLocaleString()}
                  </p>
                )}
                
                {mezmoStats.lastError && (
                  <p className="text-sm text-red-600 mt-2">
                    Last error: {mezmoStats.lastError}
                  </p>
                )}
              </div>

              {/* Agent Statistics */}
              {mezmoEnabled && (
                <div className="grid grid-cols-3 gap-4 bg-muted/50 p-4 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{mezmoStats.logsSent}</div>
                    <div className="text-xs text-muted-foreground">Logs Sent</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{mezmoStats.errors}</div>
                    <div className="text-xs text-muted-foreground">Errors</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {mezmoStatus === 'connected' ? '✓' : '✗'}
                    </div>
                    <div className="text-xs text-muted-foreground">Connected</div>
                  </div>
                </div>
              )}
            </div>

            {/* Mezmo Architecture Documentation */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <div className="flex items-start space-x-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-blue-900">Mezmo Log Forwarding</p>
                  <div className="text-blue-800 space-y-1">
                    <p><strong>What it forwards:</strong> All 6 structured log files (access, events, performance, metrics, errors, app)</p>
                    <p><strong>Destination:</strong> Your Mezmo logs account for centralized analysis and alerting</p>
                    <p><strong>Format:</strong> Original log format preserved (JSON structured logs)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Demo Environment Warning */}
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="font-medium text-yellow-800">Demo Environment</span>
              </div>
              <p className="text-sm text-yellow-700">
                This is a demo environment. Your ingestion key is stored locally in browser storage only.
                In production, use secure environment variables or secrets management.
              </p>
            </div>

            {/* Log Directory Information */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Monitored Log Directory</span>
              </div>
              <div className="space-y-1 text-sm text-blue-700">
                <div>• <strong>Directory:</strong> /tmp/codeuser/</div>
                <div>• <strong>Main log file:</strong> restaurant-performance.log</div>
                <div>• <strong>Log format:</strong> Configurable (string/JSON/CLF)</div>
                <div>• <strong>Tags applied:</strong> {mezmoTags}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Multi-Pipeline OpenTelemetry Collector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Multi-Pipeline OpenTelemetry Collector</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Forward logs, metrics, and traces to separate Mezmo pipelines using the OpenTelemetry Collector. Each telemetry type can be configured with its own pipeline ID and ingestion key.
            </p>

            {/* Master Enable/Disable Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium">Enable Multi-Pipeline OTEL Collector</Label>
                <p className="text-sm text-muted-foreground">
                  Route different telemetry types to separate Mezmo destinations
                </p>
              </div>
              <Switch
                checked={otelEnabled}
                onCheckedChange={handleOtelToggle}
              />
            </div>

            {/* Global Configuration */}
            <div className="space-y-4">
                {/* Service Name */}
                <div className="space-y-2">
                  <Label htmlFor="otel-service">Service Name</Label>
                  <Input
                    id="otel-service"
                    type="text"
                    value={otelServiceName}
                    onChange={(e) => setOtelServiceName(e.target.value)}
                    placeholder="restaurant-app"
                  />
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label htmlFor="otel-tags">Tags (comma-separated)</Label>
                  <Input
                    id="otel-tags"
                    type="text"
                    value={otelTags}
                    onChange={(e) => setOtelTags(e.target.value)}
                    placeholder="restaurant-app,otel,demo"
                  />
                </div>

                {/* Debug Level */}
                <div className="space-y-2">
                  <Label htmlFor="otel-debug">Debug Level</Label>
                  <Select value={otelDebugLevel} onValueChange={setOtelDebugLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debug">Debug (Very Verbose)</SelectItem>
                      <SelectItem value="info">Info (Recommended)</SelectItem>
                      <SelectItem value="warn">Warn (Minimal)</SelectItem>
                      <SelectItem value="error">Error (Critical Only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

            {/* Multi-Pipeline Configuration */}
            <div className="space-y-6">
                <Label className="text-base font-medium">Independent Pipeline Configuration</Label>
                
                {['logs', 'metrics', 'traces'].map((pipelineType) => (
                  <div key={pipelineType} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className={`font-medium capitalize ${
                          pipelineType === 'logs' ? 'text-blue-600' : 
                          pipelineType === 'metrics' ? 'text-green-600' : 'text-purple-600'
                        }`}>
                          {pipelineType === 'logs' && '📄'} 
                          {pipelineType === 'metrics' && '📊'} 
                          {pipelineType === 'traces' && '🔍'} 
                          {' '}{pipelineType} Pipeline
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {pipelineType === 'logs' && 'Forward structured log files to Mezmo'}
                          {pipelineType === 'metrics' && 'Send system and application metrics'}
                          {pipelineType === 'traces' && 'Receive traces via OTLP protocol'}
                        </p>
                      </div>
                      <Switch
                        checked={otelPipelines[pipelineType].enabled}
                        onCheckedChange={(checked) => updateOtelPipeline(pipelineType, 'enabled', checked)}
                      />
                    </div>

                    {otelPipelines[pipelineType].enabled && (
                      <div className="space-y-3 pt-3 border-t">
                        {/* Ingestion Key for this pipeline */}
                        <div className="space-y-2">
                          <Label>Ingestion Key</Label>
                          <div className="relative">
                            <Input
                              type={otelPipelines[pipelineType].showKey ? "text" : "password"}
                              value={otelPipelines[pipelineType].ingestionKey}
                              onChange={(e) => updateOtelPipeline(pipelineType, 'ingestionKey', e.target.value)}
                              placeholder={`Enter ${pipelineType} pipeline ingestion key`}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => updateOtelPipeline(pipelineType, 'showKey', !otelPipelines[pipelineType].showKey)}
                            >
                              {otelPipelines[pipelineType].showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        {/* Pipeline ID */}
                        <div className="space-y-2">
                          <Label>Pipeline ID (Optional)</Label>
                          <Input
                            type="text"
                            value={otelPipelines[pipelineType].pipelineId}
                            onChange={(e) => updateOtelPipeline(pipelineType, 'pipelineId', e.target.value)}
                            placeholder="12cfb094-6c7a-11f0-871b-a6a8e5244714"
                          />
                          <p className="text-xs text-muted-foreground">
                            For Mezmo Pipelines, enter the Pipeline ID. Leave empty for legacy LogDNA endpoints.
                          </p>
                        </div>

                        {/* Auto-generated endpoint display */}
                        {otelPipelines[pipelineType].pipelineId && (
                          <div className="bg-muted/50 p-3 rounded">
                            <Label className="text-xs font-medium">Auto-generated Endpoint:</Label>
                            <code className="text-xs text-muted-foreground block mt-1">
                              {otelPipelines[pipelineType].endpoint}
                            </code>
                          </div>
                        )}

                        {/* Host (for legacy) */}
                        {!otelPipelines[pipelineType].pipelineId && (
                          <div className="space-y-2">
                            <Label>Mezmo Host (Legacy)</Label>
                            <Input
                              type="text"
                              value={otelPipelines[pipelineType].host}
                              onChange={(e) => updateOtelPipeline(pipelineType, 'host', e.target.value)}
                              placeholder="logs.mezmo.com"
                            />
                            <p className="text-xs text-muted-foreground">
                              Only used for legacy LogDNA endpoints
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

            {/* Action Buttons */}
            <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    onClick={handleOtelConfigure}
                    disabled={!Object.values(otelPipelines).some(p => p.enabled && p.ingestionKey.trim())}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Save Multi-Pipeline Config
                  </Button>
                  
                  <Button
                    onClick={handleTestOtelConnection}
                    disabled={!Object.values(otelPipelines).some(p => p.enabled && p.ingestionKey.trim()) || otelStatus === 'connecting'}
                    variant="outline"
                  >
                    <Monitor className="mr-2 h-4 w-4" />
                    Test Connection
                  </Button>

                  <Button
                    onClick={handleViewOtelLogs}
                    variant="outline"
                    className="border-orange-200 text-orange-600 hover:bg-orange-50"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    View Logs
                  </Button>

                  <Button
                    onClick={handleDebugOtel}
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Debug Info
                  </Button>
                </div>
                
                <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded border border-blue-200">
                  <strong>💡 Multi-Pipeline Tips:</strong> Each pipeline can have its own ingestion key and Pipeline ID. 
                  This allows you to send logs, metrics, and traces to different Mezmo destinations for better organization.
                </div>
              </div>

            {/* Status Display */}
            <div className="space-y-4">
              {/* Connection Status */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  {otelStatus === 'connected' && <CheckCircle className="h-5 w-5 text-green-600" />}
                  {otelStatus === 'disconnected' && <CloudOff className="h-5 w-5 text-gray-500" />}
                  {otelStatus === 'connecting' && <Monitor className="h-5 w-5 text-blue-600 animate-pulse" />}
                  {otelStatus === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
                  <span className="font-medium">
                    Collector Status: {otelStatus.charAt(0).toUpperCase() + otelStatus.slice(1)}
                  </span>
                  {otelPid && (
                    <span className="text-sm text-muted-foreground ml-2">
                      (PID: {otelPid})
                    </span>
                  )}
                </div>
                
                {otelLastSync && (
                  <p className="text-sm text-muted-foreground">
                    Last sync: {new Date(otelLastSync).toLocaleString()}
                  </p>
                )}
                
                {otelStats.lastError && (
                  <p className="text-sm text-red-600 mt-2">
                    Last error: {otelStats.lastError}
                  </p>
                )}
              </div>

              {/* Pipeline Statistics */}
              {Object.values(otelPipelines).some(pipeline => pipeline.enabled) && (
                <div className="grid grid-cols-3 gap-4 bg-muted/50 p-4 rounded-lg">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${otelPipelines.logs.enabled ? 'text-blue-600' : 'text-gray-400'}`}>
                      {otelStats.logsSent || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Logs Sent</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${otelPipelines.metrics.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                      {otelStats.metricsCollected || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Metrics Collected</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${otelPipelines.traces.enabled ? 'text-purple-600' : 'text-gray-400'}`}>
                      {otelStats.tracesReceived || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Traces Received</div>
                  </div>
                </div>
              )}
            </div>

            {/* OTEL Architecture Documentation */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
              <div className="flex items-start space-x-2">
                <Info className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-green-900">OpenTelemetry Architecture</p>
                  <div className="text-green-800 space-y-1">
                    <p><strong>Logs Pipeline:</strong> Forwards all 6 log files (access, events, performance, metrics, errors, app) as structured logs</p>
                    <p><strong>Metrics Pipeline:</strong> Collects system telemetry (CPU, memory, disk, network) as proper metrics</p>
                    <p><strong>Traces Pipeline:</strong> Receives application traces via OTLP protocol (gRPC port 4317)</p>
                    <p><strong>Benefit:</strong> Separates log data from metrics data for optimal analysis in Mezmo</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Information Sections */}
            <div className="space-y-4">
              {/* OTLP Endpoints Information */}
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Activity className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-800">OTLP Receiver Endpoints</span>
                </div>
                <div className="space-y-1 text-sm text-green-700">
                  <div>• <strong>gRPC:</strong> localhost:4317</div>
                  <div>• <strong>HTTP:</strong> localhost:4318</div>
                  <div>• <strong>Protocols:</strong> OpenTelemetry Protocol (OTLP)</div>
                  <div>• <strong>Active when:</strong> Any pipeline is enabled</div>
                  <div>• <strong>Multi-Pipeline:</strong> Separate destinations for logs, metrics, and traces</div>
                </div>
              </div>

              {/* Demo Environment Warning */}
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium text-yellow-800">Demo Environment</span>
                </div>
                <p className="text-sm text-yellow-700">
                  This is a demo environment. Your ingestion key is stored locally in browser storage only.
                  In production, use secure environment variables or secrets management.
                </p>
              </div>

              {/* Telemetry Information */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Multi-Pipeline Configuration Summary</span>
                </div>
                <div className="space-y-1 text-sm text-blue-700">
                  <div>• <strong>Mode:</strong> Multi-Pipeline Mezmo Integration</div>
                  <div>• <strong>Logs Pipeline:</strong> {otelPipelines.logs.enabled ? 
                    (otelPipelines.logs.pipelineId ? `Pipeline ${otelPipelines.logs.pipelineId}` : 'Configured') : 
                    'Disabled'}</div>
                  <div>• <strong>Metrics Pipeline:</strong> {otelPipelines.metrics.enabled ? 
                    (otelPipelines.metrics.pipelineId ? `Pipeline ${otelPipelines.metrics.pipelineId}` : 'Configured') : 
                    'Disabled'}</div>
                  <div>• <strong>Traces Pipeline:</strong> {otelPipelines.traces.enabled ? 
                    (otelPipelines.traces.pipelineId ? `Pipeline ${otelPipelines.traces.pipelineId}` : 'Configured') : 
                    'Disabled'}</div>
                  <div>• <strong>Service:</strong> {otelServiceName}</div>
                  <div>• <strong>Tags:</strong> {otelTags}</div>
                </div>
              </div>

              {/* Troubleshooting Guide */}
              <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="font-medium text-orange-800">Troubleshooting Guide</span>
                </div>
                <div className="space-y-2 text-sm text-orange-700">
                  <div><strong>1. Check Collector Status:</strong> Ensure status shows "Connected" above</div>
                  <div><strong>2. View Logs:</strong> Click "View Logs" button to see collector output</div>
                  <div><strong>3. Verify Pipeline Setup:</strong> Ensure each needed pipeline is enabled with valid keys</div>
                  <div><strong>4. Check Log Files:</strong> Verify files exist in /tmp/codeuser/*.log</div>
                  <div><strong>5. Test Pipeline Keys:</strong> Use "Test Connection" for each enabled pipeline</div>
                  <div><strong>6. Check Network:</strong> Ensure connectivity to pipeline endpoints</div>
                  <div><strong>7. Restart Collector:</strong> Use "Configure OTEL" to restart with new settings</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* HTTP Error Testing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <span>HTTP Error Testing</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Test HTTP error logging using real API endpoints with invalid data or non-existent resources. All errors will be captured in the performance logs and sent through OTEL collector to Mezmo.
              </p>

              {/* Server Health Status */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Monitor className="h-4 w-4" />
                  <span className="font-medium">Server Status</span>
                </div>
                {healthLoading ? (
                  <div className="text-sm text-muted-foreground">Checking server health...</div>
                ) : healthError ? (
                  <div className="text-sm text-red-600">❌ Server unavailable</div>
                ) : (
                  <div className="text-sm text-green-600">✅ Server online - {healthData?.status}</div>
                )}
              </div>

              {/* Error Testing Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestError(400)}
                  disabled={testError.isPending}
                  className="bg-red-50 border-red-200 hover:bg-red-100"
                >
                  Test 400
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestError(401)}
                  disabled={testError.isPending}
                  className="bg-red-50 border-red-200 hover:bg-red-100"
                >
                  Test 401
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestError(404)}
                  disabled={testError.isPending}
                  className="bg-red-50 border-red-200 hover:bg-red-100"
                >
                  Test 404
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestError(422)}
                  disabled={testError.isPending}
                  className="bg-red-50 border-red-200 hover:bg-red-100"
                >
                  Test 422
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestError(500)}
                  disabled={testError.isPending}
                  className="bg-orange-50 border-orange-200 hover:bg-orange-100"
                >
                  Test 500
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestError(502)}
                  disabled={testError.isPending}
                  className="bg-orange-50 border-orange-200 hover:bg-orange-100"
                >
                  Test 502
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestError(503)}
                  disabled={testError.isPending}
                  className="bg-orange-50 border-orange-200 hover:bg-orange-100"
                >
                  Test 503
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestError(504)}
                  disabled={testError.isPending}
                  className="bg-orange-50 border-orange-200 hover:bg-orange-100"
                >
                  Test 504
                </Button>
              </div>

              {/* Advanced Testing */}
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={handleTestRandomError}
                    disabled={testRandomError.isPending}
                    className="bg-purple-50 border-purple-200 hover:bg-purple-100"
                  >
                    🎲 Random Error
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleTestTimeout}
                    disabled={testTimeout.isPending}
                    className="bg-yellow-50 border-yellow-200 hover:bg-yellow-100"
                  >
                    ⏱️ Test Timeout
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleTestPerformance}
                    disabled={testPerformance.isPending}
                    className="bg-blue-50 border-blue-200 hover:bg-blue-100"
                  >
                    📊 Performance Test
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                <strong>Legend:</strong> 
                <span className="ml-2">🔴 4xx Client Errors</span>
                <span className="ml-2">🟠 5xx Server Errors</span>
                <span className="ml-2">🟣 Random</span>
                <span className="ml-2">🟡 Timeout</span>
                <span className="ml-2">🔵 Performance</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stress Testing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5" />
              <span>API Stress Testing</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <p className="text-muted-foreground">
                Generate high-volume API requests to test performance limits and create load testing data. Uses real endpoints with configurable request rates, concurrency, and error injection.
              </p>


              {/* Configuration Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stress-duration">Duration (seconds)</Label>
                  <Input
                    id="stress-duration"
                    type="number"
                    min="10"
                    max="300"
                    value={stressTestDuration}
                    onChange={(e) => setStressTestDuration(parseInt(e.target.value) || 30)}
                    disabled={stressTestRunning}
                    className="w-full"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="stress-rps">Requests/Second</Label>
                  <Input
                    id="stress-rps"
                    type="number"
                    min="1"
                    max="20"
                    value={stressTestRPS}
                    onChange={(e) => setStressTestRPS(parseInt(e.target.value) || 5)}
                    disabled={stressTestRunning}
                    className="w-full"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="stress-concurrent">Concurrent</Label>
                  <Input
                    id="stress-concurrent"
                    type="number"
                    min="1"
                    max="50"
                    value={stressTestConcurrent}
                    onChange={(e) => setStressTestConcurrent(parseInt(e.target.value) || 3)}
                    disabled={stressTestRunning}
                    className="w-full"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="stress-error-rate">Error Rate (%)</Label>
                  <Input
                    id="stress-error-rate"
                    type="number"
                    min="0"
                    max="50"
                    value={stressTestErrorRate}
                    onChange={(e) => setStressTestErrorRate(parseInt(e.target.value) || 20)}
                    disabled={stressTestRunning}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={handleStartStressTest}
                  disabled={stressTestRunning || !loggingEnabled}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Stress Test
                </Button>
                
                <Button
                  onClick={handleStopStressTest}
                  disabled={!stressTestRunning}
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop Test
                </Button>
              </div>

              {!loggingEnabled && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Structured logging is disabled. Enable it above to capture stress test data.
                  </p>
                </div>
              )}

              {/* Progress and Stats */}
              {(stressTestRunning || stressTestProgress > 0) && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{Math.round(stressTestProgress)}%</span>
                    </div>
                    <Progress value={stressTestProgress} className="w-full" />
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-muted/50 p-4 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{stressTestStats.totalRequests}</div>
                      <div className="text-xs text-muted-foreground">Total Requests</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{stressTestStats.successCount}</div>
                      <div className="text-xs text-muted-foreground">Success</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{stressTestStats.errorCount}</div>
                      <div className="text-xs text-muted-foreground">Errors</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{stressTestStats.avgResponseTime}ms</div>
                      <div className="text-xs text-muted-foreground">Avg Response</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{stressTestStats.timeRemaining}s</div>
                      <div className="text-xs text-muted-foreground">Time Left</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Safety Information */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Safety Limits</span>
                </div>
                <div className="space-y-1 text-sm text-blue-700">
                  <div>• Maximum duration: 5 minutes (300 seconds)</div>
                  <div>• Maximum rate: 20 requests per second</div>
                  <div>• Maximum concurrent: 50 requests</div>
                  <div>• Only one stress test can run at a time</div>
                  <div>• All requests will be logged to performance system</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Virtual Traffic Simulator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Virtual Traffic Simulator</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <p className="text-muted-foreground">
                Simulate continuous realistic website traffic with virtual users browsing, shopping, and interacting with your site. 
                Perfect for testing observability, generating traces, and maintaining constant activity.
              </p>

              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div className="space-y-1">
                  <h4 className="font-medium">Enable Virtual Traffic</h4>
                  <p className="text-sm text-muted-foreground">
                    Continuous simulation of real user behavior
                  </p>
                </div>
                <Switch
                  checked={trafficEnabled}
                  onCheckedChange={handleTrafficToggle}
                />
              </div>

              {/* Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="traffic-users">Target Concurrent Users</Label>
                  <Input
                    id="traffic-users"
                    type="number"
                    min="1"
                    max="20"
                    value={trafficTargetUsers}
                    onChange={(e) => handleTrafficUsersChange(parseInt(e.target.value) || 5)}
                    disabled={!trafficEnabled}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">Base number of concurrent users</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Journey Pattern</Label>
                  <Select 
                    value={trafficPattern} 
                    onValueChange={handleTrafficPatternChange}
                    disabled={!trafficEnabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mixed">Mixed Behaviors</SelectItem>
                      <SelectItem value="buyers">Focused Buyers</SelectItem>
                      <SelectItem value="browsers">Casual Browsers</SelectItem>
                      <SelectItem value="researchers">Detail Researchers</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {trafficPattern === 'mixed' && 'All user types with varied behaviors'}
                    {trafficPattern === 'buyers' && 'Purchase-focused users'}
                    {trafficPattern === 'browsers' && 'Extensive browsing without buying'}
                    {trafficPattern === 'researchers' && 'Detail-oriented product research'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Traffic Timing</Label>
                  <Select 
                    value={trafficTiming} 
                    onValueChange={handleTrafficTimingChange}
                    disabled={!trafficEnabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="steady">Steady Target</SelectItem>
                      <SelectItem value="normal">Normal Traffic</SelectItem>
                      <SelectItem value="peak">Peak Hours</SelectItem>
                      <SelectItem value="low">Low Traffic</SelectItem>
                      <SelectItem value="burst">Burst Pattern</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {trafficTiming === 'steady' && 'Maintains exact target concurrent users'}
                    {trafficTiming === 'normal' && 'Steady, consistent user arrivals'}
                    {trafficTiming === 'peak' && '50% more users, faster arrivals'}
                    {trafficTiming === 'low' && '40% fewer users, slower arrivals'}
                    {trafficTiming === 'burst' && 'Random bursts of high activity'}
                  </p>
                </div>
              </div>

              {/* Live Statistics */}
              {trafficEnabled && (
                <div className="space-y-4">
                  <h4 className="font-medium">Live Traffic Statistics</h4>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/50 p-4 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{trafficStats.activeUsers}</div>
                      <div className="text-xs text-muted-foreground">Active Users</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{trafficStats.totalSessionsToday}</div>
                      <div className="text-xs text-muted-foreground">Sessions Today</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{trafficStats.totalOrders}</div>
                      <div className="text-xs text-muted-foreground">Orders Placed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{trafficStats.averageSessionDuration}s</div>
                      <div className="text-xs text-muted-foreground">Avg Session</div>
                    </div>
                  </div>

                  {/* Current Activities */}
                  {trafficStats.currentActivities.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium">Current User Activities</h5>
                      <div className="flex flex-wrap gap-2">
                        {trafficStats.currentActivities.map((activity, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                          >
                            {activity.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Information */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <div className="font-medium mb-1">How Virtual Traffic Works</div>
                    <div className="space-y-1 text-xs">
                      <div>• Spawns virtual users at realistic intervals (30s-2min)</div>
                      <div>• Users follow authentic journey patterns (browsing, shopping, checkout)</div>
                      <div>• Generates real API calls, traces, and logs</div>
                      <div>• Natural bounce rate and session variety</div>
                      <div>• Maintains target user count with variance for realism</div>
                      <div>• Integrates with OpenTelemetry tracing when enabled</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sample Order Generation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ShoppingCart className="h-5 w-5" />
              <span>Generate Sample Orders</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <p className="text-muted-foreground">
                Generate realistic sample orders using random customer data and products. This creates real API requests and generates proper logs for testing your logging system.
              </p>

              {/* Configuration */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sampleOrdersCount">Number of Orders</Label>
                  <Input
                    id="sampleOrdersCount"
                    type="number"
                    min="1"
                    max="100"
                    value={sampleOrdersCount}
                    onChange={(e) => setSampleOrdersCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                    disabled={sampleOrdersRunning}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="sampleOrdersDelay">Delay (ms)</Label>
                  <Input
                    id="sampleOrdersDelay"
                    type="number"
                    min="100"
                    max="10000"
                    value={sampleOrdersDelay}
                    onChange={(e) => setSampleOrdersDelay(Math.max(100, Math.min(10000, parseInt(e.target.value) || 1000)))}
                    disabled={sampleOrdersRunning}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="sampleOrdersType">Order Type</Label>
                  <Select
                    value={sampleOrdersType}
                    onValueChange={setSampleOrdersType}
                    disabled={sampleOrdersRunning}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="random">Random</SelectItem>
                      <SelectItem value="takeout">Takeout Only</SelectItem>
                      <SelectItem value="delivery">Delivery Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex space-x-2">
                <Button
                  onClick={handleStartSampleOrders}
                  disabled={sampleOrdersRunning || !loggingEnabled}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Generating Orders
                </Button>
                
                <Button
                  onClick={handleStopSampleOrders}
                  disabled={!sampleOrdersRunning}
                  variant="outline"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              </div>

              {/* Warning when logging is disabled */}
              {!loggingEnabled && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Structured logging is disabled. Enable it above to capture order generation logs.
                  </p>
                </div>
              )}

              {/* Progress and Stats */}
              {(sampleOrdersRunning || sampleOrdersProgress > 0) && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{Math.round(sampleOrdersProgress)}%</span>
                    </div>
                    <Progress value={sampleOrdersProgress} className="w-full" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 bg-muted/50 p-4 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{sampleOrdersStats.created}</div>
                      <div className="text-xs text-muted-foreground">Orders Created</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{sampleOrdersStats.successful}</div>
                      <div className="text-xs text-muted-foreground">Successful</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{sampleOrdersStats.failed}</div>
                      <div className="text-xs text-muted-foreground">Failed</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Information Box */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">How it Works</span>
                </div>
                <div className="space-y-1 text-sm text-blue-700">
                  <div>• Generates realistic customer names, emails, and phone numbers</div>
                  <div>• Creates orders with random products from your menu</div>
                  <div>• Uses valid test credit card information</div>
                  <div>• Simulates payment processing with 10% random failure rate</div>
                  <div>• Generates PAYMENT_PROCESSING logs (initiated → processing → success/failed)</div>
                  <div>• Generates DATA_OPERATION logs for successful orders</div>
                  <div>• Only successful payments are saved to DataStore</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Failure Simulation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-600">
              <Skull className="h-5 w-5" />
              <span>🚨 System Failure Simulation</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-red-800">⚠️ DANGER ZONE</span>
                </div>
                <p className="text-sm text-red-700">
                  This will cause REAL system failures that affect the actual application functionality.
                  Orders, reservations, and other features will genuinely fail during simulation.
                  Use only for demonstrating Mezmo's alert and anomaly detection capabilities.
                </p>
              </div>

              {failureActive && failureStatus && (
                <div className="bg-red-100 border border-red-300 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="font-medium text-red-800">FAILURE SIMULATION ACTIVE</span>
                    </div>
                    <Button
                      onClick={stopFailure}
                      variant="destructive"
                      size="sm"
                    >
                      <StopCircle className="mr-2 h-4 w-4" />
                      Stop
                    </Button>
                  </div>
                  <div className="space-y-2 text-sm text-red-700">
                    <div>Scenario: {failureScenarios.find(s => s.id === failureStatus.scenario)?.name}</div>
                    <div>Progress: {failureStatus.progress}%</div>
                    <div>Remaining: {Math.ceil(failureStatus.remaining / 1000)}s</div>
                    {failureStatus.details?.cascadeStage > 0 && (
                      <div>Cascade Stage: {failureStatus.details.cascadeStage}/5</div>
                    )}
                    {failureStatus.details?.memoryLeakArrays > 0 && (
                      <div>Memory Arrays: {failureStatus.details.memoryLeakArrays}</div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Failure Scenario</Label>
                  <Select
                    value={failureScenario}
                    onValueChange={handleScenarioChange}
                    disabled={failureActive}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a failure scenario" />
                    </SelectTrigger>
                    <SelectContent>
                      {failureScenarios.map((scenario) => (
                        <SelectItem key={scenario.id} value={scenario.id}>
                          <div className="flex items-center space-x-2">
                            <span>{scenario.icon}</span>
                            <span>{scenario.name}</span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              scenario.severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                            }`}>
                              {scenario.severity}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {failureScenario && (
                  <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                    <div className="space-y-2">
                      <h4 className="font-medium">{failureScenarios.find(s => s.id === failureScenario)?.name}</h4>
                      <p className="text-sm text-gray-600">
                        {failureScenarios.find(s => s.id === failureScenario)?.description}
                      </p>
                      <div className="bg-red-50 border border-red-200 p-3 rounded">
                        <p className="text-sm text-red-800">
                          <strong>Impact:</strong> {failureScenarios.find(s => s.id === failureScenario)?.impact}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Duration (seconds)</Label>
                  <Input
                    type="number"
                    value={failureDuration}
                    onChange={(e) => setFailureDuration(Math.max(10, Math.min(300, parseInt(e.target.value) || 60)))}
                    min="10"
                    max="300"
                    disabled={failureActive}
                  />
                  <p className="text-xs text-muted-foreground">
                    Duration between 10-300 seconds. Failure will automatically stop after this time.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <AlertDialog open={showFailureDialog} onOpenChange={setShowFailureDialog}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      disabled={!failureScenario || failureActive}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Skull className="mr-2 h-4 w-4" />
                      Trigger System Failure
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-red-600">⚠️ Confirm System Failure</AlertDialogTitle>
                      <AlertDialogDescription>
                        You are about to trigger a real system failure that will affect the actual application:
                        <br /><br />
                        <strong>{failureScenarios.find(s => s.id === failureScenario)?.name}</strong>
                        <br />
                        Duration: {failureDuration} seconds
                        <br /><br />
                        <span className="text-red-600">
                          This will cause REAL failures that users and tests will experience.
                          Are you sure you want to continue?
                        </span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={triggerFailure}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Yes, Trigger Failure
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Information */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">How Failure Simulation Works</span>
                </div>
                <div className="space-y-1 text-sm text-blue-700">
                  <div>• <strong>Real Impact:</strong> Actually affects running application functionality</div>
                  <div>• <strong>Logs Generated:</strong> All failures logged to `/tmp/codeuser/restaurant-performance.log`</div>
                  <div>• <strong>Tracing:</strong> Error spans created with real stack traces</div>
                  <div>• <strong>Metrics:</strong> Performance degradation visible in metrics</div>
                  <div>• <strong>Auto-Stop:</strong> Failures automatically stop after duration</div>
                  <div>• <strong>Manual Stop:</strong> Can be stopped immediately using the Stop button</div>
                  <div>• <strong>Data Safety:</strong> No permanent data damage - corrupted data is restored</div>
                </div>
              </div>

              {/* Scenario Details */}
              <div className="space-y-3">
                <h4 className="font-medium">Available Scenarios:</h4>
                <div className="grid gap-3">
                  {failureScenarios.map((scenario) => (
                    <div key={scenario.id} className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-lg">{scenario.icon}</span>
                            <span className="font-medium">{scenario.name}</span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              scenario.severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                            }`}>
                              {scenario.severity}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{scenario.description}</p>
                          <p className="text-xs text-red-600">Impact: {scenario.impact}</p>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          Default: {scenario.defaultDuration}s
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Export Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Download className="h-5 w-5" />
              <span>Export Data</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Download all your restaurant data as a JSON file for backup or transfer to another device.
            </p>
            <Button onClick={handleExport} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Download Data as JSON
            </Button>
          </CardContent>
        </Card>

        {/* Import Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>Import Data</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Restore your restaurant data from a previously exported JSON file.
            </p>
            
            <div>
              <Label htmlFor="file-upload">Upload JSON File</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="file-upload"
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  className="flex-1"
                />
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  Browse
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="json-data">Or Paste JSON Data</Label>
              <Textarea
                id="json-data"
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste your JSON data here..."
                rows={8}
                className="mt-2 font-mono text-sm"
              />
            </div>

            <Button 
              onClick={handleImport} 
              disabled={!importData.trim()}
              className="w-full sm:w-auto"
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Data
            </Button>
          </CardContent>
        </Card>

        {/* Reset Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Danger Zone</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Reset all data to default values. This action cannot be undone.
            </p>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset All Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all your 
                    products, reservations, and orders, and reset everything to default values.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Yes, reset everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How to Use Data Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <strong className="text-foreground">Export:</strong> Click "Download Data as JSON" to save all your current data to a file.
              </div>
              <div>
                <strong className="text-foreground">Import:</strong> Upload a previously exported JSON file or paste JSON data to restore your information.
              </div>
              <div>
                <strong className="text-foreground">Backup Strategy:</strong> Regularly export your data to keep backups, especially before making major changes.
              </div>
              <div>
                <strong className="text-foreground">Transfer:</strong> Use export/import to move data between different devices or browsers.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* OTEL Logs Dialog */}
      <Dialog open={showOtelLogs} onOpenChange={setShowOtelLogs}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>OpenTelemetry Collector Logs</DialogTitle>
            <DialogDescription>
              Last 50 lines from /tmp/codeuser/otel-collector.log
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
              <pre>{otelLogs}</pre>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleViewOtelLogs}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button 
                onClick={() => setShowOtelLogs(false)}
                variant="outline"
                size="sm"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* OTEL Debug Info Dialog */}
      <Dialog open={showDebugInfo} onOpenChange={setShowDebugInfo}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>OpenTelemetry Collector Debug Information</DialogTitle>
            <DialogDescription>
              Comprehensive diagnostic information for troubleshooting
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {debugInfo && (
              <>
                {/* Collector Status */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Collector Components</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>Binary exists: {debugInfo.collector.binary ? '✅' : '❌'}</div>
                    <div>Config exists: {debugInfo.collector.configExists ? '✅' : '❌'}</div>
                    <div>Process running: {debugInfo.collector.pidExists ? '✅' : '❌'}</div>
                    <div>Log file exists: {debugInfo.collector.logExists ? '✅' : '❌'}</div>
                  </div>
                </div>

                {/* Log Directory Status */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Log Directory Status</h3>
                  <div className="text-sm space-y-1">
                    <div>Directory exists: {debugInfo.logDirectory.exists ? '✅' : '❌'}</div>
                    {debugInfo.logDirectory.permissions && (
                      <div>Permissions: {debugInfo.logDirectory.permissions}</div>
                    )}
                    <div>Log files found: {debugInfo.logDirectory.files.length}</div>
                    {debugInfo.logDirectory.files.map(file => (
                      <div key={file.name} className="ml-4">
                        📄 {file.name} ({file.size} bytes, modified: {new Date(file.modified).toLocaleString()})
                      </div>
                    ))}
                    {debugInfo.logDirectory.error && (
                      <div className="text-red-600">Error: {debugInfo.logDirectory.error}</div>
                    )}
                  </div>
                </div>

                {/* Configuration */}
                {debugInfo.config && (
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Current Configuration</h3>
                    <div className="bg-black text-green-400 p-3 rounded font-mono text-xs max-h-48 overflow-y-auto">
                      <pre>{debugInfo.config}</pre>
                    </div>
                  </div>
                )}

                {/* Recent Logs */}
                {debugInfo.recentLogs && (
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Recent Collector Logs</h3>
                    <div className="bg-black text-green-400 p-3 rounded font-mono text-xs max-h-48 overflow-y-auto">
                      <pre>{debugInfo.recentLogs}</pre>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleDebugOtel}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button 
              onClick={() => setShowDebugInfo(false)}
              variant="outline"
              size="sm"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Config;