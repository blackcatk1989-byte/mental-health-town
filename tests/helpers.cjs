// 測試共用：啟動瀏覽器並把 three.js 的 CDN 請求導到本機複本（測試環境無法連外時使用）。
// 用法：THREE_DIR=/path/to/three/package BASE=http://localhost:8000 node tests/e2e.cjs
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:8000';
const THREE_DIR = process.env.THREE_DIR;

async function launch({ mobile = false, offline3d = false } = {}) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 800 } });
  await context.route('https://cdn.jsdelivr.net/**', async (route) => {
    const url = route.request().url();
    const m = url.match(/three@0\.170\.0\/(.*)$/);
    if (offline3d || !THREE_DIR || !m) return route.abort();
    const file = path.join(THREE_DIR, m[1]);
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ body: fs.readFileSync(file), contentType: 'application/javascript' });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
  return { browser, context, page, errors };
}

module.exports = { launch, BASE };
