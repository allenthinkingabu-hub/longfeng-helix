/**
 * MP HTTP client · 双 runtime adapter
 * - 微信小程序运行时: 用 wx.request
 * - Node 测试运行时 (vitest): 用 global fetch
 *
 * 这层抽象保证 api/*.ts 业务模块代码相同，pages/*/index.ts 真 MP runtime 调真 wx.request，
 * test/api/*.integration.spec.ts vitest 跑接真 backend port (无 wx · 用 fetch)。
 *
 * Backend port map (vite.config.ts 对齐):
 * - /api/file  → http://localhost:8084 (file-service)
 * - /api/wb    → http://localhost:8082 (wrongbook-service)
 * - /api/ai    → http://localhost:8083 (ai-analysis-service)
 * - /api/review→ http://localhost:8085 (review-plan-service)
 * - /s3        → http://localhost:9000 (MinIO)
 */

declare const wx: any;

const BACKEND_HOST = process.env.MP_BACKEND_HOST || 'http://localhost';

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

export async function httpJSON<T = unknown>(
  url: string,
  options: HttpOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers = {}, timeout = 10_000 } = options;
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
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
        success: (res: { statusCode: number; data: T }) => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve(res.data);
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
    return (await resp.json()) as T;
  } finally {
    clearTimeout(t);
  }
}
