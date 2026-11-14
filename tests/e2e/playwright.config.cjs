const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.cjs',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.NEXTCLOUD_E2E_URL || 'http://127.0.0.1:18080',
    browserName: 'chromium',
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      // GitHub's ubuntu-24.04 runner supplies a matched Chrome and driver.
      executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
    // Never persist sessions, credentials, traces or uploaded file content.
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
})
