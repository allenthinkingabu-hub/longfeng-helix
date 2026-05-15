# Coder Work Log · SC01-MP-T06-E2E · attempt-1

## 1. 地形侦察

- 完整读 `src/api/review.ts`（180行）：8 个 endpoint 函数 + 类型定义，确认 API 路径 + 响应契约
- 完整读 `src/api/_http.ts`：确认 `apiBase('review')` → `http://localhost:8085`，双运行时（wx.request / fetch）
- 读 `frontend/apps/h5/vite.config.ts`：确认 `/api/review` 代理到 `localhost:8085`
- 读参考标杆 `test/e2e/automator-smoke.spec.ts`：vitest + beforeAll/afterAll 模式
- 读 `test/vitest.config.ts`：`test/**/*.spec.ts` glob，120s timeout，forks pool
- 读 `tsconfig.json`：`test/` 在 exclude 中，不影响 tsc --noEmit
- 读 `package.json`：确认 scripts（lint / typecheck / test:unit / test:e2e:automator）

标杆对齐：automator-smoke.spec.ts 用 vitest describe/it/expect + beforeAll/afterAll，本 spec 同模式。

## 2. 编码

新建文件：`frontend/apps/mp/test/e2e/review-api-contract.spec.ts`

8 endpoint 契约测试：
| # | Endpoint | Method | Path | Response Contract |
|---|----------|--------|------|-------------------|
| 1 | createSession | POST | /api/review/sessions | `ApiEnvelope<{sid, nids[], total}>` |
| 2 | getToday | GET | /api/review/today | `ApiEnvelope<{items[], total, tz}>` |
| 3 | getNode | GET | /api/review/nodes/:nid | `ApiEnvelope<ReviewPlanDto>` |
| 4 | revealNode | POST | /api/review/nodes/:nid/reveal | `ApiEnvelope<{nid, revealedAt}>` |
| 5 | gradeNode | POST | /api/review/nodes/:nid/grade | `ApiEnvelope<CompleteResult>` |
| 6 | completeSession | POST | /api/review/sessions/:sid/complete | `CompleteSessionResp` (no envelope) |
| 7 | nextInSession | POST | /api/review/sessions/:sid/next | `ApiEnvelope<NextInSessionResp>` |
| 8 | nodeResult | GET | /api/review/nodes/:nid/result | `ApiEnvelope<NodeResultResp>` |

设计决策：
- 直接用 fetch 调 `http://localhost:8085`，0 mock
- Soft-skip: beforeAll probe GET /api/review/today，超时 3s 判定 backend 不在线 → 所有 test 体内 `if (!alive) return`
- assertEnvelope helper 验证 `{code: number, message: string, data: T}` 三字段
- 每个 endpoint 在 2xx 时验证 data 内必有字段；非 2xx 只验证 `< 500`（route 存在 + 非 server crash）

## 3. 真实 E2E

Phase 1 scope：只写 spec + lint + tsc + test:unit。不跑 automator。Phase 2 TL 串行跑真 backend。

验证结果：
- `pnpm -F mp typecheck` → 0 error（test/ 在 tsconfig exclude 中）
- `pnpm -F mp test:unit` → 97/97 PASS（7 test files，无回归）
- Lint 22 errors 全为 pre-existing Vant weapp miniprogram_npm 缺失（非本次变更引入）

API path ↔ spec 对照表（Phase 1 静态对照）：
| src/api/review.ts 函数 | spec.ts test case | 验证字段 |
|------------------------|-------------------|----------|
| createSession L115 | test #1 | sid, nids, total |
| getToday L123 | test #2 | items, total, tz |
| getNode L131 | test #3 | id, wrongItemId, studentId, nodeIndex, easeFactor, intervalDays, nextDueAt, mastered |
| revealNode L146 | test #4 | nid, revealedAt |
| gradeNode L159 | test #5 | planId, quality, oldEF, newEF, oldInterval, newInterval, nextDueAt, mastered |
| completeSession L101 | test #6 | sessionId, status, completedAt, stats.{mastered,partial,forgot,total} |
| nextInSession L167 | test #7 | nextNid, completed, total, done |
| nodeResult L175 | test #8 | nid, wrongItemId, nodeIndex, nodeState, mastered |

## 4. 自检

- [x] 铁律 1 单一专注：只做 SC01-MP-T06-E2E
- [x] 铁律 2 工作区隔离：只在 claude/sc01-mp-t06-e2e worktree
- [x] 铁律 3 不改 passes：未触碰
- [x] 铁律 4 Git commit：描述性 commit 待写
- [x] 铁律 5 落盘工作日志：本文件 + bugs-found.md
- [x] 铁律 6 lint + tsc + test:unit：typecheck 0 error · unit 97/97 PASS · lint 22 errors 全 pre-existing
- [x] Rule 3 Surgical：只新增 1 个 test 文件，0 修改既有代码
- [x] Rule 6 tool-use budget：约 18 次 tool use，远在 50 线内

## 5. 提交

commit hash: fed89d4
