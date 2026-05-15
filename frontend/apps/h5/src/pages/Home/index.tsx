/**
 * P-HOME · 今日聚合首页 (MVP subset for SC01-T09)
 * 1:1 对齐 design/mockups/wrongbook/01_home_v2.html (hero card subset)
 *
 * T09 scope: HERO dark card + "全部开始" CTA → POST /sessions → navigate P07
 *   AC1: Tap 大卡「全部开始」CTA · 按钮 loading + 触觉 medium
 *   AC2: POST /api/review/sessions body {date, node_ids:[...]} → 200 {sid, nids[], total}
 *   AC3: P-HOME → P07 跳转 ≤ 500ms
 *
 * trace: biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 步 14
 *        + design/system/pages/P-HOME.spec.md §5/§6
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { homeClient, reviewClient } from '@longfeng/api-contracts';
import type { HomeTodayResp } from '@longfeng/api-contracts';
import { TEST_IDS } from '@longfeng/testids';
import { track } from '@longfeng/telemetry';
import s from './Home.module.css';

// ─── Fallback data (when backend unavailable) ──────────────────
const FALLBACK_TODAY: HomeTodayResp = {
  tz: 'Asia/Shanghai',
  today: { total: 8, done: 0, circleProgress: 0 },
  resume: null,
};

// ─── Ring SVG helper ────────────────────────────────────────────
const RING_R = 33;
const RING_CIRC = 2 * Math.PI * RING_R;

export const HomePage: React.FC = () => {
  const nav = useNavigate();

  // ── State ──────────────────────────────────────────────────
  const [todayData, setTodayData] = useState<HomeTodayResp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // ── Fetch today data on mount ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await homeClient.getToday();
        if (!cancelled) {
          setTodayData(resp);
          setIsLoading(false);
          track('home_view', { tz: resp.tz, total: resp.today.total, done: resp.today.done, resume: false });
        }
      } catch {
        // §9 降级: 用 fallback 数据
        if (!cancelled) {
          setTodayData(FALLBACK_TODAY);
          setIsLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const today = todayData?.today ?? FALLBACK_TODAY.today;
  const progress = today.circleProgress;
  const dashOffset = RING_CIRC * (1 - progress);

  // ── AC1+AC2: Tap "全部开始" → POST /sessions → P07 ───────
  const handleStartAll = useCallback(async () => {
    if (isStarting || today.total === 0) return;
    setIsStarting(true);

    // AC1: 触觉 medium
    try {
      if ('vibrate' in navigator) navigator.vibrate(15);
    } catch { /* noop */ }

    try {
      // AC2: POST /api/review/sessions
      const resp = await reviewClient.createSession({ tz: 'Asia/Shanghai' });

      // TI3: 埋点 home_today_start_all{count}
      track('home_today_start_all', { count: resp.total });

      // AC3: P-HOME → P07 ≤ 500ms
      nav(`/review/today?sid=${resp.sid}&total=${resp.total}`);
    } catch {
      setToast('稍后再试');
      setTimeout(() => setToast(null), 3000);
      setIsStarting(false);
    }
  }, [isStarting, today.total, nav]);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className={s.root} data-testid={TEST_IDS.pHome.root}>

      {/* ── Topbar (mockup .topbar) ─────────────────────── */}
      <div className={s.topbar}>
        <div className={s.greet} data-testid={TEST_IDS.pHome.greetingHero}>
          小 A, 今天继续 💪
        </div>
        <div className={s.greetSub}>
          {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
        </div>
      </div>

      {/* ── Scroll content ─────────────────────────────── */}
      <div className={s.scroll}>

        {/* ── HERO dark card (mockup .hero) ──────────────── */}
        <div className={s.hero} data-testid={TEST_IDS.pHome.todayReviewCard}>
          <div className={s.heroKicker}>今日复习</div>
          <div className={s.heroRow}>
            <div className={s.heroLeft}>
              <div>
                <span className={s.heroBig} data-testid={TEST_IDS.pHome.totalLabel}>
                  {today.total}
                </span>
                <span className={s.heroBigUnit}>题</span>
              </div>
              <div className={s.heroEst} data-testid={TEST_IDS.pHome.estMin}>
                预计 {Math.max(1, Math.round(today.total * 3))} 分钟
              </div>
            </div>

            {/* Ring progress */}
            <svg className={s.ring} viewBox="0 0 78 78" data-testid={TEST_IDS.pHome.circleProgress}>
              <circle className={s.ringBg} cx="39" cy="39" r={RING_R} />
              <circle
                className={s.ringFg}
                cx="39" cy="39" r={RING_R}
                strokeDasharray={RING_CIRC}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 39 39)"
              />
              <text className={s.ringText} x="39" y="39">
                {today.done}/{today.total}
              </text>
            </svg>
          </div>

          {/* CTA: 全部开始 */}
          <button
            className={s.heroCta}
            data-testid={TEST_IDS.pHome.startAllBtn}
            onClick={handleStartAll}
            disabled={isStarting || isLoading || today.total === 0}
            aria-label="开始复习"
          >
            {isStarting ? (
              <><span className={s.spinner} aria-hidden="true" /> 加载中…</>
            ) : (
              <>▶ 开始复习</>
            )}
          </button>
        </div>

        {/* ── Placeholder sections (T08 并发 · stub fallback) ── */}
        <div className={s.section}>
          <div className={s.sectionTitle}>本周</div>
          <div className={s.placeholder} data-testid={TEST_IDS.pHome.weeklySparkline}>
            掌握率 · Phase 1+
          </div>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>日程</div>
          <div className={s.placeholder} data-testid={TEST_IDS.pHome.weekStrip}>
            7-day strip · Phase 1+
          </div>
        </div>
      </div>

      {/* ── TabBar ─────────────────────────────────────── */}
      <div className={s.tabbar}>
        <div className={s.tabActive}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 11 L12 3 L21 11 V20 a1 1 0 0 1 -1 1 H14 V14 H10 V21 H4 a1 1 0 0 1 -1 -1 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>
          </svg>
          <span>首页</span>
        </div>
        <div className={s.tab}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 4h11l3 3v13H5V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
          <span>错题本</span>
        </div>
        <div className={s.tab}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="13" r="4.5" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M5 8h3l1.5-2h5L16 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
          <span>拍题</span>
        </div>
        <div className={s.tab}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8.5" r="3.8" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M4.5 20c1.2-3.8 4.2-5.6 7.5-5.6s6.3 1.8 7.5 5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span>我的</span>
        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────── */}
      {toast && (
        <div className={s.toast} role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
};
