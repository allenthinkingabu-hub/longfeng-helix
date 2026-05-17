// ============================================================================
// session-resolve.ts · zod contract for POST /api/session/resolve
// ============================================================================
// Source of truth: biz/业务与技术解决方案_AI错题本_基于日历系统.md §10.6
// Owner microservice: anonymous-service (port 8090)
//
// This file is the **type-level contract** between H5/MP frontend and the
// (forthcoming) Java POST /api/session/resolve endpoint. Real backend impl
// lives in SC-00-T02; this PHASE-A-ANON skeleton task only publishes the
// zod schema so frontend code can `import { ResolveRequestSchema } from
// '@longfeng/api-contracts'` and start integrating against a stable shape.
// ============================================================================

import { z } from 'zod';

/**
 * Decision tree node 6 outcomes (biz §2A.3.1 + §10.6).
 * - HOME           student is already logged in with a valid JWT → straight to P-HOME
 * - LANDING        no session / fresh device → render P-LANDING (anonymous CTA page)
 * - SHARED         entered via valid share_token → render P-SHARED-WALL with masked context
 * - OBSERVER       parent/teacher came in via observer invite code → P-OBSERVER-HOME
 * - WELCOME_BACK   device_fp soft-bound to a previous student → P-WELCOMEBACK (P1)
 * - LOGIN          forced login wall (e.g. share_token expired, observer revoked)
 */
export const ResolveDecisionSchema = z.enum([
  'HOME',
  'LANDING',
  'SHARED',
  'OBSERVER',
  'WELCOME_BACK',
  'LOGIN',
]);
export type ResolveDecision = z.infer<typeof ResolveDecisionSchema>;

/**
 * Request body for POST /api/session/resolve.
 * deviceFp     — required IndexedDB + Canvas + UA composite fingerprint
 * entrySource  — ad / qr / share / direct (where the user came from)
 * shareToken   — optional JWT jti when the URL carries a share link
 * observerCode — optional 6-char invite code for parent/teacher entry
 */
export const ResolveRequestSchema = z.object({
  deviceFp: z.string().min(1, 'deviceFp must not be empty'),
  entrySource: z.string().min(1, 'entrySource must not be empty'),
  shareToken: z.string().optional(),
  observerCode: z.string().optional(),
});
export type ResolveRequest = z.infer<typeof ResolveRequestSchema>;

/**
 * Optional context payload when decision === 'SHARED'.
 * Masked so the unauthenticated viewer never sees raw sharer identity.
 */
export const ShareContextSchema = z.object({
  shareType: z.enum(['EXAM_DAY', 'QUESTION', 'REVIEW_NODE']),
  maskedSharerName: z.string().optional(),
  allowClaim: z.boolean(),
  expiresAt: z.string(), // ISO 8601
});
export type ShareContext = z.infer<typeof ShareContextSchema>;

/**
 * Optional context payload when decision === 'OBSERVER'.
 */
export const ObserverContextSchema = z.object({
  role: z.enum(['PARENT', 'TEACHER']),
  studentMaskedName: z.string(),
  expiresAt: z.string(), // ISO 8601 — PARENT 30d / TEACHER 90d
});
export type ObserverContext = z.infer<typeof ObserverContextSchema>;

/**
 * Response from POST /api/session/resolve. Exactly one of the optional
 * context blocks is populated when decision implies that flavour:
 *   SHARED   → shareContext
 *   OBSERVER → observerContext
 *   WELCOME_BACK → maskedAccount (e.g. "t****@example.com")
 *   HOME / LANDING / LOGIN → all three undefined
 */
export const ResolveResponseSchema = z.object({
  decision: ResolveDecisionSchema,
  maskedAccount: z.string().optional(),
  shareContext: ShareContextSchema.optional(),
  observerContext: ObserverContextSchema.optional(),
});
export type ResolveResponse = z.infer<typeof ResolveResponseSchema>;
