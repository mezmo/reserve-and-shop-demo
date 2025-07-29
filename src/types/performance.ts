export interface PerformanceConfig {
  enabled: boolean;
  format: 'string' | 'json' | 'clf';
  level: 'basic' | 'detailed' | 'debug';
  sessionTracking: boolean;
  logRotation: boolean;
}

export interface PerformanceLogEntry {
  timestamp: string;
  event: string;
  path?: string;
  duration?: number;
  sessionId?: string;
  component?: string;
  details?: Record<string, any>;
}

export interface NavigationTiming {
  loadStart: number;
  domContentLoaded: number;
  loadComplete: number;
  navigationStart: number;
  fetchStart: number;
  connectStart: number;
  connectEnd: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
  domInteractive: number;
}

export type PerformanceEventType = 
  | 'PAGE_LOAD'
  | 'ROUTE_CHANGE'
  | 'COMPONENT_MOUNT'
  | 'COMPONENT_UNMOUNT'
  | 'USER_INTERACTION'
  | 'DATA_FETCH'
  | 'HTTP_REQUEST'
  | 'HTTP_REQUEST_START'
  | 'HTTP_ERROR'
  | 'HTTP_TIMEOUT'
  | 'HTTP_NETWORK_ERROR'
  | 'ERROR'
  | 'SESSION_START'
  | 'LOG_ROTATION';