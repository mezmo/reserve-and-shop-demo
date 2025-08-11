# Log Parsing Implementation Guide

## Overview

This comprehensive guide provides parsing implementations for all log formats used by the restaurant application, including error handling, performance considerations, and real-world examples.

## JSON Log Parser

### Basic JSON Parser Implementation

```javascript
class JSONLogParser {
  constructor(options = {}) {
    this.validateCircularRefs = options.validateCircularRefs || false;
    this.maxDepth = options.maxDepth || 50;
    this.dateFields = options.dateFields || ['timestamp', 'createdAt', 'updatedAt'];
  }

  parse(logLine) {
    try {
      const parsed = JSON.parse(logLine.trim());
      
      // Convert date strings to Date objects
      this.convertDates(parsed);
      
      // Validate structure
      if (!this.isValidLogEntry(parsed)) {
        throw new Error('Invalid log entry structure');
      }
      
      return {
        success: true,
        data: parsed,
        errors: []
      };
      
    } catch (error) {
      return this.handleParseError(logLine, error);
    }
  }

  convertDates(obj, depth = 0) {
    if (depth > this.maxDepth) return;
    
    for (const [key, value] of Object.entries(obj)) {
      if (this.dateFields.includes(key) && typeof value === 'string') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          obj[key] = date;
        }
      } else if (typeof value === 'object' && value !== null) {
        this.convertDates(value, depth + 1);
      }
    }
  }

  isValidLogEntry(data) {
    return (
      typeof data === 'object' &&
      data !== null &&
      'timestamp' in data &&
      'level' in data &&
      'message' in data
    );
  }

  handleParseError(logLine, error) {
    // Attempt partial recovery
    const recoveredData = this.attemptRecovery(logLine);
    
    return {
      success: false,
      data: recoveredData,
      errors: [{
        type: 'parse_error',
        message: error.message,
        position: this.findErrorPosition(logLine, error),
        originalLine: logLine.substring(0, 200) + '...'
      }]
    };
  }

  attemptRecovery(logLine) {
    // Try to extract basic fields even from malformed JSON
    const timestamp = this.extractTimestamp(logLine);
    const level = this.extractLevel(logLine);
    const message = this.extractMessage(logLine);
    
    return {
      timestamp,
      level: level || 'UNKNOWN',
      message: message || 'Malformed log entry',
      _recovered: true,
      _originalLine: logLine
    };
  }

  extractTimestamp(logLine) {
    const timestampMatch = logLine.match(/"timestamp":"([^"]+)"/);
    return timestampMatch ? new Date(timestampMatch[1]) : new Date();
  }

  extractLevel(logLine) {
    const levelMatch = logLine.match(/"level":"([^"]+)"/);
    return levelMatch ? levelMatch[1] : null;
  }

  extractMessage(logLine) {
    const messageMatch = logLine.match(/"message":"([^"]+)"/);
    return messageMatch ? messageMatch[1] : null;
  }

  findErrorPosition(logLine, error) {
    // Extract position from JSON parse error message
    const positionMatch = error.message.match(/position (\d+)/);
    return positionMatch ? parseInt(positionMatch[1]) : -1;
  }
}
```

### Advanced JSON Parser Features

```javascript
class AdvancedJSONParser extends JSONLogParser {
  constructor(options = {}) {
    super(options);
    this.schema = options.schema || null;
    this.enrichmentRules = options.enrichmentRules || [];
    this.correlationFields = options.correlationFields || ['traceId', 'sessionId', 'requestId'];
  }

  parse(logLine) {
    const result = super.parse(logLine);
    
    if (result.success) {
      // Apply schema validation
      if (this.schema) {
        result.data = this.validateSchema(result.data);
      }
      
      // Apply enrichment rules
      result.data = this.applyEnrichment(result.data);
      
      // Extract correlation context
      result.correlation = this.extractCorrelation(result.data);
    }
    
    return result;
  }

  validateSchema(data) {
    // Implement JSON schema validation
    if (this.schema.required) {
      for (const field of this.schema.required) {
        if (!(field in data)) {
          data._validationErrors = data._validationErrors || [];
          data._validationErrors.push(`Missing required field: ${field}`);
        }
      }
    }
    
    return data;
  }

  applyEnrichment(data) {
    for (const rule of this.enrichmentRules) {
      if (rule.condition(data)) {
        data = rule.enrich(data);
      }
    }
    
    return data;
  }

  extractCorrelation(data) {
    const correlation = {};
    
    for (const field of this.correlationFields) {
      if (field in data) {
        correlation[field] = data[field];
      }
    }
    
    return correlation;
  }
}
```

## Common Log Format (CLF) Parser

### CLF Parser Implementation

```javascript
class CLFParser {
  constructor(options = {}) {
    this.extended = options.extended || false;
    this.strictMode = options.strictMode || false;
  }

  // Standard CLF regex pattern
  // Format: host ident authuser [timestamp] "method url protocol" status size
  get pattern() {
    if (this.extended) {
      // Extended format includes referer, user-agent, and response time
      return /^(\S+) (\S+) (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\S+) "([^"]*)" "([^"]*)" (\d+)ms$/;
    } else {
      // Standard CLF format
      return /^(\S+) (\S+) (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\S+)$/;
    }
  }

  parse(logLine) {
    const match = logLine.trim().match(this.pattern);
    
    if (!match) {
      return this.handleParseError(logLine);
    }

    try {
      if (this.extended) {
        return this.parseExtendedCLF(match);
      } else {
        return this.parseStandardCLF(match);
      }
    } catch (error) {
      return this.handleParseError(logLine, error);
    }
  }

  parseStandardCLF(match) {
    const [, host, ident, authuser, timestamp, method, url, protocol, status, size] = match;
    
    return {
      success: true,
      data: {
        ip: host === '-' ? null : host,
        ident: ident === '-' ? null : ident,
        userId: authuser === '-' ? null : authuser,
        timestamp: this.parseTimestamp(timestamp),
        method,
        url,
        protocol,
        status: parseInt(status),
        size: size === '-' ? null : parseInt(size),
        format: 'clf'
      },
      errors: []
    };
  }

  parseExtendedCLF(match) {
    const [, host, ident, authuser, timestamp, method, url, protocol, status, size, referer, userAgent, responseTime] = match;
    
    const standardData = this.parseStandardCLF(match.slice(0, 10));
    
    return {
      success: true,
      data: {
        ...standardData.data,
        referer: referer === '-' ? null : referer,
        userAgent: userAgent === '-' ? null : userAgent,
        responseTime: parseInt(responseTime),
        format: 'clf_extended'
      },
      errors: []
    };
  }

  parseTimestamp(timestampStr) {
    // CLF timestamp format: DD/MMM/YYYY:HH:mm:ss +0000
    const match = timestampStr.match(/^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([\+\-]\d{4})$/);
    
    if (!match) {
      throw new Error(`Invalid timestamp format: ${timestampStr}`);
    }

    const [, day, month, year, hour, minute, second, timezone] = match;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = monthNames.indexOf(month);
    
    if (monthIndex === -1) {
      throw new Error(`Invalid month: ${month}`);
    }

    return new Date(`${year}-${String(monthIndex + 1).padStart(2, '0')}-${day}T${hour}:${minute}:${second}${timezone}`);
  }

  handleParseError(logLine, error = null) {
    // Attempt to extract partial information
    const partialData = this.extractPartialData(logLine);
    
    return {
      success: false,
      data: partialData,
      errors: [{
        type: 'clf_parse_error',
        message: error ? error.message : 'Line does not match CLF format',
        originalLine: logLine,
        pattern: this.pattern.toString()
      }]
    };
  }

  extractPartialData(logLine) {
    // Extract whatever we can from malformed CLF
    const parts = logLine.split(' ');
    
    return {
      ip: parts[0] || null,
      timestamp: new Date(),
      method: this.extractMethod(logLine),
      status: this.extractStatus(logLine),
      _malformed: true,
      _originalLine: logLine
    };
  }

  extractMethod(logLine) {
    const methodMatch = logLine.match(/"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)"/);
    return methodMatch ? methodMatch[1] : null;
  }

  extractStatus(logLine) {
    const statusMatch = logLine.match(/" (\d{3}) /);
    return statusMatch ? parseInt(statusMatch[1]) : null;
  }
}
```

## CSV Log Parser

### CSV Parser Implementation

```javascript
class CSVLogParser {
  constructor(options = {}) {
    this.delimiter = options.delimiter || ',';
    this.quote = options.quote || '"';
    this.escape = options.escape || '"';
    this.headers = options.headers || ['timestamp', 'level', 'message', 'metadata'];
    this.skipEmptyLines = options.skipEmptyLines !== false;
  }

  parse(logLine) {
    if (this.skipEmptyLines && !logLine.trim()) {
      return { success: true, data: null, errors: [] };
    }

    try {
      const fields = this.parseCSVLine(logLine);
      const data = this.mapFieldsToHeaders(fields);
      
      // Parse JSON metadata if present
      if (data.metadata) {
        try {
          data.metadata = JSON.parse(data.metadata);
        } catch (jsonError) {
          data.metadata = { _unparseable: data.metadata };
        }
      }

      // Convert timestamp
      if (data.timestamp) {
        data.timestamp = new Date(data.timestamp);
      }

      return {
        success: true,
        data,
        errors: []
      };
      
    } catch (error) {
      return this.handleParseError(logLine, error);
    }
  }

  parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === this.quote) {
        if (inQuotes && nextChar === this.quote) {
          // Escaped quote within quoted field
          current += this.quote;
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === this.delimiter && !inQuotes) {
        // Field delimiter outside quotes
        fields.push(current);
        current = '';
        i++;
      } else {
        // Regular character
        current += char;
        i++;
      }
    }

    // Add final field
    fields.push(current);
    
    return fields;
  }

  mapFieldsToHeaders(fields) {
    const data = {};
    
    for (let i = 0; i < this.headers.length; i++) {
      data[this.headers[i]] = fields[i] || null;
    }

    // Add extra fields if present
    if (fields.length > this.headers.length) {
      data._extraFields = fields.slice(this.headers.length);
    }

    return data;
  }

  handleParseError(logLine, error) {
    return {
      success: false,
      data: {
        _originalLine: logLine,
        _parseError: error.message,
        timestamp: new Date()
      },
      errors: [{
        type: 'csv_parse_error',
        message: error.message,
        originalLine: logLine
      }]
    };
  }
}
```

## String Format Parser

### String Format Parser Implementation

```javascript
class StringLogParser {
  constructor(options = {}) {
    this.timestampFormats = options.timestampFormats || [
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,  // YYYY-MM-DD HH:mm:ss
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,  // ISO format
    ];
    this.levelPattern = options.levelPattern || /\[(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\]/;
  }

  parse(logLine) {
    try {
      const parsed = this.parseStringLog(logLine);
      
      return {
        success: true,
        data: parsed,
        errors: []
      };
      
    } catch (error) {
      return this.handleParseError(logLine, error);
    }
  }

  parseStringLog(logLine) {
    const line = logLine.trim();
    
    // Extract timestamp
    const timestamp = this.extractTimestamp(line);
    let remaining = line.substring(timestamp.length).trim();

    // Extract level
    const levelMatch = remaining.match(this.levelPattern);
    const level = levelMatch ? levelMatch[1] : 'INFO';
    
    if (levelMatch) {
      remaining = remaining.substring(levelMatch.index + levelMatch[0].length).trim();
    }

    // Split message and metadata
    const { message, metadata } = this.splitMessageAndMetadata(remaining);

    return {
      timestamp: new Date(timestamp),
      level,
      message,
      ...(metadata && { metadata }),
      format: 'string'
    };
  }

  extractTimestamp(line) {
    for (const pattern of this.timestampFormats) {
      const match = line.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    // Fallback: assume first 19 characters are timestamp
    return line.substring(0, 19);
  }

  splitMessageAndMetadata(remaining) {
    // Look for JSON metadata at the end
    const jsonMatch = remaining.match(/^(.+?)(\{.+\})$/);
    
    if (jsonMatch) {
      const message = jsonMatch[1].trim();
      const metadataStr = jsonMatch[2];
      
      try {
        const metadata = JSON.parse(metadataStr);
        return { message, metadata };
      } catch (jsonError) {
        // If JSON parsing fails, include as raw metadata
        return { 
          message, 
          metadata: { _raw: metadataStr, _parseError: jsonError.message } 
        };
      }
    }

    return { message: remaining, metadata: null };
  }

  handleParseError(logLine, error) {
    return {
      success: false,
      data: {
        timestamp: new Date(),
        level: 'UNKNOWN',
        message: logLine,
        _parseError: error.message,
        format: 'string'
      },
      errors: [{
        type: 'string_parse_error',
        message: error.message,
        originalLine: logLine
      }]
    };
  }
}
```

## XML Log Parser

### XML Parser Implementation

```javascript
class XMLLogParser {
  constructor(options = {}) {
    this.xmlParser = options.xmlParser || new DOMParser();
    this.rootElement = options.rootElement || 'log';
    this.fieldMappings = options.fieldMappings || {
      timestamp: 'timestamp',
      level: 'level', 
      message: 'message',
      meta: 'meta'
    };
  }

  parse(logLine) {
    try {
      const xmlDoc = this.xmlParser.parseFromString(logLine.trim(), 'text/xml');
      
      // Check for parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        throw new Error(`XML parse error: ${parseError.textContent}`);
      }

      const data = this.extractDataFromXML(xmlDoc);
      
      return {
        success: true,
        data,
        errors: []
      };
      
    } catch (error) {
      return this.handleParseError(logLine, error);
    }
  }

  extractDataFromXML(xmlDoc) {
    const rootElement = xmlDoc.querySelector(this.rootElement);
    
    if (!rootElement) {
      throw new Error(`Root element '${this.rootElement}' not found`);
    }

    const data = { format: 'xml' };

    // Extract mapped fields
    for (const [dataField, xmlField] of Object.entries(this.fieldMappings)) {
      const element = rootElement.querySelector(xmlField);
      
      if (element) {
        let value = element.textContent;
        
        // Special handling for specific fields
        if (dataField === 'timestamp') {
          data[dataField] = new Date(value);
        } else if (dataField === 'meta' && value) {
          // Try to parse meta as JSON
          try {
            data[dataField] = JSON.parse(value);
          } catch (jsonError) {
            data[dataField] = { _raw: value };
          }
        } else {
          data[dataField] = value;
        }
      }
    }

    // Extract attributes from root element
    const attributes = {};
    for (const attr of rootElement.attributes) {
      attributes[attr.name] = attr.value;
    }
    
    if (Object.keys(attributes).length > 0) {
      data._attributes = attributes;
    }

    return data;
  }

  handleParseError(logLine, error) {
    return {
      success: false,
      data: {
        timestamp: new Date(),
        level: 'UNKNOWN',
        message: 'XML parse error',
        _originalXML: logLine,
        _parseError: error.message,
        format: 'xml'
      },
      errors: [{
        type: 'xml_parse_error',
        message: error.message,
        originalLine: logLine.substring(0, 200) + '...'
      }]
    };
  }
}
```

## Stream Processing Parser

### Multi-Format Stream Parser

```javascript
class LogStreamProcessor {
  constructor() {
    this.parsers = new Map();
    this.formatDetectors = [];
    this.lineBuffer = '';
    this.stats = {
      totalLines: 0,
      successfulParses: 0,
      errors: 0,
      formatCounts: {}
    };
  }

  registerParser(format, parser) {
    this.parsers.set(format, parser);
  }

  registerFormatDetector(detector) {
    this.formatDetectors.push(detector);
  }

  processChunk(chunk) {
    this.lineBuffer += chunk;
    const lines = this.lineBuffer.split('\n');
    
    // Keep last incomplete line in buffer
    this.lineBuffer = lines.pop() || '';
    
    const results = [];
    
    for (const line of lines) {
      if (line.trim()) {
        const result = this.processLine(line);
        results.push(result);
      }
    }
    
    return results;
  }

  processLine(line) {
    this.stats.totalLines++;
    
    // Detect format
    const format = this.detectFormat(line);
    
    // Get appropriate parser
    const parser = this.parsers.get(format);
    
    if (!parser) {
      return this.createUnknownFormatResult(line);
    }

    // Parse line
    const result = parser.parse(line);
    
    // Update statistics
    if (result.success) {
      this.stats.successfulParses++;
    } else {
      this.stats.errors++;
    }
    
    this.stats.formatCounts[format] = (this.stats.formatCounts[format] || 0) + 1;
    
    // Add format detection metadata
    result.detectedFormat = format;
    result.parseStats = { ...this.stats };
    
    return result;
  }

  detectFormat(line) {
    for (const detector of this.formatDetectors) {
      const format = detector(line);
      if (format) {
        return format;
      }
    }
    
    return 'unknown';
  }

  createUnknownFormatResult(line) {
    this.stats.errors++;
    
    return {
      success: false,
      data: {
        timestamp: new Date(),
        level: 'UNKNOWN',
        message: line,
        format: 'unknown'
      },
      errors: [{
        type: 'unknown_format',
        message: 'Could not detect log format',
        originalLine: line
      }],
      detectedFormat: 'unknown'
    };
  }

  getStats() {
    return { ...this.stats };
  }

  reset() {
    this.lineBuffer = '';
    this.stats = {
      totalLines: 0,
      successfulParses: 0,
      errors: 0,
      formatCounts: {}
    };
  }
}
```

## Format Detection

### Automatic Format Detection

```javascript
// Format detection functions
const formatDetectors = [
  // JSON detection
  (line) => {
    const trimmed = line.trim();
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) ? 'json' : null;
  },
  
  // CLF detection
  (line) => {
    const clfPattern = /^\S+ \S+ \S+ \[.+\] ".+" \d+ \S+/;
    return clfPattern.test(line) ? 'clf' : null;
  },
  
  // CSV detection
  (line) => {
    const csvPattern = /^"[^"]*"(,"[^"]*")+$/;
    return csvPattern.test(line) ? 'csv' : null;
  },
  
  // XML detection
  (line) => {
    const trimmed = line.trim();
    return (trimmed.startsWith('<') && trimmed.endsWith('>')) ? 'xml' : null;
  },
  
  // String format detection (fallback)
  (line) => {
    const stringPattern = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/;
    return stringPattern.test(line) ? 'string' : null;
  }
];
```

## Usage Examples

### Setting Up Multi-Format Parser

```javascript
// Initialize stream processor
const processor = new LogStreamProcessor();

// Register parsers
processor.registerParser('json', new AdvancedJSONParser({
  schema: { required: ['timestamp', 'level', 'message'] },
  enrichmentRules: [
    {
      condition: (data) => data.level === 'ERROR',
      enrich: (data) => ({ ...data, priority: 'high' })
    }
  ]
}));

processor.registerParser('clf', new CLFParser({ extended: true }));
processor.registerParser('csv', new CSVLogParser({ 
  headers: ['timestamp', 'level', 'message', 'metadata'] 
}));
processor.registerParser('xml', new XMLLogParser());
processor.registerParser('string', new StringLogParser());

// Register format detectors
for (const detector of formatDetectors) {
  processor.registerFormatDetector(detector);
}

// Process log stream
const logStream = fs.createReadStream('/tmp/codeuser/app.log');
logStream.on('data', (chunk) => {
  const results = processor.processChunk(chunk.toString());
  
  for (const result of results) {
    if (result.success) {
      console.log('Parsed:', result.data);
    } else {
      console.error('Parse error:', result.errors);
    }
  }
});
```

### Error Recovery and Validation

```javascript
// Enhanced error handling
class RobustLogParser {
  constructor(parsers) {
    this.parsers = parsers;
    this.fallbackParser = new StringLogParser();
  }

  parseWithRecovery(line) {
    // Try all registered parsers
    for (const [format, parser] of this.parsers) {
      try {
        const result = parser.parse(line);
        if (result.success) {
          return { ...result, format };
        }
      } catch (error) {
        continue; // Try next parser
      }
    }

    // Fallback to string parser
    const fallbackResult = this.fallbackParser.parse(line);
    return { 
      ...fallbackResult, 
      format: 'fallback',
      warnings: ['Used fallback parser']
    };
  }
}
```

This comprehensive parsing guide provides robust implementations for all log formats used by the restaurant application, with proper error handling, recovery mechanisms, and performance optimizations for production use.