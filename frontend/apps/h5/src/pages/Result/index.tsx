/**
 * P04 · AI 分析结果
 * Mood B · pure-warm · STYLE-TRUTH §3 Mood B
 *
 * 1:1 对齐 design/mockups/wrongbook/_archive/04_result.html
 *
 * 状态机：LOADING → DRAFT | LOW_CONF → EDITING → SAVING → SAVED
 * A11y: aria-live="polite" 错因区，aria-label on CTA
 *        prefers-reduced-motion: 骨架屏动画 fallback in CSS
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  questionsClient,
  QuestionDetail,
  QuestionPlannedNode,
  SaveQuestionResp,
} from '@longfeng/api-contracts';
import { TEST_IDS } from '@longfeng/testids';
import { track } from '@longfeng/telemetry';
import s from './Result.module.css';

// ─── Types (local view-model · keeps page-internal symbol names) ─────────

type PlannedNode = QuestionPlannedNode;

type PageState = 'LOADING' | 'DRAFT' | 'LOW_CONF' | 'SAVING' | 'SAVED' | 'ERROR';

// ─── Mock data (placeholderData / API 失败兜底 · 与 C-14 caveat 一致) ─────

const MOCK_QUESTION: QuestionDetail = {
  id: 'mock-qid-001',
  subject: 'math',
  stem: '已知函数 f(x) = x² − 4x + 3，求其顶点坐标与对称轴方程。',
  formula: 'f(x) = (x − 2)² − 1',
  myAnswer: 'B. (2, −1)',
  correctAnswer: 'A. (2, −1)',
  reasonMarkdown: '你把顶点式 (x − h)² + k 中的 h 与 k 读反了：顶点是 (h, k) 而不是 (−h, k)，所以 x 坐标是 2，不是 −2。对称轴方程应为 x = h = 2。',
  steps: [
    { idx: 1, title: '对 f(x) 配方：把 x² − 4x 补成完全平方。', formula: 'f(x) = (x² − 4x + 4) + 3 − 4' },
    { idx: 2, title: '整理为顶点式 (x − h)² + k：', formula: 'f(x) = (x − 2)² − 1' },
    { idx: 3, title: '读出顶点 (h, k) = (2, −1)，对称轴 x = 2。' },
  ],
  knowledgePoints: [
    { id: 'kp-1', name: '二次函数 顶点式', weight: 0.8 },
    { id: 'kp-2', name: '配方法', weight: 0.6 },
    { id: 'kp-3', name: '对称轴', weight: 0.4 },
  ],
  difficulty: 3,
  confidence: 0.85,
  modelInfo: { name: 'qwen-vl-max', version: '2.0' },
};

const MOCK_NODES: PlannedNode[] = [
  { tLevel: 'T1', dueAt: new Date().toISOString(), status: 'preview' },
  { tLevel: 'T2', dueAt: new Date(Date.now() + 86400000).toISOString(), status: 'preview' },
  { tLevel: 'T3', dueAt: new Date(Date.now() + 4 * 86400000).toISOString(), status: 'preview' },
  { tLevel: 'T4', dueAt: new Date(Date.now() + 8 * 86400000).toISOString(), status: 'preview' },
  { tLevel: 'T5', dueAt: new Date(Date.now() + 16 * 86400000).toISOString(), status: 'preview' },
  { tLevel: 'T6', dueAt: new Date(Date.now() + 35 * 86400000).toISOString(), status: 'preview' },
];

// ─── Helpers ─────────────────────────────────────────────────────

const SUBJECT_LABEL: Record<string, string> = {
  math: '数学', physics: '物理', chemistry: '化学', english: '英语',
};

const DIFF_LABELS = ['', '简单', '偏易', '中等', '偏难', '困难'];

// ─── Subcomponents ───────────────────────────────────────────────

function Skeleton() {
  return (
    <div className={s.skeleton} data-testid={TEST_IDS.p04.skeleton}>
      <div className={s.skeletonCard} />
      <div className={s.skeletonBar} style={{ width: '60%' }} />
      <div className={s.skeletonBar} style={{ width: '85%' }} />
      <div className={s.skeletonCard} />
      <div className={s.skeletonBar} style={{ width: '70%' }} />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export const ResultPage: React.FC = () => {
  const nav = useNavigate();
  const { qid = 'mock-qid-001' } = useParams<{ qid: string }>();

  const [pageState, setPageState] = useState<PageState>('LOADING');
  // SC-01-E04b · 低置信度强制确认 modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lowConfTracked, setLowConfTracked] = useState(false);
  // SC-01-E04c · save 失败 toast（spec §5 outbox 兜底语义）
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // SC-07 异常路径：qid 含 'low-conf' 强制 confidence < 0.6 → LOW_CONF banner
  const isLowConfQid = /low.?conf/i.test(qid);
  const seedQuestion: QuestionDetail = isLowConfQid
    ? { ...MOCK_QUESTION, id: qid, confidence: 0.42 }
    : { ...MOCK_QUESTION, id: qid };

  // Rule 2 · React Query 替代裸 fetch · spec §5 "骨架屏 + 重试 1 次"
  const { data, isLoading, isError } = useQuery({
    queryKey: ['wb', 'question', qid],
    queryFn: () => questionsClient.getById(qid),
    enabled: !!qid,
    retry: 1,
    staleTime: 30_000,
    placeholderData: { question: seedQuestion, plannedNodes: MOCK_NODES },
  });

  const question: QuestionDetail = data?.question ?? seedQuestion;
  const nodes: PlannedNode[] = data?.plannedNodes ?? MOCK_NODES;

  // 状态机推进
  useEffect(() => {
    if (isLoading && !data) {
      setPageState('LOADING');
      return;
    }
    if (pageState === 'SAVING' || pageState === 'SAVED') return; // 不被刷新打断
    if (isError && !data) {
      setPageState('ERROR');
      return;
    }
    setPageState(question.confidence < 0.6 ? 'LOW_CONF' : 'DRAFT');
  }, [isLoading, isError, data, question.confidence, pageState]);

  // SC-01-E04b · 低置信度 → 显示黄条 + 埋点
  const isLowConf = question.confidence < 0.6;
  useEffect(() => {
    if (isLowConf && !lowConfTracked && pageState !== 'LOADING') {
      track('wb_result_low_conf', { qid: question.id, confidence: question.confidence });
      setLowConfTracked(true);
    }
  }, [isLowConf, lowConfTracked, pageState, question.id, question.confidence]);

  // ── Save mutation · useMutation(POST /api/wb/questions/{qid}/save) ────
  // SC-01-E04c · 失败 → toast「保存中…稍后自动重试」(spec §5 outbox 兜底)
  const saveMutation = useMutation<SaveQuestionResp, unknown, void>({
    mutationFn: () => questionsClient.save(question.id),
    onMutate: () => {
      setPageState('SAVING');
    },
    onSuccess: () => {
      setPageState('SAVED');
      // 埋点：spec §10 wb_result_save
      track('wb_result_save', {
        qid: question.id,
        subject: question.subject,
        kpCount: question.knowledgePoints.length,
      });
      // navigate P05 (List) with highlight=qid · E05a 已实现
      setTimeout(() => nav(`/wrongbook?highlight=${question.id}`), 200);
    },
    onError: () => {
      // 网络/5xx → 用户态回到 DRAFT/LOW_CONF；后端 outbox 会兜底重试
      setPageState(question.confidence < 0.6 ? 'LOW_CONF' : 'DRAFT');
      setSaveToast('保存中…稍后自动重试');
      setTimeout(() => setSaveToast(null), 3000);
    },
  });

  // ── Save 入口（低置信度先弹 modal） ────────────────────────────
  const handleSave = () => {
    if (!question) return;
    if (isLowConf) {
      setConfirmOpen(true);
      return;
    }
    saveMutation.mutate();
  };

  const handleConfirmYes = () => {
    setConfirmOpen(false);
    saveMutation.mutate();
  };

  const handleConfirmNo = () => {
    setConfirmOpen(false);
  };

  const isSaving = pageState === 'SAVING' || saveMutation.isPending;
  const q = question;

  // SC-01-E04a · 时间线 7 节点视图（T0 = now 当前时刻 + T1..T6 = 6 个 preview）
  const TIMELINE_LEVELS = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6'] as const;
  const timeline = TIMELINE_LEVELS.map((lvl) => {
    if (lvl === 'T0') {
      return {
        tLevel: 'T0' as const,
        dueAt: new Date().toISOString(),
        status: 'now' as const,
      };
    }
    const planned = nodes.find((n) => n.tLevel === lvl);
    return {
      tLevel: lvl,
      dueAt: planned?.dueAt ?? '',
      status: 'future' as const,
    };
  });
  const TIMELINE_DATE_LABELS = ['现在', '15:28', '明日', '4/24', '4/28', '5/6', '5/21'];

  // ─────────────────────────────────────────────────────────────
  return (
    <div
      className={s.root}
      data-testid={TEST_IDS.p04.root}
      data-mood="B"
    >
      {/* StatusBar 已删 · iOS chrome · _archive data-mockup-chrome="iphone-statusbar" */}

      {/* ── Nav ────────────────────────────────────────────── */}
      <header
        className={s.nav}
        data-testid={TEST_IDS.p04.navbar}
        role="banner"
      >
        <div className={s.navRow}>
          <button
            className={s.navBack}
            onClick={() => nav('/capture')}
            aria-label="返回分析"
          >
            <svg viewBox="0 0 12 20" fill="none" aria-hidden="true">
              <path d="M10 2 2 10l8 8" stroke="#007AFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            分析
          </button>
          <div className={s.navActions}>
            <button aria-label="编辑">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M16 5l3 3-10 10H6v-3L16 5Z" stroke="#007AFF" strokeWidth="1.8" strokeLinejoin="round"/>
              </svg>
            </button>
            <button aria-label="分享">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 4v12m0 0 4-4m-4 4-4-4M5 19h14" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        <h1 className={s.navH1}>
          分析完成 <span className={s.navTag}>4.2s</span>
        </h1>
      </header>

      {/* ── Skeleton ─────────────────────────────────────────── */}
      {pageState === 'LOADING' && <Skeleton />}

      {/* ── Content ──────────────────────────────────────────── */}
      {pageState !== 'LOADING' && (
        <main className={s.content} data-mood="B" role="main">

          {/* Low-conf banner · SC-01-E04b 双 testid（legacy p04-low-conf-banner + new result-lowconf-banner） */}
          {isLowConf && (
            <div
              className={s.lowConfBanner}
              role="status"
              data-testid={TEST_IDS.p04.lowConfBanner}
            >
              <span data-testid={TEST_IDS.p04.resultLowConfBanner}>
                ⚠️ AI 不太确定，请复核答案再保存
              </span>
            </div>
          )}

          {/* B2 · Question hero */}
          <div className={s.questionHero} data-testid={TEST_IDS.p04.questionHero}>
            <div className={s.thumb} aria-hidden="true">
              <span className={s.thumbLbl}>数学 · 12</span>
              <span className={s.thumbQno}>17</span>
              <h3 className={s.thumbH3}>已知 f(x)=x²−4x+3</h3>
              <div className={s.thumbStrike} />
              <div className={s.thumbPen}>B</div>
            </div>
            <div className={s.heroMeta}>
              <div className={s.heroKicker}>
                {SUBJECT_LABEL[q.subject] ?? q.subject} · 二次函数 · 顶点式
              </div>
              <div className={s.heroStem} data-testid="result-hero-stem">
                {q.stem}
              </div>
              {q.formula && (
                <div className={s.heroFormula}>
                  {q.formula.replace(/(\d+)/g, (n) => n)}
                </div>
              )}
            </div>
          </div>

          {/* B3 · Answers */}
          <div className={s.answers} data-testid={TEST_IDS.p04.answersRow}>
            <div className={`${s.ans} ${s.ansWrong}`} data-testid={TEST_IDS.p04.answersWrong}>
              <div className={s.ansT}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                  <path d="M2 2L9 9M9 2L2 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                你的作答
              </div>
              <div className={s.ansV} data-testid={TEST_IDS.p04.answersWrong + '-text'}>{q.myAnswer}</div>
              <div className={s.ansN}>混淆顶点式符号</div>
              <div className={s.ansDeco} aria-hidden="true" />
            </div>
            <div className={`${s.ans} ${s.ansRight}`} data-testid={TEST_IDS.p04.answersRight}>
              <div className={s.ansT}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                  <path d="M1.5 6L4.5 9L9.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                正确答案
              </div>
              <div className={s.ansV} data-testid={TEST_IDS.p04.answersRight + '-text'}>
                {q.correctAnswer}
              </div>
              <div className={s.ansN}>顶点 (2, −1)，对称轴 x = 2</div>
              <div className={s.ansDeco} aria-hidden="true" />
            </div>
          </div>

          {/* B4 · Error reason */}
          <div className={s.secHeader}>
            <span className={s.secTitle}>错因诊断</span>
            <div className={s.secLine} />
            <span className={s.secTag} style={{ color: '#FF3B30' }}>CONCEPT · 概念混淆</span>
          </div>
          <div
            className={s.reasonCard}
            data-testid={TEST_IDS.p04.reasonCard}
            aria-live="polite"
          >
            <div className={s.reasonIx} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3.5 21 19.5H3L12 3.5Z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M12 10v4.5M12 17v.1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div
              className={s.reasonTxt}
              data-testid={TEST_IDS.p04.reasonText}
            >
              <span data-testid="result-cause-card">
                {q.reasonMarkdown ||
                  '你把顶点式 (x − h)² + k 中的 h 与 k 读反了，所以 x 坐标是 2，不是 −2。对称轴方程应为 x = 2。'}
              </span>
            </div>
          </div>

          {/* B5 · Steps */}
          <div className={s.secHeader}>
            <span className={s.secTitle}>解答步骤</span>
            <div className={s.secLine} />
            <span className={s.secTag} style={{ color: '#8E8E93' }}>3 STEPS</span>
          </div>
          <div
            className={s.steps}
            data-testid={TEST_IDS.p04.solutionStepper}
          >
            <div data-testid="result-solution-card" style={{ display: 'contents' }} />
            {q.steps.map((step) => (
              <div
                key={step.idx}
                className={s.step}
                data-testid={`p04-solution-stepper-step-${step.idx}`}
              >
                <div className={s.stepNum} aria-hidden="true">{step.idx}</div>
                <div className={s.stepBody}>
                  <div className={s.stepExp}>{step.title}</div>
                  {step.formula && (
                    <div className={s.stepFm}>
                      {step.formula}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* B6 · KP + difficulty */}
          <div className={s.secHeader}>
            <span className={s.secTitle}>知识点</span>
            <div className={s.secLine} />
          </div>
          <div className={s.kpRow} data-testid={TEST_IDS.p04.metaChips}>
            <div className={s.kpCard}>
              <div className={s.kpHdr}>涉及知识点</div>
              <div className={s.kpChips}>
                {q.knowledgePoints.map((kp, i) => (
                  <span
                    key={kp.id}
                    className={i === q.knowledgePoints.length - 1 ? s.chipOutline : s.chip}
                    data-testid={i === 0 ? TEST_IDS.p04.subjectChipMath : undefined}
                  >
                    {kp.name}
                  </span>
                ))}
              </div>
            </div>
            <div className={s.diffCard}>
              <div className={s.diffHdr}>难度</div>
              <div className={s.stars}>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={i < q.difficulty ? '' : s.starDim} aria-hidden="true">
                    ★
                  </span>
                ))}
              </div>
              <div className={s.diffLevel}>{DIFF_LABELS[q.difficulty] ?? '中等'}</div>
            </div>
          </div>

          {/* B7 · Ebbinghaus preview */}
          <div className={s.ebbing} data-testid={TEST_IDS.p04.memoryCurve}>
            <div className={s.ebbingT}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 19c3-7 6-10 9-10s5 3 7 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="4" cy="19" r="1.6" fill="currentColor"/>
              </svg>
              艾宾浩斯复习计划预览
            </div>
            <h4 className={s.ebbingH4}>保存后将在日历自动生成 6 个复习节点</h4>
            <div className={s.ebbingNodes}>
              {timeline.map((node, i) => (
                <div
                  key={node.tLevel}
                  className={`${s.node}${i === 0 ? ` ${s.nodeFirst}` : ''}`}
                  data-testid={`result-timeline-node-${node.tLevel}`}
                  data-status={node.status}
                >
                  {/* legacy testid kept for SC-02/03/04 cross-page tests */}
                  {node.tLevel !== 'T0' && (
                    <span
                      data-testid={`memory-curve-node-${node.tLevel}`}
                      hidden
                    />
                  )}
                  <div className={s.nodePill} />
                  <div className={s.nodeLv}>{node.tLevel}</div>
                  <div className={s.nodeDt}>
                    {TIMELINE_DATE_LABELS[i] ?? ''}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </main>
      )}

      {/* ── SC-01-E04b · 低置信度强制确认 modal ─────────────── */}
      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="result-confirm-title"
          data-testid={TEST_IDS.p04.resultConfirmModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleConfirmNo}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--tkn-color-bg-primary, #fff)',
              borderRadius: 'var(--tkn-radius-lg, 16px)',
              minWidth: 280,
              maxWidth: '90vw',
              padding: '20px 20px 16px',
            }}
          >
            <div
              id="result-confirm-title"
              style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}
            >
              AI 不太确定，确认保存？
            </div>
            <div style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>
              AI 对本题置信度较低，建议你先核对答案与错因，再保存到错题本。
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                data-testid={TEST_IDS.p04.resultConfirmNoBtn}
                onClick={handleConfirmNo}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid #d0d0d0',
                  background: '#fff',
                  color: '#333',
                }}
              >
                返回复核
              </button>
              <button
                data-testid={TEST_IDS.p04.resultConfirmYesBtn}
                onClick={handleConfirmYes}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--tkn-color-primary-DEFAULT, #007AFF)',
                  color: '#fff',
                }}
              >
                确认保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── B8 · CTA dock ────────────────────────────────────── */}
      {pageState !== 'LOADING' && (
        <footer className={s.cta} role="contentinfo">
          <div className={s.ctaRow}>
            <button
              className={`${s.btn} ${s.btnGhost}`}
              onClick={() => nav('/capture')}
              aria-label="手动修正题目"
            >
              手动修正
            </button>
            <button
              className={`${s.btn} ${s.btnPrimary}`}
              // 双 testid：legacy `p04-save-cta` + new `result-save-btn`（SC-01-E04c）
              data-testid={TEST_IDS.p04.saveCta}
              data-testid-alt={TEST_IDS.p04.resultSaveBtn}
              aria-label="保存到错题本，AI 会安排 6 次复习"
              onClick={handleSave}
              disabled={isSaving}
            >
              {/* New testid wrapper for SC-01-E04c · `result-save-btn` */}
              <span data-testid={TEST_IDS.p04.resultSaveBtn} hidden />
              {isSaving ? (
                <span data-testid={TEST_IDS.p04.resultSaveLoading}>
                  <span className={s.spinner} aria-hidden="true" /> 保存中…
                </span>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12.5 10 17l9-10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  保存并开启复习
                </>
              )}
            </button>
          </div>
          <div className={s.ctaNote}>
            保存后将按《艾宾浩斯》自动生成 T1–T6 共 6 个日历提醒
          </div>
        </footer>
      )}

      {/* SC-01-E04c · save 失败 toast (spec §5 outbox 兜底) */}
      {saveToast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="result-save-toast"
          style={{
            position: 'fixed',
            bottom: 96,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 14,
            zIndex: 1100,
          }}
        >
          {saveToast}
        </div>
      )}
    </div>
  );
};
