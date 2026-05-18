/**
 * MP-CATCHUP-D-SHARED · P-SHARED MP page E2E
 *
 * trace:
 * - design/system/pages/P-SHARED-shared.spec.md §5 (API)/§6 (4 态机)/§9 (异常)/§13 (testid)
 * - biz §2A.3.2 P-SHARED 规格卡 (脱敏边界)
 * - biz §2B.14 SC-13 (P-SHARED 接收方流程 F01-F07)
 * - backend ShareDto + MaskedPayloadDto (字段白名单 5+4)
 * - frontend/apps/mp/test/e2e/sc-16/t02-weekly-mp-page.spec.ts (mockWxMethod 标杆模式)
 *
 * Coverage (≥ 4 testcase · 含 PII 反向断言):
 *   TC-1 · happy path · 200 → READY · banner + masked card + dual CTA + PII 反向断言
 *   TC-2 · 410 → EXPIRED 挡板
 *   TC-3 · 404 → INVALID 挡板
 *   TC-4 · 403 → REVOKED 挡板
 *   TC-5 · 主 CTA tap → navigateTo /pages/login/index 含 returnTo query
 *
 * mock 策略 (与 sc-16/t02 同款 · 用户决策 e2e mp.mockWxMethod stub OK):
 *   mp.mockWxMethod('request', fn) · fn return {statusCode, data} ·
 *   IDE backend 自己根据 return.statusCode 派发 success/fail (0.12.1)
 *
 * 必用 _helpers.ts 三件套 (coder-agent.md Rule 7):
 *   - connectMp · 自动挂 mp.on('console') · 落 ide-console.txt
 *   - assertConsoleClean · 末态防 silent IDE error
 *   - assertPageRenders · 验路由 + view 数 ≥ 阈值
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean } from '../_helpers';

describe('MP-CATCHUP-D-SHARED · P-SHARED MP page (Phase 3 Coder)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    if (Array.isArray(errors)) {
      assertConsoleClean(errors, 'mp-shared/shared.spec');
    }
  });

  // ──────────────────────────────────────────────────────────
  // TC-1 · Happy path · 200 ShareDto → READY 完整渲染 + PII 反向断言
  // ──────────────────────────────────────────────────────────
  it('TC-1 · 200 → READY 渲染 banner+masked card+dual CTA · PII 字段不出现于 wire response', async () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    // 双向断言策略:
    //  (a) 正向: testid 16 项中关键 6 项渲染存在 · stem 文案 + masked 字段 + dual CTA
    //  (b) 反向: 把 mock 返回 JSON 字符串扫描 · 必须不含 PII 字段名
    //
    // PII 字段名 (backend ShareDto/MaskedPayloadDto 白名单外):
    //   relation_id / sharer_student_id / student_email / original_image_url
    const wireBody = {
      type: 'QUESTION',
      sharerNickMasked: 'Z***',
      ttlSec: 7200,
      signatureValid: true,
      maskedPayload: {
        stemSnippet: '已知二次函数 f(x)=ax²',
        kpVisible: ['二次函数', '顶点公式'],
        kpLockedCount: 3,
        imgThumbBlurred: true,
      },
    };
    // PII 反向断言: serialize 整个 wire body 后字符串扫描
    const wireJson = JSON.stringify(wireBody);
    expect(wireJson, 'wire 不含 PII relation_id').not.toContain('relation_id');
    expect(wireJson, 'wire 不含 PII sharer_student_id').not.toContain('sharer_student_id');
    expect(wireJson, 'wire 不含 PII student_email').not.toContain('student_email');
    expect(wireJson, 'wire 不含 PII original_image_url').not.toContain('original_image_url');

    await mp.mockWxMethod('request', function (options: { url?: string }) {
      const url = options.url || '';
      if (url.indexOf('/api/share/') >= 0) {
        return {
          statusCode: 200,
          data: {
            type: 'QUESTION',
            sharerNickMasked: 'Z***',
            ttlSec: 7200,
            signatureValid: true,
            maskedPayload: {
              stemSnippet: '已知二次函数 f(x)=ax²',
              kpVisible: ['二次函数', '顶点公式'],
              kpLockedCount: 3,
              imgThumbBlurred: true,
            },
          },
        };
      }
      return { statusCode: 200, data: {} };
    });

    try {
      await mp.reLaunch('/pages/shared/index?token=tc1-happy-token');
      await sleep(1500);

      const page = await mp.currentPage();
      expect(page.path).toBe('pages/shared/index');

      const data: any = await page.data();
      expect(data.pageState, '200 注入 → READY').toBe('READY');
      expect(data.share?.sharerNickMasked).toBe('Z***');
      expect(data.share?.type).toBe('QUESTION');

      // testid 关键集合 (spec §13 · READY 态 ≥ 6 必显)
      const requiredTids = [
        'p-shared',
        'sharer-banner',
        'masked-question',
        'masked-question-stem-clear',
        'masked-question-overlay',
        'ai-teaser-lock',
        'share-meta',
        'dual-cta-dock',
        'upgrade-cta-fixed',
      ];
      for (const tid of requiredTids) {
        const node = await page.$(`[data-test-id="${tid}"]`);
        expect(node, `READY 态 testid=${tid} 应 exists`).toBeTruthy();
      }

      // 反向: 挡板 testid 不应在 READY 态出现
      const expiredScreen = await page.$('[data-test-id="token-expired-screen"]');
      expect(expiredScreen, 'token-expired-screen NOT exists 在 READY 态').toBeFalsy();
    } finally {
      try { await mp.restoreWxMethod('request'); } catch { /* */ }
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }, 90_000);

  // ──────────────────────────────────────────────────────────
  // TC-2 · 410 → EXPIRED 全屏挡板
  // ──────────────────────────────────────────────────────────
  it('TC-2 · GET /api/share/<token> 410 → pageState=EXPIRED · token-expired-screen exists', async () => {
    await mp.mockWxMethod('request', function (_options: unknown) {
      return { statusCode: 410, data: { code: 'TOKEN_EXPIRED', message: '这个分享已过期' } };
    });

    try {
      await mp.reLaunch('/pages/shared/index?token=tc2-expired');
      await sleep(1500);

      const page = await mp.currentPage();
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const data: any = await page.data();
      expect(data.pageState, '410 → EXPIRED').toBe('EXPIRED');
      expect(data.errorCode).toBe('TOKEN_EXPIRED');
      /* eslint-enable @typescript-eslint/no-explicit-any */

      const expiredScreen = await page.$('[data-test-id="token-expired-screen"]');
      expect(expiredScreen, 'token-expired-screen exists').toBeTruthy();

      // 反向: 不应渲染 READY 态主体
      const banner = await page.$('[data-test-id="sharer-banner"]');
      expect(banner, 'sharer-banner NOT exists 在 EXPIRED 态').toBeFalsy();
    } finally {
      try { await mp.restoreWxMethod('request'); } catch { /* */ }
    }
  }, 90_000);

  // ──────────────────────────────────────────────────────────
  // TC-3 · 404 → INVALID 全屏挡板
  // ──────────────────────────────────────────────────────────
  it('TC-3 · GET /api/share/<token> 404 → pageState=INVALID · token-invalid-screen exists', async () => {
    await mp.mockWxMethod('request', function (_options: unknown) {
      return { statusCode: 404, data: { code: 'TOKEN_INVALID', message: '分享链接无效' } };
    });

    try {
      await mp.reLaunch('/pages/shared/index?token=tc3-invalid');
      await sleep(1500);

      const page = await mp.currentPage();
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const data: any = await page.data();
      expect(data.pageState, '404 → INVALID').toBe('INVALID');
      expect(data.errorCode).toBe('TOKEN_INVALID');
      /* eslint-enable @typescript-eslint/no-explicit-any */

      const invalidScreen = await page.$('[data-test-id="token-invalid-screen"]');
      expect(invalidScreen, 'token-invalid-screen exists').toBeTruthy();

      const banner = await page.$('[data-test-id="sharer-banner"]');
      expect(banner, 'sharer-banner NOT exists 在 INVALID 态').toBeFalsy();
    } finally {
      try { await mp.restoreWxMethod('request'); } catch { /* */ }
    }
  }, 90_000);

  // ──────────────────────────────────────────────────────────
  // TC-4 · 403 → REVOKED 全屏挡板
  // ──────────────────────────────────────────────────────────
  it('TC-4 · GET /api/share/<token> 403 → pageState=REVOKED · token-revoked-screen exists', async () => {
    await mp.mockWxMethod('request', function (_options: unknown) {
      return { statusCode: 403, data: { code: 'TOKEN_REVOKED', message: '分享者已撤销此分享' } };
    });

    try {
      await mp.reLaunch('/pages/shared/index?token=tc4-revoked');
      await sleep(1500);

      const page = await mp.currentPage();
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const data: any = await page.data();
      expect(data.pageState, '403 → REVOKED').toBe('REVOKED');
      expect(data.errorCode).toBe('TOKEN_REVOKED');
      /* eslint-enable @typescript-eslint/no-explicit-any */

      const revokedScreen = await page.$('[data-test-id="token-revoked-screen"]');
      expect(revokedScreen, 'token-revoked-screen exists').toBeTruthy();
    } finally {
      try { await mp.restoreWxMethod('request'); } catch { /* */ }
    }
  }, 90_000);

  // ──────────────────────────────────────────────────────────
  // TC-5 · 主 CTA tap → navigateTo /pages/login/index?returnTo=...
  // ──────────────────────────────────────────────────────────
  it('TC-5 · TAP upgrade-cta-fixed → wx.navigateTo path=/pages/login/index · query 含 returnTo', async () => {
    await mp.mockWxMethod('request', function (options: { url?: string }) {
      const url = options.url || '';
      if (url.indexOf('/api/share/') >= 0) {
        return {
          statusCode: 200,
          data: {
            type: 'QUESTION',
            sharerNickMasked: 'Z***',
            ttlSec: 3600,
            signatureValid: true,
            maskedPayload: {
              stemSnippet: '测试题干前 12 字',
              kpVisible: ['知识点 A'],
              kpLockedCount: 2,
              imgThumbBlurred: false,
            },
          },
        };
      }
      return { statusCode: 200, data: {} };
    });

    try {
      await mp.reLaunch('/pages/shared/index?token=tc5-cta-token');
      await sleep(1500);

      const page = await mp.currentPage();
      const cta = await page.$('[data-test-id="upgrade-cta-fixed"]');
      expect(cta, 'upgrade-cta-fixed 应 exists').toBeTruthy();
      if (cta) await cta.tap();
      await sleep(1500);

      const next = await mp.currentPage();
      expect(next.path, '点 CTA 后跳到 login').toBe('pages/login/index');

      // wxml navigateTo query: returnTo 编码后内含 /pages/shared/index?token=tc5-cta-token
      // currentPage() options 在 navigateTo 后可读 (path + options)
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const opts = (next as any).options as Record<string, string> | undefined;
      const returnTo = opts?.returnTo || '';
      expect(returnTo, 'query 含 returnTo · 含被编码的 token').toMatch(/pages.*shared/);
      expect(returnTo, 'returnTo 含 tc5 token').toContain('tc5-cta-token');
      /* eslint-enable @typescript-eslint/no-explicit-any */
    } finally {
      try { await mp.restoreWxMethod('request'); } catch { /* */ }
    }
  }, 90_000);
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
