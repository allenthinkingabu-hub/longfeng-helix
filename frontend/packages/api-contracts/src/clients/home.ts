// SC-01-D01 · home-aggregator client stub
// Full implementation lands with P-HOME task; export kept for index.ts
import type { HomeTodayResp } from '../types';

const BASE_PATH = '/api/home';

export const homeClient = {
  async getToday(): Promise<HomeTodayResp> {
    const res = await fetch(`${BASE_PATH}/today`);
    if (!res.ok) throw new Error(`home/today failed: ${res.status}`);
    return res.json();
  },
};
