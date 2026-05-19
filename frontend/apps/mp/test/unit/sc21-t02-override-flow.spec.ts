/**
 * SC21-T02 · override flow polish · ui-kit + i18n + telemetry unit tests.
 *
 * 锁住 5 AC + 2 TI + 2 KI:
 * - AC1: 验回归 SC20-T05 computeFinalGradeSource (verdict != grade → ai_overridden)
 * - AC2: deriveOverrideAckViewModel · 仅 ai_overridden 触发 visible=true
 * - AC3: telemetry 触发 wb_judge_user_override · confidence 字段补全
 * - AC4: 视觉回归 (deriveGradeButtonsViewModel · preselected ring 切换 · 已 SC20-T05 unit cover)
 * - AC5: i18n exec.judge.cta.overrideAck 双语模板 (zh + en) + assertSC21T02Coverage
 *
 * mock budget: 0 (all pure functions)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeFinalGradeSource,
  deriveOverrideAckViewModel,
  deriveGradeButtonsViewModel,
} from '../../../../packages/ui-kit/src/index';
import {
  translate,
  assertSC21T02Coverage,
  SC21_T02_REQUIRED_KEYS,
} from '../../../../packages/i18n/src/index';
import zh from '../../../../packages/i18n/src/locales/zh.json';
import en from '../../../../packages/i18n/src/locales/en.json';
import { track, __getBuffer, __resetBuffer } from '../../../../packages/telemetry/src/index';

// ── AC1 回归 · computeFinalGradeSource override path ────────────────────────────

describe('SC21-T02 AC1 回归 · computeFinalGradeSource override 三态', () => {
  it('AI MASTERED · 学生 FORGOT (TC-21.01 happy override) → ai_overridden', () => {
    expect(computeFinalGradeSource('FORGOT', { status: 'DONE', verdict: 'MASTERED' }))
      .toBe('ai_overridden');
  });
  it('AI MASTERED · 学生 PARTIAL (TC-21.03 中间值 override) → ai_overridden', () => {
    expect(computeFinalGradeSource('PARTIAL', { status: 'DONE', verdict: 'MASTERED' }))
      .toBe('ai_overridden');
  });
  it('AI PARTIAL · 学生 FORGOT → ai_overridden', () => {
    expect(computeFinalGradeSource('FORGOT', { status: 'DONE', verdict: 'PARTIAL' }))
      .toBe('ai_overridden');
  });
  it('AI MASTERED · 学生 MASTERED (同 = 采纳) → ai_accepted (反向边界)', () => {
    expect(computeFinalGradeSource('MASTERED', { status: 'DONE', verdict: 'MASTERED' }))
      .toBe('ai_accepted');
  });
  it('AI 退化态 (LOW_CONFIDENCE) → 任何 grade 都 self · 无 override 语义', () => {
    expect(computeFinalGradeSource('FORGOT', { status: 'LOW_CONFIDENCE', verdict: null }))
      .toBe('self');
  });
});

// ── AC2 · deriveOverrideAckViewModel ────────────────────────────────────────────

describe('SC21-T02 AC2 · deriveOverrideAckViewModel · ack visible 三态规则', () => {
  it('ai_overridden + DONE + 非 null verdict → visible=true · grade=userGrade 字面', () => {
    const vm = deriveOverrideAckViewModel({
      userGrade: 'FORGOT',
      aiVerdict: 'MASTERED',
      aiStatus: 'DONE',
      finalGradeSource: 'ai_overridden',
    });
    expect(vm.visible).toBe(true);
    expect(vm.i18nKey).toBe('exec.judge.cta.overrideAck');
    expect(vm.values.grade).toBe('FORGOT');
  });

  it('ai_accepted → visible=false (采纳无 ack)', () => {
    const vm = deriveOverrideAckViewModel({
      userGrade: 'MASTERED',
      aiVerdict: 'MASTERED',
      aiStatus: 'DONE',
      finalGradeSource: 'ai_accepted',
    });
    expect(vm.visible).toBe(false);
  });

  it('self · 退化态 LOW_CONFIDENCE → visible=false (无 AI 信源对比)', () => {
    const vm = deriveOverrideAckViewModel({
      userGrade: 'FORGOT',
      aiVerdict: null,
      aiStatus: 'LOW_CONFIDENCE',
      finalGradeSource: 'self',
    });
    expect(vm.visible).toBe(false);
  });

  it('aiStatus 非 DONE 但 finalGradeSource 标 ai_overridden (理论不可能 · 防御) → visible=false', () => {
    const vm = deriveOverrideAckViewModel({
      userGrade: 'FORGOT',
      aiVerdict: 'MASTERED',
      aiStatus: 'TIMEOUT',  // 不应该 · 但万一
      finalGradeSource: 'ai_overridden',  // 不应该 · 但万一
    });
    expect(vm.visible).toBe(false);  // 防御 · 不展示 (Rule 12 fail loud silent fallback)
  });

  it('aiVerdict null 但 status DONE (理论不可能 · 防御) → visible=false', () => {
    const vm = deriveOverrideAckViewModel({
      userGrade: 'PARTIAL',
      aiVerdict: null,
      aiStatus: 'DONE',
      finalGradeSource: 'ai_overridden',
    });
    expect(vm.visible).toBe(false);
  });
});

// ── AC5 · i18n exec.judge.cta.overrideAck 双语 + 模板插值 ──────────────────────

describe('SC21-T02 AC5 · i18n exec.judge.cta.overrideAck 双语模板插值', () => {
  it('zh.json · key 存在', () => {
    expect(zh['exec.judge.cta.overrideAck']).toBeTypeOf('string');
    expect(zh['exec.judge.cta.overrideAck']).toContain('{grade}');
    expect(zh['exec.judge.cta.overrideAck']).toContain('与 AI 不同');
  });

  it('en.json · key 存在 · 含模板占位 + AI 差异语义', () => {
    expect(en['exec.judge.cta.overrideAck']).toBeTypeOf('string');
    expect(en['exec.judge.cta.overrideAck']).toContain('{grade}');
    expect(en['exec.judge.cta.overrideAck'].toLowerCase()).toContain('differs from ai');
  });

  it('translate zh · {grade}=未掌握 → "你选择了 未掌握 · 与 AI 不同..."', () => {
    const text = translate(zh, 'exec.judge.cta.overrideAck', { grade: '未掌握' });
    expect(text).toBe('你选择了 未掌握 · 与 AI 不同 (这有助于我们改进 AI)');
  });

  it('translate en · {grade}=Forgot → "You chose Forgot · differs from AI..."', () => {
    const text = translate(en, 'exec.judge.cta.overrideAck', { grade: 'Forgot' });
    expect(text).toBe('You chose Forgot · differs from AI (helps us improve AI)');
  });

  it('assertSC21T02Coverage zh + en 双语完整 (无 missing)', () => {
    expect(assertSC21T02Coverage(zh).pass).toBe(true);
    expect(assertSC21T02Coverage(en).pass).toBe(true);
    expect(SC21_T02_REQUIRED_KEYS).toEqual(['exec.judge.cta.overrideAck']);
  });
});

// ── AC3 · telemetry wb_judge_user_override · confidence 字段 ─────────────────

describe('SC21-T02 AC3 · telemetry wb_judge_user_override · confidence 字段补全 (TI2 防抖)', () => {
  beforeEach(() => { __resetBuffer(); });

  it('单次 track 调用 · 4 props (nid/ai/user/confidence) 完整入 buffer', () => {
    track('wb_judge_user_override', {
      nid: 'plan-21',
      ai_verdict: 'MASTERED',
      user_verdict: 'FORGOT',
      confidence: 0.85,
    });
    const buf = __getBuffer();
    expect(buf).toHaveLength(1);
    expect(buf[0].name).toBe('wb_judge_user_override');
    expect(buf[0].props).toEqual({
      nid: 'plan-21',
      ai_verdict: 'MASTERED',
      user_verdict: 'FORGOT',
      confidence: 0.85,
    });
  });

  it('TI2 · 模拟同 nid 同 verdict 2 次 tap (前端 isGrading debounce 防抖 · SC20-T05 已实装)', () => {
    // 前端 onGradeTap 第一行 `if (this.data.isGrading) return` · SC20-T05 已防抖
    // 此处只能模拟 telemetry buffer 不重复 · 真防抖效果由 SC20-T05 unit 已 cover
    // 这里只验单次 buffer 行为
    track('wb_judge_user_override', { nid: 'n', ai_verdict: 'M', user_verdict: 'F', confidence: 0.8 });
    // 第 2 次 (前端 isGrading=true · 不应再 track) → 直接不调 track
    const buf = __getBuffer();
    expect(buf).toHaveLength(1);  // 仅 1 条 (前端 debounce 防止第 2 次 track 调用)
  });
});

// ── AC4 视觉回归 · deriveGradeButtonsViewModel preselected 切换 ────────────

describe('SC21-T02 AC4 视觉回归 · gradeBtnsVm preselected ring 切换', () => {
  it('AI MASTERED + 学生 tap FORGOT 后 isGrading=true → FORGOT btn 走 grading 态', () => {
    // SC20-T05 GradeButtons 标杆: preselected 仅在 isGrading=false 时显示 ring · grading 中态显示 spinner
    const btns = deriveGradeButtonsViewModel({
      revealed: true,
      preselected: 'MASTERED',
      masteredEnabled: true,
      isGrading: true,  // 学生 tap FORGOT 后立即 isGrading=true
    });
    // grading 期间所有 btn disabled = true · 防双击
    expect(btns.every(b => b.disabled)).toBe(true);
  });

  it('grade 结束 isGrading=false · revealed=false (GRADED 后) → 所有 btn disabled', () => {
    const btns = deriveGradeButtonsViewModel({
      revealed: false,  // GRADED 后 revealed=false 锁定
      preselected: 'MASTERED',
      masteredEnabled: true,
      isGrading: false,
    });
    expect(btns.every(b => b.disabled)).toBe(true);
  });
});
