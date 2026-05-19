// MP HTTP client - dual runtime adapter
// wx runtime: wx.request | Node test runtime (vitest): global fetch
// Port map: file=8084 wb=8082 ai=8083 review=8085 anon=8090 auth=8091 calendar=18080 s3=9000

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
  anon: 8090,
  auth: 8091,
  // 2026-05-18 P10 task: 加 calendar 通道 · 接 calendar-core (server.port=18080).
  calendar: 18080,
};

export function apiBase(prefix: 'file' | 'wb' | 'ai' | 'review' | 'anon' | 'auth' | 'calendar'): string {
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

/**
 * 数据隔离 · 从 wx.getStorageSync('userId') 取真登录态 student id ·
 * 之前硬编码 '1' 导致全用户共看 student#1 数据.
 *
 * 两套 header 共存 · 不同 BE 服务读不同 header 名:
 *   - wrongbook-service (8082): @RequestHeader("X-Student-Id")
 *   - review-plan-service (8085): @RequestHeader("X-User-Id")  (USER_ID_HEADER)
 *   - file-service (8084): 不要 user 信息 (但带也无害)
 *
 * userId 缺失时返 '0' · BE 用 defaultValue=0 会查不到数据 · 显空状态 (而不是别人数据).
 * 已登录态 (P00 onLogin 写入 'userId') 自动注入真 id.
 * 调用方仍可在 options.headers 显式覆盖 (优先级最高).
 */
function _currentUserIdForHeader(): string {
  if (typeof wx === 'undefined' || !wx.getStorageSync) return '0';
  try {
    const id = wx.getStorageSync('userId');
    return id ? String(id) : '0';
  } catch {
    return '0';
  }
}

export async function httpJSON<T = unknown>(
  url: string,
  options: HttpOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers = {}, timeout = 10_000 } = options;
  const sid = _currentUserIdForHeader();
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Student-Id': sid,
    'X-User-Id': sid,
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
