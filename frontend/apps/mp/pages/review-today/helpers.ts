// P07 · review-today · pure helpers (exported for unit test)
// Separated from index.ts to avoid Page() side-effect on import.

/**
 * Extract nid from a tap event's dataset.
 * Returns the string nid or null if missing.
 */
export function extractNidFromTap(e: WechatMiniprogram.TouchEvent): string | null {
  const nid = e?.currentTarget?.dataset?.nid;
  if (nid === undefined || nid === null || nid === '') return null;
  return String(nid);
}

/**
 * Build the transition URL for review-exec.
 * Mirrors H5 sibling: nav(`/review/exec/0?sid=${sid}`)
 */
export function buildExecUrl(sid: string, nid: string): string {
  return `/pages/review-exec/index?sid=${encodeURIComponent(sid)}&nid=${encodeURIComponent(nid)}`;
}
