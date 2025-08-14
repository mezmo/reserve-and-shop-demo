/**
 * Server-Side Configuration Manager
 * Handles in-memory storage of configuration data that was previously stored in localStorage
 * Data is lost when server restarts (as requested for test/simulation environment)
 */
class ConfigManager {
  constructor() {
    this.configs = {
      // OTEL Configuration
      otel: {
        enabled: false,
        serviceName: 'restaurant-app-frontend',
        pipelines: {
          traces: {
            enabled: false,
            ingestionKey: '',
            host: '',
            pipelineId: ''
          },
          logs: {
            enabled: false,
            ingestionKey: '',
            host: '',
            pipelineId: ''
          },
          metrics: {
            enabled: false,
            ingestionKey: '',
            host: '',
            pipelineId: ''
          }
        },
        tags: ''
      },
      
      // Mezmo Configuration
      mezmo: {
        enabled: false,
        ingestionKey: '',
        host: 'logs.mezmo.com',
        tags: ''
      },
      
      // Performance Configuration
      performance: {
        enabled: true,
        logLevel: 'info',
        sampleRate: 1.0,
        maxLogSize: 1000,
        enableTracing: false,
        enableMetrics: true
      },
      
      // Active configuration selection
      activeConfig: 'custom'
    };
    
    this.sessions = new Map(); // In-memory session storage
    this.logBuffers = {
      performance: [],
      events: [],
      traces: [],
      client: []
    };
    
    this.maxBufferSize = 1000; // Maximum number of log entries per buffer
    
    console.log('🔧 ConfigManager initialized with in-memory storage');
  }
  
  static getInstance() {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }
  
  // Configuration Methods
  getConfig(type) {
    if (!this.configs[type]) {
      throw new Error(`Unknown configuration type: ${type}`);
    }
    return { ...this.configs[type] }; // Return copy to prevent mutation
  }
  
  setConfig(type, config) {
    if (!this.configs[type]) {
      throw new Error(`Unknown configuration type: ${type}`);
    }
    
    // Merge with existing config
    this.configs[type] = { ...this.configs[type], ...config };
    console.log(`🔧 Updated ${type} configuration:`, this.configs[type]);
    return this.configs[type];
  }
  
  getAllConfigs() {
    return {
      otel: { ...this.configs.otel },
      mezmo: { ...this.configs.mezmo },
      performance: { ...this.configs.performance },
      activeConfig: this.configs.activeConfig
    };
  }
  
  resetConfig(type) {
    if (type === 'otel') {
      this.configs.otel = {
        enabled: false,
        serviceName: 'restaurant-app-frontend',
        pipelines: {
          traces: { enabled: false, ingestionKey: '', host: '', pipelineId: '' },
          logs: { enabled: false, ingestionKey: '', host: '', pipelineId: '' },
          metrics: { enabled: false, ingestionKey: '', host: '', pipelineId: '' }
        },
        tags: ''
      };
    } else if (type === 'mezmo') {
      this.configs.mezmo = {
        enabled: false,
        ingestionKey: '',
        host: 'logs.mezmo.com',
        tags: ''
      };
    } else if (type === 'performance') {
      this.configs.performance = {
        enabled: true,
        logLevel: 'info',
        sampleRate: 1.0,
        maxLogSize: 1000,
        enableTracing: false,
        enableMetrics: true
      };
    }
    
    console.log(`🔄 Reset ${type} configuration to defaults`);
    return this.configs[type];
  }
  
  // Session Management Methods
  createSession(sessionId, userData = {}) {
    this.sessions.set(sessionId, {
      ...userData,
      createdAt: new Date(),
      lastAccess: new Date()
    });
    console.log(`🔐 Created session: ${sessionId}`);
    return sessionId;
  }
  
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccess = new Date();
      return session;
    }
    return null;
  }
  
  destroySession(sessionId) {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      console.log(`🔐 Destroyed session: ${sessionId}`);
    }
    return deleted;
  }
  
  // Log Buffer Methods (for quick access to recent logs)
  addLogToBuffer(type, logEntry) {
    if (!this.logBuffers[type]) {
      this.logBuffers[type] = [];
    }
    
    // Add timestamp if not present
    if (!logEntry.timestamp) {
      logEntry.timestamp = new Date().toISOString();
    }
    
    this.logBuffers[type].push(logEntry);
    
    // Maintain buffer size limit
    if (this.logBuffers[type].length > this.maxBufferSize) {
      this.logBuffers[type] = this.logBuffers[type].slice(-this.maxBufferSize);
    }
  }
  
  getRecentLogs(type, limit = 100) {
    if (!this.logBuffers[type]) {
      return [];
    }
    
    return this.logBuffers[type].slice(-limit);
  }
  
  clearLogBuffer(type) {
    if (this.logBuffers[type]) {
      this.logBuffers[type] = [];
      console.log(`🧹 Cleared ${type} log buffer`);
    }
  }
  
  getBufferStats() {
    const stats = {};
    for (const [type, buffer] of Object.entries(this.logBuffers)) {
      stats[type] = {
        count: buffer.length,
        oldestEntry: buffer.length > 0 ? buffer[0].timestamp : null,
        newestEntry: buffer.length > 0 ? buffer[buffer.length - 1].timestamp : null
      };
    }
    return stats;
  }
  
  // Utility Methods
  getSystemStatus() {
    return {
      configsLoaded: Object.keys(this.configs),
      activeSessions: this.sessions.size,
      logBuffers: this.getBufferStats(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }
  
  // Session cleanup (call periodically to remove old sessions)
  cleanupExpiredSessions(maxAgeHours = 24) {
    const now = new Date();
    const expired = [];
    
    for (const [sessionId, session] of this.sessions) {
      const ageHours = (now - session.lastAccess) / (1000 * 60 * 60);
      if (ageHours > maxAgeHours) {
        expired.push(sessionId);
      }
    }
    
    expired.forEach(sessionId => {
      this.sessions.delete(sessionId);
    });
    
    if (expired.length > 0) {
      console.log(`🧹 Cleaned up ${expired.length} expired sessions`);
    }
    
    return expired.length;
  }
}

export default ConfigManager;