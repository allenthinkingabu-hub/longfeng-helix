/**
 * file-service API client · MP
 * POST /api/file/presign → { upload_url, file_key, image_url }
 * 用 httpJSON (wx.request MP runtime / fetch test runtime)
 */
import { httpJSON, apiBase } from './_http';

export interface PresignRequest {
  mime: string;
  size: number;
  filename: string;
}

export interface PresignResponse {
  upload_url: string;
  file_key: string;
  image_url: string;
}

export async function presign(req: PresignRequest): Promise<PresignResponse> {
  return httpJSON<PresignResponse>(`${apiBase('file')}/api/file/presign`, {
    method: 'POST',
    body: req,
  });
}
