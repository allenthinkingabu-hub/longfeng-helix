# bugs-found.md · SC01-MP-T05 · attempt-1

## Bug 1: _http.ts JSDoc comment prematurely closed by `*/` in glob pattern

- **File**: `frontend/apps/mp/src/api/_http.ts` line 6
- **Description**: The JSDoc block comment contained `api/*.ts` which has `*/` that terminates the comment block prematurely. Everything after it was parsed as code, causing TS1005/TS1434 errors.
- **Fix**: Rewrote the comment to avoid `*/` inside the comment body (`api/ 下业务模块代码相同` instead of `api/*.ts 业务模块代码相同`).
- **Commit**: cd44386

## Bug 2: Missing Node ambient types for dual-runtime _http.ts

- **File**: `frontend/apps/mp/typings/index.d.ts`
- **Description**: `_http.ts` uses `process.env`, `fetch`, `AbortController` for the vitest/Node code path but the MP tsconfig only has `miniprogram-api-typings` (no `@types/node`). This caused TS2591/TS2304 errors on typecheck.
- **Fix**: Added ambient type declarations for `process`, `fetch`, `AbortController`, `AbortSignal`, `setTimeout`, `clearTimeout` in the global typings file.
- **Commit**: cd44386
