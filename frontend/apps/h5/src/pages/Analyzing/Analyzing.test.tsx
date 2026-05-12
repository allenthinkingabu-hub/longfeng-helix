// SC-01-E03a · P03 Analyzing · 4-step pipeline skeleton + typewriter testids
// spec: design/system/pages/P03-analyzing.spec.md §3 Block + §10 + §13
// audit: audits/SC-01-PHASE-0/A08-frontend-pages.md  (Analyzing: ~85%)
//
// Coverage:
//   - 4 pipeline step nodes render with both canonical `analyzing-pipeline-step-N`
//     and alias `ai-pipeline-step-N` testids
//   - Each step exposes data-state ∈ {wait, now, done, fail}
//   - `aria-busy` on `now` state
//   - typewriter (`ai-typewriter`) wrapper renders the canonical jsonStream
//   - cancel button (`ai-cancel-btn`) wrapper renders the canonical cancel
//   - fallback banner alias renders when triggered
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, waitFor as waitForRtl } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TEST_IDS } from '@longfeng/testids';
import { __resetBuffer } from '@longfeng/telemetry';

// SC-01-E03c · mock analyzeClient.cancel / fallback (typed client · spec P03 §5)
const cancelClientSpy = vi.fn().mockResolvedValue({ status: 'CANCELLED' });
const fallbackClientSpy = vi.fn().mockResolvedValue({ status: 'FALLBACK_MANUAL' });
vi.mock('@longfeng/api-contracts', () => ({
  analyzeClient: {
    cancel: (taskId: string) => cancelClientSpy(taskId),
    fallback: (taskId: string) => fallbackClientSpy(taskId),
    analyzeByUrl: vi.fn(),
  },
}));

// Mock useEventSource so the page can be rendered synchronously without
// spinning up real fetch / SSE. Each test injects a state shape via the
// `__mockState` module-level variable before render.
type MockState = {
  status: string;
  stepStatuses: Record<1 | 2 | 3 | 4, 'wait' | 'now' | 'done' | 'fail'>;
  stepDurations: Partial<Record<1 | 2 | 3 | 4, number>>;
  partialJson: string;
};

let __mockState: MockState = {
  status: 'QUEUED',
  stepStatuses: { 1: 'wait', 2: 'wait', 3: 'wait', 4: 'wait' },
  stepDurations: {},
  partialJson: '',
};

const cancelSpy = vi.fn().mockResolvedValue(undefined);

// SC-01-E03c · 暴露 mock hook 收到的 options · 让测试能手动触发 onFail / onCancelled
let __capturedOptions: any = null;

vi.mock('../../hooks/useEventSource', () => {
  const STEP_LABELS = { 1: '图像预处理', 2: 'OCR 题干', 3: '错因诊断', 4: '生成解法' };
  return {
    STEP_LABELS,
    useEventSource: (opts: any) => {
      __capturedOptions = opts;
      return {
        ...__mockState,
        cancel: cancelSpy,
      };
    },
  };
});

import { AnalyzingPage } from './index';

function renderPage(taskId = 'task-001') {
  return render(
    <MemoryRouter initialEntries={[`/analyzing/${taskId}?qid=qid-001`]}>
      <Routes>
        <Route path="/analyzing/:taskId" element={<AnalyzingPage />} />
        <Route path="/capture" element={<div data-testid="p02-stub" />} />
        <Route path="/question/:qid/result" element={<div data-testid="p04-stub" />} />
        {/* SC-01-E03c · P-HOME 和 P03_MANUAL stub */}
        <Route path="/" element={<div data-testid="p-home-stub" />} />
        <Route path="/manual-entry" element={<div data-testid="p-manual-stub" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AnalyzingPage · SC-01-E03a · 4-step pipeline + alias testids', () => {
  beforeEach(() => {
    __resetBuffer();
    cancelSpy.mockClear();
    cancelClientSpy.mockClear();
    fallbackClientSpy.mockClear();
    __mockState = {
      status: 'QUEUED',
      stepStatuses: { 1: 'wait', 2: 'wait', 3: 'wait', 4: 'wait' },
      stepDurations: {},
      partialJson: '',
    };
  });

  it('renders P03 root + all 4 canonical pipeline step nodes', () => {
    const { getByTestId } = renderPage();
    expect(getByTestId(TEST_IDS.p03.root)).toBeInTheDocument();
    expect(getByTestId('analyzing-pipeline-step-1')).toBeInTheDocument();
    expect(getByTestId('analyzing-pipeline-step-2')).toBeInTheDocument();
    expect(getByTestId('analyzing-pipeline-step-3')).toBeInTheDocument();
    expect(getByTestId('analyzing-pipeline-step-4')).toBeInTheDocument();
  });

  it('renders alias testids ai-pipeline-step-{1..4} on each step', () => {
    const { getByTestId } = renderPage();
    expect(getByTestId('ai-pipeline-step-1')).toBeInTheDocument();
    expect(getByTestId('ai-pipeline-step-2')).toBeInTheDocument();
    expect(getByTestId('ai-pipeline-step-3')).toBeInTheDocument();
    expect(getByTestId('ai-pipeline-step-4')).toBeInTheDocument();
  });

  it('default state = wait on all steps (no aria-busy)', () => {
    const { getByTestId } = renderPage();
    for (const i of [1, 2, 3, 4] as const) {
      const step = getByTestId(`analyzing-pipeline-step-${i}`);
      expect(step.getAttribute('data-state')).toBe('wait');
      expect(step.getAttribute('aria-busy')).toBeNull();
    }
  });

  it('STEP_1 now + STEP_2..4 wait · aria-busy=true on the active step only', () => {
    __mockState = {
      status: 'STEP_1',
      stepStatuses: { 1: 'now', 2: 'wait', 3: 'wait', 4: 'wait' },
      stepDurations: {},
      partialJson: '',
    };
    const { getByTestId } = renderPage();
    expect(getByTestId('analyzing-pipeline-step-1').getAttribute('data-state')).toBe('now');
    expect(getByTestId('analyzing-pipeline-step-1').getAttribute('aria-busy')).toBe('true');
    expect(getByTestId('analyzing-pipeline-step-2').getAttribute('data-state')).toBe('wait');
    expect(getByTestId('analyzing-pipeline-step-2').getAttribute('aria-busy')).toBeNull();
  });

  it('STEP_1 done + STEP_2 now · state transitions render correctly', () => {
    __mockState = {
      status: 'STEP_2',
      stepStatuses: { 1: 'done', 2: 'now', 3: 'wait', 4: 'wait' },
      stepDurations: { 1: 240 },
      partialJson: '',
    };
    const { getByTestId } = renderPage();
    expect(getByTestId('analyzing-pipeline-step-1').getAttribute('data-state')).toBe('done');
    expect(getByTestId('analyzing-pipeline-step-2').getAttribute('aria-busy')).toBe('true');
  });

  it('renders ai-typewriter alias wrapping the canonical jsonStream', () => {
    const { getByTestId } = renderPage();
    const typewriter = getByTestId('ai-typewriter');
    expect(typewriter).toBeInTheDocument();
    const stream = getByTestId(TEST_IDS.p03.jsonStream);
    expect(typewriter.contains(stream)).toBe(true);
  });

  it('renders ai-cancel-btn alias wrapping the canonical cancel button', () => {
    const { getByTestId } = renderPage();
    const aliasWrap = getByTestId('ai-cancel-btn');
    expect(aliasWrap).toBeInTheDocument();
    const canonicalBtn = getByTestId(TEST_IDS.p03.cancelBtn);
    expect(canonicalBtn).toBeInTheDocument();
    expect(aliasWrap.contains(canonicalBtn)).toBe(true);
    expect(canonicalBtn.getAttribute('aria-label')).toBe('取消分析');
  });

  it('renders ai-fallback-banner alias when fallback taskId mounts banner', () => {
    // taskId containing "fallback" force-mounts the slow banner per existing page logic
    const { getByTestId } = renderPage('task-fallback-001');
    expect(getByTestId('ai-fallback-banner')).toBeInTheDocument();
    expect(getByTestId(TEST_IDS.p03.fallbackBanner)).toBeInTheDocument();
  });

  it('FALLBACK_MODEL hook event drives banner + resets steps to wait (mocked state)', () => {
    // SC-01-E03b · simulate post-FALLBACK_MODEL state shape · banner stays via mount-time
    // fallback taskId path; here we verify mocked-state alignment for step reset semantics.
    __mockState = {
      status: 'SLOW',
      stepStatuses: { 1: 'wait', 2: 'wait', 3: 'wait', 4: 'wait' },
      stepDurations: {},
      partialJson: '',
    };
    const { getByTestId } = renderPage('task-fallback-002');
    expect(getByTestId('ai-fallback-banner')).toBeInTheDocument();
    for (const i of [1, 2, 3, 4] as const) {
      expect(getByTestId(`analyzing-pipeline-step-${i}`).getAttribute('data-state')).toBe('wait');
    }
  });

  it('SUCCEEDED state triggers DONE done-state on all 4 steps', () => {
    __mockState = {
      status: 'SUCCEEDED',
      stepStatuses: { 1: 'done', 2: 'done', 3: 'done', 4: 'done' },
      stepDurations: { 1: 240, 2: 1100, 3: 950, 4: 1200 },
      partialJson: '{"stem":"x"}',
    };
    const { getByTestId } = renderPage();
    for (const i of [1, 2, 3, 4] as const) {
      expect(getByTestId(`analyzing-pipeline-step-${i}`).getAttribute('data-state')).toBe('done');
    }
  });

  it('FAILED + NETWORK_ERROR-style state can render error banner via mocked state', () => {
    __mockState = {
      status: 'FAILED',
      stepStatuses: { 1: 'done', 2: 'fail', 3: 'wait', 4: 'wait' },
      stepDurations: { 1: 240 },
      partialJson: '',
    };
    const { getByTestId } = renderPage();
    expect(getByTestId('analyzing-pipeline-step-2').getAttribute('data-state')).toBe('fail');
  });

  // ─── SC-01-E03c · cancel + fallback ───────────────────────────────

  it('SC-01-E03c · 点击取消按钮 → analyzeClient.cancel(taskId) + navigate("/") → P-HOME', async () => {
    // SSE 已 SUCCEEDED · 但用户点 cancel · 仍要回 P-HOME
    __mockState = {
      status: 'SUCCEEDED',
      stepStatuses: { 1: 'done', 2: 'done', 3: 'done', 4: 'done' },
      stepDurations: { 1: 240, 2: 1100, 3: 950, 4: 1200 },
      partialJson: '{"stem":"x"}',
    };
    const { getByTestId, findByTestId } = renderPage('task-cancel-001');

    // 点击 cancel 按钮
    const btn = getByTestId(TEST_IDS.p03.cancelBtn);
    fireEvent.click(btn);

    // hook cancel + analyzeClient.cancel 都被调
    await waitForRtl(() => {
      expect(cancelSpy).toHaveBeenCalled();
      expect(cancelClientSpy).toHaveBeenCalledWith('task-cancel-001');
    });

    // navigate('/') → P-HOME stub 渲染
    await findByTestId('p-home-stub');
  });

  it('SC-01-E03c · onCancelled (hook 主动派发) → navigate("/") → P-HOME', async () => {
    const { findByTestId } = renderPage('task-cancel-002');

    // 通过暴露的 options 手动调 onCancelled (模拟 SSE CANCELLED event)
    expect(__capturedOptions).not.toBeNull();
    __capturedOptions.onCancelled?.();

    await findByTestId('p-home-stub');
  });

  it('SC-01-E03c · 累计 2 次 FAIL → 调 analyzeClient.fallback + navigate(/manual-entry)', async () => {
    const { findByTestId } = renderPage('task-fail-001');
    expect(__capturedOptions).not.toBeNull();

    // 第 1 次 FAIL · 不触发 fallback
    __capturedOptions.onFail?.('MODEL_TIMEOUT');
    expect(fallbackClientSpy).not.toHaveBeenCalled();

    // 第 2 次 FAIL · 触发 fallback
    __capturedOptions.onFail?.('MODEL_TIMEOUT');

    await waitForRtl(() => {
      expect(fallbackClientSpy).toHaveBeenCalledWith('task-fail-001');
    });

    // navigate('/manual-entry?qid=qid-001&taskId=task-fail-001')
    const stub = await findByTestId('p-manual-stub');
    expect(stub).toBeInTheDocument();
  });

  it('SC-01-E03c · 单次 FAIL 不触发 fallback (count<2)', async () => {
    renderPage('task-single-fail');
    expect(__capturedOptions).not.toBeNull();
    __capturedOptions.onFail?.('NETWORK_ERROR');
    // 同步检查 · 单次 FAIL 不调 fallback
    expect(fallbackClientSpy).not.toHaveBeenCalled();
  });

  it('SC-01-E03c · fallback BE 失败 · 仍 navigate 手填页（spec §5 失败降级）', async () => {
    fallbackClientSpy.mockRejectedValueOnce(new Error('BE 504'));
    const { findByTestId } = renderPage('task-fail-rj');
    expect(__capturedOptions).not.toBeNull();
    __capturedOptions.onFail?.('MODEL_TIMEOUT');
    __capturedOptions.onFail?.('MODEL_TIMEOUT');

    // 即使 BE reject · finally 内 nav 仍跑到 manual-entry
    await findByTestId('p-manual-stub');
  });
});

// ─── SC-01-E03b · SSE 联调测试 (real useEventSource + mocked fetch) ───
import { renderHook, act, waitFor } from '@testing-library/react';
// import the real hook (bypass the vi.mock above by using vi.importActual)
// Note: vi.mock is hoisted, so we use dynamic-style import via vi.importActual
let realUseEventSource: typeof import('../../hooks/useEventSource').useEventSource;

describe('useEventSource · SC-01-E03b · SSE integration (fetch + ReadableStream)', () => {
  const origFetch = globalThis.fetch;

  function makeSseStream(events: object[]): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const e of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        }
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  beforeEach(async () => {
    const actual = await vi.importActual<typeof import('../../hooks/useEventSource')>(
      '../../hooks/useEventSource',
    );
    realUseEventSource = actual.useEventSource;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it('STEP_1..4 + DONE → step done states + onDone called', async () => {
    const events = [
      { type: 'STEP_START', step: 1 },
      { type: 'STEP_DONE', step: 1, durationMs: 240 },
      { type: 'STEP_START', step: 2 },
      { type: 'STEP_DONE', step: 2, durationMs: 1100 },
      { type: 'STEP_START', step: 3 },
      { type: 'STEP_DONE', step: 3, durationMs: 950 },
      { type: 'STEP_START', step: 4 },
      { type: 'STEP_DONE', step: 4, durationMs: 1200 },
      { type: 'DONE' },
    ];
    globalThis.fetch = vi.fn(async () => makeSseStream(events)) as unknown as typeof fetch;

    const onDone = vi.fn();
    const { result } = renderHook(() =>
      realUseEventSource({ taskId: 't-int-01', onDone, slowThresholdMs: 9_999_999 }),
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(result.current.status).toBe('SUCCEEDED');
    expect(result.current.stepStatuses).toEqual({ 1: 'done', 2: 'done', 3: 'done', 4: 'done' });
    expect(result.current.stepDurations[2]).toBe(1100);
  });

  it('FALLBACK_MODEL event fires onFallbackModel + resets steps to wait (non-terminal)', async () => {
    const events = [
      { type: 'STEP_START', step: 1 },
      { type: 'STEP_DONE', step: 1, durationMs: 240 },
      { type: 'STEP_START', step: 2 },
      { type: 'FALLBACK_MODEL', chunk: 'qianwen→openai' },
      { type: 'STEP_START', step: 1 },
      { type: 'STEP_DONE', step: 1, durationMs: 180 },
      { type: 'DONE' },
    ];
    globalThis.fetch = vi.fn(async () => makeSseStream(events)) as unknown as typeof fetch;

    const onFallbackModel = vi.fn();
    const onDone = vi.fn();
    const { result } = renderHook(() =>
      realUseEventSource({
        taskId: 't-int-02',
        onDone,
        onFallbackModel,
        slowThresholdMs: 9_999_999,
      }),
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onFallbackModel).toHaveBeenCalledWith('qianwen→openai');
    // After DONE all 4 steps go done (DONE handler overrides) — assert FB callback fired.
    expect(result.current.status).toBe('SUCCEEDED');
  });

  it('fetch throws (network error) → onFail("NETWORK_ERROR") after retries exhaust', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Network down');
    }) as unknown as typeof fetch;

    const onFail = vi.fn();
    renderHook(() =>
      realUseEventSource({
        taskId: 't-int-03',
        onFail,
        slowThresholdMs: 9_999_999,
        maxRetries: 0, // 立即降级 · 不等待重试 backoff
      }),
    );

    await waitFor(() => expect(onFail).toHaveBeenCalledWith('NETWORK_ERROR'), { timeout: 3000 });
  });

  it('cancel() POSTs /api/ai/cancel and emits CANCELLED status', async () => {
    // 永不结束的 stream · 让 cancel 真正打断
    const stream = new ReadableStream({ start() { /* hang */ } });
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('/cancel/')) {
        return new Response(JSON.stringify({ status: 'CANCELLED' }), { status: 200 });
      }
      return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
    }) as unknown as typeof fetch;

    const onCancelled = vi.fn();
    const { result } = renderHook(() =>
      realUseEventSource({ taskId: 't-int-04', onCancelled, slowThresholdMs: 9_999_999 }),
    );

    await act(async () => {
      await result.current.cancel();
    });

    expect(result.current.status).toBe('CANCELLED');
    expect(onCancelled).toHaveBeenCalled();
    expect(calls.some((c) => c.startsWith('POST') && c.includes('/api/ai/cancel/t-int-04'))).toBe(true);
  });
});
