# bugs-found.md · MP-CATCHUP-B-WELCOME attempt-1

## Bugs found + fixed during this attempt

### Bug 1 · Wire shape drift between inflight spec and real backend
- **File**: `frontend/apps/mp/src/api/landing.ts` (我自己的 stub origin · Phase 0 0857c9e)
- **Description**: inflight `context.api_contracts_in_scope` 描述 KPI shape 为 `{totalStudents, totalQuestions, avgImproveRate}` · 但真后端 `LandingKpiDto` 返 `{cumulativeQuestions, dailyAnalyses, happyUsers}`。
- **Root cause**: 描述层 (inflight) 与代码层 (LandingKpiDto.java) 漂移 · 我不能 silent-fork (CLAUDE.md Rule 7) · 必须以真后端为准 (Rule 11 codebase conventions)。
- **Fix**: 重写 `landing.ts` 用真后端 wire shape · 文件头注明 surface · commit `d25d6bd`。
- **Verify**: `test/api/landing.integration.spec.ts` 真 hit :8090 wire 验过 (4/4 PASS)。

### Bug 2 · TypeScript ES2017 Promise.allSettled not supported
- **File**: `frontend/apps/mp/pages/welcome/index.ts`
- **Description**: 初版用 `Promise.allSettled` · tsconfig lib=["ES2017"] 不含 `PromiseSettledResult` 类型 · tsc 报 `TS2550: Property 'allSettled' does not exist on type 'PromiseConstructor'`。
- **Root cause**: 项目 lib 锁在 ES2017 (避免 wx MP runtime polyfill 依赖) · pages/home/index.ts:L138 注释里早就提过这个约束。
- **Fix**: 沿用 home 同决策, 改 `Promise.all([getSamples().catch(() => undefined), getKpi().catch(() => undefined)])`。
- **Verify**: `pnpm -F mp lint` 0 errors on my files · commit `d25d6bd`。

## Bugs found but NOT in my scope to fix (surface only · Rule 12 fail loud)

### Issue A · pages/guest/capture/index.ts:190 TypeScript error
- **File**: `frontend/apps/mp/pages/guest/capture/index.ts:190` (team C scope · MP-CATCHUP-C-GUEST commit 3cbf0e4)
- **Description**: `error TS2694: Namespace 'WechatMiniprogram' has no exported member 'CameraContextTakePhotoSuccessResult'`
- **Impact**: 全仓 tsc 失败 · 影响 MP IDE 编译 · 我自己的 welcome page 自身 0 tsc error
- **Owner**: team C (MP-CATCHUP-C-GUEST) · 不在我 attempt scope · 我已 surface 给 TL 注意。

### Issue B · MP IDE Automation cannot stably connect in 4-team parallel session
- **File**: 环境层 · 不是源代码 bug
- **Description**: `cli auto --auto-port 9420` exit 0 后 WS bridge 不持久 · IDE GUI Trust 是手动 toggle
- **Impact**: e2e 4 testcase 在本 attempt 期间无法 BLOCKER · 详见 coder.md §3.2
- **Owner**: harness 层 / 用户 GUI 手动 trust · Coder 已尽力 (reLaunch quit/start/auto 多次尝试)

---

Total bugs found in MY scope: **2**, all fixed.
Total issues surfaced outside scope: **2**, not fixed (correctly delegated).
