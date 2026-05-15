// SC-01-E02b · wrongbook P02 createPending typed client
// Backend mount path is /api/wb/questions (NOT /api/v1/...) — see backend
// QuestionDetailController.java @RequestMapping("/api/wb/questions").
// Idempotency-Key MUST be sent as HTTP header X-Idempotency-Key per
// design/system/pages/P02-capture.spec.md §5 + backend dto/CreateQuestionReq.java.
import type {
  CreateQuestionReq,
  CreateQuestionResp,
  QuestionDetailResp,
  SaveQuestionReq,
  SaveQuestionResp,
} from '../types';

const BASE_PATH = '/api/wb/questions';

// Backend uses Jackson snake_case for nested fields; FE consumes camelCase.
// Normalize once at the client boundary (mirrors SC-01-C01 DTO JsonProperty map).
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

export const questionsClient = {
  /**
   * POST /api/wb/questions · create PENDING question + return qid (P02 capture flow).
   * @param req body payload (subject/image_key/mime/student_id)
   * @param idempotencyKey UUID-like client-generated token; on retry the backend
   *   returns the cached qid (TC-01.02 step 4 断点续传 必过).
   */
  async createPending(req: CreateQuestionReq, idempotencyKey: string): Promise<CreateQuestionResp> {
    let token: string | null = null;
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
        token = localStorage.getItem('access_token');
      }
    } catch {
      token = null;
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Map FE camelCase → backend snake_case per QuestionDetailController.CreateQuestionReq
    const body: Record<string, unknown> = {
      student_id: req.studentId,
      subject: req.subject,
    };
    if (req.image_key) body.origin_image_key = req.image_key;
    if (req.mime) body.mime = req.mime;
    if (req.source_type != null) body.source_type = req.source_type;
    if (req.grade_code) body.grade_code = req.grade_code;
    if (req.idempotency_key) body.idempotency_key = req.idempotency_key;

    const res = await fetch(BASE_PATH, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err: unknown = await res.json().catch(() => ({
        code: 'NETWORK',
        message: res.statusText,
      }));
      throw err;
    }
    const json = await res.json();
    // Backend returns raw { qid } (NOT wrapped in ApiResult envelope) — see
    // QuestionDetailController.create() javadoc.
    if (json && typeof json === 'object' && 'data' in json && 'code' in json) {
      return (json as { data: CreateQuestionResp }).data;
    }
    return json as CreateQuestionResp;
  },

  /**
   * GET /api/wb/questions/{qid} · 主聚合接口 (P04 Result)
   * 返回 QuestionDetailResp = { question, plannedNodes }; 字段 snake_case → camelCase
   * 经过本客户端归一（与后端 QuestionDetailDto JsonProperty 一致）。
   * SC-01-E04a · 接 C01。
   */
  async getById(qid: string): Promise<QuestionDetailResp> {
    let token: string | null = null;
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
        token = localStorage.getItem('access_token');
      }
    } catch {
      token = null;
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_PATH}/${encodeURIComponent(qid)}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) {
      const err: unknown = await res.json().catch(() => ({
        code: 'NETWORK',
        message: res.statusText,
      }));
      throw err;
    }
    const raw = await res.json();
    // Some envelopes may wrap with ApiResult { code, data }; unwrap if so.
    const payload =
      raw && typeof raw === 'object' && 'data' in raw && 'code' in raw
        ? (raw as { data: unknown }).data
        : raw;
    return camelize<QuestionDetailResp>(payload);
  },

  /**
   * POST /api/wb/questions/{qid}/save · P04 确认保存 → 触发 plan/nodes 生成 (SC-01-E04c).
   * 后端 SC-01-C02 端点；返回 { qid, planId, nodes[7] }（snake_case 经客户端归一）。
   * P95 ≤ 1000ms（spec §5）；失败由调用方降级为 toast「保存中…稍后自动重试」（outbox 兜底）。
   */
  async save(qid: string, edits?: SaveQuestionReq['edits']): Promise<SaveQuestionResp> {
    let token: string | null = null;
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
        token = localStorage.getItem('access_token');
      }
    } catch {
      token = null;
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const body: SaveQuestionReq = { qid, ...(edits ? { edits } : {}) };
    const res = await fetch(`${BASE_PATH}/${encodeURIComponent(qid)}/save`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
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
    return camelize<SaveQuestionResp>(payload);
  },
};
