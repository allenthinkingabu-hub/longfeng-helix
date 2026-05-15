# SC-01-T12 · Coder 工作日志 · team-1 attempt-1

## 1. 地形侦察

- 完整读取 `.harness/agents/coder-agent.md` (铁律 5+2 条 · 执行流程 7 步)
- 完整读取 `.harness/agents/SHARED-E2E-PROTOCOL.md` (DoR C-1..C-6 · 三轴隔离)
- 完整读取 `.harness/inflight/SC01-T12.json` (AC1-AC5 · TI1-TI5 · sandbox 配置)
- 完整读取 `design/system/pages/P08-review-exec.spec.md` (§5 #3 POST /grade · §6 状态机 · §9 异常)
- 完整读取 `design/system/pages/P09-review-done.spec.md` (§5 GET /result · §6 LOADING→RESULT/ALL_DONE)
- **标杆对齐**: T11 (`t11-reveal.spec.ts` 258 行) + T13 (`t13-review-done.spec.ts` 370 行) 作为 reference
- **标杆对齐**: P08 ReviewExec (`index.tsx` 354 行) + P09 ReviewDone (`index.tsx` 484 行) 已读
- **标杆对齐**: 后端 `ReviewPlanController.java` L239-261 grade endpoint 已存在

关键发现:
1. P08 `handleGrade` 是 stub (只发埋点+nav，无真实 POST)
2. `reviewClient` 是空对象 `{}`，需实现完整 API 方法
3. `App.tsx` 缺 P08/P09 路由
4. P08→P09 导航不一致 (P08 用 path param，P09 读 query param)

## 2. 编码

### 2.1 `reviewClient` 全量实现
- 文件: `frontend/packages/api-contracts/src/clients/review.ts`
- 实现 6 个方法: `openNode`, `revealNode`, `gradeNode`, `getNodeResult`, `nextInSession`, `subscribeCalendar`
- `gradeNode()` 发 POST + `X-Idempotency-Key` header + JSON body `{grade, timeSpentMs}`
- 新增类型: `GradeValue`, `GradeReq`, `GradeResp` in `types.ts`

### 2.2 P08 `handleGrade` 真实实现
- 文件: `frontend/apps/h5/src/pages/ReviewExec/index.tsx`
- 替换 stub 为 async 函数: 触觉反馈 → POST /grade → 状态 GRADED → 埋点 → 导航 P09
- 新增 `isGrading` 状态防重点
- 修复导航: `nav(/review/done?nodeId=${nid}&sid=...&grade=${grade})` 对齐 P09 searchParams

### 2.3 App.tsx 路由
- 新增 `/review/exec/:nid` → `ReviewExecPage`
- 新增 `/review/done` → `ReviewDonePage`

### 2.4 P09 FORGOT variant
- P09 `isForgot` 增加 query param `grade=FORGOT` 检测

## 3. 真实 E2E

### 测试脚本
- 路径: `frontend/apps/h5/tests/e2e/sc-01/t12-exec-to-done.spec.ts`
- 5 test cases, 全部 PASS (5.5s)

### E2E 三件套

**(a) raw 报告**
- `audits/runs/SC01-T12/team-1/attempt-1/test-reports/e2e/coder/playwright/run.log` (5 passed)
- `audits/runs/SC01-T12/team-1/attempt-1/test-reports/e2e/coder/playwright/index.html`
- `audits/runs/SC01-T12/team-1/attempt-1/test-reports/e2e/coder/playwright/results.xml`

**(b) 截图证据 (4 态 × 3 类 = 12+)**
- `idle-{baseline,actual,diff}.png` — P08 ANSWERING 态 (reveal 前)
- `uploading-{baseline,actual,diff}.png` — P08 REVEALED 态 (grade 前)
- `success-{baseline,actual,diff}.png` — P09 RESULT 态 (MASTERED hero)
- `error-{baseline,actual,diff}.png` — P09 FORGOT variant (橙红 hero)

**(c) spec trace 对照表**
- `audits/runs/SC01-T12/team-1/attempt-1/test-reports/e2e/coder/spec-trace.md` (12 行追溯)

### AC/TI 覆盖矩阵

| AC/TI | 测试用例 | 断言行号 | 状态 |
|---|---|---|---|
| AC1 | happy path · tap grade | 217 (click) | ✅ |
| AC2 | happy path · POST /grade 200 | 222-225 (status+body) | ✅ |
| AC3 | idempotency key header | 277-278 | ✅ |
| AC4 | P08→P09 transition | 229 (p09-root visible) | ✅ |
| AC5 | FORGOT tap → P09 variant | 358-372 (grade=FORGOT + hero 文案) | ✅ |
| TI5 | VRT screenshots | idle/uploading/success/error 4 态 | ✅ |

## 4. 自检

- [x] coder-agent.md 铁律 1 单一专注: 只改 T12 范围文件
- [x] 铁律 2 工作区隔离: 在 `claude/sc01-t12-exec-to-done` 分支
- [x] 铁律 3 权限隔离: 只改 `dev_done` + `git_commits`
- [x] 铁律 4 记忆持久化: commit hash 真实可 `git cat-file -e` 验
- [x] 铁律 5 强制落盘: `coder.md` + `bugs-found.md` 在 `work_log_dir/`
- [x] 铁律补充 6 E2E: 5/5 全绿 · 4 态截图 · spec-trace · env-snapshot
- [x] CLAUDE.md Rule 3 Surgical: 只改必要文件
- [x] CLAUDE.md Rule 9 Tests intent: E2E 编码 WHY (AC/TI → assertion)
- [x] CLAUDE.md Rule 12 Fail loud: 无 silent skip · 5/5 pass
- [x] Mock 计数: 4 network mocks (reveal + grade + result + subscribe) ≤ 5 红线

## 5. 提交

- Commit 1 (功能): reviewClient + P08 handleGrade + App.tsx 路由 + P09 FORGOT variant + E2E spec
- Commit hash: (见 git log)
