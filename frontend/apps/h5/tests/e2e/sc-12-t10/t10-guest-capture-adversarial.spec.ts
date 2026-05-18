// ============================================================================
// SC-12-T10 · P-GUEST-CAPTURE 完整真页 adversarial spec (4 cases · 探索性 + 破坏性)
// ============================================================================
//
// 探索性测试 (test-agent.md 铁律 3 严苛对抗 · CLAUDE.md Rule 9 Tests verify intent):
//   (a) camera_permission_denied_shows_error   — 禁用 getUserMedia (override) → ERROR
//   (b) upload_failure_retries                 — PUT to Minio 500 (page.route 反例 · 允许)
//   (c) polling_timeout_30s                    — result 永 ANALYZING (page.route 反例 · 允许)
//   (d) consent_uncheck_returns_to_idle        — consent uncheck → phase=IDLE 回退 · shutter disable
//
// page.route 在 (b) (c) 是 inflight scope_in 6 (b) (c) 明确允许的反例 case (模拟 backend 错误)
// 整 adversarial spec 3 处 page.route · 加 main spec 2 处 (f g) = 5 处 · 不超 audit mock<=5 红线

import { test, expect } from '@playwright/test';

test.describe('SC-12-T10 · P-GUEST-CAPTURE 完整真页 adversarial (4 cases · 探索性 + 边界)', () => {
  // ── (a) camera_permission_denied_shows_error ──────────────────────────────
  test('ADV-T10 (a) camera_permission_denied_shows_error: getUserMedia rejects → ERROR + 文字含「相机授权失败」', async ({
    page,
  }) => {
    // Override getUserMedia BEFORE page navigation so the page's call rejects
    await page.addInitScript(() => {
      // Replace mediaDevices.getUserMedia with a rejecting stub
      const md = navigator.mediaDevices as MediaDevices;
      Object.defineProperty(md, 'getUserMedia', {
        value: () =>
          Promise.reject(
            new DOMException('Permission denied', 'NotAllowedError'),
          ),
        configurable: true,
        writable: true,
      });
    });

    await page.goto('/guest/capture');
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute(
      'data-phase',
      'IDLE',
      { timeout: 10000 },
    );

    // Check consent + click shutter (will try getUserMedia and fail)
    await page.getByTestId('guest-consent-checkbox').check();
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute(
      'data-phase',
      'CONSENT_PENDING',
      { timeout: 5000 },
    );
    await page.getByTestId('guest-shutter').click();

    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute(
      'data-phase',
      'ERROR',
      { timeout: 5000 },
    );
    await expect(page.getByTestId('guest-error-banner')).toBeVisible();
    await expect(page.getByTestId('guest-error-banner')).toContainText(
      '相机授权失败',
    );
  });

  // ── (b) upload_failure_retries ────────────────────────────────────────────
  test('ADV-T10 (b) upload_failure_retries: PUT to Minio 500 (page.route 反例) → ERROR + 重试按钮 + click 重试回 CONSENT_PENDING', async ({
    page,
  }) => {
    let putAttempts = 0;
    await page.route('**/*', (route) => {
      const req = route.request();
      const url = req.url();
      // Only intercept the PUT to Minio presigned URL (host:9000)
      if (req.method() === 'PUT' && /:9000\//.test(url)) {
        putAttempts += 1;
        route.fulfill({
          status: 500,
          contentType: 'text/plain',
          body: 'minio_internal_error',
        });
        return;
      }
      route.continue();
    });

    await page.goto('/guest/capture');
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute(
      'data-phase',
      'IDLE',
      { timeout: 10000 },
    );
    await page.getByTestId('guest-consent-checkbox').check();
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute(
      'data-phase',
      'CONSENT_PENDING',
      { timeout: 5000 },
    );
    await page.getByTestId('guest-shutter').click(); // start camera
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute(
      'data-phase',
      'CAMERA_ACTIVE',
    );
    await page.waitForTimeout(300);
    await page.getByTestId('guest-shutter').click(); // capture (will fail at PUT)

    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute(
      'data-phase',
      'ERROR',
      { timeout: 15000 },
    );
    expect(putAttempts).toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId('guest-error-banner')).toContainText(
      '网络错误',
    );

    // Retry button clickable
    const retryBtn = page.getByTestId('guest-error-retry-btn');
    await expect(retryBtn).toBeVisible();
    await retryBtn.click();
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute(
      'data-phase',
      'CONSENT_PENDING',
      { timeout: 5000 },
    );
  });

  // ── (c) polling_timeout_30s ───────────────────────────────────────────────
  test('ADV-T10 (c) polling_timeout_30s: GET /api/anon/result/* 永返 ANALYZING (page.route 反例) → 30s 后 ERROR + 文字「超时」', async ({
    page,
  }) => {
    test.setTimeout(60_000); // give room for 30s real timeout

    await page.route('**/api/anon/result/**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ANALYZING' }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/guest/capture');
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute(
      'data-phase',
      'IDLE',
      { timeout: 10000 },
    );
    await page.getByTestId('guest-consent-checkbox').check();
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute(
      'data-phase',
      'CONSENT_PENDING',
      { timeout: 5000 },
    );
    await page.getByTestId('guest-shutter').click();
    await page.waitForTimeout(300);
    await page.getByTestId('guest-shutter').click();

    // Wait for ANALYZING
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute(
      'data-phase',
      'ANALYZING',
      { timeout: 15000 },
    );

    // Wait ≤ 32s for timeout → ERROR
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute(
      'data-phase',
      'ERROR',
      { timeout: 35000 },
    );
    await expect(page.getByTestId('guest-error-banner')).toContainText('超时');
  });

  // ── (d) consent_uncheck_returns_to_idle ───────────────────────────────────
  // 探索性: 用户已勾 consent · 又 uncheck · 期望 phase=IDLE 回退 · shutter 再次 disabled
  test('ADV-T10 (d) consent_uncheck_returns_to_idle: check then uncheck consent → phase=IDLE + shutter disabled', async ({
    page,
  }) => {
    await page.goto('/guest/capture');
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute(
      'data-phase',
      'IDLE',
      { timeout: 10000 },
    );
    await page.getByTestId('guest-consent-checkbox').check();
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute(
      'data-phase',
      'CONSENT_PENDING',
      { timeout: 5000 },
    );
    await expect(page.getByTestId('guest-shutter')).not.toBeDisabled();

    // Uncheck · expect phase rollback to IDLE
    await page.getByTestId('guest-consent-checkbox').uncheck();
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute(
      'data-phase',
      'IDLE',
      { timeout: 5000 },
    );
    await expect(page.getByTestId('guest-shutter')).toBeDisabled();
  });
});
