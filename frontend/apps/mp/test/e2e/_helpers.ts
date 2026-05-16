/**
 * E2E test shared helpers · 三件套 (Fix-2 · 2026-05-16)
 *
 * 三件套 = connectMp + assertConsoleClean + assertPageRenders
 * RC: 14 spec 同形复制 `automator.connect + expect(path)` 模式 ·
 *     共同盲区: 没订阅 mp.on('console') · IDE Console 红 error 全漏 →
 *     "E2E 8/8 PASS" 但用户打开 IDE 一片红的事故。
 * Fix: 所有 spec 必须 `import { connectMp, assertConsoleClean, assertPageRenders }` ·
 *      coder-agent.md Rule 7 强制 · audit.js dim_ide_smoke 把守。
 *
 * 同时保留: VRT (baselinePath / artifactPath / compareScreenshot · 已有 Phase 2 产物)
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import automator from 'miniprogram-automator';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** 从 test/e2e/ 出发上 5 级到 repo 根 · 拼 design/system/screenshots/mp-vrt-baseline/ */
const BASELINE_DIR = resolve(__dirname, '../../../../../design/system/screenshots/mp-vrt-baseline');

/** 实际截图落点: frontend/apps/mp/test-results/e2e/ */
const ARTIFACT_DIR = resolve(__dirname, '../../test-results/e2e');

/** IDE Console error log 落盘点 · audit.js dim_ide_smoke 扫这里 */
const IDE_CONSOLE_LOG = resolve(ARTIFACT_DIR, 'ide-console.txt');

const WS_ENDPOINT = (typeof process !== 'undefined' && process.env?.MP_AUTOMATOR_WS) || 'ws://127.0.0.1:9420';

// Re-export Mp type · spec 只需 `import { type Mp, connectMp, ... }`
export type Mp = Awaited<ReturnType<typeof automator.connect>>;

// ── 三件套 #1 · connectMp ────────────────────────────────────────
// 自动挂 mp.on('console') · 任何 IDE 飘 error 都进 errors[] · 同时落 ide-console.txt
// 用法: const { mp, errors } = await connectMp();
export async function connectMp(timeoutMs = 8000): Promise<{
  mp: Awaited<ReturnType<typeof automator.connect>>;
  errors: string[];
}> {
  const mp = await Promise.race([
    automator.connect({ wsEndpoint: WS_ENDPOINT }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`connect timeout: ${WS_ENDPOINT} not listening · 先跑 cli auto`)), timeoutMs),
    ),
  ]);

  const errors: string[] = [];
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  mp.on('console', (msg: { type: string; args: unknown[] }) => {
    if (msg.type !== 'error' && msg.type !== 'warn') return;
    const line = `[${msg.type}] ${JSON.stringify(msg.args).slice(0, 300)}`;
    if (msg.type === 'error') errors.push(line);
    try { appendFileSync(IDE_CONSOLE_LOG, line + '\n'); } catch { /* best-effort */ }
  });

  return { mp, errors };
}

// ── 三件套 #2 · assertConsoleClean ──────────────────────────────
// 每个 it 块末必须 call · 任何累积 error 直接 throw · 防 silent succeed
export function assertConsoleClean(errors: string[], step: string): void {
  if (errors.length > 0) {
    const sample = errors.slice(0, 3).join('\n');
    throw new Error(`${step}: IDE console produced ${errors.length} error(s)\n前 3 条:\n${sample}`);
  }
}

// ── 三件套 #3 · assertPageRenders ───────────────────────────────
// 既验路由 + 又验 view 数 ≥ 阈值 · 防 "page.path 对了但 wxml 没渲染" 假 PASS
// 上次 home 只渲染 2 section 的 bug · 用 minViews=15 当场炸
export async function assertPageRenders(
  mp: Awaited<ReturnType<typeof automator.connect>>,
  expectedPath: string,
  minViews = 5,
): Promise<void> {
  const page = await mp.currentPage();
  if (page.path !== expectedPath) {
    throw new Error(`path 期望 ${expectedPath} · 实际 ${page.path}`);
  }
  const views = await page.$$('view');
  if (views.length < minViews) {
    throw new Error(`${expectedPath}: 只渲染 ${views.length} 个 view · 期望 ≥ ${minViews} (wxml 可能 wx:if 全否或 mount 失败)`);
  }
}

// 清空上轮 IDE Console log · 供 sc01-happy-path / 单 spec 起始时调
export function resetIdeConsoleLog(): void {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  try { writeFileSync(IDE_CONSOLE_LOG, ''); } catch { /* best-effort */ }
}

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
/**
 * forceRecompileIDE · 强制重启 WeChat 开发者工具 IDE 让 TS 重新编译
 *
 * RC (SC01-MP-HOME-BUG-FIX attempt-1): home-data-probe.spec.ts 直连 ws://127.0.0.1:9420
 * 拿 page.data() 时, IDE 实例可能仍跑未重编的旧 .js 编译产物 (project.config.json
 * 用 useCompilerPlugins:["typescript"] 由 IDE 内部编译 TS, compileHotReLoad=true 不可靠).
 * 结果即使源码已修, page.data() 仍返回旧硬编码 (B4 d=22 重复 / B5 4 月 20-26 / B6 #C41E3A).
 *
 * Fix: 在 probe 前 close IDE → sleep → start (open + auto-port 9420) → sleep.
 * 适用: 任何依赖 page.data() 真值的 spec · home-data-probe 必须用 · 其他 spec 可选.
 *
 * @param timeoutSec 各阶段超时 (close=15s, start=120s, settle=5s extra)
 */
export async function forceRecompileIDE(): Promise<void> {
  const CLI = process.env.WECHAT_CLI_PATH || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
  const PROJECT_DIR = resolve(__dirname, '../..');

  // SC01-MP-MENU-FIX (2026-05-16): 'close' subcommand 只关项目, IDE HTTP server
  // 仍 listen 28683 → 下次 open --port 9420 报 port conflict exit 255 → IDE 实际
  // 没真重启 · app.json 改动不生效. 改用 'quit' 完全退出 IDE 再 open.
  const quitRes = spawnSync(CLI, ['quit'], { stdio: 'inherit', timeout: 20_000 });
  if (quitRes.error) {
    console.error('[forceRecompileIDE] quit failed:', quitRes.error.message);
  }
  await sleep(5_000);

  const openRes = spawnSync(CLI, ['open', '--project', PROJECT_DIR, '--port', '9420'], {
    stdio: 'inherit',
    timeout: 120_000,
  });
  if (openRes.status !== 0) {
    console.error(`[forceRecompileIDE] open exited code=${openRes.status} (may need manual retry)`);
  }
  // settle for IDE to fully load + compile TS
  await sleep(35_000);

  const autoRes = spawnSync(CLI, ['auto', '--project', PROJECT_DIR, '--auto-port', '9420'], {
    stdio: 'inherit',
    timeout: 30_000,
  });
  if (autoRes.status !== 0) {
    console.error(`[forceRecompileIDE] auto exited code=${autoRes.status} (websocket may still come up)`);
  }
  await sleep(5_000);
}

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
