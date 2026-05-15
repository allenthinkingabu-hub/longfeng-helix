/**
 * P07 · 今日待复习 (ReviewToday)
 * 1:1 mirror of design/mockups/wrongbook/07_review_today.html
 *
 * T10 scope: P07 列表渲染 + tap item → POST /nodes/{nid}/open → P08 跳转
 *   AC1: Tap 列表第一题「开始」按钮 · 按钮 loading + 触觉 medium
 *   AC2: POST /api/review/nodes/{nid}/open → 200 + EVENT_OPENED outbox
 *   AC3: P07 → P08 跳转 ≤ 400ms
 *
 * 依赖: T09 (session-start-all) 并发 · P07 自建 stub fallback
 * 数据源: mock data (dev 兜底 · 后端未启动时)
 */
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reviewClient } from '@longfeng/api-contracts';
import { TEST_IDS, p07Ids } from '@longfeng/testids';
import { track } from '@longfeng/telemetry';
import s from './ReviewToday.module.css';

// ─── Mock data (dev 兜底 · 1:1 aligned with mockup 07_review_today.html) ───
const MOCK_TODAY = {
  date: '2026-04-21',
  tzLabel: '2026-04-21 · 星期二 · GMT+8',
  totalCount: 8,
  estMinutes: 25,
  doneCount: 3,
  inProgressCount: 1,
  waitCount: 4,
  progressPct: 38,
  masteryPct: 72,
  slots: [
    {
      slotKey: 'now' as const,
      slotTitle: '现在 · 上午',
      items: [
        {
          nid: '1',
          tLevel: 'T1',
          hhmm: '09:45',
          subject: '数学',
          subjectColor: 'red' as const,
          kp: '二次函数 · 顶点式',
          stem: '已知 f(x)=x²−4x+3，求顶点坐标与对称轴。错因：h k 混淆。',
          tags: ['顶点式', '配方法'],
          difficulty: '★★★',
          countdownState: 'now' as const,
          countdownText: '4 分钟',
        },
        {
          nid: '2',
          tLevel: 'T3',
          hhmm: '11:00',
          subject: '物理',
          subjectColor: 'orange' as const,
          kp: '欧姆定律 · 并联',
          stem: 'R₁=4Ω, R₂=6Ω 并联接 12V，求总电流。公式错误。',
          tags: ['并联电路'],
          difficulty: '★★',
          countdownState: 'soon' as const,
          countdownText: '1 h',
        },
      ],
    },
    {
      slotKey: 'afternoon' as const,
      slotTitle: '下午',
      items: [
        {
          nid: '3',
          tLevel: 'T4',
          hhmm: '14:30',
          subject: '化学',
          subjectColor: 'indigo' as const,
          kp: '方程配平',
          stem: 'Al + HCl → AlCl₃ + H₂，系数 2:6:2:3。',
          tags: ['化学方程'],
          difficulty: '★★★',
          countdownState: 'wait' as const,
          countdownText: '5 h',
        },
        {
          nid: '4',
          tLevel: 'T2',
          hhmm: '16:00',
          subject: '英语',
          subjectColor: 'green' as const,
          kp: 'past perfect',
          stem: 'By the time he arrived, the meeting ___ already started.',
          tags: ['时态一致'],
          difficulty: '★★',
          countdownState: 'wait' as const,
          countdownText: '6 h 15 m',
        },
      ],
    },
  ],
};

// ─── Subject color mapping ───
const SIDE_CLS: Record<string, string> = {
  red: s.itemSideRed,
  orange: s.itemSideOrange,
  blue: s.itemSideBlue,
  indigo: s.itemSideIndigo,
  green: s.itemSideGreen,
};

const SUB_CLS: Record<string, string> = {
  red: s.itemSub,
  orange: s.itemSubO,
  indigo: s.itemSubI,
  green: s.itemSubG,
};

const CD_CLS: Record<string, string> = {
  now: s.cdNow,
  soon: s.cdSoon,
  wait: s.cdWait,
};

// ─── Main Component ───
export const ReviewTodayPage: React.FC = () => {
  const nav = useNavigate();
  const [loadingNid, setLoadingNid] = useState<string | null>(null);

  const data = MOCK_TODAY;

  // AC1+AC2+AC3: Tap item → loading → POST /open → navigate P08
  const handleItemTap = useCallback(async (nid: string) => {
    if (loadingNid) return;
    setLoadingNid(nid);

    // AC1: 触觉 medium
    try { if ('vibrate' in navigator) navigator.vibrate(15); } catch { /* noop */ }

    // 埋点
    track('wb_today_start_one', { nid });

    try {
      // AC2: POST /api/review/nodes/{nid}/open → 200
      await reviewClient.openNode(nid);
    } catch {
      // spec P08 §5 #1: 502 仍允许进 READING (前端乐观更新)
    }

    // AC3: P07 → P08 跳转
    nav(`/review/exec/${nid}`);
    setLoadingNid(null);
  }, [loadingNid, nav]);

  // CTA: 全部开始
  const handleStartAll = useCallback(async () => {
    if (loadingNid) return;
    const firstNid = data.slots[0]?.items[0]?.nid;
    if (!firstNid) return;

    setLoadingNid('all');
    track('wb_today_start_all', { count: data.totalCount, estMin: data.estMinutes });

    try {
      await reviewClient.openNode(firstNid);
    } catch { /* 乐观 */ }

    nav(`/review/exec/${firstNid}`);
    setLoadingNid(null);
  }, [loadingNid, nav, data]);

  return (
    <div className={s.root} data-testid={TEST_IDS.p07.root}>

      {/* ── Nav ─────────────────────────── */}
      <nav className={s.nav}>
        <div className={s.navRow}>
          <button className={s.back} onClick={() => nav('/')} aria-label="返回首页">
            <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
              <path d="M10 2 2 10l8 8" stroke="#007AFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            首页
          </button>
          <span className={s.navRight}>排序 · 时间</span>
        </div>
        <h1 className={s.navTitle}>今日复习</h1>
      </nav>

      {/* ── Content ─────────────────────── */}
      <div className={s.content}>

        {/* ── Hero card ─────────────────── */}
        <div className={s.hero} data-testid={TEST_IDS.p07.todayReviewCard}>
          <div className={`${s.bubble} ${s.bubbleB1}`} data-testid={TEST_IDS.p07.heroParticles} />
          <div className={`${s.bubble} ${s.bubbleB2}`} />
          <div className={s.heroTag}>
            <span className={s.live} />
            {data.tzLabel}
          </div>
          <h2 className={s.heroH2} data-testid={TEST_IDS.p07.heroTotal}>
            {data.totalCount} 题待复习
            <span className={s.heroH2Sub} data-testid={TEST_IDS.p07.heroEstMin}>
              预计 {data.estMinutes} 分钟
            </span>
          </h2>
          <div className={s.statsRow}>
            <div className={s.stat} data-testid={TEST_IDS.p07.heroDone}>
              <div className={s.statV}>{data.doneCount}</div>
              <div className={s.statL}>已完成</div>
            </div>
            <div className={s.stat}>
              <div className={s.statV}>{data.inProgressCount}</div>
              <div className={s.statL}>进行中</div>
            </div>
            <div className={s.stat}>
              <div className={s.statV}>{data.waitCount}</div>
              <div className={s.statL}>未开始</div>
            </div>
          </div>
          <div className={s.pg}>
            <div
              className={s.pgBar}
              style={{ width: `${data.progressPct}%` }}
              data-testid={TEST_IDS.p07.heroProgressBar}
            />
          </div>
          <div className={s.pgTxt}>
            <span data-testid={TEST_IDS.p07.heroProgressPct}>进度 {data.progressPct}%</span>
            <span data-testid={TEST_IDS.p07.heroMasteryPct}>掌握度 {data.masteryPct}%</span>
          </div>
        </div>

        {/* ── Slots ─────────────────────── */}
        {data.slots.map((slot) => (
          <React.Fragment key={slot.slotKey}>
            {/* Slot header */}
            <div className={s.slot} data-testid={p07Ids.slotHeader(slot.slotKey)}>
              <div className={slot.slotKey === 'now' ? s.slotIconYellow : s.slotIconBlue}>
                {slot.slotKey === 'now' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/>
                    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>
                    </g>
                  </svg>
                )}
              </div>
              <h3 className={s.slotTitle} data-testid={p07Ids.slotTitle(slot.slotKey)}>
                {slot.slotTitle}
              </h3>
              <div className={s.slotLine} />
              <span className={s.slotCount}>{slot.items.length} 题</span>
            </div>

            {/* Item cards */}
            {slot.items.map((item, idx) => (
              <div
                key={item.nid}
                className={s.item}
                data-testid={p07Ids.slotItem(slot.slotKey, idx)}
                onClick={() => handleItemTap(item.nid)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') handleItemTap(item.nid); }}
              >
                {/* Loading overlay */}
                {loadingNid === item.nid && (
                  <div className={s.itemLoading}>
                    <div className={s.spinner} />
                  </div>
                )}

                <div className={SIDE_CLS[item.subjectColor] ?? s.itemSideBlue} />
                <div className={s.itemTc}>
                  <div className={s.itemHh} data-testid={p07Ids.slotItemTime(slot.slotKey, idx)}>
                    {item.hhmm}
                  </div>
                  <div className={s.itemLv} data-testid={p07Ids.slotItemTLevel(slot.slotKey, idx)}>
                    {item.tLevel}
                  </div>
                </div>
                <div className={s.itemBody}>
                  <div className={s.itemH}>
                    <span className={SUB_CLS[item.subjectColor] ?? s.itemSub}>{item.subject}</span>
                    {' · '}{item.kp}
                  </div>
                  <div className={s.itemStem}>{item.stem}</div>
                  <div className={s.itemTags}>
                    {item.tags.map((t) => (
                      <span key={t} className={s.tag}>{t}</span>
                    ))}
                    <span className={s.tagM}>{item.difficulty}</span>
                  </div>
                </div>
                <div className={s.itemRight}>
                  <span
                    className={CD_CLS[item.countdownState] ?? s.cdWait}
                    data-testid={p07Ids.slotItemCountdown(slot.slotKey, idx)}
                  >
                    {item.countdownText}
                  </span>
                  <div className={s.arrow}>
                    <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
                      <path d="M1 1l6 5.5L1 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* ── Bottom CTA ──────────────────── */}
      <button
        className={s.cta}
        data-testid={TEST_IDS.p07.bottomCta}
        onClick={handleStartAll}
        disabled={loadingNid === 'all'}
      >
        <span data-testid={TEST_IDS.p07.bottomCtaStartAllBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: 'middle', marginRight: 6 }}>
            <path d="M8 5v14l11-7L8 5Z" fill="#fff"/>
          </svg>
          全部开始
        </span>
        <span className={s.ctaBadge}>{data.totalCount} 题 · {data.estMinutes} min</span>
      </button>
    </div>
  );
};
