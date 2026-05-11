// SC-01-E02b · wrongbook P02 createPending typed client
// Backend mount path is /api/wb/questions (NOT /api/v1/...) — see backend
// QuestionDetailController.java @RequestMapping("/api/wb/questions").
// Idempotency-Key MUST be sent as HTTP header X-Idempotency-Key per
// design/system/pages/P02-capture.spec.md §5 + backend dto/CreateQuestionReq.java.
import type { CreateQuestionReq, CreateQuestionResp } from '../types';

const BASE_PATH = '/api/wb/questions';

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

    const res = await fetch(BASE_PATH, {
      method: 'POST',
      headers,
      body: JSON.stringify(req),
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
};
