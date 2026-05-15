/**
 * Capture 4-state mockup screenshots for P04 result page
 * States: loading, success, empty, error
 * Uses the design mockup HTML as source of truth
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/allen/workspace/longfeng/.claude/worktrees/sc01-mp-t03-analyzing/node_modules/playwright-core');
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MOCKUP = path.join(ROOT, 'design/mockups/wrongbook/04_result.html');
const OUT = path.join(ROOT, 'design/system/screenshots/mp-baseline');

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
  });

  // 1. Success state (default mockup = full content)
  const page = await ctx.newPage();
  await page.goto(`file://${MOCKUP}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'p04-success.png'), fullPage: false });
  console.log('✓ p04-success.png');

  // 2. Loading state - inject skeleton overlay
  await page.evaluate(() => {
    const content = document.querySelector('.content');
    if (content) content.innerHTML = `
      <div style="padding:20px;">
        <div style="background:#E5E5EA;border-radius:14px;height:120px;margin-bottom:14px;animation:pulse 1.5s ease infinite;"></div>
        <div style="background:#E5E5EA;border-radius:8px;height:18px;width:60%;margin-bottom:10px;"></div>
        <div style="background:#E5E5EA;border-radius:8px;height:18px;width:85%;margin-bottom:14px;"></div>
        <div style="background:#E5E5EA;border-radius:14px;height:80px;margin-bottom:10px;"></div>
        <div style="background:#E5E5EA;border-radius:8px;height:18px;width:70%;"></div>
      </div>
    `;
    const cta = document.querySelector('.cta');
    if (cta) cta.style.display = 'none';
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'p04-loading.png'), fullPage: false });
  console.log('✓ p04-loading.png');

  // 3. Empty state
  await page.goto(`file://${MOCKUP}`);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const content = document.querySelector('.content');
    if (content) content.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;color:#8E8E93;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="7" stroke="#8E8E93" stroke-width="1.8"/><path d="M15.5 15.5 20 20" stroke="#8E8E93" stroke-width="1.8" stroke-linecap="round"/></svg>
        <div style="font-size:17px;font-weight:600;color:#1C1C1E;">暂无分析结果</div>
        <div style="font-size:14px;">请先拍题后再查看分析</div>
      </div>
    `;
    const cta = document.querySelector('.cta');
    if (cta) cta.style.display = 'none';
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'p04-empty.png'), fullPage: false });
  console.log('✓ p04-empty.png');

  // 4. Error state
  await page.goto(`file://${MOCKUP}`);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const content = document.querySelector('.content');
    if (content) content.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;color:#8E8E93;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M12 3.5 21 19.5H3L12 3.5Z" stroke="#FF3B30" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4.5M12 17v.1" stroke="#FF3B30" stroke-width="1.8" stroke-linecap="round"/></svg>
        <div style="font-size:17px;font-weight:600;color:#1C1C1E;">加载失败</div>
        <div style="font-size:14px;">请检查网络后重试</div>
        <button style="margin-top:8px;padding:8px 24px;border-radius:20px;border:none;background:#007AFF;color:#fff;font-size:14px;font-weight:600;">重试</button>
      </div>
    `;
    const cta = document.querySelector('.cta');
    if (cta) cta.style.display = 'none';
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'p04-error.png'), fullPage: false });
  console.log('✓ p04-error.png');

  await browser.close();
  console.log('\nAll 4 screenshots saved to', OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
