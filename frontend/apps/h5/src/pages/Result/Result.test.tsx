// SC-01-E04a · P04 Result · useQuery + 6 节点时间线 testid 单测
// SC-01-E04b · 低置信度黄条 + 保存强制确认 modal
// 验证：result-hero-stem / result-cause-card / result-solution-card /
//        result-timeline-node-T0..T6 + questionsClient.getById 被调用
//        result-lowconf-banner / result-confirm-modal / result-confirm-yes/no-btn
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// vi.mock factory is hoisted; only `vi` is safe to reference. Build the
// fixture inline so no top-level variable is captured pre-init.
vi.mock('@longfeng/api-contracts', async () => {
  const actual = await vi.importActual<typeof import('@longfeng/api-contracts')>(
    '@longfeng/api-contracts',
  );
  return {
    ...actual,
    questionsClient: {
      save: vi.fn().mockResolvedValue({
        qid: 'q-test-001',
        planId: 'plan-1',
        nodes: [
          { nid: 'n0', tLevel: 'T0', dueAt: '2026-05-12T10:00:00Z' },
          { nid: 'n1', tLevel: 'T1', dueAt: '2026-05-13T10:00:00Z' },
        ],
      }),
      getById: vi.fn().mockResolvedValue({
        question: {
          id: 'q-test-001',
          subject: 'math',
          stem: '已知函数 f(x)=x²−4x+3，求顶点。',
          formula: 'f(x) = (x − 2)² − 1',
          thumbnailUrl: undefined,
          myAnswer: 'B. (2, −1)',
          correctAnswer: 'A. (2, −1)',
          reasonMarkdown: '把顶点式中的 h 与 k 读反了，所以 x 坐标应为 2。',
          steps: [
            { idx: 1, title: '配方', formula: '(x−2)² − 1' },
            { idx: 2, title: '读顶点' },
            { idx: 3, title: '写对称轴 x=2' },
          ],
          knowledgePoints: [
            { id: 'kp-1', name: '二次函数', weight: 0.8 },
            { id: 'kp-2', name: '配方法', weight: 0.6 },
          ],
          difficulty: 3,
          confidence: 0.85,
          modelInfo: { name: 'qwen-vl-max', version: '2.0' },
        },
        plannedNodes: [
          { tLevel: 'T1', dueAt: '2026-05-12T10:00:00Z', status: 'preview' },
          { tLevel: 'T2', dueAt: '2026-05-13T10:00:00Z', status: 'preview' },
          { tLevel: 'T3', dueAt: '2026-05-15T10:00:00Z', status: 'preview' },
          { tLevel: 'T4', dueAt: '2026-05-19T10:00:00Z', status: 'preview' },
          { tLevel: 'T5', dueAt: '2026-05-27T10:00:00Z', status: 'preview' },
          { tLevel: 'T6', dueAt: '2026-06-15T10:00:00Z', status: 'preview' },
        ],
      }),
      createPending: vi.fn(),
    },
  };
});

import { ResultPage } from './index';

function renderResult(qid = 'q-test-001') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/question/${qid}/result`]}>
        <Routes>
          <Route path="/question/:qid/result" element={<ResultPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('P04 Result · SC-01-E04a · useQuery + timeline testids', () => {
  it('renders result-hero-stem with stem text', async () => {
    const { findByTestId } = renderResult();
    const stem = await findByTestId('result-hero-stem');
    expect(stem).toBeInTheDocument();
    await waitFor(() => {
      expect(stem.textContent).toContain('f(x)');
    });
  });

  it('renders result-cause-card with reason text', async () => {
    const { findByTestId } = renderResult();
    const cause = await findByTestId('result-cause-card');
    expect(cause).toBeInTheDocument();
    await waitFor(() => {
      expect(cause.textContent).toContain('顶点');
    });
  });

  it('renders result-solution-card', async () => {
    const { findByTestId } = renderResult();
    const sol = await findByTestId('result-solution-card');
    expect(sol).toBeInTheDocument();
  });

  it('renders 7 timeline nodes T0..T6', async () => {
    const { findByTestId } = renderResult();
    for (const t of ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6']) {
      const node = await findByTestId(`result-timeline-node-${t}`);
      expect(node).toBeInTheDocument();
    }
  });

  it('T0 = now, T1..T6 = future via data-status', async () => {
    const { findByTestId } = renderResult();
    const t0 = await findByTestId('result-timeline-node-T0');
    expect(t0).toHaveAttribute('data-status', 'now');
    for (const t of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']) {
      const node = await findByTestId(`result-timeline-node-${t}`);
      expect(node).toHaveAttribute('data-status', 'future');
    }
  });

  it('calls questionsClient.getById with the qid (useQuery wired)', async () => {
    renderResult('q-test-001');
    const { questionsClient } = await import('@longfeng/api-contracts');
    await waitFor(() => {
      expect(questionsClient.getById).toHaveBeenCalledWith('q-test-001');
    });
  });
});

// ─── SC-01-E04b · 低置信度黄条 + 强制确认 modal ────────────────────────
function makeDetail(confidence: number) {
  return {
    question: {
      id: 'q-test-lc',
      subject: 'math' as const,
      stem: 'stem text',
      formula: '(x-2)²',
      thumbnailUrl: undefined,
      myAnswer: 'A',
      correctAnswer: 'B',
      reasonMarkdown: '错因',
      steps: [
        { idx: 1, title: 'step1' },
        { idx: 2, title: 'step2' },
        { idx: 3, title: 'step3' },
      ],
      knowledgePoints: [{ id: 'kp-1', name: '二次函数', weight: 0.8 }],
      difficulty: 3,
      confidence,
      modelInfo: { name: 'qwen-vl-max', version: '2.0' },
    },
    plannedNodes: [
      { tLevel: 'T1' as const, dueAt: '2026-05-12T10:00:00Z', status: 'preview' as const },
      { tLevel: 'T2' as const, dueAt: '2026-05-13T10:00:00Z', status: 'preview' as const },
      { tLevel: 'T3' as const, dueAt: '2026-05-15T10:00:00Z', status: 'preview' as const },
      { tLevel: 'T4' as const, dueAt: '2026-05-19T10:00:00Z', status: 'preview' as const },
      { tLevel: 'T5' as const, dueAt: '2026-05-27T10:00:00Z', status: 'preview' as const },
      { tLevel: 'T6' as const, dueAt: '2026-06-15T10:00:00Z', status: 'preview' as const },
    ],
  };
}

// ─── SC-01-E04c · save mutation + navigate P05 with highlight ───────────
// Capture navigation by mounting a second route at /wrongbook that surfaces
// the search string via testid so we can assert highlight=qid.
function ListSink() {
  const loc = useLocation();
  return <div data-testid="list-sink-search">{loc.search}</div>;
}

function renderResultWithListSink(qid = 'q-test-001') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/question/${qid}/result`]}>
        <Routes>
          <Route path="/question/:qid/result" element={<ResultPage />} />
          <Route path="/wrongbook" element={<ListSink />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('P04 Result · SC-01-E04c · save mutation + navigate to P05', () => {
  it('renders result-save-btn (new SC-01-E04c testid)', async () => {
    const { findByTestId } = renderResult();
    const btn = await findByTestId('result-save-btn');
    expect(btn).toBeInTheDocument();
  });

  it('clicking save (high confidence) triggers questionsClient.save with qid', async () => {
    const { findByTestId } = renderResult('q-test-001');
    const { questionsClient } = await import('@longfeng/api-contracts');
    const cta = await findByTestId('p04-save-cta');
    fireEvent.click(cta);
    await waitFor(() => {
      expect(questionsClient.save).toHaveBeenCalledWith('q-test-001');
    });
  });

  it('save success → navigate /wrongbook?highlight={qid}', async () => {
    const { findByTestId } = renderResultWithListSink('q-test-001');
    const cta = await findByTestId('p04-save-cta');
    fireEvent.click(cta);
    const sink = await findByTestId('list-sink-search');
    await waitFor(() => {
      expect(sink.textContent ?? '').toContain('highlight=q-test-001');
    });
  });

  it('low-confidence → save click opens modal, confirm-yes triggers save then navigates', async () => {
    const { questionsClient } = await import('@longfeng/api-contracts');
    // makeDetail returns a question with id='q-test-lc'; mount URL with the same id
    (questionsClient.getById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeDetail(0.3),
    );
    (questionsClient.save as ReturnType<typeof vi.fn>).mockClear();
    (questionsClient.save as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      qid: 'q-test-lc',
      planId: 'plan-lc',
      nodes: [],
    });
    const { findByTestId } = renderResultWithListSink('q-test-lc');
    await findByTestId('result-lowconf-banner');
    const cta = await findByTestId('p04-save-cta');
    fireEvent.click(cta);
    // modal appears (NOT yet saved)
    await findByTestId('result-confirm-modal');
    expect(questionsClient.save).not.toHaveBeenCalled();
    // click confirm yes
    const yes = await findByTestId('result-confirm-yes-btn');
    fireEvent.click(yes);
    await waitFor(() => {
      expect(questionsClient.save).toHaveBeenCalledWith('q-test-lc');
    });
    const sink = await findByTestId('list-sink-search');
    await waitFor(() => {
      expect(sink.textContent ?? '').toContain('highlight=q-test-lc');
    });
  });
});

describe('P04 Result · SC-01-E04b · low-confidence banner + forced confirm modal', () => {
  it('renders result-lowconf-banner when confidence=0.5 (< 0.6)', async () => {
    const { questionsClient } = await import('@longfeng/api-contracts');
    (questionsClient.getById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeDetail(0.5),
    );
    const { findByTestId } = renderResult('q-test-lc');
    const banner = await findByTestId('result-lowconf-banner');
    expect(banner).toBeInTheDocument();
  });

  it('does NOT render result-lowconf-banner when confidence=0.9 (>= 0.6)', async () => {
    const { questionsClient } = await import('@longfeng/api-contracts');
    (questionsClient.getById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeDetail(0.9),
    );
    const { findByTestId, queryByTestId } = renderResult('q-test-hi');
    // Wait for content
    await findByTestId('p04-save-cta');
    expect(queryByTestId('result-lowconf-banner')).toBeNull();
  });

  it('clicking save with low confidence opens result-confirm-modal (yes/no btns)', async () => {
    const { questionsClient } = await import('@longfeng/api-contracts');
    (questionsClient.getById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeDetail(0.4),
    );
    const { findByTestId, queryByTestId } = renderResult('q-test-lc2');
    // Wait for banner so we know LOW_CONF rendered
    await findByTestId('result-lowconf-banner');
    // Modal hidden initially
    expect(queryByTestId('result-confirm-modal')).toBeNull();
    // Click save → modal appears
    const cta = await findByTestId('p04-save-cta');
    fireEvent.click(cta);
    const modal = await findByTestId('result-confirm-modal');
    expect(modal).toBeInTheDocument();
    expect(await findByTestId('result-confirm-yes-btn')).toBeInTheDocument();
    expect(await findByTestId('result-confirm-no-btn')).toBeInTheDocument();
  });
});
