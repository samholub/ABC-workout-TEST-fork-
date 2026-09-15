'use strict';
var devices = require('@playwright/test').devices;

module.exports = {
  testDir: __dirname,
  testMatch: /.*\.spec\.js/,
  timeout: 60000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: Object.assign({}, devices['Pixel 5'], {
    baseURL: 'http://127.0.0.1:8123',
    browserName: 'chromium'
  }),
  webServer: {
    command: 'node tests/serve.js',
    url: 'http://127.0.0.1:8123/index.html',
    cwd: require('path').join(__dirname, '..'),
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  }
};
