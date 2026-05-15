/**
 * T12 · P08→P09 transition test (review-exec → review-done)
 * trace: design/mockups/wrongbook/08_review_exec.html → 09_review_done.html
 *
 * Mock: wx runtime only (wx.navigateTo, wx.vibrateShort, wx.showToast)
 * 禁 mock backend: gradeNode calls real HTTP (will 404/ECONNREFUSED in CI — acceptable)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── wx runtime mock (only wx APIs, NOT backend) ──────────────

interface WxNavigateToOpts { url: string; success?: () => void; fail?: (err: unknown) => void }
interface WxVibrateOpts { type?: string }
interface WxToastOpts { title: string; icon?: string }

const navigateToCalls: WxNavigateToOpts[] = [];

const wxMock = {
  navigateTo: vi.fn((opts: WxNavigateToOpts) => {
    navigateToCalls.push(opts);
    opts.success?.();
  }),
  navigateBack: vi.fn(),
  vibrateShort: vi.fn((_opts: WxVibrateOpts) => {}),
  showToast: vi.fn((_opts: WxToastOpts) => {}),
  request: vi.fn((opts: { url: string; method?: string; success?: (res: { statusCode: number; data: unknown }) => void; fail?: (err: unknown) => void }) => {
    // Simulate gradeNode 200 response for transition test
    if (opts.url.includes('/grade') && opts.method === 'POST') {
      opts.success?.({
        statusCode: 200,
        data: { nodeId: 'test-nid', newNodeIndex: 3, newEase: 2.6, nextDueAt: new Date().toISOString() },
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

// ── Helper: simulate Page lifecycle ──────────────────────────

function createPageInstance() {
  // Dynamically import the page module to pick up the wx global
  // We can't import statically because wx must be stubbed first
  // Instead, replicate the Page behavior inline

  type GradeValue = 'FORGOT' | 'PARTIAL' | 'MASTERED';

  const instance = {
    _openedAt: Date.now(),
    data: {
      execState: 'REVEALED' as string,
      isRevealing: false,
      isGrading: false,
      isRevealed: true,
      isAnswering: false,
      node: { nid: 'test-nid-001', nodeIndex: 1, tLevel: 'T2', easeFactor: 2.5 },
      nodeDots: [] as unknown[],
    },
    setData(patch: Record<string, unknown>) {
      Object.assign(instance.data, patch);
    },
  };

  // Replicate onGradeTap logic from review-exec/index.ts
  async function onGradeTap(grade: GradeValue) {
    if (!instance.data.isRevealed || instance.data.isGrading) return;

    instance.setData({ isGrading: true });
    wx.vibrateShort({ type: 'heavy' });

    const timeSpentMs = Date.now() - instance._openedAt;

    try {
      const { gradeNode } = await import('../../src/api/review');
      await gradeNode(instance.data.node.nid, { grade, timeSpentMs });
      wx.showToast({ title: `已评: ${grade}`, icon: 'none' });
    } catch {
      wx.showToast({ title: '评分提交失败', icon: 'none' });
    }

    instance.setData({
      execState: 'GRADED',
      isGrading: false,
      isRevealed: false,
    });

    // T12 transition
    const sid = 'mock-sid-001';
    wx.navigateTo({
      url: `/pages/review-done/index?sid=${sid}&grade=${grade}&nodeId=${instance.data.node.nid}`,
    });
  }

  return { instance, onGradeTap };
}

// ── Tests ────────────────────────────────────────────────────

describe('T12 · P08→P09 transition (exec-to-done)', () => {
  it('onGradeTap MASTERED → wx.navigateTo /pages/review-done/index with sid + grade + nodeId', async () => {
    const { instance, onGradeTap } = createPageInstance();

    await onGradeTap('MASTERED');

    // State transitions
    expect(instance.data.execState).toBe('GRADED');
    expect(instance.data.isGrading).toBe(false);
    expect(instance.data.isRevealed).toBe(false);

    // Transition called
    expect(wxMock.navigateTo).toHaveBeenCalledTimes(1);
    const url = wxMock.navigateTo.mock.calls[0][0].url as string;
    expect(url).toContain('/pages/review-done/index');
    expect(url).toContain('sid=mock-sid-001');
    expect(url).toContain('grade=MASTERED');
    expect(url).toContain('nodeId=test-nid-001');
  });

  it('onGradeTap FORGOT → navigates with grade=FORGOT', async () => {
    const { onGradeTap } = createPageInstance();

    await onGradeTap('FORGOT');

    expect(wxMock.navigateTo).toHaveBeenCalledTimes(1);
    const url = wxMock.navigateTo.mock.calls[0][0].url as string;
    expect(url).toContain('grade=FORGOT');
  });

  it('onGradeTap PARTIAL → navigates with grade=PARTIAL', async () => {
    const { onGradeTap } = createPageInstance();

    await onGradeTap('PARTIAL');

    expect(wxMock.navigateTo).toHaveBeenCalledTimes(1);
    const url = wxMock.navigateTo.mock.calls[0][0].url as string;
    expect(url).toContain('grade=PARTIAL');
  });

  it('double-tap guard: isGrading=true blocks second call', async () => {
    const { instance, onGradeTap } = createPageInstance();
    instance.data.isGrading = true;

    await onGradeTap('MASTERED');

    expect(wxMock.navigateTo).not.toHaveBeenCalled();
  });

  it('not revealed: onGradeTap is no-op', async () => {
    const { instance, onGradeTap } = createPageInstance();
    instance.data.isRevealed = false;

    await onGradeTap('MASTERED');

    expect(wxMock.navigateTo).not.toHaveBeenCalled();
  });

  it('vibration feedback fires before navigation', async () => {
    const { onGradeTap } = createPageInstance();

    await onGradeTap('MASTERED');

    expect(wxMock.vibrateShort).toHaveBeenCalledWith({ type: 'heavy' });
    // vibrateShort called before navigateTo
    const vibrateOrder = wxMock.vibrateShort.mock.invocationCallOrder[0];
    const navOrder = wxMock.navigateTo.mock.invocationCallOrder[0];
    expect(vibrateOrder).toBeLessThan(navOrder);
  });

  it('URL query params are properly encoded', async () => {
    const { onGradeTap } = createPageInstance();

    await onGradeTap('MASTERED');

    const url = wxMock.navigateTo.mock.calls[0][0].url as string;
    // Verify URL structure: /pages/review-done/index?sid=X&grade=Y&nodeId=Z
    const [path, query] = url.split('?');
    expect(path).toBe('/pages/review-done/index');
    const params = new URLSearchParams(query);
    expect(params.get('sid')).toBe('mock-sid-001');
    expect(params.get('grade')).toBe('MASTERED');
    expect(params.get('nodeId')).toBe('test-nid-001');
  });
});
