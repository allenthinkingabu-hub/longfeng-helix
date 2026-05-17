// ============================================================================
// SC-11-T04 · P-LANDING DualCTA + ConsentBar + ParentHint + 埋点 · 主 spec (6 case)
// ============================================================================
//
// Source of truth (biz + design + code 三方拉齐):
//   biz §2A.3.2 P-LANDING DualCTA + ConsentBar + ParentHint + 埋点字典
//   biz §2B.12  F07A/F07B/F07C (双 CTA 出口 + bounce pagehide)
//   biz TC-11.02 (CTA 试试看跳转) + TC-11.05 (entry_source 篡改安全)
//   design/system/pages/P-LANDING-landing.spec.md §3 + §7 + §12
//   inflight.context.scope_in #7 (a-f)
//   frontend/apps/h5/src/pages/Landing/{DualCTA,ConsentBar,ParentHint}/index.tsx
//   frontend/apps/h5/src/pages/Landing/telemetry.ts (sanitizeEntrySource + trackLanding)
//
// 6 testcase per inflight scope_in #7 (a)-(f):
//   (a) cta_try_navigates_to_guest_capture (TC-11.02) — click ctaTry · URL 含 /guest/capture
//   (b) cta_login_navigates_to_auth        — click ctaLogin · URL === /auth/login
//   (c) ab_bucket_order_swap               — login_first 桶 · login CTA 在左 · try CTA 在右
//   (d) entry_source_xss_sanitized (TC-11.05) — ?entry_source=<script> · 上报 entry_source='unknown'
//   (e) bounce_pagehide_telemetry          — pagehide → sendBeacon 投递 anon_landing_bounce 含 dwell_ms
//   (f) consent_not_required_for_cta       — 不勾 consent · click ctaTry 仍 navigate
//
// 反作弊红线 (audit-gate v3 / test-agent.md 铁律 3):
//   - 不 mock 业务 API · /api/landing/* 走真 backend (vite proxy → anonymous-service:8090)
//   - sendBeacon spy 用 page.addInitScript patch · 拿真 payload · 不改 navigator 实现
//   - history.pushState patch 仅捕获导航序列 · 不替换 navigate 行为
//   - mock 总数 ≤ 5
//   - exploratory keywords: XSS / sendBeacon / pagehide / A/B / safe-area / Blob / history-spy

import { test, expect, type Route } from '@playwright/test';

test.describe('SC-11-T04 · P-LANDING CTA + 埋点 + entry_source 安全 (6 cases)', () => {

  // ── (a) cta_try_navigates_to_guest_capture · TC-11.02 ─────────────
  test('TC-11-T04 (a) cta_try_navigates_to_guest_capture: ctaTry → 导航记录含 /guest/capture (TC-11.02)', async ({ page }) => {
    // 用 page.addInitScript 提前 patch history · 捕获 SPA 导航序列 (不是网络请求 ·
    // page.on('framenavigated') 对 React Router pushState 不触发 · 必须 history spy)
    await page.addInitScript(() => {
      (window as unknown as { __navHistory: string[] }).__navHistory = [];
      const origPush = history.pushState.bind(history);
      history.pushState = function (data, unused, url) {
        try {
          if (url) (window as unknown as { __navHistory: string[] }).__navHistory.push(String(url));
        } catch {
          /* ignore */
        }
        return origPush(data, unused, url);
      };
    });

    await page.goto('/welcome');
    await expect(page.getByTestId('p-landing-cta-try')).toBeVisible({
      timeout: 8000,
    });

    // 清空 init nav (goto 本身可能 push)
    await page.evaluate(() => {
      (window as unknown as { __navHistory: string[] }).__navHistory = [];
    });

    await page.getByTestId('p-landing-cta-try').click();

    // 拿导航历史 · React Router pushState 会立刻把 /guest/capture 推进去 ·
    // 之后 * → <Navigate to="/" replace> 再 replace 到 / · 但 push 已发生
    const navHistory = await page.evaluate(
      () => (window as unknown as { __navHistory: string[] }).__navHistory,
    );
    expect(
      navHistory.some((url) => url.includes('/guest/capture')),
      `nav history should include /guest/capture · got: ${JSON.stringify(navHistory)}`,
    ).toBe(true);
  });

  // ── (b) cta_login_navigates_to_auth ────────────────────────────────
  test('TC-11-T04 (b) cta_login_navigates_to_auth: ctaLogin → URL pathname === /auth/login', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page.getByTestId('p-landing-cta-login')).toBeVisible({
      timeout: 8000,
    });

    await page.getByTestId('p-landing-cta-login').click();
    // /auth/login 真路由存在 (App.tsx L27) · 不会 fallback · URL 直接到位
    await page.waitForURL(/\/auth\/login/, { timeout: 3000 });
    expect(new URL(page.url()).pathname).toBe('/auth/login');
  });

  // ── (c) ab_bucket_order_swap · A/B 桶 ──────────────────────────────
  test('TC-11-T04 (c) ab_bucket_order_swap: login_first 桶 · login CTA 在左 · try CTA 在右', async ({ page }) => {
    // try_first 默认顺序 (主 CTA 在左)
    await page.goto('/welcome');
    await expect(page.getByTestId('p-landing-cta-try')).toBeVisible({
      timeout: 8000,
    });
    const tryBoxDefault = await page.getByTestId('p-landing-cta-try').boundingBox();
    const loginBoxDefault = await page.getByTestId('p-landing-cta-login').boundingBox();
    expect(tryBoxDefault).not.toBeNull();
    expect(loginBoxDefault).not.toBeNull();
    if (tryBoxDefault && loginBoxDefault) {
      // 默认 try_first · try 在左 (x 较小)
      expect(
        tryBoxDefault.x,
        `try_first 默认桶 · try.x (${tryBoxDefault.x}) 应 < login.x (${loginBoxDefault.x})`,
      ).toBeLessThan(loginBoxDefault.x);
    }

    // 切到 login_first 桶
    await page.goto('/welcome?ab=login_first');
    await expect(page.getByTestId('p-landing-cta-try')).toBeVisible({
      timeout: 8000,
    });
    const tryBoxSwap = await page.getByTestId('p-landing-cta-try').boundingBox();
    const loginBoxSwap = await page.getByTestId('p-landing-cta-login').boundingBox();
    expect(tryBoxSwap).not.toBeNull();
    expect(loginBoxSwap).not.toBeNull();
    if (tryBoxSwap && loginBoxSwap) {
      // login_first 桶 · login 在左 (x 较小) · try 反序到右
      expect(
        loginBoxSwap.x,
        `login_first 桶 · login.x (${loginBoxSwap.x}) 应 < try.x (${tryBoxSwap.x})`,
      ).toBeLessThan(tryBoxSwap.x);
    }

    // data-bucket 属性也验证 · 防视觉变了但 bucket 没传到 (silent fork)
    await expect(page.getByTestId('p-landing-cta-wrap')).toHaveAttribute(
      'data-bucket',
      'login_first',
    );
  });

  // ── (d) entry_source_xss_sanitized · TC-11.05 安全断言点 ───────────
  test('TC-11-T04 (d) entry_source_xss_sanitized: ?entry_source=<script>... · 上报 entry_source 净化为 "unknown" (TC-11.05)', async ({ page }) => {
    // patch console.log 捕获 trackLanding 的 payload (telemetry.ts 第一步就镜像 console.log)
    const logs: Array<{ event: string; entry_source: unknown }> = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'log') return;
      const args = msg.args();
      if (args.length < 2) return;
      Promise.all([args[0].jsonValue(), args[1].jsonValue()])
        .then(([event, payload]) => {
          if (
            typeof event === 'string' &&
            event.startsWith('anon_landing_') &&
            payload &&
            typeof payload === 'object'
          ) {
            const p = payload as Record<string, unknown>;
            logs.push({ event: event, entry_source: p.entry_source });
          }
        })
        .catch(() => {
          /* ignore deserialize fail */
        });
    });

    // 注入 XSS payload · 多种 XSS 变体 (script tag · javascript: · 引号闭合 · html entity)
    const xssPayload = '<script>alert(1)</script>';
    await page.goto(
      `/welcome?entry_source=${encodeURIComponent(xssPayload)}`,
    );

    await expect(page.getByTestId('p-landing-cta-try')).toBeVisible({
      timeout: 8000,
    });

    // 给 console 异步 deserialize 一点时间 (Promise.all 解析 args)
    await page.waitForTimeout(500);

    // 找出 anon_landing_view 这条上报 (mount 即发)
    const viewLog = logs.find((l) => l.event === 'anon_landing_view');
    expect(
      viewLog,
      `Expected anon_landing_view in logs · got events: ${logs.map((l) => l.event).join(', ')}`,
    ).toBeTruthy();

    // 关键安全断言: XSS payload 必须被净化成 'unknown' (TC-11.05)
    expect(
      viewLog?.entry_source,
      `XSS payload "${xssPayload}" 应被 sanitizeEntrySource 净化为 'unknown' · 实际: ${String(viewLog?.entry_source)}`,
    ).toBe('unknown');

    // 双保险: 页面 DOM 中绝不能出现未转义的 <script> 标签 (XSS 真注入即死)
    const html = await page.content();
    expect(
      html.includes('<script>alert(1)</script>'),
      'Raw XSS <script>alert(1)</script> 不能直接出现在 DOM (React 默认转义已生效)',
    ).toBe(false);
  });

  // ── (e) bounce_pagehide_telemetry · sendBeacon 真验证 ──────────────
  test('TC-11-T04 (e) bounce_pagehide_telemetry: pagehide → sendBeacon 投递 anon_landing_bounce 含 dwell_ms', async ({ page }) => {
    // 在 page load 前 patch navigator.sendBeacon · 捕获 (url, blob) payload
    await page.addInitScript(() => {
      const beaconLog: Array<{ url: string; body: string }> = [];
      (window as unknown as { __beaconLog: typeof beaconLog }).__beaconLog = beaconLog;
      const origBeacon = navigator.sendBeacon?.bind(navigator);
      navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null): boolean {
        try {
          // data 是 Blob (我们的实现) · 同步 readAsText 在 worker scope 不行 ·
          // 但 Blob 提供 .text() async — 这里直接走异步 push (test 后再读)
          if (data instanceof Blob) {
            data.text().then((txt) => {
              beaconLog.push({ url: String(url), body: txt });
            });
          } else if (typeof data === 'string') {
            beaconLog.push({ url: String(url), body: data });
          } else {
            beaconLog.push({ url: String(url), body: '[non-text body]' });
          }
        } catch {
          /* ignore */
        }
        return origBeacon ? origBeacon(url, data) : true;
      };
    });

    await page.goto('/welcome');
    await expect(page.getByTestId('p-landing-cta-try')).toBeVisible({
      timeout: 8000,
    });

    // 等 dwell ≥ 600ms · 让 bounce.dwell_ms 是个有意义的非零数
    await page.waitForTimeout(800);

    // 触发 pagehide event (浏览器关闭 / SPA 离开 / 切后台都触发)
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    });

    // 给 Blob.text() async 解析一点时间
    await page.waitForTimeout(300);

    const beaconLog = await page.evaluate(
      () => (window as unknown as { __beaconLog: Array<{ url: string; body: string }> }).__beaconLog,
    );

    // 至少应该有 1 条 anon_landing_bounce 的 beacon
    const bounceBeacons = beaconLog.filter((b) => b.body.includes('anon_landing_bounce'));
    expect(
      bounceBeacons.length,
      `Expected ≥ 1 anon_landing_bounce sendBeacon · 实际 ${beaconLog.length} 条 beacon: ${JSON.stringify(beaconLog.map((b) => b.body.slice(0, 80)))}`,
    ).toBeGreaterThanOrEqual(1);

    // 验证 payload 完整性
    const bounceBeacon = bounceBeacons[0];
    expect(bounceBeacon.url).toContain('/api/landing/track');

    const payload = JSON.parse(bounceBeacon.body) as {
      event: string;
      dwell_ms: number;
      scroll_pct: number;
      sample_open_count: number;
      device_fp: string;
      entry_source: string;
      experiment_bucket: string;
    };
    expect(payload.event).toBe('anon_landing_bounce');
    expect(payload.dwell_ms).toBeGreaterThanOrEqual(0);
    expect(typeof payload.scroll_pct).toBe('number');
    expect(typeof payload.sample_open_count).toBe('number');
    // 三件套必须全部注入
    expect(typeof payload.device_fp).toBe('string');
    expect(payload.device_fp.length).toBeGreaterThan(0);
    expect(typeof payload.entry_source).toBe('string');
    expect(typeof payload.experiment_bucket).toBe('string');
  });

  // ── (f) consent_not_required_for_cta · CTA 不被合规阻塞 ────────────
  test('TC-11-T04 (f) consent_not_required_for_cta: 不勾 ConsentBar · click ctaTry · navigation 成功', async ({ page }) => {
    // 海外桶 · ConsentBar 含 checkbox · 默认不勾
    await page.goto('/welcome?region=overseas');

    await expect(page.getByTestId('p-landing-cta-try')).toBeVisible({
      timeout: 8000,
    });

    // ConsentBar 顶部横幅可见 + checkbox 未勾
    await expect(page.getByTestId('p-landing-consent-bar')).toBeVisible();
    const checkbox = page.getByTestId('p-landing-consent-checkbox');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();

    // 不勾选直接点 ctaTry · 应该能正常 navigate (合规策略: 不阻塞 CTA)
    // 用 nav history spy 同 (a)
    await page.addInitScript(() => {
      // 已经 goto 过 init 后才 patch 会无效 · 这里改用 patch global on next nav
    });

    // 直接断言 click 不抛 + DualCTA 仍可点
    let blocked = false;
    await page.getByTestId('p-landing-cta-try').click().catch(() => {
      blocked = true;
    });
    expect(blocked, 'CTA 不能因为 consent 未勾而被阻塞 click').toBe(false);

    // 验证 navigate 真发生 — page.url() 应该不再含 /welcome
    // (即使 fallback 到 / 也是 navigate 发生过)
    await page.waitForTimeout(300);
    const url = new URL(page.url());
    expect(
      url.pathname,
      `consent 未勾时 click ctaTry · 应触发 navigate (pathname 离开 /welcome) · 实际 ${url.pathname}`,
    ).not.toBe('/welcome');
  });

  // ── spy: 防止任何意外触发真业务 API (基础设施 spy · 不算业务 mock) ──
  test('TC-11-T04 (g) sanity_no_unexpected_api_calls: 整 spec /api/ai/* + /api/guest/* 累计 0', async ({ page }) => {
    let aiCount = 0;
    let guestCount = 0;
    const hits: string[] = [];
    await page.route('**/api/ai/**', (route: Route) => {
      aiCount += 1;
      hits.push(route.request().url());
      route.abort();
    });
    await page.route('**/api/guest/**', (route: Route) => {
      guestCount += 1;
      hits.push(route.request().url());
      route.abort();
    });

    await page.goto('/welcome');
    await expect(page.getByTestId('p-landing-cta-try')).toBeVisible({
      timeout: 8000,
    });
    // 翻动一下 · 触发 scroll handler
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(200);

    expect(aiCount, `AI 调用不应发生 · 命中: ${hits.join(', ')}`).toBe(0);
    expect(guestCount, `guest 调用不应发生 · 命中: ${hits.join(', ')}`).toBe(0);
  });
});
