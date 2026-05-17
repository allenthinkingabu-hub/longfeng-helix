// ============================================================================
// SC-13 · P-SHARED · SharedView 主流程 Playwright spec (6 testcase)
// ============================================================================
//
// Source of truth (biz + design + code 三方拉齐):
//   biz §2A.3.2  P-SHARED 规格卡
//   biz §2B.14   F01-F07 流程编排
//   biz §10.9    错误码 410/403/404
//   design/system/pages/P-SHARED-shared.spec.md §6 状态机 / §9 异常 / §13 testid
//   frontend/apps/h5/src/pages/Shared/SharedView.tsx
//   backend/anonymous-service/.../controller/ShareController.java
//
// 6 testcase per SC-13 inflight scope_in #9:
//   (a) valid_token_renders_shared_view · 真后端打一行 + 真 JWT → READY · sharer-banner 含 'Z***' · DualCtaDock 渲染
//   (b) loading_skeleton_first           · mock fetch 延迟 1.5s · expect skeleton DOM 然后过渡 READY
//   (c) expired_token_shows_expired_screen · mock 410 · token-expired-screen visible
//   (d) invalid_token_shows_invalid_screen · mock 404 · token-invalid-screen visible
//   (e) revoked_token_shows_revoked_screen · mock 403 · token-revoked-screen visible
//   (f) cta_join_navigates_to_login_with_returnTo · click upgrade-cta-fixed · URL /auth/login?returnTo=%2Fs%2F<token>
//
// 反作弊红线:
//   - (a) 走真后端 (anonymous-service:8090) + 真 PG 插一行 share_token + 真 JWT 签发
//   - (b)(c)(d)(e) 用 page.route 注入 status code · 验证前端状态机分支
//   - mock 总数 ≤ 5
//   - 无 page.evaluate 走后门改 state
// ============================================================================

import { test, expect, type Route } from '@playwright/test';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

// PG access via docker exec (no node 'pg' driver dep needed)
const PG_EXEC = `docker exec -i team-1-pg psql -U longfeng -d wrongbook -t -A -c`;

function psql(sql: string): string {
  return execSync(`${PG_EXEC} "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}

// HS256 secret · 必须与 anonymous-service application.yml 字面量一致
const JWT_SECRET = 'longfeng-auth-dev-jwt-secret-min-256-bits-do-not-use-in-prod-please-rotate';
const JWT_ISS = 'longfeng';
const JWT_AUD = 'h5';

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** Sign HS256 JWT with jti claim (used for share token) · matches backend ShareTokenService.lookup */
function signShareJwt(jti: string, expDeltaSec: number): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({
      jti,
      iss: JWT_ISS,
      aud: JWT_AUD,
      iat: now,
      exp: now + expDeltaSec,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(signingInput).digest();
  return `${signingInput}.${b64url(sig)}`;
}

function insertShareToken(jti: string, expiresAt: Date): void {
  const iso = expiresAt.toISOString();
  psql(`INSERT INTO share_token(id, jti, sharer_student_id, share_type, relation_id, allow_claim, usage_limit, usage_count, status, created_at, expires_at) SELECT COALESCE(MAX(id),0)+1, '${jti}', 12345, 'QUESTION', 'wb_question:42', true, 1000, 0, 1, now(), '${iso}'::timestamptz FROM share_token`);
}

function cleanupShareTokens(prefix: string): void {
  psql(`DELETE FROM share_token WHERE jti LIKE '${prefix}%'`);
}

test.describe('SC-13 · P-SHARED SharedView (6 main cases)', () => {

  test.beforeEach(async () => {
    cleanupShareTokens('sc13-e2e-');
  });

  // ─── (a) TC-13.01 valid_token_renders_shared_view (真后端) ───────────────
  test('TC-13.01 (a) valid_token_renders_shared_view: 真 PG + 真 JWT → READY · sharer-banner + DualCtaDock', async ({ page }) => {
    const jti = `sc13-e2e-valid-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // +2d
    insertShareToken(jti, expiresAt);
    const jwt = signShareJwt(jti, 2 * 24 * 60 * 60);

    await page.goto(`/s/${jwt}`);

    // READY 态 (root + banner + masked + dual CTA + audit meta)
    await expect(page.getByTestId('p-shared')).toBeVisible();
    await expect(page.getByTestId('sharer-banner')).toBeVisible();
    // sharer 必须是 mask 形态 (X*** / Y*** etc.) · 不显示真 student_id
    await expect(page.getByTestId('sharer-banner-text')).toContainText('***');
    await expect(page.getByTestId('masked-question')).toBeVisible();
    await expect(page.getByTestId('ai-teaser-lock')).toBeVisible();
    await expect(page.getByTestId('share-meta')).toBeVisible();
    await expect(page.getByTestId('dual-cta-dock')).toBeVisible();
    await expect(page.getByTestId('upgrade-cta-fixed')).toBeVisible();
    await expect(page.getByTestId('upgrade-cta-fixed')).toContainText('加入');

    cleanupShareTokens('sc13-e2e-valid-');
  });

  // ─── (b) loading_skeleton_first ────────────────────────────────────────
  test('TC-13.01 (b) loading_skeleton_first: mock fetch 延迟 1.5s · skeleton 先现再过渡 READY', async ({ page }) => {
    // 延迟 1.5s 再返 200 valid · 给 skeleton 留窗口期
    await page.route('**/api/share/**', async (route: Route) => {
      await new Promise((r) => setTimeout(r, 1500));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'QUESTION',
          sharerNickMasked: 'Z***',
          ttlSec: 86400,
          signatureValid: true,
          maskedPayload: {
            stemSnippet: '设 f(x) = 2x²',
            kpVisible: ['二次函数', '最值'],
            kpLockedCount: 2,
            imgThumbBlurred: true,
          },
        }),
      });
    });

    await page.goto('/s/loading-test-token');

    // skeleton 必须在过渡前可见
    await expect(page.getByTestId('p-shared-skeleton')).toBeVisible({ timeout: 1000 });
    // 然后过渡到 READY (sharer banner 出现)
    await expect(page.getByTestId('sharer-banner')).toBeVisible({ timeout: 3000 });
    // skeleton 应该消失
    await expect(page.getByTestId('p-shared-skeleton')).toBeHidden();
  });

  // ─── (c) expired_token_shows_expired_screen ──────────────────────────────
  test('TC-13.03 (c) expired_token_shows_expired_screen: mock 410 → token-expired-screen', async ({ page }) => {
    await page.route('**/api/share/**', (route: Route) => {
      route.fulfill({
        status: 410,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'TOKEN_EXPIRED', message: '这个分享已过期' }),
      });
    });

    await page.goto('/s/expired-token');

    await expect(page.getByTestId('token-expired-screen')).toBeVisible();
    // masked-question 不渲染 (挡板态替代 scroll body)
    await expect(page.getByTestId('masked-question')).toHaveCount(0);
    await expect(page.getByTestId('dual-cta-dock')).toHaveCount(0);
  });

  // ─── (d) invalid_token_shows_invalid_screen ──────────────────────────────
  test('TC-13.03 (d) invalid_token_shows_invalid_screen: mock 404 → token-invalid-screen', async ({ page }) => {
    await page.route('**/api/share/**', (route: Route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'TOKEN_INVALID', message: '分享链接无效' }),
      });
    });

    await page.goto('/s/invalid-token');

    await expect(page.getByTestId('token-invalid-screen')).toBeVisible();
    await expect(page.getByTestId('masked-question')).toHaveCount(0);
  });

  // ─── (e) revoked_token_shows_revoked_screen ──────────────────────────────
  test('TC-13.03 (e) revoked_token_shows_revoked_screen: mock 403 → token-revoked-screen', async ({ page }) => {
    await page.route('**/api/share/**', (route: Route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'TOKEN_REVOKED', message: '分享者已撤销此分享' }),
      });
    });

    await page.goto('/s/revoked-token');

    await expect(page.getByTestId('token-revoked-screen')).toBeVisible();
    await expect(page.getByTestId('masked-question')).toHaveCount(0);
  });

  // ─── (f) cta_join_navigates_to_login_with_returnTo ──────────────────────
  test('TC-13.01 (f) cta_join_navigates_to_login_with_returnTo: click upgrade-cta-fixed → /auth/login?returnTo=%2Fs%2F<token>', async ({ page }) => {
    // mock 一个 valid 响应 · 跳过真后端 (本测试聚焦 CTA 行为)
    await page.route('**/api/share/**', (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'QUESTION',
          sharerNickMasked: 'Z***',
          ttlSec: 86400,
          signatureValid: true,
          maskedPayload: {
            stemSnippet: '设 f(x) = 2x²',
            kpVisible: ['二次函数', '最值'],
            kpLockedCount: 2,
            imgThumbBlurred: true,
          },
        }),
      });
    });

    await page.goto('/s/cta-test-token');
    await expect(page.getByTestId('upgrade-cta-fixed')).toBeVisible();
    await page.getByTestId('upgrade-cta-fixed').click();

    await page.waitForURL('**/auth/login**', { timeout: 5000 });
    const url = new URL(page.url());
    expect(url.pathname).toBe('/auth/login');
    expect(url.searchParams.get('returnTo')).toBe('/s/cta-test-token');
  });
});

