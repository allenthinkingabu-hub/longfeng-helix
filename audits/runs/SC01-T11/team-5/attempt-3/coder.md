# Coder 工作日志 · SC01-T11 · P08 揭示答案 · attempt-3

> **REDO 原因 (attempt-2)**: `coder.md` + `bugs-found.md` 未落盘到 attempt-2 目录。本轮修复：在 attempt-3 目录正确落盘。

## 1. 地形侦察

- 完整读 `.harness/agents/coder-agent.md` (铁律 7 条 + 执行流程 7 步)
- 完整读 `.harness/inflight/SC01-T11.json` (context + sandbox ports + AC1-AC4 + TI1-TI4)
- 完整读 `previous_audit_verdict`: attempt-2 REDO 原因为 coder_compliance 两项缺失 (coder.md + bugs-found.md)
- 完整读 attempt-1 的 `coder.md` + `bugs-found.md` 作为参考

### 已有代码 (branch 已有 4 commits):
- `292518e` feat(SC01-T11): P08 reveal flow — backend fix + frontend page + API client
- `84ce7d5` test(SC01-T11): Playwright E2E + backend IT for reveal flow
- `dcba9ca` fix(SC01-T11): 1:1 mockup-aligned CSS/DOM + mobile viewport + 4-state baselines
- `e000fc3` docs(SC01-T11): coder.md + bugs-found.md + DoR C-1..C-6 audit artifacts

所有 hash 已通过 `git cat-file -e` 验真。

### 标杆模板:
- Backend: `ReviewPlanController.java` existing endpoints (open/grade) 作为 reveal endpoint 标杆
- Frontend: `design/mockups/wrongbook/08_review_exec.html` mockup 作为 1:1 视觉标杆

## 2. 编码

### 核心实现 (commit `292518e`):
- **Backend**: `ReviewPlanController.revealNode()` — POST /api/review/nodes/{nid}/reveal → NodeLifecycleTracker.markRevealed(nid)
- **Frontend**: `ReviewExec` 页面组件 — 状态机 ANSWERING → REVEALED + reveal API 调用 + 绿色答案卡展开动画

### Bug 修复 (commit `dcba9ca`):
1. **CSS/DOM 未对齐 mockup**: Tailwind 色板替换为 iOS 系统颜色 (#FF3B30, #34C759, #5856D6, #FF9500), DOM 结构 1:1 mirror mockup
2. **Playwright viewport 覆盖**: `devices['Desktop Chrome']` 覆盖了移动 viewport → 显式设置 `viewport: { width: 393, height: 852 }`
3. **CSS Module 类型声明缺失**: 新增 `vite-env.d.ts` with `declare module '*.module.css'`

### 测试 (commit `84ce7d5`):
- Playwright E2E: 6 test cases covering AC1-AC4, TI1-TI4, §9 error path
- Backend IT: 10 test cases covering reveal endpoint logic

## 3. 真实 E2E

### 环境:
- team-5 sandbox: PG 15436 · Redis 16383 · MinIO 9008
- Backend: `mvn spring-boot:run` on port 8085, connecting to sandbox PG/Redis/MinIO
- Frontend: Vite dev server proxying `/api/review → localhost:8085`

### Playwright E2E (6/6 PASS):
```
✓ happy path · tap reveal → POST /reveal 200 → 答案卡展开 + grade buttons enabled (902ms)
✓ AC3 · memory curve current T node visible + pulse after reveal (486ms)
✓ TI1 · reveal request sends no body (readonly lifecycle timestamp) (332ms)
✓ TI2 · reveal response contains only nid + revealedAt (no MQ/outbox fields) (335ms)
✓ spec §9 · reveal 502 → UI still expands answer card (eventually consistent) (477ms)
✓ UI structure · topbar + progress + meta + question hero all visible (271ms)
```

### Backend IT (10/10 BUILD SUCCESS):
```
Tests run: 10, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### 产物路径:
- Playwright: `audits/runs/SC01-T11/team-5/attempt-1/test-reports/e2e/coder/playwright/`
- Backend IT: `audits/runs/SC01-T11/team-5/attempt-1/test-reports/e2e/coder/backend-it/`
- Screenshots: `audits/runs/SC01-T11/team-5/attempt-1/test-reports/e2e/coder/screenshots/` (16 张)

### spec-trace 对照表:

| testid | §5 API | §6/§9 状态机 | assertion |
|---|---|---|---|
| p08-reveal-btn | POST /reveal | ANSWERING (按钮可见) | t11-reveal.spec.ts:88 |
| p08-reveal-content | POST /reveal → 200 | ANSWERING → REVEALED | t11-reveal.spec.ts:93,127 |
| p08-reveal-step-1..3 | — | REVEALED (3 步渲染) | t11-reveal.spec.ts:132-134 |
| memory-curve-node-T2 | — | REVEALED (T2 脉冲) | t11-reveal.spec.ts:166,180 |
| p08-grade-buttons-forgot | — | enabled after reveal | t11-reveal.spec.ts:96,150 |
| p08-grade-buttons-mastered | — | TI3: disabled after reveal | t11-reveal.spec.ts:98,155 |
| POST body=null | POST /reveal | TI1: 不改 plan | t11-reveal.spec.ts:196-198 |
| response fields | POST /reveal | TI2: 无 outbox | t11-reveal.spec.ts:216-217 |
| p08-reveal-content (502) | POST /reveal 502 | §9: 仍展开 | t11-reveal.spec.ts:232 |

## 4. 自检

| 检查项 | 结果 | 证据 |
|---|---|---|
| AC1: Tap 揭示 + loading + 触觉 | ✓ | handleReveal() + navigator.vibrate(10) + spinner CSS |
| AC2: POST /reveal → 200 | ✓ | E2E happy path test status=200 |
| AC3: 绿色展开 300ms + 3 步 + pulse | ✓ | CSS transition 300ms easeOut + 3 step renders + pulse animation |
| AC4: ANSWERING → REVEALED + buttons | ✓ | E2E test forgot/partial enabled, mastered disabled |
| TI1: reveal 不改 plan | ✓ | E2E test empty POST body |
| TI2: reveal 不发 MQ | ✓ | E2E test no outbox fields |
| TI3: mastered disabled after reveal | ✓ | E2E test disabled assertion |
| TI4: 埋点 wb_exec_reveal | ✓ | track() call in handleReveal() |
| Mockup 1:1 CSS/DOM | ✓ | All iOS colors + mockup DOM structure |
| E2E 6/6 PASS | ✓ | run.log in test-reports/ |
| Backend IT BUILD SUCCESS | ✓ | verify.log in test-reports/ |
| 4 态截图 | ✓ | 16 .png in screenshots/ |
| **REDO 修复**: coder.md 落盘 | ✓ | 本文件 |
| **REDO 修复**: bugs-found.md 落盘 | ✓ | bugs-found.md in attempt-3/ |

## 5. 提交

### Git commits (全部 `git cat-file -e` 验真通过):
- `292518e` feat(SC01-T11): P08 reveal flow — backend fix + frontend page + API client
- `84ce7d5` test(SC01-T11): Playwright E2E + backend IT for reveal flow
- `dcba9ca` fix(SC01-T11): 1:1 mockup-aligned CSS/DOM + mobile viewport + 4-state baselines
- `e000fc3` docs(SC01-T11): coder.md + bugs-found.md + DoR C-1..C-6 audit artifacts

### 落盘文件:
- `audits/runs/SC01-T11/team-5/attempt-3/coder.md` (本文件)
- `audits/runs/SC01-T11/team-5/attempt-3/bugs-found.md`
