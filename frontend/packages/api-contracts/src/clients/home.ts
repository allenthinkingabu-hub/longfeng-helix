// SC-01-D01 · home-aggregator client
// spec: design/system/pages/P-HOME.spec.md §5 GET /api/home/today?tz=
// SC-16-T02 · 扩展 getWeekly · spec P-WEEKLY-REVIEW §5
import type { HomeTodayResp, WeeklyReviewResp } from '../types';

const BASE_PATH = '/api/home';

export const homeClient = {
  async getToday(tz?: string): Promise<HomeTodayResp> {
    const params = tz ? `?tz=${encodeURIComponent(tz)}` : '';
    const res = await fetch(`${BASE_PATH}/today${params}`);
    if (!res.ok) throw new Error(`home/today failed: ${res.status}`);
    return res.json();
  },

  /**
   * SC-16-T02 · GET /api/home/weekly · P-WEEKLY-REVIEW 完整聚合
   * - 必须带 X-User-Id Header (MVP 鉴权 · 与 /today 一致 · 登录上线升 JWT)
   * - 失败抛 Error · 调用方按 §9 状态机切 ERROR
   */
  async getWeekly(studentId: string, tz?: string): Promise<WeeklyReviewResp> {
    const params = tz ? `?tz=${encodeURIComponent(tz)}` : '';
    const headers: Record<string, string> = { 'X-User-Id': studentId };
    if (tz) headers['X-User-Timezone'] = tz;
    const res = await fetch(`${BASE_PATH}/weekly${params}`, { headers });
    if (!res.ok) throw new Error(`home/weekly failed: ${res.status}`);
    return res.json();
  },
};
