import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { CartProvider } from "@/hooks/useCart";
import { usePerformance } from "@/hooks/usePerformance";
import { useSessionTracker } from "@/hooks/useSessionTracker";
import { initializeTracing } from "@/lib/tracing/config";
import { TrafficManager } from "@/lib/tracing/trafficManager";
import { useEffect, useRef } from "react";
import Home from "./pages/Home";
import Menu from "./pages/Menu";
import Reservations from "./pages/Reservations";
import Config from "./pages/Config";
import Agents from "./pages/Agents";
import NotFound from "./pages/NotFound";
import Navigation from "./components/Navigation";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1 * 60 * 1000, // 1 minute
      retry: (failureCount, error) => {
        // Don't retry on client errors (4xx), but retry on server errors (5xx)
        if (error instanceof Error && 'status' in error) {
          const httpError = error as any;
          return httpError.status >= 500 && failureCount < 2;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations on client errors, but retry on server errors
        if (error instanceof Error && 'status' in error) {
          const httpError = error as any;
          return httpError.status >= 500 && failureCount < 1;
        }
        return failureCount < 1;
      },
    },
  },
});

const AppContent = () => {
  // Initialize performance tracking
  usePerformance();
  
  // Initialize session tracking for tracing
  const sessionTracker = useSessionTracker();
  const location = useLocation();
  const previousPathRef = useRef<string>('');

  // Track navigation changes
  useEffect(() => {
    if (sessionTracker) {
      const previousPath = previousPathRef.current;
      sessionTracker.startNavigation(location.pathname, previousPath);
      previousPathRef.current = location.pathname;
    }
  }, [location.pathname, sessionTracker]);

  return (
    <>
      <Navigation />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/reservations" element={<Reservations />} />
        <Route path="/config" element={<Config />} />
        <Route path="/agents" element={<Agents />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => {
  // Initialize tracing once on app startup
  useEffect(() => {
    initializeTracing().then((tracerProvider) => {
      if (tracerProvider) {
        console.log('OpenTelemetry tracing initialized');
      }
    }).catch((error) => {
      console.warn('Failed to initialize tracing:', error);
    });
  }, []);

  // Initialize TrafficManager once globally
  useEffect(() => {
    const trafficManager = TrafficManager.getInstance();
    
    // Cleanup on app unmount
    return () => {
      trafficManager.destroy();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <CartProvider>
            <AppContent />
          </CartProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
