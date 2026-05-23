import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — T11 a11y + T14 mobile/reduced-motion tests.
 * webServer 가 vite preview 자동 시작 (port 4173 strictPort).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? [['list'], ['github']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'pnpm exec vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/NEKOWORK/',
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
