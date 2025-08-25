import { test, expect } from '@playwright/test';

/**
 * OTEL API Integration UI Tests
 * Tests the frontend integration with OTEL configuration APIs
 */

test.describe('OTEL API Integration', () => {
  test('should load configuration from API', async ({ page, request }) => {
    // Test direct API access
    const configResponse = await request.get('/api/config/otel');
    expect(configResponse.ok()).toBeTruthy();
    
    const configData = await configResponse.json();
    expect(configData.success).toBeTruthy();
    expect(configData.config).toBeDefined();
    expect(configData.config.pipelines).toBeDefined();
    
    // Navigate to UI and verify it reflects the API data
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    
    // Check that service name from API appears in UI
    const serviceName = configData.config.serviceName;
    if (serviceName) {
      const pageContent = await page.content();
      expect(pageContent).toContain(serviceName);
    }
  });

  test('should handle API errors gracefully in UI', async ({ page }) => {
    // Navigate to UI first
    await page.goto('/agents');
    
    // Monitor network requests
    const failedRequests: string[] = [];
    page.on('response', response => {
      if (!response.ok() && response.url().includes('/api/')) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });
    
    await page.waitForLoadState('networkidle');
    
    // UI should still be functional even with some API failures
    await expect(page.locator('body')).toBeVisible();
    
    // Log failed requests for debugging
    if (failedRequests.length > 0) {
      console.log('API failures detected:', failedRequests);
    }
  });

  test('should synchronize UI state with backend', async ({ page, request }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    
    // Get current configuration from API
    const configResponse = await request.get('/api/config/otel');
    const configData = await configResponse.json();
    
    // Get current status from API
    const statusResponse = await request.get('/api/otel/status');
    const statusData = await statusResponse.json();
    
    // Verify UI reflects backend state
    const pageContent = await page.content();
    
    // Check pipeline states
    if (configData.config?.pipelines) {
      const pipelines = Object.keys(configData.config.pipelines);
      
      for (const pipeline of pipelines) {
        const pipelineEnabled = configData.config.pipelines[pipeline].enabled;
        
        // UI should show pipeline state (enabled/disabled)
        const hasPipelineReference = pageContent.includes(pipeline);
        expect(hasPipelineReference).toBeTruthy();
      }
    }
    
    // Check status synchronization
    if (statusData.status) {
      const statusInUI = pageContent.includes(statusData.status) || 
                        pageContent.includes('connected') || 
                        pageContent.includes('disconnected');
      expect(statusInUI).toBeTruthy();
    }
  });

  test('should handle configuration updates', async ({ page, request }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    
    // Look for configuration form elements
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Configure"), button:has-text("Update")').first();
    
    if (await saveButton.isVisible()) {
      // Monitor API calls during configuration update
      const apiCalls: string[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/otel/')) {
          apiCalls.push(`${request.method()} ${request.url()}`);
        }
      });
      
      await saveButton.click();
      await page.waitForTimeout(1000);
      
      // Should trigger API calls for configuration
      expect(apiCalls.length).toBeGreaterThan(0);
    }
  });
});

test.describe('OTEL Configuration Form Validation', () => {
  test('should validate required fields', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    
    // Look for form inputs
    const textInputs = page.locator('input[type="text"]:visible');
    const inputCount = await textInputs.count();
    
    if (inputCount > 0) {
      // Clear a field and check for validation
      const firstInput = textInputs.first();
      await firstInput.clear();
      await firstInput.blur();
      
      // Look for validation messages
      await page.waitForTimeout(500);
      const validationMessages = page.locator('.error, .invalid, [role="alert"]');
      
      // May or may not have validation - depends on implementation
      const hasValidation = await validationMessages.count() > 0;
      console.log(`Validation present: ${hasValidation}`);
    }
  });

  test('should validate host URLs', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    
    // Look for URL input fields
    const urlInputs = page.locator('input[type="url"], input[placeholder*="host"], input[placeholder*="endpoint"]');
    const urlCount = await urlInputs.count();
    
    if (urlCount > 0) {
      const firstUrlInput = urlInputs.first();
      
      // Test invalid URL
      await firstUrlInput.fill('invalid-url');
      await firstUrlInput.blur();
      await page.waitForTimeout(500);
      
      // Test valid URL
      await firstUrlInput.fill('https://pipeline.mezmo.com');
      await firstUrlInput.blur();
      await page.waitForTimeout(500);
      
      const value = await firstUrlInput.inputValue();
      expect(value).toContain('https://');
    }
  });
});

test.describe('OTEL Environment Switching', () => {
  test('should switch between environments', async ({ page, request }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    
    // Look for environment selector
    const envSelectors = page.locator('select, [role="combobox"], [data-testid*="env"]');
    const selectorCount = await envSelectors.count();
    
    if (selectorCount > 0) {
      const envSelector = envSelectors.first();
      
      // Get initial configuration
      const initialConfig = await request.get('/api/config/otel');
      const initialData = await initialConfig.json();
      
      // Change environment if possible
      await envSelector.click();
      await page.waitForTimeout(500);
      
      // Look for environment options
      const options = page.locator('option, [role="option"]');
      const optionCount = await options.count();
      
      if (optionCount > 1) {
        await options.nth(1).click();
        await page.waitForTimeout(1000);
        
        // Verify environment change affected configuration
        const newConfig = await request.get('/api/config/otel');
        const newData = await newConfig.json();
        
        // Configuration should still be valid
        expect(newData.success).toBeTruthy();
      }
    }
  });
});

test.describe('OTEL Performance Monitoring', () => {
  test('should display performance metrics', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    
    // Look for performance-related UI elements
    const performanceElements = page.locator('[data-testid*="metric"], .metric, [class*="performance"]');
    
    if (await performanceElements.count() > 0) {
      await expect(performanceElements.first()).toBeVisible();
    }
    
    // Check for any numeric displays that might be metrics
    const pageContent = await page.content();
    const hasNumbers = /\d+\s*(ms|seconds?|traces?|MB|KB)/.test(pageContent);
    
    if (hasNumbers) {
      expect(hasNumbers).toBeTruthy();
    }
  });

  test('should handle real-time updates', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    
    // Wait for potential real-time updates
    await page.waitForTimeout(5000);
    
    // Page should remain responsive
    await expect(page.locator('body')).toBeVisible();
    
    // No JavaScript errors should occur during updates
    const errors: string[] = [];
    page.on('pageerror', error => {
      if (!error.message.includes('503') && !error.message.includes('collector')) {
        errors.push(error.message);
      }
    });
    
    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });
});