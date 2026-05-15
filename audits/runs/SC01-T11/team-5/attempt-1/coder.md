# Coder 工作日志 · SC01-T11 · P08 揭示答案

## 1. 地形侦察

- 完整读 `.harness/agents/coder-agent.md` (铁律 7 条 + 执行流程 7 步)
- 完整读 `.harness/inflight/SC01-T11.json` (context + sandbox ports + AC1-AC4 + TI1-TI4)
- 完整读 `.harness/agents/SHARED-E2E-PROTOCOL.md` (DoR C-1..C-6 + 三轴隔离)
- 完整读 `design/mockups/wrongbook/08_review_exec.html` (287 行 DOM+CSS)
- 完整读 `design/system/pages/P08-review-exec.spec.md` (§5 API + §6 状态机 + §9 异常 + §13 testid)
- 完整读 `frontend/FRONTEND_GUIDANCE.md` + `backend/BACKEND_GUIDANCE.md`

### 已有代码 (branch 已有 2 commits):
- `292518e` feat(SC01-T11): P08 reveal flow — backend fix + frontend page + API client
- `84ce7d5` test(SC01-T11): Playwright E2E + backend IT for reveal flow

### 标杆模板:
- Backend: `ReviewPlanController.java` existing endpoints (open/grade) 作为 reveal endpoint 标杆
- Frontend: `08_review_exec.html` mockup 作为 1:1 视觉标杆

## 2. 编码

### Bug 修复: CSS/DOM 未对齐 mockup
发现已有实现使用 Tailwind-style 颜色 (#dc2626, #fef2f2 等) 和简化 DOM, 与 mockup 的 iOS 系统颜色和复杂 DOM 结构严重不一致。

修复内容:
1. **CSS 颜色全量替换**: 使用 mockup 精确的 CSS 变量值
   - `--red:#FF3B30` (原 #dc2626), `--green:#34C759` (原 #10b981)
   - `--indigo:#5856D6` (原 #4f46e5), `--orange:#FF9500` (原 #ea580c)
   - Chip 背景: `rgba(255,59,48,0.12)` 等 (原 #fef2f2 等)
   - Reveal card: 白底+绿边 gradient (原纯色 #ecfdf5)
   - Grade buttons: gradient 背景+圆形图标 (原平坦按钮)

2. **DOM 结构重写**: 严格 1:1 mirror mockup
   - Nav: `.nav > .back + .center + .close + .ptrack` (原 `.topbar > .topbarLeft + .closeBtn`)
   - Reveal card: `.reveal > .revealHead > .revealHeadL(.revealIco + .revealTtl) + .revealSub` (原 `.revealCard > .revealCardHeader`)
   - Answer box: `.ans > .ansK + .ansV` (原单个 `.revealAnswer` 文本)
   - Steps: `.stp > .stpN(.indigo bg) + .stpT` (原 `.revealStep > .revealStepNum(.green bg)`)
   - Grade buttons: `.rating > .rtitle + .ractions > .rbtn > .ri + .rl + .rs` (原 `.gradeButtons > button 文本`)
   - Memory curve: inline `.nodeDot + .nodeLine` alternating (原 flex column with ::after pseudo)

3. **Viewport 修复**: Playwright config `devices['Desktop Chrome']` 覆盖了移动 viewport
   - 显式设置 `viewport: { width: 393, height: 852 }` 匹配 mockup phone frame

4. **新增文件**:
   - `frontend/apps/h5/src/vite-env.d.ts` — CSS module 类型声明

### 关键 commits:
- `dcba9ca` fix(SC01-T11): 1:1 mockup-aligned CSS/DOM + mobile viewport + 4-state baselines

## 3. 真实 E2E

### 环境:
- team-5 sandbox: PG 15436 (healthy) · Redis 16383 (healthy) · MinIO 9008 (healthy)
- Backend: `mvn spring-boot:run --server.port=8085 --spring.datasource.url=jdbc:postgresql://localhost:15436/wrongbook`
- Frontend: Vite dev server at http://localhost:5174 (proxy `/api/review → localhost:8085`)
- 需手动 seed `review_plan` 表 (id=1, student_id=7, node_index=2)

### Playwright E2E (6/6 PASS):
```
✓ happy path · tap reveal → POST /reveal 200 → 答案卡展开 + grade buttons enabled (902ms)
✓ AC3 · memory curve current T node visible + pulse after reveal (486ms)
✓ TI1 · reveal request sends no body (readonly lifecycle timestamp) (332ms)
✓ TI2 · reveal response contains only nid + revealedAt (no MQ/outbox fields) (335ms)
✓ spec §9 · reveal 502 → UI still expands answer card (eventually consistent) (477ms)
✓ UI structure · topbar + progress + meta + question hero all visible (271ms)
```
产物路径: `audits/runs/SC01-T11/team-5/attempt-1/test-reports/e2e/coder/playwright/run.log`

### Backend IT (10/10 BUILD SUCCESS):
```
Tests run: 10, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```
产物路径: `audits/runs/SC01-T11/team-5/attempt-1/test-reports/e2e/coder/backend-it/verify.log`

### 截图证据:
- idle-baseline.png / idle-actual.png / idle-diff.png
- uploading-baseline.png / uploading-actual.png / uploading-diff.png
- success-baseline.png / success-actual.png / success-diff.png
- error-baseline.png / error-actual.png / error-diff.png
路径: `audits/runs/SC01-T11/team-5/attempt-1/test-reports/e2e/coder/screenshots/` (16 张)

### spec-trace 对照表:

| testid | §5 API | §6/§9 状态机 | assertion 行号 |
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
| AC2: POST /reveal → 200 | ✓ | E2E happy path test:118 status=200 |
| AC3: 绿色展开 300ms + 3 步 + pulse | ✓ | CSS transition 300ms easeOut + 3 step renders + pulse animation |
| AC4: ANSWERING → REVEALED + buttons | ✓ | E2E test:150-155 forgot/partial enabled, mastered disabled |
| TI1: reveal 不改 plan | ✓ | E2E test:196-198 empty POST body |
| TI2: reveal 不发 MQ | ✓ | E2E test:216-217 no outbox fields |
| TI3: mastered disabled after reveal | ✓ | E2E test:155 disabled assertion |
| TI4: 埋点 wb_exec_reveal | ✓ | track() call in handleReveal() |
| Mockup 1:1 CSS/DOM | ✓ | All iOS colors + mockup DOM structure |
| E2E 6/6 PASS | ✓ | run.log in test-reports/ |
| Backend IT BUILD SUCCESS | ✓ | verify.log in test-reports/ |
| 4 态截图 × 3 张 = 12+ | ✓ | 16 .png in screenshots/ |

## 5. 提交

### Git commits:
- `292518e` feat(SC01-T11): P08 reveal flow — backend fix + frontend page + API client
- `84ce7d5` test(SC01-T11): Playwright E2E + backend IT for reveal flow
- `dcba9ca` fix(SC01-T11): 1:1 mockup-aligned CSS/DOM + mobile viewport + 4-state baselines

### 落盘文件:
- `audits/runs/SC01-T11/team-5/attempt-1/coder.md` (本文件)
- `audits/runs/SC01-T11/team-5/attempt-1/bugs-found.md`
- `audits/runs/SC01-T11/team-5/attempt-1/test-reports/e2e/coder/playwright/{index.html,results.xml,run.log}`
- `audits/runs/SC01-T11/team-5/attempt-1/test-reports/e2e/coder/backend-it/{verify.log,failsafe-xml/*.xml}`
- `audits/runs/SC01-T11/team-5/attempt-1/test-reports/e2e/coder/screenshots/{idle,uploading,success,error}-{baseline,actual,diff}.png`
- `audits/runs/SC01-T11/team-5/attempt-1/test-reports/e2e/coder/spec-trace.md`
- `audits/runs/SC01-T11/team-5/attempt-1/test-reports/e2e/coder/env-snapshot.md`
