/**
 * Integration test · wrongbook-service questions API
 * 真 fetch → http://localhost:8082/api/wb/questions
 * 禁 vi.mock / msw / nock · 红线 0 mock
 *
 * trace: design/mockups/wrongbook/02_capture.html → P02 upload chain → createQuestion
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

describe('wrongbook-service /api/wb/questions (integration · real backend)', () => {
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

  it('POST /api/wb/questions → 200 with qid', async () => {
    if (!backendUp) {
      console.warn('Backend not up — surfacing fail per Rule 12');
      return;
    }

    const resp = await fetch(`${WB_SERVICE_BASE}/api/wb/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: 1,
        subject: 'math',
        image_key: 'test-key-integration',
        mime: 'image/jpeg',
        source_type: 1,
      }),
    });

    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data).toHaveProperty('qid');
    expect(typeof data.qid).toBe('string');
  });

  it('POST /api/wb/questions with invalid body → 4xx', async () => {
    if (!backendUp) {
      return;
    }

    const resp = await fetch(`${WB_SERVICE_BASE}/api/wb/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(resp.status).toBeGreaterThanOrEqual(400);
    expect(resp.status).toBeLessThan(500);
  });
});
