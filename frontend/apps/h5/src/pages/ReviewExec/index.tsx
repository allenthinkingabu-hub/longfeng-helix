/**
 * P08 · 复习执行（ReviewExec）
 * 1:1 mirror of design/mockups/wrongbook/08_review_exec.html
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
import React, { useCallback, useMemo, useRef, useState } from 'react';
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
  subject: '数学',
  kpName: '二次函数',
  difficulty: 3,
  answer: 'f(x) = (x − 2)² − 1　　顶点 (2, −1)　对称轴 x = 2',
  steps: [
    '提取 x 的二次项与一次项，进行配方：x² − 4x = (x − 2)² − 4。',
    '将常数项合并：(x − 2)² − 4 + 3 = (x − 2)² − 1。',
    '由顶点式可得顶点坐标 (2, −1)，对称轴方程为 x = 2。',
  ],
};

const MOCK_NODE: NodeData = {
  nid: '0',
  nodeIndex: 2,
  tLevel: 'T2',
  easeFactor: 2.5,
};

const DIFFICULTY_MAP: Record<number, string> = {
  1: '简单 ★☆☆☆☆',
  2: '较易 ★★☆☆☆',
  3: '中等 ★★★☆☆',
  4: '较难 ★★★★☆',
  5: '困难 ★★★★★',
};

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
    track('wb_exec_grade', { nid, grade, totalMs: Date.now() - openedAtRef.current });
    nav(`/review/done/${nid}`);
  }, [nid, nav]);

  // ── Derived state ──────────────────────────────────────────
  const isRevealed = execState === 'REVEALED' || execState === 'GRADED';
  // TI3 (spec §6.4): 揭示后 mastered btn disabled
  const masteredEnabled = !isRevealed;

  // ── Render (1:1 mirror of 08_review_exec.html) ────────────
  return (
    <div className={s.root} data-testid={TEST_IDS.p08.root} data-mood="B">

      {/* ── Nav (topbar · mockup .nav L130) ──────────────── */}
      <nav className={s.nav} data-testid={TEST_IDS.p08.topbar}>
        <button className={s.back} onClick={() => nav(-1)} aria-label="返回">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M14 5l-6 6 6 6" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>复习</span>
        </button>
        <div className={s.center}>
          <div className={s.title} data-testid={TEST_IDS.p08.topbarCursor}>
            复习执行 · 第 {cursor} 题
          </div>
          <div className={s.sub}>{cursor} / {total} · 剩余 {total - cursor} 题</div>
        </div>
        <button
          className={s.close}
          data-testid={TEST_IDS.p08.closeBtn}
          onClick={() => nav('/')}
          aria-label="关闭"
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M2 2 L12 12 M12 2 L2 12" stroke="#636366" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <div className={s.ptrack} data-testid={TEST_IDS.p08.progressBar}>
          <div className={s.plbl}>{progressPct}% · 预计 6 分钟</div>
          <div className={s.pbar} style={{ width: `${progressPct}%` }} />
        </div>
      </nav>

      {/* ── Scroll area ──────────────────────────────────── */}
      <div className={s.scroll}>

        {/* ── Meta chips (mockup .metarow L151) ─────────── */}
        <div className={s.metarow} data-testid={TEST_IDS.p08.metaChips}>
          <span className={s.chipRed}>
            <span className={s.dot} />{node.tLevel} · 第 {node.nodeIndex + 1} 次复习
          </span>
          <span className={s.chipIndigo}>{question.subject} · {question.kpName}</span>
          <span className={s.chipOrange}>{DIFFICULTY_MAP[question.difficulty] ?? ''}</span>
        </div>

        {/* ── Question card (mockup .qcard L158) ──────────── */}
        <div className={s.qcard} data-testid={TEST_IDS.p08.questionHero}>
          <div className={s.qkicker}>错题回顾 · 原题</div>
          <div className={s.qstem}>
            已知函数 <span className={s.fm}>f(x) = x² − 4x + 3</span>，请将其化为顶点式，并写出顶点坐标与对称轴方程。
          </div>
          <div className={s.qmeta}>
            <span>知识点 · 顶点式 · 配方法</span>
            <span className={s.stars}>★★★☆☆</span>
          </div>
        </div>

        {/* ── Work area (mockup .work L172) ────────────────── */}
        <div className={s.blockTitle} data-testid={TEST_IDS.p08.answerArea}>
          <span className={s.blockTitleDot} />你的解答 · 手写
        </div>
        <div className={s.work}>
          <div className={s.paper}>
            <div className={s.handwritten}>
              f(x) = x² − 4x + 3<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= (x² − 4x + 4) − 4 + 3<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= (x − 2)² − 1<br/>
              <span style={{ color: '#636366' }}>∴ 顶点</span> (2, −1)<span className={s.cursor} />
            </div>
          </div>
          <div className={s.tools}>
            <button className={s.tool}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 12 L9 5 L12 8 L5 12 Z" stroke="#636366" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
              手写
            </button>
            <button className={s.tool}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="3" width="10" height="8" rx="2" stroke="#636366" strokeWidth="1.4"/>
                <path d="M4 7 h6" stroke="#636366" strokeWidth="1.4"/>
              </svg>
              键盘
            </button>
            <button className={s.toolPrime}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1 L9 5 L13 5 L10 8 L11 12 L7 10 L3 12 L4 8 L1 5 L5 5 Z" fill="#007AFF"/>
              </svg>
              公式面板
            </button>
          </div>
        </div>

        {/* ── Reveal button (hidden after reveal) ──────────── */}
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

        {/* ── Reveal content (AC3: mockup .reveal L66) ─────── */}
        {isRevealed && (
          <div className={s.blockTitleGreen}>
            <span className={s.blockTitleDotGreen} />参考答案 · 已揭示
          </div>
        )}
        <div
          className={`${s.reveal} ${isRevealed ? s.revealVisible : s.revealHidden}`}
          data-testid={TEST_IDS.p08.revealContent}
          aria-hidden={!isRevealed}
          aria-live="polite"
        >
          <div className={s.revealHead}>
            <div className={s.revealHeadL}>
              <div className={s.revealIco} data-testid={TEST_IDS.p08.revealCheckmark}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6.2 L5 9 L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className={s.revealTtl}>标准解答</div>
            </div>
            <div className={s.revealSub}>AI · GPT-4o mini</div>
          </div>
          <div className={s.ans}>
            <div className={s.ansK}>顶点式</div>
            <div className={s.ansV}>{question.answer}</div>
          </div>
          <div className={s.steps}>
            {question.steps.map((step, i) => (
              <div key={i} className={s.stp} data-testid={p08Ids.revealStep(i + 1)}>
                <div className={s.stpN}>{i + 1}</div>
                <div className={s.stpT}>{step}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Node timeline (AC3: mockup .nodes L218) ────── */}
        <div className={s.nodes} data-testid={TEST_IDS.p08.memoryCurve}>
          {[0, 1, 2, 3, 4, 5, 6].map((idx) => {
            const isPast = idx < node.nodeIndex;
            const isCurrent = idx === node.nodeIndex;
            let dotCls = s.nodeDot;
            if (isPast) dotCls += ` ${s.nodeDotDone}`;
            if (isCurrent) dotCls += ` ${s.nodeDotNow}`;
            if (isCurrent && isRevealed) dotCls += ` ${s.nodeDotPulse}`;
            return (
              <React.Fragment key={idx}>
                <span
                  className={dotCls}
                  data-testid={p08Ids.memoryCurveNode(`T${idx}`)}
                />
                {idx < 6 && (
                  <span className={`${s.nodeLine}${isPast ? ` ${s.nodeLineGreen}` : ''}`} />
                )}
              </React.Fragment>
            );
          })}
          <span className={s.nodeLabel}>{node.tLevel} · 1 天后</span>
        </div>
      </div>

      {/* ── Bottom spacer for fixed rating ────────────────── */}
      <div className={s.bottomSpacer} />

      {/* ── Rating bar (mockup .rating L235) ──────────────── */}
      <div className={s.rating} data-testid={TEST_IDS.p08.gradeButtons}>
        <div className={s.rtitle}>
          <div className={s.rtitleL}>本次复习你的自评？</div>
          <div className={s.rtitleR}>将用于更新记忆曲线</div>
        </div>
        <div className={s.ractions}>
          <button
            className={s.rbtnForgot}
            data-testid={TEST_IDS.p08.gradeBtnForgot}
            disabled={!isRevealed}
            onClick={() => handleGrade('FORGOT')}
          >
            <div className={s.ri}>✗</div>
            <div className={s.rl}>未掌握</div>
            <div className={s.rs}>回到 T0</div>
          </button>
          <button
            className={s.rbtnPartial}
            data-testid={TEST_IDS.p08.gradeBtnPartial}
            disabled={!isRevealed}
            onClick={() => handleGrade('PARTIAL')}
          >
            <div className={s.ri}>◐</div>
            <div className={s.rl}>部分</div>
            <div className={s.rs}>原计划不变</div>
          </button>
          <button
            className={s.rbtnMaster}
            data-testid={TEST_IDS.p08.gradeBtnMastered}
            disabled={!isRevealed || !masteredEnabled}
            onClick={() => handleGrade('MASTERED')}
            aria-disabled={isRevealed && !masteredEnabled}
            title={isRevealed ? '看过答案后只能选 部分 / 未掌握' : undefined}
          >
            <div className={s.ri}>✓</div>
            <div className={s.rl}>已掌握</div>
            <div className={s.rs}>推进到 T3</div>
          </button>
        </div>
      </div>
    </div>
  );
};
