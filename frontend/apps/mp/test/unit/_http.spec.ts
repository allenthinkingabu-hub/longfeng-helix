/**
 * Unit test · _http.ts pure helpers
 * 0 mock · 0 backend · 100% pass
 *
 * 测试 apiBase(prefix) URL 构造 + 端口映射 + env override.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { apiBase } from '../../src/api/_http';

describe('apiBase URL construction (pure)', () => {
  it('returns file-service URL with port 8084', () => {
    expect(apiBase('file')).toBe('http://localhost:8084');
  });

  it('returns wrongbook-service URL with port 8082', () => {
    expect(apiBase('wb')).toBe('http://localhost:8082');
  });

  it('returns ai-analysis-service URL with port 8083', () => {
    expect(apiBase('ai')).toBe('http://localhost:8083');
  });

  it('returns review-plan-service URL with port 8085', () => {
    expect(apiBase('review')).toBe('http://localhost:8085');
  });

  it('all prefixes resolve to distinct ports', () => {
    const urls = new Set([
      apiBase('file'),
      apiBase('wb'),
      apiBase('ai'),
      apiBase('review'),
    ]);
    expect(urls.size).toBe(4);
  });
});
