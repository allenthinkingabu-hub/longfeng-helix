/**
 * SC-11 landing API · 调 anonymous-service :8090
 * 文档: design/system/pages/P-LANDING-landing.spec.md §5
 * 后端: SC-11-T01 已落 · /api/landing/samples + /api/landing/kpi
 *       backend/anonymous-service/.../LandingController.java
 *
 * Wire shape 与 backend DTO 字符级对齐 (LandingSampleDto + LandingKpiDto)：
 *   GET /api/landing/samples?bucket=default|variant_b
 *     → 200 [{ subject, stemText, knowledgePoints[], errorReason, correction }]
 *   GET /api/landing/kpi
 *     → 200 { cumulativeQuestions, dailyAnalyses, happyUsers }
 *
 * NOTE on inflight spec 字段名漂移 (2026-05-18 surface · CLAUDE.md Rule 7+12):
 *   inflight 写 {totalStudents, totalQuestions, avgImproveRate} ·
 *   后端真返 {cumulativeQuestions, dailyAnalyses, happyUsers} ·
 *   按"读代码 + 真后端 wire shape > inflight 描述" 采纳真后端。
 *   (api-contracts zod LandingKpiSchema 同源 · 见 packages/api-contracts/src/landing.ts)
 *
 * 错误降级: throw HTTP error · page 用 LOADING/READY/DEGRADED-samples 状态机吞 (spec §6)
 */
import { httpJSON, apiBase } from './_http';

/** 1 个样例题卡 · 与 LandingSampleDto wire shape 对齐 */
export interface LandingSample {
  subject: string;
  stemText: string;
  knowledgePoints: string[];
  errorReason: string;
  correction: string;
}

/** GET /api/landing/samples 返回 = LandingSample[] (数组, 非 envelope · 见后端 §10.7 注) */
export type SamplesResponse = LandingSample[];

/** GET /api/landing/kpi 返回 = LandingKpi · 与 LandingKpiDto wire shape 对齐 */
export interface KpiResponse {
  cumulativeQuestions: number;
  dailyAnalyses: number;
  happyUsers: number;
}

/**
 * GET /api/landing/samples?bucket=<key>
 *
 * @param bucket A/B 桶 key · 'default' | 'variant_b' · 未知 fallback default (后端语义)
 * @throws HTTP <status> · page 应 catch → 切 DEGRADED-samples 状态
 */
export async function getSamples(bucket?: string): Promise<SamplesResponse> {
  const qs = bucket ? `?bucket=${encodeURIComponent(bucket)}` : '';
  return httpJSON<SamplesResponse>(`${apiBase('anon')}/api/landing/samples${qs}`);
}

/**
 * GET /api/landing/kpi
 * @throws HTTP <status> · page 应 catch → 切 DEGRADED-kpi (kpi 失败不阻塞 samples 渲染)
 */
export async function getKpi(): Promise<KpiResponse> {
  return httpJSON<KpiResponse>(`${apiBase('anon')}/api/landing/kpi`);
}
