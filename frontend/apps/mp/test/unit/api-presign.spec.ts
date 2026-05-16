/**
 * Unit test · api/file.ts presign + api/ai.ts startAnalyze/pollAnalyzeStatus
 *
 * Repro of 2026-05-16 WeChat IDE bug:
 *   - POST /api/file/presign → 400 (missing X-Idempotency-Key, no ApiResult unwrap)
 *   - GET  /api/ai/tasks/undefined/status → 404 (snake_case task_id dropped,
 *     wrong polling URL, no ApiResult unwrap)
 *
 * Strategy: stub global `fetch` so we can assert request shape (URL + headers
 * + body) and inject ApiResult-shaped responses. The MP runtime path
 * (wx.request) is exercised separately by integration tests; in vitest Node
 * we hit the fetch branch of _http.ts.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { presign } from '../../src/api/file';
import { startAnalyze, pollAnalyzeStatus } from '../../src/api/ai';
import { unwrapApiResult } from '../../src/api/_http';

type FetchCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
};

const calls: FetchCall[] = [];
let nextResponse: { status: number; body: unknown } = { status: 200, body: {} };

const originalFetch = (globalThis as Record<string, unknown>).fetch;

function installFetchStub(): void {
  (globalThis as Record<string, unknown>).fetch = (async (url: string, init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }) => {
    calls.push({
      url,
      method: init?.method ?? 'GET',
      headers: init?.headers ?? {},
      body: init?.body !== undefined ? JSON.parse(init.body) : undefined,
    });
    const { status, body } = nextResponse;
    return {
      ok: status >= 200 && status < 400,
      status,
      statusText: status === 200 ? 'OK' : 'ERR',
      json: async () => body,
    };
  }) as unknown as typeof fetch;
}

function restoreFetch(): void {
  (globalThis as Record<string, unknown>).fetch = originalFetch;
}

beforeEach(() => {
  calls.length = 0;
  installFetchStub();
});

afterEach(() => {
  restoreFetch();
});

describe('unwrapApiResult', () => {
  it('strips ApiResult envelope when shape matches', () => {
    expect(unwrapApiResult({ code: 0, message: 'ok', data: { task_id: 'T1' } }))
      .toEqual({ task_id: 'T1' });
  });

  it('passes through plain payloads (e.g. /api/ai/result)', () => {
    expect(unwrapApiResult({ status: 'ANALYZING' })).toEqual({ status: 'ANALYZING' });
  });

  it('does not strip envelopes that have extra fields (be conservative)', () => {
    // Some backends include `code` + `data` plus a third key like `traceId`.
    // We only unwrap when the keys are exactly the ApiResult subset.
    const obj = { code: 0, data: { foo: 1 }, traceId: 'abc' };
    expect(unwrapApiResult(obj)).toBe(obj);
  });
});

describe('presign client (file-service)', () => {
  it('sends X-Idempotency-Key header (SC-01-T01 AC6) and snake_case body', async () => {
    nextResponse = {
      status: 200,
      body: {
        code: 0,
        message: 'ok',
        data: {
          url: 'https://minio/upload?sig=put',
          image_url: 'https://minio/get?sig=get',
          method: 'PUT',
          object_key: 'wrongbook/0/202605/1/123_capture.jpg',
          expires_in_sec: 900,
        },
      },
    };

    const resp = await presign({
      mime: 'image/jpeg',
      size: 1024,
      filename: 'capture.jpg',
      idempotencyKey: 'idem-abc-123',
    });

    // Bug 1 fix: the request must carry the idempotency header.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/api/file/presign');
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.headers['X-Idempotency-Key']).toBe('idem-abc-123');

    // Bug 1 fix: the body must use snake_case field names that PresignController
    // accepts canonically (filename + content_type + bytes).
    expect(calls[0]!.body).toMatchObject({
      filename: 'capture.jpg',
      content_type: 'image/jpeg',
      bytes: 1024,
    });

    // Bug 1 fix: response must unwrap ApiResult + map url→upload_url +
    // object_key→file_key so capture/index.ts can consume it.
    expect(resp).toEqual({
      upload_url: 'https://minio/upload?sig=put',
      file_key: 'wrongbook/0/202605/1/123_capture.jpg',
      image_url: 'https://minio/get?sig=get',
    });
  });

  it('forwards optional sha256 as sha256_hash', async () => {
    nextResponse = {
      status: 200,
      body: { code: 0, data: { url: 'u', image_url: 'i', object_key: 'k' } },
    };
    await presign({
      mime: 'image/jpeg',
      size: 1024,
      filename: 'a.jpg',
      idempotencyKey: 'k',
      sha256: 'a'.repeat(64),
    });
    expect((calls[0]!.body as Record<string, unknown>).sha256_hash).toBe('a'.repeat(64));
  });
});

describe('startAnalyze (ai-analysis-service)', () => {
  it('unwraps ApiResult and maps snake_case task_id to taskId', async () => {
    // Bug 2 fix: backend returns {code, message, data:{task_id, status}}.
    // Old code did `setData({taskId: resp.taskId})` which was undefined and
    // triggered the WX warning + 404 polling.
    nextResponse = {
      status: 200,
      body: {
        code: 0,
        message: 'ok',
        data: { task_id: 'task-42', status: 'ANALYZING' },
      },
    };
    const resp = await startAnalyze({ imageUrl: 'http://x/y.jpg', subject: '数学' });
    expect(resp.taskId).toBe('task-42');
    expect(resp.status).toBe('ANALYZING');
  });

  it('accepts already-camelCase backends without breaking', async () => {
    nextResponse = {
      status: 200,
      body: { taskId: 'task-99', status: 'ANALYZING' },
    };
    const resp = await startAnalyze({ imageUrl: 'http://x/y.jpg', subject: '数学' });
    expect(resp.taskId).toBe('task-99');
  });

  it('sends camelCase request body (imageUrl + subject) that AnalyzeByUrlReq expects', async () => {
    nextResponse = { status: 200, body: { code: 0, data: { task_id: 't' } } };
    await startAnalyze({ imageUrl: 'http://x/y.jpg', subject: '数学' });
    expect(calls[0]!.body).toMatchObject({ subject: '数学', imageUrl: 'http://x/y.jpg' });
  });
});

describe('pollAnalyzeStatus (ai-analysis-service)', () => {
  it('hits /api/ai/result/:taskId (NOT /api/ai/tasks/:id/status)', async () => {
    // Bug 3 fix: backend mounts the result endpoint at /api/ai/result/{taskId}.
    // The old URL /api/ai/tasks/:id/status doesn't exist and 404'd.
    nextResponse = { status: 200, body: { status: 'ANALYZING' } };
    await pollAnalyzeStatus('task-7');
    expect(calls[0]!.url).toMatch(/\/api\/ai\/result\/task-7$/);
    expect(calls[0]!.url).not.toContain('/tasks/');
  });

  it('maps backend DONE → SUCCEEDED', async () => {
    nextResponse = { status: 200, body: { status: 'DONE' } };
    const resp = await pollAnalyzeStatus('task-7');
    expect(resp.status).toBe('SUCCEEDED');
  });

  it('maps backend FAILED → FAILED', async () => {
    nextResponse = { status: 200, body: { status: 'FAILED', error: 'oops' } };
    const resp = await pollAnalyzeStatus('task-7');
    expect(resp.status).toBe('FAILED');
    expect(resp.error).toBe('oops');
  });

  it('maps backend ANALYZING/unknown → RUNNING (so analyzing page keeps polling)', async () => {
    nextResponse = { status: 200, body: { status: 'ANALYZING' } };
    expect((await pollAnalyzeStatus('task-7')).status).toBe('RUNNING');
  });

  it('throws synchronously when taskId is empty (prevents /tasks/undefined/status regression)', async () => {
    await expect(pollAnalyzeStatus('')).rejects.toThrow(/taskId is required/);
    expect(calls).toHaveLength(0);
  });
});
