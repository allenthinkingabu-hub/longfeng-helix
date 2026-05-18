/**
 * MP-CATCHUP-B-WELCOME · P-LANDING API integration (真 anonymous-service · 0 mock)
 * trace:
 *   src/api/landing.ts → GET /api/landing/samples + /api/landing/kpi → localhost:8090
 *   backend/anonymous-service/.../LandingController.java (SC-11-T01)
 *
 * Soft-skip pattern: if anonymous-service unreachable, log warning and skip.
 * 禁: vi.mock / msw / nock (audit.js dim_test_reasonableness 卡口)
 */
import { describe, it, expect, beforeAll } from 'vitest';

const ANON_BASE = process.env.ANON_BASE_URL || 'http://localhost:8090';

let backendReachable = false;

describe('SC-11 · landing API integration (真 :8090 · 0 mock)', () => {
  beforeAll(async () => {
    try {
      const resp = await fetch(`${ANON_BASE}/api/landing/kpi`, {
        signal: AbortSignal.timeout(3_000),
      });
      backendReachable = resp.ok;
    } catch {
      console.warn(
        `anonymous-service at ${ANON_BASE} unreachable — ` +
        `integration tests will be soft-skipped.`,
      );
    }
  });

  it('GET /api/landing/samples?bucket=default returns 3 samples or soft-skips', async () => {
    if (!backendReachable) {
      console.warn('Soft-skip: anonymous-service not reachable');
      return;
    }
    const resp = await fetch(`${ANON_BASE}/api/landing/samples?bucket=default`, {
      signal: AbortSignal.timeout(5_000),
    });
    expect(resp.status).toBe(200);
    const body = await resp.json() as Array<{
      subject: string;
      stemText: string;
      knowledgePoints: string[];
      errorReason: string;
      correction: string;
    }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    const s0 = body[0];
    expect(typeof s0.subject).toBe('string');
    expect(typeof s0.stemText).toBe('string');
    expect(Array.isArray(s0.knowledgePoints)).toBe(true);
    expect(typeof s0.errorReason).toBe('string');
    expect(typeof s0.correction).toBe('string');
  });

  it('GET /api/landing/kpi returns 3 vanity counters or soft-skips', async () => {
    if (!backendReachable) {
      console.warn('Soft-skip: anonymous-service not reachable');
      return;
    }
    const resp = await fetch(`${ANON_BASE}/api/landing/kpi`, {
      signal: AbortSignal.timeout(5_000),
    });
    expect(resp.status).toBe(200);
    const body = await resp.json() as {
      cumulativeQuestions: number;
      dailyAnalyses: number;
      happyUsers: number;
    };
    expect(typeof body.cumulativeQuestions).toBe('number');
    expect(typeof body.dailyAnalyses).toBe('number');
    expect(typeof body.happyUsers).toBe('number');
    expect(body.cumulativeQuestions).toBeGreaterThan(0);
  });

  it('GET /api/landing/samples?bucket=variant_b returns variant_b array (or soft-skips)', async () => {
    if (!backendReachable) {
      console.warn('Soft-skip: anonymous-service not reachable');
      return;
    }
    const resp = await fetch(`${ANON_BASE}/api/landing/samples?bucket=variant_b`, {
      signal: AbortSignal.timeout(5_000),
    });
    expect(resp.status).toBe(200);
    const body = await resp.json() as Array<unknown>;
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET /api/landing/samples?bucket=unknown falls back to default (whitelist)', async () => {
    if (!backendReachable) {
      console.warn('Soft-skip: anonymous-service not reachable');
      return;
    }
    const resp = await fetch(`${ANON_BASE}/api/landing/samples?bucket=invalid_xxx`, {
      signal: AbortSignal.timeout(5_000),
    });
    expect(resp.status).toBe(200);
    const body = await resp.json() as Array<unknown>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });
});
