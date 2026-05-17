// ============================================================================
// SC-13 · Shared/api.ts · fetch GET /api/share/:shareToken with zod parse + timeout
// ============================================================================
// Source of truth:
//   biz §10.9 (3 错误码 410/403/404 + 200 ShareDto)
//   zod  frontend/packages/api-contracts/src/share.ts
//   backend/anonymous-service/.../controller/ShareController.java
// ============================================================================

import {
  ShareResponseSchema,
  ShareErrorSchema,
  type ShareResponse,
  type ShareError,
} from '@longfeng/api-contracts';

const FETCH_TIMEOUT_MS = 5000;

/**
 * Discriminated result · 前端 SharedView state machine 直接 switch 这个 kind.
 *
 * 关键: 网络错 (5xx / DNS / abort) 都映射到 'INVALID' · UI 兜底显示
 * 'token-invalid-screen' (per spec §9 第 4 行 fallback to INVALID).
 */
export type ShareFetchResult =
  | { kind: 'SUCCESS'; data: ShareResponse }
  | { kind: 'EXPIRED'; error: ShareError }
  | { kind: 'REVOKED'; error: ShareError }
  | { kind: 'INVALID'; error: ShareError };

/**
 * GET /api/share/:shareToken
 *
 * 行为合约:
 *   - 200 → parse ShareResponseSchema · 失败 → INVALID (drift 抓回归)
 *   - 410 → EXPIRED  · code=TOKEN_EXPIRED
 *   - 403 → REVOKED  · code=TOKEN_REVOKED
 *   - 404 → INVALID  · code=TOKEN_INVALID
 *   - 5xx / network → INVALID (fallback per spec §9 第 4 行)
 *   - timeout 5s → INVALID
 */
export async function fetchShare(shareToken: string): Promise<ShareFetchResult> {
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(`/api/share/${encodeURIComponent(shareToken)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (resp.status === 200) {
      const raw = (await resp.json()) as unknown;
      try {
        const parsed = ShareResponseSchema.parse(raw);
        return { kind: 'SUCCESS', data: parsed };
      } catch {
        // zod drift = 视为非法令牌 · 不静默 succeed
        return {
          kind: 'INVALID',
          error: { code: 'TOKEN_INVALID', message: '分享链接无效' },
        };
      }
    }

    // 错误态尝试 parse · 失败也兜底
    let parsedErr: ShareError | null = null;
    try {
      const errBody = (await resp.json()) as unknown;
      parsedErr = ShareErrorSchema.parse(errBody);
    } catch {
      parsedErr = null;
    }

    if (resp.status === 410) {
      return {
        kind: 'EXPIRED',
        error: parsedErr ?? { code: 'TOKEN_EXPIRED', message: '这个分享已过期' },
      };
    }
    if (resp.status === 403) {
      return {
        kind: 'REVOKED',
        error: parsedErr ?? { code: 'TOKEN_REVOKED', message: '分享者已撤销此分享' },
      };
    }
    if (resp.status === 404) {
      return {
        kind: 'INVALID',
        error: parsedErr ?? { code: 'TOKEN_INVALID', message: '分享链接无效' },
      };
    }
    // 5xx 或其它 · fallback INVALID
    return {
      kind: 'INVALID',
      error: { code: 'TOKEN_INVALID', message: '分享链接无效' },
    };
  } catch (e) {
    // abort / network → INVALID
    return {
      kind: 'INVALID',
      error: { code: 'TOKEN_INVALID', message: '分享链接无效' },
    };
  } finally {
    clearTimeout(handle);
  }
}
