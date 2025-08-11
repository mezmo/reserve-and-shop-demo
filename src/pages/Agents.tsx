import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Cloud, 
  Activity, 
  Save, 
  Play, 
  Square, 
  TestTube, 
  Eye, 
  EyeOff, 
  Info,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  Settings
} from 'lucide-react';

interface MezmoConfig {
  enabled: boolean;
  ingestionKey: string;
  host: string;
  tags: string;
}

interface OtelPipeline {
  enabled: boolean;
  ingestionKey: string;
  pipelineId: string;
  host: string;
}

interface OtelConfig {
  enabled: boolean;
  serviceName: string;
  tags: string;
  pipelines: {
    logs: OtelPipeline;
    metrics: OtelPipeline;
    traces: OtelPipeline;
  };
}

interface AgentConfiguration {
  displayName: string;
  mezmo: MezmoConfig;
  otel: OtelConfig;
}

interface AgentsConfigFile {
  defaultConfig: string;
  configurations: Record<string, AgentConfiguration>;
}

const Agents = () => {
  const { toast } = useToast();

  // Configuration management state
  const [availableConfigs, setAvailableConfigs] = useState<Record<string, AgentConfiguration>>({});
  const [activeConfig, setActiveConfig] = useState<string>('custom');
  const [hasFileConfig, setHasFileConfig] = useState(false);

  // Mezmo configuration state
  const [mezmoEnabled, setMezmoEnabled] = useState(false);
  const [mezmoIngestionKey, setMezmoIngestionKey] = useState('');
  const [mezmoHost, setMezmoHost] = useState('logs.mezmo.com');
  const [mezmoTags, setMezmoTags] = useState('restaurant-app,demo');
  const [mezmoStatus, setMezmoStatus] = useState('disconnected');
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
  const [otelStatus, setOtelStatus] = useState('disconnected');
  const [otelPid, setOtelPid] = useState<number | null>(null);
  const [otelLastSync, setOtelLastSync] = useState<string | null>(null);
  const [otelStats, setOtelStats] = useState({
    metricsCollected: 0,
    logsProcessed: 0,
    tracesReceived: 0,
    errors: 0,
    lastError: null as string | null
  });

  // Multi-pipeline OTEL configuration
  const [otelPipelines, setOtelPipelines] = useState({
    logs: {
      enabled: false,
      ingestionKey: '',
      pipelineId: '',
      host: 'logs.mezmo.com'
    },
    metrics: {
      enabled: false,
      ingestionKey: '',
      pipelineId: '',
      host: 'logs.mezmo.com'
    },
    traces: {
      enabled: false,
      ingestionKey: '',
      pipelineId: '',
      host: 'logs.mezmo.com'
    }
  });

  // UI state
  const [showIngestionKeys, setShowIngestionKeys] = useState({
    mezmo: false,
    logs: false,
    metrics: false,
    traces: false
  });

  // Error tracking state
  const [lastError, setLastError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Load configurations from file if available
  useEffect(() => {
    const loadFileConfigurations = async () => {
      try {
        const response = await fetch('/api/agents/configurations');
        if (response.ok) {
          const data = await response.json();
          if (data.configurations && Object.keys(data.configurations).length > 0) {
            setAvailableConfigs(data.configurations);
            setHasFileConfig(true);
            
            // Apply default configuration if specified
            if (data.defaultConfig && data.configurations[data.defaultConfig]) {
              setActiveConfig(data.defaultConfig);
              applyConfiguration(data.configurations[data.defaultConfig]);
            }
          }
        }
      } catch (error) {
        console.error('Error loading agent configurations:', error);
      }
    };

    loadFileConfigurations();
  }, []);

  // Load saved configuration from localStorage or server
  useEffect(() => {
    const loadSavedConfiguration = async () => {
      // Check Mezmo service status
      try {
        const statusResponse = await fetch('/api/mezmo/status');
        const status = await statusResponse.json();
        
        if (statusResponse.ok) {
          const isRunning = status.status === 'connected' && status.pid !== null;
          setMezmoEnabled(isRunning);
          setMezmoPid(status.pid);
          setMezmoStatus(status.status);
          
          // Load configuration from localStorage if no file config
          if (!hasFileConfig) {
            const savedMezmoConfig = localStorage.getItem('mezmo-config');
            if (savedMezmoConfig) {
              const config = JSON.parse(savedMezmoConfig);
              setMezmoIngestionKey(config.ingestionKey || '');
              setMezmoHost(config.host || 'logs.mezmo.com');
              setMezmoTags(config.tags || 'restaurant-app,demo');
            }
          }
        }
      } catch (error) {
        console.error('Error checking Mezmo service status:', error);
      }

      // Check OTEL service status
      try {
        const statusResponse = await fetch('/api/otel/status');
        const status = await statusResponse.json();
        
        if (statusResponse.ok) {
          const isRunning = status.status === 'connected' && status.pid !== null;
          setOtelEnabled(isRunning);
          setOtelPid(status.pid);
          setOtelStatus(status.status);
          
          // Load configuration from localStorage if no file config
          if (!hasFileConfig) {
            const savedOtelConfig = localStorage.getItem('otel-config');
            if (savedOtelConfig) {
              const config = JSON.parse(savedOtelConfig);
              setOtelServiceName(config.serviceName || 'restaurant-app');
              setOtelTags(config.tags || 'restaurant-app,otel');
              if (config.pipelines) {
                setOtelPipelines(config.pipelines);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking OTEL service status:', error);
      }
    };

    if (!hasFileConfig) {
      loadSavedConfiguration();
    }
  }, [hasFileConfig]);

  // Apply a configuration preset
  const applyConfiguration = (config: AgentConfiguration) => {
    // Apply Mezmo configuration
    setMezmoIngestionKey(config.mezmo.ingestionKey);
    setMezmoHost(config.mezmo.host);
    setMezmoTags(config.mezmo.tags);
    
    // Apply OTEL configuration
    setOtelServiceName(config.otel.serviceName);
    setOtelTags(config.otel.tags);
    setOtelPipelines(config.otel.pipelines);
    
    toast({
      title: "Configuration Applied",
      description: `Loaded ${config.displayName} configuration`
    });
  };

  // Handle configuration change
  const handleConfigChange = async (configName: string) => {
    setActiveConfig(configName);
    
    if (configName === 'custom') {
      // Load from localStorage
      const savedMezmoConfig = localStorage.getItem('mezmo-config');
      const savedOtelConfig = localStorage.getItem('otel-config');
      
      if (savedMezmoConfig) {
        const config = JSON.parse(savedMezmoConfig);
        setMezmoIngestionKey(config.ingestionKey || '');
        setMezmoHost(config.host || 'logs.mezmo.com');
        setMezmoTags(config.tags || 'restaurant-app,demo');
      }
      
      if (savedOtelConfig) {
        const config = JSON.parse(savedOtelConfig);
        setOtelServiceName(config.serviceName || 'restaurant-app');
        setOtelTags(config.tags || 'restaurant-app,otel');
        if (config.pipelines) {
          setOtelPipelines(config.pipelines);
        }
      }
    } else if (availableConfigs[configName]) {
      applyConfiguration(availableConfigs[configName]);
    }
  };

  // Mezmo handlers
  const saveMezmoConfig = () => {
    const config = {
      enabled: mezmoEnabled,
      ingestionKey: mezmoIngestionKey,
      host: mezmoHost,
      tags: mezmoTags
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
      // Configure the agent
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
        throw new Error('Failed to configure agent');
      }
      
      // Start the agent
      const startResponse = await fetch('/api/mezmo/start', {
        method: 'POST'
      });
      
      const result = await startResponse.json();
      
      if (startResponse.ok) {
        setMezmoStatus('connected');
        setMezmoLastSync(new Date().toISOString());
        setMezmoPid(result.pid);
        toast({
          title: "Mezmo Agent Started",
          description: `LogDNA agent is now forwarding logs (PID: ${result.pid}).`
        });
      } else {
        throw new Error(result.error || 'Failed to start agent');
      }
    } catch (error: any) {
      setMezmoStatus('error');
      setMezmoStats(prev => ({ 
        ...prev, 
        errors: prev.errors + 1,
        lastError: error.message
      }));
      toast({
        title: "Failed to Start Mezmo Agent",
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
      setMezmoPid(null);
      toast({
        title: "Mezmo Agent Stopped",
        description: result.message || "Log forwarding has been disabled."
      });
    } catch (error) {
      toast({
        title: "Stop Failed",
        description: "Could not stop Mezmo agent.",
        variant: "destructive"
      });
    }
  };

  const handleTestMezmoConnection = async () => {
    if (!validateMezmoConfig()) return;
    
    setMezmoStatus('connecting');
    
    try {
      const configResponse = await fetch('/api/mezmo/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingestionKey: mezmoIngestionKey,
          host: mezmoHost,
          tags: mezmoTags,
          enabled: false
        })
      });
      
      if (!configResponse.ok) {
        throw new Error('Failed to configure agent');
      }
      
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
    } catch (error: any) {
      setMezmoStatus('error');
      toast({
        title: "Connection Test Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // OTEL handlers
  const saveOtelConfig = async () => {
    const config = {
      enabled: otelEnabled,
      serviceName: otelServiceName,
      tags: otelTags,
      pipelines: otelPipelines
    };
    
    try {
      setLastError(null);
      setErrorDetails(null);
      
      localStorage.setItem('otel-config', JSON.stringify(config));
      
      // Save to server if we have at least one pipeline with ingestion key
      const hasAnyIngestionKey = Object.values(otelPipelines).some(p => p.ingestionKey);
      
      if (hasAnyIngestionKey) {
        const response = await fetch('/api/otel/configure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceName: otelServiceName,
            tags: otelTags,
            // Convert pipelines object to individual parameters expected by server
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
          })
        });
        
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          const errorMsg = result.error || `Failed to save configuration (HTTP ${response.status})`;
          setLastError(`Failed to configure OTEL Collector: ${errorMsg}`);
          setErrorDetails({
            httpStatus: response.status,
            serverResponse: result,
            requestConfig: config,
            timestamp: new Date().toISOString()
          });
          throw new Error(errorMsg);
        }
        
        toast({
          title: "OTEL Configuration Saved",
          description: "Configuration saved and config file generated."
        });
      } else {
        toast({
          title: "OTEL Configuration Saved Locally",
          description: "Add ingestion keys to save to server."
        });
      }
    } catch (error: any) {
      if (!lastError) {
        const errorMsg = error.message || 'Unknown error';
        setLastError(`Failed to save OTEL configuration: ${errorMsg}`);
        setErrorDetails({
          error: error.stack || error.toString(),
          requestConfig: config,
          timestamp: new Date().toISOString()
        });
      }
      
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleOtelToggle = async (enabled: boolean) => {
    setOtelEnabled(enabled);
    localStorage.setItem('otel-config', JSON.stringify({
      enabled,
      serviceName: otelServiceName,
      tags: otelTags,
      pipelines: otelPipelines
    }));
    
    if (enabled) {
      const hasAnyIngestionKey = Object.values(otelPipelines).some(p => p.ingestionKey);
      if (hasAnyIngestionKey) {
        await handleStartOtelCollector();
      }
    } else {
      await handleStopOtelCollector();
    }
  };

  const handleStartOtelCollector = async () => {
    setOtelStatus('connecting');
    
    try {
      // Configure the collector
      const configResponse = await fetch('/api/otel/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName: otelServiceName,
          tags: otelTags,
          // Convert pipelines object to individual parameters expected by server
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
        })
      });
      
      if (!configResponse.ok) {
        throw new Error('Failed to configure OTEL Collector');
      }
      
      // Start the collector
      const startResponse = await fetch('/api/otel/start', {
        method: 'POST'
      });
      
      const result = await startResponse.json();
      
      if (startResponse.ok) {
        setOtelStatus('connected');
        setOtelPid(result.pid);
        setOtelLastSync(new Date().toISOString());
        toast({
          title: "OTEL Collector Started",
          description: `OpenTelemetry Collector is running (PID: ${result.pid}).`
        });
      } else {
        throw new Error(result.error || 'Failed to start collector');
      }
    } catch (error: any) {
      setOtelStatus('error');
      setOtelStats(prev => ({ 
        ...prev, 
        errors: prev.errors + 1,
        lastError: error.message
      }));
      toast({
        title: "Failed to Start OTEL Collector",
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
      setOtelPid(null);
      toast({
        title: "OTEL Collector Stopped",
        description: result.message || "Telemetry forwarding has been disabled."
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
    setOtelStatus('connecting');
    
    try {
      const configResponse = await fetch('/api/otel/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName: otelServiceName,
          tags: otelTags,
          pipelines: otelPipelines
        })
      });
      
      if (!configResponse.ok) {
        throw new Error('Failed to configure OTEL Collector');
      }
      
      const statusResponse = await fetch('/api/otel/status');
      const status = await statusResponse.json();
      
      if (statusResponse.ok && status.hasConfig) {
        setOtelStatus('connected');
        toast({
          title: "Configuration Test Successful",
          description: "OTEL configuration is valid."
        });
      } else {
        throw new Error('Configuration test failed');
      }
    } catch (error: any) {
      setOtelStatus('error');
      toast({
        title: "Configuration Test Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Update OTEL pipeline configuration
  const updateOtelPipeline = (pipelineType: 'logs' | 'metrics' | 'traces', field: string, value: any) => {
    setOtelPipelines(prev => ({
      ...prev,
      [pipelineType]: {
        ...prev[pipelineType],
        [field]: value
      }
    }));
  };

  // Poll agent status periodically
  useEffect(() => {
    const pollStatus = async () => {
      // Poll Mezmo status
      if (mezmoEnabled) {
        try {
          const response = await fetch('/api/mezmo/status');
          const status = await response.json();
          
          if (response.ok) {
            setMezmoStatus(status.status);
            setMezmoPid(status.pid);
            
            const isRunning = status.status === 'connected' && status.pid !== null;
            if (!isRunning && mezmoEnabled) {
              setMezmoEnabled(false);
            }
          }
        } catch (error) {
          console.warn('Could not check Mezmo status:', error);
        }
      }
      
      // Poll OTEL status
      if (otelEnabled) {
        try {
          const response = await fetch('/api/otel/status');
          const status = await response.json();
          
          if (response.ok) {
            setOtelStatus(status.status);
            setOtelPid(status.pid);
            
            const isRunning = status.status === 'connected' && status.pid !== null;
            if (!isRunning && otelEnabled) {
              setOtelEnabled(false);
            }
            
            // Fetch metrics if available
            if (isRunning) {
              try {
                const metricsResponse = await fetch('/api/otel/metrics');
                if (metricsResponse.ok) {
                  const metrics = await metricsResponse.json();
                  setOtelStats(metrics);
                }
              } catch (error) {
                console.warn('Could not fetch OTEL metrics:', error);
              }
            }
          }
        } catch (error) {
          console.warn('Could not check OTEL status:', error);
        }
      }
    };
    
    const interval = setInterval(pollStatus, 5000);
    pollStatus(); // Initial poll
    
    return () => clearInterval(interval);
  }, [mezmoEnabled, otelEnabled]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'disconnected':
        return <XCircle className="h-4 w-4 text-gray-400" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'connecting':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Info className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Agent Configuration</h1>
        <p className="text-muted-foreground">
          Configure Mezmo and OpenTelemetry agents for log and telemetry forwarding
        </p>
      </div>

      {/* Configuration Selector */}
      {hasFileConfig && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Configuration Preset</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <Label htmlFor="config-select" className="min-w-fit">Select Configuration:</Label>
              <Select value={activeConfig} onValueChange={handleConfigChange}>
                <SelectTrigger id="config-select" className="w-[300px]">
                  <SelectValue placeholder="Select a configuration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Configuration</SelectItem>
                  {Object.entries(availableConfigs).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeConfig !== 'custom' && (
                <Badge variant="secondary">Using Preset</Badge>
              )}
            </div>
            {activeConfig !== 'custom' && availableConfigs[activeConfig] && (
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  You are using the <strong>{availableConfigs[activeConfig].displayName}</strong> configuration preset.
                  You can still modify values below, which will override the preset temporarily.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="mezmo" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="mezmo" className="flex items-center space-x-2">
            <Cloud className="h-4 w-4" />
            <span>Mezmo Log Forwarding</span>
          </TabsTrigger>
          <TabsTrigger value="otel" className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>OpenTelemetry Collector</span>
          </TabsTrigger>
        </TabsList>

        {/* Mezmo Configuration Tab */}
        <TabsContent value="mezmo">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Mezmo Log Forwarding</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(mezmoStatus)}
                  <Badge variant={mezmoStatus === 'connected' ? 'success' : 'secondary'}>
                    {mezmoStatus}
                  </Badge>
                  {mezmoPid && (
                    <Badge variant="outline">PID: {mezmoPid}</Badge>
                  )}
                </div>
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

              {/* Configuration Fields */}
              <div className="space-y-4">
                {/* Ingestion Key */}
                <div className="space-y-2">
                  <Label htmlFor="mezmo-key">Ingestion Key</Label>
                  <div className="relative">
                    <Input
                      id="mezmo-key"
                      type={showIngestionKeys.mezmo ? "text" : "password"}
                      value={mezmoIngestionKey}
                      onChange={(e) => setMezmoIngestionKey(e.target.value)}
                      placeholder="Enter your Mezmo ingestion key"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowIngestionKeys(prev => ({ ...prev, mezmo: !prev.mezmo }))}
                    >
                      {showIngestionKeys.mezmo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                  <Save className="mr-2 h-4 w-4" />
                  Save Configuration
                </Button>
                
                <Button
                  onClick={handleTestMezmoConnection}
                  disabled={!mezmoIngestionKey.trim() || mezmoStatus === 'connecting'}
                  variant="outline"
                >
                  <TestTube className="mr-2 h-4 w-4" />
                  Test Connection
                </Button>
              </div>

              {/* Status Information */}
              {mezmoStatus === 'connected' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-900">Agent Active</span>
                  </div>
                  <div className="text-sm text-green-800 space-y-1">
                    <p>Process ID: {mezmoPid}</p>
                    {mezmoLastSync && (
                      <p>Last sync: {new Date(mezmoLastSync).toLocaleTimeString()}</p>
                    )}
                    <p>Logs sent: {mezmoStats.logsSent}</p>
                    {mezmoStats.errors > 0 && (
                      <p>Errors: {mezmoStats.errors}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Architecture Documentation */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <div className="flex items-start space-x-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-blue-900">Mezmo Log Forwarding</p>
                    <div className="text-blue-800 space-y-1">
                      <p><strong>What it forwards:</strong> All 6 structured log files</p>
                      <p><strong>Destination:</strong> Your Mezmo logs account</p>
                      <p><strong>Format:</strong> Original log format preserved (JSON)</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OpenTelemetry Configuration Tab */}
        <TabsContent value="otel">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Multi-Pipeline OpenTelemetry Collector</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(otelStatus)}
                  <Badge variant={otelStatus === 'connected' ? 'success' : 'secondary'}>
                    {otelStatus}
                  </Badge>
                  {otelPid && (
                    <Badge variant="outline">PID: {otelPid}</Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-muted-foreground">
                Forward logs, metrics, and traces to separate Mezmo pipelines using the OpenTelemetry Collector.
              </p>

              {/* Master Enable/Disable Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Enable OTEL Collector</Label>
                  <p className="text-sm text-muted-foreground">
                    Route different telemetry types to separate Mezmo destinations
                  </p>
                </div>
                <Switch
                  checked={otelEnabled}
                  onCheckedChange={handleOtelToggle}
                />
              </div>

              {/* General Configuration */}
              <div className="space-y-4">
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

                <div className="space-y-2">
                  <Label htmlFor="otel-tags">Tags (comma-separated)</Label>
                  <Input
                    id="otel-tags"
                    type="text"
                    value={otelTags}
                    onChange={(e) => setOtelTags(e.target.value)}
                    placeholder="restaurant-app,otel,production"
                  />
                </div>
              </div>

              {/* Pipeline Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Pipeline Configuration</h3>
                
                {(['logs', 'metrics', 'traces'] as const).map((pipelineType) => (
                  <Card key={pipelineType}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4" />
                          <span className="capitalize">{pipelineType} Pipeline</span>
                        </div>
                        <Switch
                          checked={otelPipelines[pipelineType].enabled}
                          onCheckedChange={(checked) => updateOtelPipeline(pipelineType, 'enabled', checked)}
                        />
                      </CardTitle>
                    </CardHeader>
                    {otelPipelines[pipelineType].enabled && (
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          <Label>Ingestion Key</Label>
                          <div className="relative">
                            <Input
                              type={showIngestionKeys[pipelineType] ? "text" : "password"}
                              value={otelPipelines[pipelineType].ingestionKey}
                              onChange={(e) => updateOtelPipeline(pipelineType, 'ingestionKey', e.target.value)}
                              placeholder={`Enter ${pipelineType} ingestion key`}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowIngestionKeys(prev => ({ 
                                ...prev, 
                                [pipelineType]: !prev[pipelineType as keyof typeof prev] 
                              }))}
                            >
                              {showIngestionKeys[pipelineType as keyof typeof showIngestionKeys] ? 
                                <EyeOff className="h-4 w-4" /> : 
                                <Eye className="h-4 w-4" />
                              }
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Pipeline ID (Optional)</Label>
                          <Input
                            type="text"
                            value={otelPipelines[pipelineType].pipelineId}
                            onChange={(e) => updateOtelPipeline(pipelineType, 'pipelineId', e.target.value)}
                            placeholder="For Mezmo Pipelines, enter the Pipeline ID"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Host</Label>
                          <Input
                            type="text"
                            value={otelPipelines[pipelineType].host}
                            onChange={(e) => updateOtelPipeline(pipelineType, 'host', e.target.value)}
                            placeholder="logs.mezmo.com"
                          />
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={saveOtelConfig}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Configuration
                </Button>
                
                <Button
                  onClick={handleTestOtelConnection}
                  disabled={otelStatus === 'connecting'}
                  variant="outline"
                >
                  <TestTube className="mr-2 h-4 w-4" />
                  Test Configuration
                </Button>
                
                <Button
                  onClick={() => {
                    const diagnostics = {
                      otelEnabled,
                      otelServiceName,
                      tracesConfig: {
                        enabled: otelPipelines.traces.enabled,
                        hasIngestionKey: !!otelPipelines.traces.ingestionKey,
                        ingestionKeyLength: otelPipelines.traces.ingestionKey?.length || 0,
                        pipelineId: otelPipelines.traces.pipelineId,
                        host: otelPipelines.traces.host
                      },
                      localStorageConfig: JSON.parse(localStorage.getItem('otel-config') || '{}'),
                      tracingInitialized: typeof window !== 'undefined' && localStorage.getItem('otel-config') !== null
                    };
                    
                    console.log('🔍 OTEL Traces Diagnostics:', diagnostics);
                    navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
                    
                    toast({
                      title: "Traces Diagnostics",
                      description: "Diagnostic info logged to console and copied to clipboard."
                    });
                  }}
                  variant="outline"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Debug Traces
                </Button>
              </div>

              {/* Traces Configuration Status */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2">
                <div className="flex items-start space-x-2">
                  <Info className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-yellow-900">Traces Pipeline Status</p>
                    <div className="text-yellow-800 space-y-1">
                      <p><strong>Traces Enabled:</strong> {otelPipelines.traces.enabled ? '✅ Yes' : '❌ No'}</p>
                      <p><strong>Ingestion Key:</strong> {otelPipelines.traces.ingestionKey ? `✅ Set (${otelPipelines.traces.ingestionKey.length} chars)` : '❌ Missing'}</p>
                      <p><strong>Pipeline ID:</strong> {otelPipelines.traces.pipelineId || 'Not set (using legacy endpoint)'}</p>
                      <p><strong>Valid for Server:</strong> {otelPipelines.traces.enabled && otelPipelines.traces.ingestionKey ? '✅ Ready' : '❌ Needs both enabled + ingestion key'}</p>
                      <p><strong>Frontend Tracing:</strong> {JSON.parse(localStorage.getItem('otel-config') || '{}').pipelines?.traces?.enabled ? '✅ Configured' : '❌ Not initialized'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Information */}
              {otelStatus === 'connected' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-900">Collector Active</span>
                  </div>
                  <div className="text-sm text-green-800 space-y-1">
                    <p>Process ID: {otelPid}</p>
                    {otelLastSync && (
                      <p>Last sync: {new Date(otelLastSync).toLocaleTimeString()}</p>
                    )}
                    <p>Logs processed: {otelStats.logsProcessed}</p>
                    <p>Metrics collected: {otelStats.metricsCollected}</p>
                    <p>Traces received: {otelStats.tracesReceived}</p>
                    {otelStats.errors > 0 && (
                      <p>Errors: {otelStats.errors}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Architecture Documentation */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <div className="flex items-start space-x-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-blue-900">OpenTelemetry Architecture</p>
                    <div className="text-blue-800 space-y-1">
                      <p><strong>Logs Pipeline:</strong> Forwards structured log files</p>
                      <p><strong>Metrics Pipeline:</strong> Collects system and app metrics</p>
                      <p><strong>Traces Pipeline:</strong> Receives traces via OTLP protocol</p>
                      <p><strong>Protocol:</strong> OTLP/HTTP on ports 4317 (gRPC) and 4318 (HTTP)</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Error Display Section */}
      {lastError && (
        <div className="mt-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800">Agent Configuration Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{lastError}</p>
                </div>
                
                {errorDetails && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowErrorDetails(!showErrorDetails)}
                      className="text-sm text-red-600 hover:text-red-500 font-medium flex items-center"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      {showErrorDetails ? 'Hide' : 'Show'} Technical Details
                    </button>
                    
                    {showErrorDetails && (
                      <div className="mt-3 p-4 bg-red-100 rounded border text-xs text-red-800 font-mono max-w-full overflow-auto">
                        <div className="space-y-3">
                          <div>
                            <strong className="text-red-900">Timestamp:</strong>
                            <div className="mt-1">{errorDetails.timestamp}</div>
                          </div>
                          
                          {errorDetails.httpStatus && (
                            <div>
                              <strong className="text-red-900">HTTP Status:</strong>
                              <div className="mt-1">{errorDetails.httpStatus}</div>
                            </div>
                          )}
                          
                          {errorDetails.serverResponse && (
                            <div>
                              <strong className="text-red-900">Server Response:</strong>
                              <pre className="mt-1 whitespace-pre-wrap bg-white p-2 rounded border text-xs">
                                {JSON.stringify(errorDetails.serverResponse, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {errorDetails.requestConfig && (
                            <div>
                              <strong className="text-red-900">Request Configuration:</strong>
                              <pre className="mt-1 whitespace-pre-wrap bg-white p-2 rounded border text-xs">
                                {JSON.stringify(errorDetails.requestConfig, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {errorDetails.error && (
                            <div>
                              <strong className="text-red-900">Client Error Details:</strong>
                              <pre className="mt-1 whitespace-pre-wrap bg-white p-2 rounded border text-xs">
                                {errorDetails.error}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      setLastError(null);
                      setErrorDetails(null);
                      setShowErrorDetails(false);
                    }}
                    className="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded flex items-center"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Dismiss Error
                  </button>
                  
                  <button
                    onClick={() => {
                      if (errorDetails) {
                        const errorInfo = {
                          error: lastError,
                          details: errorDetails,
                          userAgent: navigator.userAgent,
                          timestamp: new Date().toISOString()
                        };
                        navigator.clipboard.writeText(JSON.stringify(errorInfo, null, 2))
                          .then(() => {
                            toast({
                              title: "Error Details Copied",
                              description: "Error information copied to clipboard for support."
                            });
                          });
                      }
                    }}
                    className="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded flex items-center"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Copy for Support
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agents;