/**
 * Take 4-state mockup screenshots from 02_capture.html
 * Uses playwright-core with chromium from system Chrome
 */
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../../..');
const MOCKUP = `file://${resolve(ROOT, 'design/mockups/wrongbook/02_capture.html')}`;
const OUT_DIR = resolve(ROOT, 'design/system/screenshots/mp-baseline');

// Use playwright-core from pnpm store
const pw = await import(resolve(ROOT, 'frontend/node_modules/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs'));
const { chromium } = pw;

async function main() {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
  });
  const ctx = await browser.newContext({ viewport: { width: 500, height: 960 } });
  const page = await ctx.newPage();

  // State 1: IDLE
  await page.goto(MOCKUP, { waitUntil: 'networkidle' });
  await page.screenshot({ path: resolve(OUT_DIR, 'p02-idle.png'), fullPage: true });
  console.log('✓ p02-idle.png');

  // State 2: FOCUSING
  await page.goto(MOCKUP, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const scan = document.querySelector('.scan');
    if (scan) scan.style.height = '4px';
    const badge = document.querySelector('.detect');
    if (badge) badge.textContent = '对焦中 · 请保持稳定';
  });
  await page.screenshot({ path: resolve(OUT_DIR, 'p02-focusing.png'), fullPage: true });
  console.log('✓ p02-focusing.png');

  // State 3: CAPTURED
  await page.goto(MOCKUP, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.querySelectorAll('.bracket').forEach(b => {
      b.style.borderColor = '#34C759';
      b.style.boxShadow = '0 0 18px rgba(52,199,89,.45)';
    });
    const scan = document.querySelector('.scan');
    if (scan) scan.style.display = 'none';
    const badge = document.querySelector('.detect');
    if (badge) badge.textContent = '已捕获 · 正在处理';
  });
  await page.screenshot({ path: resolve(OUT_DIR, 'p02-captured.png'), fullPage: true });
  console.log('✓ p02-captured.png');

  // State 4: UPLOADING
  await page.goto(MOCKUP, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const view = document.querySelector('.view');
    if (!view) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.6);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10;';
    overlay.innerHTML = `
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="5"/>
        <circle cx="36" cy="36" r="30" fill="none" stroke="#007AFF" stroke-width="5"
          stroke-linecap="round" stroke-dasharray="188.5" stroke-dashoffset="56.5"
          transform="rotate(-90 36 36)"/>
      </svg>
      <span style="color:#fff;font-size:16px;margin-top:8px;font-weight:600;">70%</span>
    `;
    view.appendChild(overlay);
    document.querySelectorAll('.bracket').forEach(b => b.style.display = 'none');
    const scan = document.querySelector('.scan');
    if (scan) scan.style.display = 'none';
    const badge = document.querySelector('.detect');
    if (badge) badge.style.display = 'none';
  });
  await page.screenshot({ path: resolve(OUT_DIR, 'p02-uploading.png'), fullPage: true });
  console.log('✓ p02-uploading.png');

  await browser.close();
  console.log('Done: 4 screenshots in', OUT_DIR);
}

main().catch(e => { console.error(e); process.exit(1); });
