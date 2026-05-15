/**
 * MP automator E2E smoke test · 真起 微信工具 IDE · 真模拟器渲染
 *
 * 前置：
 *   1. 微信工具 IDE 设置 → 安全设置 → Service Port + Allow Getting Ticket + Trust 全开
 *   2. `cli auto --project <path> --auto-port 9420` 已启 (有 9420 在 LISTEN)
 *
 * 跑：pnpm -F mp test:e2e:automator
 *
 * trace: PHASE-C wave-3 后 IDE 打开报错根因 · 恢复 automator E2E 联调
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

describe('MP automator smoke (真 IDE)', () => {
  let mp: Awaited<ReturnType<typeof automator.connect>>;

  beforeAll(async () => {
    mp = await Promise.race([
      automator.connect({ wsEndpoint: WS_ENDPOINT }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`connect timeout: ${WS_ENDPOINT} not listening · 先跑 cli auto`)), 8000),
      ),
    ]);
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  it('systemInfo 返回 devtools platform + SDK 版本', async () => {
    const sys = await mp.systemInfo();
    expect(sys.platform).toBe('devtools');
    expect(sys.SDKVersion).toMatch(/^\d+\.\d+/);
  });

  it('currentPage 是 app.json pages[0] (home)', async () => {
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/home/index');
  });

  it('home 页 DOM 已渲染 (至少 1 个 view)', async () => {
    const page = await mp.currentPage();
    const anyView = await page.$('view');
    expect(anyView).toBeTruthy();
  });
});
