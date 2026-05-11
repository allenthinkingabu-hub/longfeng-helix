// S7 · API typed contracts · 手写骨架（后续 openapi-typescript 生成替换）
// 对齐 design/arch/s7-frontend-wrongbook.md §3.1

// ==================== 共享 ====================
export interface Cursor {
  cursor?: string;
  next_cursor?: string;
  has_more?: boolean;
}

export interface ErrorResponse {
  code: string;
  message: string;
  trace_id?: string;
}

// ==================== S3 wrongbook ====================
export type WrongItemStatus = 'pending' | 'analyzing' | 'completed' | 'error';

export interface WrongItemVO {
  id: string;
  subject: string;
  stem_text: string;
  tags: string[];
  status: WrongItemStatus;
  mastery: number; // 0..100
  image_url?: string;
  created_at: string; // ISO 8601
  version: number;
}

export interface WrongItemCreate {
  subject: string;
  stem_text: string;
  tags?: string[];
  image_id?: string; // S6 fileKey
}

export interface WrongItemListParams {
  cursor?: string;
  status?: 'active' | 'mastered';
  subject?: string;
  tags?: string[];
  difficulty?: string;
  limit?: number;
}

export interface WrongItemListResponse extends Cursor {
  items: WrongItemVO[];
}

export interface TagUpdatePayload {
  tags: string[];
  version: number; // If-Match optimistic lock
}

// ==================== S4 ai-analysis ====================
export interface SimilarItem {
  id: string;
  stem_text: string;
  distance: number;
  subject: string;
}

export interface SimilarResponse {
  items: SimilarItem[];
}

// SSE chunk 格式（GET /analysis/{id}）
export interface ExplainChunk {
  chunk: string;
  done?: boolean;
}

// ==================== S6 file-service ====================
export interface PresignRequest {
  mime: string;
  size: number;
  sha256?: string;
}

export interface PresignResponse {
  upload_url: string;
  file_key: string;
  ttl_seconds: number;
  bucket: string;
}

export interface FileCompleteResponse {
  file_key: string;
  status: 'READY' | 'QUARANTINED';
  variant_thumb_key?: string;
  variant_medium_key?: string;
}

// ==================== S3 wrongbook · P02 createPending (POST /api/wb/questions) ====================
// Aligns 1:1 with backend dto/CreateQuestionReq.java (wrongbook-service)
export interface CreateQuestionReq {
  studentId: number;
  subject: string;
  image_key?: string;
  mime?: string;
  grade_code?: string;
  source_type?: number;
  /** body field · authoritative source is the X-Idempotency-Key header (set by client) */
  idempotency_key?: string;
}

export interface CreateQuestionResp {
  qid: string;
}

// ==================== S5 review-plan（readonly）====================
export interface ReviewPlanVO {
  id: string;
  wrong_item_id: string;
  user_id: string;
  node_index: number; // 0..6
  next_due_at: string; // ISO 8601
  mastery: number;
  ease_factor: number;
  interval: number;
}
