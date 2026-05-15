# Coder Work Log · SC01-MP-T13-E2E · attempt-1

## 1. 地形侦察

- 读 `coder-agent.md` 全文 (铁律 7 条 + 执行流程 7 步)
- 读 inflight `SC01-MP-T13-E2E.json`: Phase 1 page-vrt, target `pages/review-done`, baseline `09_review_done.png`, diff < 5000
- 读 smoke 参考: `test/e2e/automator-smoke.spec.ts` — connect/disconnect 模式 + vitest + miniprogram-automator
- 读 mockup HTML: `design/mockups/wrongbook/09_review_done.html` — hero (绿色渐变 + confetti) / memory-curve / stats / kp-list / CTA
- 读页面源码: `pages/review-done/index.{ts,wxml,json}` — state machine LOADING/RESULT/ALL_DONE/ERROR, testids from `@longfeng/testids` p09
- 读 testids: `frontend/packages/testids/src/index.ts` L444-465 — p09 块含 root/celebrateHero/heroTitle/memoryCurve/statsRow/kpChart/ctaRow 等
- 读 transition 参考: `test/transitions/done-to-home.spec.ts` — wx mock 模式 (Phase 1 不需要)
- 确认 baseline PNG 存在: `design/system/screenshots/mp-vrt-baseline/09_review_done.png` (191KB)
- 确认 pixelmatch + pngjs 已在 mp devDependencies

## 2. 编码

写 `frontend/apps/mp/test/e2e/review-done.spec.ts`:
- 4 个 test case:
  1. `navigateTo review-done → currentPage.path` 验证导航路径
  2. `hero / memory-curve / stats / cta DOM` 验证 page.$ 选择器存在
  3. `mp.screenshot` 产出 actual PNG 文件 (> 1KB)
  4. `pixelmatch actual vs baseline diff < 5000` VRT 像素对比
- beforeAll: connect ws://127.0.0.1:9420 with 8s timeout
- afterAll: mp.disconnect()
- pixelmatch 配置: threshold 0.15, 维度不匹配时 crop/pad 到 baseline 尺寸
- diff PNG 输出到 `test/__screenshots__/review-done-diff.png` 供调试

## 3. 真实 E2E

Phase 1 scope: 只写 spec 不跑 automator (Phase 2 TL 串行跑)。

验证范围:
- lint: `pnpm -F mp lint` → 0 errors
- tsc: `tsc --noEmit` → PASS
- test:unit: `pnpm -F mp test:unit` → 97/97 PASS

| testid / selector | spec assertion | spec 行号 |
|---|---|---|
| `pages/review-done/index` (path) | test 1: currentPage.path === 'pages/review-done/index' | L60-63 |
| `.hero` (CSS class) | test 2: page.$('.hero') truthy | L69 |
| `.card` (memory-curve) | test 2: page.$('.card') truthy | L73 |
| `.stats` | test 2: page.$('.stats') truthy | L77 |
| `.cta` | test 2: page.$('.cta') truthy | L81 |
| mp.screenshot() | test 3: file exists + size > 1KB | L87-93 |
| pixelmatch diff | test 4: numDiffPixels < 5000 | L97-125 |

## 4. 自检

- [x] coder-agent.md 铁律 1 单一专注: 只处理 T13
- [x] 铁律 2 工作区隔离: 只在 claude/sc01-mp-t13-e2e 分支
- [x] 铁律 5 工作日志落盘: coder.md + bugs-found.md 在 work_log_dir
- [x] 铁律 6 lint + typecheck: 0 errors
- [x] spec 文件符合 scope_in: beforeAll connect 8s + 4 tests + afterAll disconnect + pixelmatch VRT
- [x] Phase 1 不跑 automator (scope_out 遵守)
- [x] CLAUDE.md Rule 3 Surgical: 只新增 1 个 spec 文件, 未改任何现有代码
- [x] CLAUDE.md Rule 6 tool budget: ~25 tool uses (Phase 1 guidance: 20-30)

## 5. 提交

- commit hash: (pending)
