// ============================================================================
// SC-00-T01 · entry-source.ts · 入口来源探测 (P0)
// ============================================================================
// Source of truth: biz §2A.3.1 决策树节点 + biz §10.6 ResolveRequest.entrySource
//                  zod ResolveRequestSchema.entrySource (api-contracts/session-resolve.ts)
// Scope per inflight SC-00-T01-T02 scope_in #3:
//   解 URL params utm_source · 不在白名单一律 'unknown'
// ============================================================================

const ALLOWED = new Set<string>([
  'ad',
  'qr',
  'share',
  'push',
  'icon',
  'deeplink',
  'unknown',
]);

/**
 * Detect entry source from current URL's `utm_source` query param.
 *
 * Whitelist defence — anything not in {@link ALLOWED} collapses to `'unknown'`.
 * This keeps the server-side {@code entry_source} column free of attacker-injected
 * tag soup (analytics dashboards stay clean).
 *
 * SSR-safe: returns `'unknown'` if `window.location` is unavailable.
 */
export function detectEntrySource(): string {
  if (typeof window === 'undefined' || !window.location) return 'unknown';
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get('utm_source') || '').toLowerCase().trim();
    if (raw && ALLOWED.has(raw)) return raw;
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
