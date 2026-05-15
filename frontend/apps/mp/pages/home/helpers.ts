// P-HOME pure helpers · extracted for unit testability
// trace: design/mockups/wrongbook/01_home_ios_refined.html

export type PageState = 'LOADING' | 'READY' | 'EMPTY' | 'ERROR';

export interface HomeTodayData {
  total: number;
  done: number;
  items: unknown[];
  tz: string;
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
