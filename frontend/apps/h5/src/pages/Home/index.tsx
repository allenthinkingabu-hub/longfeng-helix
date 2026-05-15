/**
 * P-HOME · 今日聚合首页 (Home · Today Aggregator)
 * 1:1 对齐 design/mockups/wrongbook/01_home_ios_refined.html
 *
 * 状态机: LOADING → READY | EMPTY | ERROR (per spec §6)
 *   LOADING → skeleton 骨架屏
 *   READY   → 大卡 + 各 section 渲染
 *   EMPTY   → total=0 "今天没有复习安排" hero
 *   ERROR   → 顶部黄条降级
 *
 * spec: design/system/pages/P-HOME.spec.md §5 GET /api/home/today
 * biz:  biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 步 12-13
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { homeClient, type HomeTodayResp } from '@longfeng/api-contracts';
import { TEST_IDS } from '@longfeng/testids';
import { track } from '@longfeng/telemetry';
import s from './Home.module.css';

// ─── Constants ────────────────────────────────────────────────────
const TZ = 'Asia/Shanghai';
const CIRCLE_R = 30;
const CIRCLE_C = 2 * Math.PI * CIRCLE_R; // ≈ 188.5
const COUNTER_ANIM_MS = 300;

// ─── Hardcoded MVP placeholders (Phase 1+ from GET /api/home/today) ──
const MVP = {
  studentName: '小 A',
  streak: 12,
  mastered: 142,
  estMin: 25,
  subjects: [
    { name: '数学', count: 3, color: 'var(--tkn-subject-math)' },
    { name: '物理', count: 2, color: 'var(--tkn-subject-physics)' },
    { name: '英语', count: 3, color: 'var(--tkn-subject-english)' },
  ],
  weekStats: { mastered: 23, newItems: 8, forgotten: 2, masteryRate: 68 },
};

// ─── Types ────────────────────────────────────────────────────────
type PageState = 'LOADING' | 'READY' | 'EMPTY' | 'ERROR';

// ─── Skeleton ─────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className={s.skeleton}>
      <div className={s.skeletonCard} />
      <div className={s.skeletonBar} style={{ width: '60%' }} />
      <div className={s.skeletonBar} style={{ width: '85%' }} />
      <div className={s.skeletonCard} style={{ height: 100 }} />
    </div>
  );
}

// ─── Counter animation helper ─────────────────────────────────────
function animateValue(
  from: number,
  to: number,
  durationMs: number,
  onUpdate: (v: number) => void,
  rafRef: React.MutableRefObject<number | null>,
) {
  const start = performance.now();
  const step = (now: number) => {
    const elapsed = now - start;
    const t = Math.min(elapsed / durationMs, 1);
    // easeInOut
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    onUpdate(Math.round(from + (to - from) * eased));
    if (t < 1) {
      rafRef.current = requestAnimationFrame(step);
    }
  };
  rafRef.current = requestAnimationFrame(step);
}

// ─── Main Component ──────────────────────────────────────────────
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>('LOADING');
  const [displayTotal, setDisplayTotal] = useState<number>(0);
  const [circleOffset, setCircleOffset] = useState<number>(CIRCLE_C);
  const prevTotalRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // ── GET /api/home/today ──────────────────────────────────────
  const { data, isLoading, isError } = useQuery<HomeTodayResp>({
    queryKey: ['home', 'today'],
    queryFn: () => homeClient.getToday(TZ),
    staleTime: 0,
    retry: 1,
  });

  // ── Determine page state ─────────────────────────────────────
  useEffect(() => {
    if (isLoading && !data) {
      setPageState('LOADING');
    } else if (isError && !data) {
      setPageState('ERROR');
    } else if (data && data.today.total === 0) {
      setPageState('EMPTY');
    } else if (data) {
      setPageState('READY');
    }
  }, [isLoading, isError, data]);

  // ── Counter + circle animation ───────────────────────────────
  useEffect(() => {
    if (!data) return;

    const newTotal = data.today.total;
    const storedPrev = sessionStorage.getItem('home_prev_total');
    const prevTotal = storedPrev !== null ? parseInt(storedPrev, 10) : null;

    // Cancel any running animation
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (prevTotal !== null && prevTotal !== newTotal) {
      // Animate counter from previous to new (AC3: ≥ 300ms)
      animateValue(prevTotal, newTotal, COUNTER_ANIM_MS, setDisplayTotal, rafRef);
    } else {
      setDisplayTotal(newTotal);
    }

    // Store current total for next visit
    sessionStorage.setItem('home_prev_total', String(newTotal));
    prevTotalRef.current = newTotal;

    // Circle progress animation via CSS transition (AC4: 300ms easeInOut)
    // Small delay to trigger CSS transition from initial state
    requestAnimationFrame(() => {
      setCircleOffset(CIRCLE_C * (1 - data.today.circleProgress));
    });

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [data]);

  // ── Telemetry ────────────────────────────────────────────────
  useEffect(() => {
    if (pageState === 'READY' || pageState === 'EMPTY') {
      track('home_view', {
        tz: TZ,
        total: data?.today.total ?? 0,
        done: data?.today.done ?? 0,
        resume: false,
      });
    }
  }, [pageState, data]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleStartAll = useCallback(() => {
    track('home_today_start_all', { count: data?.today.total ?? 0 });
    navigate('/review-today');
  }, [navigate, data]);

  const handleTabNav = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  // ── Derived ──────────────────────────────────────────────────
  const pctText = data ? `${Math.round(data.today.circleProgress * 100)}%` : '0%';

  // ────────────────────────────────────────────────────────────────
  return (
    <div className={s.root} data-testid={TEST_IDS.pHome.root} data-mood="A">
      {/* ── Hero aurora gradient ────────────────────────────── */}
      <div className={s.hero} />

      {/* ── Greeting ────────────────────────────────────────── */}
      <div className={s.greeting} data-testid={TEST_IDS.pHome.greetingHero}>
        <div className={s.greetingRow}>
          <div>
            <div className={s.hello}>周二 · 4 月 22 日 · 早安</div>
            <div className={s.nameText}>
              {MVP.studentName}，<span className={s.nameEm}>今天继续</span>
            </div>
          </div>
          <div className={s.avatar}>A</div>
        </div>
        <div className={s.streakBar}>
          <span className={s.flame} data-testid={TEST_IDS.pHome.streakFireIcon}>
            <svg viewBox="0 0 24 24" fill="#FFD166">
              <path d="M12 2s4 4 4 8-2 6-2 6 3 1 3 4-3 4-5 4-5-1-5-4 3-4 3-4-2-2-2-6 4-8 4-8z" />
            </svg>
            <span data-testid={TEST_IDS.pHome.streakDaysNumber}>连续 {MVP.streak} 天</span>
          </span>
          <span className={s.dot} />
          <span>
            掌握 <strong style={{ color: '#6DE895', fontWeight: 800 }}>{MVP.mastered}</strong> 题
          </span>
          <span className={s.dot} />
          <span style={{ color: 'rgba(255,255,255,.62)' }}>9:41</span>
        </div>
      </div>

      {/* ── Scroll area ─────────────────────────────────────── */}
      <div className={s.scroll}>
        {/* ── LOADING skeleton ─────────────────────────────── */}
        {pageState === 'LOADING' && <Skeleton />}

        {/* ── ERROR banner ─────────────────────────────────── */}
        {pageState === 'ERROR' && (
          <div className={s.errorBanner}>部分数据正在同步</div>
        )}

        {/* ── EMPTY hero ───────────────────────────────────── */}
        {pageState === 'EMPTY' && (
          <div className={s.reviewCard}>
            <div className={s.emptyHero}>
              <div className={s.emptyHeroTitle}>今天没有复习安排</div>
              拍一道新题试试？
            </div>
          </div>
        )}

        {/* ── READY: Review hero card ──────────────────────── */}
        {pageState === 'READY' && data && (
          <>
            <div className={s.reviewCard} data-testid={TEST_IDS.pHome.todayReviewCard}>
              <div className={s.rhTop}>
                <div>
                  <div className={s.rhKicker}>Today&apos;s review</div>
                  <div className={s.rhTitle}>
                    <span className={s.rhTitleEm} data-testid={TEST_IDS.pHome.totalLabel}>
                      {displayTotal} 题
                    </span>{' '}
                    待复习
                  </div>
                  <div className={s.rhSub}>
                    预计 <strong data-testid={TEST_IDS.pHome.estMin}>{MVP.estMin}</strong> 分钟 · 下一节点 10:15
                  </div>
                </div>
                <div className={s.rhCircle} data-testid={TEST_IDS.pHome.circleProgress}>
                  <svg viewBox="0 0 72 72" width="72" height="72">
                    <circle
                      cx="36" cy="36" r={CIRCLE_R}
                      fill="none"
                      stroke="rgba(255,255,255,.15)"
                      strokeWidth="6"
                    />
                    <circle
                      cx="36" cy="36" r={CIRCLE_R}
                      fill="none"
                      stroke="url(#rhg)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={CIRCLE_C}
                      strokeDashoffset={circleOffset}
                      className={s.rhCircleTrack}
                    />
                    <defs>
                      <linearGradient id="rhg" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#FFD166" />
                        <stop offset="100%" stopColor="#FF9500" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className={s.rhPct}>
                    <div className={s.rhPctN}>{pctText}</div>
                    <div className={s.rhPctL}>DONE</div>
                  </div>
                </div>
              </div>

              {/* Subject chips */}
              <div className={s.rhSplit}>
                {MVP.subjects.map((subj) => (
                  <div key={subj.name} className={s.rhSubChip}>
                    <span className={s.rhSubChipSq} style={{ background: subj.color }} />
                    <span className={s.rhSubChipCt}>
                      <span className={s.rhSubChipCtEm}>{subj.count}</span>
                      {subj.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className={s.rhCta}>
                <button
                  className={s.rhBtn}
                  data-testid={TEST_IDS.pHome.startAllBtn}
                  onClick={handleStartAll}
                >
                  <svg viewBox="0 0 14 14" fill="none">
                    <path d="M4 2 L11 7 L4 12 Z" fill="#0d1b45" />
                  </svg>
                  全部开始
                </button>
                <button className={s.rhBtn2} aria-label="添加题目">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8H14M8 2V14" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ── Weekly summary ────────────────────────────── */}
            <div className={s.sec}>
              <div className={s.secT}>本周回顾</div>
              <span className={s.secM}>查看全部 ›</span>
            </div>
            <div className={s.weekly} data-testid={TEST_IDS.pHome.weeklySparkline}>
              <div className={s.weeklyRow}>
                <div className={s.stat}>
                  <div className={`${s.statN} ${s.statGreen}`}>{MVP.weekStats.mastered}</div>
                  <div className={s.statL}>掌握</div>
                </div>
                <div className={s.statSep} />
                <div className={s.stat}>
                  <div className={`${s.statN} ${s.statBlue}`}>{MVP.weekStats.newItems}</div>
                  <div className={s.statL}>新增</div>
                </div>
                <div className={s.statSep} />
                <div className={s.stat}>
                  <div className={`${s.statN} ${s.statOrange}`}>{MVP.weekStats.forgotten}</div>
                  <div className={s.statL}>遗忘</div>
                </div>
                <div className={s.statSep} />
                <div className={s.stat}>
                  <div className={`${s.statN} ${s.statIndigo}`}>{MVP.weekStats.masteryRate}%</div>
                  <div className={s.statL}>掌握率</div>
                </div>
              </div>
              <div className={s.spark}>
                <svg viewBox="0 0 300 40" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34C759" stopOpacity=".30" />
                      <stop offset="100%" stopColor="#34C759" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 28 L43 22 L86 24 L129 16 L172 12 L215 18 L258 8 L300 14 L300 40 L0 40 Z" fill="url(#sg)" />
                  <path d="M0 28 L43 22 L86 24 L129 16 L172 12 L215 18 L258 8 L300 14" stroke="#34C759" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="258" cy="8" r="3.5" fill="#34C759" stroke="#fff" strokeWidth="1.5" />
                </svg>
              </div>
              <div className={s.sparkDays}>
                <span>周一</span><span>周二</span><span>周三</span><span>周四</span><span>周五</span><span>周六</span>
                <span className={s.sparkToday}>今天</span>
              </div>
            </div>

            {/* ── Week schedule ─────────────────────────────── */}
            <div className={s.sec}>
              <div className={s.secT}>本周日程</div>
              <span className={s.secM}>月视图 ›</span>
            </div>
            <div className={s.weekcard} data-testid={TEST_IDS.pHome.weekStrip}>
              <div className={s.wcHead}>
                <div className={s.wcHeadL}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="2" y="3" width="10" height="9" rx="2" stroke="#1C1C1E" strokeWidth="1.3" />
                    <path d="M2 6H12" stroke="#1C1C1E" strokeWidth="1.3" />
                    <path d="M5 1.5V4M9 1.5V4" stroke="#1C1C1E" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  4 月 20–26 日
                </div>
                <button className={s.wcHeadExpand}>
                  展开
                  <svg viewBox="0 0 10 10" fill="none">
                    <path d="M3 2L7 5L3 8" stroke="#007AFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <div className={s.wcrow}>
                {[
                  { w: '一', d: '20', dots: ['math', 'phy'], today: false },
                  { w: '二', d: '22', dots: ['math', 'phy', 'eng', 'math', 'evt'], today: true, num: 8 },
                  { w: '三', d: '22', dots: ['chem', 'sys'], today: false },
                  { w: '四', d: '23', dots: ['math', 'chem', 'eng'], today: false },
                  { w: '五', d: '24', dots: ['phy', 'sys'], today: false },
                  { w: '六', d: '25', dots: ['eng'], today: false },
                  { w: '日', d: '26', dots: ['chem', 'sys', 'math'], today: false },
                ].map((day, i) => {
                  const dotColors: Record<string, string> = {
                    math: 'var(--tkn-subject-math)',
                    phy: 'var(--tkn-subject-physics)',
                    chem: 'var(--tkn-subject-chemistry)',
                    eng: 'var(--tkn-subject-english)',
                    evt: 'var(--ios-pink)',
                    sys: 'var(--ios-teal)',
                  };
                  return (
                    <div key={i} className={`${s.wd}${day.today ? ` ${s.wdToday}` : ''}`}>
                      <span className={s.wdW}>{day.w}</span>
                      <span className={s.wdD}>{day.d}</span>
                      <span className={s.wdDots}>
                        {day.dots.map((dt, j) => (
                          <i key={j} className={s.wdDot} style={{ background: dotColors[dt] }} />
                        ))}
                      </span>
                      {day.num && <span className={s.wdNum}>{day.num}</span>}
                    </div>
                  );
                })}
              </div>
              <div className={s.wcFoot}>
                <div className={s.wcLegend}>
                  <span><i className={s.wcLegendDot} style={{ background: 'var(--tkn-subject-math)' }} />数学</span>
                  <span><i className={s.wcLegendDot} style={{ background: 'var(--tkn-subject-physics)' }} />物理</span>
                  <span><i className={s.wcLegendDot} style={{ background: 'var(--tkn-subject-chemistry)' }} />化学</span>
                  <span><i className={s.wcLegendDot} style={{ background: 'var(--tkn-subject-english)' }} />英语</span>
                  <span><i className={s.wcLegendDot} style={{ background: 'var(--ios-pink)' }} />考试</span>
                </div>
              </div>
            </div>

            {/* ── Messages ──────────────────────────────────── */}
            <div className={s.sec}>
              <div className={s.secT}>最近消息</div>
              <span className={s.secM} data-testid={TEST_IDS.pHome.messagesMoreLink}>全部 2 ›</span>
            </div>
            <div className={s.msgs} data-testid={TEST_IDS.pHome.messages}>
              <div className={s.msg}>
                <div className={`${s.msgIc} ${s.msgIcInd}`}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1C5 1 3 3 3 6c0 3 2 3.5 2 5h6c0-1.5 2-2 2-5 0-3-2-5-5-5z" stroke="#5856D6" strokeWidth="1.4" strokeLinejoin="round" />
                    <path d="M6 13h4" stroke="#5856D6" strokeWidth="1.4" strokeLinecap="round" />
                    <path d="M7 15h2" stroke="#5856D6" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </div>
                <div className={s.msgTx}>
                  <div className={s.msgT}>记忆曲线 T3 · 二次函数</div>
                  <div className={s.msgS}>今晚 20:30 · 3 题即将到期</div>
                </div>
                <div className={s.msgTm}>10 min</div>
              </div>
              <div className={s.msg}>
                <div className={`${s.msgIc} ${s.msgIcPnk}`}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="3" width="12" height="11" rx="2" stroke="#FF2D55" strokeWidth="1.4" />
                    <path d="M2 6H14M5 1V4M11 1V4" stroke="#FF2D55" strokeWidth="1.4" strokeLinecap="round" />
                    <circle cx="8" cy="10" r="1.6" fill="#FF2D55" />
                  </svg>
                </div>
                <div className={s.msgTx}>
                  <div className={s.msgT}>妈妈分享了「5 月月考安排」</div>
                  <div className={s.msgS}>5 月 12 日 · 周一 · 已同步到日历</div>
                </div>
                <div className={s.msgTm}>昨天</div>
              </div>
              <div className={s.msg}>
                <div className={`${s.msgIc} ${s.msgIcTea}`}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="#30B0C7" strokeWidth="1.4" />
                    <path d="M8 4v4l3 2" stroke="#30B0C7" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </div>
                <div className={s.msgTx}>
                  <div className={s.msgT}>本周免打扰时段已更新</div>
                  <div className={s.msgS}>23:00 – 07:30 · 记忆曲线节奏不变</div>
                </div>
                <div className={s.msgTm}>周日</div>
              </div>
            </div>

            {/* ── AI Weak KP ────────────────────────────────── */}
            <div className={s.sec}>
              <div className={s.secT}>AI 发现的薄弱点</div>
              <span className={s.secM} style={{ color: 'var(--ios-orange)' }}>1 条待练</span>
            </div>
            <div className={s.kpcard} data-testid={TEST_IDS.pHome.weakKp}>
              <div className={s.kpHead}>
                <div className={s.kpHeadIc}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1L13 13H1Z" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
                    <path d="M7 5V9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                    <circle cx="7" cy="11" r=".8" fill="#fff" />
                  </svg>
                </div>
                <div className={s.kpHeadTtl}>
                  「<span className={s.kpHeadTtlEm}>韦达定理</span>」最近 4 次都错了
                </div>
              </div>
              <div className={s.kpBody}>
                AI 检测到你在同一知识点上的错误在<span className={s.kpBodyStrong}>加速积累</span>。
                建议开启一次针对性专练（约 5 分钟），系统会同步写入你的记忆曲线。
              </div>
              <div className={s.kpActions}>
                <button className={`${s.kpBtn} ${s.kpBtnPr}`}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 2L9 6L3 10Z" fill="#fff" />
                  </svg>
                  立即专练
                </button>
                <button className={`${s.kpBtn} ${s.kpBtnSc}`}>稍后再说</button>
              </div>
            </div>

            {/* ── Quick entries ─────────────────────────────── */}
            <div className={s.quick} data-testid={TEST_IDS.pHome.quickEntries}>
              <button className={s.qcard} onClick={() => handleTabNav('/wrongbook')}>
                <div className={`${s.qcardIc} ${s.qcardIcRed}`}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M3 3h9l3 3v9a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 15V4.5A1.5 1.5 0 0 1 3 3z" stroke="#fff" strokeWidth="1.4" />
                    <path d="M5 9h8M5 12h5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </div>
                <div className={s.qcardTx}>
                  <div className={s.qcardT}>错题本</div>
                  <div className={s.qcardS}>128 题 · 未掌握 42</div>
                </div>
                <div className={s.qcardArr}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M3 2L7 5L3 8" stroke="#8E8E93" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>
              <button className={s.qcard} onClick={() => handleTabNav('/capture')}>
                <div className={`${s.qcardIc} ${s.qcardIcGrn}`}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="2" y="5" width="14" height="10" rx="2" stroke="#fff" strokeWidth="1.4" />
                    <circle cx="9" cy="10" r="3" stroke="#fff" strokeWidth="1.4" />
                    <path d="M6.5 5L7.5 3h3l1 2" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className={s.qcardTx}>
                  <div className={s.qcardT}>拍一道新错题</div>
                  <div className={s.qcardS}>自动识别 · 多学科</div>
                </div>
                <div className={s.qcardArr}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M3 2L7 5L3 8" stroke="#8E8E93" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>
              <button className={s.qcard}>
                <div className={`${s.qcardIc} ${s.qcardIcBlu}`}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="2.5" y="3.5" width="13" height="12" rx="2" stroke="#fff" strokeWidth="1.4" />
                    <path d="M2.5 7H15.5" stroke="#fff" strokeWidth="1.4" />
                    <path d="M6 1.5V4.5M12 1.5V4.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </div>
                <div className={s.qcardTx}>
                  <div className={s.qcardT}>完整日历</div>
                  <div className={s.qcardS}>月 / 周 / 日视图</div>
                </div>
                <div className={s.qcardArr}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M3 2L7 5L3 8" stroke="#8E8E93" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>
              <button className={s.qcard}>
                <div className={`${s.qcardIc} ${s.qcardIcPur}`}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 2L11 4L13.5 3.5L14 6L16 7L15 9L16 11L14 12L13.5 14.5L11 14L9 16L7 14L4.5 14.5L4 12L2 11L3 9L2 7L4 6L4.5 3.5L7 4Z" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
                    <circle cx="9" cy="9" r="2" stroke="#fff" strokeWidth="1.4" />
                  </svg>
                </div>
                <div className={s.qcardTx}>
                  <div className={s.qcardT}>偏好与提醒</div>
                  <div className={s.qcardS}>免打扰 · 节奏 · 语言</div>
                </div>
                <div className={s.qcardArr}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M3 2L7 5L3 8" stroke="#8E8E93" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── TabBar ──────────────────────────────────────────── */}
      <div className={s.tabbar} data-testid={TEST_IDS.tabShell.tabbar}>
        <button className={`${s.tab} ${s.tabActive}`} data-testid={TEST_IDS.tabShell.tabs.home}>
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M3 11L12 3l9 8v9a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1Z" stroke="#007AFF" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <span>首页</span>
        </button>
        <button className={s.tab} data-testid={TEST_IDS.tabShell.tabs.wrongbook} onClick={() => handleTabNav('/wrongbook')}>
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M5 4h10l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="#8E8E93" strokeWidth="1.5" />
            <path d="M8 13h8M8 17h5" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>错题本</span>
        </button>
        <button className={s.tab} data-testid={TEST_IDS.tabShell.tabs.capture} onClick={() => handleTabNav('/capture')}>
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="3" y="7" width="18" height="13" rx="3" stroke="#8E8E93" strokeWidth="1.5" />
            <circle cx="12" cy="13.5" r="3.5" stroke="#8E8E93" strokeWidth="1.5" />
            <path d="M9 7l1-2h4l1 2" stroke="#8E8E93" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <span>拍题</span>
        </button>
        <button className={s.tab} data-testid={TEST_IDS.tabShell.tabs.review}>
          {data && data.today.total > 0 && (
            <span className={s.tabBadge} data-testid={TEST_IDS.tabShell.badges.review}>{displayTotal}</span>
          )}
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M4 12a8 8 0 1 1 2.3 5.6" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M4 18V12h6" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 8v4l3 2" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>复习</span>
        </button>
        <button className={s.tab} data-testid={TEST_IDS.tabShell.tabs.me}>
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="9" r="4" stroke="#8E8E93" strokeWidth="1.5" />
            <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>我的</span>
        </button>
      </div>
    </div>
  );
};
