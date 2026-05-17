// ============================================================================
// SC-11-T04 · P-LANDING telemetry · 埋点 + 安全 util (sanitize + sendBeacon)
// ============================================================================
//
// Source of truth:
//   biz §2A.3.2  P-LANDING 埋点字典 (anon_landing_view/cta_try/cta_login/bounce)
//   biz §2B.12   F07A/B/C (双 CTA + bounce pagehide)
//   inflight.context.scope_in #4 (a-c)
//
// 设计决策:
//   (1) entry_source 严格白名单 · 非白名单 (含 XSS payload / 空串 / 数字 / 超长)
//       一律 sanitize 成 'unknown' — TC-11.05 安全断言点
//   (2) trackLanding 优先用 navigator.sendBeacon (pagehide 安全 · 后台稳)
//       fallback fetch + keepalive (老浏览器或 sendBeacon === false 时)
//       同时镜像 console.log · 让 Playwright spy 能拿到 payload
//   (3) sendBeacon 不支持 application/json content-type — 必须用 Blob 包 JSON
//       (规避被浏览器自动当 form-data 解析的兼容性陷阱)
//   (4) 埋点接口 P0 仅 stub · 后端 POST /api/landing/track 由 SC-12 后续接 ·
//       本 util 调用即使 server 不存在也不抛 (catch 静默)
// ============================================================================

/**
 * entry_source 白名单. 来自 biz §10.7 扩展 (UTM 来源类型).
 * 任意非白名单值 (包括 null / undefined / 空串 / 含 XSS / 超长字符串 / 数字)
 * 全标 'unknown'. 这是 P-LANDING 唯一接受用户 URL query 的入口 · 防 XSS 关键卡口.
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
 * 关键安全考量:
 *   - URL query 来源不可信 · 直接用 ?entry_source=<script>... 注入风险
 *   - 不做 trim / lowercase / partial match · 必须**严格等值**匹配白名单
 *   - 任意 raw type (string / null / undefined / number / object) 都接受 ·
 *     非 string 一律 'unknown' (不抛错)
 *
 * @param raw URLSearchParams.get('entry_source') 的原始返回值 (可能是 string|null)
 *            也兼容 unknown 类型 (调用方传 object / number 等情况)
 * @returns 7 个白名单成员之一 · 永不返回任意用户输入字符串
 */
export function sanitizeEntrySource(raw: unknown): string {
  if (typeof raw !== 'string') return 'unknown';
  // string 也要严格等值 — 不 trim · 不 lowercase · 不正则.
  // 白名单都是 ASCII 小写短串 · 任何额外字符 (空格 / 大写 / Unicode) 都判 unknown.
  if (ENTRY_SOURCE_WHITELIST.has(raw)) return raw;
  return 'unknown';
}

/**
 * 取 device_fp. 复用 SC-00-T03 已落地的浏览器指纹 (localStorage cache).
 * 不存在则生成一个非加密 hex 短串 (P0 满足 mapping · P1 真接 fingerprintjs).
 */
function getDeviceFp(): string {
  try {
    const cached = localStorage.getItem('device_fp');
    if (cached) return cached;
    // 简易生成 · 非加密 · 仅作匿名 mapping
    const fp =
      'dfp-' +
      Math.random().toString(36).slice(2, 10) +
      Date.now().toString(36).slice(-4);
    localStorage.setItem('device_fp', fp);
    return fp;
  } catch {
    return 'dfp-unavailable';
  }
}

/**
 * 取 experiment_bucket · A/B 桶. P0 从 URL ?ab= 读取 · 默认 'try_first'.
 * P1 接 GrowthBook / Sentry feature flag 时这里替换实现.
 */
export function getExperimentBucket(): 'try_first' | 'login_first' {
  try {
    const url = new URL(window.location.href);
    const ab = url.searchParams.get('ab');
    if (ab === 'login_first') return 'login_first';
  } catch {
    /* SSR / 非浏览器 · 走默认 */
  }
  return 'try_first';
}

/**
 * 净化 + 取 entry_source. URL ?entry_source=... 走白名单 · 非法值标 'unknown'.
 */
export function readEntrySource(): string {
  try {
    const url = new URL(window.location.href);
    return sanitizeEntrySource(url.searchParams.get('entry_source'));
  } catch {
    return 'unknown';
  }
}

/** 内部: 上报 payload shape (三件套 + 自定义 props). */
export interface LandingTelemetryPayload {
  event: string;
  device_fp: string;
  entry_source: string;
  experiment_bucket: string;
  ts: number;
  [key: string]: unknown;
}

const TRACK_ENDPOINT = '/api/landing/track';

/**
 * 上报 landing 埋点事件.
 *
 * 流程:
 *   1. 自动注入 device_fp + entry_source (净化值) + experiment_bucket + ts
 *   2. console.log 镜像 (Playwright spy 抓 payload · 不依赖 server)
 *   3. 优先 navigator.sendBeacon (pagehide / unload 场景靠谱 · iOS Safari OK)
 *   4. fallback fetch + keepalive (老浏览器 / sendBeacon 失败)
 *   5. 全程 try-catch · 后端 stub 不存在也不抛
 *
 * 安全:
 *   - props 里若有 entry_source 字段会被三件套**覆盖** (防调用方传脏值)
 *   - 不做 props 字段白名单 (业务方自由扩展 · 但服务端必须做白名单)
 *
 * @param event 事件名 (snake_case · 如 anon_landing_view)
 * @param props 业务自定义字段 (会被三件套合并 · 三件套优先级高)
 */
export function trackLanding(
  event: string,
  props: Record<string, unknown> = {},
): void {
  const payload: LandingTelemetryPayload = {
    ...props,
    event,
    device_fp: getDeviceFp(),
    entry_source: readEntrySource(),
    experiment_bucket: getExperimentBucket(),
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
      // sendBeacon 不支持 application/json content-type — Blob 包裹保留 type
      const blob = new Blob([JSON.stringify(payload)], {
        type: 'application/json',
      });
      const ok = navigator.sendBeacon(TRACK_ENDPOINT, blob);
      if (ok) return; // 投递成功 (浏览器队列已接收)
      // 浏览器拒绝 (e.g. payload too large) → fallback
    }
  } catch {
    /* sendBeacon throw · fallback fetch */
  }

  // Fallback: fetch + keepalive (Chrome 71+ / Safari 14+)
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
    /* 浏览器不支持 fetch · 放弃上报 (P0 stub · 不阻塞业务) */
  }
}
