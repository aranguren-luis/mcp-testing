const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results.json' }]
  ],
  use: {
    ...devices['Desktop Chrome'], // Usar Chrome por defecto
    headless: true,
    screenshot: 'on',
    trace: 'on',
  },
});
