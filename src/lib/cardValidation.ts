// Credit card validation utilities

export const formatCardNumber = (value: string): string => {
  // Remove all non-digit characters
  const cleanValue = value.replace(/\D/g, '');
  
  // Limit to 16 digits
  const truncated = cleanValue.slice(0, 16);
  
  // Add spaces every 4 digits
  return truncated.replace(/(\d{4})(?=\d)/g, '$1 ');
};

export const formatExpiryDate = (value: string): string => {
  // Remove all non-digit characters
  const cleanValue = value.replace(/\D/g, '');
  
  // Limit to 4 digits
  const truncated = cleanValue.slice(0, 4);
  
  // Add slash after 2 digits
  if (truncated.length >= 2) {
    return truncated.slice(0, 2) + '/' + truncated.slice(2);
  }
  
  return truncated;
};

export const formatCVV = (value: string): string => {
  // Remove all non-digit characters and limit to 4 digits
  return value.replace(/\D/g, '').slice(0, 4);
};

// Luhn algorithm for credit card validation
export const validateCardNumber = (cardNumber: string): boolean => {
  const cleanNumber = cardNumber.replace(/\s/g, '');
  
  if (cleanNumber.length < 13 || cleanNumber.length > 19) {
    return false;
  }
  
  let sum = 0;
  let alternate = false;
  
  // Loop through digits from right to left
  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber.charAt(i), 10);
    
    if (alternate) {
      digit *= 2;
      if (digit > 9) {
        digit = (digit % 10) + 1;
      }
    }
    
    sum += digit;
    alternate = !alternate;
  }
  
  return sum % 10 === 0;
};

export const validateExpiryDate = (expiryDate: string): boolean => {
  const cleanDate = expiryDate.replace(/\D/g, '');
  
  if (cleanDate.length !== 4) {
    return false;
  }
  
  const month = parseInt(cleanDate.slice(0, 2), 10);
  const year = parseInt(cleanDate.slice(2, 4), 10);
  
  // Validate month
  if (month < 1 || month > 12) {
    return false;
  }
  
  // Validate year (assume 20xx)
  const currentYear = new Date().getFullYear() % 100;
  const currentMonth = new Date().getMonth() + 1;
  
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return false;
  }
  
  return true;
};

export const validateCVV = (cvv: string): boolean => {
  const cleanCVV = cvv.replace(/\D/g, '');
  return cleanCVV.length >= 3 && cleanCVV.length <= 4;
};

export const getCardType = (cardNumber: string): string => {
  const cleanNumber = cardNumber.replace(/\s/g, '');
  
  if (cleanNumber.startsWith('4')) {
    return 'visa';
  } else if (cleanNumber.startsWith('5') || cleanNumber.startsWith('2')) {
    return 'mastercard';
  } else if (cleanNumber.startsWith('3')) {
    return 'amex';
  } else if (cleanNumber.startsWith('6')) {
    return 'discover';
  }
  
  return 'unknown';
};

// Test card numbers for demo purposes
export const TEST_CARDS = {
  visa: '4111 1111 1111 1111',
  mastercard: '5555 5555 5555 4444',
  amex: '3782 822463 10005',
  discover: '6011 1111 1111 1117'
};