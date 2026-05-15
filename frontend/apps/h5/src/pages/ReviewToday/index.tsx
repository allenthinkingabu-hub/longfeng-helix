/**
 * P07 · 今日待复习 (ReviewToday)
 * 1:1 mirror of design/mockups/wrongbook/07_review_today.html
 *
 * 状态机: LOADING → today.LIST | today.EMPTY | today.ALL_DONE
 *
 * T09 scope: P-HOME → P07 跳转 + P07 完整渲染
 *   AC4: P07 完整渲染: Hero 渐变卡 + 3 统计卡 + 进度条 + 时段分组 + 底部 CTA
 *   AC5: node_ids 数量 = today.total · 全部为 ACTIVE 态
 *
 * trace: biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 步 14-15
 *        + design/system/pages/P07-review-today.spec.md §5/§6/§9
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { reviewClient } from '@longfeng/api-contracts';
import type { TodayReviewItem } from '@longfeng/api-contracts';
import { TEST_IDS, p07Ids } from '@longfeng/testids';
import { track } from '@longfeng/telemetry';
import s from './ReviewToday.module.css';

// ─── Types ──────────────────────────────────────────────────────
type PageState = 'LOADING' | 'today.LIST' | 'today.EMPTY' | 'today.ALL_DONE';

interface SlotData {
  key: string;
  title: string;
  iconClass: string;
  items: ItemData[];
}

interface ItemData {
  nid: string;
  tLevel: string;
  hhmm: string;
  subject: string;
  kp: string;
  stem: string;
  tags: string[];
  countdownState: 'now' | 'soon' | 'wait';
  countdownLabel: string;
  sideColor: string;
  status: string;
}

// ─── Mock data (frontend dev fallback · matches mockup exactly) ──
const MOCK_ITEMS: ItemData[] = [
  {
    nid: '1001', tLevel: 'T1', hhmm: '09:45', subject: '数学', kp: '二次函数 · 顶点式',
    stem: '已知 f(x)=x²−4x+3，求顶点坐标与对称轴。错因：h k 混淆。',
    tags: ['顶点式', '配方法', '★★★'], countdownState: 'now', countdownLabel: '4 分钟',
    sideColor: 'red', status: 'ACTIVE',
  },
  {
    nid: '1002', tLevel: 'T3', hhmm: '11:00', subject: '物理', kp: '欧姆定律 · 并联',
    stem: 'R₁=4Ω, R₂=6Ω 并联接 12V，求总电流。公式错误。',
    tags: ['并联电路', '★★'], countdownState: 'soon', countdownLabel: '1 h',
    sideColor: 'orange', status: 'ACTIVE',
  },
  {
    nid: '1003', tLevel: 'T4', hhmm: '14:30', subject: '化学', kp: '方程配平',
    stem: 'Al + HCl → AlCl₃ + H₂，系数 2:6:2:3。',
    tags: ['化学方程', '★★★'], countdownState: 'wait', countdownLabel: '5 h',
    sideColor: 'indigo', status: 'ACTIVE',
  },
  {
    nid: '1004', tLevel: 'T2', hhmm: '16:00', subject: '英语', kp: 'past perfect',
    stem: 'By the time he arrived, the meeting ___ already started.',
    tags: ['时态一致', '★★'], countdownState: 'wait', countdownLabel: '6 h 15 m',
    sideColor: 'green', status: 'ACTIVE',
  },
];

const MOCK_SLOTS: SlotData[] = [
  { key: 'now', title: '现在 · 上午', iconClass: 'slotIconYellow', items: MOCK_ITEMS.slice(0, 2) },
  { key: 'afternoon', title: '下午', iconClass: 'slotIconBlue', items: MOCK_ITEMS.slice(2, 4) },
];

// ─── Helpers ────────────────────────────────────────────────────
const SUBJECT_COLOR_MAP: Record<string, string> = {
  '数学': 'red', 'MATH': 'red',
  '物理': 'orange', 'PHY': 'orange',
  '化学': 'indigo', 'CHEM': 'indigo',
  '英语': 'green', 'EN': 'green',
};

const SUBJECT_SUB_CLASS: Record<string, string> = {
  'red': s.sub, 'orange': s.subO, 'indigo': s.subI, 'green': s.subG,
};

function buildSlotsFromItems(items: TodayReviewItem[]): SlotData[] {
  const now = new Date();
  const nowSlot: ItemData[] = [];
  const afternoonSlot: ItemData[] = [];
  const eveningSlot: ItemData[] = [];

  for (const item of items) {
    const dueDate = new Date(item.nextDueAt);
    const hh = dueDate.getHours();
    const mm = dueDate.getMinutes();
    const hhmm = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    const diffMs = dueDate.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60000);

    let countdownState: 'now' | 'soon' | 'wait';
    let countdownLabel: string;
    if (diffMin <= 15) {
      countdownState = 'now';
      countdownLabel = `${Math.max(0, diffMin)} 分钟`;
    } else if (diffMin <= 120) {
      countdownState = 'soon';
      countdownLabel = `${Math.round(diffMin / 60)} h`;
    } else {
      countdownState = 'wait';
      const h = Math.floor(diffMin / 60);
      const m = diffMin % 60;
      countdownLabel = m > 0 ? `${h} h ${m} m` : `${h} h`;
    }

    const color = SUBJECT_COLOR_MAP[item.strategyCode] || 'blue';
    const itemData: ItemData = {
      nid: String(item.id),
      tLevel: `T${item.nodeIndex}`,
      hhmm,
      subject: item.strategyCode || '数学',
      kp: '',
      stem: `节点 #${item.id} · 第 ${item.nodeIndex + 1} 次复习`,
      tags: [`T${item.nodeIndex}`],
      countdownState,
      countdownLabel,
      sideColor: color,
      status: item.status,
    };

    if (hh < 12) nowSlot.push(itemData);
    else if (hh < 18) afternoonSlot.push(itemData);
    else eveningSlot.push(itemData);
  }

  const slots: SlotData[] = [];
  if (nowSlot.length > 0) slots.push({ key: 'now', title: '现在 · 上午', iconClass: 'slotIconYellow', items: nowSlot });
  if (afternoonSlot.length > 0) slots.push({ key: 'afternoon', title: '下午', iconClass: 'slotIconBlue', items: afternoonSlot });
  if (eveningSlot.length > 0) slots.push({ key: 'evening', title: '晚上', iconClass: 'slotIconIndigo', items: eveningSlot });
  return slots;
}

// ─── Slot icon SVGs ─────────────────────────────────────────────
const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const SunIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/>
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>
    </g>
  </svg>
);

const MoonIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SLOT_ICONS: Record<string, React.ReactNode> = {
  now: <ClockIcon />,
  afternoon: <SunIcon />,
  evening: <MoonIcon />,
};

// ─── Main Component ─────────────────────────────────────────────
export const ReviewTodayPage: React.FC = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const sid = params.get('sid');

  // ── State ──────────────────────────────────────────────────
  const [pageState, setPageState] = useState<PageState>('LOADING');
  const [slots, setSlots] = useState<SlotData[]>(MOCK_SLOTS);
  const [totalCount, setTotalCount] = useState(8);
  const [doneCount, setDoneCount] = useState(3);
  const [inProgressCount, setInProgressCount] = useState(1);
  const [waitCount, setWaitCount] = useState(4);
  const [estMinutes, setEstMinutes] = useState(25);
  const [toast, setToast] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const masteryPct = 72; // Phase 1+ 由后端聚合

  // ── Fetch today data ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await reviewClient.getTodayReview('Asia/Shanghai');
        if (cancelled) return;

        if (resp.total === 0) {
          setPageState('today.EMPTY');
          setTotalCount(0);
          return;
        }

        const builtSlots = buildSlotsFromItems(resp.items);
        const activeItems = resp.items.filter(i => i.status === 'ACTIVE');
        const completedItems = resp.items.filter(i => i.status === 'MASTERED');

        setSlots(builtSlots.length > 0 ? builtSlots : MOCK_SLOTS);
        setTotalCount(resp.total);
        setDoneCount(completedItems.length);
        setWaitCount(activeItems.length);
        setInProgressCount(resp.total - completedItems.length - activeItems.length);
        setEstMinutes(Math.max(1, resp.total * 3));

        if (completedItems.length === resp.total) {
          setPageState('today.ALL_DONE');
        } else {
          setPageState('today.LIST');
        }

        track('wb_today_view', { count: resp.total, doneCount: completedItems.length, slotCount: builtSlots.length });
      } catch {
        // §9 降级: use mock data
        if (!cancelled) {
          setPageState('today.LIST');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Handle "全部开始" CTA ─────────────────────────────────
  const handleStartAll = useCallback(async () => {
    if (isStarting) return;
    setIsStarting(true);

    try {
      if ('vibrate' in navigator) navigator.vibrate(15);
    } catch { /* noop */ }

    // 埋点
    track('wb_today_start_all', { count: totalCount, estMin: estMinutes });

    // If we already have a sid from P-HOME, navigate directly to P08
    if (sid) {
      nav(`/review/exec/0?sid=${sid}`);
      return;
    }

    // Otherwise create session
    try {
      const resp = await reviewClient.createSession({ tz: 'Asia/Shanghai' });
      nav(`/review/exec/0?sid=${resp.sid}`);
    } catch {
      setToast('启动失败 · 请重试');
      setTimeout(() => setToast(null), 3000);
      setIsStarting(false);
    }
  }, [isStarting, totalCount, estMinutes, sid, nav]);

  // ── Today date string ─────────────────────────────────────
  const dateStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const weekday = useMemo(() => {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return days[new Date().getDay()];
  }, []);

  // ── Render helpers ────────────────────────────────────────
  const getSideClass = (color: string) => {
    switch (color) {
      case 'red': return s.sideRed;
      case 'orange': return s.sideOrange;
      case 'blue': return s.sideBlue;
      case 'indigo': return s.sideIndigo;
      case 'green': return s.sideGreen;
      default: return s.sideBlue;
    }
  };

  const getCountdownClass = (state: string) => {
    switch (state) {
      case 'now': return s.cdNow;
      case 'soon': return s.cdSoon;
      default: return s.cdWait;
    }
  };

  const getSlotIconClass = (iconClass: string) => {
    switch (iconClass) {
      case 'slotIconYellow': return s.slotIconYellow;
      case 'slotIconBlue': return s.slotIconBlue;
      case 'slotIconIndigo': return s.slotIconIndigo;
      default: return s.slotIconBlue;
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className={s.root} data-testid={TEST_IDS.p07.root}>

      {/* ── Nav bar ─────────────────────────────────────── */}
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

      {/* ── Content ─────────────────────────────────────── */}
      <div className={s.content}>

        {/* ── Hero summary card ─────────────────────────── */}
        <div className={s.hero} data-testid={TEST_IDS.p07.todayReviewCard}>
          <div className={s.b1} data-testid={TEST_IDS.p07.heroParticles} />
          <div className={s.b2} />

          <div className={s.heroTag}>
            <span className={s.live} />
            {dateStr} · {weekday} · GMT+8
          </div>

          <h2 className={s.heroH2}>
            <span data-testid={TEST_IDS.p07.heroTotal}>{totalCount} 题待复习</span>
            <span className={s.heroSz} data-testid={TEST_IDS.p07.heroEstMin}>预计 {estMinutes} 分钟</span>
          </h2>

          <div className={s.statsRow}>
            <div className={s.st}>
              <div className={s.stV} data-testid={TEST_IDS.p07.heroDone}>{doneCount}</div>
              <div className={s.stL}>已完成</div>
            </div>
            <div className={s.st}>
              <div className={s.stV}>{inProgressCount}</div>
              <div className={s.stL}>进行中</div>
            </div>
            <div className={s.st}>
              <div className={s.stV}>{waitCount}</div>
              <div className={s.stL}>未开始</div>
            </div>
          </div>

          <div className={s.pg}>
            <div
              className={s.pgFill}
              data-testid={TEST_IDS.p07.heroProgressBar}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className={s.pgTxt}>
            <span data-testid={TEST_IDS.p07.heroProgressPct}>进度 {progressPct}%</span>
            <span data-testid={TEST_IDS.p07.heroMasteryPct}>掌握度 {masteryPct}%</span>
          </div>
        </div>

        {/* ── Empty state ──────────────────────────────── */}
        {pageState === 'today.EMPTY' && (
          <div className={s.empty} data-testid={TEST_IDS.p07.emptyState}>
            <div className={s.emptyTitle}>今日无题 · 拍一道试试</div>
            <div className={s.emptySub}>还没有待复习的题目</div>
            <button
              className={s.emptyBtn}
              data-testid={TEST_IDS.p07.emptyCaptureBtn}
              onClick={() => nav('/capture')}
            >
              去拍题
            </button>
          </div>
        )}

        {/* ── Slot groups ──────────────────────────────── */}
        {(pageState === 'today.LIST' || pageState === 'LOADING') && slots.map((slot) => (
          <React.Fragment key={slot.key}>
            <div className={s.slot} data-testid={p07Ids.slotHeader(slot.key)}>
              <div className={getSlotIconClass(slot.iconClass)}>
                {SLOT_ICONS[slot.key] || <ClockIcon />}
              </div>
              <h3 className={s.slotTitle} data-testid={p07Ids.slotTitle(slot.key)}>{slot.title}</h3>
              <div className={s.slotLine} />
              <span className={s.slotCount}>{slot.items.length} 题</span>
            </div>

            {slot.items.map((item, idx) => (
              <div key={item.nid} className={s.it} data-testid={p07Ids.slotItem(slot.key, idx)}>
                <div className={getSideClass(item.sideColor)} />
                <div className={s.tc}>
                  <div className={s.hh} data-testid={p07Ids.slotItemTime(slot.key, idx)}>{item.hhmm}</div>
                  <div className={s.lv} data-testid={p07Ids.slotItemTLevel(slot.key, idx)}>{item.tLevel}</div>
                </div>
                <div className={s.body}>
                  <div className={s.bodyH}>
                    <span className={SUBJECT_SUB_CLASS[item.sideColor] || s.sub}>{item.subject}</span>
                    {item.kp && <> · {item.kp}</>}
                  </div>
                  <div className={s.stem}>{item.stem}</div>
                  <div className={s.tags}>
                    {item.tags.map((tag, ti) => (
                      <span key={ti} className={tag.startsWith('★') ? s.tgOrange : s.tg}>{tag}</span>
                    ))}
                  </div>
                </div>
                <div className={s.right}>
                  <span
                    className={getCountdownClass(item.countdownState)}
                    data-testid={p07Ids.slotItemCountdown(slot.key, idx)}
                  >
                    {item.countdownLabel}
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

      {/* ── Bottom CTA (floating) ──────────────────────── */}
      {pageState !== 'today.EMPTY' && pageState !== 'today.ALL_DONE' && (
        <button
          className={s.cta}
          data-testid={TEST_IDS.p07.bottomCtaStartAllBtn}
          onClick={handleStartAll}
          disabled={isStarting}
          aria-label="全部开始"
        >
          {isStarting ? (
            <><span className={s.spinner} aria-hidden="true" /> 加载中…</>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M8 5v14l11-7L8 5Z" fill="#fff"/>
              </svg>
              全部开始 <span className={s.ctaSz}>{totalCount} 题 · {estMinutes} min</span>
            </>
          )}
        </button>
      )}

      {/* ── Tab bar ────────────────────────────────────── */}
      <div className={s.tabbar}>
        <div className={s.tab}>
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
        <div className={s.tabActive}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 3.5c-3.6 0-6.2 2.6-6.2 6.2v3.4L4 15.5v1.3h16v-1.3l-1.8-2.4V9.7c0-3.6-2.6-6.2-6.2-6.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M10 19.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span>复习</span>
          <span className={s.badge}>{totalCount}</span>
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
