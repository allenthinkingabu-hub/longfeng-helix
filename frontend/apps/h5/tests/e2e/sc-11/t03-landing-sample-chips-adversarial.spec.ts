// ============================================================================
// SC-11-T03 · P-LANDING SampleChips + SampleOverlay · 对抗性 spec (2+ case)
// ============================================================================
//
// 探索性 + 破坏性边界 (test-agent.md 铁律 3 严苛对抗):
//   (a) android_back_closes_overlay   — 浮层 open · page.goBack() · overlayRoot hidden ·
//                                       URL 仍 /welcome (不退出 P-LANDING)
//   (b) 3_chip_cycle_open_close       — math → close → english → close → physics → close ·
//                                       每次 open 不同 sample 内容 · 不出现多浮层叠加
//   (c) sheet_click_does_not_close    — 防 mask 冒泡误关 · 点浮层卡片内部不应关闭浮层
//   (d) chip_double_tap_no_double_overlay — 极速双击 chip · 仅一个 overlay
//
// keywords: Portal · overflow lock · popstate · 浮层叠加 · mask hit area

import { test, expect } from '@playwright/test';

test.describe('SC-11-T03 · adversarial · 破坏性边界 + 探索性 (4 cases)', () => {

  // ── (a) android_back_closes_overlay · popstate 触发关闭 ────────────
  test('ADV-T03 (a) android_back_closes_overlay: page.goBack() · overlay hidden · URL 仍 /welcome', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page.getByTestId('p-landing-sample-chip-math')).toBeVisible({
      timeout: 8000,
    });

    // open · 此时 component pushState({__overlay:true}) 已推一个虚拟 history
    await page.getByTestId('p-landing-sample-chip-math').click();
    await expect(page.getByTestId('p-sample-overlay-root')).toBeVisible();

    const urlBeforeBack = page.url();
    expect(urlBeforeBack).toContain('/welcome');

    // 模拟 Android 系统返回键 · history.go(-1) → popstate fired · overlay close
    await page.goBack();

    // overlayRoot 卸载
    await expect(page.getByTestId('p-sample-overlay-root')).toHaveCount(0);

    // URL 仍在 /welcome (没退出 P-LANDING 到 / 上层)
    expect(page.url()).toContain('/welcome');

    // 进一步: 此时 chip 应该还在 · 用户可以再次 open
    await expect(page.getByTestId('p-landing-sample-chip-math')).toBeVisible();
  });

  // ── (b) 3_chip_cycle_open_close · 不出现浮层叠加 ───────────────────
  test('ADV-T03 (b) 3_chip_cycle_open_close: 循环 3 chip · 每次浮层内容不同 · 无叠加', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page.getByTestId('p-landing-sample-chip-math')).toBeVisible({
      timeout: 8000,
    });

    const seenStems: string[] = [];

    for (const chip of ['math', 'english', 'physics']) {
      await page.getByTestId(`p-landing-sample-chip-${chip}`).click();
      const overlay = page.getByTestId('p-sample-overlay-root');
      await expect(overlay).toBeVisible();

      // 关键断言: overlay 同时只能有 1 个 (不允许叠加)
      const count = await page.getByTestId('p-sample-overlay-root').count();
      expect(count, `chip ${chip} 触发了 ${count} 个浮层 (应该恰 1)`).toBe(1);

      // 抓 stem 内容 · 3 chip 内容应互不相同 (后端 samples 不同学科 stem 不同)
      const stemText = await overlay.locator('p').first().textContent();
      expect(stemText).not.toBeNull();
      if (stemText) seenStems.push(stemText.trim());

      // close 后浮层应彻底消失
      await page.getByTestId('p-sample-overlay-close').click();
      await expect(page.getByTestId('p-sample-overlay-root')).toHaveCount(0);
    }

    // 3 次 open 看到的 stem 互不相同 (证明每次 open 都是新 sample · state 已重置)
    const uniqueStems = new Set(seenStems);
    expect(
      uniqueStems.size,
      `3 次 open stem 应互不相同 · 实际 ${[...uniqueStems].length} 种: ${seenStems.join(' || ')}`,
    ).toBe(3);
  });

  // ── (c) sheet_click_does_not_close · stopPropagation 验证 ──────────
  test('ADV-T03 (c) sheet_click_does_not_close: 点浮层卡片内部不关闭浮层', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page.getByTestId('p-landing-sample-chip-math')).toBeVisible({
      timeout: 8000,
    });
    await page.getByTestId('p-landing-sample-chip-math').click();

    const overlay = page.getByTestId('p-sample-overlay-root');
    await expect(overlay).toBeVisible();

    // 点 errorCard (浮层卡片内部) · 不应触发 close
    await page.getByTestId('p-sample-overlay-error-card').click();
    await page.waitForTimeout(150); // 给一点时间让 close animation 跑 (如果错误触发)
    await expect(overlay).toBeVisible();

    await page.getByTestId('p-sample-overlay-correction-card').click();
    await page.waitForTimeout(150);
    await expect(overlay).toBeVisible();

    await page.getByTestId('p-sample-overlay-variant-card').click();
    await page.waitForTimeout(150);
    await expect(overlay).toBeVisible();

    // 然后真的 close 应该还能正常工作
    await page.getByTestId('p-sample-overlay-close').click();
    await expect(page.getByTestId('p-sample-overlay-root')).toHaveCount(0);
  });

  // ── (d) chip_double_tap_no_double_overlay · 极速双击防御 ────────────
  // REJECT round 1 fix: 原本两次 click 第二次会被 mask 拦截 close · 结果 0 overlay
  // 真正想验证的是: 在 React state 层面 setOpenSample 始终是单数 · 同步连续
  // dispatchEvent 两次都不会产生两个浮层 DOM. 用 dispatchEvent 在同一 task 内
  // 触发两次 React event (不让 Playwright 的 actionability 等待让 mask 抢拦)。
  test('ADV-T03 (d) chip_double_tap_no_double_overlay: 同一 task 内连发 2 个 click event · 浮层 DOM 数恰 1', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page.getByTestId('p-landing-sample-chip-math')).toBeVisible({
      timeout: 8000,
    });

    // 同一 microtask 内连发 2 个 click event · 模拟极速双击 (浏览器 dblclick
    // 也是这个时序)。React batched update 必须把两次 setOpenSample 合并 ·
    // 不产生两个浮层节点。
    await page.evaluate(() => {
      const chip = document.querySelector(
        '[data-testid="p-landing-sample-chip-math"]',
      ) as HTMLElement | null;
      if (!chip) throw new Error('chip not found');
      chip.click();
      chip.click();
    });

    await expect(page.getByTestId('p-sample-overlay-root')).toBeVisible();
    const count = await page.getByTestId('p-sample-overlay-root').count();
    expect(count, `双击产生了 ${count} 个浮层 (应恰 1)`).toBe(1);

    // close 一次应能彻底关闭
    await page.getByTestId('p-sample-overlay-close').click();
    await expect(page.getByTestId('p-sample-overlay-root')).toHaveCount(0);
  });
});
