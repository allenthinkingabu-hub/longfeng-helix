// ============================================================================
// landing.ts · zod contract for GET /api/landing/samples + /api/landing/kpi
// ============================================================================
// Source of truth: biz/业务与技术解决方案_AI错题本_基于日历系统.md §10.7
// Owner microservice: anonymous-service (port 8090)
//
// Real backend implementation lives in SC-11-T01. PHASE-A-ANON only publishes
// the zod schema here so P-LANDING (frontend hero page) can start integrating
// against a stable shape.
// ============================================================================

import { z } from 'zod';

/**
 * One sample analysed-question card shown in the P-LANDING "see what AI can
 * do" carousel. Bucket filter is applied server-side (?bucket=middle_school
 * etc.) before this list is returned.
 */
export const LandingSampleSchema = z.object({
  subject: z.string().min(1),
  stemText: z.string().min(1),
  knowledgePoints: z.array(z.string()),
  errorReason: z.string(),
  correction: z.string(),
});
export type LandingSample = z.infer<typeof LandingSampleSchema>;

/**
 * GET /api/landing/samples?bucket=<bucket>
 * Returns an array of canned samples; not a paginated cursor list.
 */
export const LandingSamplesResponseSchema = z.array(LandingSampleSchema);
export type LandingSamplesResponse = z.infer<typeof LandingSamplesResponseSchema>;

/**
 * GET /api/landing/kpi
 * Three headline numbers shown above the hero CTA. All counts are non-negative
 * integers; the backend is allowed to round (e.g. "1.2M cumulative questions").
 */
export const LandingKpiResponseSchema = z.object({
  cumulativeQuestions: z.number().int().nonnegative(),
  dailyAnalyses: z.number().int().nonnegative(),
  happyUsers: z.number().int().nonnegative(),
});
export type LandingKpiResponse = z.infer<typeof LandingKpiResponseSchema>;
