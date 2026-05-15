# SC01-T10 · Coder Work Log · attempt-1

## 1. 地形侦察

**读取的文件**:
- `.harness/agents/coder-agent.md` — 铁律 5+2 条 + 执行流程 7 步
- `.harness/agents/SHARED-E2E-PROTOCOL.md` — DoR C-1..C-6
- `.harness/inflight/SC01-T10.json` — task context + sandbox ports
- `design/system/pages/P07-review-today.spec.md` — P07 完整 spec (§1-§15)
- `design/system/pages/P08-review-exec.spec.md` — P08 完整 spec (§1-§15)
- `design/mockups/wrongbook/07_review_today.html` — P07 mockup (227 行)
- `design/mockups/wrongbook/08_review_exec.html` — P08 mockup (287 行)

**标杆对齐**:
- 参考 `frontend/apps/h5/src/pages/ReviewExec/index.tsx` (T11 已合 P08 组件)
- 参考 `frontend/apps/h5/src/pages/ReviewDone/index.tsx` (P09 组件结构)
- 参考 `frontend/apps/h5/tests/e2e/sc-01/t11-reveal.spec.ts` (E2E 模式)
- 参考 `frontend/packages/api-contracts/src/clients/review.ts` (API client 模式)
- 参考 `frontend/packages/testids/src/index.ts` (testid 命名约定)

**发现**:
- 后端 `POST /nodes/{nid}/open` 已在 ReviewPlanController.java L214-219 实现
- NodeLifecycleTracker + outbox EVENT_OPENED 已就绪
- P08 页面已存在 (T11 已合) 但初始状态为 ANSWERING 而非 READING
- P07 页面不存在 · 需新建
- App.tsx 缺少 P07/P08/P09 路由 (可能在 -X ours merge 中丢失)
- vite.config.ts 缺少 `/api/review` 代理到 review-plan-service:8085

## 2. 编码

**修改的文件** (6 个新建 + 4 个修改):

| 文件 | 变更 | 说明 |
|---|---|---|
| `frontend/apps/h5/src/pages/ReviewToday/index.tsx` | **新建** +224 行 | P07 页面组件 · 1:1 mockup mirror · Hero + slot list + CTA |
| `frontend/apps/h5/src/pages/ReviewToday/ReviewToday.module.css` | **新建** +290 行 | P07 CSS module · 1:1 mockup 样式 |
| `frontend/apps/h5/src/pages/ReviewExec/index.tsx` | **修改** | 添加 READING 初始状态 + canvas touch → ANSWERING + exit confirm sheet |
| `frontend/apps/h5/src/pages/ReviewExec/ReviewExec.module.css` | **修改** +50 行 | 添加 exit confirm sheet 样式 |
| `frontend/apps/h5/src/App.tsx` | **修改** | 添加 /review-today, /review/exec/:nid, /review/done 路由 |
| `frontend/apps/h5/vite.config.ts` | **修改** +4 行 | 添加 /api/review → 8085 代理 |
| `frontend/packages/api-contracts/src/clients/review.ts` | **修改** +22 行 | 添加 getToday() + createSession() 方法 |
| `frontend/packages/api-contracts/src/types.ts` | **修改** +30 行 | 添加 TodayResp + TodaySlot + TodaySlotItem 类型 |
| `frontend/apps/h5/tests/e2e/sc-01/t10-target-to-exec.spec.ts` | **新建** +340 行 | Playwright E2E 9 tests |

**AC 覆盖**:
- AC1 ✅ Tap item → loading overlay + 触觉 vibrate(15)
- AC2 ✅ POST /api/review/nodes/{nid}/open → 200 (stub in E2E · backend 已实现)
- AC3 ✅ P07→P08 跳转 · topbar cursor + progress bar + meta chips + question hero 渲染
- AC4 ✅ READING (初始) → ANSWERING (canvas onMouseDown/onTouchStart)
- AC5 ✅ × 按钮 → exit confirm sheet · 取消回 P08 · 退出导航回首页

## 3. 真实 E2E

**E2E 脚本**: `frontend/apps/h5/tests/e2e/sc-01/t10-target-to-exec.spec.ts`

**运行环境**:
- Playwright headed + chromium
- Vite dev server http://localhost:5174
- POST /nodes/{nid}/open stub via page.route (backend 已实现 · E2E 用 stub 保证隔离)
- docker: team-4-pg:15435 + team-4-redis:16382 + team-4-minio:9006 (all healthy)

**结果**: 9/9 PASS (6.8s)

| # | 测试名 | 状态 | 耗时 |
|---|---|---|---|
| 1 | P07 Hero card + stats + progress visible | ✅ PASS | 884ms |
| 2 | P07 slot headers + item cards visible | ✅ PASS | 536ms |
| 3 | AC1+AC2+AC3 tap item → POST /open 200 → P08 renders | ✅ PASS | 708ms |
| 4 | AC3 CTA "全部开始" → POST /open → P08 | ✅ PASS | 629ms |
| 5 | AC4 READING → ANSWERING (canvas touch) | ✅ PASS | 630ms |
| 6 | AC5 exit confirm sheet → cancel → back to P08 | ✅ PASS | 820ms |
| 7 | AC5 exit confirm sheet → exit → navigate home | ✅ PASS | 615ms |
| 8 | TI2 reveal content aria-hidden before reveal | ✅ PASS | 542ms |
| 9 | P08 UI structure all elements visible | ✅ PASS | 554ms |

**DoD 三件套**:
- (a) E2E 全绿 raw 报告: `test-reports/e2e/coder/playwright/run.log` + `results.xml` + `index.html`
- (b) 截图 4 态: `test-reports/e2e/coder/screenshots/` (p07-idle, p08-reading, p08-answering, p08-exit-confirm)
- (c) spec trace 对照表: `test-reports/e2e/coder/spec-trace.md` (18 行 testid/API/状态机追溯)

## 4. 自检

| 检查项 | 结果 |
|---|---|
| TypeScript 无新增错误 | ✅ 我的文件无 TS 错误 (预存错误来自其他 task 的 test 文件) |
| testid 全挂载 (P07 + P08) | ✅ p07-root, today-review-card 等 21 个 + p08 全部 |
| Playwright E2E 9/9 PASS | ✅ |
| VRT toHaveScreenshot 4 态 | ✅ p07-idle, p08-reading, p08-answering, p08-exit-confirm |
| AC1-AC5 全覆盖 | ✅ |
| TI1-TI4 覆盖 | ✅ TI2 (aria-hidden) + TI4 (reading VRT) 直接测试 · TI1/TI3 由后端/T11 覆盖 |
| work_log 落盘 | ✅ coder.md + bugs-found.md |

## 5. 提交

Git commits 见 `git_commits` 数组。
