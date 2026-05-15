# Coder Work Log · SC01-MP-T07-E2E · attempt-1

## 1. 地形侦察

- 完整读 `.harness/agents/coder-agent.md` 全文 (铁律 6 条 + 执行流程 7 步)
- 完整读 `.harness/inflight/SC01-MP-T07-E2E.json` (Phase 1 page-vrt kind)
- 完整读 `design/mockups/wrongbook/05_wrongbook_list.html` (mockup HTML 250 行)
- 完整读 `design/system/screenshots/mp-vrt-baseline/05_wrongbook_list.png` (baseline 图片)
- 完整读 `frontend/apps/mp/pages/wrongbook-list/index.ts` (page logic · 状态机 LOADING→LIST/EMPTY/ERROR)
- 完整读 `frontend/apps/mp/pages/wrongbook-list/index.wxml` (WXML template · nav + search + chips + mastery filter + card list + FAB)
- 完整读 `frontend/apps/mp/pages/wrongbook-list/index.json` (usingComponents: van-icon, van-loading, van-empty)
- 完整读 `frontend/apps/mp/test/e2e/automator-smoke.spec.ts` (标杆模板 · connect/disconnect/currentPage/page.$ 模式)
- 完整读 `frontend/apps/mp/test/vitest.config.ts` (testTimeout 120s · pool forks singleFork)
- 完整读 `frontend/apps/mp/package.json` (pixelmatch ^7.1.0 · pngjs ^7.0.0 · miniprogram-automator ^0.12.1)

## 2. 编码

创建 `frontend/apps/mp/test/e2e/wrongbook-list.spec.ts`，4 个 test case：

1. **navigateTo 成功**: `mp.navigateTo('/pages/wrongbook-list/index')` → 验证 `currentPage().path === 'pages/wrongbook-list/index'`
2. **DOM 关键节点**: `page.$('.nav-h1')` / `.search` / `.chips-row` / `.content` 全部 truthy
3. **screenshot 截取**: `mp.screenshot()` 返回 base64 string，写入 `test-reports/e2e/screenshots/05_wrongbook_list-actual.png`
4. **VRT pixelmatch**: actual vs `design/system/screenshots/mp-vrt-baseline/05_wrongbook_list.png`，`diffPixels < 5000`，生成 diff 图 `05_wrongbook_list-diff.png`

模式严格参照 `automator-smoke.spec.ts` 标杆：
- `beforeAll`: `automator.connect` + 8s timeout race
- `afterAll`: `mp.disconnect()`
- pixelmatch threshold 0.15，cropData 处理尺寸差异

## 3. 真实 E2E

Phase 1 不跑 automator (inflight `physical_verification.dor_c1_to_c6_required: false`)。Phase 2 TL 串行跑。

验证项 (Phase 1 scope):
- `pnpm -F mp typecheck` → 0 error
- `pnpm -F mp lint` → 0 error (miniprogram_npm 就位后)
- `pnpm -F mp test:unit` → 97 tests / 7 files / 100% PASS

| 验证项 | 结果 | 证据 |
|--------|------|------|
| tsc --noEmit | PASS | typecheck 脚本 0 error |
| lint.mjs | PASS | 0 errors (miniprogram_npm 复制到 worktree 后) |
| test:unit | PASS | 97 tests / 7 files / 100% green |
| spec 4 tests 语法 | PASS | tsc 编译无 type error |

## 4. 自检

- [x] 铁律 1 单一专注: 只做 SC01-MP-T07-E2E
- [x] 铁律 2 工作区隔离: 只在 claude/sc01-mp-t07-e2e 分支
- [x] 铁律 3 权限隔离: 只改 dev_done + git_commits
- [x] 铁律 4 Git Commit: 描述性 commit
- [x] 铁律 5 落盘工作日志: coder.md + bugs-found.md 已写
- [x] 铁律 6 lint + typecheck: 全绿

spec 文件结构对照:
- scope_in ✓ "写 frontend/apps/mp/test/e2e/<page-or-flow>.spec.ts"
- scope_in ✓ "beforeAll connect (8s timeout) · 1+ test · afterAll disconnect"
- scope_in ✓ "page-vrt kind: pixelmatch 对比 actual vs baseline_png · diff < 5000"
- scope_out ✓ 未修改现有 page 代码
- scope_out ✓ 未跑 automator (Phase 1)

## 5. 提交

- commit hash: 5448d14
- 文件变更: `frontend/apps/mp/test/e2e/wrongbook-list.spec.ts` (+136 行新文件)
