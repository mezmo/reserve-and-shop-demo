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
import { Download, Upload, RefreshCw, Settings, AlertTriangle, Activity, FileText, Monitor, Zap, Play, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePerformance } from '@/hooks/usePerformance';
import { useTestError, useTestRandomError, useTestTimeout, useTestPerformance, useHealthCheck } from '@/services/apiService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

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
  
  const { toast } = useToast();
  const { getConfig, updateConfig, getSessionId, getStoredLogs, clearStoredLogs, flushLogs } = usePerformance();
  const performanceConfig = getConfig();
  
  // HTTP testing mutations
  const testError = useTestError();
  const testRandomError = useTestRandomError();
  const testTimeout = useTestTimeout();
  const testPerformance = useTestPerformance();
  const { data: healthData, isLoading: healthLoading, error: healthError } = useHealthCheck();

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

  // HTTP error testing functions
  const handleTestError = async (statusCode: number, delay: number = 0) => {
    try {
      await testError.mutateAsync({ statusCode, delay });
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
    try {
      await testRandomError.mutateAsync();
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
    try {
      await testTimeout.mutateAsync(3000); // 3 second timeout
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
    try {
      const result = await testPerformance.mutateAsync();
      toast({
        title: "Performance Test Complete",
        description: `Response time: ${result.delay_ms}ms. Check logs for details.`
      });
    } catch (error: any) {
      toast({
        title: "Performance Test Failed",
        description: "Performance test failed. Error has been logged.",
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
      const errorCodes = [400, 401, 404, 422, 500, 502, 503, 504];
      const randomCode = errorCodes[Math.floor(Math.random() * errorCodes.length)];
      return { type: 'error', code: randomCode };
    } else {
      const successEndpoints = ['health', 'products', 'performance', 'random'];
      const randomEndpoint = successEndpoints[Math.floor(Math.random() * successEndpoints.length)];
      return { type: 'success', endpoint: randomEndpoint };
    }
  };

  const makeStressTestRequest = async (endpoint: any) => {
    const startTime = performance.now();
    
    try {
      if (endpoint.type === 'error') {
        await testError.mutateAsync({ statusCode: endpoint.code, delay: 0 });
      } else {
        switch (endpoint.endpoint) {
          case 'health':
            await fetch('/api/health');
            break;
          case 'products':
            await fetch('/api/products');
            break;
          case 'performance':
            await testPerformance.mutateAsync();
            break;
          case 'random':
            await testRandomError.mutateAsync();
            break;
          default:
            await fetch('/api/health');
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
    
    toast({
      title: "Stress Test Complete",
      description: `${total} requests sent. ${successRate}% success rate. Check performance logs for details.`
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
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Performance Monitoring */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Performance Monitoring</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6">
              {/* Enable/Disable Performance Logging */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Enable Performance Logging</Label>
                  <p className="text-sm text-muted-foreground">
                    Track page loads, route changes, and user interactions
                  </p>
                </div>
                <Switch
                  checked={performanceConfig.enabled}
                  onCheckedChange={(checked) => handlePerformanceConfigChange('enabled', checked)}
                />
              </div>

              {/* Log Format */}
              <div className="space-y-2">
                <Label className="text-base font-medium">Log Format</Label>
                <Select
                  value={performanceConfig.format}
                  onValueChange={(value) => handlePerformanceConfigChange('format', value)}
                  disabled={!performanceConfig.enabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">String (Human readable)</SelectItem>
                    <SelectItem value="json">JSON (Machine parseable)</SelectItem>
                    <SelectItem value="clf">CLF (Common Log Format)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {performanceConfig.format === 'json' 
                    ? 'Structured JSON format for log parsing tools'
                    : performanceConfig.format === 'clf'
                    ? 'Common Log Format for web server logs (HTTP requests only)'
                    : 'Human-readable format for manual inspection'
                  }
                </p>
              </div>

              {/* Log Level */}
              <div className="space-y-2">
                <Label className="text-base font-medium">Log Detail Level</Label>
                <Select
                  value={performanceConfig.level}
                  onValueChange={(value) => handlePerformanceConfigChange('level', value)}
                  disabled={!performanceConfig.enabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic (Page loads only)</SelectItem>
                    <SelectItem value="detailed">Detailed (+ Components)</SelectItem>
                    <SelectItem value="debug">Debug (+ Memory usage)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Session Tracking */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Session Tracking</Label>
                  <p className="text-sm text-muted-foreground">
                    Track user sessions for journey analysis
                  </p>
                </div>
                <Switch
                  checked={performanceConfig.sessionTracking}
                  onCheckedChange={(checked) => handlePerformanceConfigChange('sessionTracking', checked)}
                  disabled={!performanceConfig.enabled}
                />
              </div>

              {/* Current Session Info */}
              {performanceConfig.enabled && performanceConfig.sessionTracking && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Monitor className="h-4 w-4" />
                    <span className="font-medium">Current Session</span>
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">
                    Session ID: {getSessionId()}
                  </p>
                </div>
              )}

              {/* Performance Log Actions */}
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button 
                    onClick={handleDownloadPerformanceLogs}
                    variant="outline"
                    size="sm"
                    disabled={!performanceConfig.enabled}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Logs
                  </Button>
                  <Button 
                    onClick={handleFlushLogs}
                    variant="outline"
                    size="sm"
                    disabled={!performanceConfig.enabled}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Flush to File
                  </Button>
                  <Button 
                    onClick={handleClearPerformanceLogs}
                    variant="outline"
                    size="sm"
                    disabled={!performanceConfig.enabled}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Clear Logs
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Download: Get logs as a file • Flush: Write buffered logs to /tmp/restaurant-performance.log • Clear: Remove all stored logs
                </p>
              </div>

              {/* Docker Log Information */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Docker Container Log Access</span>
                </div>
                <div className="space-y-2 text-sm text-blue-700">
                  <div>
                    <strong>Log Location:</strong> <code className="bg-blue-100 px-1 rounded">/tmp/restaurant-performance.log</code>
                  </div>
                  <div>
                    <strong>View logs:</strong> <code className="bg-blue-100 px-1 rounded">docker exec -it &lt;container_name&gt; tail -f /tmp/restaurant-performance.log</code>
                  </div>
                  <div>
                    <strong>Copy logs:</strong> <code className="bg-blue-100 px-1 rounded">docker cp &lt;container_name&gt;:/tmp/restaurant-performance.log ./performance.log</code>
                  </div>
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
                Test HTTP error logging by triggering different server responses. All errors will be captured in the performance logs.
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
                Generate high-volume API activity to stress test your performance monitoring and logging systems.
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
                  disabled={stressTestRunning || !performanceConfig.enabled}
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

              {!performanceConfig.enabled && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Performance logging is disabled. Enable it above to capture stress test data.
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
    </div>
  );
};

export default Config;