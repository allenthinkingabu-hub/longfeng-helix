/**
 * P08 · 复习执行（ReviewExec）
 * Mood B · pure-warm · STYLE-TRUTH §3 Mood B
 *
 * 1:1 对齐 design/system/pages/P08-review-exec.spec.md
 *
 * 状态机: READING → ANSWERING → REVEALED → GRADED
 * A11y: aria-live on reveal card, aria-disabled on mastered btn after reveal
 *
 * T11 scope: ANSWERING → REVEALED (tap 揭示答案)
 *   AC1: Tap 揭示按钮 · loading + 触觉 light
 *   AC2: POST /api/review/nodes/{nid}/reveal → 200 · markRevealed(nid)
 *   AC3: 答案卡绿色展开 300ms easeOut + 3 步解法 + 6 节点时间线高亮当前 T (pulse)
 *   AC4: 状态 ANSWERING → REVEALED · 揭示后底部 3 按钮全部可点
 *   TI1: reveal 不改 plan · TI2: reveal 不发 MQ · TI3: mastered btn disabled after reveal
 *   TI4: 埋点 wb_exec_reveal{nid,waitMs}
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { reviewClient } from '@longfeng/api-contracts';
import { TEST_IDS, p08Ids } from '@longfeng/testids';
import { track } from '@longfeng/telemetry';
import s from './ReviewExec.module.css';

// ─── Types ──────────────────────────────────────────────────────
type ExecState = 'READING' | 'ANSWERING' | 'REVEALED' | 'GRADED';

interface QuestionData {
  qid: string;
  stem: string;
  subject: string;
  kpName: string;
  difficulty: number;
  answer: string;
  steps: string[];
}

interface NodeData {
  nid: string;
  nodeIndex: number;
  tLevel: string;
  easeFactor: number;
}

// ─── Mock data (前端 dev 兜底 · 后端未启动时) ──────────────────────
const MOCK_QUESTION: QuestionData = {
  qid: 'mock-qid-001',
  stem: '已知函数 f(x) = x² − 4x + 3，请将其化为顶点式并写出顶点坐标与对称轴方程。',
  subject: 'MATH',
  kpName: '二次函数·顶点式',
  difficulty: 3,
  answer: 'f(x) = (x−2)² − 1，顶点 (2, −1)，对称轴 x = 2',
  steps: [
    '对 f(x) 配方：f(x) = (x² − 4x + 4) + 3 − 4 = (x−2)² − 1',
    '读出顶点 (h, k) = (2, −1)，即顶点坐标为 (2, −1)',
    '对称轴方程 x = h = 2',
  ],
};

const MOCK_NODE: NodeData = {
  nid: '0',
  nodeIndex: 2,
  tLevel: 'T2',
  easeFactor: 2.5,
};

const DIFFICULTY_LABELS = ['', '★', '★★', '★★★', '★★★★', '★★★★★'];
const T_LEVELS = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6'] as const;

// ─── Main Component ──────────────────────────────────────────────

export const ReviewExecPage: React.FC = () => {
  const nav = useNavigate();
  const { nid: rawNid = '0' } = useParams<{ nid: string }>();
  const nid = rawNid;

  // ── State machine ──────────────────────────────────────────
  const [execState, setExecState] = useState<ExecState>('ANSWERING');
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealedAt, setRevealedAt] = useState<string | null>(null);
  const openedAtRef = useRef<number>(Date.now());

  // ── Data (mock for now · T10 will wire real data loading) ──
  const question: QuestionData = MOCK_QUESTION;
  const node: NodeData = useMemo(() => ({ ...MOCK_NODE, nid }), [nid]);
  const cursor = 2;
  const total = 8;
  const progressPct = Math.round((cursor / total) * 100);

  // ── AC1+AC2: Tap reveal → POST /reveal → REVEALED ──────────
  const handleReveal = useCallback(async () => {
    if (execState !== 'ANSWERING' || isRevealing) return;
    setIsRevealing(true);

    // AC1: 触觉 light
    try {
      if ('vibrate' in navigator) navigator.vibrate(10);
    } catch { /* noop */ }

    try {
      // AC2: POST /api/review/nodes/{nid}/reveal → 200
      const resp = await reviewClient.revealNode(nid);
      setRevealedAt(resp.revealedAt ?? new Date().toISOString());
    } catch {
      // spec §9: 502 失败 UI 仍展开答案 (eventually consistent)
      setRevealedAt(new Date().toISOString());
    }

    // AC4: 状态 ANSWERING → REVEALED
    setExecState('REVEALED');
    setIsRevealing(false);

    // TI4: 埋点 wb_exec_reveal{nid, waitMs}
    const waitMs = Date.now() - openedAtRef.current;
    track('wb_exec_reveal', { nid, waitMs });
  }, [execState, isRevealing, nid]);

  // ── Grade handlers (stub for T12 · buttons enabled per AC4) ──
  const handleGrade = useCallback((grade: 'FORGOT' | 'PARTIAL' | 'MASTERED') => {
    // T12 will implement the full grade flow
    // For now just navigate to show the buttons work
    track('wb_exec_grade', { nid, grade, totalMs: Date.now() - openedAtRef.current });
    nav(`/review/done/${nid}`);
  }, [nid, nav]);

  // ── Derived state ──────────────────────────────────────────
  const isRevealed = execState === 'REVEALED' || execState === 'GRADED';
  // TI3 (spec §6.4): 揭示后 mastered btn disabled
  const masteredEnabled = !isRevealed;

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className={s.root} data-testid={TEST_IDS.p08.root} data-mood="B">

      {/* ── Topbar ──────────────────────────────────────────── */}
      <header className={s.topbar} data-testid={TEST_IDS.p08.topbar}>
        <div className={s.topbarLeft}>
          <button className={s.backBtn} onClick={() => nav(-1)} aria-label="返回">
            ‹
          </button>
          <span className={s.topbarTitle} data-testid={TEST_IDS.p08.topbarCursor}>
            复习执行 · 第 {cursor} 题
          </span>
        </div>
        <button
          className={s.closeBtn}
          data-testid={TEST_IDS.p08.closeBtn}
          onClick={() => nav('/')}
          aria-label="关闭"
        >
          ×
        </button>
      </header>

      {/* ── Progress bar ────────────────────────────────────── */}
      <div className={s.progressBar} data-testid={TEST_IDS.p08.progressBar}>
        <div className={s.progressBarFill} style={{ width: `${progressPct}%` }} />
      </div>

      {/* ── Meta chips ──────────────────────────────────────── */}
      <div className={s.metaChips} data-testid={TEST_IDS.p08.metaChips}>
        <span className={s.chipRed}>⬤ {node.tLevel} · 第 {node.nodeIndex + 1} 次</span>
        <span className={s.chipIndigo}>{question.subject} · {question.kpName}</span>
        <span className={s.chipOrange}>难度 {DIFFICULTY_LABELS[question.difficulty]}</span>
      </div>

      {/* ── Question hero ───────────────────────────────────── */}
      <div className={s.questionHero} data-testid={TEST_IDS.p08.questionHero}>
        <div className={s.questionKicker}>错题回顾 · 原题</div>
        <div className={s.questionStem}>{question.stem}</div>
      </div>

      {/* ── Answer area (stub · T10 will implement full canvas) */}
      <div className={s.answerArea} data-testid={TEST_IDS.p08.answerArea}>
        <div className={s.answerLabel}>你的解答 · 手写</div>
        <div className={s.answerCanvas}>
          (作答区域 · 手写/键盘/公式面板)
        </div>
      </div>

      {/* ── Reveal button (hidden after reveal) ──────────────── */}
      {!isRevealed && (
        <div className={s.revealBtnWrap}>
          <button
            className={s.revealBtn}
            data-testid={TEST_IDS.p08.revealBtn}
            onClick={handleReveal}
            disabled={isRevealing || execState !== 'ANSWERING'}
            aria-label="揭示答案"
          >
            {isRevealing ? (
              <><span className={s.spinner} aria-hidden="true" /> 加载中…</>
            ) : (
              <>👁 揭示答案</>
            )}
          </button>
        </div>
      )}

      {/* ── Reveal card (AC3: green expand 300ms easeOut) ───── */}
      <div
        className={`${s.revealCard} ${isRevealed ? s.revealCardVisible : s.revealCardHidden}`}
        data-testid={TEST_IDS.p08.revealContent}
        aria-hidden={!isRevealed}
        aria-live="polite"
      >
        <div className={s.revealCardHeader}>
          <span className={s.revealCheckmark} data-testid={TEST_IDS.p08.revealCheckmark}>✓</span>
          <span className={s.revealTitle}>标准答案</span>
        </div>
        <div className={s.revealAnswer}>{question.answer}</div>
        <div className={s.revealSteps}>
          {question.steps.map((step, i) => (
            <div key={i} className={s.revealStep} data-testid={p08Ids.revealStep(i + 1)}>
              <span className={s.revealStepNum}>{i + 1}</span>
              <span className={s.revealStepText}>{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Memory curve (AC3: 6 节点时间线 · 当前 T pulse) ── */}
      <div className={s.memoryCurve} data-testid={TEST_IDS.p08.memoryCurve}>
        <div className={s.memoryCurveNodes}>
          {T_LEVELS.map((tLevel, i) => {
            const isCurrent = tLevel === node.tLevel;
            const isPast = i < node.nodeIndex;
            let dotClass = s.memoryCurveDot;
            if (isPast) dotClass += ` ${s.memoryCurveDotPast}`;
            if (isCurrent) dotClass += ` ${s.memoryCurveDotActive}`;
            if (isCurrent && isRevealed) dotClass += ` ${s.memoryCurveDotPulse}`;
            return (
              <div
                key={tLevel}
                className={s.memoryCurveNode}
                data-testid={p08Ids.memoryCurveNode(tLevel)}
              >
                <div className={dotClass} />
                <span className={s.memoryCurveLabel}>{tLevel}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom spacer ──────────────────────────────────── */}
      <div className={s.bottomSpacer} />

      {/* ── Grade buttons (AC4: all enabled after reveal) ───── */}
      <div className={s.gradeButtons} data-testid={TEST_IDS.p08.gradeButtons}>
        <button
          className={s.gradeForgot}
          data-testid={TEST_IDS.p08.gradeBtnForgot}
          disabled={!isRevealed}
          onClick={() => handleGrade('FORGOT')}
        >
          ✗ 未掌握
        </button>
        <button
          className={s.gradePartial}
          data-testid={TEST_IDS.p08.gradeBtnPartial}
          disabled={!isRevealed}
          onClick={() => handleGrade('PARTIAL')}
        >
          ◐ 部分
        </button>
        <button
          className={s.gradeMastered}
          data-testid={TEST_IDS.p08.gradeBtnMastered}
          disabled={!isRevealed || !masteredEnabled}
          onClick={() => handleGrade('MASTERED')}
          aria-disabled={isRevealed && !masteredEnabled}
          title={isRevealed ? '看过答案后只能选 部分 / 未掌握' : undefined}
        >
          ✓ 已掌握
        </button>
      </div>
    </div>
  );
};
