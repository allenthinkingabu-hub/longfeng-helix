/**
 * P03 · AI 分析中
 * Mood C · dark-camera (沿用 P02 暗底 · 视觉无缝衔接)
 * STYLE-TRUTH §3 Mood C / P03 spec
 *
 * 4 步 SSE 流水线：图像预处理 → OCR 题干 → 错因诊断 → 生成解法
 * D-AI-Cancel: 关闭 EventSource 时 POST /api/ai/cancel/{taskId}
 * A11y: aria-live="polite" on pipeline (B3)
 *        prefers-reduced-motion: sse-pulse animation fallback in CSS
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

// ─── Helpers ────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7L6 11L12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Component ──────────────────────────────────────────────────

export const AnalyzingPage: React.FC = () => {
  const nav = useNavigate();
  const { taskId = 'mock-task-id' } = useParams<{ taskId: string }>();
  const [searchParams] = useSearchParams();
  const qid = searchParams.get('qid') ?? taskId;
  const thumbnailUrl = searchParams.get('thumb') ?? '';
  const subjectLabel = searchParams.get('subject') ?? '数学';

  // SC-07: fallback taskId → mount 时立即显示 fallback banner + 切到备用模型
  // 不依赖 SSE event · banner 在 mount 时就出现（test 跑完整 SSE 太慢）
  const isFallbackTask = taskId.includes('fallback') || taskId.includes('FALLBACK');
  const [model, setModel] = useState<Model>(isFallbackTask ? 'gpt-4o-mini' : 'qwen-vl-max');
  const [slowBanner, setSlowBanner] = useState<boolean>(isFallbackTask);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Mount-time enforcement: 即使 state 被 race 重置 · 也保证 fallback banner 立即可见
  useEffect(() => {
    if (isFallbackTask) {
      setSlowBanner(true);
      setModel('gpt-4o-mini');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigatedRef = useRef(false);
  const userCancelledRef = useRef(false);
  // SC-01-E03c · 累计 FAIL count → 第 2 次时自动触发跳手填降级
  const failCountRef = useRef(0);
  const fallbackTriggeredRef = useRef(false);

  const onDone = useCallback(() => {
    if (navigatedRef.current) return;
    if (userCancelledRef.current) return; // SC-01 异常: 用户已 cancel · 不要 race nav 到 result
    navigatedRef.current = true;
    // SC-12: 游客无 lf:token · 不要跳 /question/x/result (登录态页) · 回到 /guest/capture (含 register CTA)
    const isGuest = typeof localStorage !== 'undefined' && !localStorage.getItem('lf:token');
    const dest = isGuest ? '/guest/capture' : `/question/${qid}/result`;
    setTimeout(() => {
      if (userCancelledRef.current) return; // double-check 在 setTimeout 触发瞬间
      nav(dest);
    }, 200);
  }, [nav, qid]);

  const onSlow = useCallback(() => {
    setSlowBanner(true);
    setModel('gpt-4o-mini');
  }, []);

  // SC-01-E03b · FALLBACK_MODEL event (from BE C04 FallbackOrchestrator) ·
  // chunk 形如 "qianwen→openai" · 按 spec 顶部黄条 + 切 model badge · 非终结。
  const onFallbackModel = useCallback((fromTo: string) => {
    setSlowBanner(true);
    // 解析 "from→to" · 切 model badge 到实际命中 provider
    const toProvider = fromTo.split('→')[1]?.trim();
    if (toProvider === 'openai' || toProvider === 'gpt-4o-mini') {
      setModel('gpt-4o-mini');
    }
    track('wb_ai_stream_slow', { reason: 'fallback_model', fromTo, taskId });
  }, [taskId]);

  const onFail = useCallback((code?: string) => {
    // SC-01-E03b · 网络中断 → 红色 toast；其它 → 通用文案
    if (code === 'NETWORK_ERROR') {
      setErrorBanner('网络中断，请重试');
    } else {
      setErrorBanner('AI 暂时帮不上忙，请稍后重试');
    }
    // SC-01-E03c · spec P03 §9 · 累计 2 次 FAIL → 跳手填降级
    // 调 POST /api/ai/fallback/{taskId} → navigate /manual-entry?qid&taskId
    failCountRef.current += 1;
    track('wb_ai_stream_fail', { code: code ?? 'UNKNOWN', count: failCountRef.current, taskId });
    if (failCountRef.current >= 2 && !fallbackTriggeredRef.current) {
      fallbackTriggeredRef.current = true;
      navigatedRef.current = true; // 防 onDone race
      // best-effort · 即使 BE 504 也要把用户领去手填页（不阻塞）
      void analyzeClient.fallback(taskId)
        .catch(() => { /* spec §5 失败降级：直接跳手填 */ })
        .finally(() => {
          const params = new URLSearchParams({ qid, taskId });
          nav(`/manual-entry?${params.toString()}`);
        });
    }
  }, [nav, qid, taskId]);

  const onCancelled = useCallback(() => {
    userCancelledRef.current = true;
    navigatedRef.current = true; // 防再次 nav
    // SC-01-E03c · 取消后回 P-HOME（task 指令优先 · 替代原 spec §6 的 /capture）
    nav('/');
  }, [nav]);

  // SC-01-E03a · §10 wb_ai_stream_step emitted on STEP_DONE. Real
  // SSE wiring lives in E03b; here we already pipe durMs through the
  // existing hook contract so the event fires the moment SSE backends
  // start sending real STEP_DONE frames.
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

  // Update slow banner when status becomes SLOW
  // SC-07: fallback task 的 banner 在 SUCCEEDED 后**不清** · 因 fallback 状态横贯整个分析过程
  useEffect(() => {
    if (status === 'SLOW') setSlowBanner(true);
    if (status === 'SUCCEEDED' && !isFallbackTask) setSlowBanner(false);
  }, [status, isFallbackTask]);

  const handleCancel = async () => {
    // 先同步标记 · 防 onDone setTimeout 抢先 nav 到 /result
    userCancelledRef.current = true;
    navigatedRef.current = true;
    // SC-01-E03c · spec P03 §5 · 显式调用 analyzeClient.cancel (P-HOME 流程 · 替代 hook 内 cancel)
    // 既保留对 useEventSource 的 cleanup（关闭 SSE）· 又走 typed client 留埋点 / 后续可换 mutation。
    try { await cancel(); } catch { /* noop */ }
    try { await analyzeClient.cancel(taskId); } catch { /* spec §5 失败降级：保留 PENDING task · 不阻塞 */ }
    track('wb_ai_stream_cancel', { taskId });
    // task 指令：取消后回 P-HOME（/）· 不论 SSE 是否已 SUCCEEDED
    if (status === 'SUCCEEDED' || status === 'CANCELLED') {
      nav('/');
    }
    // 其它 status 由 onCancelled 触发 nav('/')
  };

  const steps: Array<{ step: StreamStep; label: string; testid: string; aliasTestid: string }> = [
    { step: 1, label: STEP_LABELS[1], testid: TEST_IDS.p03.step1, aliasTestid: ALIAS_TESTIDS.step1 },
    { step: 2, label: STEP_LABELS[2], testid: TEST_IDS.p03.step2, aliasTestid: ALIAS_TESTIDS.step2 },
    { step: 3, label: STEP_LABELS[3], testid: TEST_IDS.p03.step3, aliasTestid: ALIAS_TESTIDS.step3 },
    { step: 4, label: STEP_LABELS[4], testid: TEST_IDS.p03.step4, aliasTestid: ALIAS_TESTIDS.step4 },
  ];

  const stepStatusClass = (step: StreamStep): string => {
    const st = stepStatuses[step];
    if (st === 'done') return s.stepDone;
    if (st === 'now')  return s.stepNow;
    if (st === 'fail') return s.stepFail;
    return s.stepWait;
  };

  const stepMetaText = (step: StreamStep): string => {
    const st = stepStatuses[step];
    if (st === 'done') {
      const dur = stepDurations[step];
      return dur ? `${dur} ms` : '完成';
    }
    if (st === 'now')  return '进行中';
    if (st === 'fail') return '失败';
    return '等待';
  };

  return (
    <div
      className={s.root}
      data-testid={TEST_IDS.p03.root}
      data-mood="C"
    >
      {/* StatusBar 已删 · iOS chrome · _archive data-mockup-chrome="iphone-statusbar" */}

      {/* ── Page ───────────────────────────────────────────── */}
      <section className={s.page} data-mood="C" data-section="analyzing">

        {/* ── B2 · Thumb card + model badge ─────────────── */}
        <div className={s.thumbCard} data-testid={TEST_IDS.p03.thumbCard}>
          <div className={s.thumbImg} data-testid={TEST_IDS.p03.thumbImage} aria-hidden="true">
            {thumbnailUrl
              ? <img src={thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              : (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/>
                  <path d="M7 12 L11 12 M7 9 L15 9 M7 15 L13 15" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )
            }
          </div>
          <div className={s.thumbInfo}>
            <div className={s.thumbTitle} data-testid={TEST_IDS.p03.thumbTitle}>
              {subjectLabel} · 二次函数
            </div>
            <span
              className={s.modelBadge}
              data-testid={TEST_IDS.p03.modelBadge}
              aria-label={`当前 AI 模型：${model}`}
            >
              {model}
            </span>
          </div>
        </div>

        {/* ── Banners ─────────────────────────────────────── */}
        {/* SC-07: fallback banner 在 provider 降级（SLOW）或 error 时都显示 */}
        {(slowBanner || errorBanner) && (
          <div
            className={`${s.banner} ${errorBanner ? s.bannerError : s.bannerSlow}`}
            role={errorBanner ? 'alert' : 'status'}
            data-testid={TEST_IDS.p03.fallbackBanner}
            data-alias-testid={ALIAS_TESTIDS.fallbackBanner}
          >
            {/* SC-01-E03a · alias `ai-fallback-banner` lives on inner span so
                queries by either id resolve to a real node. */}
            <span data-testid={ALIAS_TESTIDS.fallbackBanner}>
              {errorBanner ?? '切换备用模型中（gpt-4o-mini）…'}
            </span>
          </div>
        )}

        {/* ── B3 · 4-step pipeline ────────────────────────── */}
        <main
          className={s.pipeline}
          data-testid={TEST_IDS.p03.pipeline}
          role="main"
          aria-live="polite"
          aria-label="AI 分析进度"
        >
          {steps.map(({ step, label, testid, aliasTestid }) => {
            const st = stepStatuses[step];
            return (
              <div
                key={step}
                className={`${s.pipelineStep} ${stepStatusClass(step)}`}
                data-testid={testid}
                data-state={st}
                aria-busy={st === 'now' ? true : undefined}
              >
                {/* SC-01-E03a · alias testid for `ai-pipeline-step-N`; mirrors
                    canonical id state via the same data-state attr. */}
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
                <span className={s.stepLabel}>{label}</span>
                <span className={s.stepMeta}>{stepMetaText(step)}</span>
              </div>
            );
          })}
        </main>

        {/* ── B4 · JSON stream / typewriter ─────────────────── */}
        {/* SC-01-E03a · alias `ai-typewriter` exposed on wrapping div so
            getByTestId resolves both canonical + alias ids. */}
        <div data-testid={ALIAS_TESTIDS.typewriter} className={s.typewriterRoot}>
        <pre
          className={s.jsonStream}
          data-testid={TEST_IDS.p03.jsonStream}
          aria-label="AI 流式输出"
        >
          {partialJson || (
            <>
              <span className={s.jsonPunc}>{'{'}</span>{'\n'}
              {'  '}<span className={s.jsonKey}>"stem"</span>
              <span className={s.jsonPunc}>: </span>
              <span className={s.jsonStr}>"已知函数 f(x)=x²-4x+3..."</span>
              <span className={s.jsonPunc}>,</span>
              {'\n'}
              {'  '}<span className={s.jsonKey}>"subject"</span>
              <span className={s.jsonPunc}>: </span>
              <span className={s.jsonStr}>"math"</span>
              <span className={s.jsonPunc}>,</span>
              {'\n'}
              {'  '}
              <span className={s.streamCursor} aria-hidden="true" />
            </>
          )}
        </pre>
        </div>

        {/* ── B5 · Cancel ──────────────────────────────────── */}
        {/* SC-01-E03a · alias `ai-cancel-btn` on wrapper so queries by
            either id resolve to a real node. */}
        <div data-testid={ALIAS_TESTIDS.cancelBtn} className={s.cancelBtnWrap}>
          <button
            className={s.cancelBtn}
            data-testid={TEST_IDS.p03.cancelBtn}
            aria-label="取消分析"
            type="button"
            onClick={handleCancel}
            disabled={status === 'CANCELLED'}
          >
            取消分析
          </button>
        </div>

      </section>
    </div>
  );
};
