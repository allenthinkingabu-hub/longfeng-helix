// ============================================================================
// SC-00-T01 · resolve-entry.ts · 决策树骨架前端 dispatch
// ============================================================================
// Source of truth:
//   biz §2A.3.1 (line 245-300) 决策节点细则表 · 3 节点
//   biz §2B.1a (line 773-822) SC-00 卡 · 关键断言点
//   biz §10.6  (line 2164-2175) POST /api/session/resolve 接口契约
//   zod  frontend/packages/api-contracts/src/session-resolve.ts
//
// 关键技术决策 (TL brief · 不可妥协):
//   (a) JWT secret HS256 不放前端 · 仅 jose.decodeJwt 解 payload + 手工 exp/iss/aud 检查
//       前端可伪造 JWT 但后端任意 API 调用就 reject (signature 验签红线)
//   (b) URL path '/s/:token' 或 '/observer/:code' → 本地 JWT 不优先, 走后端决策树
//   (c) BootstrapGate 只在 path='/' / '/home' / '/auth/login' 时 await resolveEntry()
//       其他 deeplink (如 /question/123) 跳过 — 防内部跳转再触 resolve 死循环
// ============================================================================

import { decodeJwt } from 'jose';
import {
  ResolveResponseSchema,
  type ResolveDecision,
  type ResolveResponse,
} from '@longfeng/api-contracts';
import { getOrCreateDeviceFp } from './device-fp';
import { detectEntrySource } from './entry-source';

/** Issuer + audience constants — must match auth-service application.yml. */
const JWT_ISS = 'longfeng';
const JWT_AUD = 'h5';

/** Local-storage key for the cached JWT (written by /api/auth/login). */
const JWT_STORAGE_KEY = 'jwt';

/** ms · 7d ·  offline tolerance window — biz §2A.3.1 patch (stale JWT 仍归 HOME) */
const OFFLINE_STALE_TOLERANCE_MS = 7 * 24 * 60 * 60 * 1000;

/** Fetch timeout (ms) for /api/session/resolve. */
const RESOLVE_FETCH_TIMEOUT_MS = 5000;

export interface ResolveOutcome {
  /** Decision from local pre-judge or backend response. */
  verdict: ResolveDecision;
  /** Target route to {@code router.replace} after bootstrap. */
  dispatchTo: string;
  /** Raw backend response when consulted; null when decided locally. */
  raw?: ResolveResponse;
}

/**
 * Entry point of the H5 app bootstrap.
 *
 * Algorithm (biz §2A.3.1):
 *   1. If URL path is '/s/:token' or '/observer/:code' → skip local pre-judge,
 *      always POST /api/session/resolve so backend reads share_token / observer_invite
 *   2. Else if localStorage.jwt is valid (decode + exp/iss/aud check) → HOME (no resolve call)
 *   3. Else → POST /api/session/resolve · honour returned decision
 *   4. On fetch failure (offline / 5xx): stale JWT (≤7d expired) → HOME · else → LANDING
 */
export async function resolveEntry(): Promise<ResolveOutcome> {
  const url = new URL(window.location.href);
  const path = url.pathname;

  // ── Step 1 · Deeplink override · share or observer URL forces backend decision ──
  const shareMatch = /^\/s\/([^/]+)/.exec(path);
  const observerMatch = /^\/observer\/([^/]+)/.exec(path);
  const forceBackend = Boolean(shareMatch || observerMatch);

  // ── Step 2 · Local JWT pre-judge (skip when deeplink forces backend) ──
  if (!forceBackend) {
    const localJwt = readLocalJwt();
    if (localJwt && isLocallyValid(localJwt)) {
      return { verdict: 'HOME', dispatchTo: '/home' };
    }
  }

  // ── Step 3 · Backend resolve ──
  const shareToken = shareMatch ? shareMatch[1] : undefined;
  const observerCode = observerMatch ? observerMatch[1] : undefined;
  try {
    const resolved = await callResolve({
      deviceFp: getOrCreateDeviceFp(),
      entrySource: detectEntrySource(),
      shareToken,
      observerCode,
    });
    return { verdict: resolved.decision, dispatchTo: dispatchPath(resolved.decision, { path, shareToken, observerCode }), raw: resolved };
  } catch (err) {
    // ── Step 4 · Offline degrade ──
    // eslint-disable-next-line no-console
    console.warn('[bootstrap] resolve failed, falling back', err);
    const localJwt = readLocalJwt();
    if (localJwt && isWithinStaleTolerance(localJwt)) {
      return { verdict: 'HOME', dispatchTo: '/home' };
    }
    return { verdict: 'LANDING', dispatchTo: '/welcome' };
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function readLocalJwt(): string | null {
  try {
    return localStorage.getItem(JWT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Local "is this JWT still good?" check — NO signature verify, just claims. */
function isLocallyValid(jwt: string): boolean {
  try {
    // SC-00 Tester ADV-4 fix: jose.decodeJwt only validates the payload segment.
    // A tampered header (e.g. `GARBAGE!eyJhbGc...`) sneaks through and falsely
    // grants HOME access. We add a header sanity check (alg=HS256 only) — still
    // no signature verify (HS256 secret never leaves the back-end), but it
    // forces the header to at least be base64-decodable JSON with the expected
    // algorithm. Real signature rejection still happens server-side on every
    // authenticated API call.
    const parts = jwt.split('.');
    if (parts.length !== 3) return false;
    let header: Record<string, unknown>;
    try {
      const headerJson = Buffer.from(parts[0], 'base64').toString('utf-8');
      header = JSON.parse(headerJson);
    } catch {
      try {
        // Browser path: use atob with base64url → base64 fixup
        const b64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64.length % 4;
        const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
        header = JSON.parse(globalThis.atob(padded));
      } catch {
        return false;
      }
    }
    if (header.alg !== 'HS256') return false;

    const payload = decodeJwt(jwt);
    if (typeof payload.exp !== 'number') return false;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSec) return false;
    if (payload.iss !== JWT_ISS) return false;
    // aud may be string or string[] in JWT spec
    const aud = payload.aud;
    const audOk = Array.isArray(aud) ? aud.includes(JWT_AUD) : aud === JWT_AUD;
    if (!audOk) return false;
    return true;
  } catch {
    return false;
  }
}

/** "Stale but tolerable" — JWT expired within the last 7d → still treat device as known. */
function isWithinStaleTolerance(jwt: string): boolean {
  try {
    const payload = decodeJwt(jwt);
    if (typeof payload.exp !== 'number') return false;
    const expiredMsAgo = Date.now() - payload.exp * 1000;
    return expiredMsAgo > 0 && expiredMsAgo <= OFFLINE_STALE_TOLERANCE_MS;
  } catch {
    return false;
  }
}

interface ResolveBody {
  deviceFp: string;
  entrySource: string;
  shareToken?: string;
  observerCode?: string;
}

async function callResolve(body: ResolveBody): Promise<ResolveResponse> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), RESOLVE_FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch('/api/session/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`resolve ${resp.status}`);
    const json = (await resp.json()) as unknown;
    const parsed = ResolveResponseSchema.safeParse(json);
    if (!parsed.success) {
      // eslint-disable-next-line no-console
      console.error('[bootstrap] resolve schema mismatch', parsed.error);
      throw new Error('SCHEMA_MISMATCH');
    }
    return parsed.data;
  } finally {
    window.clearTimeout(timer);
  }
}

interface DispatchCtx {
  path: string;
  shareToken?: string;
  observerCode?: string;
}

function dispatchPath(decision: ResolveDecision, ctx: DispatchCtx): string {
  switch (decision) {
    case 'HOME':
      return '/home';
    case 'LOGIN': {
      const redirect = encodeURIComponent(
        window.location.pathname + window.location.search,
      );
      return `/auth/login?redirect=${redirect}`;
    }
    case 'SHARED':
      // Preserve the original deeplink so P-SHARED can read :token
      return ctx.path.startsWith('/s/') ? ctx.path : `/s/${ctx.shareToken ?? 'unknown'}`;
    case 'OBSERVER':
      return ctx.path.startsWith('/observer/')
        ? ctx.path
        : `/observer/${ctx.observerCode ?? 'unknown'}`;
    case 'WELCOME_BACK':
      return '/welcome-back';
    case 'LANDING':
    default:
      return '/welcome';
  }
}
