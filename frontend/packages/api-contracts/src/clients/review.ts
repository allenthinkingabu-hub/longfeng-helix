// SC-01-C05 · review-plan-service typed client
// Backend mount path: /api/review/* (see ReviewPlanController.java)
// Spec: design/system/pages/P08-review-exec.spec.md §5

const BASE_PATH = '/api/review';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const userId = localStorage.getItem('lf:auth:studentId');
      if (userId) headers['X-User-Id'] = userId;
    }
  } catch { /* noop */ }
  return headers;
}

function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in raw && 'code' in raw) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

export interface RevealResp {
  nid: string;
  revealedAt: string;
}

export interface ReviewNodeDetail {
  nid: string;
  wrongItemId: string;
  nodeIndex: number;
  tLevel: string;
  easeFactor: number;
  status: string;
  nextDueAt: string;
}

export const reviewClient = {
  /** POST /api/review/nodes/{nid}/reveal · spec §5 #2 */
  async revealNode(nid: string): Promise<RevealResp> {
    const res = await fetch(`${BASE_PATH}/nodes/${encodeURIComponent(nid)}/reveal`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw await res.json().catch(() => ({ code: 'NETWORK', message: res.statusText }));
    }
    return unwrap<RevealResp>(await res.json());
  },

  /** GET /api/review/nodes/{nid} · spec §5 #4 */
  async getNode(nid: string): Promise<ReviewNodeDetail> {
    const res = await fetch(`${BASE_PATH}/nodes/${encodeURIComponent(nid)}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw await res.json().catch(() => ({ code: 'NETWORK', message: res.statusText }));
    }
    return unwrap<ReviewNodeDetail>(await res.json());
  },

  /** POST /api/review/nodes/{nid}/open · spec §5 #1 */
  async openNode(nid: string): Promise<void> {
    const res = await fetch(`${BASE_PATH}/nodes/${encodeURIComponent(nid)}/open`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw await res.json().catch(() => ({ code: 'NETWORK', message: res.statusText }));
    }
  },
};
