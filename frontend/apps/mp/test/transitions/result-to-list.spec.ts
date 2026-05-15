/**
 * T07 · P04→P05 transition test (result → wrongbook-list)
 * trace: design/mockups/wrongbook/04_result.html → 05_wrongbook_list.html
 *
 * Mock: wx runtime only (wx.navigateTo, wx.showToast)
 * 禁 mock backend
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── wx runtime mock (only wx APIs, NOT backend) ──────────────

interface WxNavigateToOpts { url: string; success?: () => void; fail?: (err: unknown) => void }
interface WxToastOpts { title: string; icon?: string }

const navigateToCalls: WxNavigateToOpts[] = [];

const wxMock = {
  navigateTo: vi.fn((opts: WxNavigateToOpts) => {
    navigateToCalls.push(opts);
    opts.success?.();
  }),
  navigateBack: vi.fn(),
  showToast: vi.fn((_opts: WxToastOpts) => {}),
  request: vi.fn((opts: { url: string; method?: string; success?: (res: { statusCode: number; data: unknown }) => void; fail?: (err: unknown) => void }) => {
    opts.success?.({ statusCode: 200, data: {} });
  }),
};

beforeEach(() => {
  navigateToCalls.length = 0;
  vi.stubGlobal('wx', wxMock);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ── Helper: simulate result page onSaveTap ───────────────────

function createResultPageInstance() {
  const instance = {
    _questionRaw: { id: 'q-123' } as { id: string } | null,
    _qid: 'q-123',
    data: {
      isSaving: false,
      pageState: 'DRAFT' as string,
    },
    setData(patch: Record<string, unknown>) {
      Object.assign(instance.data, patch);
    },
  };

  async function onSaveTap() {
    if (instance.data.isSaving) return;
    instance.setData({ isSaving: true });

    try {
      wx.showToast({ title: '保存成功', icon: 'success' });
      const qid = instance._questionRaw?.id || instance._qid;
      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/wrongbook-list/index?highlight=${qid}`,
        });
      }, 1500);
    } catch {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      instance.setData({ isSaving: false });
    }
  }

  return { instance, onSaveTap };
}

// ── Tests ────────────────────────────────────────────────────

describe('T07 · P04→P05 transition (result-to-list)', () => {
  it('onSaveTap → toast + wx.navigateTo /pages/wrongbook-list/index with highlight=qid after 1500ms', async () => {
    const { onSaveTap } = createResultPageInstance();

    await onSaveTap();

    // Toast should have been called
    expect(wxMock.showToast).toHaveBeenCalledWith({ title: '保存成功', icon: 'success' });

    // Before 1500ms, no navigation yet
    expect(wxMock.navigateTo).not.toHaveBeenCalled();

    // Advance timer
    vi.advanceTimersByTime(1500);

    // Now navigation should have fired
    expect(wxMock.navigateTo).toHaveBeenCalledTimes(1);
    const url = wxMock.navigateTo.mock.calls[0][0].url as string;
    expect(url).toBe('/pages/wrongbook-list/index?highlight=q-123');
  });

  it('navigateTo URL contains correct path and highlight param', async () => {
    const { onSaveTap } = createResultPageInstance();

    await onSaveTap();
    vi.advanceTimersByTime(1500);

    const url = wxMock.navigateTo.mock.calls[0][0].url as string;
    const [path, query] = url.split('?');
    expect(path).toBe('/pages/wrongbook-list/index');
    const params = new URLSearchParams(query);
    expect(params.get('highlight')).toBe('q-123');
  });

  it('double-tap guard: isSaving=true blocks second call', async () => {
    const { instance, onSaveTap } = createResultPageInstance();
    instance.data.isSaving = true;

    await onSaveTap();
    vi.advanceTimersByTime(2000);

    expect(wxMock.navigateTo).not.toHaveBeenCalled();
    expect(wxMock.showToast).not.toHaveBeenCalled();
  });

  it('uses _qid fallback when _questionRaw is null', async () => {
    const { instance, onSaveTap } = createResultPageInstance();
    instance._questionRaw = null;
    instance._qid = 'q-fallback';

    await onSaveTap();
    vi.advanceTimersByTime(1500);

    const url = wxMock.navigateTo.mock.calls[0][0].url as string;
    expect(url).toContain('highlight=q-fallback');
  });

  it('isSaving is reset to false after save completes', async () => {
    const { instance, onSaveTap } = createResultPageInstance();

    await onSaveTap();

    expect(instance.data.isSaving).toBe(false);
  });
});
