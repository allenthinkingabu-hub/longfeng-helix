/**
 * P03 · AI 分析中
 * STYLE-TRUTH: design/mockups/wrongbook/03_analyzing.html (SoT · 1:1 mirror)
 * Light iOS theme · radial-gradient bg · white cards · dark terminal stream
 *
 * 4 步 SSE 流水线：图像预处理 → OCR 题干 → 错因诊断 → 生成解法
 * D-AI-Cancel: 关闭 EventSource 时 POST /api/ai/cancel/{taskId}
 * A11y: aria-live="polite" on pipeline (B3)
 *        prefers-reduced-motion: shimmer animation fallback in CSS
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TEST_IDS } from '@longfeng/testids';
import { track } from '@longfeng/telemetry';
import { analyzeClient } from '@longfeng/api-contracts';
import { useEventSource, STEP_LABELS, StreamStep } from '../../hooks/useEventSource';
import s from './Analyzing.module.css';

// SC-01-E03a · alias testids (kept additively alongside canonical
// `analyzing-pipeline-*` ids in @longfeng/testids; A08 audit list).
const ALIAS_TESTIDS = {
  step1: 'ai-pipeline-step-1',
  step2: 'ai-pipeline-step-2',
  step3: 'ai-pipeline-step-3',
  step4: 'ai-pipeline-step-4',
  typewriter: 'ai-typewriter',
  fallbackBanner: 'ai-fallback-banner',
  cancelBtn: 'ai-cancel-btn',
} as const;

// ─── Types ──────────────────────────────────────────────────────
type Model = 'qwen-vl-max' | 'gpt-4o-mini';

// ─── Step descriptions (from mockup: .step .desc) ───────────────
const STEP_DESCS: Record<StreamStep, { wait: string; now: string; done: string }> = {
  1: {
    wait: '等待中',
    now: '正在预处理图像…',
    done: '已提取 132 字符，置信度 99.4%',
  },
  2: {
    wait: '等待中',
    now: '正在识别题干文本…',
    done: '数学 · 二次函数 · 顶点式 · Bloom: APPLY',
  },
  3: {
    wait: '将输出 JSON Schema · 含公式 LaTeX',
    now: '正在比对学生作答与正确解法的差异',
    done: '错因诊断完成',
  },
  4: {
    wait: '将输出 JSON Schema · 含公式 LaTeX',
    now: '正在生成解答步骤…',
    done: '解答生成完成',
  },
};

// ─── SVG Helpers ────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6L18 18M18 6L6 18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"/>
    </svg>
  );
}

function BackChevron() {
  return (
    <svg viewBox="0 0 12 20" fill="none" aria-hidden="true">
      <path d="M10 2 2 10l8 8" stroke="#007AFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Tab bar icons (from mockup) ────────────────────────────────

const TAB_ICONS = {
  home: <svg viewBox="0 0 24 24" fill="none"><path d="M3 11 L12 3 L21 11 V20 a1 1 0 0 1 -1 1 H14 V14 H10 V21 H4 a1 1 0 0 1 -1 -1 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/></svg>,
  book: <svg viewBox="0 0 24 24" fill="none"><path d="M5 4h11l3 3v13H5V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M8 11h8M8 14h6M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  camera: <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="4.5" stroke="currentColor" strokeWidth="1.8"/><path d="M5 8h3l1.5-2h5L16 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  review: <svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5c-3.6 0-6.2 2.6-6.2 6.2v3.4L4 15.5v1.3h16v-1.3l-1.8-2.4V9.7c0-3.6-2.6-6.2-6.2-6.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M10 19.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  profile: <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.5" r="3.8" stroke="currentColor" strokeWidth="1.8"/><path d="M4.5 20c1.2-3.8 4.2-5.6 7.5-5.6s6.3 1.8 7.5 5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
};

// ─── Component ──────────────────────────────────────────────────

export const AnalyzingPage: React.FC = () => {
  const nav = useNavigate();
  const { taskId = 'mock-task-id' } = useParams<{ taskId: string }>();
  const [searchParams] = useSearchParams();
  const qid = searchParams.get('qid') ?? taskId;
  const thumbnailUrl = searchParams.get('thumb') ?? '';
  const subjectLabel = searchParams.get('subject') ?? '数学';

  // SC-07: fallback taskId → mount 时立即显示 fallback banner + 切到备用模型
  const isFallbackTask = taskId.includes('fallback') || taskId.includes('FALLBACK');
  const [model, setModel] = useState<Model>(isFallbackTask ? 'gpt-4o-mini' : 'qwen-vl-max');
  const [slowBanner, setSlowBanner] = useState<boolean>(isFallbackTask);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Mount-time enforcement
  useEffect(() => {
    if (isFallbackTask) {
      setSlowBanner(true);
      setModel('gpt-4o-mini');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigatedRef = useRef(false);
  const userCancelledRef = useRef(false);
  const failCountRef = useRef(0);
  const fallbackTriggeredRef = useRef(false);

  const onDone = useCallback(() => {
    if (navigatedRef.current) return;
    if (userCancelledRef.current) return;
    navigatedRef.current = true;
    const isGuest = typeof localStorage !== 'undefined' && !localStorage.getItem('lf:token');
    const dest = isGuest ? '/guest/capture' : `/question/${qid}/result`;
    setTimeout(() => {
      if (userCancelledRef.current) return;
      nav(dest);
    }, 200);
  }, [nav, qid]);

  const onSlow = useCallback(() => {
    setSlowBanner(true);
    setModel('gpt-4o-mini');
  }, []);

  const onFallbackModel = useCallback((fromTo: string) => {
    setSlowBanner(true);
    const toProvider = fromTo.split('→')[1]?.trim();
    if (toProvider === 'openai' || toProvider === 'gpt-4o-mini') {
      setModel('gpt-4o-mini');
    }
    track('wb_ai_stream_slow', { reason: 'fallback_model', fromTo, taskId });
  }, [taskId]);

  const onFail = useCallback((code?: string) => {
    if (code === 'NETWORK_ERROR') {
      setErrorBanner('网络中断，请重试');
    } else {
      setErrorBanner('AI 暂时帮不上忙，请稍后重试');
    }
    failCountRef.current += 1;
    track('wb_ai_stream_fail', { code: code ?? 'UNKNOWN', count: failCountRef.current, taskId });
    if (failCountRef.current >= 2 && !fallbackTriggeredRef.current) {
      fallbackTriggeredRef.current = true;
      navigatedRef.current = true;
      void analyzeClient.fallback(taskId)
        .catch(() => { /* spec §5 失败降级 */ })
        .finally(() => {
          const params = new URLSearchParams({ qid, taskId });
          nav(`/manual-entry?${params.toString()}`);
        });
    }
  }, [nav, qid, taskId]);

  const onCancelled = useCallback(() => {
    userCancelledRef.current = true;
    navigatedRef.current = true;
    nav('/');
  }, [nav]);

  const onStep = useCallback(
    (step: StreamStep, phase: 'start' | 'done', durMs?: number) => {
      if (phase === 'done') {
        track('wb_ai_stream_step', { step, durMs: durMs ?? 0, taskId });
      }
    },
    [taskId],
  );

  const { status, stepStatuses, stepDurations, partialJson, cancel } = useEventSource({
    taskId,
    onStep,
    onDone,
    onSlow,
    onFail,
    onCancelled,
    onFallbackModel,
  });

  useEffect(() => {
    if (status === 'SLOW') setSlowBanner(true);
    if (status === 'SUCCEEDED' && !isFallbackTask) setSlowBanner(false);
  }, [status, isFallbackTask]);

  const handleCancel = async () => {
    userCancelledRef.current = true;
    navigatedRef.current = true;
    try { await cancel(); } catch { /* noop */ }
    try { await analyzeClient.cancel(taskId); } catch { /* spec §5 */ }
    track('wb_ai_stream_cancel', { taskId });
    if (status === 'SUCCEEDED' || status === 'CANCELLED') {
      nav('/');
    }
  };

  // Compute current active step count for badge
  const doneCount = [1, 2, 3, 4].filter((n) => stepStatuses[n as StreamStep] === 'done').length;

  const steps: Array<{ step: StreamStep; label: string; testid: string; aliasTestid: string }> = [
    { step: 1, label: STEP_LABELS[1], testid: TEST_IDS.p03.step1, aliasTestid: ALIAS_TESTIDS.step1 },
    { step: 2, label: STEP_LABELS[2], testid: TEST_IDS.p03.step2, aliasTestid: ALIAS_TESTIDS.step2 },
    { step: 3, label: STEP_LABELS[3], testid: TEST_IDS.p03.step3, aliasTestid: ALIAS_TESTIDS.step3 },
    { step: 4, label: STEP_LABELS[4], testid: TEST_IDS.p03.step4, aliasTestid: ALIAS_TESTIDS.step4 },
  ];

  const stepStateClass = (step: StreamStep): string => {
    const st = stepStatuses[step];
    if (st === 'done') return s.stepDone;
    if (st === 'now')  return s.stepNow;
    if (st === 'fail') return s.stepFail;
    return s.stepWait;
  };

  const stepDesc = (step: StreamStep): string => {
    const st = stepStatuses[step];
    if (st === 'done') return STEP_DESCS[step].done;
    if (st === 'now')  return STEP_DESCS[step].now;
    if (st === 'fail') return '失败';
    return STEP_DESCS[step].wait;
  };

  return (
    <div
      className={s.root}
      data-testid={TEST_IDS.p03.root}
    >
      {/* ── Nav bar (mockup: .nav) ──────────────────────────────── */}
      <nav className={s.nav}>
        <div className={s.navRow}>
          <button className={s.back} onClick={() => nav(-1)} type="button">
            <BackChevron />
            拍题
          </button>
          <button className={s.navCancel} onClick={handleCancel} type="button">
            取消
          </button>
        </div>
        <h1 className={s.navTitle}>
          AI 正在分析… <span className={s.badge}>{doneCount} / 4</span>
        </h1>
      </nav>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className={s.content}>

        {/* ── Preview card (mockup: .preview) ────────────────────── */}
        <div className={s.preview} data-testid={TEST_IDS.p03.thumbCard}>
          <div className={s.thumb} data-testid={TEST_IDS.p03.thumbImage} aria-hidden="true">
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="" />
            ) : (
              <>
                <span className={s.thumbPlaceholderLbl}>{subjectLabel} · 12</span>
                <span className={s.thumbPlaceholderQno}>17</span>
                <span className={s.thumbPlaceholderH3}>已知 f(x)=x²−4x+3</span>
              </>
            )}
          </div>
          <div className={s.meta}>
            <div className={s.metaTitle} data-testid={TEST_IDS.p03.thumbTitle}>
              第 17 题 · 顶点与对称轴
            </div>
            <div className={s.metaChips}>
              <span className={s.chip}>{subjectLabel}</span>
              <span className={s.chip}>G9</span>
              <span className={s.chip}>2026-04-21 14:28</span>
            </div>
          </div>
        </div>

        {/* ── Model badge (mockup: .model) ────────────────────────── */}
        <div
          className={s.modelBadge}
          data-testid={TEST_IDS.p03.modelBadge}
          aria-label={`当前 AI 模型：${model}`}
        >
          <span className={s.modelDot} />
          <span>
            已选模型 <strong>{model}</strong> · 备用 <strong>{model === 'qwen-vl-max' ? 'gpt-4o-mini' : 'qwen-vl-max'}</strong> · 平均时延 <strong>4.2s</strong>
          </span>
        </div>

        {/* ── Banners ─────────────────────────────────────────────── */}
        {(slowBanner || errorBanner) && (
          <div
            className={`${s.banner} ${errorBanner ? s.bannerError : s.bannerSlow}`}
            role={errorBanner ? 'alert' : 'status'}
            data-testid={TEST_IDS.p03.fallbackBanner}
            data-alias-testid={ALIAS_TESTIDS.fallbackBanner}
          >
            <span data-testid={ALIAS_TESTIDS.fallbackBanner}>
              {errorBanner ?? '切换备用模型中（gpt-4o-mini）…'}
            </span>
          </div>
        )}

        {/* ── 4-step pipeline (mockup: .stages) ───────────────────── */}
        <div
          className={s.stages}
          data-testid={TEST_IDS.p03.pipeline}
          role="main"
          aria-live="polite"
          aria-label="AI 分析进度"
        >
          {steps.map(({ step, label, testid, aliasTestid }) => {
            const st = stepStatuses[step];
            const dur = stepDurations[step];
            return (
              <div
                key={step}
                className={`${s.step} ${stepStateClass(step)}`}
                data-testid={testid}
                data-state={st}
                aria-busy={st === 'now' ? true : undefined}
              >
                <span
                  className={s.stepCircle}
                  aria-hidden="true"
                  data-testid={aliasTestid}
                  data-state={st}
                >
                  {st === 'done' ? <CheckIcon /> :
                   st === 'fail' ? <XIcon /> :
                   step}
                </span>
                <div className={s.stepBody}>
                  <div className={s.stepTitle}>
                    {label}
                    {st === 'done' && dur != null && (
                      <span className={s.stepDuration}>· {(dur / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  <div className={s.stepDesc}>{stepDesc(step)}</div>
                  {st === 'now' && <div className={s.shim} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── JSON stream / typewriter (mockup: .stream) ──────────── */}
        <div data-testid={ALIAS_TESTIDS.typewriter} className={s.stream}>
          <div className={s.streamHdr}>
            <span>SSE · /api/ai/stream/{taskId.slice(0, 12)} · {model}</span>
            <span className={s.streamDots}>
              <i className={`${s.streamDot} ${s.streamDotRed}`} />
              <i className={`${s.streamDot} ${s.streamDotYellow}`} />
              <i className={`${s.streamDot} ${s.streamDotGreen}`} />
            </span>
          </div>
          <pre
            className={s.streamPre}
            data-testid={TEST_IDS.p03.jsonStream}
            aria-label="AI 流式输出"
          >
            {partialJson || (
              <>
                <span className={s.jsonPunc}>{'{'}</span>{'\n'}
                {'  '}<span className={s.jsonKey}>"stem"</span>
                <span className={s.jsonPunc}>: </span>
                <span className={s.jsonStr}>"已知函数 f(x)=x²−4x+3，求其顶点坐标与对称轴方程。"</span>
                <span className={s.jsonPunc}>,</span>{'\n'}
                {'  '}<span className={s.jsonKey}>"studentAnswer"</span>
                <span className={s.jsonPunc}>: </span>
                <span className={s.jsonStr}>"B. (2, −1)"</span>
                <span className={s.jsonPunc}>,</span>{'\n'}
                {'  '}<span className={s.jsonKey}>"correctAnswer"</span>
                <span className={s.jsonPunc}>: </span>
                <span className={s.jsonStr}>"A. (1, −2)"</span>
                <span className={s.jsonPunc}>,</span>{'\n'}
                {'  '}<span className={s.jsonKey}>"errorType"</span>
                <span className={s.jsonPunc}>: </span>
                <span className={s.jsonBool}>"CONCEPT"</span>
                <span className={s.jsonPunc}>,</span>{'\n'}
                {'  '}<span className={s.jsonKey}>"solutionSteps"</span>
                <span className={s.jsonPunc}>: [</span>{'\n'}
                {'    '}{'{ '}<span className={s.jsonKey}>"step"</span>
                <span className={s.jsonPunc}>: </span>
                <span className={s.jsonNum}>1</span>
                <span className={s.jsonPunc}>, </span>
                <span className={s.jsonKey}>"explain"</span>
                <span className={s.jsonPunc}>: </span>
                <span className={s.jsonStr}>"配方：f(x)=(x−2)²−1"</span>
                {' }'}
                <span className={s.streamCursor} aria-hidden="true" />
              </>
            )}
          </pre>
        </div>
      </div>

      {/* ── Cancel sticky (mockup: .cancel) ──────────────────────── */}
      <div data-testid={ALIAS_TESTIDS.cancelBtn} className={s.cancelWrap}>
        <button
          className={s.cancelBtn}
          data-testid={TEST_IDS.p03.cancelBtn}
          aria-label="取消分析"
          type="button"
          onClick={handleCancel}
          disabled={status === 'CANCELLED'}
        >
          放弃本次分析
        </button>
      </div>

      {/* ── Tab bar (mockup: .tabbar) ────────────────────────────── */}
      <div className={s.tabbar}>
        <button className={s.tab} type="button">{TAB_ICONS.home}<span>首页</span></button>
        <button className={s.tab} type="button">{TAB_ICONS.book}<span>错题本</span></button>
        <button className={`${s.tab} ${s.tabActive}`} type="button">{TAB_ICONS.camera}<span>拍题</span></button>
        <button className={s.tab} type="button">{TAB_ICONS.review}<span>复习</span></button>
        <button className={s.tab} type="button">{TAB_ICONS.profile}<span>我的</span></button>
      </div>
    </div>
  );
};
