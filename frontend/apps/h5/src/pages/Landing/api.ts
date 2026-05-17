// ============================================================================
// SC-11-T01 · Landing api.ts · samples + kpi fetch with zod parse + 5s timeout
// ============================================================================
// Source of truth:
//   biz §10.7 GET /api/landing/samples + GET /api/landing/kpi
//   zod  frontend/packages/api-contracts/src/landing.ts (PHASE-A-ANON 已落地)
//
// Design:
//   - Vite proxy /api/landing → anonymous-service :8090 (vite.config.ts)
//   - Two thin fetch functions exposing typed responses; the page component
//     drives Promise.allSettled to keep partial-degrade state cheap.
//   - 5s timeout via AbortController — beyond that we treat as "samples
//     unavailable" and progress to DEGRADED state (not hard error).
//   - Zod parse is mandatory · any schema drift surfaces immediately, no
//     silent partial render with undefined fields.
// ============================================================================

import {
  LandingSamplesResponseSchema,
  LandingKpiResponseSchema,
  type LandingSamplesResponse,
  type LandingKpiResponse,
} from '@longfeng/api-contracts';

/** ms — keep aligned with biz §2B.12 TTI ≤ 1.0s budget (5s = upper bound). */
const FETCH_TIMEOUT_MS = 5000;

type FetchError = Error & { code?: string };

function timeoutError(): FetchError {
  const e: FetchError = new Error('LANDING_FETCH_TIMEOUT');
  e.code = 'TIMEOUT';
  return e;
}

async function fetchJsonWithTimeout(url: string): Promise<unknown> {
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      const err: FetchError = new Error(`LANDING_HTTP_${resp.status}`);
      err.code = `HTTP_${resp.status}`;
      throw err;
    }
    return await resp.json();
  } catch (err) {
    // AbortError → uniform timeout error so caller doesn't have to inspect names
    if ((err as Error)?.name === 'AbortError') {
      throw timeoutError();
    }
    throw err;
  } finally {
    clearTimeout(handle);
  }
}

/**
 * GET /api/landing/samples?bucket=<key>
 * Returns 3 LandingSample items. Rejection paths:
 *   - timeout (5s) · server 5xx · zod parse failure
 */
export async function fetchSamples(bucket: string): Promise<LandingSamplesResponse> {
  const safeBucket = encodeURIComponent(bucket || 'default');
  const raw = await fetchJsonWithTimeout(`/api/landing/samples?bucket=${safeBucket}`);
  // Zod parse — throws ZodError if shape drifts. Caller treats as REJECT.
  return LandingSamplesResponseSchema.parse(raw);
}

/**
 * GET /api/landing/kpi
 * Returns three non-negative integer counters.
 */
export async function fetchKpi(): Promise<LandingKpiResponse> {
  const raw = await fetchJsonWithTimeout('/api/landing/kpi');
  return LandingKpiResponseSchema.parse(raw);
}
