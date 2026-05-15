# Coder Work Log · SC01-MP-T06-E2E · attempt-3

## 1. 地形侦察

- **Task kind**: api-only · 写 review API contract E2E spec（Phase 1 只写 spec + lint + tsc + test:unit）
- **Previous REDO reason (attempt-2)**: `coder.md` 和 `bugs-found.md` 缺失 → attempt-3 的首要修复目标
- **标杆模板**: `frontend/apps/mp/test/e2e/automator-smoke.spec.ts`（vitest + automator 结构）
- **已有代码**: commit `fed89d4` 已落地 `review-api-contract.spec.ts`（9 endpoints · fetch direct to :8085 · soft-skip health）
- **Scope**: 写 E2E spec 文件，不修改现有 page 代码，不跑 automator（Phase 2 TL 负责）

## 2. 编码

E2E spec 已在 attempt-1 commit `fed89d4` 中完成，attempt-2 由 Tester 补充了 #9 openNode endpoint（commit `cf001af`）。本 attempt-3 的 coder phase 重点是**修复 audit REDO**——补齐 attempt-3 work_log_dir 下的 `coder.md` + `bugs-found.md`。

spec 文件: `frontend/apps/mp/test/e2e/review-api-contract.spec.ts`
- 9 endpoints: createSession / getToday / getNode / revealNode / gradeNode / completeSession / nextInSession / nodeResult / openNode
- 0 mock · 全部 fetch direct to `http://localhost:8085`
- soft-skip: health probe 失败时优雅跳过（Phase 1 不要求后端在线）
- envelope assertion helper 统一验证 `{ code, message, data }` 结构

## 3. 真实 E2E

Phase 1 scope 限定：只写 spec + lint + tsc + test:unit，不跑 automator。

**lint**: `pnpm -F mp lint` → 0 errors（node lint.mjs + tsc --noEmit）
**test:unit**: `pnpm -F mp test:unit` → 97/97 PASS（7 test files）

### Spec ↔ API trace 对照表

| # | Endpoint | Method | Path | spec.ts line | Assertion |
|---|----------|--------|------|-------------|-----------|
| 1 | createSession | POST | /api/review/sessions | L81-102 | envelope + sid + nids[] + total |
| 2 | getToday | GET | /api/review/today | L105-121 | envelope + items[] + total + tz |
| 3 | getNode | GET | /api/review/nodes/:nid | L124-143 | envelope + ReviewPlanDto 8 fields |
| 4 | revealNode | POST | /api/review/nodes/:nid/reveal | L146-160 | envelope + nid + revealedAt |
| 5 | gradeNode | POST | /api/review/nodes/:nid/grade | L163-184 | envelope + CompleteResult 8 fields |
| 6 | completeSession | POST | /api/review/sessions/:sid/complete | L187-212 | sessionId + status + completedAt + stats |
| 7 | nextInSession | POST | /api/review/sessions/:sid/next | L215-234 | envelope + nextNid + completed + total + done |
| 8 | nodeResult | GET | /api/review/nodes/:nid/result | L237-261 | envelope + 5 required + 7 nullable fields |
| 9 | openNode | POST | /api/review/nodes/:nid/open | L264-276 | envelope + null data |

## 4. 自检

- [x] `pnpm -F mp lint` → 0 errors
- [x] `pnpm -F mp test:unit` → 97/97 PASS
- [x] spec 文件存在: `frontend/apps/mp/test/e2e/review-api-contract.spec.ts`
- [x] 0 mock keywords
- [x] coder.md 落盘 (本文件)
- [x] bugs-found.md 落盘
- [x] Previous REDO reason 已修复: attempt-2 缺失的 coder.md + bugs-found.md → attempt-3 补齐

## 5. 提交

- `fed89d4` — feat(SC01-MP-T06-E2E): review API contract E2E spec · 8 endpoints · fetch direct to :8085 · soft-skip health
- `cf001af` — test(SC01-MP-T06-E2E): tester PASS · add openNode #9 + nodeResult full fields · passes=true
- attempt-3 work_log commit hash: (本次 commit)
