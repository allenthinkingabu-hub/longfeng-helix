// 小程序全局类型声明
interface IAppOption {
  globalData?: {
    userInfo?: WechatMiniprogram.UserInfo;
  };
}

// Node runtime globals (used by _http.ts fetch fallback path for vitest)
declare const process: { env: Record<string, string | undefined> };
declare function fetch(url: string, init?: RequestInit): Promise<Response>;
declare class AbortController {
  signal: AbortSignal;
  abort(): void;
}
interface RequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}
interface Response {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<any>;
}
interface AbortSignal {}

