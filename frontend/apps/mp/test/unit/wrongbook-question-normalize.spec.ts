/**
 * Unit · getQuestionById normalizes BE wire shape into FE QuestionDetail.
 *
 * RC: BE QuestionDetailController.get returns snake_case + `qid` (DB column).
 * P04 result page reads `q.id` / `q.stem` → undefined → pageState='EMPTY' →
 * "暂无分析结果" screen even though analysis succeeded. Fix wires a transform
 * that maps `qid → id`, `stem_text → stem` (with ocr_text fallback) etc.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/api/_http', async () => {
  const mod = await vi.importActual<typeof import('../../src/api/_http')>(
    '../../src/api/_http',
  );
  return { ...mod, httpJSON: vi.fn() };
});

import { getQuestionById } from '../../src/api/wrongbook';
import { httpJSON } from '../../src/api/_http';
const mockedHttpJSON = vi.mocked(httpJSON);

beforeEach(() => {
  mockedHttpJSON.mockReset();
});

describe('getQuestionById · BE snake_case → FE camelCase normalizer', () => {
  it('maps BE `qid` to FE `id` (root cause of P04 EMPTY state)', async () => {
    mockedHttpJSON.mockResolvedValue({
      planned_nodes: [],
      question: {
        qid: '314011640443969536',
        subject: 'math',
        student_id: 1,
        stem_text: null,
        ocr_text: null,
        difficulty: null,
      },
    });

    const resp = await getQuestionById('314011640443969536');
    expect(resp.question.id).toBe('314011640443969536');
    expect(resp.question.subject).toBe('math');
    expect(resp.plannedNodes).toEqual([]);
  });

  it('falls back stem_text → ocr_text → empty when both null', async () => {
    mockedHttpJSON.mockResolvedValue({
      question: { qid: 'q1', subject: 'math', stem_text: null, ocr_text: '已知 f(x)=...' },
    });
    expect((await getQuestionById('q1')).question.stem).toBe('已知 f(x)=...');

    mockedHttpJSON.mockResolvedValue({
      question: { qid: 'q2', subject: 'math', stem_text: '题干 A', ocr_text: '题干 B' },
    });
    expect((await getQuestionById('q2')).question.stem).toBe('题干 A');

    mockedHttpJSON.mockResolvedValue({
      question: { qid: 'q3', subject: 'math', stem_text: null, ocr_text: null },
    });
    expect((await getQuestionById('q3')).question.stem).toBe('');
  });

  it('defaults difficulty to 3 when BE returns null', async () => {
    mockedHttpJSON.mockResolvedValue({
      question: { qid: 'q', subject: 'math', difficulty: null },
    });
    expect((await getQuestionById('q')).question.difficulty).toBe(3);
  });

  it('accepts planned_nodes (BE) or plannedNodes (legacy) on the envelope', async () => {
    mockedHttpJSON.mockResolvedValue({
      question: { qid: 'q', subject: 'math' },
      planned_nodes: [{ tLevel: 'T1', dueAt: '2026-05-17', status: 'pending' }],
    });
    expect((await getQuestionById('q')).plannedNodes).toHaveLength(1);
  });

  it('survives missing question object (defensive)', async () => {
    mockedHttpJSON.mockResolvedValue({ question: null });
    const out = await getQuestionById('q');
    expect(out.question.id).toBe('');
    expect(out.question.stem).toBe('');
  });
});
