// MP HTTP client - dual runtime adapter
// wx runtime: wx.request | Node test runtime (vitest): global fetch
// Port map: file=8084 wb=8082 ai=8083 review=8085 s3=9000

declare const wx: any;
declare const process: { env: Record<string, string | undefined> };
declare function fetch(url: string, init?: RequestInit): Promise<Response>;
declare class AbortController { signal: AbortSignal; abort(): void; }
declare interface RequestInit { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal; }
declare interface Response { ok: boolean; status: number; statusText: string; json(): Promise<unknown>; }
declare interface AbortSignal {}

// MP runtime: `process` doesn't exist · guard with typeof. Node test runtime: read env var.
const BACKEND_HOST = (typeof process !== 'undefined' && process.env?.MP_BACKEND_HOST)
  || 'http://localhost';

const PORT_MAP: Record<string, number> = {
  file: 8084,
  wb: 8082,
  ai: 8083,
  review: 8085,
};

export function apiBase(prefix: 'file' | 'wb' | 'ai' | 'review'): string {
  return `${BACKEND_HOST}:${PORT_MAP[prefix]}`;
}

export interface HttpOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Auto-unwrap ApiResult envelope. Spring backend returns
 * `{ code: 0, message: "ok", data: {...} }`; FE callers only ever care about
 * `data`. If the response doesn't look like ApiResult, pass through.
 */
export function unwrapApiResult<T>(raw: unknown): T {
  if (
    raw !== null
    && typeof raw === 'object'
    && 'code' in raw
    && 'data' in raw
    && Object.keys(raw as object).every((k) => k === 'code' || k === 'message' || k === 'data')
  ) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

export async function httpJSON<T = unknown>(
  url: string,
  options: HttpOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers = {}, timeout = 10_000 } = options;
  // MP 还没有真鉴权 · capture (P02) hardcode studentId:1 写入 · 但所有 GET 接口
  // (today / list / 等) BE 用 @RequestHeader X-Student-Id 默认 0L 取 user · 这就
  // 导致用户拍的题在 student=1 下入库, 但读时 BE 用 student=0 查, 结果永远空。
  // 临时方案: 全局注入 X-Student-Id:1 · 与 capture body 对齐 · 真鉴权后再删此 fallback。
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Student-Id': '1',
    ...headers,
  };

  // MP runtime: 用 wx.request
  if (typeof wx !== 'undefined' && wx.request) {
    return new Promise<T>((resolve, reject) => {
      wx.request({
        url,
        method,
        data: body,
        header: baseHeaders,
        timeout,
        success: (res: { statusCode: number; data: unknown }) => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve(unwrapApiResult<T>(res.data));
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        },
        fail: (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))),
      });
    });
  }

  // Node test runtime: 用 fetch
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      method,
      headers: baseHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    return unwrapApiResult<T>(await resp.json());
  } finally {
    clearTimeout(t);
  }
}
