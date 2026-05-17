// ============================================================================
// SC-13 · P-SHARED · 对抗 / 探索性 Playwright spec (3 testcase)
// ============================================================================
//
// 对抗视角 (test-agent.md 铁律 3 严苛对抗):
//   (a) response_no_pii_fields    · 真后端打一行 + GET /api/share/:jwt · 反向断言 wire 不含 PII
//   (b) cache_control_no_store     · response header Cache-Control: no-store · CDN 严禁缓存
//   (c) ai_teaser_lock_not_unlocked · 锁层 div + lock icon visible · 真分析内容不渲染
//
// 这 3 case 是脱敏铁律 (第一红线) 的最后守门员 · 抓 backend silent leak.
// ============================================================================

import { test, expect, type Route } from '@playwright/test';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

const PG_EXEC = `docker exec -i team-1-pg psql -U longfeng -d wrongbook -t -A -c`;
function psql(sql: string): string {
  return execSync(`${PG_EXEC} "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}

const JWT_SECRET = 'longfeng-auth-dev-jwt-secret-min-256-bits-do-not-use-in-prod-please-rotate';
const JWT_ISS = 'longfeng';
const JWT_AUD = 'h5';

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signShareJwt(jti: string, expDeltaSec: number): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({ jti, iss: JWT_ISS, aud: JWT_AUD, iat: now, exp: now + expDeltaSec }),
  );
  const signingInput = `${header}.${payload}`;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(signingInput).digest();
  return `${signingInput}.${b64url(sig)}`;
}

function insertShareToken(jti: string, expiresAt: Date): void {
  const iso = expiresAt.toISOString();
  psql(`INSERT INTO share_token(id, jti, sharer_student_id, share_type, relation_id, allow_claim, usage_limit, usage_count, status, created_at, expires_at) SELECT COALESCE(MAX(id),0)+1, '${jti}', 12345, 'QUESTION', 'wb_question:secret-id-42', true, 1000, 0, 1, now(), '${iso}'::timestamptz FROM share_token`);
}

function cleanupShareTokens(prefix: string): void {
  psql(`DELETE FROM share_token WHERE jti LIKE '${prefix}%'`);
}

test.describe('SC-13 · P-SHARED 对抗探索 (3 cases · 脱敏铁律守门员)', () => {

  test.beforeEach(async () => {
    cleanupShareTokens('sc13-adv-');
  });

  // ─── (a) response_no_pii_fields ────────────────────────────────────────
  test('TC-13-ADV (a) response_no_pii_fields: 真后端响应 body 不含 relation_id / student_email / original_image_url / sharer_student_id', async ({ page }) => {
    const jti = `sc13-adv-pii-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    insertShareToken(jti, expiresAt);
    const jwt = signShareJwt(jti, 2 * 24 * 60 * 60);

    // 抓真 wire (不 mock) — 验证后端返的 body 真无 PII
    let responseBody = '';
    page.on('response', async (resp) => {
      if (resp.url().includes('/api/share/') && resp.status() === 200) {
        responseBody = await resp.text();
      }
    });

    await page.goto(`/s/${jwt}`);
    await expect(page.getByTestId('sharer-banner')).toBeVisible({ timeout: 5000 });

    // ── 脱敏铁律 · 反向断言 ────────────────────────────────────────
    expect(responseBody).not.toContain('relation_id');
    expect(responseBody).not.toContain('student_email');
    expect(responseBody).not.toContain('original_image_url');
    expect(responseBody).not.toContain('sharer_student_id');
    // wb_question 表的字面量也不准 leak
    expect(responseBody).not.toContain('wb_question');
    expect(responseBody).not.toContain('secret-id-42');

    cleanupShareTokens('sc13-adv-pii-');
  });

  // ─── (b) cache_control_no_store_header ────────────────────────────────
  test('TC-13-ADV (b) cache_control_no_store_header: response Cache-Control: no-store · CDN 严禁缓存', async ({ page }) => {
    const jti = `sc13-adv-cache-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    insertShareToken(jti, expiresAt);
    const jwt = signShareJwt(jti, 2 * 24 * 60 * 60);

    let cacheControlHeader: string | null = null;
    page.on('response', async (resp) => {
      if (resp.url().includes('/api/share/')) {
        cacheControlHeader = resp.headers()['cache-control'] ?? null;
      }
    });

    await page.goto(`/s/${jwt}`);
    await expect(page.getByTestId('sharer-banner')).toBeVisible({ timeout: 5000 });

    expect(cacheControlHeader).toBe('no-store');

    cleanupShareTokens('sc13-adv-cache-');
  });

  // ─── (c) ai_teaser_lock_layer_not_unlocked ───────────────────────────
  test('TC-13-ADV (c) ai_teaser_lock_not_unlocked: AI teaser 锁层渲染 + lock icon · 真分析内容不显示', async ({ page }) => {
    // mock 一个 valid 响应 (本测聚焦 UI 锁层 · 不需真后端)
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

    await page.goto('/s/ai-lock-test');
    await expect(page.getByTestId('ai-teaser-lock')).toBeVisible();
    await expect(page.getByTestId('ai-teaser-lock-icon')).toBeVisible();

    // teaser 区域应有 lock 文字 (P0 不接真 AI)
    const teaser = page.getByTestId('ai-teaser-lock');
    await expect(teaser).toContainText('加入错题本');
    // 严禁 P0 渲染真 AI 完整分析内容字面量 (例如 '完整错因分析' / 'AI 已自动生成')
    // 这些字面量在 mockup 中不出现 · 若出现意味着 P1 真 AI 提前 leak
    const body = await teaser.textContent();
    expect(body).not.toContain('AI 已自动生成');
    expect(body).not.toContain('详细分析报告');
  });
});
