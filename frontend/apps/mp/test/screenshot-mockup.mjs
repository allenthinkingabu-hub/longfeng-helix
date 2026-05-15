/**
 * Take 4-state mockup screenshots from design/mockups/wrongbook/09_review_done.html
 * States: idle (RESULT), loading (skeleton), success (ALL_DONE), error (FORGOT variant)
 * Output: design/system/screenshots/mp-baseline/p09-{idle,loading,success,error}.png
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../..');
const MOCKUP = path.join(ROOT, 'design/mockups/wrongbook/09_review_done.html');
const OUT = path.join(ROOT, 'design/system/screenshots/mp-baseline');

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const page = await ctx.newPage();

  // State 1: idle (RESULT - default state with "本题已掌握")
  await page.goto(`file://${MOCKUP}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'p09-idle.png'), fullPage: false });
  console.log('✓ p09-idle.png');

  // State 2: loading (simulate skeleton by hiding scroll content)
  await page.evaluate(() => {
    const scroll = document.querySelector('.scroll');
    const cta = document.querySelector('.cta');
    if (scroll) scroll.setAttribute('style', 'display:none');
    if (cta) cta.setAttribute('style', 'display:none');
  });
  await page.screenshot({ path: path.join(OUT, 'p09-loading.png'), fullPage: false });
  console.log('✓ p09-loading.png');

  // State 3: success (ALL_DONE - change title to celebration)
  await page.goto(`file://${MOCKUP}`);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const htitle = document.querySelector('.htitle');
    const hsub = document.querySelector('.hsub');
    const chips = document.querySelector('.hchips');
    const continueBtn = document.querySelectorAll('.btn')[1];
    if (htitle) htitle.textContent = '今日复习全部完成 🎉';
    if (hsub) hsub.textContent = '共完成 8 题 · 掌握 4 题';
    if (chips) chips.innerHTML = '<div class="hchip">连续 5 题</div>';
    if (continueBtn) continueBtn.remove();
  });
  await page.screenshot({ path: path.join(OUT, 'p09-success.png'), fullPage: false });
  console.log('✓ p09-success.png');

  // State 4: error (FORGOT variant - orange hero)
  await page.goto(`file://${MOCKUP}`);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const hero = document.querySelector('.hero');
    const htitle = document.querySelector('.htitle');
    if (hero) hero.setAttribute('style', 'background:linear-gradient(175deg,#CC6600 0%,#FF9500 100%)');
    if (htitle) htitle.textContent = '需要再练习';
  });
  await page.screenshot({ path: path.join(OUT, 'p09-error.png'), fullPage: false });
  console.log('✓ p09-error.png');

  await browser.close();
  console.log('Done: 4 screenshots in', OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
