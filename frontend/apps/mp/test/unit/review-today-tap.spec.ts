/**
 * T10 · Unit test · review-today tap → nid extraction + URL building
 * 0 mock backend · 0 HTTP · 纯逻辑 · 100% pass
 *
 * WHY: verifies that nid extraction from wx touch events is robust
 * (null/undefined/empty dataset) and that exec URL is correctly formed
 * with proper encoding. Catches regressions if dataset shape changes.
 */
import { describe, it, expect } from 'vitest';

import { extractNidFromTap, buildExecUrl } from '../../pages/review-today/helpers';

// ── extractNidFromTap ──────────────────────────────────────────

describe('extractNidFromTap', () => {
  it('extracts string nid from dataset', () => {
    const e = { currentTarget: { dataset: { nid: '1001' } } } as unknown as WechatMiniprogram.TouchEvent;
    expect(extractNidFromTap(e)).toBe('1001');
  });

  it('converts numeric nid to string', () => {
    const e = { currentTarget: { dataset: { nid: 42 } } } as unknown as WechatMiniprogram.TouchEvent;
    expect(extractNidFromTap(e)).toBe('42');
  });

  it('returns null for missing dataset', () => {
    const e = { currentTarget: { dataset: {} } } as unknown as WechatMiniprogram.TouchEvent;
    expect(extractNidFromTap(e)).toBeNull();
  });

  it('returns null for empty string nid', () => {
    const e = { currentTarget: { dataset: { nid: '' } } } as unknown as WechatMiniprogram.TouchEvent;
    expect(extractNidFromTap(e)).toBeNull();
  });

  it('returns null for null nid', () => {
    const e = { currentTarget: { dataset: { nid: null } } } as unknown as WechatMiniprogram.TouchEvent;
    expect(extractNidFromTap(e)).toBeNull();
  });

  it('returns null for undefined event', () => {
    expect(extractNidFromTap(undefined as unknown as WechatMiniprogram.TouchEvent)).toBeNull();
  });

  it('returns null when currentTarget missing', () => {
    const e = {} as unknown as WechatMiniprogram.TouchEvent;
    expect(extractNidFromTap(e)).toBeNull();
  });
});

// ── buildExecUrl ────────────────────────────────────────────────

describe('buildExecUrl', () => {
  it('builds correct URL with sid and nid', () => {
    const url = buildExecUrl('sess-abc', '1001');
    expect(url).toBe('/pages/review-exec/index?sid=sess-abc&nid=1001');
  });

  it('encodes special characters in sid', () => {
    const url = buildExecUrl('sid with spaces', '42');
    expect(url).toContain('sid=sid%20with%20spaces');
    expect(url).toContain('nid=42');
  });

  it('encodes special characters in nid', () => {
    const url = buildExecUrl('s1', 'n/1&2');
    expect(url).toContain('nid=n%2F1%262');
  });

  it('URL is parseable with URLSearchParams', () => {
    const url = buildExecUrl('sess-123', 'node-456');
    const [path, query] = url.split('?');
    expect(path).toBe('/pages/review-exec/index');
    const params = new URLSearchParams(query);
    expect(params.get('sid')).toBe('sess-123');
    expect(params.get('nid')).toBe('node-456');
  });
});
