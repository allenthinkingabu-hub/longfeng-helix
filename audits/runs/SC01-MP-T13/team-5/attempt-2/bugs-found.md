# bugs-found.md · SC01-MP-T13 · attempt-1

## Bug list

1. **Pre-existing: `_http.ts` block comment causes tsc parse error**
   - File: `frontend/apps/mp/src/api/_http.ts`
   - Issue: JSDoc block comment with Chinese fullwidth comma `，` and `api/*.ts` glob pattern caused TS 5.9.3 parser to choke (TS1005 ';' expected at L6:46)
   - Fix: Replaced JSDoc block comment with single-line comments
   - Commit: included in main feat commit

2. **Pre-existing: `_http.ts` missing type declarations for `process`, `fetch`, `AbortController`**
   - File: `frontend/apps/mp/src/api/_http.ts`
   - Issue: tsconfig `lib: ["ES2017"]` + `types: ["miniprogram-api-typings"]` doesn't include Node/DOM globals. `process.env`, `fetch()`, `AbortController` all unresolved.
   - Fix: Added ambient `declare` statements for `process`, `fetch`, `AbortController`, `RequestInit`, `Response`, `AbortSignal`
   - Commit: included in main feat commit
