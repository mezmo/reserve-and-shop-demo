import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import PerformanceLogger from '@/lib/performanceLogger';

// Global click tracking setup
let globalClickTracker: (() => void) | null = null;

export const usePerformance = () => {
  const logger = PerformanceLogger.getInstance();
  const location = useLocation();
  const previousPath = useRef<string>('');
  const routeChangeStart = useRef<number>(0);

  // Set up global click tracking
  useEffect(() => {
    if (!globalClickTracker) {
      const handleGlobalClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();
        const elementInfo = {
          tag: tagName,
          id: target.id || 'no-id',
          className: target.className || 'no-class',
          text: target.textContent?.slice(0, 50) || 'no-text'
        };
        
        logger.logUserInteraction('click', `${tagName}#${elementInfo.id}.${elementInfo.className.replace(/\s+/g, '.')}`, 0);
      };

      document.addEventListener('click', handleGlobalClick, true);
      
      globalClickTracker = () => {
        document.removeEventListener('click', handleGlobalClick, true);
        globalClickTracker = null;
      };
    }

    return () => {
      // Don't remove the global listener on component unmount
      // It should persist across route changes
    };
  }, [logger]);

  // Track route changes
  useEffect(() => {
    const currentPath = location.pathname;
    
    if (previousPath.current && previousPath.current !== currentPath) {
      const duration = performance.now() - routeChangeStart.current;
      logger.logRouteChange(previousPath.current, currentPath, duration);
    }
    
    previousPath.current = currentPath;
    routeChangeStart.current = performance.now();
  }, [location.pathname, logger]);

  // Track page load on initial mount
  useEffect(() => {
    const handleLoad = () => {
      logger.logPageLoad(location.pathname);
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
  }, [logger, location.pathname]);

  const trackComponentMount = useCallback((componentName: string) => {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      logger.logComponentMount(componentName, duration);
    };
  }, [logger]);

  const trackUserInteraction = useCallback((event: string, element: string) => {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      logger.logUserInteraction(event, element, duration);
    };
  }, [logger]);

  const trackDataFetch = useCallback((operation: string) => {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      logger.logDataFetch(operation, duration);
    };
  }, [logger]);

  const logError = useCallback((error: Error, context?: string) => {
    logger.logError(error, context);
  }, [logger]);

  return {
    trackComponentMount,
    trackUserInteraction,
    trackDataFetch,
    logError,
    getSessionId: () => logger.getSessionId(),
    getConfig: () => logger.getConfig(),
    updateConfig: (config: any) => logger.updateConfig(config),
    getStoredLogs: () => logger.getStoredLogs(),
    clearStoredLogs: () => logger.clearStoredLogs()
  };
};

// Hook for tracking individual component performance
export const useComponentPerformance = (componentName: string) => {
  const { trackComponentMount } = usePerformance();
  
  useEffect(() => {
    const endTracking = trackComponentMount(componentName);
    return endTracking;
  }, [componentName, trackComponentMount]);
};