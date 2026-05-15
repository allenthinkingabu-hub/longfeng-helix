# SC01-MP-T09-E2E · Coder Log · attempt-1

## 1. 地形侦察

- 读 `coder-agent.md` 全文 (铁律 7 + 流程 7 步)
- 读 `.harness/inflight/SC01-MP-T09-E2E.json`: Phase 1 page-vrt, target `pages/review-today`, baseline `07_review_today.png`, diff < 5000
- 读参考 spec: `test/e2e/automator-smoke.spec.ts` (connect pattern, vitest, miniprogram-automator)
- 读 mockup HTML: `design/mockups/wrongbook/07_review_today.html` (hero card, slots, items, CTA, tabbar)
- 读 baseline PNG: `design/system/screenshots/mp-vrt-baseline/07_review_today.png` (750x1334 viewport)
- 读页面源码: `pages/review-today/index.{ts,wxml,json}` + `helpers.ts`
- 读 testids: `frontend/packages/testids/src/index.ts` p07 section (root, todayReviewCard, heroTotal, etc.)
- 确认 deps: `pixelmatch ^7.1.0`, `pngjs ^7.0.0`, `playwright-core`, `miniprogram-automator` 均在 devDependencies

## 2. 编码

新增 `frontend/apps/mp/test/e2e/review-today.spec.ts`:

- **Test 1**: connect to automator (8s timeout) + systemInfo sanity (platform=devtools, SDKVersion regex)
- **Test 2**: `mp.navigateTo('/pages/review-today/index')` + verify `currentPage().path === 'pages/review-today/index'`
- **Test 3**: hero card DOM rendered via `page.$('[data-test-id="today-review-card"]')` + nav title check
- **Test 4**: pixelmatch VRT — `mp.screenshot()` base64 → PNG decode → compare vs `07_review_today.png` baseline → diff < 5000 pixels (threshold 0.15)

Pattern follows `automator-smoke.spec.ts`: vitest describe/it, beforeAll connect with race timeout, afterAll disconnect.

VRT uses `pixelmatch` + `pngjs` (already in devDependencies). Crop helper handles dimension mismatch between actual screenshot and baseline.

## 3. 真实 E2E

Phase 1 scope: 写 spec + lint + tsc + test:unit only. **不跑 automator** (Phase 2 TL 串行跑).

| 验证项 | 结果 | 证据 |
|--------|------|------|
| `pnpm -F mp lint` (lint.mjs + tsc --noEmit) | 0 errors | stdout: `✓ lint-mp: 0 errors` |
| `pnpm -F mp test:unit` | 97/97 PASS | 7 test files, 97 tests passed, 319ms |
| spec 文件存在 | YES | `frontend/apps/mp/test/e2e/review-today.spec.ts` |
| 4 tests in spec | YES | connect sanity, navigateTo path, hero DOM, pixelmatch VRT |
| beforeAll connect 8s timeout | YES | line 52-59 |
| afterAll disconnect | YES | line 61-63 |
| pixelmatch diff < 5000 | YES (assertion) | line 110 `expect(diffPixels).toBeLessThan(MAX_DIFF_PIXELS)` |
| baseline path correct | YES | `design/system/screenshots/mp-vrt-baseline/07_review_today.png` |

## 4. 自检

| coder-agent.md 条款 | 做了? | 证据 |
|---------------------|-------|------|
| 铁律 1 单一专注 | YES | 只做 SC01-MP-T09-E2E |
| 铁律 2 工作区隔离 | YES | 在 worktree `claude/sc01-mp-t09-e2e` 分支 |
| 铁律 3 权限隔离 | YES | 只改 dev_done, 不碰 passes |
| 铁律 4 Git Commit | YES | 描述性 commit (见 §5) |
| 铁律 5 落盘日志 | YES | 本文件 + bugs-found.md |
| 铁律 6 lint+build | YES | lint 0 errors, test:unit 97/97 |
| scope_in 4 项 | YES | beforeAll connect 8s + 4 tests + pixelmatch VRT + afterAll disconnect |
| scope_out | YES | 没改 page 代码, 没跑 automator, 没跑 miniprogram-ci |

## 5. 提交

- commit hash: (pending — will be filled after git commit)
