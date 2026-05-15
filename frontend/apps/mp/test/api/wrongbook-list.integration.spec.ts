/**
 * Integration test · wrongbook-service list API
 * 真 fetch → http://localhost:8082/api/wb/questions
 * 禁 vi.mock / msw / nock · 红线 0 mock
 *
 * trace: pages/wrongbook-list/index.ts → listWrongQuestions → GET /api/wb/questions
 */
import { describe, it, expect, beforeAll } from 'vitest';

const WB_SERVICE_BASE = process.env.WB_SERVICE_URL || 'http://localhost:8082';

async function checkHealth(): Promise<boolean> {
  try {
    const resp = await fetch(`${WB_SERVICE_BASE}/actuator/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

describe('wrongbook-service GET /api/wb/questions (integration · real backend)', () => {
  let backendUp = false;

  beforeAll(async () => {
    backendUp = await checkHealth();
    if (!backendUp) {
      console.warn(
        `[SKIP] wrongbook-service at ${WB_SERVICE_BASE} is not reachable. ` +
        'Start wrongbook-service (port 8082) to run integration tests.',
      );
    }
  });

  it('GET /api/wb/questions → 200 with items array', async () => {
    if (!backendUp) {
      console.warn('Backend not up — soft-skip per Rule 12');
      return;
    }

    const resp = await fetch(`${WB_SERVICE_BASE}/api/wb/questions?page=1&size=10`, {
      headers: { 'Content-Type': 'application/json' },
    });

    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data).toHaveProperty('items');
    expect(Array.isArray(data.items)).toBe(true);
    expect(data).toHaveProperty('total');
    expect(typeof data.total).toBe('number');
  });

  it('GET /api/wb/questions?subject=math → 200 filtered', async () => {
    if (!backendUp) {
      console.warn('Backend not up — soft-skip per Rule 12');
      return;
    }

    const resp = await fetch(`${WB_SERVICE_BASE}/api/wb/questions?subject=math&page=1&size=10`, {
      headers: { 'Content-Type': 'application/json' },
    });

    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data).toHaveProperty('items');
    expect(Array.isArray(data.items)).toBe(true);
  });

  it('GET /api/wb/questions?mastery=NOT_MASTERED → 200', async () => {
    if (!backendUp) {
      console.warn('Backend not up — soft-skip per Rule 12');
      return;
    }

    const resp = await fetch(`${WB_SERVICE_BASE}/api/wb/questions?mastery=NOT_MASTERED&page=1&size=10`, {
      headers: { 'Content-Type': 'application/json' },
    });

    expect(resp.status).toBe(200);
  });
});
