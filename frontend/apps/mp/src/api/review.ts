/**
 * Review API client · MP
 * trace: H5 sibling frontend/apps/h5/src/pages/ReviewExec/index.tsx
 * Endpoints: GET /api/review/sessions/<sid>/nodes/<nid> · POST /api/review/nodes/<nid>/reveal · POST /api/review/nodes/<nid>/grade
 * Port: 8085 (review-plan-service) via _http.ts apiBase('review')
 */

import { apiBase, httpJSON } from './_http';

// ─── Types ────────────────────────────────────────────────────

export interface ReviewNodeResponse {
  nid: string;
  nodeIndex: number;
  tLevel: string;
  easeFactor: number;
  question: {
    qid: string;
    stem: string;
    subject: string;
    kpName: string;
    difficulty: number;
    answer: string;
    steps: string[];
  };
}

export interface RevealResponse {
  revealedAt: string;
}

export interface GradeRequest {
  grade: 'FORGOT' | 'PARTIAL' | 'MASTERED';
  timeSpentMs: number;
}

export interface GradeResponse {
  newTLevel: string;
  newEaseFactor: number;
}

// ─── API functions ────────────────────────────────────────────

const BASE = apiBase('review');

/** GET /api/review/sessions/{sid}/nodes/{nid} */
export function getNode(sid: string, nid: string): Promise<ReviewNodeResponse> {
  return httpJSON<ReviewNodeResponse>(`${BASE}/api/review/sessions/${sid}/nodes/${nid}`);
}

/** POST /api/review/nodes/{nid}/reveal */
export function revealNode(nid: string): Promise<RevealResponse> {
  return httpJSON<RevealResponse>(`${BASE}/api/review/nodes/${nid}/reveal`, {
    method: 'POST',
  });
}

/** POST /api/review/nodes/{nid}/grade */
export function gradeNode(nid: string, body: GradeRequest): Promise<GradeResponse> {
  return httpJSON<GradeResponse>(`${BASE}/api/review/nodes/${nid}/grade`, {
    method: 'POST',
    body,
  });
}
