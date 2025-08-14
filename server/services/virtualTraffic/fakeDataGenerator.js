// Common first names
const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Betty', 'Anthony', 'Helen', 'Mark', 'Sandra', 'Donald', 'Donna',
  'Steven', 'Carol', 'Paul', 'Ruth', 'Andrew', 'Sharon', 'Joshua', 'Michelle',
  'Kenneth', 'Laura', 'Kevin', 'Sarah', 'Brian', 'Kimberly', 'George', 'Deborah',
  'Timothy', 'Dorothy', 'Ronald', 'Lisa', 'Jason', 'Nancy', 'Edward', 'Karen',
  'Jeffrey', 'Betty', 'Ryan', 'Helen', 'Jacob', 'Sandra', 'Gary', 'Donna',
  'Nicholas', 'Carol', 'Eric', 'Ruth', 'Jonathan', 'Sharon', 'Stephen', 'Michelle',
  'Larry', 'Laura', 'Justin', 'Sarah', 'Scott', 'Kimberly', 'Brandon', 'Deborah',
  'Benjamin', 'Dorothy', 'Samuel', 'Amy', 'Gregory', 'Angela', 'Alexander', 'Ashley',
  'Frank', 'Brenda', 'Raymond', 'Emma', 'Jack', 'Olivia', 'Dennis', 'Cynthia',
  'Jerry', 'Marie', 'Tyler', 'Janet', 'Aaron', 'Catherine', 'Jose', 'Frances'
];

// Common last names
const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
  'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
  'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker',
  'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy',
  'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey',
  'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza'
];

// Email domains
const EMAIL_DOMAINS = [
  'gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com',
  'protonmail.com', 'aol.com', 'live.com', 'msn.com', 'comcast.net'
];

// US area codes
const AREA_CODES = [
  '212', '718', '646', '347', '929', // New York
  '415', '628', '650', '669', // San Francisco Bay Area
  '310', '323', '424', '213', '818', // Los Angeles
  '713', '281', '832', '409', // Houston
  '312', '773', '872', // Chicago
  '305', '786', '954', '561', // Florida
  '404', '678', '470', // Atlanta
  '617', '857', '781', // Boston
  '206', '253', '425', // Seattle
  '702', '725', // Las Vegas
  '480', '602', '623', // Phoenix
  '303', '720', '970', // Denver
  '214', '469', '972', '945', // Dallas
  '503', '971', // Portland
  '512', '737', // Austin
];

// Valid test credit card numbers (these are safe test numbers)
const TEST_CREDIT_CARDS = [
  { number: '4111111111111111', type: 'visa' },
  { number: '4012888888881881', type: 'visa' },
  { number: '4222222222222', type: 'visa' },
  { number: '5555555555554444', type: 'mastercard' },
  { number: '5105105105105100', type: 'mastercard' },
  { number: '2223003122003222', type: 'mastercard' },
  { number: '378282246310005', type: 'amex' },
  { number: '371449635398431', type: 'amex' },
  { number: '6011111111111117', type: 'discover' },
  { number: '6011000990139424', type: 'discover' }
];

// US cities with matching state/zip combinations
const US_LOCATIONS = [
  { city: 'New York', state: 'NY', zipCodes: ['10001', '10002', '10003', '10004', '10005'] },
  { city: 'Los Angeles', state: 'CA', zipCodes: ['90001', '90002', '90003', '90004', '90005'] },
  { city: 'Chicago', state: 'IL', zipCodes: ['60601', '60602', '60603', '60604', '60605'] },
  { city: 'Houston', state: 'TX', zipCodes: ['77001', '77002', '77003', '77004', '77005'] },
  { city: 'Phoenix', state: 'AZ', zipCodes: ['85001', '85002', '85003', '85004', '85005'] },
  { city: 'Philadelphia', state: 'PA', zipCodes: ['19101', '19102', '19103', '19104', '19105'] },
  { city: 'San Antonio', state: 'TX', zipCodes: ['78201', '78202', '78203', '78204', '78205'] },
  { city: 'San Diego', state: 'CA', zipCodes: ['92101', '92102', '92103', '92104', '92105'] },
  { city: 'Dallas', state: 'TX', zipCodes: ['75201', '75202', '75203', '75204', '75205'] },
  { city: 'San Jose', state: 'CA', zipCodes: ['95101', '95102', '95103', '95104', '95105'] },
  { city: 'Austin', state: 'TX', zipCodes: ['73301', '73344', '78701', '78702', '78703'] },
  { city: 'Jacksonville', state: 'FL', zipCodes: ['32099', '32201', '32202', '32203', '32204'] },
  { city: 'San Francisco', state: 'CA', zipCodes: ['94101', '94102', '94103', '94104', '94105'] },
  { city: 'Columbus', state: 'OH', zipCodes: ['43085', '43201', '43202', '43203', '43204'] },
  { city: 'Indianapolis', state: 'IN', zipCodes: ['46201', '46202', '46203', '46204', '46205'] },
  { city: 'Fort Worth', state: 'TX', zipCodes: ['76101', '76102', '76103', '76104', '76105'] },
  { city: 'Charlotte', state: 'NC', zipCodes: ['28201', '28202', '28203', '28204', '28205'] },
  { city: 'Seattle', state: 'WA', zipCodes: ['98101', '98102', '98103', '98104', '98105'] },
  { city: 'Denver', state: 'CO', zipCodes: ['80201', '80202', '80203', '80204', '80205'] },
  { city: 'Washington', state: 'DC', zipCodes: ['20001', '20002', '20003', '20004', '20005'] }
];

// Natural special requests for reservations
const SPECIAL_REQUESTS = [
  '',
  'Window table if available',
  'Celebrating anniversary',
  'Birthday celebration',
  'Quiet table please',
  'High chair needed',
  'Wheelchair accessible',
  'Allergy to nuts',
  'Vegetarian options needed',
  'Running a few minutes late',
  'First time dining here',
  'Celebrating promotion',
  'Date night',
  'Business dinner',
  'No seafood please',
  'Prefer booth seating',
  'Group celebration',
  'Gluten-free options needed'
];

// Realistic browser fingerprinting data
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];

const VIEWPORT_SIZES = [
  { width: 1920, height: 1080 }, // Full HD - 25%
  { width: 1366, height: 768 },  // Laptop - 20%
  { width: 1536, height: 864 },  // Laptop scaled - 15%
  { width: 1440, height: 900 },  // MacBook - 12%
  { width: 1280, height: 720 },  // HD - 10%
  { width: 2560, height: 1440 }, // 2K - 8%
  { width: 1920, height: 1200 }, // WUXGA - 5%
  { width: 3840, height: 2160 }  // 4K - 5%
];

const LANGUAGES = [
  'en-US', 'en-GB', 'es-US', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'
];

// Utility functions
function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateStreetAddress() {
  const streetNumbers = randomInt(100, 9999);
  const streetNames = [
    'Main St', 'Oak Ave', 'Pine St', 'Maple Dr', 'Cedar Ln', 'Elm St', 'Park Ave',
    'First St', 'Second St', 'Third St', 'Washington St', 'Lincoln Ave', 'Jefferson Dr',
    'Adams St', 'Madison Ave', 'Monroe St', 'Jackson Dr', 'Harrison Ave', 'Tyler St',
    'Broadway', 'Market St', 'Church St', 'Spring St', 'Hill St', 'Valley Dr'
  ];
  
  return `${streetNumbers} ${randomChoice(streetNames)}`;
}

function generateEmail(firstName, lastName) {
  const domain = randomChoice(EMAIL_DOMAINS);
  const variations = [
    `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    `${firstName.toLowerCase().charAt(0)}${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${randomInt(10, 99)}`,
    `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(10, 99)}`
  ];
  
  return `${randomChoice(variations)}@${domain}`;
}

function generatePhone() {
  const areaCode = randomChoice(AREA_CODES);
  const exchange = randomInt(200, 999); // Valid exchange codes
  const number = randomInt(1000, 9999);
  return `${areaCode}-${exchange}-${number}`;
}

function generateSSN() {
  // Generate fake SSN (not real) in XXX-XX-XXXX format
  const area = randomInt(100, 899); // Avoid 000, 666, 900-999
  const group = randomInt(10, 99);
  const serial = randomInt(1000, 9999);
  return `${area}-${group.toString().padStart(2, '0')}-${serial}`;
}

function generateDriversLicense() {
  // Generate fake driver's license number
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const state = randomChoice(['CA', 'NY', 'TX', 'FL', 'IL']);
  
  if (state === 'CA') {
    // California format: 1 letter + 7 digits
    return randomChoice(letters) + randomInt(1000000, 9999999);
  } else if (state === 'NY') {
    // New York format: 3 digits + 3 digits + 3 digits
    return `${randomInt(100, 999)}-${randomInt(100, 999)}-${randomInt(100, 999)}`;
  } else {
    // Generic format: 2 letters + 6 digits
    return randomChoice(letters) + randomChoice(letters) + randomInt(100000, 999999);
  }
}

function generateBankAccount() {
  // Generate fake bank account number
  const routingNumber = randomInt(100000000, 999999999); // 9 digits
  const accountNumber = randomInt(1000000000, 9999999999); // 10 digits
  return {
    routingNumber: routingNumber.toString(),
    accountNumber: accountNumber.toString()
  };
}

function generateExpiryDate() {
  const currentYear = new Date().getFullYear();
  const futureYear = currentYear + randomInt(1, 5); // 1-5 years in the future
  const month = randomInt(1, 12);
  
  return {
    month: month.toString().padStart(2, '0'),
    year: futureYear.toString().slice(-2) // Last 2 digits
  };
}

function generateCVV(cardType) {
  // American Express uses 4-digit CVV, others use 3-digit
  const digits = cardType === 'amex' ? 4 : 3;
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return randomInt(min, max).toString();
}

/**
 * Generates a complete realistic customer profile
 */
function generateCustomerProfile() {
  const firstName = randomChoice(FIRST_NAMES);
  const lastName = randomChoice(LAST_NAMES);
  const fullName = `${firstName} ${lastName}`;
  const location = randomChoice(US_LOCATIONS);
  const creditCard = randomChoice(TEST_CREDIT_CARDS);
  const expiry = generateExpiryDate();
  const bankAccount = generateBankAccount();
  
  return {
    firstName,
    lastName,
    fullName,
    email: generateEmail(firstName, lastName),
    phone: generatePhone(),
    address: {
      street: generateStreetAddress(),
      city: location.city,
      state: location.state,
      zipCode: randomChoice(location.zipCodes)
    },
    creditCard: {
      number: creditCard.number,
      type: creditCard.type,
      expiryMonth: expiry.month,
      expiryYear: expiry.year,
      cvv: generateCVV(creditCard.type),
      holderName: fullName
    },
    // Additional sensitive information for downstream filtering tests
    sensitiveData: {
      ssn: generateSSN(),
      driversLicense: generateDriversLicense(),
      bankAccount: bankAccount
    }
  };
}

/**
 * Generates a realistic special request for reservations
 */
function generateSpecialRequest() {
  return randomChoice(SPECIAL_REQUESTS);
}

/**
 * Formats credit card number with dashes for display
 */
function formatCreditCardNumber(number) {
  // Format as XXXX-XXXX-XXXX-XXXX for most cards
  if (number.length === 15) {
    // American Express: XXXX-XXXXXX-XXXXX
    return `${number.slice(0, 4)}-${number.slice(4, 10)}-${number.slice(10)}`;
  } else {
    // Visa, MasterCard, Discover: XXXX-XXXX-XXXX-XXXX
    return number.replace(/(\d{4})(?=\d)/g, '$1-');
  }
}

/**
 * Generates realistic order type with weighted probability
 */
function generateOrderType() {
  // 70% delivery, 30% pickup
  return Math.random() < 0.7 ? 'delivery' : 'pickup';
}

/**
 * Generates realistic party size for reservations
 */
function generatePartySize() {
  // Weighted toward smaller parties: 2-4 people most common
  const weights = [0.35, 0.25, 0.20, 0.10, 0.05, 0.03, 0.02]; // 2,3,4,5,6,7,8+ people
  const random = Math.random();
  let cumulative = 0;
  
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (random <= cumulative) {
      return i + 2; // Start from 2 people
    }
  }
  
  return 2; // Fallback
}

/**
 * Generates realistic browser fingerprint for virtual users
 */
function generateBrowserFingerprint() {
  const userAgent = randomChoice(USER_AGENTS);
  const viewport = randomChoice(VIEWPORT_SIZES);
  const language = randomChoice(LANGUAGES);
  
  // Extract platform from user agent
  let platform = 'Win32';
  if (userAgent.includes('Macintosh')) platform = 'MacIntel';
  else if (userAgent.includes('Linux')) platform = 'Linux x86_64';
  else if (userAgent.includes('Windows')) platform = 'Win32';
  
  // Random timezone (mostly US timezones for restaurant app)
  const timezones = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'Europe/London',
    'Europe/Paris', 'Asia/Tokyo'
  ];
  
  return {
    userAgent,
    language,
    viewport,
    timezone: randomChoice(timezones),
    platform,
    cookieEnabled: Math.random() > 0.05, // 95% have cookies enabled
    doNotTrack: Math.random() > 0.7 ? '1' : '0' // 30% enable DNT
  };
}

/**
 * Generates realistic network timing data for virtual users
 * Simulates real browser Navigation Timing API values
 */
function generateNetworkTiming(requestSize = 1024, responseSize = 8192) {
  const fetchStart = 0;
  const domainLookupStart = fetchStart + randomInt(1, 15);
  const domainLookupEnd = domainLookupStart + randomInt(5, 45);
  const connectStart = domainLookupEnd + randomInt(1, 5);
  const connectEnd = connectStart + randomInt(15, 120);
  const requestStart = connectEnd + randomInt(1, 10);
  const responseStart = requestStart + randomInt(20, 180);
  const responseEnd = responseStart + randomInt(10, 200);
  
  // Add realistic size variations
  const transferSize = responseSize + randomInt(100, 500);
  const encodedBodySize = responseSize;
  const decodedBodySize = encodedBodySize + randomInt(0, 512);
  
  return {
    connectStart,
    connectEnd,
    domainLookupStart,
    domainLookupEnd,
    fetchStart,
    requestStart,
    responseStart,
    responseEnd,
    transferSize,
    encodedBodySize,
    decodedBodySize
  };
}

/**
 * Adds timing jitter to simulate realistic variance
 */
function addTimingJitter(baseTime, jitterPercent = 0.2) {
  const jitter = baseTime * jitterPercent;
  const variation = (Math.random() - 0.5) * 2 * jitter;
  return Math.round(baseTime + variation);
}

export {
  generateCustomerProfile,
  generateSpecialRequest,
  formatCreditCardNumber,
  generateOrderType,
  generatePartySize,
  generateBrowserFingerprint,
  generateNetworkTiming,
  addTimingJitter,
  generateSSN,
  generateDriversLicense,
  generateBankAccount
};