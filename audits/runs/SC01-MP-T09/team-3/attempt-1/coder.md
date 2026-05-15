# Coder Log · SC01-MP-T09 · P07 今日复习 · attempt-1

## 1. 地形侦察

- 完整读 `.harness/agents/coder-agent.md` (铁律 7 条 + 执行流程 7 步)
- 完整读 `.harness/inflight/SC01-MP-T09.json` (task context + work_log_dir + audit_gate)
- 完整读 `CLAUDE.md` (Rule 1-12 + 启动纪律 + audit.js 卡口)
- 完整读 `design/mockups/wrongbook/07_review_today.html` (P07 SoT · 226 行)
- 完整读 reference template: `pages/review-exec/` (index.json/wxml/wxss/ts · Vant 组件模式)
- 完整读 H5 sibling: `frontend/apps/h5/src/pages/ReviewToday/index.tsx` (504 行 · hero + 3 stats + slots)
- 完整读 `src/api/review.ts` (getToday + createSession 已存在 · port 8085)
- 完整读 existing unit tests: `test/unit/{_http,api-modules}.spec.ts`
- 完整读 existing integration tests: `test/api/review-exec.integration.spec.ts`
- 完整读 existing transition tests: `test/transitions/exec-to-done.spec.ts`
- 完整读 `@longfeng/testids` p07 section (root, todayReviewCard, heroTotal 等)

## 2. 编码

### 新建文件 (7):
1. `pages/review-today/index.json` — page config with Vant components (van-icon, van-button)
2. `pages/review-today/index.wxml` — 1:1 mirror of mockup: nav + hero card + slot groups + CTA + tabbar
3. `pages/review-today/index.wxss` — full styling matching mockup CSS variables/gradients
4. `pages/review-today/index.ts` — Page logic: onLoad → _fetchToday → state machine
5. `pages/review-today/helpers.ts` — Pure functions extracted for testability (buildCountdown, formatHHMM, getSlotKey, buildSlotsFromItems)
6. `test/unit/review-today.spec.ts` — 24 unit tests covering all pure helpers
7. `test/api/review-today.integration.spec.ts` — real backend integration with soft-skip
8. `test/transitions/home-to-today.spec.ts` — wx.navigateTo mock transition tests

### 修改文件 (2):
1. `app.json` — added `pages/review-today/index` to pages array
2. `test/unit/api-modules.spec.ts` — updated getToday test description

### 关键设计决策:
- helpers.ts 分离: Page() 调用需要 wx 全局对象，不能在 vitest 中直接 import。将纯业务逻辑函数抽到 helpers.ts 使其可独立测试。
- buildSlotsFromItems: 参考 H5 sibling 实现，按小时分桶 (上午/下午/晚上)，countdown 按 15min/120min 阈值分 now/soon/wait。
- ReviewPlanDto 无 strategyCode: 用 unknown cast 安全访问，匹配 H5 sibling 处理方式。

## 3. 自检

### typecheck
```
pnpm -F mp typecheck → PASS (0 errors)
```

### unit tests
```
pnpm -F mp test:unit → 44/44 PASS (100%)
  - test/unit/review-today.spec.ts: 24 tests ✓
  - test/unit/api-modules.spec.ts: 15 tests ✓
  - test/unit/_http.spec.ts: 5 tests ✓
```

### integration tests (new)
- `test/api/review-today.integration.spec.ts` — GET /api/review/today + POST /api/review/sessions · soft-skip when backend down
- `test/transitions/home-to-today.spec.ts` — 6 transition tests (wx.navigateTo mock)

## 4. 自检

Self-check against coder-agent.md:
- ✅ 铁律 1: 单一专注 SC01-MP-T09
- ✅ 铁律 2: 只在 claude/sc01-mp-t09-home-to-review-today 分支工作
- ✅ 铁律 3: 只改 dev_done, 不碰 passes
- ✅ 铁律 4: 描述性 commit `f015578`
- ✅ 铁律 5: coder.md + bugs-found.md 落盘在 work_log_dir
- ✅ Step 3: 地形侦察 + 标杆对齐 (review-exec as reference)
- ✅ Step 5: typecheck 0 errors + unit tests 100% green
- ✅ Step 6: git commit + spec-trace.md + coder.md + bugs-found.md

## 5. 提交

- Commit: `f015578` — feat(SC01-MP-T09): implement P07 review-today page + unit/integration/transition tests
- Branch: `claude/sc01-mp-t09-home-to-review-today`
- Files: 12 changed, 1278 insertions(+), 2 deletions(-)
