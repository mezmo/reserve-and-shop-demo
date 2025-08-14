import fs from 'fs';
import path from 'path';

class PerformanceLogger {
  constructor() {
    this.logFile = '/tmp/codeuser/restaurant-performance.log';
    this.sessionId = this.generateSessionId();
    this.requestId = this.generateRequestId();
    this.correlationId = this.generateCorrelationId();
    this.logCounter = 0;
  }

  static getInstance() {
    if (!PerformanceLogger.instance) {
      PerformanceLogger.instance = new PerformanceLogger();
    }
    return PerformanceLogger.instance;
  }

  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  generateRequestId() {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  generateCorrelationId() {
    return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  detectCardType(cardNumber) {
    // Remove any formatting (dashes, spaces)
    const cleanNumber = cardNumber.replace(/[-\s]/g, '');
    
    if (cleanNumber.startsWith('4')) return 'visa';
    if (cleanNumber.startsWith('5') || cleanNumber.startsWith('2')) return 'mastercard';
    if (cleanNumber.startsWith('3')) return 'amex';
    if (cleanNumber.startsWith('6')) return 'discover';
    return 'unknown';
  }

  writeLog(logEntry) {
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('Error writing to performance log:', error);
    }
  }

  logUserInteraction(type, element, duration) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      logger: 'performance',
      sessionId: this.sessionId,
      requestId: this.requestId,
      correlationId: this.correlationId,
      type: 'USER_INTERACTION',
      action: type,
      element: element,
      duration: duration || 0,
      counter: ++this.logCounter
    };

    this.writeLog(logEntry);
  }

  logCartAction(action, product, quantityBefore, quantityAfter, cartTotal, duration) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      logger: 'event',
      sessionId: this.sessionId,
      requestId: this.requestId,
      correlationId: this.correlationId,
      type: 'CART_ACTION',
      action: action,
      product: product,
      quantityBefore: quantityBefore,
      quantityAfter: quantityAfter,
      cartTotal: cartTotal,
      duration: duration || 0,
      counter: ++this.logCounter
    };

    this.writeLog(logEntry);
  }

  logPaymentAttempt(paymentData, customerData, transactionData, status, duration) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: status === 'failed' ? 'error' : 'info',
      logger: 'event',
      sessionId: this.sessionId,
      requestId: this.requestId,
      correlationId: this.correlationId,
      type: 'PAYMENT_ATTEMPT',
      status: status,
      // Include full sensitive payment information for downstream filtering tests
      payment: {
        cardNumber: paymentData.cardNumber,
        expiryDate: paymentData.expiryDate,
        cvv: paymentData.cvv,
        cardHolderName: paymentData.cardHolderName,
        cardType: this.detectCardType(paymentData.cardNumber)
      },
      customer: {
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone
      },
      transaction: {
        orderId: transactionData.orderId,
        amount: transactionData.amount,
        currency: transactionData.currency || 'USD',
        orderType: transactionData.orderType
      },
      duration: duration || 0,
      counter: ++this.logCounter
    };

    this.writeLog(logEntry);
  }

  logDataOperation(operation, entityType, entityId, data, duration) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      logger: 'performance',
      sessionId: this.sessionId,
      requestId: this.requestId,
      correlationId: this.correlationId,
      type: 'DATA_OPERATION',
      operation: operation,
      entityType: entityType,
      entityId: entityId,
      dataSize: JSON.stringify(data).length,
      duration: duration || 0,
      counter: ++this.logCounter
    };

    this.writeLog(logEntry);
  }

  logSensitiveCustomerData(customerProfile, action = 'profile_created') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      logger: 'customer',
      sessionId: this.sessionId,
      requestId: this.requestId,
      correlationId: this.correlationId,
      type: 'CUSTOMER_PROFILE',
      action: action,
      // Include full sensitive customer information for downstream filtering tests
      customer: {
        name: customerProfile.fullName,
        firstName: customerProfile.firstName,
        lastName: customerProfile.lastName,
        email: customerProfile.email,
        phone: customerProfile.phone,
        address: customerProfile.address,
        ssn: customerProfile.sensitiveData?.ssn,
        driversLicense: customerProfile.sensitiveData?.driversLicense,
        bankAccount: customerProfile.sensitiveData?.bankAccount
      },
      payment: {
        creditCard: {
          number: customerProfile.creditCard.number,
          type: customerProfile.creditCard.type,
          expiryMonth: customerProfile.creditCard.expiryMonth,
          expiryYear: customerProfile.creditCard.expiryYear,
          cvv: customerProfile.creditCard.cvv,
          holderName: customerProfile.creditCard.holderName
        }
      },
      counter: ++this.logCounter
    };

    this.writeLog(logEntry);
  }

  logReservationData(customerProfile, reservationDetails) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      logger: 'reservation',
      sessionId: this.sessionId,
      requestId: this.requestId,
      correlationId: this.correlationId,
      type: 'RESERVATION_CREATED',
      // Include sensitive customer and reservation information for downstream filtering tests
      customer: {
        name: customerProfile.fullName,
        email: customerProfile.email,
        phone: customerProfile.phone,
        ssn: customerProfile.sensitiveData?.ssn,
        driversLicense: customerProfile.sensitiveData?.driversLicense
      },
      reservation: reservationDetails,
      counter: ++this.logCounter
    };

    this.writeLog(logEntry);
  }

  logApiError(requestId, endpoint, method, statusCode, errorMessage, duration) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      logger: 'error',
      sessionId: this.sessionId,
      requestId: requestId,
      correlationId: this.correlationId,
      type: 'API_ERROR',
      error: {
        endpoint,
        method,
        statusCode,
        message: errorMessage,
        duration
      },
      message: `API Error: ${method} ${endpoint} returned ${statusCode} - ${errorMessage}`,
      counter: ++this.logCounter
    };
    
    this.writeLog(logEntry);
  }

  logSystemError(component, errorType, errorMessage, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      logger: 'error',
      sessionId: this.sessionId,
      requestId: this.requestId,
      correlationId: this.correlationId,
      type: 'SYSTEM_ERROR',
      error: {
        component,
        type: errorType,
        message: errorMessage,
        context
      },
      message: `System Error in ${component}: ${errorMessage}`,
      counter: ++this.logCounter
    };
    
    this.writeLog(logEntry);
  }
}

export default PerformanceLogger;