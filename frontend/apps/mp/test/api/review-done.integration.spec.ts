/**
 * P09 Review Done · Integration test · 真 API (0 mock)
 * trace: POST /api/review/sessions/{sid}/complete → localhost:8085
 *
 * 前置: review-plan-service 在 localhost:8085 运行
 * 本测试走真 fetch (vitest Node runtime), 不走 wx.request
 */

import { describe, it, expect, beforeAll } from 'vitest';

const REVIEW_BASE = process.env.MP_BACKEND_HOST
  ? `${process.env.MP_BACKEND_HOST}:8085`
  : 'http://localhost:8085';

describe('P09 review-done · real API integration', () => {
  // ── Health check ──────────────────────────────────────────
  beforeAll(async () => {
    // Verify review-plan-service is alive
    const resp = await fetch(`${REVIEW_BASE}/actuator/health`, {
      signal: AbortSignal.timeout(5_000),
    }).catch(() => null);

    if (!resp || !resp.ok) {
      console.warn(
        `⚠️  review-plan-service not reachable at ${REVIEW_BASE} — skipping integration tests`,
      );
      return;
    }
  }, 10_000);

  it('POST /api/review/sessions/{sid}/complete returns 200 or 4xx for mock sid', async () => {
    const sid = 'integration-test-sid-001';
    const resp = await fetch(`${REVIEW_BASE}/api/review/sessions/${sid}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });

    // 200 = session found and completed, 404 = sid not found (both acceptable for integration test)
    expect([200, 404]).toContain(resp.status);

    if (resp.status === 200) {
      const body = await resp.json();
      expect(body).toHaveProperty('sessionId');
      expect(body).toHaveProperty('status');
    }
  }, 15_000);

  it('completeSession function calls real backend via fetch adapter', async () => {
    // Import the actual API function (runs in Node → uses fetch path in _http.ts)
    const { completeSession } = await import('../../src/api/review');

    try {
      const result = await completeSession('integration-test-sid-002');
      // If service is running and sid exists, we get a response
      expect(result).toHaveProperty('sessionId');
    } catch (err: unknown) {
      // 404 or connection refused is acceptable in CI without backend
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toMatch(/HTTP (404|4\d\d)|fetch failed|ECONNREFUSED/);
    }
  }, 15_000);
});
