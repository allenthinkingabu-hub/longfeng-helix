/**
 * MP-CATCHUP-D-SHARED · share API integration test (真 API · 0 mock · soft-skip)
 *
 * trace:
 * - src/api/share.ts → GET /api/share/:shareToken → localhost:8090 (anonymous-service)
 * - design/system/pages/P-SHARED-shared.spec.md §5 (API 触点)/§9 (异常)
 * - backend ShareController.java (404 INVALID 反向验证 · 真 BE 行为)
 *
 * Soft-skip pattern: if anonymous-service unreachable, log warning and skip gracefully.
 * 禁: expect(backendUp).toBe(true) 硬断言
 * 禁: vi.mock / msw / nock
 *
 * PII 反向断言 (脱敏铁律 · 字符串扫描 wire response 不含 PII 字段名):
 *   relation_id / sharer_student_id / student_email / original_image_url
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { getShare, ShareError } from '../../src/api/share';

const ANON_BASE = process.env.MP_BACKEND_HOST || 'http://localhost';
const ANON_PORT = 8090;
const ANON_URL = `${ANON_BASE}:${ANON_PORT}`;

let backendReachable = false;

describe('P-SHARED · share API integration (真 BE :8090 · 0 mock)', () => {
  beforeAll(async () => {
    try {
      // anonymous-service ShareController 404 on invalid token = endpoint live
      const resp = await fetch(`${ANON_URL}/api/share/probe-not-real-token`, {
        signal: AbortSignal.timeout(3_000),
      });
      // accept any of 404/403/410/200 - all 4 prove endpoint live
      backendReachable = [200, 403, 404, 410].includes(resp.status);
    } catch {
      console.warn(
        `anonymous-service at ${ANON_URL} unreachable — integration test soft-skipped.`,
      );
    }
  });

  // ─────────────────────────────────────────────────────────────
  // TC-INT-1 · INVALID token → 404 → ShareError code=TOKEN_INVALID
  // ─────────────────────────────────────────────────────────────
  it('TC-INT-1 · 不存在的 token → throw ShareError{code:TOKEN_INVALID}', async () => {
    if (!backendReachable) {
      console.warn('Soft-skip: anonymous-service unreachable');
      return;
    }
    let captured: unknown = null;
    try {
      await getShare('definitely-not-a-real-hs256-jwt-' + Date.now());
    } catch (e) {
      captured = e;
    }
    expect(captured).toBeInstanceOf(ShareError);
    const err = captured as ShareError;
    expect(err.code).toBe('TOKEN_INVALID');
    expect(err.httpStatus).toBe(404);
  });

  // ─────────────────────────────────────────────────────────────
  // TC-INT-2 · 空 / 异形 token (signature 验失败) → INVALID
  // ─────────────────────────────────────────────────────────────
  it('TC-INT-2 · 异形 token (无 dot · 非 JWT) → ShareError{code:TOKEN_INVALID}', async () => {
    if (!backendReachable) {
      console.warn('Soft-skip: anonymous-service unreachable');
      return;
    }
    let captured: unknown = null;
    try {
      await getShare('not-a-jwt-format');
    } catch (e) {
      captured = e;
    }
    expect(captured).toBeInstanceOf(ShareError);
    expect((captured as ShareError).code).toBe('TOKEN_INVALID');
  });

  // ─────────────────────────────────────────────────────────────
  // TC-INT-3 · PII 反向断言 (wire-level) · 字符串扫描 raw response body
  // ─────────────────────────────────────────────────────────────
  it('TC-INT-3 · wire response 不含 PII 字段名 (relation_id / student_email / original_image_url / sharer_student_id)', async () => {
    if (!backendReachable) {
      console.warn('Soft-skip: anonymous-service unreachable');
      return;
    }
    // raw fetch · 跳过 getShare wrapper 直接读 BE response body
    const resp = await fetch(`${ANON_URL}/api/share/probe-pii-${Date.now()}`, {
      signal: AbortSignal.timeout(5_000),
    });
    const raw = await resp.text();

    // 即使是错误响应 (404 TOKEN_INVALID) · BE 也不应回 PII 字段名 (审计敏感)
    expect(raw, 'wire 不含 PII relation_id').not.toContain('relation_id');
    expect(raw, 'wire 不含 PII sharer_student_id').not.toContain('sharer_student_id');
    expect(raw, 'wire 不含 PII student_email').not.toContain('student_email');
    expect(raw, 'wire 不含 PII original_image_url').not.toContain('original_image_url');
  });

  // ─────────────────────────────────────────────────────────────
  // TC-INT-4 · Cache-Control 响应头 (BE 强制 no-store · 令牌安全)
  // ─────────────────────────────────────────────────────────────
  it('TC-INT-4 · response Cache-Control: no-store (令牌安全 · BE 强制)', async () => {
    if (!backendReachable) {
      console.warn('Soft-skip: anonymous-service unreachable');
      return;
    }
    const resp = await fetch(`${ANON_URL}/api/share/probe-cache-${Date.now()}`, {
      signal: AbortSignal.timeout(5_000),
    });
    const cacheControl = resp.headers.get('cache-control') || '';
    expect(cacheControl.toLowerCase()).toContain('no-store');
  });
});
