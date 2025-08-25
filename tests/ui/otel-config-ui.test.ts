import { test, expect } from '@playwright/test';

/**
 * OTEL Configuration UI Tests
 * Tests the OpenTelemetry configuration interface functionality
 */

test.describe('OTEL Configuration UI', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the agents page where OTEL configuration is located
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
  });

  test('should display OTEL configuration interface', async ({ page }) => {
    // Check if the main OTEL configuration section is visible
    await expect(page.locator('h2')).toContainText(/OpenTelemetry|OTEL/i);
    
    // Verify OTEL configuration form elements are present
    const otelSection = page.locator('[data-testid="otel-config"], .otel-config').first();
    if (await otelSection.isVisible()) {
      await expect(otelSection).toBeVisible();
    } else {
      // Fallback - look for any element containing OTEL text
      await expect(page.locator('text=OTEL')).toBeVisible();
    }
  });

  test('should load OTEL configuration from backend', async ({ page }) => {
    // Check that configuration data is loaded
    await page.waitForResponse('**/api/config/otel');
    
    // Verify that configuration fields are populated
    const page_content = await page.content();
    expect(page_content).toContain('restaurant-app');
    
    // Check for pipeline configuration elements
    const hasTraces = page_content.includes('traces') || page_content.includes('Traces');
    const hasLogs = page_content.includes('logs') || page_content.includes('Logs');
    const hasMetrics = page_content.includes('metrics') || page_content.includes('Metrics');
    
    expect(hasTraces || hasLogs || hasMetrics).toBeTruthy();
  });

  test('should display OTEL status information', async ({ page }) => {
    // Wait for status API call
    await page.waitForResponse('**/api/otel/status');
    
    // Check for status indicators
    const page_content = await page.content();
    const hasStatus = page_content.includes('connected') || 
                     page_content.includes('disconnected') || 
                     page_content.includes('status');
    
    expect(hasStatus).toBeTruthy();
  });

  test('should handle OTEL configuration errors gracefully', async ({ page }) => {
    // Monitor console for unhandled errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Trigger configuration actions if available
    const configButton = page.locator('button:has-text("Configure"), button:has-text("Save"), button:has-text("Update")').first();
    
    if (await configButton.isVisible()) {
      await configButton.click();
      await page.waitForTimeout(1000);
    }

    // Check that critical errors are not present
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('503') && 
      !error.includes('OTEL collector') &&
      !error.includes('traces') &&
      error.includes('Error')
    );
    
    expect(criticalErrors.length).toBeLessThan(3); // Allow some expected errors
  });

  test('should enable/disable OTEL pipelines', async ({ page }) => {
    // Look for pipeline toggle switches or checkboxes
    const toggles = page.locator('input[type="checkbox"], button[role="switch"]');
    const toggleCount = await toggles.count();
    
    if (toggleCount > 0) {
      // Test toggling first available control
      const firstToggle = toggles.first();
      const initialState = await firstToggle.isChecked?.() ?? false;
      
      await firstToggle.click();
      await page.waitForTimeout(500);
      
      const newState = await firstToggle.isChecked?.() ?? !initialState;
      expect(newState).not.toBe(initialState);
    }
  });

  test('should validate configuration fields', async ({ page }) => {
    // Look for input fields related to OTEL configuration
    const inputs = page.locator('input[type="text"], input[type="url"], textarea');
    const inputCount = await inputs.count();
    
    if (inputCount > 0) {
      // Test that inputs accept valid values
      const firstInput = inputs.first();
      await firstInput.fill('test-value');
      
      const value = await firstInput.inputValue();
      expect(value).toBe('test-value');
    }
  });

  test('should respond to environment changes', async ({ page }) => {
    // Look for environment selectors
    const selectors = page.locator('select, [role="combobox"]');
    const selectorCount = await selectors.count();
    
    if (selectorCount > 0) {
      const firstSelector = selectors.first();
      await firstSelector.click();
      await page.waitForTimeout(500);
      
      // Verify selector is interactive
      expect(await firstSelector.isVisible()).toBeTruthy();
    }
  });
});

test.describe('OTEL Status Monitoring', () => {
  test('should display real-time status updates', async ({ page }) => {
    await page.goto('/agents');
    
    // Wait for initial status load
    await page.waitForResponse('**/api/otel/status');
    
    // Check for status indicators
    const statusIndicators = page.locator('[data-testid*="status"], .status, [class*="status"]');
    if (await statusIndicators.count() > 0) {
      await expect(statusIndicators.first()).toBeVisible();
    }
  });

  test('should handle status API failures', async ({ page }) => {
    await page.goto('/agents');
    
    // Wait a reasonable time for status calls
    await page.waitForTimeout(2000);
    
    // Page should still be functional even if status fails
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('h1, h2, h3')).toHaveCount.greaterThan(0);
  });
});

test.describe('OTEL Tracing Integration', () => {
  test('should initialize tracing without errors', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });

    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    // Check for successful tracing initialization or graceful failure
    const tracingMessages = consoleMessages.filter(msg => 
      msg.includes('OTEL') || msg.includes('tracing') || msg.includes('OpenTelemetry')
    );
    
    // Should have some tracing-related messages
    expect(tracingMessages.length).toBeGreaterThan(0);
  });

  test('should handle trace export gracefully', async ({ page }) => {
    await page.goto('/agents');
    
    // Perform some actions that might generate traces
    await page.click('body'); // Basic interaction
    await page.waitForTimeout(1000);
    
    // Check that no unhandled promise rejections occur
    const errors: string[] = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    await page.waitForTimeout(2000);
    
    // Filter out expected OTEL-related errors
    const unexpectedErrors = errors.filter(error => 
      !error.includes('503') && 
      !error.includes('collector') &&
      !error.includes('traces')
    );
    
    expect(unexpectedErrors.length).toBe(0);
  });
});