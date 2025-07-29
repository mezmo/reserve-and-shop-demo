import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataStore } from '@/stores/dataStore';
import { Download, Upload, RefreshCw, Settings, AlertTriangle, Activity, FileText, Monitor } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePerformance } from '@/hooks/usePerformance';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const Config = () => {
  const [importData, setImportData] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { getConfig, updateConfig, getSessionId, getStoredLogs, clearStoredLogs, flushLogs } = usePerformance();
  const performanceConfig = getConfig();

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