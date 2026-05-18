/**
 * SC-13 share API · 调 anonymous-service :8090
 *
 * trace:
 * - design/system/pages/P-SHARED-shared.spec.md §5 (GET /api/share/:shareToken)
 * - biz §10.9 接口契约 (3 错误码 410/403/404)
 * - biz §2B.14 SC-13 P-SHARED 接收方流程
 * - backend/anonymous-service ShareController.java + ShareDto.java + MaskedPayloadDto.java
 *
 * 脱敏铁律 (Wire-level enforcement):
 * - 字段白名单仅 5 个 top-level: type / sharerNickMasked / ttlSec / signatureValid / maskedPayload
 * - maskedPayload 仅 4 字段: stemSnippet / kpVisible / kpLockedCount / imgThumbBlurred
 * - 后端已强保证 (ShareDto + MaskedPayloadDto · SC13ShareE2EIT.response_no_pii_fields 反向断言)
 * - 前端不主动解析也不渲染 PII 字段 (relation_id / sharer_student_id / student_email / original_image_url)
 * - e2e shared.spec.ts 用字符串扫描 wire response 做兜底验证
 *
 * 错误码映射 (spec §6 状态机 + §9 异常):
 *   200 → READY    · ShareSuccessResponse 返回
 *   410 → EXPIRED  · throw ShareError{code:'TOKEN_EXPIRED'}
 *   404 → INVALID  · throw ShareError{code:'TOKEN_INVALID'}
 *   403 → REVOKED  · throw ShareError{code:'TOKEN_REVOKED'}
 *   其它 → INVALID · 兜底 fallback (5xx / network)
 *
 * Cache-Control: no-store 由 backend 在响应头加 (令牌安全 · biz §2B.14)
 * 前端 wx.request 不缓存 token 返回值 · 每次 onLoad 都真调一次。
 */
import { apiBase } from './_http';

// ── Wire types (镜像 ShareDto.java + MaskedPayloadDto.java) ─────────────

export interface MaskedPayload {
  /** 题干前 12 字明文 · 后面 mask · 永不下发完整原文 */
  stemSnippet: string;
  /** 前 2 个知识点名 · 余下被锁 */
  kpVisible: string[];
  /** 剩余知识点数 · 用户登录后才能解锁 */
  kpLockedCount: number;
  /** 原图是否磨砂 · true=显示 lock 遮罩, false=无原图 */
  imgThumbBlurred: boolean;
}

export interface ShareResponse {
  /** EXAM_DAY / QUESTION / REVIEW_NODE */
  type: 'EXAM_DAY' | 'QUESTION' | 'REVIEW_NODE';
  /** "Z***" — 单字符首 + 3 ★ · 不下发真姓名/student_id */
  sharerNickMasked: string;
  /** 剩余秒数 · 由 expires_at - now() 算出 · 不下发 expires_at 原值 */
  ttlSec: number;
  /** HS256 验签结果 · true 表示令牌真实未篡改 */
  signatureValid: boolean;
  /** 脱敏 payload (字段白名单) */
  maskedPayload: MaskedPayload;
}

export type ShareErrorCode = 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'TOKEN_REVOKED';

export class ShareError extends Error {
  readonly code: ShareErrorCode;
  readonly httpStatus: number;
  constructor(code: ShareErrorCode, httpStatus: number, message?: string) {
    super(message ?? code);
    this.name = 'ShareError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// ── wx.request / fetch 双 runtime adapter (本地 · 不复用 _http.ts 因为它不暴露 statusCode) ──

declare const wx: {
  request(opts: {
    url: string;
    method?: string;
    header?: Record<string, string>;
    timeout?: number;
    success?: (res: { statusCode: number; data: unknown }) => void;
    fail?: (err: unknown) => void;
  }): void;
};
declare function fetch(url: string, init?: { method?: string; headers?: Record<string, string>; signal?: unknown }): Promise<{ ok: boolean; status: number; statusText: string; json(): Promise<unknown> }>;

/**
 * 把 HTTP statusCode 映射到 ShareError code (spec §9 异常表 + §6 状态机).
 * 不抛 200 (成功路径由调用方处理).
 */
function statusToErrorCode(status: number): ShareErrorCode {
  if (status === 410) return 'TOKEN_EXPIRED';
  if (status === 403) return 'TOKEN_REVOKED';
  if (status === 404) return 'TOKEN_INVALID';
  // 5xx / network / 其它 → INVALID 挡板 (spec §9 网络异常 5xx fallback INVALID)
  return 'TOKEN_INVALID';
}

/**
 * GET /api/share/:shareToken
 *
 * Cache-Control: no-store 由 backend 强制 (request header 不强制必加 · BE 不依赖)
 * 前端按 wx.request / fetch 双 runtime · 自己解析 statusCode 走 4 态分支。
 *
 * @throws {ShareError} 当 statusCode ≠ 200 (mapping 见 §9)
 */
export async function getShare(shareToken: string): Promise<ShareResponse> {
  const url = `${apiBase('anon')}/api/share/${encodeURIComponent(shareToken)}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    // request 端不缓存 · BE 响应头会带 no-store · 双向显式
    'Cache-Control': 'no-store',
  };

  // MP runtime: wx.request
  if (typeof wx !== 'undefined' && wx.request) {
    return new Promise<ShareResponse>((resolve, reject) => {
      wx.request({
        url,
        method: 'GET',
        header: headers,
        timeout: 10_000,
        success: (res: { statusCode: number; data: unknown }) => {
          if (res.statusCode === 200) {
            resolve(res.data as ShareResponse);
          } else {
            reject(new ShareError(statusToErrorCode(res.statusCode), res.statusCode));
          }
        },
        fail: (err: unknown) => {
          // 网络层失败 (DNS / timeout / abort) → fallback INVALID
          reject(new ShareError('TOKEN_INVALID', 0, err instanceof Error ? err.message : String(err)));
        },
      });
    });
  }

  // Node test runtime: fetch (only used in vitest unit/api tests)
  const resp = await fetch(url, { method: 'GET', headers });
  if (resp.status === 200) {
    return (await resp.json()) as ShareResponse;
  }
  throw new ShareError(statusToErrorCode(resp.status), resp.status, resp.statusText);
}
