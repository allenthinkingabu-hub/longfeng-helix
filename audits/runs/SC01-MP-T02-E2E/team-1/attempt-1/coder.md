# Coder Work Log · SC01-MP-T02-E2E · attempt-1

## 1. 地形侦察

- 完整读 `coder-agent.md` 全文（铁律 6 条 + 执行流程 7 步）
- 完整读 `.harness/inflight/SC01-MP-T02-E2E.json`（Phase 1 · transition kind · 写 spec 不跑 automator）
- 完整读标杆模板 `frontend/apps/mp/test/e2e/automator-smoke.spec.ts`（50 行 · vitest + miniprogram-automator · connect/disconnect pattern）
- 完整读 `pages/capture/index.ts`（168 行 · 状态机 IDLE→UPLOADING→UPLOADED→nav P03 / ERROR）
- 完整读设计 mockup `design/mockups/wrongbook/02_capture.html`（P02 拍题页）+ `03_analyzing.html`（P03 AI 分析页）
- 确认 `app.json` pages[3]='pages/capture/index' + pages[4]='pages/analyzing/index' 均已注册

关键发现:
- 转场逻辑在 `pages/capture/index.ts:149-155`：`handleCapture` 完成后 300ms delay → `wx.navigateTo({ url: '/pages/analyzing/index?imageUrl=...&subject=...&qid=...' })`
- automator-smoke.spec.ts 使用 `automator.connect({ wsEndpoint })` + `Promise.race` 8s timeout pattern
- Phase 1 不依赖后端，transition test 用 `mp.navigateTo` 直接模拟跳转

## 2. 编码

新增文件: `frontend/apps/mp/test/e2e/capture-to-analyzing.spec.ts`

基于标杆模板 (`automator-smoke.spec.ts`) 的 connect/disconnect pattern，编写 3 个 test case:
1. `reLaunch 到 capture 页` — `mp.reLaunch({ url: '/pages/capture/index' })` + assert `page.path === 'pages/capture/index'`
2. `模拟 navigateTo analyzing · 携带 query 参数` — `mp.navigateTo` 带 `imageUrl` / `subject` / `qid` 参数 + assert `page.path === 'pages/analyzing/index'`
3. `analyzing 页接收到 query 参数 (subject + qid)` — assert `page.query` 含 `subject='math'` + `qid='42'`

设计对齐:
- 业务: 用户拍题 → 上传 → AI 分析 (capture→analyzing transition)
- 代码: `pages/capture/index.ts:152` wx.navigateTo 目标路径与 test 一致
- mockup: 02_capture.html → 03_analyzing.html transition flow

## 3. 真实 E2E

Phase 1 不跑 automator（inflight `physical_verification.dor_c1_to_c6_required: false`）。
验证通过:
- `pnpm -F mp lint` (node scripts/lint.mjs + tsc --noEmit) → 0 errors
- `pnpm -F mp test:unit` → 97 passed (7 files) · 0 failed

## 4. 自检

| 检查项 | 结果 | 证据 |
|--------|------|------|
| spec 文件存在 | PASS | `frontend/apps/mp/test/e2e/capture-to-analyzing.spec.ts` |
| beforeAll connect + afterAll disconnect | PASS | spec lines 29-39 |
| transition test (reLaunch → navigateTo → assert path) | PASS | spec lines 41-46, 48-58 |
| query 参数验证 | PASS | spec lines 60-68 |
| lint 0 errors | PASS | `pnpm -F mp lint` 输出 `✓ lint-mp: 0 errors` |
| tsc --noEmit 0 errors | PASS | lint 内含 tsc, 0 errors |
| test:unit 97 PASS | PASS | vitest 7 files · 97 tests · 0 failures |
| 不修改 page 代码 | PASS | git diff 仅含新文件 |
| 不跑 automator | PASS | Phase 1 scope 限定 |

## 5. 提交

- commit hash: 6c7be30
- 分支: `claude/sc01-mp-t02-e2e`
