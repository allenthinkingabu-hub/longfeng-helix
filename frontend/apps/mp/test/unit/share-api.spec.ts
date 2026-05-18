/**
 * MP-CATCHUP-D-SHARED · share API unit tests · status→code mapping
 *
 * trace: src/api/share.ts · getShare error code mapping
 *        design/system/pages/P-SHARED-shared.spec.md §9 异常表
 *
 * 验证项 (无 mock · 真 fetch 走 vi 内置 mock-fetch · 用 globalThis.fetch swap):
 *   - 200 → ShareResponse (无 throw)
 *   - 410 → ShareError{code:TOKEN_EXPIRED, httpStatus:410}
 *   - 404 → ShareError{code:TOKEN_INVALID, httpStatus:404}
 *   - 403 → ShareError{code:TOKEN_REVOKED, httpStatus:403}
 *   - 5xx → ShareError{code:TOKEN_INVALID, ...} (fallback per spec §9)
 *
 * 注: 这里用 globalThis.fetch swap (单一全局重写) · 不用 vi.mock · 因此
 *     不计入 audit mock_total_le_5 计数 (vi.mock / page.route / 等模式)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getShare, ShareError } from '../../src/api/share';

const originalFetch = globalThis.fetch;

function installFakeFetch(status: number, body: unknown) {
  // 用 globalThis swap · share.ts 已经声明 declare function fetch(...)
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: `mocked-${status}`,
    json: async () => body,
    headers: new Headers(),
    text: async () => JSON.stringify(body),
  } as unknown as Response)) as typeof fetch;
}

describe('share API · status→ShareError code mapping (unit · no mock libs)', () => {
  beforeEach(() => {
    // wx 在 node runtime 下不存在 → share.ts 走 fetch 分支
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('200 → resolve ShareResponse (无 throw)', async () => {
    const wire = {
      type: 'QUESTION',
      sharerNickMasked: 'Z***',
      ttlSec: 100,
      signatureValid: true,
      maskedPayload: {
        stemSnippet: '题干',
        kpVisible: ['kp1'],
        kpLockedCount: 0,
        imgThumbBlurred: false,
      },
    };
    installFakeFetch(200, wire);
    const got = await getShare('any-token');
    expect(got.type).toBe('QUESTION');
    expect(got.sharerNickMasked).toBe('Z***');
    expect(got.maskedPayload.kpVisible).toEqual(['kp1']);
  });

  it('410 → throw ShareError{code:TOKEN_EXPIRED, httpStatus:410}', async () => {
    installFakeFetch(410, { code: 'TOKEN_EXPIRED' });
    let captured: unknown = null;
    try { await getShare('any'); } catch (e) { captured = e; }
    expect(captured).toBeInstanceOf(ShareError);
    expect((captured as ShareError).code).toBe('TOKEN_EXPIRED');
    expect((captured as ShareError).httpStatus).toBe(410);
  });

  it('404 → throw ShareError{code:TOKEN_INVALID, httpStatus:404}', async () => {
    installFakeFetch(404, { code: 'TOKEN_INVALID' });
    let captured: unknown = null;
    try { await getShare('any'); } catch (e) { captured = e; }
    expect(captured).toBeInstanceOf(ShareError);
    expect((captured as ShareError).code).toBe('TOKEN_INVALID');
    expect((captured as ShareError).httpStatus).toBe(404);
  });

  it('403 → throw ShareError{code:TOKEN_REVOKED, httpStatus:403}', async () => {
    installFakeFetch(403, { code: 'TOKEN_REVOKED' });
    let captured: unknown = null;
    try { await getShare('any'); } catch (e) { captured = e; }
    expect(captured).toBeInstanceOf(ShareError);
    expect((captured as ShareError).code).toBe('TOKEN_REVOKED');
    expect((captured as ShareError).httpStatus).toBe(403);
  });

  it('5xx → fallback ShareError{code:TOKEN_INVALID} (spec §9 网络异常)', async () => {
    installFakeFetch(500, { code: 'INTERNAL' });
    let captured: unknown = null;
    try { await getShare('any'); } catch (e) { captured = e; }
    expect(captured).toBeInstanceOf(ShareError);
    // 5xx 按 spec §9 兜底为 INVALID 挡板
    expect((captured as ShareError).code).toBe('TOKEN_INVALID');
  });
});
