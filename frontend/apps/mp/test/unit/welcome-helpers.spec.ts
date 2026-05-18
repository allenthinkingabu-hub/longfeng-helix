/**
 * MP-CATCHUP-B-WELCOME · welcome page pure helpers · state machine
 * 0 mock · 0 wx · 0 HTTP · 100% pass
 *
 * 验证 spec §6 状态机 5 态 + 派生字段 (千分化 / banner msg / show* flags)
 * Tests verify INTENT (CLAUDE.md Rule 9): each test names why this transition
 * matters to the user — not just that the code runs.
 */
import { describe, it, expect } from 'vitest';
import { deriveLandingState } from '../../pages/welcome/helpers';
import type { LandingSample, KpiResponse } from '../../src/api/landing';

const sampleA: LandingSample = {
  subject: '数学',
  stemText: 'f(x)=2x²-3x+1',
  knowledgePoints: ['二次函数'],
  errorReason: '顶点公式',
  correction: 'x=3/4',
};
const sampleB: LandingSample = {
  subject: '英语',
  stemText: 'goes to school',
  knowledgePoints: ['一般现在时'],
  errorReason: '主谓一致',
  correction: 'goes',
};
const kpiOk: KpiResponse = {
  cumulativeQuestions: 12_500_000,
  dailyAnalyses: 84_000,
  happyUsers: 320_000,
};

describe('deriveLandingState · §6 状态机 happy path', () => {
  it('samples+kpi both OK → phase=READY · all sections visible · no banner', () => {
    const s = deriveLandingState([sampleA, sampleB], kpiOk);
    expect(s.phase).toBe('READY');
    expect(s.showSamples).toBe(true);
    expect(s.showKpi).toBe(true);
    expect(s.showDegradedBanner).toBe(false);
    expect(s.degradedMsg).toBe('');
    expect(s.samples.length).toBe(2);
    expect(s.samples[0].subject).toBe('数学');
    expect(s.kpi).toEqual(kpiOk);
  });

  it('KPI 千分化字段: 12.5M / 84K / 320K (用户视角"累计" 可读)', () => {
    const s = deriveLandingState([sampleA], kpiOk);
    expect(s.kpiQuestionsM).toBe('12.5');
    expect(s.kpiDailyK).toBe('84');
    expect(s.kpiUsersK).toBe('320');
  });
});

describe('deriveLandingState · §6 状态机 降级路径', () => {
  it('samples reject + kpi OK → DEGRADED-samples · 仍显 KPI · banner 文案聚焦"样例"', () => {
    // 用户视角: samples 加载失败时, KPI 是次要数据但仍有信任价值,
    // 不应连同 KPI 一起隐藏 (会让"网站完全坏了" 错感).
    const s = deriveLandingState(undefined, kpiOk);
    expect(s.phase).toBe('DEGRADED-samples');
    expect(s.showSamples).toBe(false);
    expect(s.showKpi).toBe(true);
    expect(s.showDegradedBanner).toBe(true);
    expect(s.degradedMsg).toMatch(/样例加载失败/);
    expect(s.samples.length).toBe(0);
    expect(s.kpi).toEqual(kpiOk);
  });

  it('samples OK + kpi reject → DEGRADED-kpi · samples 仍渲染 (主诱因) · KPI 隐藏', () => {
    // 用户视角: 样例是 "AI 能干什么" 的主诱因, kpi 是数字背书 ·
    // kpi 失败不应阻塞核心样例展示 (biz §2A.3.2 性能预算: KPI 静默降级 · 不进 DEGRADED 整页)
    const s = deriveLandingState([sampleA], undefined);
    expect(s.phase).toBe('DEGRADED-kpi');
    expect(s.showSamples).toBe(true);
    expect(s.showKpi).toBe(false);
    expect(s.degradedMsg).toMatch(/统计数据/);
    expect(s.samples.length).toBe(1);
    expect(s.kpi).toBeNull();
    // KPI 千分化字段在无 KPI 时仍返默认值 (防 wxml undefined error)
    expect(s.kpiQuestionsM).toBe('0.0');
  });

  it('samples + kpi 双 reject → DEGRADED-both · banner 提示 CTA 仍可点', () => {
    // 用户视角: 网络完全坏的时候, CTA 必须仍可点 (biz §2A.3.2 性能预算:
    // CTA 1.5s 内可点 · 即使 DEGRADED 也能进入下游游客流). banner 文案不能让用户
    // 误以为 "什么都干不了"。
    const s = deriveLandingState(undefined, undefined);
    expect(s.phase).toBe('DEGRADED-both');
    expect(s.showSamples).toBe(false);
    expect(s.showKpi).toBe(false);
    expect(s.showDegradedBanner).toBe(true);
    expect(s.degradedMsg).toMatch(/CTA/);
    expect(s.samples).toEqual([]);
    expect(s.kpi).toBeNull();
  });
});

describe('deriveLandingState · 边界 / 防御性 (Tester 视角)', () => {
  it('samples 数组为空仍算 OK · phase=READY · 但 samples.length=0', () => {
    // 后端真返 [] (合法响应) 不应 silent 触发 DEGRADED · 用户视角 "服务在线但暂无样例"
    // 是不同于 "服务挂了" 的体验
    const s = deriveLandingState([], kpiOk);
    expect(s.phase).toBe('READY');
    expect(s.showSamples).toBe(true);
    expect(s.samples.length).toBe(0);
  });

  it('sample 缺 knowledgePoints 字段 → 派生为空数组 (防 wxml undefined.length 渲染错)', () => {
    const bad = { ...sampleA, knowledgePoints: undefined as unknown as string[] };
    const s = deriveLandingState([bad], kpiOk);
    expect(s.samples[0].knowledgePoints).toEqual([]);
  });

  it('KPI 0 值 → 字段 "0.0" / "0" / "0" (用户视角"暂无数据"非"NaN")', () => {
    const s = deriveLandingState([sampleA], {
      cumulativeQuestions: 0,
      dailyAnalyses: 0,
      happyUsers: 0,
    });
    expect(s.kpiQuestionsM).toBe('0.0');
    expect(s.kpiDailyK).toBe('0');
    expect(s.kpiUsersK).toBe('0');
  });
});
