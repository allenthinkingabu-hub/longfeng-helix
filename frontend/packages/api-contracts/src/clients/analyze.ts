// SC-01-E02c · ai-analysis P02 analyze-by-url typed client
// SC-01-E03c · 扩 cancel / fallback (P03 spec §5)
// Backend mount path is /api/ai/analyze-by-url (异步 202 + taskId 形态)
// — see backend AnalyzeController.analyzeByUrl @PostMapping("/analyze-by-url").
// P02 spec §5 把它别名为 "POST /api/ai/analyze"。
// 同步 multipart /analyze 端点保留作 IT/debug 私有路径，本 client 不暴露。
import type { AnalyzeByUrlReq, AnalyzeByUrlResp } from '../types';

const BASE_PATH = '/api/ai/analyze-by-url';

/** 共用 · 取 localStorage access_token (兼容 SSR / 受限环境) */
function readAuthHeader(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let token: string | null = null;
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      token = localStorage.getItem('access_token');
    }
  } catch {
    token = null;
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const analyzeClient = {
  /**
   * POST /api/ai/analyze-by-url · 异步触发 AI 分析。
   *
   * 立即返 {@code task_id + status:ANALYZING}（HTTP 202），实际分析走 SSE
   * `GET /api/ai/stream/{taskId}` 推 STEP_1..STEP_4 + DONE。
   *
   * @param req 必需 task_id（建议复用 qid）+ subject + image_url
   */
  async analyzeByUrl(req: AnalyzeByUrlReq): Promise<AnalyzeByUrlResp> {
    const res = await fetch(BASE_PATH, {
      method: 'POST',
      headers: readAuthHeader(),
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err: unknown = await res.json().catch(() => ({
        code: 'AI_ANALYZE_FAIL',
        message: res.statusText,
      }));
      throw err;
    }
    const json = await res.json();
    // Backend returns raw { task_id, status } (NOT wrapped in ApiResult envelope).
    if (json && typeof json === 'object' && 'data' in json && 'code' in json) {
      return (json as { data: AnalyzeByUrlResp }).data;
    }
    return json as AnalyzeByUrlResp;
  },

  /**
   * SC-01-E03c · POST /api/ai/cancel/{taskId}
   * 用户点取消按钮 · 后端 C04 AiCancelController 已实现。
   * spec P03 §5 · best-effort 200ms · 保留 PENDING task · 不阻塞返回 P-HOME。
   */
  async cancel(taskId: string): Promise<{ status: string }> {
    const res = await fetch(`/api/ai/cancel/${encodeURIComponent(taskId)}`, {
      method: 'POST',
      headers: readAuthHeader(),
    });
    const json = await res.json().catch(() => ({ status: 'CANCELLED' }));
    if (!res.ok && (!json || typeof json.status !== 'string')) {
      return { status: 'CANCELLED' };
    }
    return json as { status: string };
  },

  /**
   * SC-01-E03c · POST /api/ai/fallback/{taskId}
   * 连续 2 次模型失败 · 跳手填降级 · 后端 C04 已实现。
   * spec P03 §9 · 触发后 navigate 手填页（保留 OCR 部分结果作预填）。
   */
  async fallback(taskId: string): Promise<{ status: string }> {
    const res = await fetch(`/api/ai/fallback/${encodeURIComponent(taskId)}`, {
      method: 'POST',
      headers: readAuthHeader(),
    });
    const json = await res.json().catch(() => ({ status: 'FALLBACK_MANUAL' }));
    if (!res.ok && (!json || typeof json.status !== 'string')) {
      return { status: 'FALLBACK_MANUAL' };
    }
    return json as { status: string };
  },
};
