/**
 * Transition test · P03 analyzing → P04 result
 * trace: SC01-MP-T04 · mock wx runtime only · 禁 mock backend
 *
 * Verifies: when pollAnalyzeStatus returns SUCCEEDED, the analyzing page
 * calls wx.navigateTo with /pages/result/index?qid=<qid>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── wx runtime mock (only wx.* APIs mocked, not backend) ────────
const wxNavigateTo = vi.fn();
const wxNavigateBack = vi.fn();
const wxRequest = vi.fn();

(globalThis as Record<string, unknown>).wx = {
  navigateTo: wxNavigateTo,
  navigateBack: wxNavigateBack,
  request: wxRequest,
};

// ── Import the page module after wx is globally available ────────
// We dynamically import the Page() definition and extract its methods.
// The MP Page() is a global that registers the page config object.
let pageConfig: Record<string, unknown>;
const originalPage = (globalThis as Record<string, unknown>).Page;

(globalThis as Record<string, unknown>).Page = (config: Record<string, unknown>) => {
  pageConfig = config;
};

// Force fresh import
beforeEach(() => {
  vi.useFakeTimers();
  wxNavigateTo.mockClear();
  wxNavigateBack.mockClear();
  wxRequest.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('P03→P04 transition (analyzing → result)', () => {
  it('navigates to /pages/result/index?qid=<qid> on SUCCEEDED poll response', async () => {
    // Re-import to capture Page() config
    // Since Page() is synchronous in the module, we can just require it
    pageConfig = undefined as unknown as Record<string, unknown>;
    await import('../../pages/analyzing/index');
    expect(pageConfig).toBeTruthy();

    // Create a page instance by copying config and calling lifecycle
    const page = {
      ...pageConfig,
      data: { ...(pageConfig.data as Record<string, unknown>) },
      _pollTimer: 0,
      _pollCount: 0,
      _qid: 'test-qid-123',
      setData(patch: Record<string, unknown>) {
        Object.assign(this.data, patch);
      },
    };

    // Simulate: pollOnce receives SUCCEEDED response
    // We mock the API module to return a SUCCEEDED response
    const pollOnce = (page as Record<string, (...args: unknown[]) => unknown>)._pollOnce;
    expect(pollOnce).toBeTypeOf('function');

    // Mock the actual fetch that _pollOnce calls via pollAnalyzeStatus
    // Since we can't mock backend (task rule), we intercept wx.request
    // which is the MP runtime's HTTP mechanism
    wxRequest.mockImplementation((opts: { url: string; success: (res: { statusCode: number; data: unknown }) => void }) => {
      // Return SUCCEEDED status from the real API contract shape
      opts.success({
        statusCode: 200,
        data: {
          taskId: 'test-task-456',
          status: 'SUCCEEDED',
          currentStep: 4,
          result: { stem: 'test' },
        },
      });
    });

    // Call _pollOnce
    await pollOnce.call(page, 'test-task-456');

    // After SUCCEEDED, the page should set pageState='success'
    expect(page.data.pageState).toBe('success');

    // The transition uses setTimeout(300ms), advance timers
    vi.advanceTimersByTime(400);

    // Verify wx.navigateTo was called with correct result page URL
    expect(wxNavigateTo).toHaveBeenCalledTimes(1);
    expect(wxNavigateTo).toHaveBeenCalledWith({
      url: '/pages/result/index?qid=test-qid-123',
    });
  });

  it('uses taskId as fallback qid when _qid is empty', async () => {
    const page = {
      ...pageConfig,
      data: { ...(pageConfig.data as Record<string, unknown>), taskId: 'task-as-qid-789' },
      _pollTimer: 0,
      _pollCount: 0,
      _qid: '', // empty — should fall back to taskId
      setData(patch: Record<string, unknown>) {
        Object.assign(this.data, patch);
      },
    };

    wxRequest.mockImplementation((opts: { url: string; success: (res: { statusCode: number; data: unknown }) => void }) => {
      opts.success({
        statusCode: 200,
        data: { taskId: 'task-as-qid-789', status: 'SUCCEEDED', currentStep: 4 },
      });
    });

    const pollOnce = (page as Record<string, (...args: unknown[]) => unknown>)._pollOnce;
    await pollOnce.call(page, 'task-as-qid-789');

    vi.advanceTimersByTime(400);

    expect(wxNavigateTo).toHaveBeenCalledWith({
      url: '/pages/result/index?qid=task-as-qid-789',
    });
  });

  it('does NOT navigate on FAILED status', async () => {
    const page = {
      ...pageConfig,
      data: { ...(pageConfig.data as Record<string, unknown>), doneCount: 2 },
      _pollTimer: 0,
      _pollCount: 0,
      _qid: 'qid-fail-test',
      setData(patch: Record<string, unknown>) {
        Object.assign(this.data, patch);
      },
    };

    wxRequest.mockImplementation((opts: { url: string; success: (res: { statusCode: number; data: unknown }) => void }) => {
      opts.success({
        statusCode: 200,
        data: { taskId: 'task-fail', status: 'FAILED', currentStep: 3, error: 'AI error' },
      });
    });

    const pollOnce = (page as Record<string, (...args: unknown[]) => unknown>)._pollOnce;
    await pollOnce.call(page, 'task-fail');

    vi.advanceTimersByTime(1000);

    expect(page.data.pageState).toBe('error');
    expect(wxNavigateTo).not.toHaveBeenCalled();
  });

  it('does NOT navigate on RUNNING status (intermediate poll)', async () => {
    const page = {
      ...pageConfig,
      data: { ...(pageConfig.data as Record<string, unknown>) },
      _pollTimer: 0,
      _pollCount: 0,
      _qid: 'qid-running',
      setData(patch: Record<string, unknown>) {
        Object.assign(this.data, patch);
      },
    };

    wxRequest.mockImplementation((opts: { url: string; success: (res: { statusCode: number; data: unknown }) => void }) => {
      opts.success({
        statusCode: 200,
        data: { taskId: 'task-running', status: 'RUNNING', currentStep: 2 },
      });
    });

    const pollOnce = (page as Record<string, (...args: unknown[]) => unknown>)._pollOnce;
    await pollOnce.call(page, 'task-running');

    vi.advanceTimersByTime(1000);

    expect(wxNavigateTo).not.toHaveBeenCalled();
  });

  it('reads qid from onLoad options', () => {
    const page = {
      ...pageConfig,
      data: { ...(pageConfig.data as Record<string, unknown>) },
      _qid: '',
      setData(patch: Record<string, unknown>) {
        Object.assign(this.data, patch);
      },
    };

    const onLoad = (page as Record<string, (...args: unknown[]) => unknown>).onLoad;
    onLoad.call(page, { qid: 'from-options-qid', subject: '物理' });

    expect((page as Record<string, unknown>)._qid).toBe('from-options-qid');
    expect(page.data.subjectLabel).toBe('物理');
  });
});
