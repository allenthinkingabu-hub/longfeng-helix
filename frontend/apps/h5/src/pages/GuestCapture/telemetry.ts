// ============================================================================
// SC-12-T03 · P-GUEST-CAPTURE 真页 telemetry · device_fp + entry_source + beacon
// ============================================================================
//
// Source of truth:
//   biz §2A.3.2 P-GUEST-CAPTURE 规格卡 (埋点字典)
//   biz §2B.13 SC-12 F01 (anon_guest_capture_view) + F02 (anon_guest_consent)
//   spec design/system/pages/P-GUEST-CAPTURE-guest-capture.spec.md §12
//
// 设计决策:
//   (1) device_fp 用 djb2 hash 的 navigator.userAgent + language + screen 三件套 ·
//       与 SC-11 Landing telemetry 同 family (但本页 mount 前未必走过 Landing ·
//       所以这里独立计算 · 不依赖 Landing 的 localStorage 'device_fp' 缓存).
//   (2) entry_source 严格白名单 (与 Landing 同一份) · 任意非白名单值 → 'unknown'.
//   (3) trackGuestCapture 优先 navigator.sendBeacon · fallback fetch + keepalive.
//       同时 console.log 镜像 (Playwright spy / DevTools 调试).
//   (4) 埋点接口 P0 仅 stub (POST /api/anon/track) · 后端 SC-12 后续接 ·
//       本 util 调用即使 server 不存在也不抛 (catch 静默).
// ============================================================================

/**
 * entry_source 白名单. 与 Landing/telemetry.ts 同步 (biz §10.7 扩展).
 * 任意非白名单值 (含 null/undefined/空串/XSS payload/超长/数字) 一律 'unknown'.
 */
const ENTRY_SOURCE_WHITELIST: ReadonlySet<string> = new Set([
  'ad',
  'qr',
  'share',
  'push',
  'icon',
  'deeplink',
  'unknown',
]);

/**
 * 净化 entry_source. 非白名单 → 'unknown'.
 *
 * 与 Landing/telemetry.ts 同算法 (严格等值 · 不 trim · 不 lowercase · 不正则).
 * URL query 来源不可信 · 防 XSS 关键卡口.
 */
export function sanitizeEntrySource(raw: unknown): string {
  if (typeof raw !== 'string') return 'unknown';
  if (ENTRY_SOURCE_WHITELIST.has(raw)) return raw;
  return 'unknown';
}

/** djb2 hash · 非加密 · 仅用于 fingerprint 短串 (与 Landing telemetry 同 family). */
function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    // hash * 33 + c
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * 计算 device fingerprint. 简易非加密 · 仅做匿名 mapping.
 *
 * inputs: navigator.userAgent + navigator.language + screen.width x height +
 *         devicePixelRatio.
 * 走 djb2 (与 SC-11 Landing telemetry 同 family) · 不写 localStorage (本页
 * 是入口页 · 不需要跨刷新稳定; 后端用 deviceFp 做 day-level 配额 key · 同浏览器
 * 同设备短期内稳定即可).
 */
export function computeDeviceFp(): string {
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const lang = typeof navigator !== 'undefined' ? navigator.language : '';
    const w = typeof screen !== 'undefined' ? screen.width : 0;
    const h = typeof screen !== 'undefined' ? screen.height : 0;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return 'fp-' + djb2(`${ua}|${lang}|${w}x${h}|${dpr}`);
  } catch {
    return 'fp-unavailable';
  }
}

/**
 * SC-12-T10 telemetry event names (extended).
 * Used by GuestCapture index.tsx in the full real-page flow.
 */
export const GUEST_EVENTS = {
  view: 'anon_guest_capture_view',
  consent: 'anon_guest_consent',
  shoot: 'anon_guest_capture_shoot',
  analyzeStart: 'anon_guest_analyze_start',
  analyzeDone: 'anon_guest_analyze_done',
  quotaExhausted: 'anon_guest_quota_exhausted',
  ctaSave: 'anon_guest_cta_save',
  error: 'anon_guest_error',
} as const;

/** 上报 payload shape (三件套 + 自定义 props). */
export interface GuestCaptureTelemetryPayload {
  event: string;
  ts: number;
  [key: string]: unknown;
}

const TRACK_ENDPOINT = '/api/anon/track';

/**
 * 上报 P-GUEST-CAPTURE 埋点事件.
 *
 * 流程 (与 Landing/telemetry.ts 同 pattern):
 *   1. 自动注入 ts (调用方应自行带 device_fp / entry_source / consent_type 等)
 *   2. console.log 镜像 (Playwright spy 抓 payload · 不依赖 server)
 *   3. 优先 navigator.sendBeacon (Blob application/json)
 *   4. fallback fetch + keepalive
 *   5. 全程 try-catch · 后端 stub 不存在也不抛
 */
export function trackGuestCapture(
  event: string,
  props: Record<string, unknown> = {},
): void {
  const payload: GuestCaptureTelemetryPayload = {
    ...props,
    event,
    ts: Date.now(),
  };

  // 镜像到 console (test spy hook · 也方便 DevTools 调试)
  try {
    // eslint-disable-next-line no-console
    console.log(event, payload);
  } catch {
    /* ignore */
  }

  // 优先 sendBeacon (pagehide 安全 · 后台稳)
  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function'
    ) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: 'application/json',
      });
      const ok = navigator.sendBeacon(TRACK_ENDPOINT, blob);
      if (ok) return;
    }
  } catch {
    /* sendBeacon throw · fallback fetch */
  }

  // Fallback: fetch + keepalive
  try {
    if (typeof fetch === 'function') {
      fetch(TRACK_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {
        /* 静默 · stub 不存在常态 */
      });
    }
  } catch {
    /* 浏览器不支持 fetch · 放弃上报 */
  }
}
