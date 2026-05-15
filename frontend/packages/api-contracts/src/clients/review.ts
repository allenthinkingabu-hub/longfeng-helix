// SC-01-T13 · review-plan-service typed client (P09 ReviewDone)
// Backend mount paths:
//   GET  /api/review/nodes/{nid}/result   → NodeResultResp
//   POST /api/review/sessions/{sid}/next  → NextInSessionResp
//   POST /api/calendar/events/{eid}/subscribe → CalendarSubscribeResp
// Headers: X-User-Id, X-Idempotency-Key, X-Request-Id per spec §5
import type {
  NodeResultResp,
  NextInSessionResp,
  CalendarSubscribeResp,
} from '../types';

function camelize<T = unknown>(input: unknown): T {
  if (Array.isArray(input)) {
    return input.map((v) => camelize(v)) as unknown as T;
  }
  if (input !== null && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const ck = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      out[ck] = camelize(v);
    }
    return out as T;
  }
  return input as T;
}

function getHeaders(idempotencyKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-Id': '1',
    'X-Request-Id': crypto.randomUUID(),
  };
  if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;
  let token: string | null = null;
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      token = localStorage.getItem('access_token');
    }
  } catch { token = null; }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err: unknown = await res.json().catch(() => ({
      code: 'NETWORK',
      message: res.statusText,
    }));
    throw err;
  }
  const raw = await res.json();
  const payload =
    raw && typeof raw === 'object' && 'data' in raw && 'code' in raw
      ? (raw as { data: unknown }).data
      : raw;
  return camelize<T>(payload);
}

export const reviewClient = {
  /**
   * GET /api/review/nodes/{nid}/result
   * Returns NodeResultResp with plan + outcome + lifecycle aggregation.
   * P09 spec §5 #1 · P95 ≤ 300ms
   */
  async getNodeResult(nid: string): Promise<NodeResultResp> {
    const res = await fetch(`/api/review/nodes/${encodeURIComponent(nid)}/result`, {
      method: 'GET',
      headers: getHeaders(),
    });
    return unwrap<NodeResultResp>(res);
  },

  /**
   * POST /api/review/sessions/{sid}/next
   * Returns next node or done=true (session complete).
   * P09 spec §5 #2 · P95 ≤ 300ms
   */
  async peekNext(sid: string, idempotencyKey: string): Promise<NextInSessionResp> {
    const res = await fetch(`/api/review/sessions/${encodeURIComponent(sid)}/next`, {
      method: 'POST',
      headers: getHeaders(idempotencyKey),
    });
    return unwrap<NextInSessionResp>(res);
  },

  /**
   * POST /api/calendar/events/{eid}/subscribe
   * Idempotent calendar subscription. P09 spec §5 #3 · P95 ≤ 400ms
   */
  async subscribeCalendar(eid: string, idempotencyKey: string): Promise<CalendarSubscribeResp> {
    const res = await fetch(`/api/calendar/events/${encodeURIComponent(eid)}/subscribe`, {
      method: 'POST',
      headers: getHeaders(idempotencyKey),
      body: '{}',
    });
    return unwrap<CalendarSubscribeResp>(res);
  },
};
