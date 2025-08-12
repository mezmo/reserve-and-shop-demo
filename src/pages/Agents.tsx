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
import { reinitializeTracing } from '@/lib/tracing/config';

// Host environment definitions
// Mezmo Agent hosts (for direct log forwarding)
const MEZMO_HOST_ENVIRONMENTS = {
  dev: {
    label: 'Development',
    host: 'logs.use.dev.logdna.net'
  },
  integration: {
    label: 'Integration', 
    host: 'logs.use.int.logdna.net'
  },
  production: {
    label: 'Production',
    host: 'logs.mezmo.com'
  },
  custom: {
    label: 'Custom',
    host: ''
  }
} as const;

// OTEL Pipeline hosts (for Pipeline product routing)
const OTEL_HOST_ENVIRONMENTS = {
  dev: {
    label: 'Development',
    host: 'pipeline.use.dev.logdna.net'
  },
  integration: {
    label: 'Integration',
    host: 'pipeline.use.int.logdna.net'
  },
  production: {
    label: 'Production',
    host: 'pipeline.mezmo.com'
  },
  custom: {
    label: 'Custom',
    host: ''
  }
} as const;

type HostEnvironment = keyof typeof HOST_ENVIRONMENTS;

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
      host: 'pipeline.mezmo.com'
    },
    metrics: {
      enabled: false,
      ingestionKey: '',
      pipelineId: '',
      host: 'pipeline.mezmo.com'
    },
    traces: {
      enabled: false,
      ingestionKey: '',
      pipelineId: '',
      host: 'pipeline.mezmo.com'
    }
  });

  // Host environment selection state
  const [mezmoHostEnv, setMezmoHostEnv] = useState<HostEnvironment>('production');
  const [mezmoCustomHost, setMezmoCustomHost] = useState('');
  const [otelHostEnvs, setOtelHostEnvs] = useState({
    logs: 'production' as HostEnvironment,
    metrics: 'production' as HostEnvironment,
    traces: 'production' as HostEnvironment
  });
  const [otelCustomHosts, setOtelCustomHosts] = useState({
    logs: '',
    metrics: '',
    traces: ''
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

  // Operation state tracking to prevent race conditions
  const [isChangingConfig, setIsChangingConfig] = useState(false);
  const [operationInProgress, setOperationInProgress] = useState({
    mezmo: false,
    otel: false
  });

  // Helper functions for host management
  const getMezmoHost = () => {
    return mezmoHostEnv === 'custom' ? mezmoCustomHost : MEZMO_HOST_ENVIRONMENTS[mezmoHostEnv].host;
  };

  const getOtelPipelineHost = (pipelineType: 'logs' | 'metrics' | 'traces') => {
    const env = otelHostEnvs[pipelineType];
    return env === 'custom' ? otelCustomHosts[pipelineType] : OTEL_HOST_ENVIRONMENTS[env].host;
  };

  const setMezmoHostEnvironment = (env: HostEnvironment, customHost?: string) => {
    setMezmoHostEnv(env);
    if (env === 'custom' && customHost !== undefined) {
      setMezmoCustomHost(customHost);
      setMezmoHost(customHost);
    } else {
      setMezmoHost(MEZMO_HOST_ENVIRONMENTS[env].host);
    }
  };

  const setOtelHostEnvironment = (pipelineType: 'logs' | 'metrics' | 'traces', env: HostEnvironment, customHost?: string) => {
    setOtelHostEnvs(prev => ({ ...prev, [pipelineType]: env }));
    if (env === 'custom' && customHost !== undefined) {
      setOtelCustomHosts(prev => ({ ...prev, [pipelineType]: customHost }));
      updateOtelPipeline(pipelineType, 'host', customHost);
    } else {
      updateOtelPipeline(pipelineType, 'host', OTEL_HOST_ENVIRONMENTS[env].host);
    }
  };

  const detectMezmoHostEnvironment = (host: string): { env: HostEnvironment; customHost?: string } => {
    for (const [key, envConfig] of Object.entries(MEZMO_HOST_ENVIRONMENTS)) {
      if (envConfig.host === host) {
        return { env: key as HostEnvironment };
      }
    }
    return { env: 'custom', customHost: host };
  };

  const detectOtelHostEnvironment = (host: string): { env: HostEnvironment; customHost?: string } => {
    for (const [key, envConfig] of Object.entries(OTEL_HOST_ENVIRONMENTS)) {
      if (envConfig.host === host) {
        return { env: key as HostEnvironment };
      }
    }
    return { env: 'custom', customHost: host };
  };

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
            
            // Check for saved active config first, then use default
            const savedActiveConfig = localStorage.getItem('agents-active-config');
            let configToApply = data.defaultConfig;
            
            if (savedActiveConfig && data.configurations[savedActiveConfig]) {
              configToApply = savedActiveConfig;
            } else if (data.defaultConfig && data.configurations[data.defaultConfig]) {
              configToApply = data.defaultConfig;
            }
            
            if (configToApply && data.configurations[configToApply]) {
              setActiveConfig(configToApply);
              applyConfiguration(data.configurations[configToApply]);
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
              const hostDetection = detectMezmoHostEnvironment(config.host || 'logs.mezmo.com');
              setMezmoHostEnv(hostDetection.env);
              if (hostDetection.env === 'custom' && hostDetection.customHost) {
                setMezmoCustomHost(hostDetection.customHost);
              }
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
                // Detect host environments for each pipeline
                Object.keys(config.pipelines).forEach((pipelineKey) => {
                  const pipelineType = pipelineKey as 'logs' | 'metrics' | 'traces';
                  const pipelineConfig = config.pipelines[pipelineType];
                  if (pipelineConfig?.host) {
                    const hostDetection = detectOtelHostEnvironment(pipelineConfig.host);
                    setOtelHostEnvs(prev => ({ ...prev, [pipelineType]: hostDetection.env }));
                    if (hostDetection.env === 'custom' && hostDetection.customHost) {
                      setOtelCustomHosts(prev => ({ ...prev, [pipelineType]: hostDetection.customHost! }));
                    }
                  }
                });
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

  // Apply a configuration preset directly from file (read-only for presets)
  const applyConfiguration = async (config: AgentConfiguration) => {
    console.log(`📋 Applying preset configuration: ${config.displayName}`, {
      mezmoKey: config.mezmo.ingestionKey ? config.mezmo.ingestionKey.substring(0, 8) + '...' : 'None',
      mezmoHost: config.mezmo.host,
      otelEnabled: config.otel.enabled
    });
    
    // Apply Mezmo configuration directly from file (no merging, no localStorage overrides)
    setMezmoIngestionKey(config.mezmo.ingestionKey);
    const mezmoHostDetection = detectMezmoHostEnvironment(config.mezmo.host);
    setMezmoHostEnv(mezmoHostDetection.env);
    if (mezmoHostDetection.env === 'custom' && mezmoHostDetection.customHost) {
      setMezmoCustomHost(mezmoHostDetection.customHost);
    }
    setMezmoHost(config.mezmo.host);
    setMezmoTags(config.mezmo.tags);
    
    // Apply OTEL configuration directly from file
    setOtelServiceName(config.otel.serviceName);
    setOtelTags(config.otel.tags);
    setOtelPipelines(config.otel.pipelines);
    
    // Apply OTEL host environments
    Object.keys(config.otel.pipelines).forEach((pipelineKey) => {
      const pipelineType = pipelineKey as 'logs' | 'metrics' | 'traces';
      const pipelineConfig = config.otel.pipelines[pipelineType];
      if (pipelineConfig?.host) {
        const hostDetection = detectOtelHostEnvironment(pipelineConfig.host);
        setOtelHostEnvs(prev => ({ ...prev, [pipelineType]: hostDetection.env }));
        if (hostDetection.env === 'custom' && hostDetection.customHost) {
          setOtelCustomHosts(prev => ({ ...prev, [pipelineType]: hostDetection.customHost! }));
        }
      }
    });
    
    // For preset configurations, we don't save to localStorage - they remain read-only
    
    toast({
      title: "Configuration Applied",
      description: `Loaded ${config.displayName} configuration`
    });
    
    // Reinitialize frontend tracing with new configuration
    try {
      reinitializeTracing().then(() => {
        console.log('Frontend tracing reinitialized after applying configuration preset');
      }).catch((tracingError) => {
        console.warn('Failed to reinitialize tracing:', tracingError);
      });
    } catch (tracingError) {
      console.warn('Failed to reinitialize tracing:', tracingError);
    }
  };

  // Handle configuration change
  const handleConfigChange = async (configName: string) => {
    if (isChangingConfig) {
      console.warn('Configuration change already in progress');
      return;
    }
    
    console.log(`🔄 Starting configuration change from "${activeConfig}" to "${configName}"`);
    console.log(`Current state before change:`, {
      mezmoKey: mezmoIngestionKey.substring(0, 8) + '...',
      mezmoHost,
      hasFileConfig,
      availableConfigKeys: Object.keys(availableConfigs)
    });
    
    setIsChangingConfig(true);
    
    try {
      // Stop any running agents before switching configurations
      const wasRunning = {
        mezmo: mezmoEnabled && mezmoStatus === 'connected',
        otel: otelEnabled && otelStatus === 'connected'
      };
      
      if (wasRunning.mezmo) {
        console.log('Stopping Mezmo agent before configuration change');
        setOperationInProgress(prev => ({ ...prev, mezmo: true }));
        await handleStopMezmoAgent();
        setOperationInProgress(prev => ({ ...prev, mezmo: false }));
      }
      
      if (wasRunning.otel) {
        console.log('Stopping OTEL collector before configuration change');
        setOperationInProgress(prev => ({ ...prev, otel: true }));
        await handleStopOtelCollector();
        setOperationInProgress(prev => ({ ...prev, otel: false }));
      }
      
      // Only save custom configuration when switching away from it
      if (activeConfig === 'custom') {
        const currentMezmoConfig = {
          enabled: mezmoEnabled,
          ingestionKey: mezmoIngestionKey,
          host: mezmoHost,
          tags: mezmoTags
        };
        
        const currentOtelConfig = {
          enabled: otelEnabled,
          serviceName: otelServiceName,
          tags: otelTags,
          pipelines: otelPipelines
        };
        
        localStorage.setItem('mezmo-config', JSON.stringify(currentMezmoConfig));
        localStorage.setItem('otel-config', JSON.stringify(currentOtelConfig));
        console.log('💾 Saved custom configuration before switching to preset');
      }

      setActiveConfig(configName);
      // Save the active config selection to localStorage
      localStorage.setItem('agents-active-config', configName);
    
    if (configName === 'custom') {
      // Load from localStorage
      const savedMezmoConfig = localStorage.getItem('mezmo-config');
      const savedOtelConfig = localStorage.getItem('otel-config');
      
      if (savedMezmoConfig) {
        const config = JSON.parse(savedMezmoConfig);
        setMezmoIngestionKey(config.ingestionKey || '');
        const hostDetection = detectMezmoHostEnvironment(config.host || 'logs.mezmo.com');
        setMezmoHostEnv(hostDetection.env);
        if (hostDetection.env === 'custom' && hostDetection.customHost) {
          setMezmoCustomHost(hostDetection.customHost);
        }
        setMezmoHost(config.host || 'logs.mezmo.com');
        setMezmoTags(config.tags || 'restaurant-app,demo');
      }
      
      if (savedOtelConfig) {
        const config = JSON.parse(savedOtelConfig);
        setOtelServiceName(config.serviceName || 'restaurant-app');
        setOtelTags(config.tags || 'restaurant-app,otel');
        if (config.pipelines) {
          setOtelPipelines(config.pipelines);
          // Detect host environments for each pipeline
          Object.keys(config.pipelines).forEach((pipelineKey) => {
            const pipelineType = pipelineKey as 'logs' | 'metrics' | 'traces';
            const pipelineConfig = config.pipelines[pipelineType];
            if (pipelineConfig?.host) {
              const hostDetection = detectOtelHostEnvironment(pipelineConfig.host);
              setOtelHostEnvs(prev => ({ ...prev, [pipelineType]: hostDetection.env }));
              if (hostDetection.env === 'custom' && hostDetection.customHost) {
                setOtelCustomHosts(prev => ({ ...prev, [pipelineType]: hostDetection.customHost! }));
              }
            }
          });
        }
      }
    } else if (availableConfigs[configName]) {
      console.log(`🔄 Applying ${configName} preset configuration (read-only)...`);
      await applyConfiguration(availableConfigs[configName]);
    } else {
      console.error(`❌ Configuration "${configName}" not found in availableConfigs:`, Object.keys(availableConfigs));
    }
    
      // Brief delay to allow configuration to settle
      await new Promise(resolve => setTimeout(resolve, 500));

      // Restart agents if they were previously running and have valid configs
      // Use current values from localStorage/config instead of potentially stale closure values
      const currentMezmoKey = configName === 'custom' ? 
        (JSON.parse(localStorage.getItem('mezmo-config') || '{}').ingestionKey || '') :
        (availableConfigs[configName]?.mezmo?.ingestionKey || '');
      const currentMezmoHost = configName === 'custom' ?
        (JSON.parse(localStorage.getItem('mezmo-config') || '{}').host || 'logs.mezmo.com') :
        (availableConfigs[configName]?.mezmo?.host || 'logs.mezmo.com');

      if (wasRunning.mezmo && currentMezmoKey && currentMezmoHost) {
        console.log('Restarting Mezmo agent with new configuration');
        setOperationInProgress(prev => ({ ...prev, mezmo: true }));
        try {
          await handleStartMezmoAgent();
        } catch (error: any) {
          console.error('Failed to restart Mezmo agent:', error);
          toast({
            title: "Failed to Restart Mezmo Agent",
            description: error.message,
            variant: "destructive"
          });
        } finally {
          setOperationInProgress(prev => ({ ...prev, mezmo: false }));
        }
      }
      
      const currentOtelPipelines = configName === 'custom' ?
        (JSON.parse(localStorage.getItem('otel-config') || '{}').pipelines || {}) :
        (availableConfigs[configName]?.otel?.pipelines || {});

      if (wasRunning.otel && Object.values(currentOtelPipelines).some((p: any) => p.ingestionKey)) {
        console.log('Restarting OTEL collector with new configuration');
        setOperationInProgress(prev => ({ ...prev, otel: true }));
        try {
          await handleStartOtelCollector();
        } catch (error: any) {
          console.error('Failed to restart OTEL collector:', error);
          toast({
            title: "Failed to Restart OTEL Collector", 
            description: error.message,
            variant: "destructive"
          });
        } finally {
          setOperationInProgress(prev => ({ ...prev, otel: false }));
        }
      }
    } catch (error: any) {
      console.error('Error during configuration change:', error);
      toast({
        title: "Configuration Change Failed",
        description: error.message || "Failed to change configuration",
        variant: "destructive"
      });
    } finally {
      setIsChangingConfig(false);
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

  const handleMezmoToggle = async (enabled: boolean) => {
    if (operationInProgress.mezmo || isChangingConfig) {
      toast({
        title: "Operation in Progress",
        description: "Please wait for the current Mezmo operation to complete.",
        variant: "destructive"
      });
      return;
    }
    
    // Validate before enabling
    if (enabled && (!mezmoIngestionKey.trim() || !mezmoHost.trim())) {
      toast({
        title: "Missing Configuration", 
        description: "Please configure ingestion key and host before enabling.",
        variant: "destructive"
      });
      return;
    }
    
    setOperationInProgress(prev => ({ ...prev, mezmo: true }));
    
    try {
      setMezmoEnabled(enabled);
      
      if (enabled && mezmoIngestionKey) {
        saveMezmoConfig();
        await handleStartMezmoAgent();
        
        // Wait 4 seconds then validate the agent is still running
        setTimeout(async () => {
          try {
            const statusResponse = await fetch('/api/mezmo/status');
            const statusResult = await statusResponse.json();
            
            if (!statusResult.pid || statusResult.status !== 'connected') {
              // Check for authentication errors in logs
              const logsResponse = await fetch('/api/mezmo/logs');
              if (logsResponse.ok) {
                const logsData = await logsResponse.json();
                
                if (logsData.recommendations) {
                  const authErrors = logsData.recommendations.filter((r: any) => r.issue.includes('Authentication'));
                  if (authErrors.length > 0) {
                    setMezmoStatus('error');
                    setMezmoEnabled(false);
                    toast({
                      title: "Agent Authentication Failed",
                      description: authErrors[0].solutions[0],
                      variant: "destructive"
                    });
                    return;
                  }
                }
              }
              
              // Generic failure message if no specific error found
              setMezmoStatus('error');
              setMezmoEnabled(false);
              toast({
                title: "Agent Failed to Start",
                description: "Agent failed to establish connection. Check configuration and try again.",
                variant: "destructive"
              });
            }
          } catch (error) {
            console.warn('Failed to validate agent startup:', error);
          }
        }, 4000);
        
      } else if (!enabled) {
        await handleStopMezmoAgent();
      }
    } catch (error: any) {
      setMezmoEnabled(!enabled); // Reset state on failure
      toast({ 
        title: "Operation Failed", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setOperationInProgress(prev => ({ ...prev, mezmo: false }));
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
    setMezmoStatus('disconnecting');
    try {
      const response = await fetch('/api/mezmo/stop', {
        method: 'POST'
      });
      
      const result = await response.json();
      
      setMezmoStatus('disconnected');
      setMezmoPid(null);
      setMezmoEnabled(false);
      toast({
        title: "Mezmo Agent Stopped",
        description: result.message || "Log forwarding has been disabled."
      });
    } catch (error) {
      setMezmoStatus('error');
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
        
        // Reinitialize frontend tracing with new configuration
        try {
          reinitializeTracing().then(() => {
            console.log('Frontend tracing reinitialized after OTEL config save');
          }).catch((tracingError) => {
            console.warn('Failed to reinitialize tracing:', tracingError);
          });
        } catch (tracingError) {
          console.warn('Failed to reinitialize tracing:', tracingError);
        }
      } else {
        toast({
          title: "OTEL Configuration Saved Locally",
          description: "Add ingestion keys to save to server."
        });
        
        // Reinitialize frontend tracing with new configuration
        try {
          reinitializeTracing().then(() => {
            console.log('Frontend tracing reinitialized after local OTEL config save');
          }).catch((tracingError) => {
            console.warn('Failed to reinitialize tracing:', tracingError);
          });
        } catch (tracingError) {
          console.warn('Failed to reinitialize tracing:', tracingError);
        }
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
    if (operationInProgress.otel || isChangingConfig) {
      console.warn('OTEL operation already in progress');
      return;
    }
    
    setOperationInProgress(prev => ({ ...prev, otel: true }));
    
    try {
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
    } finally {
      setOperationInProgress(prev => ({ ...prev, otel: false }));
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
    setOtelStatus('disconnecting');
    try {
      const response = await fetch('/api/otel/stop', {
        method: 'POST'
      });
      
      const result = await response.json();
      
      setOtelStatus('disconnected');
      setOtelPid(null);
      setOtelEnabled(false);
      toast({
        title: "OTEL Collector Stopped",
        description: result.message || "Telemetry forwarding has been disabled."
      });
    } catch (error) {
      setOtelStatus('error');
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
      // Skip polling during configuration changes or operations to prevent race conditions
      if (isChangingConfig || operationInProgress.mezmo || operationInProgress.otel) {
        return;
      }

      // Poll Mezmo status
      if (mezmoEnabled) {
        try {
          const response = await fetch('/api/mezmo/status');
          const status = await response.json();
          
          if (response.ok) {
            setMezmoStatus(status.status);
            setMezmoPid(status.pid);
            
            const isRunning = status.status === 'connected' && status.pid !== null;
            // Only auto-disable if agent status isn't 'connecting' (prevents disabling during startup)
            if (!isRunning && mezmoEnabled && mezmoStatus !== 'connecting') {
              console.warn('Mezmo agent detected as not running, disabling UI toggle');
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
            // Only auto-disable if collector status isn't 'connecting' (prevents disabling during startup)
            if (!isRunning && otelEnabled && otelStatus !== 'connecting') {
              console.warn('OTEL collector detected as not running, disabling UI toggle');
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

  // Helper to determine if current configuration is a read-only preset
  const isPresetConfiguration = activeConfig !== 'custom';

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
                  All values are read-only and loaded from agents-config.json file.
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
                {/* Read-only indicator for preset configurations */}
                {isPresetConfiguration && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      This is a preset configuration loaded from the agents-config.json file. Values are read-only.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Ingestion Key */}
                <div className="space-y-2">
                  <Label htmlFor="mezmo-key">
                    Ingestion Key
                    {isPresetConfiguration && <span className="ml-1 text-xs text-muted-foreground">(Read-only)</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      id="mezmo-key"
                      type={showIngestionKeys.mezmo ? "text" : "password"}
                      value={mezmoIngestionKey}
                      onChange={(e) => {
                        setMezmoIngestionKey(e.target.value);
                        // Auto-save only for custom configuration
                        if (activeConfig === 'custom') {
                          const updatedConfig = {
                            enabled: mezmoEnabled,
                            ingestionKey: e.target.value,
                            host: mezmoHost,
                            tags: mezmoTags
                          };
                          localStorage.setItem('mezmo-config', JSON.stringify(updatedConfig));
                        }
                      }}
                      placeholder={isPresetConfiguration ? "Configured from file" : "Enter your Mezmo ingestion key"}
                      className={`pr-10 ${isPresetConfiguration ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      readOnly={isPresetConfiguration}
                      disabled={isPresetConfiguration}
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

                {/* Host Environment Selection */}
                <div className="space-y-2">
                  <Label htmlFor="mezmo-host-env">
                    Mezmo Host Environment
                    {isPresetConfiguration && <span className="ml-1 text-xs text-muted-foreground">(Read-only)</span>}
                  </Label>
                  <Select
                    value={mezmoHostEnv}
                    onValueChange={(value: HostEnvironment) => setMezmoHostEnvironment(value)}
                    disabled={isPresetConfiguration}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select environment" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MEZMO_HOST_ENVIRONMENTS).map(([key, env]) => (
                        <SelectItem key={key} value={key}>
                          {env.label} {env.host && `(${env.host})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Custom host input */}
                  {mezmoHostEnv === 'custom' && (
                    <div className="mt-2">
                      <Label htmlFor="mezmo-custom-host">
                        Custom Host
                        {isPresetConfiguration && <span className="ml-1 text-xs text-muted-foreground">(Read-only)</span>}
                      </Label>
                      <Input
                        id="mezmo-custom-host"
                        type="text"
                        value={mezmoCustomHost}
                        onChange={(e) => {
                          setMezmoCustomHost(e.target.value);
                          setMezmoHost(e.target.value);
                          // Auto-save only for custom configuration
                          if (activeConfig === 'custom') {
                            const updatedConfig = {
                              enabled: mezmoEnabled,
                              ingestionKey: mezmoIngestionKey,
                              host: e.target.value,
                              tags: mezmoTags
                            };
                            localStorage.setItem('mezmo-config', JSON.stringify(updatedConfig));
                          }
                        }}
                        placeholder={isPresetConfiguration ? "Configured from file" : "Enter custom host URL"}
                        className={isPresetConfiguration ? 'bg-gray-50 cursor-not-allowed' : ''}
                        readOnly={isPresetConfiguration}
                        disabled={isPresetConfiguration}
                      />
                    </div>
                  )}
                  
                  {/* Current resolved host display */}
                  <div className="text-xs text-muted-foreground">
                    Current host: <code>{getMezmoHost()}</code>
                  </div>
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label htmlFor="mezmo-tags">
                    Tags (comma-separated)
                    {isPresetConfiguration && <span className="ml-1 text-xs text-muted-foreground">(Read-only)</span>}
                  </Label>
                  <Input
                    id="mezmo-tags"
                    type="text"
                    value={mezmoTags}
                    onChange={(e) => {
                      setMezmoTags(e.target.value);
                      // Auto-save only for custom configuration
                      if (activeConfig === 'custom') {
                        const updatedConfig = {
                          enabled: mezmoEnabled,
                          ingestionKey: mezmoIngestionKey,
                          host: mezmoHost,
                          tags: e.target.value
                        };
                        localStorage.setItem('mezmo-config', JSON.stringify(updatedConfig));
                      }
                    }}
                    placeholder={isPresetConfiguration ? "Configured from file" : "restaurant-app,demo,production"}
                    className={isPresetConfiguration ? 'bg-gray-50 cursor-not-allowed' : ''}
                    readOnly={isPresetConfiguration}
                    disabled={isPresetConfiguration}
                  />
                  <p className="text-xs text-muted-foreground">
                    {isPresetConfiguration ? "Tag values are configured in the agents-config.json file" : "Tags help organize and filter your logs in Mezmo"}
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
                
                <Button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/mezmo/logs');
                      const result = await response.json();
                      
                      console.log('📋 Mezmo Agent Logs:', result);
                      
                      if (result.detectedIssues && result.detectedIssues.length > 0 && result.detectedIssues[0] !== 'No obvious connection issues detected') {
                        setLastError(`Mezmo Agent Issues Detected: ${result.detectedIssues.join('; ')}`);
                        setErrorDetails({
                          logs: result.logs,
                          debugInfo: result.debugInfo,
                          detectedIssues: result.detectedIssues,
                          timestamp: result.timestamp
                        });
                      } else {
                        setLastError(null);
                        setErrorDetails(null);
                      }
                      
                      toast({
                        title: "Agent Logs Retrieved",
                        description: `Found ${result.detectedIssues?.length || 0} potential issues. Check console and error panel for details.`
                      });
                    } catch (error) {
                      toast({
                        title: "Failed to get logs",
                        description: error.message,
                        variant: "destructive"
                      });
                    }
                  }}
                  variant="outline"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View Agent Logs
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

              {/* Read-only indicator for preset configurations */}
              {isPresetConfiguration && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    This is a preset configuration loaded from the agents-config.json file. Values are read-only.
                  </AlertDescription>
                </Alert>
              )}

              {/* General Configuration */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otel-service">
                    Service Name
                    {isPresetConfiguration && <span className="ml-1 text-xs text-muted-foreground">(Read-only)</span>}
                  </Label>
                  <Input
                    id="otel-service"
                    type="text"
                    value={otelServiceName}
                    onChange={(e) => setOtelServiceName(e.target.value)}
                    placeholder={isPresetConfiguration ? "Configured from file" : "restaurant-app"}
                    className={isPresetConfiguration ? 'bg-gray-50 cursor-not-allowed' : ''}
                    readOnly={isPresetConfiguration}
                    disabled={isPresetConfiguration}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="otel-tags">
                    Tags (comma-separated)
                    {isPresetConfiguration && <span className="ml-1 text-xs text-muted-foreground">(Read-only)</span>}
                  </Label>
                  <Input
                    id="otel-tags"
                    type="text"
                    value={otelTags}
                    onChange={(e) => setOtelTags(e.target.value)}
                    placeholder={isPresetConfiguration ? "Configured from file" : "restaurant-app,otel,production"}
                    className={isPresetConfiguration ? 'bg-gray-50 cursor-not-allowed' : ''}
                    readOnly={isPresetConfiguration}
                    disabled={isPresetConfiguration}
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
                          <Label>
                            Ingestion Key
                            {isPresetConfiguration && <span className="ml-1 text-xs text-muted-foreground">(Read-only)</span>}
                          </Label>
                          <div className="relative">
                            <Input
                              type={showIngestionKeys[pipelineType] ? "text" : "password"}
                              value={otelPipelines[pipelineType].ingestionKey}
                              onChange={(e) => updateOtelPipeline(pipelineType, 'ingestionKey', e.target.value)}
                              placeholder={isPresetConfiguration ? "Configured from file" : `Enter ${pipelineType} ingestion key`}
                              className={`pr-10 ${isPresetConfiguration ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                              readOnly={isPresetConfiguration}
                              disabled={isPresetConfiguration}
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
                          <Label>
                            Pipeline ID (Optional)
                            {isPresetConfiguration && <span className="ml-1 text-xs text-muted-foreground">(Read-only)</span>}
                          </Label>
                          <Input
                            type="text"
                            value={otelPipelines[pipelineType].pipelineId}
                            onChange={(e) => updateOtelPipeline(pipelineType, 'pipelineId', e.target.value)}
                            placeholder={isPresetConfiguration ? "Configured from file" : "For Mezmo Pipelines, enter the Pipeline ID"}
                            className={isPresetConfiguration ? 'bg-gray-50 cursor-not-allowed' : ''}
                            readOnly={isPresetConfiguration}
                            disabled={isPresetConfiguration}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>
                            Host Environment
                            {isPresetConfiguration && <span className="ml-1 text-xs text-muted-foreground">(Read-only)</span>}
                          </Label>
                          <Select
                            value={otelHostEnvs[pipelineType]}
                            onValueChange={(value: HostEnvironment) => setOtelHostEnvironment(pipelineType, value)}
                            disabled={isPresetConfiguration}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select environment" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(OTEL_HOST_ENVIRONMENTS).map(([key, env]) => (
                                <SelectItem key={key} value={key}>
                                  {env.label} {env.host && `(${env.host})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {/* Custom host input */}
                          {otelHostEnvs[pipelineType] === 'custom' && (
                            <div className="mt-2">
                              <Label>
                                Custom Host
                                {isPresetConfiguration && <span className="ml-1 text-xs text-muted-foreground">(Read-only)</span>}
                              </Label>
                              <Input
                                type="text"
                                value={otelCustomHosts[pipelineType]}
                                onChange={(e) => {
                                  setOtelCustomHosts(prev => ({ ...prev, [pipelineType]: e.target.value }));
                                  updateOtelPipeline(pipelineType, 'host', e.target.value);
                                }}
                                placeholder={isPresetConfiguration ? "Configured from file" : "Enter custom host URL"}
                                className={isPresetConfiguration ? 'bg-gray-50 cursor-not-allowed' : ''}
                                readOnly={isPresetConfiguration}
                                disabled={isPresetConfiguration}
                              />
                            </div>
                          )}
                          
                          {/* Current resolved host display */}
                          <div className="text-xs text-muted-foreground">
                            Current host: <code>{getOtelPipelineHost(pipelineType)}</code>
                          </div>
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

                <Button
                  onClick={async () => {
                    try {
                      // Fetch OTEL config and logs
                      const [configResponse, logsResponse] = await Promise.all([
                        fetch('/api/otel/config'),
                        fetch('/api/otel/logs')
                      ]);
                      
                      const configData = configResponse.ok ? await configResponse.json() : { error: 'Failed to fetch config' };
                      const logsData = logsResponse.ok ? await logsResponse.json() : { error: 'Failed to fetch logs' };
                      
                      const fullDiagnostics = {
                        timestamp: new Date().toISOString(),
                        clientState: {
                          otelEnabled,
                          otelServiceName,
                          otelTags,
                          pipelines: otelPipelines,
                          status: otelStatus,
                          pid: otelPid
                        },
                        serverConfig: configData,
                        serverLogs: logsData,
                        localStorage: {
                          'otel-config': JSON.parse(localStorage.getItem('otel-config') || '{}'),
                          'agents-active-config': localStorage.getItem('agents-active-config')
                        }
                      };
                      
                      console.log('🔍 OTEL Full Diagnostics:', fullDiagnostics);
                      
                      // Show in a readable alert
                      const summary = `
OTEL Collector Debug Information:

🔧 Client State:
• Enabled: ${otelEnabled}
• Service: ${otelServiceName}
• Status: ${otelStatus}
• PID: ${otelPid || 'None'}

📊 Pipelines:
• Logs: ${otelPipelines.logs.enabled ? '✅' : '❌'} (Key: ${otelPipelines.logs.ingestionKey ? 'Set' : 'Missing'})
• Metrics: ${otelPipelines.metrics.enabled ? '✅' : '❌'} (Key: ${otelPipelines.metrics.ingestionKey ? 'Set' : 'Missing'})
• Traces: ${otelPipelines.traces.enabled ? '✅' : '❌'} (Key: ${otelPipelines.traces.ingestionKey ? 'Set' : 'Missing'})

🖥️  Server Config: ${configData.error || 'OK'}
📋 Server Logs: ${logsData.error || `${logsData.logs?.split('\n').length || 0} lines`}

Full details logged to console and copied to clipboard.
                      `;
                      
                      alert(summary);
                      navigator.clipboard.writeText(JSON.stringify(fullDiagnostics, null, 2));
                      
                    } catch (error: any) {
                      console.error('Failed to fetch OTEL debug info:', error);
                      toast({
                        title: "Debug Failed",
                        description: error.message,
                        variant: "destructive"
                      });
                    }
                  }}
                  variant="outline"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Full Debug
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