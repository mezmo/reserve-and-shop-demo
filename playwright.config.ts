import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for OTEL UI Testing
 * Tests the OpenTelemetry configuration interface
 */
export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: [
    {
      command: 'npm run server',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run client',
      port: 8080,
      reuseExistingServer: !process.env.CI,
    },
  ],
});