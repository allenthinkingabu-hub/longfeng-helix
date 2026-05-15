#!/usr/bin/env node
/**
 * Capture MP runtime baselines via miniprogram-automator · for真 VRT diff.
 *
 * Strategy: HTML mockup baseline 和 MP 模拟器渲染本质差异（字体/box-model/状态栏）
 * 导致 diff 永远 > 5000. So we capture baselines FROM the actual MP simulator,
 * then VRT diffs catch REGRESSIONS from this known-good state.
 *
 * 前置: cli auto --auto-port 9420 已启 IDE.
 *
 * Usage: pnpm vrt:mp-baseline (or node scripts/capture-mp-baselines.mjs)
 */
import automator from 'miniprogram-automator';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const OUT_DIR = resolve(REPO_ROOT, 'design/system/screenshots/mp-render-baseline');

const WS = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

// 14 capture-able pages (transitions don't need single-page baseline)
const PAGES = [
  { name: 'home', path: 'pages/home/index' },
  { name: 'capture', path: 'pages/capture/index' },
  { name: 'analyzing', path: 'pages/analyzing/index?taskId=baseline-demo' },
  { name: 'result', path: 'pages/result/index?qid=baseline-demo' },
  { name: 'wrongbook-list', path: 'pages/wrongbook-list/index' },
  { name: 'review-today', path: 'pages/review-today/index' },
  { name: 'review-exec', path: 'pages/review-exec/index?sid=demo&nid=demo' },
  { name: 'review-done', path: 'pages/review-done/index?sid=demo' },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`[mp-baseline] connecting ${WS}...`);
  const mp = await Promise.race([
    automator.connect({ wsEndpoint: WS }),
    new Promise((_, r) => setTimeout(() => r(new Error('connect timeout 8s · 先跑 cli auto')), 8000)),
  ]);
  console.log('[mp-baseline] connected');

  try {
    for (const p of PAGES) {
      const out = resolve(OUT_DIR, `${p.name}.png`);
      try {
        console.log(`[mp-baseline] reLaunch /${p.path}`);
        await mp.reLaunch(`/${p.path}`);
        await new Promise((r) => setTimeout(r, 1500)); // 等渲染稳定

        const base64 = await mp.screenshot();
        writeFileSync(out, Buffer.from(base64, 'base64'));
        console.log(`  ✓ ${p.name}.png`);
      } catch (e) {
        console.warn(`  ✗ ${p.name}: ${e.message}`);
      }
    }
  } finally {
    await mp.disconnect();
    console.log('[mp-baseline] disconnect');
  }

  console.log(`done · ${OUT_DIR}`);
}

main().catch((e) => {
  console.error('[mp-baseline] FATAL', e.message);
  process.exit(1);
});
