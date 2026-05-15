/**
 * P09 · 复习完成 (ReviewDone)
 * Mood B · pure-warm · STYLE-TRUTH §3 Mood B
 *
 * 1:1 对齐 design/mockups/wrongbook/09_review_done.html
 *
 * 状态机: LOADING → RESULT | ALL_DONE (per spec §6)
 *   RESULT · 单题完成普通态 · 双 CTA (继续 + 结束)
 *   ALL_DONE · session 完成庆祝态 · 仅 CTA 结束本次
 *
 * A11y: aria-live="polite" on toast, aria-label on CTA buttons
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { reviewClient, NodeResultResp, NextInSessionResp, CalendarSubscribeResp } from '@longfeng/api-contracts';
import { TEST_IDS, p09Ids } from '@longfeng/testids';
import { track } from '@longfeng/telemetry';
import s from './ReviewDone.module.css';

// ─── Types ───────────────────────────────────────────────────
type PageState = 'LOADING' | 'RESULT' | 'ALL_DONE' | 'ERROR';

// ─── Mock / placeholder data (fallback when API unavailable) ──
const MOCK_NODE_RESULT: NodeResultResp = {
  planId: 1001,
  wrongItemId: 2001,
  nodeIndex: 2,
  nodeState: 'MASTERED',
  quality: 5,
  easeBefore: 2.5,
  easeAfter: 2.6,
  intervalBefore: 1,
  intervalAfter: 3,
  nextDueAt: new Date(Date.now() + 3 * 86400000).toISOString(),
  durationMs: 128000,
  mastered: true,
};

const MOCK_KP_DELTA = [
  { kp: '顶点式 · 配方法', oldPct: 72, newPct: 86 },
  { kp: '对称轴方程', oldPct: 60, newPct: 74 },
  { kp: '判别式 Δ 应用', oldPct: 45, newPct: 58 },
  { kp: '韦达定理', oldPct: 30, newPct: 42 },
];

const KP_COLORS = ['#34C759', '#007AFF', '#FF9500', '#FF3B30'];
const KP_GRADIENTS = [
  'linear-gradient(90deg,#34C759,#22A24A)',
  'linear-gradient(90deg,#5AA3FF,#0062E1)',
  'linear-gradient(90deg,#FFB84D,#E08100)',
  'linear-gradient(90deg,#FF6B60,#D72B22)',
];

// ─── Confetti particles config (mockup L137-L148) ────────────
const CONFETTI_PARTICLES = [
  { left: '10%', top: '18%', bg: '#FFD166', rotate: 20 },
  { left: '22%', top: '62%', bg: '#EF476F', rotate: -18 },
  { left: '34%', top: '30%', bg: '#118AB2', rotate: 40 },
  { left: '68%', top: '18%', bg: '#FFD166', rotate: -30 },
  { left: '82%', top: '44%', bg: '#06D6A0', rotate: 12 },
  { left: '90%', top: '72%', bg: '#EF476F', rotate: -40 },
  { left: '6%', top: '80%', bg: '#06D6A0', rotate: 60 },
  { left: '58%', top: '78%', bg: '#118AB2', rotate: -10 },
];

// ─── Timeline labels ────────────────────────────────────────
const T_LEVELS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'] as const;
const T_INTERVALS = ['1h', '1d', '3d', '7d', '15d', '30d'];

function getNodeState(tLevel: string, currentNodeIndex: number): 'done' | 'now' | 'future' {
  const idx = parseInt(tLevel.replace('T', ''), 10);
  if (idx < currentNodeIndex) return 'done';
  if (idx === currentNodeIndex) return 'now';
  return 'future';
}

function formatNextDue(iso: string): string {
  try {
    const d = new Date(iso);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const wd = weekdays[d.getDay()];
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${month} 月 ${day} 日 · ${wd} · ${hh}:${mm}`;
  } catch {
    return '即将安排';
  }
}

// ─── Skeleton subcomponent ───────────────────────────────────
function Skeleton() {
  return (
    <div className={s.skeleton}>
      <div className={s.skeletonCard} />
      <div className={s.skeletonBar} style={{ width: '60%' }} />
      <div className={s.skeletonBar} style={{ width: '85%' }} />
      <div className={s.skeletonCard} />
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export const ReviewDonePage: React.FC = () => {
  const [params] = useSearchParams();
  const nid = params.get('nodeId') || 'mock-nid-001';
  const sid = params.get('sid') || 'mock-sid-001';

  const [pageState, setPageState] = useState<PageState>('LOADING');
  const [toast, setToast] = useState<string | null>(null);
  const [calendarSubscribed, setCalendarSubscribed] = useState(false);

  // Simulated session stats (in production derived from session service)
  const [sessionStats] = useState({ mastered: 4, partial: 1, forgot: 0, total: 8, done: 5 });
  const kpDelta = MOCK_KP_DELTA;

  // ── GET /api/review/nodes/{nid}/result ──────────────────
  const { data: nodeResult, isLoading, isError } = useQuery({
    queryKey: ['review', 'nodeResult', nid],
    queryFn: () => reviewClient.getNodeResult(nid),
    enabled: !!nid,
    retry: 1,
    staleTime: 30_000,
    placeholderData: MOCK_NODE_RESULT,
  });

  const result: NodeResultResp = nodeResult ?? MOCK_NODE_RESULT;

  // Determine page state based on result + session info
  useEffect(() => {
    if (isLoading && !nodeResult) {
      setPageState('LOADING');
      return;
    }
    if (isError && !nodeResult) {
      // §9 degradation: Hero neutral + Toast
      setPageState('RESULT');
      setToast('结果同步中');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    // Check if session is done (via query param or peekNext)
    const isDone = params.get('allDone') === 'true';
    setPageState(isDone ? 'ALL_DONE' : 'RESULT');
  }, [isLoading, isError, nodeResult, params]);

  // ── Telemetry: wb_done_view ──────────────────────────────
  useEffect(() => {
    if (pageState === 'RESULT' || pageState === 'ALL_DONE') {
      track('wb_done_view', {
        nid,
        nextT: result.nodeIndex + 1,
        grade: result.mastered ? 'MASTERED' : 'FORGOT',
        state: pageState,
      });
    }
  }, [pageState, nid, result.nodeIndex, result.mastered]);

  // ── Calendar subscribe mutation ──────────────────────────
  const subscribeMutation = useMutation<CalendarSubscribeResp, unknown, void>({
    mutationFn: () => {
      // eventId comes from the next calendar event for this node
      const eid = String(result.planId);
      return reviewClient.subscribeCalendar(eid, crypto.randomUUID());
    },
    onSuccess: () => {
      setCalendarSubscribed(true);
      setToast('已同步到日历');
      setTimeout(() => setToast(null), 3000);
      track('wb_done_add_calendar', { nid, eid: result.planId });
    },
    onError: () => {
      setToast('日历同步失败 · 稍后重试');
      setTimeout(() => setToast(null), 3000);
    },
  });

  const handleAddCalendar = useCallback(() => {
    if (calendarSubscribed || subscribeMutation.isPending) return;
    subscribeMutation.mutate();
  }, [calendarSubscribed, subscribeMutation]);

  // ── Continue / End handlers ──────────────────────────────
  const handleContinue = useCallback(() => {
    track('wb_done_continue', { prevNid: nid, nextNid: 'next' });
    // In production: POST /sessions/{sid}/next → navigate to P08
    // For now navigate back (handled by router integration)
    window.history.back();
  }, [nid]);

  const handleEnd = useCallback(() => {
    track('wb_done_exit', { nid, returnTo: 'home', state: pageState });
    // Navigate to P-HOME
    window.location.href = '/';
  }, [nid, pageState]);

  // ── Derived values ───────────────────────────────────────
  const isForgot = result.nodeState === 'ACTIVE' && !result.mastered;
  const prevT = `T${Math.max(0, result.nodeIndex)}`;
  const nextT = `T${result.nodeIndex + 1}`;
  const masteryPct = Math.round(result.easeAfter * 32); // approximate display
  const nextDueFormatted = formatNextDue(result.nextDueAt);

  // ───────────────────────────────────────────────────────────
  return (
    <div
      className={s.root}
      data-testid={TEST_IDS.p09.root}
      data-mood="B"
    >
      {/* ── Hero ────────────────────────────────────────── */}
      <div
        className={`${s.hero}${isForgot ? ` ${s.heroForgot}` : ''}`}
        data-testid={TEST_IDS.p09.celebrateHero}
      >
        {/* Confetti (≤ 1s animation · pointer-events:none · TI1) */}
        <div className={s.confetti} data-testid={TEST_IDS.p09.confettiBurst}>
          {CONFETTI_PARTICLES.map((p, i) => (
            <span
              key={i}
              className={s.confettiParticle}
              data-testid={p09Ids.confettiParticle(i)}
              style={{
                left: p.left,
                top: p.top,
                background: p.bg,
                transform: `rotate(${p.rotate}deg)`,
              }}
            />
          ))}
        </div>

        {/* Hero checkmark icon */}
        <div className={s.heroIcon} data-testid={TEST_IDS.p09.heroCheckmark}>
          <div className={s.heroIconCore}>
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <circle cx="22" cy="22" r="20" fill="url(#heroGrad)" />
              <path
                d="M13 22.6 L19 28 L31 15.5"
                stroke="#fff"
                strokeWidth="3.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34C759" />
                  <stop offset="100%" stopColor="#1E9748" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div className={s.heroKicker}>Review complete</div>
        <div className={s.heroTitle} data-testid={TEST_IDS.p09.heroTitle}>
          {pageState === 'ALL_DONE'
            ? '今日复习全部完成 🎉'
            : isForgot
              ? '需要再练习'
              : '本题已掌握'}
        </div>
        <div className={s.heroSub}>
          {pageState === 'ALL_DONE'
            ? `共完成 ${sessionStats.total} 题 · 掌握 ${sessionStats.mastered} 题`
            : `记忆曲线向前推进一节点 · ${prevT} → ${nextT}`}
        </div>

        <div className={s.heroChips}>
          {pageState === 'ALL_DONE' ? (
            <div className={s.heroChip} data-testid={TEST_IDS.p09.heroStreakNumber}>
              连续 {sessionStats.done} 题
            </div>
          ) : (
            <>
              <div className={s.heroChip}>+{result.intervalAfter - result.intervalBefore} 记忆度</div>
              <div className={s.heroChip}>连续 {sessionStats.done} 题</div>
              <div className={s.heroChip}>
                耗时 {Math.floor(result.durationMs / 60000)}m {Math.floor((result.durationMs % 60000) / 1000)}s
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Skeleton (LOADING state) ──────────────────── */}
      {pageState === 'LOADING' && <Skeleton />}

      {/* ── Scroll content ────────────────────────────── */}
      {pageState !== 'LOADING' && (
        <div className={s.scroll}>
          {/* Memory Curve Card */}
          <div className={s.blockTitle}>
            <span className={s.blockTitleDot} />
            记忆曲线进度
          </div>

          <div className={`${s.card}`} data-testid={TEST_IDS.p09.memoryCurve}>
            <div className={s.mcHead}>
              <div>
                <div className={s.mcTitle}>记忆节点进度</div>
                <div className={s.mcSub}>复习计划 · 艾宾浩斯遗忘曲线</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className={s.mcMastery}>{masteryPct}%</div>
                <div className={s.mcMasteryLabel}>Mastery</div>
              </div>
            </div>

            {/* 6-node timeline */}
            <div className={s.nodesContainer}>
              <svg
                viewBox="0 0 320 70"
                preserveAspectRatio="none"
                style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}
              >
                <defs>
                  <linearGradient id="curveGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#34C759" stopOpacity=".7" />
                    <stop offset="55%" stopColor="#007AFF" stopOpacity=".7" />
                    <stop offset="100%" stopColor="#8E8E93" stopOpacity=".35" />
                  </linearGradient>
                </defs>
                <path d="M0 10 H320 M0 35 H320 M0 60 H320" stroke="rgba(120,120,128,.14)" strokeWidth=".5" strokeDasharray="2 3" />
                <path d="M10 12 C40 8, 70 22, 100 26 C130 30, 160 44, 200 50 C240 56, 280 60, 310 62" stroke="url(#curveGrad)" strokeWidth="2.2" fill="none" />
                <path d="M10 12 C40 8, 70 22, 100 26 C130 30, 160 44, 200 50 C240 56, 280 60, 310 62 L310 70 L10 70 Z" fill="url(#curveGrad)" fillOpacity=".10" />
              </svg>

              <div className={s.nodesRow}>
                {T_LEVELS.map((tl, i) => {
                  const state = getNodeState(tl, result.nodeIndex);
                  return (
                    <div key={tl} className={s.node} data-testid={p09Ids.memoryCurveNode(tl)}>
                      <span
                        className={`${s.nodeDot}${state === 'done' ? ` ${s.nodeDotDone}` : state === 'now' ? ` ${s.nodeDotNow}` : ''}`}
                      />
                      <span className={`${s.nodeLabel}${state === 'done' ? ` ${s.nodeLabelDone}` : state === 'now' ? ` ${s.nodeLabelNow}` : ''}`}>
                        {tl}
                      </span>
                      <span className={s.nodeDate}>{T_INTERVALS[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Advance Banner */}
            <div className={s.advance} data-testid={TEST_IDS.p09.advanceBanner}>
              <div className={s.advanceIcon}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1 L9.6 5.4 L14 7 L9.6 8.6 L8 13 L6.4 8.6 L2 7 L6.4 5.4 Z" fill="#fff" />
                </svg>
              </div>
              <div className={s.advanceText} data-testid={TEST_IDS.p09.advanceBannerText}>
                AI 已按艾宾浩斯模型推进节点，下次复习节点{' '}
                <span className={s.advanceTextEm}>{nextT}</span>
                （{result.intervalAfter} 天后），未来 6 次提醒已自动更新。
              </div>
            </div>
          </div>

          {/* Next Due Card */}
          <div className={s.nextCard} data-testid={TEST_IDS.p09.nextDueCard}>
            <div className={s.nextLeft}>
              <div className={s.nextIcon}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <rect x="3" y="5" width="16" height="14" rx="3" stroke="#1E7F3C" strokeWidth="1.6" />
                  <path d="M3 9 H19" stroke="#1E7F3C" strokeWidth="1.6" />
                  <path d="M7 3 V6 M15 3 V6" stroke="#1E7F3C" strokeWidth="1.6" strokeLinecap="round" />
                  <circle cx="15" cy="14" r="2" fill="#34C759" />
                </svg>
              </div>
              <div>
                <div className={s.nextKicker}>下次复习</div>
                <div className={s.nextDate}>{nextDueFormatted}</div>
                <div className={s.nextMemo}>提前 30 min 提醒 · 24h 有效窗口</div>
              </div>
            </div>
            <button
              className={s.addCalendarBtn}
              data-testid={TEST_IDS.p09.addCalendarBtn}
              onClick={handleAddCalendar}
              disabled={calendarSubscribed || subscribeMutation.isPending}
              aria-label="加入日历"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 2 V10 M2 6 H10" stroke="#007AFF" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {calendarSubscribed ? '已添加' : '日历'}
            </button>
          </div>

          {/* Stats Row */}
          <div className={s.blockTitle} style={{ marginTop: 16 }}>
            <span className={s.blockTitleDot} style={{ background: '#007AFF' }} />
            今日复习战绩
            <span className={s.blockTitleRight}>
              已完成 {sessionStats.done} / {sessionStats.total} · 剩余 {sessionStats.total - sessionStats.done} 题
            </span>
          </div>
          <div className={s.stats} data-testid={TEST_IDS.p09.statsRow}>
            <div className={s.stat} data-testid={TEST_IDS.p09.statsMastered}>
              <div className={`${s.statBig} ${s.statGreen}`}>{sessionStats.mastered}</div>
              <div className={s.statLabel}>Mastered</div>
            </div>
            <div className={s.stat} data-testid={TEST_IDS.p09.statsPartial}>
              <div className={`${s.statBig} ${s.statBlue}`}>{sessionStats.partial}</div>
              <div className={s.statLabel}>Partial</div>
            </div>
            <div className={s.stat} data-testid={TEST_IDS.p09.statsForgot}>
              <div className={`${s.statBig} ${s.statOrange}`}>{sessionStats.forgot}</div>
              <div className={s.statLabel}>Forgot</div>
            </div>
          </div>

          {/* KP Chart */}
          <div className={s.blockTitle} style={{ marginTop: 16 }}>
            <span className={s.blockTitleDot} style={{ background: '#5856D6' }} />
            知识点掌握变化
          </div>
          <div className={s.kpList} data-testid={TEST_IDS.p09.kpChart}>
            {kpDelta.map((kp, i) => (
              <div key={i} className={s.kpRow}>
                <span className={s.kpSquare} style={{ background: KP_COLORS[i] || '#8E8E93' }} />
                <span className={s.kpName}>{kp.kp}</span>
                <span className={s.kpBar}>
                  <span
                    className={s.kpBarFill}
                    data-testid={p09Ids.kpChartBarNew(i)}
                    style={{
                      width: `${kp.newPct}%`,
                      background: KP_GRADIENTS[i] || KP_GRADIENTS[0],
                    }}
                  />
                </span>
                <span className={s.kpPct}>{kp.newPct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CTA dock ──────────────────────────────────── */}
      {pageState !== 'LOADING' && (
        <div className={s.cta} data-testid={TEST_IDS.p09.ctaRow}>
          <button
            className={`${s.btn} ${s.btnSec}`}
            data-testid={TEST_IDS.p09.ctaEndBtn}
            onClick={handleEnd}
            aria-label="结束本次"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 4 H13 V13 a1 1 0 0 1 -1 1 H4 a1 1 0 0 1 -1 -1 Z M6 4 V3 a1 1 0 0 1 1 -1 h2 a1 1 0 0 1 1 1 V4 M2 4 H14" stroke="#1C1C1E" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            结束本次
          </button>
          {/* TI2: ALL_DONE 隐藏继续按钮 */}
          {pageState !== 'ALL_DONE' && (
            <button
              className={`${s.btn} ${s.btnPri}`}
              data-testid={TEST_IDS.p09.ctaContinueBtn}
              onClick={handleContinue}
              aria-label="继续复习"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 3 L12 8 L4 13 Z" fill="#fff" />
              </svg>
              继续复习 · 第 {sessionStats.done + 1} 题
            </button>
          )}
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────── */}
      {toast && (
        <div className={s.toast} role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
};
