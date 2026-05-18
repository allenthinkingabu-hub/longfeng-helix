// P-HOME pure helpers · extracted for unit testability
// trace: design/mockups/wrongbook/01_home.html

export type PageState = 'LOADING' | 'READY' | 'EMPTY' | 'ERROR';

// 与 src/api/home.ts HomeTodayData 保持兼容 · derivePageState 只看 total ·
// done/items 在 api 层是可选/typed · helpers 这层只关心 total 是否 0
export interface HomeTodayData {
  total: number;
  done?: number;
  items?: unknown[];
  tz?: string;
}

export interface WeekDay {
  w: string;        // 周名简写 一二三四五六日
  d: string;        // 日期 (2 位字符串)
  dots: string[];   // mockup 占位 dots 颜色
  today: boolean;
  num: number;      // today 上挂的红色 badge 数 (其它日为 0)
}

export interface WeekStrip {
  label: string;    // 周区间 label 如 "5 月 11–17 日"
  days: WeekDay[];  // 长度 7 · 周一→周日
}

// ─── Subject palette (B6 · 亮色 · 对标 01_home.html L236-238) ─────
// rh-sub-chip 在深蓝 reviewhero 卡片上 · 必须亮色才能 contrast 清晰
// 数学 #FF6B6B · 物理 #FFD166 · 英语 #6DE895 · 化学 mockup 未给, 沿用 30B0C7 teal
// 放在 helpers.ts 是为了让 unit test 可直接 import 不触发 Page() 全局
export const SUBJECT_COLORS: Record<string, string> = {
  '数学': '#FF6B6B',
  '物理': '#FFD166',
  '化学': '#30B0C7',
  '英语': '#6DE895',
  '语文': '#FF9F40',
};

// BE wrong_item.subject 是 enum 字符串 ('math'/'physics'/...) · FE 映射中文 chip label.
// 跟 review-today/helpers.ts SUBJECT_LABEL_MAP 同源 · 之所以两份是因为 P-HOME 在
// MP 内独立 module · 不允许 import 跨 module 共享.
const SUBJECT_LABEL: Record<string, string> = {
  math: '数学', physics: '物理', chemistry: '化学', english: '英语', chinese: '语文',
};

export interface SubjectChip {
  name: string;   // 中文 label
  count: number;  // 该学科当日题数
  color: string;
}

/**
 * 从 today items[] 聚合每学科题数 · 替代之前 MVP_SUBJECTS 写死 3/2/3.
 * spec P-HOME L80 <TodayReviewCard> props 含 subjectDist[] · spec L151 标 MVP hardcoded ·
 * 但 BE 实际已经在 /api/review/today items[] 返了 subject 字段 (P07 enrich 复用) ·
 * P-HOME 可以一并消费 · 避免 3+2+3=8 ≠ todayTotal=4 数字打架.
 */
export function buildSubjectsFromItems(
  items: Array<{ subject?: string | null }>
): SubjectChip[] {
  const counts: Record<string, number> = {};
  for (const it of items) {
    const key = (it.subject ?? '').toLowerCase();
    const label = SUBJECT_LABEL[key];
    if (!label) continue;  // 未知/空 subject 跳过 · 不渲染"未知 N 题"误导
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return Object.entries(counts).map(([name, count]) => ({
    name,
    count,
    color: SUBJECT_COLORS[name] ?? '#999',
  }));
}

export function buildGreeting(): string {
  const now = new Date();
  const hour = now.getHours();
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dayName = dayNames[now.getDay()];
  const month = now.getMonth() + 1;
  const date = now.getDate();

  let period = '早安';
  if (hour >= 12 && hour < 18) period = '下午好';
  else if (hour >= 18) period = '晚上好';

  return `${dayName} · ${month} 月 ${date} 日 · ${period}`;
}

export function computeCirclePct(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

export function derivePageState(data: HomeTodayData | null, hasError: boolean): PageState {
  if (hasError && !data) return 'ERROR';
  if (!data) return 'LOADING';
  if (data.total === 0) return 'EMPTY';
  return 'READY';
}

// ── 本周日程动态构造 (B4 + B5) ───────────────────────────────────
// 输入: now (任意 Date · 通常 new Date()), 可选 dotsByDay (BE /api/home/week-dots 返回)
// 输出: { label, days[7] } · 周一→周日 连续日期, today 高亮
// 设计真相 (01_home.html L300-340): 周一 d=20 周二 d=21 ... 周日 d=26
// dots: BE 真值注入 · 之前 PLACEHOLDER_DOTS_BY_WEEKDAY 写死 mockup 摆位是 假数据 ·
//       未传或长度不对时全 7 桶给 [] · UI 自然空表示该日无复习排程.

const WEEK_LABELS_ZH = ['一', '二', '三', '四', '五', '六', '日'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * todayBadgeNum: 今日红点角标显示的数字 · 之前写死 8 · 现注入真值 (= pending = total - done).
 * 0 时 wxml `wx:if="{{item.num}}"` 自动 hide.
 * dotsByDay: BE /api/home/week-dots 返回的 7 桶颜色 · 周一→周日 · 未传则全 7 桶给空数组.
 */
export function buildCurrentWeekStrip(
  now: Date,
  todayBadgeNum: number = 0,
  dotsByDay?: string[][]
): WeekStrip {
  // JS getDay(): 0=Sunday..6=Saturday · 项目 ISO 周一→周日, 转换:
  // Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
  const jsDay = now.getDay();
  const isoIdx = jsDay === 0 ? 6 : jsDay - 1;

  // 本周一: now - isoIdx 天
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - isoIdx);

  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const isToday = i === isoIdx;
    days.push({
      w: WEEK_LABELS_ZH[i],
      d: pad2(dt.getDate()),
      dots: (dotsByDay && dotsByDay[i]) ? dotsByDay[i] : [],
      today: isToday,
      num: isToday ? todayBadgeNum : 0,
    });
  }

  // label: "M 月 D1–D2 日" (本周一 → 本周日)
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const label = `${monday.getMonth() + 1} 月 ${monday.getDate()}–${sunday.getDate()} 日`;

  return { label, days };
}

// ── SC-16-T02 · P-HOME weekSummary helpers ─────────────────────
// trace: design/system/pages/P-HOME.spec.md §5.2 + biz §10.14

/**
 * masteryRate 0..1 → "68%" · null → "—%" (em dash U+2014)
 * spec §5.2: null 时显 "—%" 不显 "0%"
 */
export function formatMasteryPctFromWeekSummary(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return '—%';
  return `${Math.round(rate * 100)}%`;
}

/**
 * 2026-05-18 sparkline 下方 day bar 标签 · ISO 周一→周日 7 桶 ·
 * 今天对应 ISO 索引位置贴 "今天" 字面 · 其他位置贴 "周一"/"周二"/...
 *
 * 例: 今天=周一 → ["今天","周二","周三","周四","周五","周六","周日"]
 *     今天=周三 → ["周一","周二","今天","周四","周五","周六","周日"]
 *     今天=周日 → ["周一","周二","周三","周四","周五","周六","今天"]
 *
 * 修旧 bug: wxml 原写死 ["周一",...,"周六","今天"] 假设今天=周日 → 错位.
 */
export function buildWeekDayLabels(now: Date): string[] {
  const todayIdx = computeIsoTodayIdx(now);
  // 项目 ISO 周 (周一=0..周日=6) 字面: 周一/周二/周三/周四/周五/周六/周日
  const isoNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return isoNames.map((name, i) => (i === todayIdx ? '今天' : name));
}

/**
 * 今天在 ISO 周 (周一=0..周日=6) 的索引位置.
 * JS getDay(): 0=Sunday..6=Saturday · 转 ISO: Sun=6 · 其余 -1.
 */
export function computeIsoTodayIdx(now: Date): number {
  const jsDay = now.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * sparkline (Array<number | null> 长度 7) → svg data URI 字符串
 * - null 索引在 path M/L 命令断笔 (不 forward-fill · 不打底 0)
 * - viewBox 300×40 · 与既有 SPARKLINE_SVG_URI 同尺寸 (vrt baseline 复用)
 * - 返回 'data:image/svg+xml;utf8,...' 给 <image src=...> 直接消费
 */
export function buildSparklineSvgFromWeekSummary(
  sparkline: Array<number | null>,
): string {
  if (!Array.isArray(sparkline) || sparkline.length === 0) {
    return '';
  }
  const W = 300;
  const H = 40;
  const step = W / Math.max(1, sparkline.length - 1);

  // 2026-05-18 用户决策: null (没复习的天) → 画在 0% 底部 + 连成线 ·
  // 视觉上一条完整折线更直观 (替代旧"断笔"行为).
  // 若全周 null (本周 0 复习) → 返 '' · wx:if 隐藏整个 sparkline.
  const allNull = sparkline.every((v) => v === null || v === undefined || !Number.isFinite(v));
  if (allNull) return '';

  const path: string[] = [];
  const dots: string[] = [];
  for (let i = 0; i < sparkline.length; i++) {
    const raw = sparkline[i];
    const v = raw === null || raw === undefined || !Number.isFinite(raw) ? 0 : (raw as number);
    const y = Math.max(0, Math.min(H, (1 - v) * H));
    const x = i * step;
    path.push(i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`);
    dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" fill="#34C759"/>`);
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
  <path d="${path.join(' ')}" stroke="#34C759" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  ${dots.join('')}
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
