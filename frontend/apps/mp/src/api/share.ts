/**
 * SC-13 share API · 调 anonymous-service :8090
 * 文档: design/system/pages/P-SHARED-shared.spec.md §5
 * 后端: SC-13 已落 · /api/share/:shareToken (GET · 脱敏 + signature_valid)
 *
 * NOTE: stub-only scaffold from P0 prep. Real impl owed by team D.
 * Convention: use `httpJSON` + `apiBase('anon')` (share endpoint lives on :8090).
 * Read-only: write/mutation attempts on shared content must reject with 403 (BE-enforced).
 */
import { httpJSON, apiBase } from './_http';

export interface ShareResponse {
  type: 'EXAM_DAY' | 'QUESTION' | 'REVIEW_NODE';
  sharerNick: string;
  ttlSec: number;
  signatureValid: boolean;
  maskedPayload: {
    stemSnippet: string;
    tags: string[];
    difficulty: number;
    aiPreview: boolean;
  };
}

/** TODO: team D · GET /api/share/:shareToken · 脱敏只读 · 写操作 403 */
export async function getShare(_shareToken: string): Promise<ShareResponse> {
  void httpJSON;
  void apiBase;
  throw new Error('NOT_IMPLEMENTED · team D');
}
