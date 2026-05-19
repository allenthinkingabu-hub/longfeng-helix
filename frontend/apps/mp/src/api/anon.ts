/**
 * SC-12 anon-flow API · 调 anonymous-service :8090
 * 文档: design/system/pages/P-GUEST-CAPTURE-guest-capture.spec.md §5
 * 后端: SC-12-T01..T09 已落 · X-Anon-Token + 7 个端点
 *
 * Convention: use `httpJSON` + `apiBase('anon')` (see _http.ts dual-runtime adapter).
 * Header convention: X-Anon-Token on every request; X-Idempotency-Key on POST mutators
 * (mirror file.ts presign pattern).
 *
 * Upstream wire-format gotchas (surface from T06/T07):
 * - analyze-by-url upstream uses camelCase (taskId/imageUrl) not snake_case
 * - result.status upstream真值是 "DONE" 不是 "RESULT_READY" · MP 把 DONE 视为 READY 同义
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

export interface AnonResultStep {
  step_no: number | null;
  text: string;
  title?: string | null;
  formula?: string | null;
}
export interface ResultResponse {
  status: 'ANALYZING' | 'READY' | 'FAILED' | 'NOT_FOUND' | 'DONE';
  result?: {
    subject: string;
    stem_length: number;
    chat_model: string;
    ocr_model: string;
    // Extended 2026-05-19 for P04 游客态 (spec line 216 + biz §F05) ·
    // anon-service 在 DONE 时调 ai-service /answer 拉完整数据合并.
    // 若 /answer 调用降级 (ai-service 暂不可达) 这些字段缺省字符串.
    stem?: string;
    reason_markdown?: string;
    steps?: AnonResultStep[];
    correction?: string;
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

const ANON = (): string => apiBase('anon');

/** Header builder · always carry X-Anon-Token when available */
function anonHeaders(anonToken?: string, extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {};
  if (anonToken) h['X-Anon-Token'] = anonToken;
  return { ...h, ...(extra ?? {}) };
}

/** POST /api/anon/session · mint anonymous session (SC-12-T01) */
export async function mint(req: MintRequest): Promise<MintResponse> {
  return httpJSON<MintResponse>(`${ANON()}/api/anon/session`, {
    method: 'POST',
    body: req,
  });
}

/** PATCH /api/anon/session/{id}/consent · record consent (SC-12-T02) */
export async function consent(
  anonToken: string,
  sessionId: number,
  req: ConsentRequest,
): Promise<ConsentResponse> {
  return httpJSON<ConsentResponse>(`${ANON()}/api/anon/session/${sessionId}/consent`, {
    method: 'PATCH',
    body: req,
    headers: anonHeaders(anonToken),
  });
}

/** POST /api/anon/file/presign · get presigned MinIO PUT url (SC-12-T04) */
export async function presign(
  anonToken: string,
  req: PresignRequest,
): Promise<PresignResponse> {
  return httpJSON<PresignResponse>(`${ANON()}/api/anon/file/presign`, {
    method: 'POST',
    body: req,
    headers: anonHeaders(anonToken),
  });
}

/** POST /api/anon/questions · create anon question (SC-12-T05) ·
 *  X-Idempotency-Key required (BE 400 ERR_IDEMPOTENCY_KEY_REQUIRED 否则) */
export async function postQuestion(
  anonToken: string,
  idempotencyKey: string,
  req: QuestionsRequest,
): Promise<QuestionsResponse> {
  return httpJSON<QuestionsResponse>(`${ANON()}/api/anon/questions`, {
    method: 'POST',
    body: req,
    headers: anonHeaders(anonToken, { 'X-Idempotency-Key': idempotencyKey }),
  });
}

/** POST /api/anon/analyze-by-url · trigger AI analysis (SC-12-T06 + T09 quota)
 *  - 202 + {task_id, poll_every} on accept
 *  - 429 + Retry-After header on quota exhausted (BE injects header; caller handles via 429 thrown error)
 *  - NOTE upstream wire 是 camelCase (anonQid / imageUrl 不是 anon_qid) · 已遵循 */
export async function analyzeByUrl(
  anonToken: string,
  req: AnalyzeRequest,
): Promise<AnalyzeResponse> {
  return httpJSON<AnalyzeResponse>(`${ANON()}/api/anon/analyze-by-url`, {
    method: 'POST',
    body: req,
    headers: anonHeaders(anonToken),
  });
}

/** GET /api/anon/result/{anonQid} · poll 1Hz, 30s timeout (SC-12-T07)
 *  - upstream真值 "DONE" 视为 READY 同义 (callers do `status === 'READY' || status === 'DONE'`) */
export async function getResult(
  anonToken: string,
  anonQid: number,
): Promise<ResultResponse> {
  return httpJSON<ResultResponse>(`${ANON()}/api/anon/result/${anonQid}`, {
    method: 'GET',
    headers: anonHeaders(anonToken),
  });
}

/** POST /api/anon/claim · 双 JWT (X-Anon-Token + Authorization: Bearer student JWT) (SC-12-T08) */
export async function claim(
  anonToken: string,
  studentJwt: string,
  req: ClaimRequest,
): Promise<ClaimResponse> {
  return httpJSON<ClaimResponse>(`${ANON()}/api/anon/claim`, {
    method: 'POST',
    body: req,
    headers: anonHeaders(anonToken, { Authorization: `Bearer ${studentJwt}` }),
  });
}

/**
 * Upload binary file to MinIO via presigned PUT URL.
 * Pattern mirrors pages/capture/index.ts: wx.uploadFile WRAPS body in multipart,
 * which breaks MinIO presigned-PUT signature. We read the temp file into
 * ArrayBuffer and PUT it raw via wx.request with the exact Content-Type.
 *
 * In test runtime (Node), wx is undefined → we POST via fetch with raw body
 * (mp.mockWxMethod stubs in e2e will intercept anyway).
 */
export async function putToMinio(
  uploadUrl: string,
  tempFilePath: string,
  mime: string,
): Promise<void> {
  const g = globalThis as { wx?: WxAPI };
  if (typeof g.wx === 'undefined') {
    // Node test runtime · best-effort no-op (e2e mp.mockWxMethod stubs cover this)
    return;
  }
  const wx = g.wx;
  const fileBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath: tempFilePath,
      success: (res: { data: ArrayBuffer }) => resolve(res.data),
      fail: (err: { errMsg: string }) => reject(new Error(`readFile failed: ${err.errMsg}`)),
    });
  });
  await new Promise<void>((resolve, reject) => {
    wx.request({
      url: uploadUrl,
      method: 'PUT',
      data: fileBuffer,
      header: { 'Content-Type': mime },
      success: (res: { statusCode: number; data: unknown }) => {
        if (res.statusCode >= 200 && res.statusCode < 400) resolve();
        else reject(new Error(`PUT failed: ${res.statusCode} ${JSON.stringify(res.data)}`));
      },
      fail: (err: { errMsg: string }) => reject(new Error(err.errMsg)),
    });
  });
}

interface WxAPI {
  request: (opts: {
    url: string;
    method?: string;
    data?: unknown;
    header?: Record<string, string>;
    success?: (res: { statusCode: number; data: unknown }) => void;
    fail?: (err: { errMsg: string }) => void;
  }) => void;
  getFileSystemManager: () => {
    readFile: (opts: {
      filePath: string;
      success?: (res: { data: ArrayBuffer }) => void;
      fail?: (err: { errMsg: string }) => void;
    }) => void;
  };
}
