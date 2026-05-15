// SC-01-D01 home-aggregator typed client
// GET /api/home/today → HomeTodayResp
import type { HomeTodayResp } from '../types';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-Id': '1',
    'X-Request-Id': crypto.randomUUID(),
  };
  let token: string | null = null;
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      token = localStorage.getItem('access_token');
    }
  } catch { token = null; }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const homeClient = {
  async getToday(): Promise<HomeTodayResp> {
    const res = await fetch('/api/home/today', {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err: unknown = await res.json().catch(() => ({
        code: 'NETWORK',
        message: res.statusText,
      }));
      throw err;
    }
    return await res.json() as HomeTodayResp;
  },
};
