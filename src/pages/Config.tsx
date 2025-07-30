import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { DataStore } from '@/stores/dataStore';
import { Download, Upload, RefreshCw, Settings, AlertTriangle, Activity, FileText, Monitor, Zap, Play, Square, Cloud, CloudOff, CheckCircle, XCircle, Eye, EyeOff, Info } from 'lucide-react';
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

  // Mezmo configuration state
  const [mezmoEnabled, setMezmoEnabled] = useState(false);
  const [mezmoIngestionKey, setMezmoIngestionKey] = useState('');
  const [mezmoHost, setMezmoHost] = useState('logs.mezmo.com');
  const [mezmoTags, setMezmoTags] = useState('restaurant-app,demo');
  const [mezmoStatus, setMezmoStatus] = useState('disconnected'); // connected, disconnected, error
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
  const performanceConfig = getConfig();
  
  // New structured logging configuration state
  const [loggingEnabled, setLoggingEnabled] = useState(true);
  const [loggerConfigs, setLoggerConfigs] = useState({
    access: { level: 'INFO', format: 'clf', enabled: true },
    event: { level: 'DEBUG', format: 'json', enabled: true },
    metrics: { level: 'INFO', format: 'json', enabled: true },
    error: { level: 'WARN', format: 'json', enabled: true }
  });
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
    toast({
      title: enabled ? "Logging Enabled" : "Logging Disabled",
      description: enabled ? "All logging systems activated" : "All logging systems deactivated"
    });
  };

  const handleLoggerConfigChange = (loggerType, key, value) => {
    setLoggerConfigs(prev => ({
      ...prev,
      [loggerType]: {
        ...prev[loggerType],
        [key]: value
      }
    }));


    toast({
      title: "Logger Configuration Updated",
      description: `${loggerType} logger ${key} updated to ${value}`
    });
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

  const getCurrentDataSummary = () => {
    const dataStore = DataStore.getInstance();
    const data = dataStore.getAllData();
    return {
      products: data.products.length,
      reservations: data.reservations.length,
      orders: data.orders.length
    };
  };

  const summary = getCurrentDataSummary();

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

  const handleStartStressTest = () => {
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stressTestIntervalRef.current) {
        clearInterval(stressTestIntervalRef.current);
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
    try {
      const savedMezmoConfig = localStorage.getItem('mezmo-config');
      if (savedMezmoConfig) {
        const config = JSON.parse(savedMezmoConfig);
        setMezmoEnabled(config.enabled || false);
        setMezmoIngestionKey(config.ingestionKey || '');
        setMezmoHost(config.host || 'logs.mezmo.com');
        setMezmoTags(config.tags || 'restaurant-app,demo');
      }
    } catch (error) {
      console.error('Error loading Mezmo configuration:', error);
    }
  }, []);

  // Load OTEL configuration on mount
  useEffect(() => {
    try {
      const savedOtelConfig = localStorage.getItem('otel-config');
      if (savedOtelConfig) {
        const config = JSON.parse(savedOtelConfig);
        
        // Load basic configuration
        setOtelEnabled(config.enabled !== false);
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
    } catch (error) {
      console.error('Error loading OTEL configuration:', error);
    }
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

  const handleOtelToggle = (enabled: boolean) => {
    setOtelEnabled(enabled);
    if (enabled && otelIngestionKey) {
      // Auto-save when enabling with valid key
      setTimeout(() => saveOtelConfig(), 100);
      handleStartOtelCollector();
    } else if (!enabled) {
      // Save configuration when disabling
      setTimeout(() => saveOtelConfig(), 100);
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

  // Poll agent status periodically
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch('/api/mezmo/status');
        const status = await response.json();
        
        if (response.ok) {
          setMezmoStatus(status.status);
          if (status.status === 'connected' && !mezmoLastSync) {
            setMezmoLastSync(new Date().toISOString());
          }
        }
      } catch (error) {
        // Silently fail - don't spam the user with errors
        console.warn('Could not check LogDNA status:', error);
      }
    };

    // Poll every 10 seconds when enabled
    let interval;
    if (mezmoEnabled) {
      pollStatus(); // Check immediately
      interval = setInterval(pollStatus, 10000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mezmoEnabled, mezmoLastSync]);

  // Poll OTEL Collector status periodically
  useEffect(() => {
    const pollOtelStatus = async () => {
      try {
        const response = await fetch('/api/otel/status');
        const status = await response.json();
        
        if (response.ok) {
          setOtelStatus(status.status);
          
          // Sync UI enabled state with actual process status
          const isProcessRunning = status.status === 'connected';
          if (otelEnabled !== isProcessRunning) {
            setOtelEnabled(isProcessRunning);
          }
          
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
    let otelInterval;
    pollOtelStatus(); // Check immediately on mount/change
    otelInterval = setInterval(pollOtelStatus, 10000);

    return () => {
      if (otelInterval) clearInterval(otelInterval);
    };
  }, [otelEnabled, otelLastSync]);

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
                              {['json', 'clf', 'string', 'csv', 'xml', 'custom'].map((format) => (
                                <SelectItem key={format} value={format}>
                                  {format.toUpperCase()}
                                  {format === 'json' && ' (Structured)'}
                                  {format === 'clf' && ' (Common Log Format)'}
                                  {format === 'string' && ' (Human Readable)'}
                                  {format === 'csv' && ' (Spreadsheet)'}
                                  {format === 'xml' && ' (Markup)'}
                                  {format === 'custom' && ' (Template)'}
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
                        <p><strong>Log Level:</strong> Controls verbosity - DEBUG (most detailed) > INFO (standard) > WARN (warnings only) > ERROR (errors only)</p>
                        <p><strong>Format:</strong> Output structure - JSON for machine parsing, CLF for web servers, String for human reading</p>
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
            {otelEnabled && (
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
            )}

            {/* Multi-Pipeline Configuration */}
            {otelEnabled && (
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
            )}

            {/* Action Buttons */}
            {otelEnabled && (
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
            )}

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
                Generate high-volume API activity using real endpoints (products, orders, reservations, settings) to create authentic performance logs that flow through OTEL collector to Mezmo.
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