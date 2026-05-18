/**
 * MP-CATCHUP-C-GUEST · P-GUEST-CAPTURE MP page E2E (SC-12)
 *
 * trace:
 * - design/system/pages/P-GUEST-CAPTURE-guest-capture.spec.md §5 / §6 / §9 / §13
 * - biz §2B.13 SC-12 F01-F10
 * - design/mockups/wrongbook/15_guest_capture.html (mockup 视觉锚)
 *
 * 必用 _helpers.ts 三件套 (coder-agent.md Rule 7):
 * - connectMp · 自动挂 mp.on('console') · 落 ide-console.txt
 * - assertConsoleClean · 末态防 silent IDE error
 * - assertPageRenders · 验路由 + view 数 ≥ 阈值
 *
 * Mock 策略 (用户 2026-05-16 决策 a · MP e2e 前端 stub 允许):
 *   mp.mockWxMethod('request', fn) · fn return {statusCode, data} ·
 *   IDE backend 自己根据 return.statusCode 派发 success/fail
 *   (沿 SC-16-T02 + MP-CATCHUP-A-LOGIN 模式)
 *
 * 8 testcase (≥ 6 requirement met):
 *   TC-1 page_mounts_calls_session_mint    (mint 成功 → IDLE · ConsentBar 渲染)
 *   TC-2 consent_unlocks_shutter           (tap consent → CONSENT_PENDING · Shutter enabled)
 *   TC-3 shutter_starts_camera_active      (tap shutter → CAMERA_ACTIVE · <camera> 可见)
 *   TC-4 quota_exhausted_shows_blocker     (analyze 429 → QUOTA_EXHAUSTED 整页挡板)
 *   TC-5 ai_failure_shows_error_retry      (analyze 502 → ERROR + 重试按钮)
 *   TC-6 polling_until_ready               (result READY · 4 卡片 visible + CTA)
 *   TC-7 polling_handles_done_status       (result DONE 上游真值 · MP 视同 READY)
 *   TC-8 cta_save_navigates_to_login       (no jwt · navigateTo login)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean } from '../_helpers';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('MP-CATCHUP-C-GUEST · P-GUEST-CAPTURE MP page (Phase 3 Coder)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    if (Array.isArray(errors)) {
      assertConsoleClean(errors, 'mp-guest-capture/guest-capture.spec');
    }
  });

  // ──────────────────────────────────────────────────────────
  // TC-1 · page_mounts_calls_session_mint · mint → IDLE
  // ──────────────────────────────────────────────────────────
  it('TC-1 · /pages/guest/capture/index · onLoad mint → phase=IDLE + nav + consent rendered', async () => {
    await mp.mockWxMethod('request', function (options: { url?: string }) {
      const url = options.url || '';
      if (url.indexOf('/api/anon/session') >= 0) {
        return {
          statusCode: 200,
          data: { code: 0, message: 'ok', data: {
            anonToken: 'anon-test-token-tc1',
            anonSessionId: 1001,
            expiresAt: '2026-05-19T08:30:00Z',
          }},
        };
      }
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {} } };
    });

    try {
      await mp.reLaunch('/pages/guest/capture/index');
      await sleep(2000);

      const page = await mp.currentPage();
      expect(page.path).toBe('pages/guest/capture/index');

      const data = await page.data();
      expect(data.phase, 'mint 成功 → IDLE').toBe('IDLE');
      expect(data.anonToken).toBe('anon-test-token-tc1');
      expect(data.anonSessionId).toBe(1001);

      // 关键 testid 渲染检查
      const required = [
        'p-guest-capture-root',
        'anon-shell-nav',
        'anon-shell-login-btn',
        'guest-quota-banner',
        'guest-consent-card',
        'guest-consent-checkbox',
        'guest-compliance-badge-encrypt',
        'guest-compliance-badge-fingerprint',
        'guest-compliance-badge-ratelimit',
        'capture-shutter',
      ];
      for (const tid of required) {
        const node = await page.$(`[data-test-id="${tid}"]`);
        expect(node, `testid=${tid} 应 exists`).toBeTruthy();
      }

      // view 数阈值 (页面 sections 多)
      const views = await page.$$('view');
      expect(views.length).toBeGreaterThanOrEqual(8);
    } finally {
      await mp.restoreWxMethod('request');
    }
  }, 90_000);

  // ──────────────────────────────────────────────────────────
  // TC-2 · consent_unlocks_shutter · tap consent → CONSENT_PENDING
  // ──────────────────────────────────────────────────────────
  it('TC-2 · tap consent checkbox → PATCH consent 200 → phase=CONSENT_PENDING + Shutter enabled', async () => {
    await mp.mockWxMethod('request', function (options: { url?: string; method?: string }) {
      const url = options.url || '';
      if (url.indexOf('/api/anon/session') >= 0 && (options.method || 'GET') === 'POST') {
        return {
          statusCode: 200,
          data: { code: 0, message: 'ok', data: {
            anonToken: 'anon-test-token-tc2',
            anonSessionId: 1002,
            expiresAt: '2026-05-19T08:30:00Z',
          }},
        };
      }
      if (url.indexOf('/consent') >= 0) {
        return {
          statusCode: 200,
          data: { code: 0, message: 'ok', data: {
            consentAt: '2026-05-18T08:35:00Z',
            consentType: 1,
          }},
        };
      }
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {} } };
    });

    try {
      await mp.reLaunch('/pages/guest/capture/index');
      await sleep(2000);

      const page = await mp.currentPage();
      const checkbox = await page.$('[data-test-id="guest-consent-checkbox"]');
      expect(checkbox).toBeTruthy();
      if (checkbox) await checkbox.tap();
      await sleep(1500);

      const data = await page.data();
      expect(data.phase, 'consent → CONSENT_PENDING').toBe('CONSENT_PENDING');
      expect(data.consent.checked).toBe(true);
      expect(data.consent.consentAt).toBe('2026-05-18T08:35:00Z');
    } finally {
      await mp.restoreWxMethod('request');
    }
  }, 90_000);

  // ──────────────────────────────────────────────────────────
  // TC-3 · shutter_starts_camera_active · tap shutter from CONSENT_PENDING → CAMERA_ACTIVE
  // ──────────────────────────────────────────────────────────
  it('TC-3 · tap shutter (consent.checked=true) → phase=CAMERA_ACTIVE + <camera> 渲染', async () => {
    await mp.mockWxMethod('request', function (options: { url?: string; method?: string }) {
      const url = options.url || '';
      if (url.indexOf('/api/anon/session') >= 0 && (options.method || 'GET') === 'POST') {
        return {
          statusCode: 200,
          data: { code: 0, message: 'ok', data: {
            anonToken: 'anon-test-token-tc3',
            anonSessionId: 1003,
            expiresAt: '2026-05-19T08:30:00Z',
          }},
        };
      }
      if (url.indexOf('/consent') >= 0) {
        return {
          statusCode: 200,
          data: { code: 0, message: 'ok', data: {
            consentAt: '2026-05-18T08:35:00Z',
            consentType: 1,
          }},
        };
      }
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {} } };
    });

    try {
      await mp.reLaunch('/pages/guest/capture/index');
      await sleep(2000);

      const page = await mp.currentPage();
      const checkbox = await page.$('[data-test-id="guest-consent-checkbox"]');
      if (checkbox) await checkbox.tap();
      await sleep(1500);

      const shutter = await page.$('[data-test-id="capture-shutter"]');
      expect(shutter).toBeTruthy();
      if (shutter) await shutter.tap();
      await sleep(800);

      const data = await page.data();
      expect(data.phase, '从 CONSENT_PENDING tap → CAMERA_ACTIVE').toBe('CAMERA_ACTIVE');

      // <camera> 元素 wx:if 进 DOM
      const camera = await page.$('[data-test-id="guest-camera-view"]');
      expect(camera, 'CAMERA_ACTIVE 态 <camera> 应渲染').toBeTruthy();
    } finally {
      await mp.restoreWxMethod('request');
    }
  }, 90_000);

  // ──────────────────────────────────────────────────────────
  // TC-4 · quota_exhausted_shows_blocker · analyze 429 → 挡板
  // 验：phase = QUOTA_EXHAUSTED · guest-quota-blocker 渲染 · 立即注册 CTA 可见
  // ──────────────────────────────────────────────────────────
  it('TC-4 · analyze-by-url 429 → phase=QUOTA_EXHAUSTED + 整页挡板 + 立即注册 CTA', async () => {
    await mp.mockWxMethod('request', function (options: { url?: string; method?: string }) {
      const url = options.url || '';
      const method = options.method || 'GET';
      if (url.indexOf('/api/anon/session') >= 0 && method === 'POST') {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          anonToken: 'anon-test-token-tc4', anonSessionId: 1004,
          expiresAt: '2026-05-19T08:30:00Z',
        }}};
      }
      if (url.indexOf('/consent') >= 0) {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          consentAt: '2026-05-18T08:35:00Z', consentType: 1,
        }}};
      }
      if (url.indexOf('/api/anon/file/presign') >= 0) {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          upload_url: 'http://localhost:9000/anon-tmp/test.jpg',
          file_key: 'guest/2026-05-18/abc.jpg',
          ttl_seconds: 300, bucket: 'anon-tmp',
        }}};
      }
      if (url.indexOf('/api/anon/questions') >= 0 && method === 'POST') {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          anon_qid: 9999, claim_window: { expires_at: '2026-05-19T08:35:00Z' },
        }}};
      }
      if (url.indexOf('/api/anon/analyze-by-url') >= 0) {
        // 429 · BE quota exhausted
        return { statusCode: 429, data: { code: 4290, message: 'QUOTA_EXHAUSTED', data: null } };
      }
      if (url.indexOf('minio') >= 0 || method === 'PUT') {
        return { statusCode: 200, data: '' };
      }
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {} } };
    });

    try {
      await mp.reLaunch('/pages/guest/capture/index');
      await sleep(2000);

      const page = await mp.currentPage();
      // 直接同步 setData 推进到 UPLOADING 状态触发 uploadFlow 全链路
      await page.callMethod('setData', {
        anonToken: 'anon-test-token-tc4',
        anonSessionId: 1004,
        consent: { checked: true, consentAt: '2026-05-18T08:35:00Z' },
        phase: 'CAMERA_ACTIVE',
      });
      await page.callMethod('uploadFlow', '/tmp/fake-photo.jpg');
      await sleep(3500);

      const data = await page.data();
      expect(data.phase, 'analyze 429 → QUOTA_EXHAUSTED').toBe('QUOTA_EXHAUSTED');

      const blocker = await page.$('[data-test-id="guest-quota-blocker"]');
      expect(blocker, '挡板渲染').toBeTruthy();
      const cta = await page.$('[data-test-id="guest-quota-blocker-cta"]');
      expect(cta, '立即注册 CTA 渲染').toBeTruthy();
    } finally {
      await mp.restoreWxMethod('request');
    }
  }, 90_000);

  // ──────────────────────────────────────────────────────────
  // TC-5 · ai_failure_shows_error_retry · analyze 502 → ERROR
  // ──────────────────────────────────────────────────────────
  it('TC-5 · analyze-by-url 502 → phase=ERROR + guest-error-banner + 重试按钮', async () => {
    await mp.mockWxMethod('request', function (options: { url?: string; method?: string }) {
      const url = options.url || '';
      const method = options.method || 'GET';
      if (url.indexOf('/api/anon/session') >= 0 && method === 'POST') {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          anonToken: 'anon-test-token-tc5', anonSessionId: 1005,
          expiresAt: '2026-05-19T08:30:00Z',
        }}};
      }
      if (url.indexOf('/api/anon/file/presign') >= 0) {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          upload_url: 'http://localhost:9000/anon-tmp/test.jpg',
          file_key: 'guest/2026-05-18/xyz.jpg',
          ttl_seconds: 300, bucket: 'anon-tmp',
        }}};
      }
      if (url.indexOf('/api/anon/questions') >= 0 && method === 'POST') {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          anon_qid: 8888, claim_window: { expires_at: '2026-05-19T08:35:00Z' },
        }}};
      }
      if (url.indexOf('/api/anon/analyze-by-url') >= 0) {
        return { statusCode: 502, data: { code: 5020, message: 'AI_FAIL', data: null } };
      }
      if (url.indexOf('minio') >= 0 || method === 'PUT') {
        return { statusCode: 200, data: '' };
      }
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {} } };
    });

    try {
      await mp.reLaunch('/pages/guest/capture/index');
      await sleep(2000);

      const page = await mp.currentPage();
      await page.callMethod('setData', {
        anonToken: 'anon-test-token-tc5',
        anonSessionId: 1005,
        consent: { checked: true, consentAt: '2026-05-18T08:35:00Z' },
        phase: 'CAMERA_ACTIVE',
      });
      await page.callMethod('uploadFlow', '/tmp/fake-photo.jpg');
      await sleep(3500);

      const data = await page.data();
      expect(data.phase, 'analyze 502 → ERROR').toBe('ERROR');
      expect(data.errorMsg).toContain('失败');

      const banner = await page.$('[data-test-id="guest-error-banner"]');
      expect(banner, 'ERROR banner 渲染').toBeTruthy();
      const retry = await page.$('[data-test-id="guest-error-retry"]');
      expect(retry, '重试按钮渲染').toBeTruthy();
    } finally {
      await mp.restoreWxMethod('request');
    }
  }, 90_000);

  // ──────────────────────────────────────────────────────────
  // TC-6 · polling_until_ready · result.status=READY → 4 卡片 + CTA
  // ──────────────────────────────────────────────────────────
  it('TC-6 · poll getResult → READY · 4 卡片渲染 + 保存 CTA 可点', async () => {
    let pollCount = 0;
    await mp.mockWxMethod('request', function (options: { url?: string; method?: string }) {
      const url = options.url || '';
      const method = options.method || 'GET';
      if (url.indexOf('/api/anon/session') >= 0 && method === 'POST') {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          anonToken: 'anon-test-token-tc6', anonSessionId: 1006,
          expiresAt: '2026-05-19T08:30:00Z',
        }}};
      }
      if (url.indexOf('/api/anon/file/presign') >= 0) {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          upload_url: 'http://localhost:9000/anon-tmp/t6.jpg',
          file_key: 'guest/2026-05-18/t6.jpg',
          ttl_seconds: 300, bucket: 'anon-tmp',
        }}};
      }
      if (url.indexOf('/api/anon/questions') >= 0 && method === 'POST') {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          anon_qid: 7777, claim_window: { expires_at: '2026-05-19T08:35:00Z' },
        }}};
      }
      if (url.indexOf('/api/anon/analyze-by-url') >= 0) {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          task_id: 'task-tc6', poll_every: 1000, status: 'ANALYZING',
        }}};
      }
      if (url.indexOf('/api/anon/result/') >= 0) {
        pollCount++;
        if (pollCount === 1) {
          return { statusCode: 200, data: { code: 0, message: 'ok', data: {
            status: 'ANALYZING',
          }}};
        }
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          status: 'READY',
          result: {
            subject: 'math', stem_length: 142,
            chat_model: 'gpt-4o-mini', ocr_model: 'qwen-vl-plus',
          },
        }}};
      }
      if (url.indexOf('minio') >= 0 || method === 'PUT') {
        return { statusCode: 200, data: '' };
      }
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {} } };
    });

    try {
      await mp.reLaunch('/pages/guest/capture/index');
      await sleep(2000);

      const page = await mp.currentPage();
      await page.callMethod('setData', {
        anonToken: 'anon-test-token-tc6',
        anonSessionId: 1006,
        consent: { checked: true, consentAt: '2026-05-18T08:35:00Z' },
        phase: 'CAMERA_ACTIVE',
      });
      await page.callMethod('uploadFlow', '/tmp/fake-photo.jpg');
      // wait for 2 poll cycles (ANALYZING → READY)
      await sleep(4500);

      const data = await page.data();
      expect(data.phase, 'polling → READY').toBe('READY');
      expect(data.result, 'result 落 data').toBeTruthy();
      expect(data.result.subject).toBe('math');
      expect(data.result.stem_length).toBe(142);
      expect(data.result.chat_model).toBe('gpt-4o-mini');
      expect(data.result.ocr_model).toBe('qwen-vl-plus');

      // 4 卡片 + CTA testids
      const cards = ['guest-result-card-subject', 'guest-result-card-stem',
                     'guest-result-card-chat', 'guest-result-card-ocr',
                     'guest-cta-save'];
      for (const tid of cards) {
        const node = await page.$(`[data-test-id="${tid}"]`);
        expect(node, `${tid} 应渲染`).toBeTruthy();
      }
    } finally {
      await mp.restoreWxMethod('request');
    }
  }, 90_000);

  // ──────────────────────────────────────────────────────────
  // TC-7 · polling_handles_done_status · 上游真值 DONE 视同 READY
  // wire 差异防回归: spec §5 result.status 文档"READY" · 上游真值"DONE"
  // ──────────────────────────────────────────────────────────
  it('TC-7 · result.status="DONE" 上游真值 · MP 视同 READY (wire 差异防回归)', async () => {
    await mp.mockWxMethod('request', function (options: { url?: string; method?: string }) {
      const url = options.url || '';
      const method = options.method || 'GET';
      if (url.indexOf('/api/anon/session') >= 0 && method === 'POST') {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          anonToken: 'tk-tc7', anonSessionId: 1007,
          expiresAt: '2026-05-19T08:30:00Z',
        }}};
      }
      if (url.indexOf('/api/anon/file/presign') >= 0) {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          upload_url: 'http://localhost:9000/anon-tmp/t7.jpg',
          file_key: 'guest/t7.jpg',
          ttl_seconds: 300, bucket: 'anon-tmp',
        }}};
      }
      if (url.indexOf('/api/anon/questions') >= 0 && method === 'POST') {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          anon_qid: 7000, claim_window: { expires_at: '2026-05-19T08:35:00Z' },
        }}};
      }
      if (url.indexOf('/api/anon/analyze-by-url') >= 0) {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          task_id: 'task-tc7', poll_every: 1000, status: 'ANALYZING',
        }}};
      }
      if (url.indexOf('/api/anon/result/') >= 0) {
        // 上游真值: DONE 不是 READY · MP 必须支持
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          status: 'DONE',
          result: {
            subject: 'physics', stem_length: 88,
            chat_model: 'gpt-4o-mini', ocr_model: 'qwen-vl-plus',
          },
        }}};
      }
      if (url.indexOf('minio') >= 0 || method === 'PUT') {
        return { statusCode: 200, data: '' };
      }
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {} } };
    });

    try {
      await mp.reLaunch('/pages/guest/capture/index');
      await sleep(2000);

      const page = await mp.currentPage();
      await page.callMethod('setData', {
        anonToken: 'tk-tc7',
        anonSessionId: 1007,
        consent: { checked: true, consentAt: '2026-05-18T08:35:00Z' },
        phase: 'CAMERA_ACTIVE',
      });
      await page.callMethod('uploadFlow', '/tmp/fake-photo.jpg');
      await sleep(3000);

      const data = await page.data();
      expect(data.phase, 'DONE 上游真值 → MP READY').toBe('READY');
      expect(data.result.subject).toBe('physics');
    } finally {
      await mp.restoreWxMethod('request');
    }
  }, 90_000);

  // ──────────────────────────────────────────────────────────
  // TC-8 · cta_save_navigates_to_login · 无 jwt → 跳登录
  // ──────────────────────────────────────────────────────────
  it('TC-8 · READY 态 tap 保存 CTA (storage 无 jwt) → navigateTo login', async () => {
    await mp.mockWxMethod('request', function (options: { url?: string; method?: string }) {
      const url = options.url || '';
      const method = options.method || 'GET';
      if (url.indexOf('/api/anon/session') >= 0 && method === 'POST') {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          anonToken: 'tk-tc8', anonSessionId: 1008,
          expiresAt: '2026-05-19T08:30:00Z',
        }}};
      }
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {} } };
    });

    try {
      // 清 storage 的 studentJwt (确保 no jwt)
      await mp.evaluate(function () {
        const w = (globalThis as unknown as {
          wx: { removeStorageSync: (k: string) => void };
        }).wx;
        try { w.removeStorageSync('studentJwt'); } catch (_e) { /* noop */ }
        return true;
      });

      await mp.reLaunch('/pages/guest/capture/index');
      await sleep(2000);

      const page = await mp.currentPage();
      // 直接强推 READY 态 (绕过 uploadFlow · TC-8 只测 CTA 行为)
      await page.callMethod('setData', {
        anonToken: 'tk-tc8',
        anonSessionId: 1008,
        consent: { checked: true, consentAt: '2026-05-18T08:35:00Z' },
        phase: 'READY',
        result: { subject: 'math', stem_length: 100,
                  chat_model: 'gpt-4o-mini', ocr_model: 'qwen-vl-plus' },
      });
      await sleep(500);

      const saveCta = await page.$('[data-test-id="guest-cta-save"]');
      expect(saveCta, 'READY 态 save CTA exists').toBeTruthy();
      if (saveCta) await saveCta.tap();
      await sleep(1500);

      const next = await mp.currentPage();
      expect(next.path, '无 jwt → navigateTo /pages/login/index').toBe('pages/login/index');
    } finally {
      await mp.restoreWxMethod('request');
    }
  }, 90_000);
});
