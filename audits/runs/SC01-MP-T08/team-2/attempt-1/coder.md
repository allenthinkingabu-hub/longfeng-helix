# Coder Work Log · SC01-MP-T08 · P-HOME 主页 build + P05→P-HOME transition

## 1. 地形侦察

- **Mockup SoT**: `design/mockups/wrongbook/01_home_ios_refined.html` — 完整阅读 484 行 HTML+CSS，提取 hero gradient、greeting、review card、weekly summary、week schedule、messages、AI weak KP、quick entries、tabbar 9 个 section。
- **H5 sibling**: `frontend/apps/h5/src/pages/Home/index.tsx` (620 行) — 对齐 React 实现：状态机 LOADING/READY/EMPTY/ERROR、counter animation、circle progress、MVP hardcoded data、testIds 挂载。
- **Reference template**: `frontend/apps/mp/pages/review-exec/index.{ts,wxml,wxss,json}` — 作为 MP page 四件套标杆模板：navigationStyle custom、Vant Weapp 组件引入、wxss rpx 单位、Page() 生命周期。
- **API 模式**: `src/api/_http.ts` (httpJSON dual runtime adapter)、`src/api/review.ts` (getToday 端点) — 复用 review service 的 `/api/review/today` 作为 home 数据源。
- **Unit test 模式**: `test/unit/_http.spec.ts` + `test/unit/api-modules.spec.ts` — pure function test、0 mock、vitest。
- **Transition test 模式**: `test/transitions/exec-to-done.spec.ts` — wx runtime mock only (wx.navigateTo)、不 mock backend。
- **Testids**: `@longfeng/testids` 已有 `pHome` section (root, greetingHero, streakFireIcon, todayReviewCard, circleProgress, startAllBtn, weeklySparkline, weekStrip, messages, weakKp, quickEntries)。
- **app.json**: 5 个已有 page，需在首位加 `pages/home/index`。

## 2. 编码

### 新增文件
1. `pages/home/index.json` — custom nav + van-icon 组件引入
2. `pages/home/index.wxml` — 1:1 mirror mockup，9 section 全覆盖，所有 testIds 挂载
3. `pages/home/index.wxss` — 完整 iOS 色系 + Apple DS 排版，rpx 单位，shadow/gradient/grid
4. `pages/home/index.ts` — Page() 生命周期，LOADING→READY|EMPTY|ERROR 状态机，API 调用 + fallback
5. `pages/home/helpers.ts` — 纯函数提取 (buildGreeting, computeCirclePct, derivePageState)，unit testable
6. `src/api/home.ts` — getHomeTodayCount，复用 review service `/api/review/today`
7. `test/unit/home.spec.ts` — 16 个 unit test (buildGreeting 4 + computeCirclePct 6 + derivePageState 6)
8. `test/api/home.integration.spec.ts` — soft-skip integration test
9. `test/transitions/list-to-home.spec.ts` — 5 transition tests (wx.navigateTo + wx.switchTab)

### 修改文件
10. `app.json` — 首位加 `pages/home/index`
11. `test/unit/api-modules.spec.ts` — 新增 `api/home.ts` export 验证

## 3. 真实 E2E

> wave-3 scope: unit test red line + integration soft-skip. 不含 automator E2E。

**Unit test 结果**: `pnpm -F mp test:unit` → 37/37 PASS (100%)
- home.spec.ts: 16 PASS
- api-modules.spec.ts: 16 PASS (含新增 1 个 home export)
- _http.spec.ts: 5 PASS

**Integration test**: `test/api/home.integration.spec.ts` → soft-skip (backend not reachable)
**Transition test**: `test/transitions/list-to-home.spec.ts` → 5 PASS

**Typecheck**: `pnpm -F mp typecheck` → PASS (tsc --noEmit 0 errors)

## 4. 自检

| 检查项 | 状态 | 证据 |
|---|---|---|
| app.json 更新 | ✅ | `pages/home/index` 在首位 |
| Vant Weapp build-npm-fs | ✅ | `bash devtools-cli.sh build-npm-fs` 成功 |
| Unit test ≥ 1 · 100% pass | ✅ | 16 个 · 37/37 total |
| Integration soft-skip · 0 mock | ✅ | home.integration.spec.ts |
| Transition test · mock wx only | ✅ | 5 tests · list-to-home.spec.ts |
| Typecheck PASS | ✅ | tsc --noEmit |
| testIds 全挂载 | ✅ | pHome.root/greetingHero/todayReviewCard/etc |
| 状态机 4 态 | ✅ | LOADING/READY/EMPTY/ERROR |
| 1:1 mockup mirror | ✅ | 9 section 全覆盖 |

## 5. 提交

Commit hash: (pending — will be filled after git commit)
