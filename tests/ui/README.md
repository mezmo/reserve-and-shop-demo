# OTEL Configuration UI/UX Testing Guide

This document provides comprehensive testing strategies for the OpenTelemetry (OTEL) configuration user interface.

## 🎯 Testing Overview

The OTEL configuration UI consists of:
- **Main Interface**: `/src/pages/Agents.tsx` (31,975 lines - comprehensive OTEL configuration)
- **Configuration Page**: `/src/pages/Config.tsx` (additional settings)
- **Tracing Integration**: `/src/lib/tracing/config.ts` (frontend OTEL client)

## 🚀 Quick Start

### 1. Manual Testing (Immediate)

```bash
# Ensure both servers are running
npm run server  # Backend on port 3001
npm run client  # Frontend on port 8080

# Navigate to OTEL interfaces
open http://localhost:8080/agents  # Main OTEL configuration
open http://localhost:8080/config  # Additional configuration
```

### 2. Automated Testing (Playwright)

```bash
# Install dependencies (requires system browser dependencies)
npx playwright install-deps  # May require sudo

# Run tests
npm run test:ui              # Headless mode
npm run test:ui:headed       # With browser UI
npm run test:ui:debug        # Debug mode
npm run test:ui:report       # View test results
```

## 📋 Manual Testing Checklist

### Core OTEL Configuration

- [ ] **Page Load**
  - OTEL configuration interface loads without errors
  - Configuration data loads from `/api/config/otel`
  - Status information loads from `/api/otel/status`

- [ ] **Pipeline Configuration**
  - [ ] Traces pipeline: Enable/disable toggle works
  - [ ] Logs pipeline: Enable/disable toggle works  
  - [ ] Metrics pipeline: Enable/disable toggle works
  - [ ] Pipeline settings persist after page refresh

- [ ] **Environment Switching**
  - [ ] Development environment settings
  - [ ] Staging environment settings
  - [ ] Production environment settings
  - [ ] Custom host configuration

- [ ] **Status Monitoring**
  - [ ] Collector status displays correctly (connected/disconnected)
  - [ ] Health checks show current state
  - [ ] Error messages are clear and helpful
  - [ ] Status updates in real-time

### Form Validation & UX

- [ ] **Input Validation**
  - [ ] Service name accepts valid values
  - [ ] Host URLs validate format
  - [ ] Ingestion keys accept proper format
  - [ ] Pipeline IDs validate correctly

- [ ] **Error Handling**
  - [ ] Invalid configurations show clear errors
  - [ ] Network failures handled gracefully
  - [ ] Backend unavailable scenarios
  - [ ] Partial configuration saves

- [ ] **User Experience**
  - [ ] Forms are intuitive and well-labeled
  - [ ] Loading states during API calls
  - [ ] Success/failure feedback
  - [ ] Responsive design on different screen sizes

## 🔧 Browser DevTools Testing

### Network Monitoring
```javascript
// Open DevTools Network tab and monitor:
- GET /api/config/otel          // Configuration loading
- GET /api/otel/status          // Status monitoring  
- POST /api/otel/configure      // Configuration saves
- POST /api/traces/v1/traces    // Trace exports
```

### Console Monitoring
```javascript
// Check console for:
- OTEL initialization messages
- Tracing configuration logs
- Error handling (503 errors expected when collector unavailable)
- Performance warnings
```

### Application State
```javascript
// Test in browser console:
localStorage.getItem('otel-config')  // Configuration persistence
window.performance.getEntries()     // Performance metrics
```

## 🧪 Automated Test Scenarios

### 1. Configuration Loading (`otel-config-ui.test.ts`)
- Loads OTEL configuration interface
- Fetches configuration from backend API
- Displays status information correctly
- Handles API errors gracefully

### 2. API Integration (`otel-api-integration.test.ts`)
- Synchronizes UI state with backend
- Validates form inputs
- Tests environment switching
- Monitors performance metrics

### 3. Tracing Integration
- Initializes OTEL tracing client
- Handles trace export gracefully
- Manages collector unavailability

## ⚠️ Expected Limitations (Not Failures)

These are normal in test environments:

- **OTEL Collector Not Available**: Status shows "disconnected"
- **503 Errors**: Trace export failures when collector missing
- **Network Timeouts**: Some API calls may timeout
- **Configuration Warnings**: Missing collector binary warnings

## 🐛 Troubleshooting

### Common Issues

1. **Tests Won't Run**
   ```bash
   # Install browser dependencies
   sudo npx playwright install-deps
   
   # Or run in Docker
   docker run -it --rm -v $(pwd):/app mcr.microsoft.com/playwright:focal-20240729 /bin/bash
   ```

2. **Frontend Not Loading**
   ```bash
   # Check servers are running
   curl http://localhost:3001/api/health  # Backend
   curl http://localhost:8080             # Frontend
   ```

3. **API Failures**
   ```bash
   # Test API endpoints directly
   curl http://localhost:3001/api/config/otel
   curl http://localhost:3001/api/otel/status
   ```

### Performance Testing
```bash
# Load testing with curl
for i in {1..10}; do
  curl -s http://localhost:8080/api/config/otel > /dev/null &
done
wait

# Browser performance testing
# Use DevTools > Performance tab to profile
```

## 📊 Test Coverage Goals

- [ ] **Functional**: All UI components work correctly
- [ ] **Integration**: Frontend ↔ Backend API communication
- [ ] **Error Handling**: Graceful degradation when services unavailable
- [ ] **Performance**: Responsive UI under load
- [ ] **Accessibility**: Screen reader compatibility
- [ ] **Cross-Browser**: Chrome, Firefox, Safari compatibility

## 🚀 Advanced Testing

### Visual Regression Testing
```typescript
// Add to Playwright tests
await expect(page).toHaveScreenshot('otel-config.png');
```

### API Mocking
```typescript
// Mock API responses for error scenarios
await page.route('**/api/otel/status', route => {
  route.fulfill({
    status: 503,
    body: JSON.stringify({ error: 'Service Unavailable' })
  });
});
```

### Performance Metrics
```typescript
// Measure page load performance
const metrics = await page.evaluate(() => JSON.stringify(window.performance.timing));
```

## 📈 Success Criteria

✅ **Core Functionality**
- Configuration loads and displays correctly
- Form validation works properly
- API integration functions smoothly
- Error states handled gracefully

✅ **User Experience**
- Interface is intuitive and responsive
- Loading states provide feedback
- Error messages are helpful
- Forms save and persist correctly

✅ **Performance**
- Page loads within 2 seconds
- API calls complete within 5 seconds
- No memory leaks during extended use
- Smooth interactions without lag

✅ **Reliability**
- Works consistently across browser refreshes
- Handles network failures gracefully
- Recovers from temporary API unavailability
- Maintains state during user sessions

## 🔄 Continuous Testing

### CI/CD Integration
```yaml
# .github/workflows/ui-tests.yml
- name: Run UI Tests
  run: |
    npm run dev &
    npm run test:ui
```

### Monitoring
- Set up automated UI testing in CI pipeline
- Monitor real user metrics in production
- Track configuration success rates
- Monitor API performance metrics

---

**Next Steps:**
1. Run manual testing checklist
2. Execute automated Playwright tests
3. Set up continuous monitoring
4. Create performance benchmarks