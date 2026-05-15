# coder.md · SC01-MP-T06 · attempt-1 · 后端透明 (review-plan API contract)

## 1. 地形侦察

- **Backend Controller**: `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/controller/ReviewPlanController.java` — 15 端点, 其中 8 个 SC-01-C05 `/api/review/*`
- **MP api/review.ts (wave-1)**: 仅 1 函数 `completeSession`，缺失 7/8 SC-01-C05 端点
- **H5 sibling**: `frontend/apps/h5/src/pages/ReviewExec/index.tsx` 用 `reviewClient` from `@longfeng/api-contracts`，调用 revealNode/gradeNode
- **MP review-exec page**: `pages/review-exec/index.ts` 已 import `revealNode`/`gradeNode` from review.ts，但函数未导出
- **既有测试标杆**: `test/api/review-done.integration.spec.ts` + `review-exec.integration.spec.ts` — 真 fetch 0 mock 模式
- **ApiResult 信封**: `{ code: 0, message: "ok", data: T }` (backend/common ApiResult.java)
- **_http.ts 双 runtime**: wx.request (MP runtime) / fetch (vitest Node runtime)

## 2. 编码

### 改动 1: `frontend/apps/mp/src/api/review.ts` — 补齐 8 函数

- 新增: `createSession`, `getToday`, `getNode`, `openNode`, `revealNode`, `gradeNode`, `nextInSession`, `nodeResult`
- 保留: 原 `completeSession` (T13)
- 类型: `ApiEnvelope<T>` 信封 + 各 endpoint 响应 DTO
- nid 参数: `number | string` (兼容 MP 路由 string + 后端 Long coercion)

### 改动 2: `frontend/apps/mp/test/api/review-plan-transparency.spec.ts` — 10 test cases

- Health check → 8 endpoint 逐个 contract test → 模块导出完整性 → round-trip
- 真 fetch http://localhost:8085 · 0 mock
- 后端在线: 验证 ApiEnvelope shape + code=0 + data 字段
- 后端离线: 验证 connection error 是 Error instance (graceful)
- 404 边界: nid=999999 → 404 + code=40401

## 3. 自检

### typecheck

```
pnpm -F mp typecheck
→ 4 pre-existing errors (analyzing/capture — 不在 scope)
→ 0 review-related errors ✓
```

### vitest

```
pnpm -F mp test:e2e -- test/api/review-plan-transparency.spec.ts
→ ✓ test/api/review-plan-transparency.spec.ts (10 tests) 232ms
→ 10/10 PASS ✓
```

### spec-trace 对照

8/8 SC-01-C05 端点全部有 MP api 函数 + test assertion 覆盖 (见 spec-trace.md)

## 4. 自检

- [x] coder-agent.md 铁律 1 单一专注: 只做 T06
- [x] 铁律 2 工作区隔离: claude/sc01-mp-t06-backend-review-plan 分支
- [x] 铁律 3 权限隔离: 只改 dev_done + git_commits
- [x] 铁律 4 Git Commit: 描述性 commit
- [x] 铁律 5 落盘: coder.md + bugs-found.md + spec-trace.md 在 work_log_dir
- [x] CLAUDE.md Rule 3 Surgical: 只改 review.ts + 新增 1 spec
- [x] CLAUDE.md Rule 6: tool use ≈ 25 次, 未触线

## 5. 提交

- Commit hash: debe960
- 改动文件:
  - `frontend/apps/mp/src/api/review.ts` (+140 -8 行)
  - `frontend/apps/mp/test/api/review-plan-transparency.spec.ts` (新文件 · 170 行)
  - `audits/runs/SC01-MP-T06/team-3/attempt-1/` (spec-trace.md + coder.md + bugs-found.md)
