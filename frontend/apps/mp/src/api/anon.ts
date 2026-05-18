/**
 * SC-12 anon-flow API · 调 anonymous-service :8090
 * 文档: design/system/pages/P-GUEST-CAPTURE-guest-capture.spec.md §5
 * 后端: SC-12-T01..T09 已落 · X-Anon-Token + 7 个端点
 *
 * NOTE: stub-only scaffold from P0 prep. Real impl owed by team C.
 * Convention: use `httpJSON` + `apiBase('anon')` (see _http.ts dual-runtime adapter).
 * Header convention: X-Anon-Token on every request; X-Idempotency-Key on POST mutators
 * (mirror file.ts presign pattern).
 */
import { httpJSON, apiBase } from './_http';

export interface MintRequest {
  deviceFp: string;
  entrySource?: string;
  ipHash?: string;
  ua?: string;
  experimentBucket?: string;
}
export interface MintResponse {
  anonToken: string;
  anonSessionId: number;
  expiresAt: string;
}

export interface ConsentRequest {
  consentType: 1 | 2 | 3;
}
export interface ConsentResponse {
  consentAt: string;
  consentType: number;
}

export interface PresignRequest {
  filename: string;
  mime: string;
  size: number;
  sha256Hash?: string;
  purpose: 'GUEST_CAPTURE';
}
export interface PresignResponse {
  upload_url: string;
  file_key: string;
  ttl_seconds: number;
  bucket: string;
}

export interface QuestionsRequest {
  objectKey: string;
  subject: string;
  sha256Hash?: string;
}
export interface QuestionsResponse {
  anon_qid: number;
  claim_window: { expires_at: string };
}

export interface AnalyzeRequest {
  anonQid: number;
  subject: string;
  imageUrl?: string;
}
export interface AnalyzeResponse {
  task_id: string;
  poll_every: number;
  status: string;
}

export interface ResultResponse {
  status: 'ANALYZING' | 'READY' | 'FAILED' | 'NOT_FOUND';
  result?: {
    subject: string;
    stem_length: number;
    chat_model: string;
    ocr_model: string;
  };
  error_code?: string;
}

export interface ClaimRequest {
  subject: string;
}
export interface ClaimResponse {
  claimed_question_id: string;
  claimed_at: string;
  anon_session_id: number;
  student_id: number;
}

/** TODO: team C · POST /api/anon/session · mint */
export async function mint(_req: MintRequest): Promise<MintResponse> {
  void httpJSON;
  void apiBase;
  throw new Error('NOT_IMPLEMENTED · team C');
}

/** TODO: team C · PATCH /api/anon/session/{id}/consent */
export async function consent(
  _anonToken: string,
  _sessionId: number,
  _req: ConsentRequest,
): Promise<ConsentResponse> {
  void httpJSON;
  void apiBase;
  throw new Error('NOT_IMPLEMENTED · team C');
}

/** TODO: team C · POST /api/anon/file/presign */
export async function presign(
  _anonToken: string,
  _req: PresignRequest,
): Promise<PresignResponse> {
  void httpJSON;
  void apiBase;
  throw new Error('NOT_IMPLEMENTED · team C');
}

/** TODO: team C · POST /api/anon/questions */
export async function postQuestion(
  _anonToken: string,
  _idempotencyKey: string,
  _req: QuestionsRequest,
): Promise<QuestionsResponse> {
  void httpJSON;
  void apiBase;
  throw new Error('NOT_IMPLEMENTED · team C');
}

/** TODO: team C · POST /api/anon/analyze-by-url */
export async function analyzeByUrl(
  _anonToken: string,
  _req: AnalyzeRequest,
): Promise<AnalyzeResponse> {
  void httpJSON;
  void apiBase;
  throw new Error('NOT_IMPLEMENTED · team C');
}

/** TODO: team C · GET /api/anon/result/{anonQid} */
export async function getResult(
  _anonToken: string,
  _anonQid: number,
): Promise<ResultResponse> {
  void httpJSON;
  void apiBase;
  throw new Error('NOT_IMPLEMENTED · team C');
}

/** TODO: team C · POST /api/anon/claim · 双 JWT (X-Anon-Token + Authorization: Bearer student JWT) */
export async function claim(
  _anonToken: string,
  _studentJwt: string,
  _req: ClaimRequest,
): Promise<ClaimResponse> {
  void httpJSON;
  void apiBase;
  throw new Error('NOT_IMPLEMENTED · team C');
}
