// SC-01-C05 · review-plan client
// Endpoints: open / reveal / grade / result / sessions / subscribe / today
import type {
  NodeResultResp, GradeReq, GradeResp, NextInSessionResp, CalendarSubscribeResp,
  CreateReviewSessionReq, CreateReviewSessionResp, TodayResp,
} from '../types';

const BASE_PATH = '/api/review';

export const reviewClient = {
  /** GET /api/review/today?tz= · spec P07 §5 #1 */
  async getToday(tz = 'Asia/Shanghai'): Promise<TodayResp> {
    const res = await fetch(`${BASE_PATH}/today?tz=${encodeURIComponent(tz)}`);
    if (!res.ok) throw new Error(`today failed: ${res.status}`);
    const json = await res.json();
    return json.data ?? json;
  },

  /** POST /api/review/sessions · spec P07 §5 #2 */
  async createSession(body: CreateReviewSessionReq): Promise<CreateReviewSessionResp> {
    const res = await fetch(`${BASE_PATH}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`createSession failed: ${res.status}`);
    const json = await res.json();
    return json.data ?? json;
  },

  /** POST /api/review/nodes/{nid}/open */
  async openNode(nid: string): Promise<{ nid: string; openedAt: string }> {
    const res = await fetch(`${BASE_PATH}/nodes/${nid}/open`, { method: 'POST' });
    if (!res.ok) throw new Error(`open failed: ${res.status}`);
    const json = await res.json();
    return json.data ?? json;
  },

  /** POST /api/review/nodes/{nid}/reveal */
  async revealNode(nid: string): Promise<{ nid: string; revealedAt: string }> {
    const res = await fetch(`${BASE_PATH}/nodes/${nid}/reveal`, { method: 'POST' });
    if (!res.ok) throw new Error(`reveal failed: ${res.status}`);
    const json = await res.json();
    return json.data ?? json;
  },

  /** POST /api/review/nodes/{nid}/grade · spec P08 §5 #3 */
  async gradeNode(nid: string, body: GradeReq): Promise<GradeResp> {
    const res = await fetch(`${BASE_PATH}/nodes/${nid}/grade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`grade failed: ${res.status}`);
    const json = await res.json();
    return json.data ?? json;
  },

  /** GET /api/review/nodes/{nid}/result · spec P09 §5 #1 */
  async getNodeResult(nid: string): Promise<NodeResultResp> {
    const res = await fetch(`${BASE_PATH}/nodes/${nid}/result`);
    if (!res.ok) throw new Error(`result failed: ${res.status}`);
    const json = await res.json();
    return json.data ?? json;
  },

  /** POST /api/review/sessions/{sid}/next · spec P09 §5 #2 */
  async nextInSession(sid: string): Promise<NextInSessionResp> {
    const res = await fetch(`${BASE_PATH}/sessions/${sid}/next`, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': crypto.randomUUID() },
    });
    if (!res.ok) throw new Error(`next failed: ${res.status}`);
    const json = await res.json();
    return json.data ?? json;
  },

  /** POST /api/calendar/events/{eid}/subscribe · spec P09 §5 #3 */
  async subscribeCalendar(eid: string, idempotencyKey: string): Promise<CalendarSubscribeResp> {
    const res = await fetch(`/api/calendar/events/${eid}/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: '{}',
    });
    if (!res.ok) throw new Error(`subscribe failed: ${res.status}`);
    const json = await res.json();
    return json.data ?? json;
  },
};
