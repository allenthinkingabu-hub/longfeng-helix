// ============================================================================
// share.ts · zod contract for GET /api/share/:shareToken (SC-13)
// ============================================================================
// Source of truth:
//   biz §10.9 · 分享令牌接口契约
//   biz §2A.3.2 P-SHARED 规格卡 (字段白名单 · 脱敏边界)
//   backend/anonymous-service/.../dto/ShareDto.java (实现方 SoT)
// Owner microservice: anonymous-service (port 8090)
//
// 字段白名单铁律 (SC-13 第一红线):
//   wire shape 永远只有 5 顶级字段 · 严禁 relation_id / sharer_student_id /
//   student_email / original_image_url 出现. zod schema 用 .strict() 守护
//   "drift = parse fail" 而非 silent ignore.
// ============================================================================

import { z } from 'zod';

/**
 * Masked payload — 4 字段白名单. backend ShareTokenService.buildMaskedPayload()
 * 拼装. 前端拿不到原 relation_id / questionId / 原图 URL.
 */
export const MaskedPayloadSchema = z
  .object({
    /** 题干前 12 字明文 · 后面 'XXXX' mask · 永不下发完整原文 */
    stemSnippet: z.string(),
    /** 前 2 个知识点名 · 余下被锁 */
    kpVisible: z.array(z.string()),
    /** 剩余知识点数 · 用户登录后才能解锁 */
    kpLockedCount: z.number().int().nonnegative(),
    /** 原图是否磨砂 · true=显示 lock 遮罩 */
    imgThumbBlurred: z.boolean(),
  })
  .strict();
export type MaskedPayload = z.infer<typeof MaskedPayloadSchema>;

/**
 * GET /api/share/:shareToken response — 5 字段白名单.
 *
 * 失败态 (410 / 403 / 404) 不走这个 schema · 走 ShareErrorSchema.
 */
export const ShareResponseSchema = z
  .object({
    /** EXAM_DAY / QUESTION / REVIEW_NODE */
    type: z.enum(['EXAM_DAY', 'QUESTION', 'REVIEW_NODE']),
    /** "Z***" — 单字符首 + 3 ★ · 不下发真姓名/student_id */
    sharerNickMasked: z.string(),
    /** 剩余秒数 · 由 expires_at - now() 算出 */
    ttlSec: z.number().int().nonnegative(),
    /** HS256 验签结果 · 走到 200 必为 true */
    signatureValid: z.boolean(),
    /** 脱敏 payload */
    maskedPayload: MaskedPayloadSchema,
  })
  .strict();
export type ShareResponse = z.infer<typeof ShareResponseSchema>;

/**
 * 错误响应 (410 TOKEN_EXPIRED / 403 TOKEN_REVOKED / 404 TOKEN_INVALID).
 */
export const ShareErrorSchema = z
  .object({
    code: z.enum(['TOKEN_EXPIRED', 'TOKEN_REVOKED', 'TOKEN_INVALID']),
    message: z.string(),
  })
  .strict();
export type ShareError = z.infer<typeof ShareErrorSchema>;
