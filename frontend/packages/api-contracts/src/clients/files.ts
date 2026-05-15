// SC-01-T01 · file-service presign + upload + complete typed client
// Backend mount: /api/file (PresignController) + /api/file/complete (wb_file status update)
// Vite proxy: /api/file → localhost:8084 (file-service)
// Idempotency-Key MUST be sent as HTTP header X-Idempotency-Key per
// design/system/pages/P02-capture.spec.md §5 + backend PresignController AC6.
import type { PresignResponse, FileCompleteResponse } from '../types';

const BASE_PATH = '/api/file';

/** Shared auth header builder (mirrors questionsClient pattern). */
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

export const filesClient = {
  /**
   * POST /api/file/presign · generate presigned PUT URL for direct OSS upload.
   *
   * Backend returns ApiResult envelope with snake_case fields:
   *   { code: 0, data: { url, image_url, method, object_key, expires_in_sec } }
   *
   * Client maps to FE PresignResponse:
   *   { upload_url, file_key, ttl_seconds, bucket }
   */
  async presign(vars: {
    mime: string;
    size: number;
    filename?: string;
    sha256?: string;
    idempotencyKey?: string;
  }): Promise<PresignResponse> {
    const headers = readAuthHeader();
    if (vars.idempotencyKey) {
      headers['X-Idempotency-Key'] = vars.idempotencyKey;
    }

    const body: Record<string, unknown> = {
      filename: vars.filename || 'upload.jpg',
      content_type: vars.mime,
      bytes: vars.size,
    };
    if (vars.sha256) body.sha256_hash = vars.sha256;

    const res = await fetch(`${BASE_PATH}/presign`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err: unknown = await res.json().catch(() => ({
        code: 'PRESIGN_FAIL',
        message: res.statusText,
      }));
      throw err;
    }
    const json = await res.json();
    // Unwrap ApiResult envelope if present
    const data =
      json && typeof json === 'object' && 'data' in json && 'code' in json
        ? (json as { data: Record<string, unknown> }).data
        : (json as Record<string, unknown>);

    // Map backend field names → FE PresignResponse
    return {
      upload_url: data.url as string,
      file_key: data.object_key as string,
      image_url: (data.image_url as string) ?? '',
      ttl_seconds: data.expires_in_sec as number,
      bucket: 'wrongbook-dev',
    };
  },

  /**
   * PUT {presignedUrl} · direct binary upload to MinIO/OSS.
   * No auth header needed — presigned URL carries its own signature.
   */
  async directUpload(uploadUrl: string, file: File): Promise<void> {
    // Rewrite absolute MinIO/OSS URLs to relative /s3/ proxy path to avoid CORS.
    // e.g. http://localhost:9000/wrongbook-dev/path?sig=... → /s3/wrongbook-dev/path?sig=...
    let url = uploadUrl;
    try {
      const parsed = new URL(uploadUrl);
      if (parsed.port === '9000' || parsed.hostname.includes('minio')) {
        url = `/s3${parsed.pathname}${parsed.search}`;
      }
    } catch { /* keep original URL if parse fails */ }

    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!res.ok) {
      throw new Error(`Direct upload failed: ${res.status} ${res.statusText}`);
    }
  },

  /**
   * POST /api/file/complete/{objectKey} · mark wb_file as UPLOADED after PUT succeeds.
   *
   * Backend returns ApiResult<{ status, file_key }>.
   */
  async complete(fileKey: string): Promise<FileCompleteResponse> {
    const res = await fetch(`${BASE_PATH}/complete?key=${encodeURIComponent(fileKey)}`, {
      method: 'POST',
      headers: readAuthHeader(),
    });
    if (!res.ok) {
      const err: unknown = await res.json().catch(() => ({
        code: 'COMPLETE_FAIL',
        message: res.statusText,
      }));
      throw err;
    }
    const json = await res.json();
    const data =
      json && typeof json === 'object' && 'data' in json && 'code' in json
        ? (json as { data: FileCompleteResponse }).data
        : (json as FileCompleteResponse);
    return data;
  },
};
