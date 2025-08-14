import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import ServerTracker from '@/lib/serverTracker';

// Global click tracker setup
let globalClickTracker: (() => void) | null = null;

export const useServerTracking = () => {
  const tracker = ServerTracker.getInstance();
  const location = useLocation();
  const previousPath = useRef<string>('');
  const routeChangeStart = useRef<number>(0);
  const isInitialized = useRef<boolean>(false);

  // Initialize tracking when hook first mounts
  useEffect(() => {
    const initializeTracking = async () => {
      if (!isInitialized.current) {
        await tracker.initialize();
        isInitialized.current = true;
      }
    };

    initializeTracking();

    // Cleanup session when user leaves
    const handleBeforeUnload = () => {
      tracker.endSession('page_unload');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [tracker]);

  // Set up global click tracking (similar to virtual users)
  useEffect(() => {
    if (!globalClickTracker) {
      const handleGlobalClick = async (event: MouseEvent) => {
        await tracker.trackClick(event);
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
  }, [tracker]);

  // Track route changes (like virtual user navigation)
  useEffect(() => {
    const currentPath = location.pathname;
    
    if (previousPath.current && previousPath.current !== currentPath) {
      const loadTime = routeChangeStart.current > 0 ? Date.now() - routeChangeStart.current : 0;
      tracker.trackNavigation(previousPath.current, currentPath, loadTime);
    }
    
    previousPath.current = currentPath;
    routeChangeStart.current = Date.now();
  }, [location.pathname, tracker]);

  // Return tracking methods for components to use
  return {
    trackInteraction: tracker.trackInteraction.bind(tracker),
    trackCartAction: tracker.trackCartAction.bind(tracker),
    trackCustomerProfile: tracker.trackCustomerProfile.bind(tracker),
    trackPaymentAttempt: tracker.trackPaymentAttempt.bind(tracker),
    trackReservation: tracker.trackReservation.bind(tracker),
    trackFormInteraction: tracker.trackFormInteraction.bind(tracker),
    getSessionInfo: tracker.getSessionInfo.bind(tracker)
  };
};

// Hook for form field tracking (focus/blur like virtual users)
export const useFormTracking = (fieldName: string) => {
  const tracker = ServerTracker.getInstance();
  const focusTime = useRef<number>(0);

  const handleFocus = useCallback(async () => {
    focusTime.current = Date.now();
    await tracker.trackFormInteraction(fieldName, 'focus');
  }, [tracker, fieldName]);

  const handleBlur = useCallback(async (value?: string) => {
    const duration = focusTime.current > 0 ? Date.now() - focusTime.current : 0;
    await tracker.trackFormInteraction(fieldName, 'blur', value, duration);
    focusTime.current = 0;
  }, [tracker, fieldName]);

  return { handleFocus, handleBlur };
};

// Hook for cart tracking (add/remove items like virtual users)
export const useCartTracking = () => {
  const tracker = ServerTracker.getInstance();

  const trackAddToCart = useCallback(async (
    productId: string,
    productName: string,
    quantity: number,
    price: number,
    cartTotal: number
  ) => {
    await tracker.trackCartAction('add', productId, productName, quantity, price, cartTotal);
  }, [tracker]);

  const trackRemoveFromCart = useCallback(async (
    productId: string,
    productName: string,
    quantity: number,
    price: number,
    cartTotal: number
  ) => {
    await tracker.trackCartAction('remove', productId, productName, quantity, price, cartTotal);
  }, [tracker]);

  return { trackAddToCart, trackRemoveFromCart };
};

// Hook for checkout/payment tracking (like virtual user payment flow)
export const usePaymentTracking = () => {
  const tracker = ServerTracker.getInstance();

  const trackPaymentAttempt = useCallback(async (
    paymentData: {
      cardNumber: string;
      expiryDate: string;
      cvv: string;
      cardHolderName: string;
    },
    customerData: any,
    transactionData: {
      orderId: string;
      amount: number;
      currency: string;
      orderType: string;
    },
    status: 'initiated' | 'processing' | 'successful' | 'failed'
  ) => {
    await tracker.trackPaymentAttempt(paymentData, customerData, transactionData, status);
  }, [tracker]);

  return { trackPaymentAttempt };
};

// Hook for reservation tracking
export const useReservationTracking = () => {
  const tracker = ServerTracker.getInstance();

  const trackReservation = useCallback(async (reservationData: {
    reservationId: string;
    date: string;
    time: string;
    guests: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    specialRequests?: string;
  }) => {
    await tracker.trackReservation(reservationData);
  }, [tracker]);

  return { trackReservation };
};