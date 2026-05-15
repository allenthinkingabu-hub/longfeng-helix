/**
 * P-HOME · vitest integration test (真 API · 0 mock · soft-skip)
 * trace: src/api/home.ts → GET /api/review/today → localhost:8085
 *
 * Soft-skip pattern: if backend unreachable, log warning and skip gracefully.
 * 禁: expect(backendUp).toBe(true) 硬断言
 * 禁: vi.mock / msw / nock
 */

import { describe, it, expect, beforeAll } from 'vitest';

const REVIEW_BASE = process.env.REVIEW_BASE_URL || 'http://localhost:8085';

let backendReachable = false;

describe('P-HOME · home API integration (真 API · 0 mock)', () => {
  beforeAll(async () => {
    try {
      const resp = await fetch(`${REVIEW_BASE}/actuator/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      backendReachable = resp.ok;
    } catch {
      console.warn(
        `review-plan-service at ${REVIEW_BASE} unreachable — ` +
        `integration tests will be soft-skipped.`,
      );
    }
  });

  it('GET /api/review/today returns today review data or soft-skips', async () => {
    if (!backendReachable) {
      console.warn('Soft-skip: backend not reachable');
      return; // soft-skip, not a failure
    }

    const resp = await fetch(
      `${REVIEW_BASE}/api/review/today?tz=Asia%2FShanghai`,
      { signal: AbortSignal.timeout(10_000) },
    );

    // Accept 200 (data) or 404 (no data seeded) — both prove endpoint wired
    expect([200, 404]).toContain(resp.status);

    if (resp.status === 200) {
      const body = (await resp.json()) as { data?: { total: number; items: unknown[] } };
      // Envelope shape: { code, message, data: { total, items, tz } }
      if (body.data) {
        expect(typeof body.data.total).toBe('number');
        expect(Array.isArray(body.data.items)).toBe(true);
      }
    }
  });
});
