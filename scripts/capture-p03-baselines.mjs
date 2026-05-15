/**
 * Capture P03 mockup HTML as 4-state baseline screenshots.
 * States: idle (all wait), uploading (step 1-2 done, 3 now), success (all done), error (step 2 fail)
 *
 * Usage: npx playwright test scripts/capture-p03-baselines.mjs
 *   OR:  node scripts/capture-p03-baselines.mjs  (requires playwright installed)
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MOCKUP = `file://${path.join(ROOT, 'design/mockups/wrongbook/03_analyzing.html')}`;
const OUT = path.join(ROOT, 'design/system/screenshots/baseline');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // ── State 1: IDLE (all steps wait) ──────────────────────────
  await page.goto(MOCKUP, { waitUntil: 'networkidle' });
  // Reset all steps to wait state
  await page.evaluate(() => {
    document.querySelectorAll('.step').forEach((el, i) => {
      el.className = 'step wait';
      const ico = el.querySelector('.ico');
      if (ico) {
        ico.className = 'ico wait';
        ico.innerHTML = String(i + 1);
      }
      // remove shimmer
      const shim = el.querySelector('.shim');
      if (shim) shim.remove();
      // reset desc
      const desc = el.querySelector('.desc');
      if (desc) desc.textContent = '等待中';
      // remove time span
      const tSpan = el.querySelector('.title .t');
      if (tSpan) tSpan.remove();
    });
    // Reset title badge to 0/4
    const badge = document.querySelector('.nav .badge');
    if (badge) badge.textContent = '0 / 4';
    // Reset nav title
    const h1 = document.querySelector('.nav h1');
    if (h1) {
      h1.childNodes[0].textContent = 'AI 正在分析… ';
    }
  });
  const screen = page.locator('.screen');
  await screen.screenshot({ path: path.join(OUT, 'p03-idle.png') });
  console.log('✓ p03-idle.png');

  // ── State 2: UPLOADING / in-progress (mockup default: step 1-2 done, step 3 now, step 4 wait) ──
  await page.goto(MOCKUP, { waitUntil: 'networkidle' });
  await screen.screenshot({ path: path.join(OUT, 'p03-uploading.png') });
  console.log('✓ p03-uploading.png');

  // ── State 3: SUCCESS (all 4 steps done) ─────────────────────
  await page.goto(MOCKUP, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const checkSvg = '<svg viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    document.querySelectorAll('.step').forEach((el, i) => {
      el.className = 'step';
      const ico = el.querySelector('.ico');
      if (ico) {
        ico.className = 'ico done';
        ico.innerHTML = checkSvg;
      }
      // remove shimmer
      const shim = el.querySelector('.shim');
      if (shim) shim.remove();
      // add duration
      const title = el.querySelector('.title');
      const existingT = title?.querySelector('.t');
      if (!existingT && title) {
        const span = document.createElement('span');
        span.className = 't';
        span.textContent = '· ' + [0.8, 0.6, 1.2, 0.9][i] + 's';
        title.appendChild(span);
      }
    });
    // Update badge to 4/4
    const badge = document.querySelector('.nav .badge');
    if (badge) badge.textContent = '4 / 4';
  });
  await screen.screenshot({ path: path.join(OUT, 'p03-success.png') });
  console.log('✓ p03-success.png');

  // ── State 4: ERROR (step 1 done, step 2 fail, rest wait) ───
  await page.goto(MOCKUP, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const checkSvg = '<svg viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const xSvg = '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>';
    const steps = document.querySelectorAll('.step');
    // Step 1: done
    steps[0].className = 'step';
    steps[0].querySelector('.ico').className = 'ico done';
    steps[0].querySelector('.ico').innerHTML = checkSvg;
    // Step 2: fail (red)
    steps[1].className = 'step';
    steps[1].querySelector('.ico').className = 'ico done';
    steps[1].querySelector('.ico').innerHTML = xSvg;
    steps[1].querySelector('.ico').style.background = '#FF3B30';
    steps[1].querySelector('.title').style.color = '#FF3B30';
    const desc2 = steps[1].querySelector('.desc');
    if (desc2) { desc2.textContent = 'AI 模型超时，正在切换…'; desc2.style.color = '#FF3B30'; }
    // Step 3: wait
    steps[2].className = 'step wait';
    steps[2].querySelector('.ico').className = 'ico wait';
    steps[2].querySelector('.ico').innerHTML = '3';
    const shim3 = steps[2].querySelector('.shim');
    if (shim3) shim3.remove();
    steps[2].querySelector('.desc').textContent = '等待中';
    // Step 4: wait
    steps[3].className = 'step wait';
    steps[3].querySelector('.ico').className = 'ico wait';
    steps[3].querySelector('.ico').innerHTML = '4';
    steps[3].querySelector('.desc').textContent = '等待中';
    // Update badge
    const badge = document.querySelector('.nav .badge');
    if (badge) badge.textContent = '1 / 4';
    // Add error banner before .stages
    const stages = document.querySelector('.stages');
    const banner = document.createElement('div');
    banner.style.cssText = 'margin-bottom:10px;padding:10px 14px;border-radius:10px;background:rgba(255,59,48,.1);border:.5px solid rgba(255,59,48,.35);color:#FF3B30;font-size:13px;font-weight:500;';
    banner.textContent = 'AI 暂时帮不上忙，请稍后重试';
    stages.parentElement.insertBefore(banner, stages);
  });
  await screen.screenshot({ path: path.join(OUT, 'p03-error.png') });
  console.log('✓ p03-error.png');

  await browser.close();
  console.log('\nDone: 4 baseline PNGs in', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
