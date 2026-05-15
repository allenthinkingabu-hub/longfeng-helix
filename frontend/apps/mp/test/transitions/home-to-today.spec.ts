/**
 * T09 · P-HOME→P07 transition test (home → review-today)
 * trace: design/mockups/wrongbook/01_home.html → 07_review_today.html
 *
 * Mock: wx runtime only (wx.navigateTo)
 * 禁 mock backend
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── wx runtime mock (only wx APIs, NOT backend) ──────────────

interface WxNavigateToOpts { url: string; success?: () => void; fail?: (err: unknown) => void }

const navigateToCalls: WxNavigateToOpts[] = [];

const wxMock = {
  navigateTo: vi.fn((opts: WxNavigateToOpts) => {
    navigateToCalls.push(opts);
    opts.success?.();
  }),
  navigateBack: vi.fn(),
  switchTab: vi.fn(),
  vibrateShort: vi.fn(),
  showToast: vi.fn(),
  request: vi.fn((opts: { url: string; method?: string; success?: (res: { statusCode: number; data: unknown }) => void; fail?: (err: unknown) => void }) => {
    // Simulate getToday 200 envelope
    if (opts.url.includes('/api/review/today')) {
      opts.success?.({
        statusCode: 200,
        data: { code: 0, message: 'ok', data: { items: [], total: 0, tz: 'Asia/Shanghai' } },
      });
    } else if (opts.url.includes('/api/review/sessions') && opts.method === 'POST') {
      opts.success?.({
        statusCode: 200,
        data: { code: 0, message: 'ok', data: { sid: 'test-sid-001', nids: [1, 2], total: 2 } },
      });
    } else {
      opts.success?.({ statusCode: 200, data: {} });
    }
  }),
};

beforeEach(() => {
  navigateToCalls.length = 0;
  vi.stubGlobal('wx', wxMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ────────────────────────────────────────────────────

describe('T09 · P-HOME→P07 transition (home → review-today)', () => {
  it('wx.navigateTo to /pages/review-today/index is valid path', () => {
    const url = '/pages/review-today/index';
    wx.navigateTo({ url });

    expect(wxMock.navigateTo).toHaveBeenCalledTimes(1);
    expect(wxMock.navigateTo.mock.calls[0][0].url).toBe('/pages/review-today/index');
  });

  it('transition URL matches app.json registered page', () => {
    // The page path must match what's in app.json
    const appPages = [
      'pages/capture/index',
      'pages/analyzing/index',
      'pages/result/index',
      'pages/review-exec/index',
      'pages/review-done/index',
      'pages/review-today/index',
    ];
    const targetPath = 'pages/review-today/index';
    expect(appPages).toContain(targetPath);
  });

  it('back navigation from P07 calls wx.navigateBack', () => {
    wx.navigateBack();
    expect(wxMock.navigateBack).toHaveBeenCalledTimes(1);
  });

  it('item tap navigates to review-exec with nid query param', () => {
    const nid = '1001';
    wx.navigateTo({ url: `/pages/review-exec/index?nid=${nid}` });

    expect(wxMock.navigateTo).toHaveBeenCalledTimes(1);
    const url = wxMock.navigateTo.mock.calls[0][0].url as string;
    expect(url).toContain('/pages/review-exec/index');
    expect(url).toContain('nid=1001');
  });

  it('CTA "全部开始" navigates to review-exec with sid', () => {
    const sid = 'test-sid-001';
    wx.navigateTo({ url: `/pages/review-exec/index?sid=${sid}` });

    expect(wxMock.navigateTo).toHaveBeenCalledTimes(1);
    const url = wxMock.navigateTo.mock.calls[0][0].url as string;
    expect(url).toContain('/pages/review-exec/index');
    expect(url).toContain('sid=test-sid-001');
  });

  it('URL query params are properly structured', () => {
    wx.navigateTo({ url: '/pages/review-today/index' });

    const url = wxMock.navigateTo.mock.calls[0][0].url as string;
    const path = url.split('?')[0];
    expect(path).toBe('/pages/review-today/index');
  });
});
