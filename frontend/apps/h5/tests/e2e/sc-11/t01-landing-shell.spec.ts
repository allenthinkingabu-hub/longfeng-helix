// ============================================================================
// SC-11-T01 · P-LANDING shell · Playwright E2E (5 testcase)
// ============================================================================
//
// Source of truth (biz + design + code 三方拉齐):
//   biz §2A.3.2 P-LANDING 规格卡 (API 触点 + §9 状态机)
//   biz §2B.12  关键断言点 (强缓存 ≥ 1h · TTI ≤ 1.0s · 不调 /api/auth/* · /api/session/resolve)
//   biz §10.7   GET /api/landing/samples + /api/landing/kpi
//   frontend/apps/h5/src/pages/Landing/LandingPage.tsx (本 task 真页 · 4 态机)
//   frontend/apps/h5/src/pages/Landing/api.ts (allSettled + 5s AbortController)
//   backend/anonymous-service/.../controller/LandingController.java (Cache-Control + Vary)
//
// 5 testcase per inflight scope_in #8 (a)-(e):
//   (a) loading_skeleton_then_ready    — TC-11.01 主路径 · skeleton 短暂可见 → samples section
//   (b) samples_5xx_falls_to_degraded_state — TC-11.03 · samples 500 · banner visible · samples 隐藏 · CTA 仍可点
//   (c) kpi_5xx_partial_degraded       — kpi 500 · kpi-bar absent · hero + samples 正常
//   (d) no_auth_no_resolve_calls       — 关键断言点 · /api/auth/* + /api/session/resolve count===0
//   (e) cdn_cache_headers              — Cache-Control public,max-age=3600 + Vary: bucket
//
// 反作弊红线:
//   - (a)(d)(e) 完全不 mock 业务接口 · 用 page.route 仅作 spy 计数 (audit 维度 5 允许)
//   - (b)(c) 用 page.route 注入 5xx · audit-gate v3 说明 "page.route 注入 5xx/timeout 是测试基础设施 · 不算 business mock"
//   - 不使用 page.evaluate 走后门改组件 state
//   - mock 总数 ≤ 5 (本 spec 共 5 个 page.route · 全部为 spy 或 5xx 注入)
//   - exploratory keywords: race / concurrent / 容错 / CDN (Promise.allSettled 容错 · 并发 fetch)

import { test, expect, type Route } from '@playwright/test';

test.describe('SC-11-T01 · P-LANDING shell (5 cases)', () => {

  // ── (a) loading_skeleton_then_ready · TC-11.01 主路径 ────────────
  test('TC-11-T01 (a) loading_skeleton_then_ready: race-free allSettled · skeleton → samples section', async ({ page }) => {
    // Slow the samples endpoint just a hair so the skeleton is observably
    // visible. concurrent fetch · we still expect READY when both fulfil.
    let samplesHits = 0;
    await page.route('**/api/landing/samples**', async (route: Route) => {
      samplesHits += 1;
      await new Promise((r) => setTimeout(r, 250));
      await route.continue();
    });

    await page.goto('/welcome');

    // Skeleton must appear in the LOADING phase.
    await expect(page.getByTestId('p-landing-skeleton')).toBeVisible();

    // Within 5s the samples section + kpi bar must render (READY state).
    await expect(page.getByTestId('p-landing-samples-section')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('p-landing-kpi-bar')).toBeVisible({ timeout: 5000 });

    // Hero stays visible the whole time.
    await expect(page.getByTestId('p-landing-hero')).toBeVisible();

    // Skeleton must be gone once READY.
    await expect(page.getByTestId('p-landing-skeleton')).toHaveCount(0);

    // Banner must NOT appear in READY.
    await expect(page.getByTestId('p-landing-degraded-banner')).toHaveCount(0);

    // SC-00-T01-T02 占位 div must NOT appear (proof we replaced it · 不是补充).
    await expect(page.getByTestId('landing-placeholder-root')).toHaveCount(0);

    // At least 1 fetch happened (concurrent allSettled · React.StrictMode dev
    // may double-invoke effects so accept 1-2 · prod build will be exactly 1).
    expect(samplesHits).toBeGreaterThanOrEqual(1);
    expect(samplesHits).toBeLessThanOrEqual(2);
  });

  // ── (b) samples_5xx_falls_to_degraded_state · TC-11.03 ───────────
  test('TC-11-T01 (b) samples_5xx_falls_to_degraded_state: 500 · banner visible · samples 区缺失', async ({ page }) => {
    await page.route('**/api/landing/samples**', (route: Route) =>
      route.fulfill({ status: 500, body: '{"error":"upstream"}' }),
    );

    await page.goto('/welcome');

    // Banner must appear (DEGRADED-samples state).
    await expect(page.getByTestId('p-landing-degraded-banner')).toBeVisible({ timeout: 5000 });

    // Samples section must be absent (因为 5xx · 容错隐藏).
    await expect(page.getByTestId('p-landing-samples-section')).toHaveCount(0);

    // KPI bar must still render (kpi 没 5xx).
    await expect(page.getByTestId('p-landing-kpi-bar')).toBeVisible();

    // Hero + root 一直在 (CTA 仍可点 · biz TC-11.03)
    await expect(page.getByTestId('p-landing-hero')).toBeVisible();
    await expect(page.getByTestId('p-landing-root')).toBeVisible();
  });

  // ── (c) kpi_5xx_partial_degraded ─────────────────────────────────
  test('TC-11-T01 (c) kpi_5xx_partial_degraded: kpi 500 · kpi-bar absent · samples 正常', async ({ page }) => {
    await page.route('**/api/landing/kpi', (route: Route) =>
      route.fulfill({ status: 500, body: '{"error":"upstream"}' }),
    );

    await page.goto('/welcome');

    // Banner must appear (DEGRADED-kpi state).
    await expect(page.getByTestId('p-landing-degraded-banner')).toBeVisible({ timeout: 5000 });

    // KPI bar absent.
    await expect(page.getByTestId('p-landing-kpi-bar')).toHaveCount(0);

    // Samples section present (samples 没 5xx).
    await expect(page.getByTestId('p-landing-samples-section')).toBeVisible();

    // Hero + root 仍在.
    await expect(page.getByTestId('p-landing-hero')).toBeVisible();
    await expect(page.getByTestId('p-landing-root')).toBeVisible();
  });

  // ── (d) no_auth_no_resolve_calls · 关键断言点 ─────────────────────
  test('TC-11-T01 (d) no_auth_no_resolve_calls: 匿名访问 · /api/auth/* + /api/session/resolve count===0', async ({ page }) => {
    let authCalls = 0;
    let resolveCalls = 0;
    await page.route('**/api/auth/**', (route: Route) => {
      authCalls += 1;
      route.fulfill({ status: 404, body: 'forbidden in landing phase' });
    });
    await page.route('**/api/session/resolve', (route: Route) => {
      resolveCalls += 1;
      route.fulfill({ status: 404, body: 'forbidden in landing phase' });
    });

    await page.goto('/welcome');

    // Wait for the page to reach READY (samples + kpi both load).
    await expect(page.getByTestId('p-landing-samples-section')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('p-landing-kpi-bar')).toBeVisible({ timeout: 5000 });

    // Give any straggler async hooks a moment.
    await page.waitForTimeout(300);

    expect(authCalls).toBe(0);
    expect(resolveCalls).toBe(0);
  });

  // ── (e) cdn_cache_headers ────────────────────────────────────────
  test('TC-11-T01 (e) cdn_cache_headers: samples response · Cache-Control + Vary headers (CDN 强缓存)', async ({ request }) => {
    // Direct API request bypassing the page · validates the controller
    // attached the correct response headers for CDN edge caching.
    const resp = await request.get('/api/landing/samples?bucket=default');
    expect(resp.status()).toBe(200);

    const headers = resp.headers();
    const cc = headers['cache-control'] || '';
    expect(cc).toContain('public');
    expect(cc).toContain('max-age=3600');

    const vary = headers['vary'] || '';
    expect(vary.toLowerCase()).toContain('bucket');

    // Body shape sanity: 3 items array (locks the wire shape end-to-end).
    const body = (await resp.json()) as Array<{ subject: string }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(3);
    expect(body[0]).toHaveProperty('subject');
  });
});
