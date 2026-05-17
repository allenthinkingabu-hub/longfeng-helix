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
};

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
// 输入: now (任意 Date · 通常 new Date())
// 输出: { label, days[7] } · 周一→周日 连续日期, today 高亮
// 设计真相 (01_home.html L300-340): 周一 d=20 周二 d=21 ... 周日 d=26
// 此 helper 替换原 index.ts 中硬编码 MVP_WEEK_DAYS · 修 B4 (22 重复) + B5 (硬编码 4 月)
// 占位 dots 颜色保留 mockup 同款 5 色, 与 SUBJECT_COLORS 解耦 (mockup dots 是排课色, 非学科色)
const PLACEHOLDER_DOTS_BY_WEEKDAY: string[][] = [
  // 周一 二 三 四 五 六 日 · 来自 01_home.html 各 wd block (mockup 真实摆位)
  ['#FF3B30', '#FF9500'],                                  // 一: r o
  ['#FF3B30', '#FF9500', '#34C759', '#FF3B30', '#5856D6'], // 二 (today): r o g r i
  ['#34C759', '#5856D6'],                                  // 三: g i
  ['#FF3B30', '#34C759', '#FF2D55'],                       // 四: r g p
  ['#FF9500', '#5856D6'],                                  // 五: o i
  ['#FF2D55'],                                             // 六: p
  ['#34C759', '#5856D6', '#FF3B30'],                       // 日: g i r
];

const WEEK_LABELS_ZH = ['一', '二', '三', '四', '五', '六', '日'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function buildCurrentWeekStrip(now: Date): WeekStrip {
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
      dots: PLACEHOLDER_DOTS_BY_WEEKDAY[i],
      today: isToday,
      num: isToday ? 8 : 0,
    });
  }

  // label: "M 月 D1–D2 日" (本周一 → 本周日)
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const label = `${monday.getMonth() + 1} 月 ${monday.getDate()}–${sunday.getDate()} 日`;

  return { label, days };
}
