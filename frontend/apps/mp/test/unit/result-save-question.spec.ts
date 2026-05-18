/**
 * Unit · P04 result page onSaveTap actually calls BE save endpoint.
 *
 * RC: pre-fix onSaveTap only ran wx.showToast + navigateTo — no save API,
 * no plan creation. The "保存并开启复习" promise (gen 7 nodes / 6 calendar reminders)
 * was a UI lie. This spec locks in the wiring.
 *
 * Mock budget: 2 vi.mock (saveQuestion + getQuestionById/getAnswerByQid stubs).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/api/wrongbook', () => ({
  getQuestionById: vi.fn(),
  saveQuestion: vi.fn(),
}));
vi.mock('../../src/api/ai', () => ({
  getAnswerByQid: vi.fn(),
}));

let pageInstance: any = null;
(globalThis as any).Page = (def: any) => {
  pageInstance = {
    ...def,
    data: { ...def.data },
    setData(d: any) { Object.assign(this.data, d); },
  };
};
const toastCalls: Array<{ title: string; icon?: string }> = [];
const navCalls: Array<{ url: string }> = [];
const storage: Record<string, unknown> = {};
(globalThis as any).wx = {
  showToast: vi.fn((o: { title: string; icon?: string }) => { toastCalls.push(o); }),
  navigateTo: vi.fn((o: { url: string }) => { navCalls.push(o); }),
  navigateBack: vi.fn(),
  // wrongbook-list 是 tabBar 页 · impl 用 switchTab + setStorageSync 传 highlight qid
  // 测试断言改读 navCalls (switchTab 走同列) + storage map
  switchTab: vi.fn((o: { url: string }) => { navCalls.push(o); }),
  setStorageSync: vi.fn((k: string, v: unknown) => { storage[k] = v; }),
  getStorageSync: vi.fn((k: string) => storage[k]),
  vibrateShort: vi.fn(),
};
(globalThis as any).setTimeout = ((fn: () => void) => { fn(); return 0; }) as any;

await import('../../pages/result/index');

import { saveQuestion } from '../../src/api/wrongbook';
const mockedSave = vi.mocked(saveQuestion);

beforeEach(() => {
  mockedSave.mockReset();
  toastCalls.length = 0;
  navCalls.length = 0;
  pageInstance.data.isSaving = false;
  pageInstance._questionRaw = { id: 'q-real-123' };
  pageInstance._qid = 'q-real-123';
});

describe('P04 onSaveTap · 真 save · 不再是假 toast', () => {
  it('calls saveQuestion(qid) with the right qid and shows 成功 toast', async () => {
    mockedSave.mockResolvedValue({ qid: 'q-real-123', status: 3 });

    await pageInstance.onSaveTap();

    expect(mockedSave).toHaveBeenCalledTimes(1);
    expect(mockedSave).toHaveBeenCalledWith('q-real-123');
    expect(toastCalls).toContainEqual({ title: '保存成功', icon: 'success', duration: 600, mask: true });
    // wrongbook-list 是 tabBar 页 · impl 改用 switchTab + setStorageSync 传 highlight qid
    expect(navCalls[0]?.url).toBe('/pages/wrongbook-list/index');
  });

  it('shows failure toast when BE save throws (no navigation)', async () => {
    mockedSave.mockRejectedValue(new Error('HTTP 500'));

    await pageInstance.onSaveTap();

    expect(mockedSave).toHaveBeenCalledTimes(1);
    expect(toastCalls).toContainEqual({ title: '保存失败，请重试', icon: 'none' });
    expect(navCalls).toHaveLength(0);
  });

  it('blocks double-tap while isSaving=true', async () => {
    mockedSave.mockResolvedValue({ qid: 'q-real-123', status: 3 });
    pageInstance.data.isSaving = true;

    await pageInstance.onSaveTap();

    expect(mockedSave).not.toHaveBeenCalled();
  });

  it('refuses to save when no qid resolved (defensive)', async () => {
    pageInstance._questionRaw = null;
    pageInstance._qid = '';

    await pageInstance.onSaveTap();

    expect(mockedSave).not.toHaveBeenCalled();
    expect(toastCalls).toContainEqual({ title: '题目缺失，无法保存', icon: 'none' });
  });
});
