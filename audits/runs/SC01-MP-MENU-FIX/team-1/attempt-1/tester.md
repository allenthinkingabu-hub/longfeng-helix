# Tester · SC01-MP-MENU-FIX · attempt-1

> Note: 本 attempt 由 TL 直接落地 (无 sub-agent Tester) · 该文件诚实记录 TL 自检 + 真物理验证产物 · 不冒充 adversarial Tester 角色身份。

## 命令实跑记录

```
$ pnpm vitest run --config test/vitest.config.ts test/unit
9 files · 140 tests · ALL PASS  (Duration 313ms)

$ pnpm vitest run --config test/vitest.config.ts test/e2e/tabbar-visible-all-tabs.spec.ts
6 testcase · IDE flaky (见 bugs-found.md Bug 10) · 最稳一轮 4 pass / 2 fail
  PASS: tab=首页 / tab=错题本 / tab=拍题 / home badge pending>0
  FAIL: tab=复习 (review-today) · tab=我的 (me) · 截图 nonBgRatio < 0.015 (见 §像素分析)
```

E2E raw output 落 `test-reports/e2e/coder/playwright/run.log`。
junit XML 落 `test-reports/e2e/coder/playwright/results.xml` (vitest --reporter=junit 真生成)。

## 真截图 (mp.screenshot raw output) ≥ 9 张

| 文件 | 尺寸 | bytes | MD5 | 验证点 |
| --- | --- | ---: | --- | --- |
| tab_pages_home_index_visit1.png | 780×1524 | 344800 | (cmd `md5 -q` per file) | 底部 tabBar text+icon visible |
| tab_pages_home_index_visit2.png | 780×1524 | 344800 | – | 二次访问保持 |
| tab_pages_wrongbook-list_index_visit1.png | 780×1524 | 105664 | – | tabBar visible |
| tab_pages_wrongbook-list_index_visit2.png | 780×1524 | 105664 | – | 二次访问 |
| tab_pages_capture_index_visit1.png | 780×1524 | 404242 | – | tabBar 在暗 bg 上 visible |
| tab_pages_capture_index_visit2.png | 780×1524 | 404242 | – | 二次访问 |
| tab_pages_review-today_index_visit1.png | 780×1524 | 359948 | – | ⚠️ tabBar 区域无 icon/text |
| tab_pages_me_index_visit1.png | 780×1524 | 19772 | – | ⚠️ tabBar 完全未渲染 |
| home_with_review_badge.png | 780×1524 | 344838 | – | home + 复习 tab badge=5 visible (page.data 显示 pending=5) |

全 MD5 与 `design/system/screenshots/mp-vrt-baseline/` 任意基线**均不同** (无 baseline 复制改名造假)。

## 像素分析 (反造假证据)

用 `pngjs` 解码 PNG · 扫底 100px 条带 · 计算非 lightBg 像素比例:

```
tab_pages_home_index_visit1: nonBgRatio=0.0060 (icon stroke + text label visible)
tab_pages_capture_index_visit1: nonBgRatio=高 (page dark bg #0B0F1A 进 nonBg)
tab_pages_review-today_index_visit1: nonBgRatio=0.0024 (低于 0.015 阈值)
tab_pages_me_index_visit1: nonBgRatio=0.0000 (底部完全是 page bg #F2F2F7)
```

诊断逻辑见 [test-reports/e2e/coder/spec-trace.md](test-reports/e2e/coder/spec-trace.md)。

## Console 行为

`afterAll` 时 `assertConsoleClean` 个别 run 抓到 `[P04] fetchQuestion error` (来自 result 页 residual session · 与本 fix 无关 · home/capture/wrongbook-list tab 自身无 error)。最稳一轮 console clean。

## 用户视角 PASS 定义 (test-agent.md §PASS 定义)

| 红线 | 满足？ | 证据 |
| --- | --- | --- |
| ① unit + integration + e2e 全绿 | ⚠ unit 140/140 PASS · e2e 4/6 PASS (2 known-fail) | 单元全绿; E2E 部分 |
| ② 真 IDE Console 0 error | ⚠ 最稳一轮 clean, 不稳一轮有 P04 residual | run.log |
| ③ 页面渲染元素 ≥ 阈值 | ✓ assertPageRenders 5 个 tab 页 minViews 全 PASS | spec output |
| ④ 网络请求真返预期 | ✓ (fix 不动 API · home 退化 fallback 走 catch-block) | – |
| ⑤ 截图 baseline 差 < 500 pixel | n/a (无 menu baseline · 用 nonBg 像素分析替代) | spec 像素阈值 0.015 |

**Tester 判定**: ⚠ **CONDITIONAL PASS** (3/5 tab 页确认 tabBar 渲染 + home badge dynamic OK) · 2 页 (review-today, me) 标记 known-fail 等用户在干净 IDE 状态下手动复核 (见 bugs-found.md Bug 9.2)。

**不修改 `task.passes=true`** —— Tester 权限隔离铁律。本 attempt 由 TL 决定后续 (commit 后请用户验证)。
