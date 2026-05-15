/**
 * Screenshot P03 analyzing mockup · 4 states
 * Usage: node scripts/screenshot-p03.mjs
 * Outputs: design/system/screenshots/mp-baseline/p03-{init,analyzing,success,error}.png
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MOCKUP = `file://${path.join(ROOT, 'design/mockups/wrongbook/03_analyzing.html')}`;
const OUT = path.join(ROOT, 'design/system/screenshots/mp-baseline');

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
  });

  // ── State 1: init (just loaded, all steps wait) ──
  {
    const page = await ctx.newPage();
    await page.goto(MOCKUP);
    // Modify title to show init state
    await page.evaluate(() => {
      const h1 = document.querySelector('.nav h1');
      if (h1) h1.innerHTML = '准备分析… <span class="badge">0 / 4</span>';
      // All steps to wait
      document.querySelectorAll('.step').forEach(el => {
        el.className = 'step wait';
        const ico = el.querySelector('.ico');
        if (ico) { ico.className = 'ico wait'; ico.innerHTML = ico.textContent?.trim() || ''; }
      });
    });
    await page.screenshot({ path: path.join(OUT, 'p03-init.png'), clip: { x: 0, y: 0, width: 393, height: 852 } });
    await page.close();
  }

  // ── State 2: analyzing (mockup default — step 3 active) ──
  {
    const page = await ctx.newPage();
    await page.goto(MOCKUP);
    await page.screenshot({ path: path.join(OUT, 'p03-analyzing.png'), clip: { x: 0, y: 0, width: 393, height: 852 } });
    await page.close();
  }

  // ── State 3: success (all steps done) ──
  {
    const page = await ctx.newPage();
    await page.goto(MOCKUP);
    await page.evaluate(() => {
      const h1 = document.querySelector('.nav h1');
      if (h1) h1.innerHTML = 'AI 分析完成 <span class="badge">4 / 4</span>';
      const checkSvg = '<svg viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      document.querySelectorAll('.step').forEach(el => {
        el.className = 'step';
        const ico = el.querySelector('.ico');
        if (ico) { ico.className = 'ico done'; ico.innerHTML = checkSvg; }
        const desc = el.querySelector('.desc');
        if (desc) desc.textContent = '已完成';
        const shim = el.querySelector('.shim');
        if (shim) shim.remove();
      });
      const cancel = document.querySelector('.cancel');
      if (cancel) cancel.textContent = '查看结果';
    });
    await page.screenshot({ path: path.join(OUT, 'p03-success.png'), clip: { x: 0, y: 0, width: 393, height: 852 } });
    await page.close();
  }

  // ── State 4: error (step 3 failed) ──
  {
    const page = await ctx.newPage();
    await page.goto(MOCKUP);
    await page.evaluate(() => {
      const h1 = document.querySelector('.nav h1');
      if (h1) h1.innerHTML = 'AI 分析失败 <span class="badge" style="background:linear-gradient(135deg,#FF6B6B,#FF3B30)">2 / 4</span>';
      const steps = document.querySelectorAll('.step');
      // step 3 → fail
      if (steps[2]) {
        steps[2].className = 'step';
        const ico = steps[2].querySelector('.ico');
        if (ico) {
          ico.className = 'ico';
          ico.style.background = '#FF3B30';
          ico.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>';
        }
        const desc = steps[2].querySelector('.desc');
        if (desc) { desc.textContent = '分析失败 · 网络异常'; desc.style.color = '#FF3B30'; }
        const shim = steps[2].querySelector('.shim');
        if (shim) shim.remove();
      }
      const cancel = document.querySelector('.cancel');
      if (cancel) { cancel.textContent = '重试'; cancel.style.color = '#FF3B30'; }
    });
    await page.screenshot({ path: path.join(OUT, 'p03-error.png'), clip: { x: 0, y: 0, width: 393, height: 852 } });
    await page.close();
  }

  await browser.close();
  console.log('4 screenshots saved to', OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
