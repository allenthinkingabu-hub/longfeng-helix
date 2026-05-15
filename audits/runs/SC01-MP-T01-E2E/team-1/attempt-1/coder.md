# Coder Work Log · SC01-MP-T01-E2E · attempt-1

## 1. 地形侦察

- 完整读 `coder-agent.md`（铁律 1-5 + 补充 6-7 · 执行流程 7 步）
- 完整读 `SC01-MP-T01-E2E.json` inflight：Phase 1 page-vrt，写 capture.spec.ts，不跑 automator
- 完整读参考模板 `test/e2e/automator-smoke.spec.ts`：vitest + miniprogram-automator connect/disconnect 模式
- 完整读 `design/mockups/wrongbook/02_capture.html`：P02 拍题页 mockup（相机取景框 + 科目选择 + 模式切换 + 快门 + tabbar）
- 完整读 `pages/capture/index.{ts,wxml,json}`：Page 实现 · 状态机 IDLE→UPLOADING→UPLOADED→ERROR · van-* 组件
- 确认 baseline PNG 存在：`design/system/screenshots/mp-vrt-baseline/02_capture.png`
- 确认 shared_infra：pixelmatch + pngjs 已在依赖中

## 2. 编码

新建 `frontend/apps/mp/test/e2e/capture.spec.ts`，包含：
- `beforeAll`：connect `ws://127.0.0.1:9420`（8s timeout race）→ navigateTo `/pages/capture/index` → 1s settle
- test 1：`currentPage().path === 'pages/capture/index'`
- test 2：`page.$('view')` 不为 null（DOM 已渲染）
- test 3：`mp.screenshot` 截图落 `test-results/e2e/capture-actual.png`，验证文件存在且 size > 0
- test 4：pixelmatch 对比 actual vs `design/system/screenshots/mp-vrt-baseline/02_capture.png`，阈值 `< 5000` pixel diff，diff 图写 `capture-diff.png`
- `afterAll`：disconnect

## 3. 真实 E2E

Phase 1 scope：**不跑 automator**（Phase 2 TL 串行跑）。仅验证：
- `pnpm -F mp lint`：22 pre-existing van-* component resolution errors（全部来自已有 pages，与本次新文件无关 · `grep capture.spec` = 0 命中）
- `pnpm -F mp test:unit`：97/97 PASS（7 test files · 498ms）· 新 spec 不在 unit 目录，不影响

## 4. 自检

| 检查项 | 结果 |
|---|---|
| capture.spec.ts 存在 | ✅ |
| beforeAll connect ws 8s timeout | ✅ |
| test 1: currentPage path | ✅ |
| test 2: page.$('view') | ✅ |
| test 3: mp.screenshot → capture-actual.png | ✅ |
| test 4: pixelmatch < 5000 | ✅ |
| afterAll disconnect | ✅ |
| lint 0 新 error | ✅ |
| test:unit 97/97 PASS | ✅ |
| 未修改任何现有 page | ✅ |
| 未跑 automator | ✅ |

## 5. 提交

- commit hash: (见下方 git commit 输出)
- 文件：`frontend/apps/mp/test/e2e/capture.spec.ts`（新增 ~100 行）
