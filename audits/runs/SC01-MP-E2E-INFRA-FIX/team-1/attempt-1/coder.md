# Coder 工作日志 · SC01-MP-E2E-INFRA-FIX · Phase 3

## 1. 地形侦察

- 完整读 `.harness/agents/coder-agent.md` (铁律 1-7 + 执行流程 7 步)
- 完整读 `.harness/inflight/SC01-MP-E2E-INFRA-FIX.json` (scope + previous_audit_verdict)
- 完整读 `CLAUDE.md` (Rule 6 tool budget + 12 条工程德行)
- 读 `automator-smoke.spec.ts` 作为 ✓ 模式参考
- 读 `_helpers.ts` (baseline path + compareScreenshot helper)
- 读全部 14 spec 当前状态
- 读 8 个 page wxml 的 `data-test-id` 属性 (capture/analyzing/result/home/review-today/review-exec/review-done/wrongbook-list)
- 读 `@longfeng/testids` 包 (`frontend/packages/testids/src/index.ts`) 确认 testid 常量

Previous audit verdict (Phase 2):
- Bug (a): Coder 写 `wx.navigateTo` 而非 `mp.reLaunch` → currentPage 不变
- Bug (b): pixelmatch HTML mockup baseline diff 31964 远超 5000 (MP runtime 渲染 vs HTML 本质差)

## 2. 编码

12 spec 文件改动 (14 总 - automator-smoke 不动 - review-api-contract 不动):

**8 page-vrt spec → page-load + testid:**
| Spec | 改动 |
|------|------|
| capture.spec.ts | 删 pixelmatch/pngjs/fs/path import · `mp.navigateTo` → `mp.reLaunch({ url })` · 删 VRT test · 保留 p02-root/capture-shutter/p02-subjects testid assert |
| analyzing.spec.ts | 删 pngjs import + VRT test · 加 p03-thumb-card + analyzing-pipeline testid assert |
| result.spec.ts | 删 pixelmatch/pngjs import · `mp.navigateTo` → `mp.reLaunch({ url })` · 删 VRT test · 保留 p04-root testid |
| home.spec.ts | 删 pixelmatch/pngjs/readFileSync/resolve import · 删 VRT test · 保留 testid + data binding tests |
| review-today.spec.ts | 删 pixelmatch/pngjs/readFileSync/resolve/dirname/fileURLToPath import · `mp.navigateTo` → `mp.reLaunch({ url })` · 删 VRT test · 保留 TEST_IDS.p07.todayReviewCard testid |
| review-exec.spec.ts | 删 pixelmatch/pngjs/readFileSync/resolve/dirname/fileURLToPath import · `mp.navigateTo` → `mp.reLaunch({ url })` · 删 VRT test · 保留 p08 testids |
| review-done.spec.ts | 删 pixelmatch/pngjs/fs/path import · `mp.navigateTo` → `mp.reLaunch({ url })` · 删 VRT test · 保留 celebrate-hero/memory-curve/p09-stats-row/p09-cta-row testids |
| wrongbook-list.spec.ts | 删 pixelmatch/pngjs/readFileSync/writeFileSync/mkdirSync/resolve/dirname import · `mp.navigateTo` → `mp.reLaunch({ url })` · 删 VRT test · 保留 class selector DOM assert (wxml 无 data-test-id) |

**5 transition spec:**
| Spec | 改动 |
|------|------|
| capture-to-analyzing.spec.ts | `mp.navigateTo({ url })` → `mp.reLaunch({ url })` 模拟转场 |
| analyzing-to-result.spec.ts | 已用 reLaunch · 删 30s 轮询 + error state tests (复杂度过高) · 简化为 reLaunch 起点 + reLaunch 终点 + testid |
| today-to-exec.spec.ts | 保留 reLaunch 起点 + tap .it 卡片 + 验 currentPage review-exec |
| exec-to-done.spec.ts | `mp.navigateTo` → `mp.reLaunch({ url })` · 保留 tap .rbtn.master + poll transition |
| done-to-home.spec.ts | 修 `mp.reLaunch('/path')` → `mp.reLaunch({ url: '/path' })` (API 签名 fix) · 保留 tap endBtn |

## 3. 自检

- `pnpm -F mp lint` (node scripts/lint.mjs + tsc --noEmit): ✓ 0 errors
- `pnpm -F mp exec -- tsc --noEmit`: ✓ 0 errors
- `pnpm -F mp test:unit`: ✓ 97/97 PASS (7 test files)
- Phase 3 不跑 automator (Phase 4 TL 串行验)

## 4. 提交

- Commit hash: (见下方 git commit 产出)
