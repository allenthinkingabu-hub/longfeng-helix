# Coder 工作日志 · SC01-MP-T11-E2E · attempt-1

## 1. 地形侦察

- 读 `coder-agent.md` 全文（铁律 7 条 + 执行流程 7 步）
- 读 inflight `SC01-MP-T11-E2E.json`：Phase 1 page-vrt kind，target `pages/review-exec`，baseline `design/system/screenshots/mp-vrt-baseline/08_review_exec.png`
- 读参考模板 `test/e2e/automator-smoke.spec.ts`：connect/disconnect 模式、vitest + miniprogram-automator 用法
- 读目标页面源码 `pages/review-exec/index.{ts,wxml,json}`：状态机 READING→ANSWERING→REVEALED→GRADED，testids p08 系列
- 读 mockup `design/mockups/wrongbook/08_review_exec.html`：750×1334 chromium baseline 来源
- 读 `@longfeng/testids` p08 定义：root / topbar / questionHero / answerArea / revealBtn / revealContent / gradeButtons / memoryCurve 等
- 读 `scripts/capture-mockup-baselines.mjs`：pixelmatch + pngjs + playwright-core 已在 devDeps
- 确认 baseline PNG 存在：95143 bytes

## 2. 编码

新建 `frontend/apps/mp/test/e2e/review-exec.spec.ts`，4 个测试用例：

1. **currentPage.path** — 导航到 `/pages/review-exec/index` 后验证路径
2. **关键 UI 节点渲染** — `page.$('[data-test-id="p08-root"]')` + questionHero + gradeButtons + memoryCurve 均 truthy
3. **revealBtn 初始态存在** — READING 状态下 reveal button 存在
4. **VRT pixelmatch** — `mp.screenshot()` → base64 → PNG.sync.read → pixelmatch vs 08_review_exec.png baseline → diff < 5000 pixels

技术要点：
- beforeAll: `automator.connect` with 8s timeout race（scope_in 要求）
- afterAll: `mp.disconnect()`
- pixelmatch threshold 0.15，VRT_THRESHOLD 5000 pixels
- cropToSize helper 处理 actual/baseline 尺寸不一致（automator 截图 vs chromium baseline 可能不同分辨率）

## 3. 真实 E2E

Phase 1 scope：**只写 spec + lint + tsc + test:unit**。Phase 2 TL 串行跑 automator。

验证结果：
- `tsc --noEmit` → 0 error ✓
- `pnpm -F mp test:unit` → 7 files, 97 tests, 97 passed ✓
- `pnpm -F mp lint` → 22 errors 全为 pre-existing van-* npm resolution（`miniprogram_npm/@vant/weapp/*/index.js` 不存在），**非本次引入**

## 4. 自检

| 检查项 | 结果 | 证据 |
|--------|------|------|
| spec 文件存在 | ✓ | `frontend/apps/mp/test/e2e/review-exec.spec.ts` |
| beforeAll connect 8s timeout | ✓ | spec 第 37-45 行 |
| afterAll disconnect | ✓ | spec 第 47-49 行 |
| 4 test cases | ✓ | currentPage / DOM nodes / revealBtn / VRT pixelmatch |
| pixelmatch vs baseline | ✓ | spec 第 72-102 行，threshold 5000 |
| tsc --noEmit PASS | ✓ | 0 error |
| test:unit PASS | ✓ | 97/97 pass |
| lint pre-existing only | ✓ | 22 van-* errors 与 main 一致 |

## 5. 提交

commit hash: 03569dd
