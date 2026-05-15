/**
 * P-HOME · 今日聚合首页 (Home · Today Aggregator)
 *
 * 1:1 对齐 design/mockups/wrongbook/01_home_v2.html (canonical v2)
 *
 * 状态机: LOADING → READY | EMPTY | ERROR (per spec §6)
 *   READY  · total>0 · 大卡 + 圆环 + 学科 chips + CTA
 *   EMPTY  · total=0 (or done==total) · hero 切「今天已完成」
 *   ERROR  · 5xx/timeout · 顶部黄条
 *
 * T14 AC3: 大卡数字 N→N-1 动画 ≥300ms
 * T14 AC4: 圆环动画 300ms easeInOut
 * T14 AC5: done==total → hero 切「今天已完成」+ Tab 3 拍题高亮
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { homeClient, HomeTodayResp } from '@longfeng/api-contracts';
import { TEST_IDS } from '@longfeng/testids';
import { track } from '@longfeng/telemetry';
import s from './Home.module.css';

// ─── Types ───────────────────────────────────────────────────
type PageState = 'LOADING' | 'READY' | 'EMPTY' | 'ERROR';

// ─── Mock / placeholder data (fallback when API unavailable) ──
const MOCK_HOME_DATA: HomeTodayResp = {
  tz: 'Asia/Shanghai',
  today: {
    total: 8,
    done: 3,
    circleProgress: 0.375,
  },
  resume: null,
};

// ─── Static data (Phase 1+ fields · MVP hardcoded) ──────────
const MOCK_SUBJECTS = [
  { name: '数学', count: 3, color: '#FB7185' },
  { name: '物理', count: 2, color: '#FCD34D' },
  { name: '英语', count: 3, color: '#86EFAC' },
];

const MOCK_WEEK_DAYS = [
  { w: 'Mon', d: 20, dots: ['r', 'o'] },
  { w: 'Tue', d: 21, dots: ['r', 'g'] },
  { w: 'Wed', d: 22, dots: ['r', 'o', 'g', 'r', 'i'], today: true, num: 8 },
  { w: 'Thu', d: 23, dots: ['g', 'i', 'p'] },
  { w: 'Fri', d: 24, dots: ['o', 'i'] },
  { w: 'Sat', d: 25, dots: ['p'] },
  { w: 'Sun', d: 26, dots: ['g', 'i', 'r'] },
];

const DOT_COLORS: Record<string, string> = {
  r: '#E11D48', o: '#F97316', g: '#059669', i: '#6366F1', p: '#EC4899',
};
const DOT_COLORS_TODAY: Record<string, string> = {
  r: '#FCA5A5', o: '#FDBA74', g: '#86EFAC', i: '#A5B4FC', p: '#F9A8D4',
};

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

// ─── Ring component ──────────────────────────────────────────
const RING_R = 32;
const RING_C = 2 * Math.PI * RING_R; // ~201

function RingProgress({
  progress,
  animating,
}: {
  progress: number;
  animating: boolean;
}) {
  const offset = RING_C * (1 - progress);
  const pct = Math.round(progress * 100);
  return (
    <div
      className={`${s.ring}${animating ? ` ${s.ringAnimating}` : ''}`}
      data-testid={TEST_IDS.pHome.circleProgress}
    >
      <svg width="78" height="78" viewBox="0 0 78 78">
        <circle cx="39" cy="39" r={RING_R} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="5" />
        <circle
          cx="39"
          cy="39"
          r={RING_R}
          fill="none"
          stroke="url(#homeRingGrad)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="homeRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDBA74" />
            <stop offset="100%" stopColor="#FB7185" />
          </linearGradient>
        </defs>
      </svg>
      <div className={s.ringMid}>
        <div className={s.ringNum}>{pct}%</div>
        <div className={s.ringLabel}>DONE</div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export const HomePage: React.FC = () => {
  const [pageState, setPageState] = useState<PageState>('LOADING');
  const [toast, setToast] = useState<string | null>(null);
  const [numberAnimating, setNumberAnimating] = useState(false);
  const [ringAnimating, setRingAnimating] = useState(false);
  const prevTotalRef = useRef<number | null>(null);

  // ── GET /api/home/today ────────────────────────────────
  const { data: homeData, isLoading, isError } = useQuery({
    queryKey: ['home', 'today'],
    queryFn: () => homeClient.getToday(),
    retry: 1,
    staleTime: 10_000,
    placeholderData: MOCK_HOME_DATA,
    refetchOnWindowFocus: true,
  });

  const result: HomeTodayResp = homeData ?? MOCK_HOME_DATA;
  const total = result.today.total;
  const done = result.today.done;
  const remaining = total - done;
  const isAllDone = done >= total && total > 0;
  const progress = result.today.circleProgress;

  // ── State machine ──────────────────────────────────────
  useEffect(() => {
    if (isLoading && !homeData) {
      setPageState('LOADING');
      return;
    }
    if (isError && !homeData) {
      setPageState('ERROR');
      setToast('部分数据正在同步');
      return;
    }
    if (total === 0 || isAllDone) {
      setPageState('EMPTY');
    } else {
      setPageState('READY');
    }
  }, [isLoading, isError, homeData, total, isAllDone]);

  // ── Number animation (T14 AC3: N→N-1 ≥300ms) ──────────
  useEffect(() => {
    if (prevTotalRef.current !== null && prevTotalRef.current !== remaining) {
      setNumberAnimating(true);
      setRingAnimating(true);
      const timer = setTimeout(() => {
        setNumberAnimating(false);
        setRingAnimating(false);
      }, 350);
      return () => clearTimeout(timer);
    }
    prevTotalRef.current = remaining;
  }, [remaining]);

  // ── Telemetry: home_view ───────────────────────────────
  useEffect(() => {
    if (pageState === 'READY' || pageState === 'EMPTY') {
      track('home_view', {
        tz: result.tz,
        total,
        done,
        resume: false,
      });
    }
  }, [pageState, result.tz, total, done]);

  // ── Start all handler (T09 · stub for now) ─────────────
  const handleStartAll = useCallback(() => {
    track('home_today_start_all', { count: remaining });
    // In production: POST /api/review/sessions → navigate to P07
  }, [remaining]);

  // ──────────────────────────────────────────────────────────
  return (
    <div className={s.root} data-testid={TEST_IDS.pHome.root}>
      {/* Ambient wash */}
      <div className={s.ambient} />

      {/* Top bar */}
      <div className={s.topbar} data-testid={TEST_IDS.pHome.greetingHero}>
        <div>
          <div className={s.greetDate}>Tue · Apr 22</div>
          <div className={s.greetHi}>
            小 A, <span className={s.greetHiEm}>今天继续</span>
          </div>
        </div>
        <div className={s.topRight}>
          <div className={s.streakChip} data-testid={TEST_IDS.pHome.streakFireIcon}>
            <svg viewBox="0 0 24 24" fill="#F97316">
              <path d="M12 2s4 4 4 8-2 6-2 6 3 1 3 4-3 4-5 4-5-1-5-4 3-4 3-4-2-2-2-6 4-8 4-8z" />
            </svg>
            <span className={s.streakNum} data-testid={TEST_IDS.pHome.streakDaysNumber}>12</span> 天
          </div>
          <div className={s.avatar}>A</div>
        </div>
      </div>

      {/* Loading skeleton */}
      {pageState === 'LOADING' && <Skeleton />}

      {/* Scroll content */}
      {pageState !== 'LOADING' && (
        <div className={s.scroll}>
          {/* ══════ HERO card ══════ */}
          <div
            className={`${s.hero}${isAllDone ? ` ${s.heroAllDone}` : ''}`}
            data-testid={TEST_IDS.pHome.todayReviewCard}
          >
            <div className={s.heroGrid}>
              <div>
                <div className={s.heroKicker}>
                  {isAllDone ? '今日已完成' : '今日复习'}
                  {!isAllDone && <span className={s.heroKickerTag}>T1 · T3 · T6</span>}
                </div>
                <div className={s.heroDisplay}>
                  <span
                    className={`${s.heroBig}${numberAnimating ? ` ${s.numberAnimating}` : ''}`}
                    data-testid={TEST_IDS.pHome.totalLabel}
                  >
                    {isAllDone ? '0' : String(remaining)}
                  </span>
                  <span className={s.heroUnit}>题</span>
                </div>
                <div className={s.heroSub}>
                  {isAllDone
                    ? '今天已完成，拍一道新题试试？'
                    : (
                      <>
                        预计 <span className={s.heroSubStrong}>25 分钟</span> · 下一次记忆节点 10:15
                      </>
                    )}
                </div>
              </div>
              {!isAllDone && (
                <RingProgress progress={progress} animating={ringAnimating} />
              )}
            </div>

            {/* Subject chips (not in ALL_DONE) */}
            {!isAllDone && (
              <div className={s.heroSubjects}>
                {MOCK_SUBJECTS.map((subj) => (
                  <span key={subj.name} className={s.subchip}>
                    <span className={s.subchipSq} style={{ background: subj.color }} />
                    {subj.name}
                    <span className={s.subchipCount}>{subj.count}</span>
                  </span>
                ))}
              </div>
            )}

            {/* CTA */}
            <div className={s.heroCta}>
              <button
                className={s.heroGoBtn}
                data-testid={TEST_IDS.pHome.startAllBtn}
                onClick={handleStartAll}
                aria-label={isAllDone ? '拍一道新题' : '开始复习'}
              >
                <svg viewBox="0 0 14 14" fill="none">
                  <path d="M4 2 L11 7 L4 12 Z" fill="#0E0E10" />
                </svg>
                {isAllDone ? '拍一道新题' : '开始复习'}
                {!isAllDone && <span className={s.heroGoMeta}>下一题 · 二次函数</span>}
              </button>
              {!isAllDone && (
                <div className={s.heroAddBtn}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8 H14 M8 2 V14" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* ══════ Bento: 本周 ══════ */}
          <div className={s.sec}>
            <div className={s.secTitle}>本周 <span className={s.secTitleEm}>This week</span></div>
            <span className={s.secMore}>查看全部 ›</span>
          </div>
          <div className={s.bento}>
            <div className={`${s.tile} ${s.mastery}`}>
              <div>
                <div className={s.masteryLabel}>掌握率</div>
                <div className={s.masteryBig}>68<sup className={s.masteryBigSup}>%</sup></div>
                <div className={s.masteryDelta}>
                  <svg viewBox="0 0 10 10" fill="none">
                    <path d="M5 2 V8 M2 5 L5 2 L8 5" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  +6 pts · 7d
                </div>
              </div>
              <div className={s.spark} data-testid={TEST_IDS.pHome.weeklySparkline}>
                <svg viewBox="0 0 300 44" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="homeSpk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#059669" stopOpacity=".28" />
                      <stop offset="100%" stopColor="#059669" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 32 L43 26 L86 28 L129 18 L172 12 L215 20 L258 8 L300 14 L300 44 L0 44 Z" fill="url(#homeSpk)" />
                  <path d="M0 32 L43 26 L86 28 L129 18 L172 12 L215 20 L258 8 L300 14" stroke="#059669" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="258" cy="8" r="3.6" fill="#059669" stroke="#fff" strokeWidth="1.6" />
                </svg>
                <div className={s.sparkAxis}>
                  <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span>
                  <span className={s.sparkAxisNow}>六</span><span>今</span>
                </div>
              </div>
            </div>
            <div className={s.stackCol}>
              <div className={`${s.mini} ${s.miniFlame}`}>
                <div className={s.miniIcon}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#F97316">
                    <path d="M12 2s4 4 4 8-2 6-2 6 3 1 3 4-3 4-5 4-5-1-5-4 3-4 3-4-2-2-2-6 4-8 4-8z" />
                  </svg>
                </div>
                <div>
                  <div className={`${s.miniNum} ${s.miniNumFlame}`}>12</div>
                  <div className={s.miniLabel}>Streak 天</div>
                </div>
              </div>
              <div className={`${s.mini} ${s.miniNewAdd}`}>
                <div className={s.miniIcon}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2 V14 M2 8 H14" stroke="#3730A3" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div className={`${s.miniNum} ${s.miniNumNewAdd}`}>+8</div>
                  <div className={s.miniLabel}>本周新增</div>
                </div>
              </div>
            </div>
          </div>

          {/* ══════ 7-day strip ══════ */}
          <div className={s.sec}>
            <div className={s.secTitle}>日程 <span className={s.secTitleEm}>Schedule</span></div>
            <span className={s.secMore}>月视图 ›</span>
          </div>
          <div className={s.weekcard} data-testid={TEST_IDS.pHome.weekStrip}>
            <div className={s.wcHead}>
              <div className={s.wcHeadTitle}>
                <svg viewBox="0 0 14 14" fill="none">
                  <rect x="2" y="3" width="10" height="9" rx="2" stroke="#0E0E10" strokeWidth="1.3" />
                  <path d="M2 6 H12" stroke="#0E0E10" strokeWidth="1.3" />
                  <path d="M5 1.5 V4 M9 1.5 V4" stroke="#0E0E10" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                4 月 20 – 26
              </div>
              <span className={s.wcExpand}>
                展开
                <svg viewBox="0 0 10 10" fill="none">
                  <path d="M3 2 L7 5 L3 8" stroke="#3730A3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
            <div className={s.wcRow}>
              {MOCK_WEEK_DAYS.map((day) => (
                <div key={day.w} className={`${s.wd}${day.today ? ` ${s.wdToday}` : ''}`}>
                  <span className={s.wdWeekday}>{day.w}</span>
                  <span className={s.wdDay}>{day.d}</span>
                  <span className={s.wdDots}>
                    {day.dots.map((c, i) => (
                      <i
                        key={i}
                        className={s.wdDot}
                        style={{ background: day.today ? DOT_COLORS_TODAY[c] : DOT_COLORS[c] }}
                      />
                    ))}
                  </span>
                  {day.num && <span className={s.wdNum}>{day.num}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* ══════ AI Insight ══════ */}
          <div className={s.sec}>
            <div className={s.secTitle}>AI 洞察 <span className={s.secTitleEm}>Signal</span></div>
            <span className={s.secMore} style={{ color: '#F97316' }}>1 条待练</span>
          </div>
          <div className={s.insight} data-testid={TEST_IDS.pHome.weakKp}>
            <div className={s.insightRow}>
              <div className={s.insightNum}>4<span style={{ fontSize: 18, color: 'rgba(255,255,255,.55)', marginLeft: 2 }}>×</span></div>
              <div>
                <div className={s.insightKicker}>薄弱点 · KP-382</div>
                <div className={s.insightTitle}>
                  <span className={s.insightTitleEm}>韦达定理</span>
                  <br />最近 4 次都错了
                </div>
              </div>
            </div>
            <div className={s.insightDesc}>
              错误模式在同一知识点上<span className={s.insightDescStrong}>加速积累</span>。建议一次 5 分钟针对性专练，系统会同步写入记忆曲线。
            </div>
            <div className={s.insightCta}>
              <button className={s.insightBtnPri}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M3 2 L9 6 L3 10 Z" fill="#7C2D12" />
                </svg>
                立即专练
              </button>
              <button className={s.insightBtnSec}>稍后再说</button>
            </div>
          </div>

          {/* ══════ Messages ══════ */}
          <div className={s.sec}>
            <div className={s.secTitle}>消息 <span className={s.secTitleEm}>Inbox</span></div>
            <span className={s.secMore} data-testid={TEST_IDS.pHome.messagesMoreLink}>全部 2 ›</span>
          </div>
          <div className={s.msgs} data-testid={TEST_IDS.pHome.messages}>
            <div className={s.msg}>
              <div className={`${s.msgIcon} ${s.msgIconInd}`}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1 C5 1 3 3 3 6 C3 9 5 9.5 5 11 H11 C11 9.5 13 9 13 6 C13 3 11 1 8 1 Z" stroke="#3730A3" strokeWidth="1.4" strokeLinejoin="round" />
                  <path d="M6 13 H10" stroke="#3730A3" strokeWidth="1.4" strokeLinecap="round" />
                  <path d="M7 15 H9" stroke="#3730A3" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
              <div className={s.msgTx}>
                <div className={s.msgTitle}>记忆曲线 <span className={s.msgTitleEm}>T3</span> · 二次函数</div>
                <div className={s.msgSub}>今晚 20:30 · 3 题即将到期</div>
              </div>
              <span className={s.msgDot} />
              <div className={s.msgTime}>10 min</div>
            </div>
            <div className={s.msg}>
              <div className={`${s.msgIcon} ${s.msgIconRos}`}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="3" width="12" height="11" rx="2" stroke="#E11D48" strokeWidth="1.4" />
                  <path d="M2 6 H14 M5 1 V4 M11 1 V4" stroke="#E11D48" strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="8" cy="10" r="1.6" fill="#E11D48" />
                </svg>
              </div>
              <div className={s.msgTx}>
                <div className={s.msgTitle}>妈妈分享了「<span className={s.msgTitleEm}>5 月月考安排</span>」</div>
                <div className={s.msgSub}>5 月 12 日 · 周一 · 已同步到日历</div>
              </div>
              <div className={s.msgTime}>昨天</div>
            </div>
          </div>

          {/* ══════ Quick entries ══════ */}
          <div className={s.sec}>
            <div className={s.secTitle}>快捷入口 <span className={s.secTitleEm}>Shortcuts</span></div>
          </div>
          <div className={s.quicks} data-testid={TEST_IDS.pHome.quickEntries}>
            <div className={s.qi}>
              <div className={`${s.qiIcon} ${s.qiIconRed}`}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 3 h9 l3 3 v9 a1.5 1.5 0 0 1 -1.5 1.5 H3 a1.5 1.5 0 0 1 -1.5 -1.5 V4.5 a1.5 1.5 0 0 1 1.5 -1.5z" stroke="#fff" strokeWidth="1.4" />
                  <path d="M5 9 h8 M5 12 h5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
              <div className={s.qiTitle}>错题本</div>
            </div>
            <div className={s.qi}>
              <div className={`${s.qiIcon} ${s.qiIconGrn}`}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="2" y="5" width="14" height="10" rx="2" stroke="#fff" strokeWidth="1.4" />
                  <circle cx="9" cy="10" r="3" stroke="#fff" strokeWidth="1.4" />
                  <path d="M6.5 5 L7.5 3 h3 L11.5 5" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </div>
              <div className={s.qiTitle}>拍新题</div>
            </div>
            <div className={s.qi}>
              <div className={`${s.qiIcon} ${s.qiIconBlu}`}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="2.5" y="3.5" width="13" height="12" rx="2" stroke="#fff" strokeWidth="1.4" />
                  <path d="M2.5 7 H15.5" stroke="#fff" strokeWidth="1.4" />
                  <path d="M6 1.5 V4.5 M12 1.5 V4.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
              <div className={s.qiTitle}>日历</div>
            </div>
            <div className={s.qi}>
              <div className={`${s.qiIcon} ${s.qiIconAmb}`}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 2 L11 4 L13.5 3.5 L14 6 L16 7 L15 9 L16 11 L14 12 L13.5 14.5 L11 14 L9 16 L7 14 L4.5 14.5 L4 12 L2 11 L3 9 L2 7 L4 6 L4.5 3.5 L7 4 Z" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
                  <circle cx="9" cy="9" r="2" stroke="#fff" strokeWidth="1.4" />
                </svg>
              </div>
              <div className={s.qiTitle}>偏好</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab bar ──────────────────────────────────────── */}
      <div className={s.tabbar}>
        <div className={`${s.tab} ${s.tabActive}`}>
          <span className={s.tabDotMark} />
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M3 11 L12 3 L21 11 V20 a1 1 0 0 1 -1 1 H14 V14 H10 V21 H4 a1 1 0 0 1 -1 -1 Z" stroke="#0E0E10" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <span>首页</span>
        </div>
        <div className={s.tab}>
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M5 4 h10 l4 4 v12 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V6 a2 2 0 0 1 2 -2 z" stroke="#8A8A94" strokeWidth="1.5" />
            <path d="M8 13 h8 M8 17 h5" stroke="#8A8A94" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>错题本</span>
        </div>
        <div className={`${s.tab}${isAllDone ? ` ${s.tabHighlight}` : ''}`}>
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="3" y="7" width="18" height="13" rx="3" stroke={isAllDone ? '#059669' : '#8A8A94'} strokeWidth="1.5" />
            <circle cx="12" cy="13.5" r="3.5" stroke={isAllDone ? '#059669' : '#8A8A94'} strokeWidth="1.5" />
            <path d="M9 7 L10 5 h4 L15 7" stroke={isAllDone ? '#059669' : '#8A8A94'} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <span>拍题</span>
        </div>
        <div className={s.tab}>
          {remaining > 0 && <div className={s.tabBadge}>{remaining}</div>}
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M4 12 a8 8 0 1 1 2.3 5.6" stroke="#8A8A94" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M4 18 V12 h6" stroke="#8A8A94" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 8 V12 L15 14" stroke="#8A8A94" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>复习</span>
        </div>
        <div className={s.tab}>
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="9" r="4" stroke="#8A8A94" strokeWidth="1.5" />
            <path d="M4 20 c1.5 -4 5 -6 8 -6 s6.5 2 8 6" stroke="#8A8A94" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>我的</span>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={s.toast} role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
};
