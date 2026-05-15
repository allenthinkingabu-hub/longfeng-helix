// 小程序全局类型声明
interface IAppOption {
  globalData?: {
    userInfo?: WechatMiniprogram.UserInfo;
  };
}

// Node runtime globals for dual-runtime _http.ts (vitest path uses fetch)
declare const process: { env: Record<string, string | undefined> };
declare function fetch(url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
}>;
declare function setTimeout(cb: () => void, ms: number): number;
declare function clearTimeout(id: number): void;
declare function setInterval(cb: () => void, ms: number): number;
declare function clearInterval(id: number): void;

declare class AbortController {
  signal: AbortSignal;
  abort(): void;
}

declare interface AbortSignal {
  aborted: boolean;
  static timeout(ms: number): AbortSignal;
}
