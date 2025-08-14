/**
 * Server-Side User Activity Tracker
 * Replaces client-side logging with server-side tracking via API calls
 * Creates rich, detailed logs that match virtual user logging format
 */

interface BrowserFingerprint {
  userAgent: string;
  language: string;
  viewport: { width: number; height: number };
  timezone: string;
}

interface CustomerProfile {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  creditCard: {
    number: string;
    type: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
    holderName: string;
  };
  sensitiveData: {
    ssn: string;
    driversLicense: string;
    bankAccount: {
      routingNumber: string;
      accountNumber: string;
    };
  };
}

class ServerTracker {
  private static instance: ServerTracker | null = null;
  private sessionId: string | null = null;
  private isInitialized: boolean = false;
  private baseUrl: string = '';

  private constructor() {
    this.baseUrl = window.location.origin;
  }

  static getInstance(): ServerTracker {
    if (!ServerTracker.instance) {
      ServerTracker.instance = new ServerTracker();
    }
    return ServerTracker.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const browserFingerprint = this.getBrowserFingerprint();
      
      const response = await fetch(`${this.baseUrl}/api/track/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(browserFingerprint)
      });

      if (response.ok) {
        const data = await response.json();
        this.sessionId = data.sessionId;
        this.isInitialized = true;
        console.log('🔗 Real user tracking initialized:', this.sessionId);
      }
    } catch (error) {
      console.warn('Failed to initialize server tracking:', error);
    }
  }

  private getBrowserFingerprint(): BrowserFingerprint {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language || 'en-US',
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
    };
  }

  async trackInteraction(
    interactionType: 'click' | 'hover' | 'focus' | 'blur' | 'scroll',
    element: string,
    duration: number = 0,
    metadata?: any
  ): Promise<void> {
    if (!this.sessionId) return;

    try {
      await fetch(`${this.baseUrl}/api/track/interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          interactionType,
          element,
          duration,
          metadata
        })
      });
    } catch (error) {
      console.warn('Failed to track interaction:', error);
    }
  }

  async trackNavigation(fromPath: string, toPath: string, loadTime: number = 0): Promise<void> {
    if (!this.sessionId) return;

    try {
      await fetch(`${this.baseUrl}/api/track/navigation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          fromPath,
          toPath,
          loadTime
        })
      });
    } catch (error) {
      console.warn('Failed to track navigation:', error);
    }
  }

  async trackCartAction(
    action: 'add' | 'remove',
    productId: string,
    productName: string,
    quantity: number,
    price: number,
    cartTotal: number
  ): Promise<void> {
    if (!this.sessionId) return;

    try {
      await fetch(`${this.baseUrl}/api/track/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          action,
          productId,
          productName,
          quantity,
          price,
          cartTotal
        })
      });
    } catch (error) {
      console.warn('Failed to track cart action:', error);
    }
  }

  async trackCustomerProfile(customerData: CustomerProfile): Promise<void> {
    if (!this.sessionId) return;

    try {
      await fetch(`${this.baseUrl}/api/track/customer-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          customerData
        })
      });
    } catch (error) {
      console.warn('Failed to track customer profile:', error);
    }
  }

  async trackPaymentAttempt(
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
  ): Promise<void> {
    if (!this.sessionId) return;

    try {
      await fetch(`${this.baseUrl}/api/track/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          paymentData,
          customerData,
          transactionData,
          status
        })
      });
    } catch (error) {
      console.warn('Failed to track payment:', error);
    }
  }

  async trackReservation(reservationData: {
    reservationId: string;
    date: string;
    time: string;
    guests: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    specialRequests?: string;
  }): Promise<void> {
    if (!this.sessionId) return;

    try {
      await fetch(`${this.baseUrl}/api/track/reservation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          reservationData
        })
      });
    } catch (error) {
      console.warn('Failed to track reservation:', error);
    }
  }

  async trackFormInteraction(
    fieldName: string,
    action: 'focus' | 'blur' | 'change',
    value?: string,
    duration: number = 0
  ): Promise<void> {
    if (!this.sessionId) return;

    try {
      await fetch(`${this.baseUrl}/api/track/form-interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          fieldName,
          action,
          value,
          duration
        })
      });
    } catch (error) {
      console.warn('Failed to track form interaction:', error);
    }
  }

  async endSession(reason: string = 'page_unload'): Promise<void> {
    if (!this.sessionId) return;

    try {
      await fetch(`${this.baseUrl}/api/track/session/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          reason
        })
      });
      
      this.sessionId = null;
      this.isInitialized = false;
    } catch (error) {
      console.warn('Failed to end session:', error);
    }
  }

  // Convenience method to track clicks with detailed element information
  async trackClick(event: MouseEvent): Promise<void> {
    const target = event.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    const elementInfo = {
      tag: tagName,
      id: target.id || 'no-id',
      className: target.className || 'no-class',
      text: target.textContent?.slice(0, 50) || 'no-text'
    };
    
    const className = elementInfo.className && typeof elementInfo.className === 'string' 
      ? elementInfo.className.replace(/\s+/g, '.') 
      : 'no-class';
      
    const elementSelector = `${tagName}#${elementInfo.id}.${className}`;
    
    await this.trackInteraction('click', elementSelector, 0, {
      text: elementInfo.text,
      position: { x: event.clientX, y: event.clientY }
    });
  }

  // Get session info for debugging
  getSessionInfo(): { sessionId: string | null; isInitialized: boolean } {
    return {
      sessionId: this.sessionId,
      isInitialized: this.isInitialized
    };
  }
}

export default ServerTracker;