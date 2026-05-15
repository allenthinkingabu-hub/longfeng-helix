# Coder Work Log · SC01-MP-T03-E2E · attempt-1

## 1. 地形侦察

- 完整读 `automator-smoke.spec.ts` 作为标杆模板（connect/disconnect 模式、vitest 用法）
- 完整读 `pages/analyzing/index.ts` — 状态机 init→analyzing→success|error、demo mode（无 imageUrl 时 fallback）
- 完整读 `pages/analyzing/index.wxml` — data-test-id 标注、stages pipeline 4 步
- 完整读 `pages/analyzing/index.json` — usingComponents van-icon
- 完整读 `design/mockups/wrongbook/03_analyzing.html` — 设计真相 mockup
- 完整读 baseline PNG `design/system/screenshots/mp-vrt-baseline/03_analyzing.png` — Chromium 渲染截图
- 确认 pixelmatch v7 (ESM-only) + pngjs v7 在 devDependencies 已安装
- 确认 vitest.config.ts pool=forks singleFork + 120s timeout

## 2. 编码

**文件**: `frontend/apps/mp/test/e2e/analyzing.spec.ts` (101 行)

4 个测试用例，严格按 inflight scope_in 要求：

| # | 测试 | 断言 |
|---|------|------|
| 1 | reLaunch `/pages/analyzing/index?taskId=demo` | `currentPage().path === 'pages/analyzing/index'` |
| 2 | DOM 渲染 | `page.$('view')` truthy |
| 3 | 截图 | `mp.screenshot` → `test-results/e2e/analyzing-actual.png`，验 PNG magic bytes |
| 4 | VRT pixelmatch | actual vs baseline diff < 5000 pixels，threshold 0.15 |

技术要点：
- pixelmatch v7 ESM-only → 使用 `await import('pixelmatch')` 动态导入
- pngjs `PNG.sync.read/write` 处理 PNG 解码编码
- diff 图输出到 `test-results/e2e/analyzing-diff.png` 便于目视检查
- `mkdirSync(ACTUAL_DIR, { recursive: true })` 确保输出目录存在

## 3. 真实 E2E

Phase 1 不跑 automator（inflight `physical_verification.dor_c1_to_c6_required = false`）。
spec 写好，Phase 2 由 TL 串行跑 `pnpm -F mp test:e2e:automator`。

验证通过的代替项：
- `pnpm -F mp lint`: 0 errors（修复了 worktree 缺失 miniprogram_npm 问题）
- `tsc --noEmit`: clean
- `pnpm -F mp test:unit`: 97/97 PASS

## 4. 自检

| 检查项 | 状态 | 证据 |
|--------|------|------|
| spec 含 beforeAll connect (8s timeout) | ✅ | analyzing.spec.ts L33-38 |
| spec 含 afterAll disconnect | ✅ | analyzing.spec.ts L40-42 |
| test 1: reLaunch + currentPage.path | ✅ | analyzing.spec.ts L44-49 |
| test 2: page.$('view') | ✅ | analyzing.spec.ts L51-55 |
| test 3: mp.screenshot | ✅ | analyzing.spec.ts L57-65 |
| test 4: pixelmatch < 5000 | ✅ | analyzing.spec.ts L67-91 |
| lint 0 new errors | ✅ | pre-commit hook 输出 "0 errors" |
| tsc --noEmit clean | ✅ | 无输出 = 无错误 |
| test:unit 97/97 PASS | ✅ | vitest output |
| 无 scope_out 越权 | ✅ | 仅新增 1 个 spec 文件，未改 page 代码 |

## 5. 提交

- commit: `9ed1113` — `feat(SC01-MP-T03-E2E): P03 analyzing page E2E + VRT spec (Phase 1)`
- pre-commit hook: lint 0 errors + test:unit 97/97 PASS
- branch: `claude/sc01-mp-t03-e2e`
