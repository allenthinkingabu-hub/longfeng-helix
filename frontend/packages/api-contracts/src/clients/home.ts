// SC-01-D01 · home-aggregator client
// spec: design/system/pages/P-HOME.spec.md §5 GET /api/home/today?tz=
import type { HomeTodayResp } from '../types';

const BASE_PATH = '/api/home';

export const homeClient = {
  async getToday(tz?: string): Promise<HomeTodayResp> {
    const params = tz ? `?tz=${encodeURIComponent(tz)}` : '';
    const res = await fetch(`${BASE_PATH}/today${params}`);
    if (!res.ok) throw new Error(`home/today failed: ${res.status}`);
    return res.json();
  },
};
