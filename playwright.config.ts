import { defineConfig } from '@playwright/test';
const production = process.env.TEST_PRODUCTION === '1';
const url = production ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:5173';
export default defineConfig({
  testDir:'./tests/browser',
  use:{ baseURL:url, browserName:process.env.PLAYWRIGHT_WEBKIT==='1'?'webkit':'chromium', ...(process.env.PLAYWRIGHT_WEBKIT==='1'?{isMobile:true,hasTouch:true,deviceScaleFactor:3}:{}), launchOptions:process.env.PLAYWRIGHT_WEBKIT!=='1'&&process.env.PLAYWRIGHT_EDGE==='1'?{channel:'msedge'}:{} },
  webServer:{command:production?'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173':'node node_modules/vite/bin/vite.js --host 127.0.0.1',url,reuseExistingServer:!process.env.CI},
});
