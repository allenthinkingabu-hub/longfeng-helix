/**
 * SC22-T01 · AiJudgeBanner LOW_CONFIDENCE / TIMEOUT 退化 polish unit tests
 *
 * 锁住:
 * - AC1 LOW_CONFIDENCE 退化策略 (banner 主区不显 + fallback 渲染 + GradeButtons preselected=null)
 * - AC2 TIMEOUT 退化策略 + 视觉差 (fallbackKind='timeout')
 * - AC3 GradeButtons preselected=null 时不渲染 ring (色盲友好 · KI 学生主体性)
 * - AC4 视觉 polish: fallbackKind 区分 lowConfidence (灰) / timeout (红) / unavailable (灰)
 * - AC5 i18n 新增 2 key (lowConfidence.hint + timeout.icon) 中英双语 + assert function
 *
 * trace: biz/features/M-AI-ANSWER-JUDGE__ai-answer-judge.md §2B.22 SC-22
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
import { assertSC22T01Coverage, SC22_T01_REQUIRED_KEYS } from '../../../../packages/i18n/src/index';
import zh from '../../../../packages/i18n/src/locales/zh.json';
import en from '../../../../packages/i18n/src/locales/en.json';

describe('SC22-T01 · AC1 LOW_CONFIDENCE 退化策略 (biz §2B.22 step 2)', () => {
  const baseProps = {
    verdict: null as AiJudgeVerdict | null,
    confidence: 0.32,
    reason: '',
    matchedSteps: [] as string[],
    missedSteps: [] as string[],
    status: 'LOW_CONFIDENCE' as AiJudgeStatus,
    modelUsed: 'claude-3.5-sonnet',
    latencyMs: 6200,
  };

  it('LOW_CONFIDENCE · showMain=false (不显 verdict chip + reason + CTA)', () => {
    const vm = deriveAiJudgeBannerViewModel(baseProps);
    expect(vm.showMain).toBe(false);
    expect(vm.showFallback).toBe(true);
    expect(vm.verdictI18nKey).toBeNull();
  });

  it('LOW_CONFIDENCE · fallbackI18nKey === "exec.judge.lowConfidence"', () => {
    const vm = deriveAiJudgeBannerViewModel(baseProps);
    expect(vm.fallbackI18nKey).toBe('exec.judge.lowConfidence');
  });

  it('LOW_CONFIDENCE · fallbackKind === "lowConfidence" (wxss class · 灰色文案)', () => {
    const vm = deriveAiJudgeBannerViewModel(baseProps);
    expect(vm.fallbackKind).toBe('lowConfidence');
  });

  it('LOW_CONFIDENCE · GradeButtons preselected=null · 3 按钮无 ring (KI 学生主体性)', () => {
    const btns = deriveGradeButtonsViewModel({
      revealed: true,
      preselected: null,
      masteredEnabled: true,
      isGrading: false,
    });
    expect(btns).toHaveLength(3);
    btns.forEach((b) => {
      expect(b.cls).not.toContain('rbtn-preselected');
      expect(b.showMark).toBe(false);
      expect(b.ariaLabel).not.toContain('AI 建议');
    });
  });
});

describe('SC22-T01 · AC2 TIMEOUT 退化策略 (biz §2B.22 TC-22.02)', () => {
  const baseProps = {
    verdict: null as AiJudgeVerdict | null,
    confidence: 0,
    reason: '',
    matchedSteps: [] as string[],
    missedSteps: [] as string[],
    status: 'TIMEOUT' as AiJudgeStatus,
    modelUsed: 'fallback-timeout',
    latencyMs: 18000,
  };

  it('TIMEOUT · showMain=false · showFallback=true', () => {
    const vm = deriveAiJudgeBannerViewModel(baseProps);
    expect(vm.showMain).toBe(false);
    expect(vm.showFallback).toBe(true);
  });

  it('TIMEOUT · fallbackI18nKey === "exec.judge.timeout"', () => {
    const vm = deriveAiJudgeBannerViewModel(baseProps);
    expect(vm.fallbackI18nKey).toBe('exec.judge.timeout');
  });

  it('TIMEOUT · fallbackKind === "timeout" (wxss class · 红色 + ⏱)', () => {
    const vm = deriveAiJudgeBannerViewModel(baseProps);
    expect(vm.fallbackKind).toBe('timeout');
  });

  it('TIMEOUT · GradeButtons preselected=null (与 LOW_CONFIDENCE 同 · A.3 优雅降级)', () => {
    const btns = deriveGradeButtonsViewModel({
      revealed: true,
      preselected: null,
      masteredEnabled: true,
      isGrading: false,
    });
    btns.forEach((b) => {
      expect(b.cls).not.toContain('rbtn-preselected');
    });
  });
});

describe('SC22-T01 · SERVICE_UNAVAILABLE 退化策略 (sibling SC22-T02 503 路径)', () => {
  const baseProps = {
    verdict: null as AiJudgeVerdict | null,
    confidence: 0,
    reason: '',
    matchedSteps: [] as string[],
    missedSteps: [] as string[],
    status: 'SERVICE_UNAVAILABLE' as AiJudgeStatus,
    modelUsed: '',
    latencyMs: 0,
  };

  it('SERVICE_UNAVAILABLE · fallbackKind === "unavailable" (wxss class · 灰色 + ⚠)', () => {
    const vm = deriveAiJudgeBannerViewModel(baseProps);
    expect(vm.fallbackKind).toBe('unavailable');
  });

  it('SERVICE_UNAVAILABLE · fallbackI18nKey === "exec.banner.fallback"', () => {
    const vm = deriveAiJudgeBannerViewModel(baseProps);
    expect(vm.fallbackI18nKey).toBe('exec.banner.fallback');
  });
});

describe('SC22-T01 · AC3 + TI3 · final_grade_source 退化态 (学生 tap = self)', () => {
  it('LOW_CONFIDENCE + grade=PARTIAL → final_grade_source=self (biz §2B.22 line 213 关键断言)', () => {
    const src = computeFinalGradeSource('PARTIAL', {
      status: 'LOW_CONFIDENCE',
      verdict: null,
    });
    expect(src).toBe('self');
  });

  it('TIMEOUT + grade=PARTIAL → final_grade_source=self (biz §2B.22 TC-22.02 关键断言)', () => {
    const src = computeFinalGradeSource('PARTIAL', {
      status: 'TIMEOUT',
      verdict: null,
    });
    expect(src).toBe('self');
  });

  it('SERVICE_UNAVAILABLE + grade=FORGOT → final_grade_source=self (sibling SC22-T02 503 路径)', () => {
    const src = computeFinalGradeSource('FORGOT', {
      status: 'SERVICE_UNAVAILABLE',
      verdict: null,
    });
    expect(src).toBe('self');
  });

  it('DONE base case · 验确 sibling SC20-T05 ai_accepted 路径未破坏 (向后兼容)', () => {
    expect(computeFinalGradeSource('PARTIAL', { status: 'DONE', verdict: 'PARTIAL' })).toBe('ai_accepted');
    expect(computeFinalGradeSource('FORGOT', { status: 'DONE', verdict: 'MASTERED' })).toBe('ai_overridden');
  });
});

describe('SC22-T01 · AC4 · 视觉 polish fallbackKind 3 态独立 + flag/chip/hint 退化', () => {
  it('退化态 (LOW_CONFIDENCE) · aiFlag 不显 · metaChip 不显 · hintRibbon 不显 (sibling SC20-T05 已实装)', () => {
    expect(shouldShowAiFlag({ status: 'LOW_CONFIDENCE' })).toBe(false);
    const chip = deriveAiMetaChip({ status: 'LOW_CONFIDENCE', confidence: 0.32 });
    expect(chip.visible).toBe(false);
    const hint = deriveAiHintRibbon({ aiVerdict: null, status: 'LOW_CONFIDENCE' });
    expect(hint.visible).toBe(false);
  });

  it('退化态 (TIMEOUT) · aiFlag 不显 · metaChip 不显 · hintRibbon 不显', () => {
    expect(shouldShowAiFlag({ status: 'TIMEOUT' })).toBe(false);
    expect(deriveAiMetaChip({ status: 'TIMEOUT', confidence: 0 }).visible).toBe(false);
    expect(deriveAiHintRibbon({ aiVerdict: null, status: 'TIMEOUT' }).visible).toBe(false);
  });

  it('DONE base case · aiFlag 显 · metaChip 显 · hintRibbon 显 (向后兼容 SC20-T05)', () => {
    expect(shouldShowAiFlag({ status: 'DONE' })).toBe(true);
    expect(deriveAiMetaChip({ status: 'DONE', confidence: 0.75 }).visible).toBe(true);
    expect(deriveAiHintRibbon({ aiVerdict: 'PARTIAL', status: 'DONE' }).visible).toBe(true);
  });

  it('3 个 fallbackKind 与 status 1:1 映射 (穷举校验 · 防 silent fork)', () => {
    const cases: Array<[AiJudgeStatus, 'lowConfidence' | 'timeout' | 'unavailable' | null]> = [
      ['LOW_CONFIDENCE', 'lowConfidence'],
      ['TIMEOUT', 'timeout'],
      ['SERVICE_UNAVAILABLE', 'unavailable'],
      ['DONE', null],
      ['IDLE', null],
      ['PENDING', null],
    ];
    cases.forEach(([status, expectedKind]) => {
      const vm = deriveAiJudgeBannerViewModel({
        verdict: status === 'DONE' ? 'PARTIAL' : null,
        confidence: 0.5,
        reason: '',
        matchedSteps: [],
        missedSteps: [],
        status,
        modelUsed: '',
        latencyMs: 0,
      });
      expect(vm.fallbackKind).toBe(expectedKind);
    });
  });
});

describe('SC22-T01 · AC5 · i18n 2 新 key (lowConfidence.hint + timeout.icon) 双语 + assert', () => {
  it('zh.json 含 SC22-T01 2 key', () => {
    const result = assertSC22T01Coverage(zh);
    expect(result.pass).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('en.json 含 SC22-T01 2 key', () => {
    const result = assertSC22T01Coverage(en);
    expect(result.pass).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('SC22_T01_REQUIRED_KEYS 字面锁 2 key (biz §2B.22 视觉 polish)', () => {
    expect(SC22_T01_REQUIRED_KEYS).toEqual([
      'exec.judge.lowConfidence.hint',
      'exec.judge.timeout.icon',
    ]);
  });

  it('zh lowConfidence.hint 字面非空 + 含 "AI"', () => {
    expect(zh['exec.judge.lowConfidence.hint']).toBeDefined();
    expect(zh['exec.judge.lowConfidence.hint'].length).toBeGreaterThan(0);
    expect(zh['exec.judge.lowConfidence.hint']).toContain('AI');
  });

  it('zh timeout.icon === "⏱"', () => {
    expect(zh['exec.judge.timeout.icon']).toBe('⏱');
  });
});

describe('SC22-T01 · KI 学生主体性 · aria-label 不含 "AI 建议" 当 preselected=null', () => {
  it('preselected=null 时 GradeButtons aria-label 不含 AI 建议字面 (色盲友好)', () => {
    const btns = deriveGradeButtonsViewModel({
      revealed: true,
      preselected: null,
      masteredEnabled: true,
      isGrading: false,
    });
    btns.forEach((b) => {
      expect(b.ariaLabel.indexOf('AI 建议')).toBe(-1);
    });
  });

  it('computeGradeButtonAriaLabel 退化态 (preselected=null) 不含 "AI 建议"', () => {
    const labelForgot = computeGradeButtonAriaLabel('FORGOT', null);
    const labelPartial = computeGradeButtonAriaLabel('PARTIAL', null);
    const labelMastered = computeGradeButtonAriaLabel('MASTERED', null);
    expect(labelForgot.indexOf('AI 建议')).toBe(-1);
    expect(labelPartial.indexOf('AI 建议')).toBe(-1);
    expect(labelMastered.indexOf('AI 建议')).toBe(-1);
  });
});
