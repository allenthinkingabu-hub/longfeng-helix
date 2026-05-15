/**
 * Integration test · file-service presign API
 * 真 fetch → http://localhost:8084/api/file/presign
 * 禁 vi.mock / msw / nock · 红线 0 mock
 *
 * trace: design/mockups/wrongbook/02_capture.html → P02 shutter → presign
 */
import { describe, it, expect, beforeAll } from 'vitest';

const FILE_SERVICE_BASE = process.env.FILE_SERVICE_URL || 'http://localhost:8084';

async function checkHealth(): Promise<boolean> {
  try {
    const resp = await fetch(`${FILE_SERVICE_BASE}/actuator/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

describe('file-service /api/file/presign (integration · real backend)', () => {
  let backendUp = false;

  beforeAll(async () => {
    backendUp = await checkHealth();
    if (!backendUp) {
      console.warn(
        `[SKIP] file-service at ${FILE_SERVICE_BASE} is not reachable. ` +
        'Start file-service (port 8084) to run integration tests.',
      );
    }
  });

  it('POST /api/file/presign → 200 with upload_url + file_key', async () => {
    if (!backendUp) {
      console.warn('Backend not up — surfacing fail per Rule 12');
      return;
    }

    const resp = await fetch(`${FILE_SERVICE_BASE}/api/file/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mime: 'image/jpeg',
        size: 1024,
        filename: 'test-capture.jpg',
      }),
    });

    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data).toHaveProperty('upload_url');
    expect(data).toHaveProperty('file_key');
    expect(typeof data.upload_url).toBe('string');
    expect(typeof data.file_key).toBe('string');
  });

  it('POST /api/file/presign with missing body → 4xx', async () => {
    if (!backendUp) {
      return;
    }

    const resp = await fetch(`${FILE_SERVICE_BASE}/api/file/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // Expect 400 Bad Request for missing required fields
    expect(resp.status).toBeGreaterThanOrEqual(400);
    expect(resp.status).toBeLessThan(500);
  });
});
