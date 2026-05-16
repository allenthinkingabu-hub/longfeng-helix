/**
 * file-service API client · MP
 * POST /api/file/presign → { upload_url, file_key, image_url }
 * 用 httpJSON (wx.request MP runtime / fetch test runtime)
 *
 * Backend requires the `X-Idempotency-Key` header (PresignController AC6) and
 * returns an ApiResult envelope with snake_case body
 * `{ url, image_url, method, object_key, expires_in_sec }`. This client maps
 * the response into the FE-facing shape `{ upload_url, file_key, image_url }`
 * that capture/index.ts consumes.
 */
import { httpJSON, apiBase } from './_http';

export interface PresignRequest {
  mime: string;
  size: number;
  filename: string;
  /** Required by backend (PresignController AC6). Callers must generate one. */
  idempotencyKey: string;
  /** Optional SHA-256 hex content fingerprint. */
  sha256?: string;
}

export interface PresignResponse {
  upload_url: string;
  file_key: string;
  image_url: string;
}

interface PresignBackendBody {
  url: string;
  image_url?: string;
  method?: string;
  object_key: string;
  expires_in_sec?: number;
}

export async function presign(req: PresignRequest): Promise<PresignResponse> {
  const body: Record<string, unknown> = {
    filename: req.filename,
    // Backend accepts both `mime`/`size` (JsonAlias) and `content_type`/`bytes`.
    // Send snake_case canonical names so we don't depend on alias parsing.
    content_type: req.mime,
    bytes: req.size,
  };
  if (req.sha256) body.sha256_hash = req.sha256;

  const data = await httpJSON<PresignBackendBody>(
    `${apiBase('file')}/api/file/presign`,
    {
      method: 'POST',
      body,
      headers: { 'X-Idempotency-Key': req.idempotencyKey },
    },
  );

  return {
    upload_url: data.url,
    file_key: data.object_key,
    image_url: data.image_url ?? '',
  };
}
