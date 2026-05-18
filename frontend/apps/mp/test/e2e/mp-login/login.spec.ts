/**
 * MP-CATCHUP-A-LOGIN · P00 login MP page E2E
 *
 * trace:
 * - biz §SC-01 + §2A.3.1 决策树节点 1
 * - design/mockups/wrongbook/00_login.html (mockup · 视觉锚)
 * - frontend/apps/h5/src/pages/Auth/Login.tsx (业务逻辑 reference)
 *
 * 必用 _helpers.ts 三件套 (coder-agent.md Rule 7):
 * - connectMp · 自动挂 mp.on('console') · 落 ide-console.txt
 * - assertConsoleClean · 末态防 silent IDE error
 * - assertPageRenders · 验路由 + view 数 ≥ 阈值
 *
 * Mock 策略 (用户 2026-05-16 决策 a · MP e2e 前端 stub 允许):
 *   mp.mockWxMethod('request', fn) · fn return {statusCode, data} ·
 *   IDE backend 自己根据 return.statusCode 派发 success/fail
 *   (沿 SC-16-T02 t02-weekly-mp-page.spec.ts 模式)
 *
 * 4 testcase (≥ 3 requirement met):
 *   TC-1 page_renders_with_login_form (UI 渲染 + testid 全在)
 *   TC-2 login_success_navigates_to_home (200 mock → wx.reLaunch /pages/home/index)
 *   TC-3 login_failure_shows_error (401 mock → error-banner visible)
 *   TC-4 invalid_phone_shows_inline_error (前端校验 · 不发 request)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean } from '../_helpers';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('MP-CATCHUP-A-LOGIN · P00 login MP page', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    if (Array.isArray(errors)) {
      assertConsoleClean(errors, 'mp-login/login.spec');
    }
  });

  // ──────────────────────────────────────────────────────────
  // TC-1 · page_renders_with_login_form
  // ──────────────────────────────────────────────────────────
  it('TC-1 · /pages/login/index renders with phone-input + password-input + login-cta + wechat-cta', async () => {
    await mp.reLaunch('/pages/login/index');
    await sleep(1500);

    const page = await mp.currentPage();
    expect(page.path).toBe('pages/login/index');

    // 验关键 testids 全在
    const required = [
      'p00-root',
      'p00-logo-zone',
      'p00-phone-input',
      'p00-password-input',
      'p00-login-submit-btn',
      'p00-wechat-cta-btn',
      'p00-consent-bar',
    ];
    for (const tid of required) {
      const node = await page.$(`[data-test-id="${tid}"]`);
      expect(node, `testid=${tid} 应 exists`).toBeTruthy();
    }

    // error-banner 默认不存在 (IDLE 态)
    const banner = await page.$('[data-test-id="p00-error-banner"]');
    expect(banner, 'IDLE 态 error-banner 不应渲染').toBeFalsy();

    // view 数 ≥ 阈值 (假设 8+)
    const views = await page.$$('view');
    expect(views.length).toBeGreaterThanOrEqual(8);
  }, 90_000);

  // ──────────────────────────────────────────────────────────
  // TC-2 · login_success_navigates_to_home
  // ──────────────────────────────────────────────────────────
  it('TC-2 · login 200 success → JWT 入 storage + wx.reLaunch /pages/home/index', async () => {
    // mock auth-service POST /api/auth/login 返 200
    await mp.mockWxMethod('request', function (options: { url?: string; method?: string }) {
      const url = options.url || '';
      if (url.indexOf('/api/auth/login') >= 0) {
        return {
          statusCode: 200,
          data: { code: 0, message: 'ok', data: { token: 'jwt-test-token', userId: 42, expiresIn: 7200 } },
        };
      }
      // 其它 endpoint (home 等加载的接口) 返空 ApiResult 防 home 进 ERROR 态
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {} } };
    });

    try {
      await mp.reLaunch('/pages/login/index');
      await sleep(1000);

      const page = await mp.currentPage();
      // 填手机号
      const phoneInput = await page.$('[data-test-id="p00-phone-input"]');
      expect(phoneInput).toBeTruthy();
      if (phoneInput) await phoneInput.input('13912345678');

      // 填密码
      const pwdInput = await page.$('[data-test-id="p00-password-input"]');
      expect(pwdInput).toBeTruthy();
      if (pwdInput) await pwdInput.input('password123');

      await sleep(300);

      // tap 登录
      const loginBtn = await page.$('[data-test-id="p00-login-submit-btn"]');
      expect(loginBtn).toBeTruthy();
      if (loginBtn) await loginBtn.tap();

      // 等 navigation
      await sleep(2500);

      // 路由跳到 home
      const next = await mp.currentPage();
      expect(next.path).toBe('pages/home/index');

      // JWT 落 storage
      const stored = await mp.evaluate(function () {
        const w = (globalThis as unknown as {
          wx: { getStorageSync: (k: string) => unknown };
        }).wx;
        return {
          jwt: w.getStorageSync('jwt'),
          userId: w.getStorageSync('userId'),
        };
      });
      expect((stored as { jwt: string }).jwt).toBe('jwt-test-token');
      expect((stored as { userId: number }).userId).toBe(42);
    } finally {
      try { await mp.restoreWxMethod('request'); } catch { /* */ }
      // cleanup storage for next test
      try {
        await mp.evaluate(function () {
          const w = (globalThis as unknown as { wx: { removeStorageSync: (k: string) => void } }).wx;
          w.removeStorageSync('jwt');
          w.removeStorageSync('userId');
          w.removeStorageSync('expiresAt');
        });
      } catch { /* */ }
    }
  }, 120_000);

  // ──────────────────────────────────────────────────────────
  // TC-3 · login_failure_shows_error (401)
  // ──────────────────────────────────────────────────────────
  it('TC-3 · login 401 → pageState 保持 + error-banner 显示 "手机号或密码错误"', async () => {
    await mp.mockWxMethod('request', function (options: { url?: string }) {
      const url = options.url || '';
      if (url.indexOf('/api/auth/login') >= 0) {
        return {
          statusCode: 401,
          data: { code: 40101, message: 'invalid credentials', data: null },
        };
      }
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {} } };
    });

    try {
      await mp.reLaunch('/pages/login/index');
      await sleep(1000);

      const page = await mp.currentPage();

      const phoneInput = await page.$('[data-test-id="p00-phone-input"]');
      if (phoneInput) await phoneInput.input('13912345678');
      const pwdInput = await page.$('[data-test-id="p00-password-input"]');
      if (pwdInput) await pwdInput.input('wrongpass');
      await sleep(300);

      const loginBtn = await page.$('[data-test-id="p00-login-submit-btn"]');
      if (loginBtn) await loginBtn.tap();
      await sleep(2000);

      // 仍在 login 页 (不跳)
      const stillOnLogin = await mp.currentPage();
      expect(stillOnLogin.path).toBe('pages/login/index');

      // error-banner 出现
      const banner = await stillOnLogin.$('[data-test-id="p00-error-banner"]');
      expect(banner, '401 → error-banner 应渲染').toBeTruthy();
      if (banner) {
        const txt = (await banner.text()) || '';
        expect(txt).toMatch(/手机号或密码错误/);
      }

      // data.loading 复位 false (允许再 tap)
      const data = await stillOnLogin.data();
      expect((data as { loading: boolean }).loading).toBe(false);

      // JWT 未写入
      const stored = await mp.evaluate(function () {
        const w = (globalThis as unknown as { wx: { getStorageSync: (k: string) => unknown } }).wx;
        return w.getStorageSync('jwt');
      });
      expect(stored).toBeFalsy();
    } finally {
      try { await mp.restoreWxMethod('request'); } catch { /* */ }
    }
  }, 120_000);

  // ──────────────────────────────────────────────────────────
  // TC-4 · invalid_phone_shows_inline_error (前端校验)
  // ──────────────────────────────────────────────────────────
  it('TC-4 · 非 11 位手机号 → 前端 inline 错误 · 不发 /api/auth/login 请求', async () => {
    let requestHit = false;
    await mp.mockWxMethod('request', function (options: { url?: string }) {
      const url = options.url || '';
      if (url.indexOf('/api/auth/login') >= 0) {
        requestHit = true;
      }
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {} } };
    });

    try {
      await mp.reLaunch('/pages/login/index');
      // 多 reLaunch 等 IDE 稳态 · 防上轮 navigateTo (TC-2 home) 残留竞态
      await sleep(2500);
      let page = await mp.currentPage();
      if (page.path !== 'pages/login/index') {
        // self-heal: 再 reLaunch 一次 (IDE 偶尔丢首次)
        await mp.reLaunch('/pages/login/index');
        await sleep(1500);
        page = await mp.currentPage();
      }
      expect(page.path, 'pre-condition: 必须先在 login 页').toBe('pages/login/index');

      const phoneInput = await page.$('[data-test-id="p00-phone-input"]');
      if (phoneInput) await phoneInput.input('12345'); // too short, 非 1[3-9] 头
      const pwdInput = await page.$('[data-test-id="p00-password-input"]');
      if (pwdInput) await pwdInput.input('password123');
      await sleep(300);

      const loginBtn = await page.$('[data-test-id="p00-login-submit-btn"]');
      if (loginBtn) await loginBtn.tap();
      await sleep(1500);

      // 仍在 login 页 (没跳 home · 前端校验阻止)
      const stillOnLogin = await mp.currentPage();
      expect(stillOnLogin.path).toBe('pages/login/index');

      // error-banner 出现 + 文本含 "11 位"
      const banner = await stillOnLogin.$('[data-test-id="p00-error-banner"]');
      expect(banner, 'inline 校验 → error-banner 应渲染').toBeTruthy();
      if (banner) {
        const txt = (await banner.text()) || '';
        expect(txt).toMatch(/11\s*位|有效/);
      }

      // 前端校验 → 不应触发 request
      expect(requestHit, '校验失败不应发 /api/auth/login').toBe(false);
    } finally {
      try { await mp.restoreWxMethod('request'); } catch { /* */ }
    }
  }, 90_000);
});
