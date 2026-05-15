#!/usr/bin/env node
/**
 * Capture mockup HTML baselines via headless chromium · for VRT diff.
 *
 * Reads design/mockups/wrongbook/*.html, renders each at 750x1334 (iPhone 8 portrait · 微信小程序标准设计稿尺寸),
 * saves PNG to design/system/screenshots/mp-vrt-baseline/<base>.png.
 *
 * trace: PHASE-C MP 14 E2E task · baseline source for pixelmatch diff.
 *
 * Usage: pnpm vrt:baseline (or node scripts/capture-mockup-baselines.mjs)
 */
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { readdirSync, existsSync } from 'node:fs';
import { join, basename, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const MOCKUP_DIR = join(REPO_ROOT, 'design/mockups/wrongbook');
const OUT_DIR = join(REPO_ROOT, 'design/system/screenshots/mp-vrt-baseline');

const VIEWPORT = { width: 750, height: 1334 }; // 微信小程序标准设计稿尺寸 · 与 mockup CSS 对齐

async function main() {
  if (!existsSync(MOCKUP_DIR)) {
    console.error(`mockup dir not found: ${MOCKUP_DIR}`);
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });

  const mockups = readdirSync(MOCKUP_DIR).filter((f) => f.endsWith('.html'));
  console.log(`found ${mockups.length} mockups, viewport ${VIEWPORT.width}x${VIEWPORT.height}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    for (const file of mockups) {
      const url = `file://${join(MOCKUP_DIR, file)}`;
      const out = join(OUT_DIR, basename(file, '.html') + '.png');
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300); // 让 CSS animation/transition 收敛
      await page.screenshot({ path: out, fullPage: false });
      await page.close();
      console.log(`  ✓ ${file} → ${basename(out)}`);
    }
    await ctx.close();
  } finally {
    await browser.close();
  }
  console.log(`done. baselines in ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
