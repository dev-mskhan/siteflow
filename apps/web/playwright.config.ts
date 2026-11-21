import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration for Subscription Flow Testing
 * Tests real Stripe integration with Ethereal email catching
 */
export default defineConfig({
  testDir: './e2e',
  
  // Run tests in sequence (Stripe webhooks need to complete)
  fullyParallel: false,
  workers: 1,
  
  // Test timeout (Stripe can be slow)
  timeout: 120 * 1000, // 2 minutes per test
  
  // Retry on failure
  retries: process.env.CI ? 2 : 0,
  
  // Reporter
  reporter: [
    ['html'],
    ['list'],
  ],
  
  use: {
    // Base URL for the application
    baseURL: process.env.FRONTEND_URL || 'http://localhost:5173',
    
    // API URL for the backend
    // @ts-ignore
    apiURL: process.env.API_URL || 'http://localhost:3000/api/v1',
    
    // Trace on first retry
    trace: 'on-first-retry',
    
    // Screenshots on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',
    
    // Longer action timeout for Stripe redirects
    actionTimeout: 30 * 1000,
    
    // Longer navigation timeout for Stripe
    navigationTimeout: 60 * 1000,
  },

  // Projects - Only Chrome for real Stripe testing
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use headed mode to see real browser (helps debug Stripe flow)
        headless: process.env.CI ? true : false,
      },
    },
  ],

  // Web server configuration
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
