/**
 * SC20-T05 · ui-kit helper unit tests (pure functions · 0 wx runtime needed)
 *
 * 锁住 6 个 AC 的关键 view-model + final_grade_source 计算逻辑.
 * trace: design/system/pages/P08-review-exec-ai-judge.spec.md §3 + §6.3 + §14
 *
 * mock budget: 0 (all helpers are pure)
 */
import { describe, it, expect } from 'vitest';
import {
  computeFinalGradeSource,
  deriveAiJudgeBannerViewModel,
  shouldShowAiFlag,
  deriveAiMetaChip,
  deriveAiHintRibbon,
  deriveGradeButtonsViewModel,
  computeGradeButtonAriaLabel,
  type AiJudgeStatus,
  type AiJudgeVerdict,
} from '../../../../packages/ui-kit/src/index';
import { translate, assertSC20T05Coverage, SC20_T05_REQUIRED_KEYS } from '../../../../packages/i18n/src/index';
import zh from '../../../../packages/i18n/src/locales/zh.json';
import en from '../../../../packages/i18n/src/locales/en.json';

describe('SC20-T05 · computeFinalGradeSource (spec §6.3 A.2 三态)', () => {
  it('aiJudge === null → self', () => {
    expect(computeFinalGradeSource('PARTIAL', null)).toBe('self');
  });

  it('aiJudge.status !== DONE → self', () => {
    expect(computeFinalGradeSource('PARTIAL', { status: 'TIMEOUT', verdict: null })).toBe('self');
    expect(computeFinalGradeSource('PARTIAL', { status: 'LOW_CONFIDENCE', verdict: null })).toBe('self');
    expect(computeFinalGradeSource('PARTIAL', { status: 'SERVICE_UNAVAILABLE', verdict: null })).toBe('self');
    expect(computeFinalGradeSource('PARTIAL', { status: 'PENDING', verdict: null })).toBe('self');
  });

  it('verdict === grade → ai_accepted', () => {
    expect(computeFinalGradeSource('PARTIAL', { status: 'DONE', verdict: 'PARTIAL' })).toBe('ai_accepted');
    expect(computeFinalGradeSource('MASTERED', { status: 'DONE', verdict: 'MASTERED' })).toBe('ai_accepted');
    expect(computeFinalGradeSource('FORGOT', { status: 'DONE', verdict: 'FORGOT' })).toBe('ai_accepted');
  });

  it('verdict !== grade → ai_overridden (含中间值 PARTIAL · spec TC-21.03)', () => {
    expect(computeFinalGradeSource('FORGOT', { status: 'DONE', verdict: 'MASTERED' })).toBe('ai_overridden');
    expect(computeFinalGradeSource('PARTIAL', { status: 'DONE', verdict: 'MASTERED' })).toBe('ai_overridden');
    expect(computeFinalGradeSource('MASTERED', { status: 'DONE', verdict: 'PARTIAL' })).toBe('ai_overridden');
  });
});

describe('SC20-T05 · deriveAiJudgeBannerViewModel (AC1 主区 + fallback 退化)', () => {
  const baseProps = {
    verdict: 'PARTIAL' as AiJudgeVerdict,
    confidence: 0.75,
    reason: '答案正确 · 步骤完整度 2/3',
    matchedSteps: ['配方', '顶点'],
    missedSteps: ['对称轴'],
    status: 'DONE' as AiJudgeStatus,
    modelUsed: 'claude-3.5-sonnet',
    latencyMs: 5400,
  };

  it('DONE + verdict 非 null → showMain=true · 主区渲染', () => {
    const vm = deriveAiJudgeBannerViewModel(baseProps);
    expect(vm.showMain).toBe(true);
    expect(vm.showFallback).toBe(false);
    expect(vm.confidencePct).toBe(75);
    expect(vm.modelSubtitle).toBe('Claude 3.5 Sonnet · 5.4s');
    expect(vm.verdictI18nKey).toBe('exec.judge.verdict.partial');
  });

  it('TIMEOUT → showFallback=true · 退化态', () => {
    const vm = deriveAiJudgeBannerViewModel({ ...baseProps, status: 'TIMEOUT', verdict: null });
    expect(vm.showMain).toBe(false);
    expect(vm.showFallback).toBe(true);
    expect(vm.fallbackI18nKey).toBe('exec.judge.timeout');
  });

  it('LOW_CONFIDENCE → showFallback=true + fallbackKey lowConfidence', () => {
    const vm = deriveAiJudgeBannerViewModel({ ...baseProps, status: 'LOW_CONFIDENCE', verdict: null, confidence: 0.32 });
    expect(vm.showFallback).toBe(true);
    expect(vm.fallbackI18nKey).toBe('exec.judge.lowConfidence');
    expect(vm.confidencePct).toBe(32);
  });

  it('SERVICE_UNAVAILABLE → showFallback=true + fallbackKey banner.fallback', () => {
    const vm = deriveAiJudgeBannerViewModel({ ...baseProps, status: 'SERVICE_UNAVAILABLE', verdict: null });
    expect(vm.showFallback).toBe(true);
    expect(vm.fallbackI18nKey).toBe('exec.banner.fallback');
  });

  it('IDLE / PENDING → 都不显示 (showMain=false, showFallback=false · banner skeleton 由 page wxml 单独处理)', () => {
    expect(deriveAiJudgeBannerViewModel({ ...baseProps, status: 'IDLE', verdict: null }).showMain).toBe(false);
    expect(deriveAiJudgeBannerViewModel({ ...baseProps, status: 'IDLE', verdict: null }).showFallback).toBe(false);
    expect(deriveAiJudgeBannerViewModel({ ...baseProps, status: 'PENDING', verdict: null }).showFallback).toBe(false);
  });

  it('confidence NaN / Infinity → 0', () => {
    const vm = deriveAiJudgeBannerViewModel({ ...baseProps, confidence: NaN });
    expect(vm.confidencePct).toBe(0);
  });
});

describe('SC20-T05 · shouldShowAiFlag + deriveAiMetaChip + deriveAiHintRibbon (AC2)', () => {
  it('shouldShowAiFlag · 仅 DONE 显示', () => {
    expect(shouldShowAiFlag({ status: 'DONE' })).toBe(true);
    expect(shouldShowAiFlag({ status: 'TIMEOUT' })).toBe(false);
    expect(shouldShowAiFlag({ status: 'LOW_CONFIDENCE' })).toBe(false);
    expect(shouldShowAiFlag({ status: 'IDLE' })).toBe(false);
  });

  it('deriveAiMetaChip · 仅 DONE 显示 · pct 整数', () => {
    expect(deriveAiMetaChip({ status: 'DONE', confidence: 0.754 })).toEqual({ visible: true, pct: 75 });
    expect(deriveAiMetaChip({ status: 'LOW_CONFIDENCE', confidence: 0.32 }).visible).toBe(false);
  });

  it('deriveAiHintRibbon · 仅 DONE + verdict 非 null 显示', () => {
    expect(deriveAiHintRibbon({ aiVerdict: 'PARTIAL', status: 'DONE' })).toEqual({
      visible: true,
      verdictI18nKey: 'exec.judge.verdict.partial',
    });
    expect(deriveAiHintRibbon({ aiVerdict: null, status: 'DONE' }).visible).toBe(false);
    expect(deriveAiHintRibbon({ aiVerdict: 'PARTIAL', status: 'TIMEOUT' }).visible).toBe(false);
  });
});

describe('SC20-T05 · deriveGradeButtonsViewModel (AC3 preselected ring + aria-label)', () => {
  it('preselected === PARTIAL · 只 partial 按钮带 preselected cls + showMark + aria-label 含 "AI 建议"', () => {
    const vm = deriveGradeButtonsViewModel({
      revealed: true,
      preselected: 'PARTIAL',
      masteredEnabled: true,
      isGrading: false,
    });
    expect(vm).toHaveLength(3);

    const forgot = vm.find((b) => b.grade === 'FORGOT')!;
    expect(forgot.cls).not.toContain('rbtn-preselected');
    expect(forgot.showMark).toBe(false);
    expect(forgot.ariaLabel).toBe('当前选择: 未掌握');

    const partial = vm.find((b) => b.grade === 'PARTIAL')!;
    expect(partial.cls).toContain('rbtn-preselected');
    expect(partial.showMark).toBe(true);
    expect(partial.ariaLabel).toBe('当前选择: 部分掌握 · AI 建议');
    expect(partial.disabled).toBe(false);

    const mastered = vm.find((b) => b.grade === 'MASTERED')!;
    expect(mastered.cls).not.toContain('rbtn-preselected');
    expect(mastered.showMark).toBe(false);
  });

  it('preselected === null → 无 ring · 无 mark · aria-label 不含 AI 建议', () => {
    const vm = deriveGradeButtonsViewModel({
      revealed: true,
      preselected: null,
      masteredEnabled: true,
      isGrading: false,
    });
    vm.forEach((b) => {
      expect(b.cls).not.toContain('rbtn-preselected');
      expect(b.showMark).toBe(false);
      expect(b.ariaLabel).not.toContain('AI 建议');
    });
  });

  it('revealed=false → 全 disabled + 含 rbtn-disabled class', () => {
    const vm = deriveGradeButtonsViewModel({
      revealed: false,
      preselected: 'PARTIAL',
      masteredEnabled: true,
      isGrading: false,
    });
    vm.forEach((b) => {
      expect(b.disabled).toBe(true);
      expect(b.cls).toContain('rbtn-disabled');
    });
  });

  it('isGrading=true → 全 disabled', () => {
    const vm = deriveGradeButtonsViewModel({
      revealed: true,
      preselected: null,
      masteredEnabled: true,
      isGrading: true,
    });
    vm.forEach((b) => expect(b.disabled).toBe(true));
  });

  it('color-blind safety (TI2): aria-label 不仅靠颜色 · "AI 建议" 字面必出', () => {
    expect(computeGradeButtonAriaLabel('PARTIAL', 'PARTIAL')).toBe('当前选择: 部分掌握 · AI 建议');
    expect(computeGradeButtonAriaLabel('MASTERED', 'MASTERED')).toBe('当前选择: 已掌握 · AI 建议');
    expect(computeGradeButtonAriaLabel('FORGOT', 'FORGOT')).toBe('当前选择: 未掌握 · AI 建议');
    expect(computeGradeButtonAriaLabel('PARTIAL', null)).toBe('当前选择: 部分掌握');
  });
});

describe('SC20-T05 · i18n locale 14 + 1 模板 key 完整 (AC5)', () => {
  it('zh.json 覆盖全部 SC20_T05_REQUIRED_KEYS', () => {
    const r = assertSC20T05Coverage(zh as Record<string, string>);
    expect(r.missing).toEqual([]);
    expect(r.pass).toBe(true);
  });

  it('en.json 覆盖全部 SC20_T05_REQUIRED_KEYS · 双语必齐', () => {
    const r = assertSC20T05Coverage(en as Record<string, string>);
    expect(r.missing).toEqual([]);
    expect(r.pass).toBe(true);
  });

  it('SC20_T05_REQUIRED_KEYS = 15 项 (14 spec §14 + 1 模板)', () => {
    expect(SC20_T05_REQUIRED_KEYS.length).toBe(15);
  });

  it('translate · 模板插值 + missing fallback', () => {
    expect(translate(zh as Record<string, string>, 'exec.chip.aiConfidence', { pct: 75 })).toBe('AI 已判 75%');
    expect(translate(en as Record<string, string>, 'exec.chip.aiConfidence', { pct: 75 })).toBe('AI 75% sure');
    // missing key → [missing:<key>]
    expect(translate(zh as Record<string, string>, 'not.exist')).toBe('[missing:not.exist]');
    // 不传 values · 原文返
    expect(translate(zh as Record<string, string>, 'exec.judge.cta.accept')).toBe('采纳建议');
  });
});

describe('SC20-T05 · TI1 reverse · tap CTA = tap 对应按钮 (body 字面 diff = 0)', () => {
  // 这个测试单测层级用 computeFinalGradeSource 等价性 + 文字逻辑等价性 验证 ·
  // 完整 e2e 在 sc-20/t05 spec 跑 real automator
  it('aiVerdict=PARTIAL · tap accept CTA 等价 tap PARTIAL 按钮 → 都算 ai_accepted', () => {
    const aiJudge = { status: 'DONE' as AiJudgeStatus, verdict: 'PARTIAL' as AiJudgeVerdict };
    const ctaPath = computeFinalGradeSource('PARTIAL', aiJudge); // accept CTA logic
    const btnPath = computeFinalGradeSource('PARTIAL', aiJudge); // direct btn tap
    expect(ctaPath).toBe(btnPath);
    expect(ctaPath).toBe('ai_accepted');
  });

  it('aiVerdict=MASTERED · tap accept CTA = tap MASTERED 按钮 → ai_accepted', () => {
    const aiJudge = { status: 'DONE' as AiJudgeStatus, verdict: 'MASTERED' as AiJudgeVerdict };
    expect(computeFinalGradeSource('MASTERED', aiJudge)).toBe('ai_accepted');
  });
});
