/**
 * wrongbook-service API client · MP
 * POST /api/wb/questions → { qid }
 * 用 httpJSON (wx.request MP runtime / fetch test runtime)
 */
import { httpJSON, apiBase } from './_http';

export interface CreateQuestionReq {
  studentId: number;
  subject: string;
  image_key: string;
  mime: string;
  source_type: number;
}

export interface CreateQuestionResp {
  qid: string;
}

export async function createQuestion(
  req: CreateQuestionReq,
): Promise<CreateQuestionResp> {
  return httpJSON<CreateQuestionResp>(`${apiBase('wb')}/api/wb/questions`, {
    method: 'POST',
    body: req,
  });
}
