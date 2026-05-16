/**
 * Unit · pages/analyzing/index onLoad decodes imageUrl
 *
 * RC: capture/index.ts does `encodeURIComponent(presignResp.image_url)` before
 * wx.navigateTo so the MinIO `?X-Amz-...&sig=...` doesn't collide with the
 * route's own query string. WeChat's options parser does NOT auto-decode the
 * value in the current SDK, so analyzing/onLoad receives the literal `%3A%2F%2F`
 * laden string. Passing that straight to BE made DashScope reject the URL
 * ("URL does not appear to be valid") and OCR step 1 failed.
 *
 * This spec locks in the decode. Mock budget: 1 vi.mock on '@/api/ai' startAnalyze.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/api/ai', () => ({
  startAnalyze: vi.fn(),
  pollAnalyzeStatus: vi.fn(),
}));

// Minimal Page() shim so importing the page registers an instance we can drive.
let pageInstance: any = null;
(globalThis as any).Page = (def: any) => {
  pageInstance = {
    ...def,
    data: { ...def.data },
    setData(d: any) { Object.assign(this.data, d); },
    _pollTimer: 0,
    _pollCount: 0,
    _qid: '',
  };
};
(globalThis as any).wx = { navigateTo: vi.fn(), navigateBack: vi.fn() };

await import('../../pages/analyzing/index');

import { startAnalyze } from '../../src/api/ai';
const mockedStart = vi.mocked(startAnalyze);

describe('analyzing/onLoad · imageUrl decode (fix for AI 分析失败 OCR step)', () => {
  beforeEach(() => {
    mockedStart.mockReset();
    mockedStart.mockResolvedValue({ taskId: 'tid-1', status: 'ANALYZING' });
  });

  it('decodes URL-encoded imageUrl from route query before calling startAnalyze', async () => {
    const raw = 'http://localhost:9000/wrongbook-dev/abc.jpg?X-Amz-Signature=abc&X-Amz-Expires=900';
    const encoded = encodeURIComponent(raw);

    pageInstance.onLoad({ imageUrl: encoded, subject: 'math', qid: 'q-1' });
    // _startAnalysis is async — let the microtask resolve
    await Promise.resolve();

    expect(mockedStart).toHaveBeenCalledTimes(1);
    const arg = mockedStart.mock.calls[0][0];
    expect(arg.imageUrl).toBe(raw);
    expect(arg.imageUrl).not.toContain('%3A');
    expect(arg.imageUrl).not.toContain('%2F');
  });

  it('handles already-decoded imageUrl (idempotent for callers that do not encode)', async () => {
    const raw = 'https://oss.example.com/img.jpg';

    pageInstance.onLoad({ imageUrl: raw, subject: 'math', qid: 'q-2' });
    await Promise.resolve();

    expect(mockedStart).toHaveBeenCalledTimes(1);
    expect(mockedStart.mock.calls[0][0].imageUrl).toBe(raw);
  });

  it('does not call startAnalyze when imageUrl is missing (demo mode)', () => {
    pageInstance.onLoad({ subject: 'math' });
    expect(mockedStart).not.toHaveBeenCalled();
    expect(pageInstance.data.pageState).toBe('analyzing');
  });
});
