/**
 * Unit test · api modules export shape (no HTTP)
 * 0 mock · 0 backend · 100% pass
 *
 * 验所有 api/*.ts 模块导出预期函数 · 类型 · 接口
 * 这是 wave-2 merge 期间反复掉 export 的根因 · unit test 锁死 export contract.
 */
import { describe, it, expect } from 'vitest';

import * as fileApi from '../../src/api/file';
import * as wrongbookApi from '../../src/api/wrongbook';
import * as aiApi from '../../src/api/ai';
import * as reviewApi from '../../src/api/review';

describe('api/file.ts exports', () => {
  it('exports presign function', () => {
    expect(typeof fileApi.presign).toBe('function');
  });
});

describe('api/wrongbook.ts exports', () => {
  it('exports createQuestion function', () => {
    expect(typeof wrongbookApi.createQuestion).toBe('function');
  });
  it('exports getQuestionById function', () => {
    expect(typeof wrongbookApi.getQuestionById).toBe('function');
  });
});

describe('api/ai.ts exports', () => {
  it('exports getAnswerByQid function', () => {
    expect(typeof aiApi.getAnswerByQid).toBe('function');
  });
  it('exports startAnalyze function', () => {
    expect(typeof aiApi.startAnalyze).toBe('function');
  });
  it('exports pollAnalyzeStatus function', () => {
    expect(typeof aiApi.pollAnalyzeStatus).toBe('function');
  });
});

describe('api/review.ts exports', () => {
  it('exports completeSession function (T13)', () => {
    expect(typeof reviewApi.completeSession).toBe('function');
  });
  it('exports createSession function (SC-01-C05 #1)', () => {
    expect(typeof reviewApi.createSession).toBe('function');
  });
  it('exports getToday function (SC-01-C05 #2)', () => {
    expect(typeof reviewApi.getToday).toBe('function');
  });
  it('exports getNode function (SC-01-C05 #3)', () => {
    expect(typeof reviewApi.getNode).toBe('function');
  });
  it('exports openNode function (SC-01-C05 #4)', () => {
    expect(typeof reviewApi.openNode).toBe('function');
  });
  it('exports revealNode function (SC-01-C05 #5)', () => {
    expect(typeof reviewApi.revealNode).toBe('function');
  });
  it('exports gradeNode function (SC-01-C05 #6)', () => {
    expect(typeof reviewApi.gradeNode).toBe('function');
  });
  it('exports nextInSession function (SC-01-C05 #7)', () => {
    expect(typeof reviewApi.nextInSession).toBe('function');
  });
  it('exports nodeResult function (SC-01-C05 #8)', () => {
    expect(typeof reviewApi.nodeResult).toBe('function');
  });
});
