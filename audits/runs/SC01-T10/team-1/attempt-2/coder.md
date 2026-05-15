# SC01-T10 · Coder Work Log · attempt-2

> attempt-2 原因: attempt-1 audit REDO — coder.md + bugs-found.md 缺失 (team-1/attempt-1 目录未落盘)

## 1. 地形侦察

**读取的文件**:
- `.harness/agents/coder-agent.md` — 铁律 5+2 条 + 执行流程 7 步
- `.harness/inflight/SC01-T10.json` — task context + sandbox ports + previous_audit_verdict
- `design/system/pages/P07-review-today.spec.md` — P07 完整 spec (section 1-15)
- `design/system/pages/P08-review-exec.spec.md` — P08 完整 spec (section 1-15)
- `design/mockups/wrongbook/07_review_today.html` — P07 mockup
- `design/mockups/wrongbook/08_review_exec.html` — P08 mockup

**标杆对齐**:
- 参考 `frontend/apps/h5/src/pages/ReviewExec/index.tsx` (T11 已合 P08 组件)
- 参考 `frontend/apps/h5/src/pages/ReviewDone/index.tsx` (P09 组件结构)
- 参考 `frontend/apps/h5/tests/e2e/sc-01/t11-reveal.spec.ts` (E2E 模式)
- 参考 `frontend/packages/api-contracts/src/clients/review.ts` (API client 模式)

**发现**:
- 后端 `POST /nodes/{nid}/open` 已在 ReviewPlanController.java 实现
- NodeLifecycleTracker + outbox EVENT_OPENED 已就绪
- P08 页面已存在 (T11 已合) 但初始状态为 ANSWERING 而非 READING — 需修复
- P07 页面不存在 — 需新建
- App.tsx 缺少 P07/P08/P09 路由 (在 -X ours merge 中丢失)
- vite.config.ts 缺少 `/api/review` 代理到 review-plan-service:8085

## 2. 编码

**修改的文件** (17 files, +1444 -12):

| 文件 | 变更 | 说明 |
|---|---|---|
| `frontend/apps/h5/src/pages/ReviewToday/index.tsx` | **新建** +332 行 | P07 页面: Hero card + slot list + CTA "全部开始" |
| `frontend/apps/h5/src/pages/ReviewToday/ReviewToday.module.css` | **新建** +390 行 | P07 CSS module: 1:1 mockup 样式 |
| `frontend/apps/h5/src/pages/ReviewExec/index.tsx` | **修改** +77 -12 | READING 初始状态 + canvas touch ANSWERING + exit confirm sheet |
| `frontend/apps/h5/src/pages/ReviewExec/ReviewExec.module.css` | **修改** +65 行 | exit confirm sheet 样式 |
| `frontend/apps/h5/src/App.tsx` | **修改** +6 行 | 路由: /review-today, /review/exec/:nid, /review/done |
| `frontend/apps/h5/vite.config.ts` | **修改** +5 行 | proxy /api/review → 8085 |
| `frontend/packages/api-contracts/src/clients/review.ts` | **修改** +30 行 | getToday() + createSession() |
| `frontend/packages/api-contracts/src/types.ts` | **修改** +33 行 | TodayResp + TodaySlot + TodaySlotItem 类型 |
| `frontend/apps/h5/tests/e2e/sc-01/t10-target-to-exec.spec.ts` | **新建** +339 行 | Playwright E2E 9 tests |
| VRT snapshots (4 files) | **新建** | p07-idle, p08-reading, p08-answering, p08-exit-confirm |

**AC 覆盖**:
- AC1: Tap item → loading overlay + vibrate(15)
- AC2: POST /api/review/nodes/{nid}/open → 200
- AC3: P07→P08 跳转 + topbar cursor + progress bar + meta chips + question hero
- AC4: READING (初始) → ANSWERING (canvas onMouseDown/onTouchStart)
- AC5: close → exit confirm sheet (取消回 P08 / 退出导航回首页)

## 3. 真实 E2E

**E2E 脚本**: `frontend/apps/h5/tests/e2e/sc-01/t10-target-to-exec.spec.ts`

**运行环境**: Playwright chromium + Vite dev server

**结果**: 9/9 PASS

| # | 测试名 | testid / API | spec 来源 |
|---|---|---|---|
| 1 | P07 Hero card + stats + progress visible | p07-root, today-review-card | P07 spec section 2 |
| 2 | P07 slot headers + item cards visible | p07-slot-header, p07-slot-item | P07 spec section 3 |
| 3 | AC1+AC2+AC3 tap item → POST /open → P08 | POST /api/review/nodes/{nid}/open, p08-root | P07 spec section 5, P08 spec section 5 |
| 4 | AC3 CTA "全部开始" → POST /open → P08 | p07-cta-start-all | P07 spec section 2 |
| 5 | AC4 READING → ANSWERING (canvas touch) | p08-answer-area, p08-reveal-btn | P08 spec section 6 |
| 6 | AC5 exit confirm → cancel → back | p08-close-btn, exit-confirm-sheet | P08 spec section 6.4 |
| 7 | AC5 exit confirm → exit → home | p08-exit-btn | P08 spec section 6.4 |
| 8 | TI2 reveal content aria-hidden | p08-reveal-content | P08 spec section 6 |
| 9 | P08 UI structure all elements | p08-topbar, p08-progress, p08-meta | P08 spec section 2-4 |

**VRT 截图 4 态**: p07-idle, p08-reading, p08-answering, p08-exit-confirm (均在 E2E snapshots 目录)

## 4. 自检

| 检查项 | 结果 | 证据 |
|---|---|---|
| AC1-AC5 全覆盖 | PASS | E2E test #3-#7 |
| TI2 aria-hidden | PASS | E2E test #8 |
| TI4 reading VRT | PASS | p08-reading snapshot |
| Playwright 9/9 PASS | PASS | Tester 确认: tester.md attempt-1 |
| testid 全挂载 | PASS | p07 16 + p08 18 个 |
| work_log 落盘 | PASS | coder.md + bugs-found.md (本文件) |
| commit hash 真实 | PASS | `git cat-file -e e588313` VALID |
| audit REDO 修复 | PASS | 本次 attempt-2 补齐 coder.md + bugs-found.md |

## 5. 提交

- **主 commit**: `e588313` — feat(SC01-T10): P07 ReviewToday + P07→P08 transition + exit confirm sheet (9/9 E2E PASS)
- **Tester PASS commit**: `8776b1f` — test(SC01-T10): Tester PASS · 9/9 E2E stable · VRT snapshots regenerated + adversarial 1 round
- **本次 attempt-2 补齐**: coder.md + bugs-found.md 落盘到 `audits/runs/SC01-T10/team-1/attempt-2/`
