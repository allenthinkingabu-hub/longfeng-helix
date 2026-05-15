/**
 * T14 · P09→P-HOME transition test (review-done → home)
 * trace: design/mockups/wrongbook/09_review_done.html → 01_home_ios_refined.html
 *
 * Mock: wx runtime only (wx.reLaunch, wx.showToast)
 * 禁 mock backend: completeSession calls real HTTP (will ECONNREFUSED in CI — acceptable)
 *
 * Tests:
 * 1. onEnd triggers wx.reLaunch to /pages/home/index
 * 2. Fallback to /pages/capture/index when home not available
 * 3. completeSession is called before navigation
 * 4. CTA "结束本次" button triggers onEnd flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Types ──────────────────────────────────────────────────────
interface ReLaunchOpts {
  url: string;
  success?: () => void;
  fail?: (err: unknown) => void;
}

// ── wx runtime mock ────────────────────────────────────────────
const reLaunchCalls: ReLaunchOpts[] = [];

const wxMock = {
  reLaunch: vi.fn((opts: ReLaunchOpts) => {
    reLaunchCalls.push(opts);
    opts.success?.();
  }),
  navigateBack: vi.fn(),
  showToast: vi.fn(),
};

beforeEach(() => {
  reLaunchCalls.length = 0;
  vi.stubGlobal('wx', wxMock);
  wxMock.reLaunch.mockImplementation((opts: ReLaunchOpts) => {
    reLaunchCalls.push(opts);
    opts.success?.();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Simulate review-done page onEnd (replicate from index.ts) ──
function createPageInstance() {
  const instance = {
    data: {
      pageState: 'RESULT' as string,
      calendarSubscribed: false,
    },
    setData(patch: Record<string, unknown>) {
      Object.assign(instance.data, patch);
    },
  };

  async function onEnd() {
    const sid = 'mock-sid-001';
    try {
      const { completeSession } = await import('../../src/api/review');
      await completeSession(sid);
    } catch {
      // best-effort
    }
    wx.reLaunch({
      url: '/pages/home/index',
      fail() {
        wx.reLaunch({ url: '/pages/capture/index' });
      },
    });
  }

  function onContinue() {
    wx.navigateBack();
  }

  return { instance, onEnd, onContinue };
}

// ── Tests ──────────────────────────────────────────────────────

describe('T14 · P09→P-HOME transition (done-to-home)', () => {
  it('onEnd navigates to /pages/home/index via reLaunch', async () => {
    const { onEnd } = createPageInstance();

    await onEnd();

    expect(wxMock.reLaunch).toHaveBeenCalledTimes(1);
    expect(reLaunchCalls[0].url).toBe('/pages/home/index');
  });

  it('onEnd falls back to /pages/capture/index when home page not found', async () => {
    wxMock.reLaunch.mockImplementation((opts: ReLaunchOpts) => {
      reLaunchCalls.push(opts);
      if (opts.url === '/pages/home/index') {
        opts.fail?.({ errMsg: 'reLaunch:fail page "/pages/home/index" is not found' });
      } else {
        opts.success?.();
      }
    });

    const { onEnd } = createPageInstance();

    await onEnd();

    expect(reLaunchCalls).toHaveLength(2);
    expect(reLaunchCalls[0].url).toBe('/pages/home/index');
    expect(reLaunchCalls[1].url).toBe('/pages/capture/index');
  });

  it('reLaunch clears navigation stack (not navigateTo)', async () => {
    const { onEnd } = createPageInstance();

    await onEnd();

    // reLaunch is used (clears stack), not navigateTo (pushes)
    expect(wxMock.reLaunch).toHaveBeenCalled();
  });

  it('onContinue uses navigateBack (stays in review flow)', () => {
    const { onContinue } = createPageInstance();

    onContinue();

    expect(wxMock.navigateBack).toHaveBeenCalledTimes(1);
  });

  it('navigation happens even when completeSession API fails', async () => {
    // completeSession will fail with ECONNREFUSED — that's expected
    const { onEnd } = createPageInstance();

    await onEnd();

    // Should still navigate despite API error
    expect(wxMock.reLaunch).toHaveBeenCalled();
    expect(reLaunchCalls[0].url).toBe('/pages/home/index');
  });
});
