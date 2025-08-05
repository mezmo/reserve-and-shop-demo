import { useEffect, useRef } from 'react';
import { SessionTracker } from '@/lib/tracing/sessionTracker';
import { isTracingEnabled } from '@/lib/tracing/config';

export function useSessionTracker() {
  const trackerRef = useRef<SessionTracker | null>(null);

  useEffect(() => {
    // Only initialize if tracing is enabled
    if (isTracingEnabled() && !trackerRef.current) {
      trackerRef.current = new SessionTracker();
    }
  }, []);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (trackerRef.current) {
        trackerRef.current.endSession('app_unmount');
        trackerRef.current = null;
      }
    };
  }, []);

  return trackerRef.current;
}