// ============================================================================
// SC-11-T03 · P-LANDING SampleChips + SampleOverlay · Playwright E2E (5 case)
// ============================================================================
//
// Source of truth (biz + design + code 三方拉齐):
//   biz §2A.3.2 P-LANDING SampleChips + SampleOverlay
//   biz §2B.12  F04-F05 (Tap 样例 → 浮层 → 滑动 3 卡片) + 关键断言点 (浮层
//                直接读静态样本 · 不调真实模型 · /api/ai/* + /api/guest/* 计数 === 0)
//   design/system/pages/P-LANDING-landing.spec.md §3 SampleChips + §6 sample_overlay
//   inflight.context.scope_in #6 (a-e)
//   frontend/apps/h5/src/pages/Landing/SampleChips/index.tsx (本 task)
//   frontend/apps/h5/src/pages/Landing/SampleOverlay/index.tsx (本 task)
//
// 5 testcase per inflight scope_in #6 (a)-(e):
//   (a) chips_render_3_subjects        — 3 chip 全 visible · 文字含 数学/英语/物理
//   (b) chip_tap_opens_overlay         — click chipMath · overlayRoot + 3 card visible · body overflow=hidden
//   (c) overlay_close_via_x_button     — click overlayClose · overlayRoot hidden · body overflow 恢复
//   (d) overlay_close_via_mask_tap     — click mask · overlayRoot hidden
//   (e) no_ai_calls_during_overlay     — page.route spy · 完整开合 3 次 · 累计 0 (关键断言点)
//
// 反作弊红线 (audit-gate v3 / test-agent.md 铁律 3):
//   - 不 mock 业务 API · /api/landing/* 走真 backend (vite proxy → anonymous-service:8090)
//   - page.route 仅做 spy (request 计数 + route.continue) · 不改 response
//   - 不使用 page.evaluate 走后门改 React state
//   - mock 总数 ≤ 5
//   - exploratory keywords: Portal / overflow lock / popstate / 浮层叠加 / mask hit area

import { test, expect, type Route } from '@playwright/test';

test.describe('SC-11-T03 · P-LANDING SampleChips + SampleOverlay (5 cases)', () => {

  // ── (a) chips_render_3_subjects · 3 chip 全 visible ─────────────────
  test('TC-11-T03 (a) chips_render_3_subjects: 3 chip 全 visible · 文字 数学/英语/物理', async ({ page }) => {
    await page.goto('/welcome');

    // 等 samples 加载好 · samplesSection 出现说明 READY 态进入
    await expect(page.getByTestId('p-landing-samples-section')).toBeVisible({
      timeout: 8000,
    });

    // 3 chip 全部可见 · testid 严格匹配 spec
    const chipMath = page.getByTestId('p-landing-sample-chip-math');
    const chipEnglish = page.getByTestId('p-landing-sample-chip-english');
    const chipPhysics = page.getByTestId('p-landing-sample-chip-physics');
    await expect(chipMath).toBeVisible();
    await expect(chipEnglish).toBeVisible();
    await expect(chipPhysics).toBeVisible();

    // 文字必含中文学科名 · 防 emoji-only chip 假 PASS
    await expect(chipMath).toContainText('数学');
    await expect(chipEnglish).toContainText('英语');
    await expect(chipPhysics).toContainText('物理');

    // 浮层初始不存在 (没人 tap)
    await expect(page.getByTestId('p-sample-overlay-root')).toHaveCount(0);
  });

  // ── (b) chip_tap_opens_overlay · 3 卡片 + body overflow lock ────────
  test('TC-11-T03 (b) chip_tap_opens_overlay: 浮层 + 3 卡片 visible · body overflow=hidden', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page.getByTestId('p-landing-sample-chip-math')).toBeVisible({
      timeout: 8000,
    });

    // 记录 open 前的 body overflow (浏览器默认通常是 visible 或 '')
    const overflowBefore = await page.evaluate(() => document.body.style.overflow);

    // 真 click · 不用 evaluate 走后门
    await page.getByTestId('p-landing-sample-chip-math').click();

    // overlayRoot Portal 挂到 body · 不被 LandingPage 容器裁切
    const overlay = page.getByTestId('p-sample-overlay-root');
    await expect(overlay).toBeVisible();

    // 3 卡片必须都渲染 · 错因/正解/变式
    await expect(page.getByTestId('p-sample-overlay-error-card')).toBeVisible();
    await expect(page.getByTestId('p-sample-overlay-correction-card')).toBeVisible();
    await expect(page.getByTestId('p-sample-overlay-variant-card')).toBeVisible();

    // close 按钮可见 (3 close 触发器之一)
    await expect(page.getByTestId('p-sample-overlay-close')).toBeVisible();

    // body overflow lock 已生效
    const overflowAfter = await page.evaluate(() => document.body.style.overflow);
    expect(overflowAfter).toBe('hidden');
    // 同时确认: open 前确实不是 'hidden' (避免假 PASS)
    expect(overflowBefore).not.toBe('hidden');

    // 变式卡内容必走 fallback (LandingSample schema 无 variant 字段 ·
    // biz 关键断言点: 严禁触发真实 AI 模型)
    await expect(page.getByTestId('p-sample-overlay-variant-card')).toContainText(
      'AI 即将生成',
    );
  });

  // ── (c) overlay_close_via_x_button · × 关闭 + overflow 恢复 ────────
  test('TC-11-T03 (c) overlay_close_via_x_button: × close · overlayRoot hidden · body overflow 恢复', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page.getByTestId('p-landing-sample-chip-english')).toBeVisible({
      timeout: 8000,
    });

    // 记录 open 前的 overflow · 用于 close 后 diff
    const overflowBefore = await page.evaluate(() => document.body.style.overflow);

    // open
    await page.getByTestId('p-landing-sample-chip-english').click();
    await expect(page.getByTestId('p-sample-overlay-root')).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    // click × button (3 close 触发器 #1)
    await page.getByTestId('p-sample-overlay-close').click();

    // overlay unmount
    await expect(page.getByTestId('p-sample-overlay-root')).toHaveCount(0);

    // body overflow 恢复成 open 前的值 (cleanup 正确)
    const overflowAfter = await page.evaluate(() => document.body.style.overflow);
    expect(overflowAfter).toBe(overflowBefore);
  });

  // ── (d) overlay_close_via_mask_tap · mask 关闭 ──────────────────────
  test('TC-11-T03 (d) overlay_close_via_mask_tap: tap mask · overlayRoot hidden', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page.getByTestId('p-landing-sample-chip-physics')).toBeVisible({
      timeout: 8000,
    });

    await page.getByTestId('p-landing-sample-chip-physics').click();
    const overlay = page.getByTestId('p-sample-overlay-root');
    await expect(overlay).toBeVisible();

    // mask 是 overlayRoot 自身 (display:flex 包浮层 sheet 的外层) · 点
    // overlayRoot 的左上角 (4,4) — 浮层 sheet bottom-aligned · 顶部肯定是
    // mask 区。stopPropagation 在 sheet 上 · 点 mask 不会冒泡 close 失败。
    const box = await overlay.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    // 点 mask 左上角 (避免误中 sheet · sheet 在底部 70vh)
    await page.mouse.click(box.x + 8, box.y + 8);

    await expect(page.getByTestId('p-sample-overlay-root')).toHaveCount(0);
  });

  // ── (e) no_ai_calls_during_overlay · 关键断言点 ─────────────────────
  test('TC-11-T03 (e) no_ai_calls_during_overlay: 完整开合 3 次 · /api/ai/* + /api/guest/* 累计 0', async ({ page }) => {
    // page.route spy · 拦 AI / guest 接口 · 任何命中都计数
    let aiCallCount = 0;
    let guestCallCount = 0;
    const aiUrls: string[] = [];
    const guestUrls: string[] = [];

    await page.route('**/api/ai/**', (route: Route) => {
      aiCallCount += 1;
      aiUrls.push(route.request().url());
      // 即便有调用 · 也 abort · 让测试更敏感 (实际不该调到这)
      route.abort();
    });
    await page.route('**/api/guest/**', (route: Route) => {
      guestCallCount += 1;
      guestUrls.push(route.request().url());
      route.abort();
    });

    await page.goto('/welcome');
    await expect(page.getByTestId('p-landing-sample-chip-math')).toBeVisible({
      timeout: 8000,
    });

    // 完整开合循环 3 次 (3 chip × open + close via ×)
    for (const chip of ['math', 'english', 'physics']) {
      await page.getByTestId(`p-landing-sample-chip-${chip}`).click();
      await expect(page.getByTestId('p-sample-overlay-root')).toBeVisible();
      // 3 卡片渲染 · 静态读 sample 字段 · 此刻最容易触发 AI 调用 (本不该)
      await expect(page.getByTestId('p-sample-overlay-error-card')).toBeVisible();
      await expect(page.getByTestId('p-sample-overlay-correction-card')).toBeVisible();
      await expect(page.getByTestId('p-sample-overlay-variant-card')).toBeVisible();
      await page.getByTestId('p-sample-overlay-close').click();
      await expect(page.getByTestId('p-sample-overlay-root')).toHaveCount(0);
    }

    // 关键断言点: 整个流程 0 个 AI / guest 调用
    expect(aiCallCount, `AI 调用 (不该有): ${aiUrls.join(', ')}`).toBe(0);
    expect(guestCallCount, `guest 调用 (不该有): ${guestUrls.join(', ')}`).toBe(0);
  });
});
