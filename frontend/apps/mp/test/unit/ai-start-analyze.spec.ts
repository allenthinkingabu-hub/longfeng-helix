/**
 * Unit · src/api/ai.ts startAnalyze · in_scope #5 + #6 closure anchor.
 * Verifies the FE side of the task_id↔qid closure: when FE passes taskId,
 * the POST body includes it (so BE AnalyzeController.analyze honors it).
 *
 * trace: SC01-MP-BUG-AI-FAKE · audits/runs/.../test-cases.md · 字段映射 contract
 *   FE startAnalyze({taskId: this._qid}) → BE persists analysis_result.task_id == qid
 *   → GET /api/ai/{qid}/answer can find a row · TC#4 closure assertion lands.
 *
 * Mock budget: 1 vi.mock on `@/api/_http` httpJSON · counts within ≤ 5 audit red line.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/api/_http', async () => {
  const mod = await vi.importActual<typeof import('../../src/api/_http')>(
    '../../src/api/_http',
  );
  return {
    ...mod,
    httpJSON: vi.fn(),
  };
});

import { startAnalyze } from '../../src/api/ai';
import { httpJSON } from '../../src/api/_http';

const mockedHttpJSON = vi.mocked(httpJSON);

beforeEach(() => {
  mockedHttpJSON.mockReset();
});

describe('startAnalyze · taskId pass-through (SC01-MP-BUG-AI-FAKE in_scope #5)', () => {
  it('passes taskId in POST body when caller provides one (closure anchor)', async () => {
    mockedHttpJSON.mockResolvedValue({ task_id: 'Q-CLOSED-LOOP-004', status: 'ANALYZING' });

    await startAnalyze({
      imageUrl: 'https://oss/test.png',
      subject: '数学',
      taskId: 'Q-CLOSED-LOOP-004',
    });

    expect(mockedHttpJSON).toHaveBeenCalledTimes(1);
    const [url, opts] = mockedHttpJSON.mock.calls[0];
    expect(url).toBe('http://localhost:8083/api/ai/analyze');
    const body = (opts as { body: { taskId?: string; subject: string; imageUrl: string } }).body;
    expect(body.taskId).toBe('Q-CLOSED-LOOP-004');
    expect(body.subject).toBe('数学');
    expect(body.imageUrl).toBe('https://oss/test.png');
  });

  it('omits taskId from body when caller does not provide one (BE generates UUID)', async () => {
    mockedHttpJSON.mockResolvedValue({ task_id: 'generated-uuid', status: 'ANALYZING' });

    await startAnalyze({
      imageUrl: 'https://oss/test.png',
      subject: '数学',
    });

    const [, opts] = mockedHttpJSON.mock.calls[0];
    const body = (opts as { body: Record<string, unknown> }).body;
    expect(body.taskId).toBeUndefined();
    expect(body.subject).toBe('数学');
    expect(body.imageUrl).toBe('https://oss/test.png');
  });

  it('normalizes camelCase + snake_case BE response variants', async () => {
    mockedHttpJSON.mockResolvedValue({ taskId: 'camel-form', status: 'ANALYZING' });
    const resp1 = await startAnalyze({ imageUrl: 'u', subject: '数学' });
    expect(resp1.taskId).toBe('camel-form');

    mockedHttpJSON.mockResolvedValue({ task_id: 'snake-form', status: 'ANALYZING' });
    const resp2 = await startAnalyze({ imageUrl: 'u', subject: '数学' });
    expect(resp2.taskId).toBe('snake-form');
  });
});
