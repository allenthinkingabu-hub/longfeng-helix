/**
 * MP-CATCHUP-B-WELCOME · welcome page pure helpers · state machine
 * 0 mock · 0 wx · 0 HTTP · 100% pass
 *
 * 验证 spec §6 状态机 5 态 + 派生 VM 字段 (subjectKey/subjectLabel/kpJoined/tnLabel)
 * 2026-05-18 重写: KPI 改静态性能信号 · showKpi 始终 true · sample VM 扩展 mockup-aligned 字段
 *
 * Tests verify INTENT (CLAUDE.md Rule 9): each test names why this transition
 * matters to the user — not just that the code runs.
 */
import { describe, it, expect } from 'vitest';
import { deriveLandingState } from '../../pages/welcome/helpers';
import type { LandingSample, KpiResponse } from '../../src/api/landing';

const sampleMath: LandingSample = {
  subject: '数学',
  stemText: 'f(x)=2x²-3x+1',
  knowledgePoints: ['二次函数', '配方法'],
  errorReason: '顶点公式',
  correction: 'x=3/4',
};
const sampleEng: LandingSample = {
  subject: '英语',
  stemText: 'goes to school',
  knowledgePoints: ['一般现在时'],
  errorReason: '主谓一致',
  correction: 'goes',
};
const samplePhys: LandingSample = {
  subject: '物理',
  stemText: '5N 拉力 匀速',
  knowledgePoints: ['摩擦力'],
  errorReason: '匀速时合外力为零',
  correction: '摩擦力大于拉力',
};
const kpiOk: KpiResponse = {
  cumulativeQuestions: 12_500_000,
  dailyAnalyses: 84_000,
  happyUsers: 320_000,
};

describe('deriveLandingState · §6 状态机 happy path', () => {
  it('samples+kpi both OK → phase=READY · sections visible · no banner', () => {
    const s = deriveLandingState([sampleMath, sampleEng], kpiOk);
    expect(s.phase).toBe('READY');
    expect(s.showSamples).toBe(true);
    expect(s.showKpi).toBe(true);
    expect(s.showDegradedBanner).toBe(false);
    expect(s.degradedMsg).toBe('');
    expect(s.samples.length).toBe(2);
    expect(s.samples[0].subject).toBe('数学');
    expect(s.kpi).toEqual(kpiOk);
  });

  it('KPI 千分化 backward-compat: 12.5M / 84K / 320K', () => {
    const s = deriveLandingState([sampleMath], kpiOk);
    expect(s.kpiQuestionsM).toBe('12.5');
    expect(s.kpiDailyK).toBe('84');
    expect(s.kpiUsersK).toBe('320');
  });
});

describe('deriveLandingState · VM mockup-aligned 字段 (P-LANDING-landing.spec.md §3)', () => {
  it('数学 sample → subjectKey=math · subjectLabel="数学 · 高一"', () => {
    const s = deriveLandingState([sampleMath], kpiOk);
    expect(s.samples[0].subjectKey).toBe('math');
    expect(s.samples[0].subjectLabel).toBe('数学 · 高一');
  });

  it('物理 sample → subjectKey=phys · subjectLabel="物理 · 高二"', () => {
    const s = deriveLandingState([samplePhys], kpiOk);
    expect(s.samples[0].subjectKey).toBe('phys');
    expect(s.samples[0].subjectLabel).toBe('物理 · 高二');
  });

  it('英语 sample → subjectKey=eng · subjectLabel="英语 · 初三"', () => {
    const s = deriveLandingState([sampleEng], kpiOk);
    expect(s.samples[0].subjectKey).toBe('eng');
    expect(s.samples[0].subjectLabel).toBe('英语 · 初三');
  });

  it('未知 subject → subjectKey=default · subjectLabel=raw subject (防色块缺失崩页)', () => {
    const unknown: LandingSample = { ...sampleMath, subject: '化学' };
    const s = deriveLandingState([unknown], kpiOk);
    expect(s.samples[0].subjectKey).toBe('default');
    expect(s.samples[0].subjectLabel).toBe('化学');
  });

  it('Tn chip 按 sample index 分配 (T1 1h / T2 1d / T3 3d) · mockup line 170/181/192', () => {
    const s = deriveLandingState([sampleMath, samplePhys, sampleEng], kpiOk);
    expect(s.samples[0].tnLabel).toMatch(/T1.*1h/);
    expect(s.samples[1].tnLabel).toMatch(/T2.*1d/);
    expect(s.samples[2].tnLabel).toMatch(/T3.*3d/);
  });

  it('kpJoined 取前 2 个 KP · " / " 拼接 (防超长卡溢出 · mockup `.kp` 2 行 clamp)', () => {
    const triple: LandingSample = { ...sampleMath, knowledgePoints: ['A', 'B', 'C'] };
    const s = deriveLandingState([triple], kpiOk);
    expect(s.samples[0].kpJoined).toBe('A / B');
  });
});

describe('deriveLandingState · §6 状态机 降级路径', () => {
  it('samples reject + kpi OK → DEGRADED-samples · banner 文案聚焦"样例"', () => {
    // 用户视角: samples 加载失败时, KPI 是静态性能信号永远显示 ·
    // 不应该让 "样例挂了" = "整页坏了" 错感.
    const s = deriveLandingState(undefined, kpiOk);
    expect(s.phase).toBe('DEGRADED-samples');
    expect(s.showSamples).toBe(false);
    expect(s.showKpi).toBe(true);
    expect(s.showDegradedBanner).toBe(true);
    expect(s.degradedMsg).toMatch(/样例加载失败/);
    expect(s.samples.length).toBe(0);
    expect(s.kpi).toEqual(kpiOk);
  });

  it('samples OK + kpi reject → DEGRADED-kpi · samples 仍渲染 · KPI 静态信号仍显', () => {
    // 用户视角: KPI 改静态性能信号 · 不绑后端 LandingKpiDto · kpi fetch fail 不影响渲染
    // (spec drift fix · 2026-05-18 重写)
    const s = deriveLandingState([sampleMath], undefined);
    expect(s.phase).toBe('DEGRADED-kpi');
    expect(s.showSamples).toBe(true);
    expect(s.showKpi).toBe(true); // 静态 KPI 永远显
    expect(s.showDegradedBanner).toBe(false); // KPI 降级不显 banner (静默)
    expect(s.samples.length).toBe(1);
    expect(s.kpi).toBeNull();
    // KPI 千分化字段在无 KPI 时仍返默认值 (防 wxml undefined error)
    expect(s.kpiQuestionsM).toBe('0.0');
  });

  it('samples + kpi 双 reject → DEGRADED-both · banner 提示 CTA 仍可点', () => {
    // 用户视角: 网络完全坏的时候, CTA 必须仍可点 (biz §2A.3.2 性能预算:
    // CTA 1.5s 内可点 · 即使 DEGRADED 也能进入下游游客流).
    const s = deriveLandingState(undefined, undefined);
    expect(s.phase).toBe('DEGRADED-both');
    expect(s.showSamples).toBe(false);
    expect(s.showKpi).toBe(true); // 静态 KPI 仍显
    expect(s.showDegradedBanner).toBe(true);
    expect(s.degradedMsg).toMatch(/试试看/);
    expect(s.samples).toEqual([]);
    expect(s.kpi).toBeNull();
  });
});

describe('deriveLandingState · 边界 / 防御性 (Tester 视角)', () => {
  it('samples 数组为空仍算 OK · phase=READY · 但 samples.length=0', () => {
    // 后端真返 [] (合法响应) 不应 silent 触发 DEGRADED ·
    // "服务在线但暂无样例" ≠ "服务挂了"
    const s = deriveLandingState([], kpiOk);
    expect(s.phase).toBe('READY');
    expect(s.showSamples).toBe(true);
    expect(s.samples.length).toBe(0);
  });

  it('sample 缺 knowledgePoints 字段 → 派生为空数组 + kpJoined 空串 (防 wxml undefined.length 崩)', () => {
    const bad = { ...sampleMath, knowledgePoints: undefined as unknown as string[] };
    const s = deriveLandingState([bad], kpiOk);
    expect(s.samples[0].knowledgePoints).toEqual([]);
    expect(s.samples[0].kpJoined).toBe('');
  });

  it('KPI 0 值 → 字段 "0.0" / "0" / "0" (用户视角"暂无数据"非"NaN")', () => {
    const s = deriveLandingState([sampleMath], {
      cumulativeQuestions: 0,
      dailyAnalyses: 0,
      happyUsers: 0,
    });
    expect(s.kpiQuestionsM).toBe('0.0');
    expect(s.kpiDailyK).toBe('0');
    expect(s.kpiUsersK).toBe('0');
  });
});
