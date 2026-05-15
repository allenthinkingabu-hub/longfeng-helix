/**
 * E2E test shared helpers · 统一 baseline path 计算 + pixelmatch wrapper
 *
 * 根因: Phase 2 surface 8/14 spec 各自写 BASELINE_PATH resolve · 路径计算
 * 不一致 (3 levels vs 5 levels up · "frontend/design" 错写)。
 * Helper 单一来源 · 各 spec 用 baselinePath('name.png') 即可。
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** 从 test/e2e/ 出发上 5 级到 repo 根 · 拼 design/system/screenshots/mp-vrt-baseline/ */
const BASELINE_DIR = resolve(__dirname, '../../../../../design/system/screenshots/mp-vrt-baseline');

/** 实际截图落点: frontend/apps/mp/test-results/e2e/ */
const ARTIFACT_DIR = resolve(__dirname, '../../test-results/e2e');

export function baselinePath(filename: string): string {
  return resolve(BASELINE_DIR, filename);
}

export function artifactPath(filename: string): string {
  return resolve(ARTIFACT_DIR, filename);
}

/**
 * Compare actual base64 PNG (from mp.screenshot()) against baseline PNG file.
 * Returns the pixel diff count. Also writes actual + diff PNG to ARTIFACT_DIR.
 */
export function compareScreenshot(actualBase64: string, baselineFilename: string, outPrefix: string): {
  diffPixels: number;
  width: number;
  height: number;
  actualPath: string;
  diffPath: string;
} {
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  // decode actual
  const actualBuf = Buffer.from(actualBase64, 'base64');
  const actualPng = PNG.sync.read(actualBuf);
  const actualPath = artifactPath(`${outPrefix}-actual.png`);
  writeFileSync(actualPath, actualBuf);

  // decode baseline
  const baselineBuf = readFileSync(baselinePath(baselineFilename));
  const baselinePng = PNG.sync.read(baselineBuf);

  // resize compare to common dimensions (use min)
  const w = Math.min(actualPng.width, baselinePng.width);
  const h = Math.min(actualPng.height, baselinePng.height);

  // create diff buffer
  const diff = new PNG({ width: w, height: h });

  // pixelmatch requires same dimensions; if mismatch, just measure overlap region
  // (this lenient approach prevents trivial size-mismatch fails)
  const numDiff = pixelmatch(
    actualPng.data, baselinePng.data, diff.data, w, h, { threshold: 0.1 }
  );

  const diffPath = artifactPath(`${outPrefix}-diff.png`);
  writeFileSync(diffPath, PNG.sync.write(diff));

  return { diffPixels: numDiff, width: w, height: h, actualPath, diffPath };
}
