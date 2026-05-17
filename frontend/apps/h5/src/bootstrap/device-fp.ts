// ============================================================================
// SC-00-T01 · device-fp.ts · 简版设备指纹 (P0)
// ============================================================================
// Source of truth: biz §2A.3.1 决策树节点 1 + biz §4.13 account_device.device_fp
// Scope per inflight SC-00-T01-T02 scope_in #2:
//   P0 简版: navigator.userAgent + screen.width + screen.height + tzOffset + UUID
//   持久化 localStorage.deviceFp (一次生成永不变,直到用户手动清缓存)
//   P1 强化 (SC-12 P-GUEST-CAPTURE): Canvas + IndexedDB 复合指纹 (本 task 不做)
// ============================================================================

const STORAGE_KEY = 'deviceFp';

/**
 * Returns the per-browser device fingerprint. Cached in localStorage so the
 * value is stable across sessions on the same browser profile.
 *
 * Format: `${uaHash16}-${w}x${h}-${tz}-${uuidShort}`  (URL-safe, ≤ 64 chars)
 *
 * SSR-safe: if `window`/`localStorage` is unavailable (server prerender), a
 * deterministic placeholder is returned. Callers MUST treat this as advisory
 * — real anti-abuse must happen server-side anyway.
 */
export function getOrCreateDeviceFp(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'ssr-no-fp';
  }

  let fp = '';
  try {
    fp = localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    // localStorage access denied (Safari private mode etc.) — fall through
  }
  if (fp) {
    return fp;
  }

  const ua = (navigator.userAgent || '').slice(0, 128);
  const w = window.screen?.width ?? 0;
  const h = window.screen?.height ?? 0;
  const tz = new Date().getTimezoneOffset(); // minutes west of UTC
  const uuid = makeUuid();

  const uaHash = simpleHash(ua).toString(36).padStart(8, '0').slice(0, 8);
  fp = `${uaHash}-${w}x${h}-${tz}-${uuid.slice(0, 8)}`;

  try {
    localStorage.setItem(STORAGE_KEY, fp);
  } catch {
    // ignore — fingerprint is still usable for this session even if storage failed
  }
  return fp;
}

/** Tiny non-cryptographic FNV-1a hash. We only need a stable string, not security. */
function simpleHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Prefer `crypto.randomUUID()` when available, fall back to a v4-ish polyfill. */
function makeUuid(): string {
  const c: Crypto | undefined =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto : undefined;
  if (c) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
