/**
 * Unit · pages/analyzing/index STEP_DESCS uses real BE values, not mockup placeholders.
 *
 * RC: screenshot 2026-05-16 16:13 showed "学科 / 知识点判断 · 0.8s · 数学 · 二次函数 · 顶点式
 * · Bloom: APPLY" — but the BE pipeline does no KP / Bloom classification. That text
 * came from a hard-coded mockup string in STEP_DESCS. Fix replaces it with a function
 * that pulls real values (stem length / subject label / ocr model) from the SUCCEEDED
 * poll response.
 *
 * Mock budget: 2 vi.mock (api/ai startAnalyze + pollAnalyzeStatus). Within ≤5 red line.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/api/ai', () => ({
  startAnalyze: vi.fn(),
  pollAnalyzeStatus: vi.fn(),
}));

let pageInstance: any = null;
(globalThis as any).Page = (def: any) => {
  pageInstance = {
    ...def,
    data: { ...def.data },
    setData(d: any) { Object.assign(this.data, d); },
    _pollTimer: 0,
    _pollCount: 0,
    _qid: '',
  };
};
(globalThis as any).wx = {
  navigateTo: vi.fn(),
  navigateBack: vi.fn(),
};
(globalThis as any).setInterval = (() => 0) as any;
(globalThis as any).clearInterval = (() => undefined) as any;
(globalThis as any).setTimeout = ((fn: () => void) => { fn(); return 0; }) as any;

await import('../../pages/analyzing/index');

import { startAnalyze, pollAnalyzeStatus } from '../../src/api/ai';
const mockedStart = vi.mocked(startAnalyze);
const mockedPoll = vi.mocked(pollAnalyzeStatus);

beforeEach(() => {
  mockedStart.mockReset();
  mockedPoll.mockReset();
  mockedStart.mockResolvedValue({ taskId: 't1', status: 'ANALYZING' });
});

describe('analyzing/STEP_DESCS · real BE values replace mockup placeholders', () => {
  it('step 1 desc shows real stem length, not "已提取 132 字符"', async () => {
    mockedPoll.mockResolvedValueOnce({
      taskId: 't1', status: 'SUCCEEDED',
      stemLength: 47, subject: 'math', ocrModel: 'qwen-vl-max',
    });

    pageInstance.onLoad({ imageUrl: 'http://localhost/x.jpg', subject: 'math', qid: 'q1' });
    await Promise.resolve(); await Promise.resolve();
    await pageInstance._pollOnce('t1');

    const step1 = pageInstance.data.steps[0];
    expect(step1.desc).toContain('47');
    expect(step1.desc).not.toContain('132');
    expect(step1.desc).not.toContain('置信度');
  });

  it('step 2 desc shows "<subject> · <model>", not "二次函数 · 顶点式 · Bloom: APPLY"', async () => {
    mockedPoll.mockResolvedValueOnce({
      taskId: 't1', status: 'SUCCEEDED',
      stemLength: 47, subject: 'math', ocrModel: 'qwen-vl-max',
    });

    pageInstance.onLoad({ imageUrl: 'http://localhost/x.jpg', subject: 'math', qid: 'q1' });
    await Promise.resolve(); await Promise.resolve();
    await pageInstance._pollOnce('t1');

    const step2 = pageInstance.data.steps[1];
    expect(step2.desc).toBe('数学 · qwen-vl-max');
    expect(step2.desc).not.toContain('二次函数');
    expect(step2.desc).not.toContain('Bloom');
  });

  it('step 2 falls back gracefully when BE returns no subject/model', async () => {
    mockedPoll.mockResolvedValueOnce({
      taskId: 't1', status: 'SUCCEEDED',
      stemLength: 10,
    });

    pageInstance.onLoad({ imageUrl: 'http://localhost/x.jpg', subject: 'math', qid: 'q1' });
    await Promise.resolve(); await Promise.resolve();
    await pageInstance._pollOnce('t1');

    const step2 = pageInstance.data.steps[1];
    // Falls back to FE-side subjectLabel + currentModel
    expect(step2.desc).toContain('数学');
    expect(step2.desc).toContain('qwen-vl-max');
  });

  it('step 1 desc when stem_length missing falls back to neutral "题干提取完成"', async () => {
    mockedPoll.mockResolvedValueOnce({
      taskId: 't1', status: 'SUCCEEDED',
      subject: 'math', ocrModel: 'qwen-vl-max',
    });

    pageInstance.onLoad({ imageUrl: 'http://localhost/x.jpg', subject: 'math', qid: 'q1' });
    await Promise.resolve(); await Promise.resolve();
    await pageInstance._pollOnce('t1');

    expect(pageInstance.data.steps[0].desc).toBe('题干提取完成');
  });
});
