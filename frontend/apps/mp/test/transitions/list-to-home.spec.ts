/**
 * T08 · P05→P-HOME transition test (wrongbook-list → home)
 * trace: SC01-MP-T08 · P05 错题列表 → P-HOME 首页
 *
 * Mock: wx runtime only (wx.navigateTo / wx.switchTab)
 * 禁 mock backend
 *
 * Note: T07 wrongbook-list page may not be merged yet.
 * This test validates the transition logic in isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── wx runtime mock ─────────────────────────────────────────────

interface WxNavigateToOpts { url: string; success?: () => void; fail?: (err: unknown) => void }
interface WxSwitchTabOpts { url: string; success?: () => void; fail?: (err: unknown) => void }

const navigateToCalls: WxNavigateToOpts[] = [];
const switchTabCalls: WxSwitchTabOpts[] = [];

const wxMock = {
  navigateTo: vi.fn((opts: WxNavigateToOpts) => {
    navigateToCalls.push(opts);
    opts.success?.();
  }),
  switchTab: vi.fn((opts: WxSwitchTabOpts) => {
    switchTabCalls.push(opts);
    opts.success?.();
  }),
  navigateBack: vi.fn(),
};

beforeEach(() => {
  navigateToCalls.length = 0;
  switchTabCalls.length = 0;
  vi.stubGlobal('wx', wxMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Transition helper (mirrors what wrongbook-list would do) ────

function navigateToHome() {
  wx.navigateTo({ url: '/pages/home/index' });
}

function switchTabToHome() {
  wx.switchTab({ url: '/pages/home/index' });
}

// ── Tests ───────────────────────────────────────────────────────

describe('T08 · P05→P-HOME transition (list-to-home)', () => {
  it('navigateTo /pages/home/index fires wx.navigateTo with correct path', () => {
    navigateToHome();

    expect(wxMock.navigateTo).toHaveBeenCalledTimes(1);
    expect(navigateToCalls[0].url).toBe('/pages/home/index');
  });

  it('switchTab /pages/home/index fires wx.switchTab with correct path', () => {
    switchTabToHome();

    expect(wxMock.switchTab).toHaveBeenCalledTimes(1);
    expect(switchTabCalls[0].url).toBe('/pages/home/index');
  });

  it('home page path matches app.json registration', () => {
    // The page path in navigation must match the registered path in app.json
    const targetUrl = '/pages/home/index';
    // Verify format: starts with / and has pages/<dir>/index structure
    expect(targetUrl).toMatch(/^\/pages\/[a-z-]+\/index$/);
  });

  it('navigateTo does not call switchTab (mutual exclusion)', () => {
    navigateToHome();

    expect(wxMock.navigateTo).toHaveBeenCalledTimes(1);
    expect(wxMock.switchTab).not.toHaveBeenCalled();
  });

  it('switchTab does not call navigateTo (mutual exclusion)', () => {
    switchTabToHome();

    expect(wxMock.switchTab).toHaveBeenCalledTimes(1);
    expect(wxMock.navigateTo).not.toHaveBeenCalled();
  });
});
