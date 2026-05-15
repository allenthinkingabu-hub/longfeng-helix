/**
 * P04 Result page · API integration tests
 * trace: design/mockups/wrongbook/04_result.html
 *        frontend/apps/h5/src/pages/Result/index.tsx (state machine + API contract)
 *
 * Real fetch to:
 *   GET http://localhost:8082/api/wb/questions/<qid>  (wrongbook-service)
 *   GET http://localhost:8083/api/ai/<qid>/answer     (ai-analysis-service)
 *
 * NO mocks · health check + 2 real API tests
 * These tests require the backend services to be running.
 */
import { describe, it, expect, beforeAll } from 'vitest';

const WB_BASE = process.env.MP_BACKEND_HOST
  ? `${process.env.MP_BACKEND_HOST}:8082`
  : 'http://localhost:8082';

const AI_BASE = process.env.MP_BACKEND_HOST
  ? `${process.env.MP_BACKEND_HOST}:8083`
  : 'http://localhost:8083';

const TEST_QID = 'test-qid-001';

describe('P04 Result · wrongbook-service health', () => {
  it('GET /api/wb/questions/:qid returns 200 or known status', async () => {
    const resp = await fetch(`${WB_BASE}/api/wb/questions/${TEST_QID}`);
    // Backend may return 200 (found) or 404 (not found) — both prove the service is alive
    expect([200, 404]).toContain(resp.status);
    expect(resp.headers.get('content-type')).toMatch(/json/i);
  });
});

describe('P04 Result · ai-analysis-service health', () => {
  it('GET /api/ai/:qid/answer returns 200 or known status', async () => {
    const resp = await fetch(`${AI_BASE}/api/ai/${TEST_QID}/answer`);
    // Backend may return 200 (found) or 404 (no answer yet) — both prove the service is alive
    expect([200, 404]).toContain(resp.status);
    expect(resp.headers.get('content-type')).toMatch(/json/i);
  });
});

describe('P04 Result · API contract shape', () => {
  it('wrongbook question response has expected shape when 200', async () => {
    const resp = await fetch(`${WB_BASE}/api/wb/questions/${TEST_QID}`);
    if (resp.status === 200) {
      const body = await resp.json();
      // Verify the response shape matches what the page expects
      expect(body).toHaveProperty('question');
      expect(body.question).toHaveProperty('id');
      expect(body.question).toHaveProperty('stem');
      expect(body.question).toHaveProperty('steps');
      expect(body.question).toHaveProperty('knowledgePoints');
    } else {
      // 404 is acceptable — service is up, just no data for this test ID
      expect(resp.status).toBe(404);
    }
  });

  it('ai answer response has expected shape when 200', async () => {
    const resp = await fetch(`${AI_BASE}/api/ai/${TEST_QID}/answer`);
    if (resp.status === 200) {
      const body = await resp.json();
      expect(body).toHaveProperty('reasonMarkdown');
      expect(body).toHaveProperty('confidence');
    } else {
      expect(resp.status).toBe(404);
    }
  });
});
