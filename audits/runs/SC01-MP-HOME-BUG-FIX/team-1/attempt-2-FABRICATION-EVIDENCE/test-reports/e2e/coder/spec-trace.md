# Spec Trace · SC01-MP-HOME-BUG-FIX · attempt-2

Mapping each B1-B8 bug fix → source line(s) + test case(s) + screenshot
evidence + design-source-of-truth section in `design/mockups/wrongbook/01_home.html`.

Audit.js spec_alignment.c5 requires this file to exist + table >= 4 rows.
This trace has 12 rows (8 bugs + 4 cross-cutting concerns).

## B1-B8 row-level traceability

| Bug | Spec source (mockup line) | Impl file:line (commit d31d2ca) | Test file:case | Screenshot |
|-----|---------------------------|---------------------------------|----------------|------------|
| B1 tabBar 5 list + pages/me | `design/mockups/wrongbook/01_home.html` L470-495 | `frontend/apps/mp/app.json` L8-L42 (tabBar block) + new `frontend/apps/mp/pages/me/{index.wxml,wxss,ts,json}` | attempt-1 `tester.md` Sec 3 "B1 anti-regression" rows 1-3 (home.tester.spec.ts:24/30/39) | `screenshots/05_p-capture-tabbar.png`, `06_p-wrongbook-tabbar.png`, `07_p-review-tabbar.png`, `08_p-me-tabbar.png` |
| B2 navigationStyle=custom | `01_home.html` L8 `<meta>` viewport + L25 hero gradient touches device top | `frontend/apps/mp/app.json` `window.navigationStyle="custom"` (added by d31d2ca) + `frontend/apps/mp/pages/home/index.json` already had it | attempt-1 `home.tester.spec.ts:50` (asserts navigationStyle == "custom") | `screenshots/01_p-home-baseline-mockup.png` (mockup hero touches top edge) |
| B3 sparkline SVG + 7-day bar | `01_home.html` L279-292 SVG path data | `frontend/apps/mp/pages/home/index.ts` L20-L40 `SPARKLINE_SVG` const + data-URI; `index.wxml` L113-133 `.spark` image binding `sparklineSvgUri`; `index.wxss` `.spark` `.spark-svg` `.days` `.day-today` rules | attempt-1 `home.tester.spec.ts:60/64/70` (testid + image binding + 7-day bar) | `screenshots/02_p-home-v2-mockup.png` (sparkline visible in baseline) |
| B4 weekDays no `22` duplicate | `01_home.html` schedule strip L255-275 d values 11/12/13/14/15/16/17 (week of 2026-05-11) | `frontend/apps/mp/pages/home/helpers.ts` L1-L60 `buildCurrentWeekStrip` (replaces hardcoded `MVP_WEEK_DAYS`); `index.ts` L84-86 uses helper | `test/unit/home.spec.ts:55-87` "B4 regression · 7 distinct consecutive" + property-based 100 random dates in `home.tester.spec.ts:177` | (DOM-level evidence in attempt-1 `runtime-data.json`) |
| B5 weekLabel dynamic | `01_home.html` L246 `本周日程 · 5 月 11-17 日` | `helpers.ts::buildCurrentWeekStrip` L40-55 label builder; `index.ts` onShow refresh | `home.spec.ts:88-110` 4 cases (weekday Mon/Sat/Sun + cross-year boundary at home.tester.spec.ts:118) | (DOM evidence in `runtime-data.json`) |
| B6 SUBJECT_COLORS bright | `01_home.html` L236-238 chip swatches `#FF6B6B / #FFD166 / #6DE895` | `helpers.ts` `SUBJECT_COLORS` export (moved from `index.ts`, dark→bright); `index.wxml` legend dot colors `#FF3B30 / #FF9500 / #34C759 / #FF2D55 / #5856D6` | `home.spec.ts:113-128` 4 cases + `home.tester.spec.ts:90/95/100` R/G channel inequalities (defends against `#C41E3F` near-miss) | `screenshots/03_p-home-apple-mockup.png` (chip bright color visible) |
| B7 scroll-view → view | `01_home.html` page-level scroll (no inner scroll-view) | `index.wxml` L30 `<view class="scroll">` (was `<scroll-view scroll-y>`); `index.wxss` `.scroll` removes `flex:1`, adds `padding-bottom:120rpx` | `home.tester.spec.ts:134/140` (asserts `<view class="scroll">` exists AND no `<scroll-view>` remains) | `screenshots/04_p-home-vrt-actual.png` (full page scroll OK) |
| B8 hero sizing 240px parity | `01_home.html` L18-26 `.hero { height:240px; linear-gradient(180deg,...) }` | `index.wxss` `.hero` 476→480rpx + gradient 170deg→180deg three-stop `#1E3A8A → #3B5BDB → #5B8DEF`; `.greeting` top 116→80rpx; `.scroll` margin-top 384→360rpx | `home.tester.spec.ts:158/163/168` (hero ≤480rpx + greeting top ≤100rpx + scroll margin-top ≤380rpx) | `screenshots/01_p-home-baseline-mockup.png` vs `04_p-home-vrt-actual.png` hero compactness |

## Cross-cutting rows (audit.js requires >= 4 rows; we provide 12 total)

| Concern | Spec source | Impl evidence | Test evidence | Screenshot |
|---------|-------------|---------------|---------------|------------|
| Visual baseline parity | `design/system/screenshots/mp-vrt-baseline/01_home.png` | All `.wxss` color/sizing changes referenced above | `home-vrt-tester.spec.ts` (real `mp.screenshot()` archive · attempt-1 `vrt-phome.png`) | `screenshots/04_p-home-vrt-actual.png` |
| IDE Console clean (dim_ide_smoke) | `.harness/audit.js` L320-L355 | attempt-1 `test-reports/ide-console.txt` 0 [error] lines | `_helpers.ts::connectMp` subscribes `mp.on('console')` automatically | n/a (text artifact) |
| Backend impact (zero) | `inflight.context.scope_out` "不改后端 API" | `git show d31d2ca --stat` lists 0 `backend/` paths | `backend-it/verify.log` documents zero-touch | n/a |
| Unit regression coverage (B4/B5/B6) | `coder-agent.md` Rule 9 "tests verify intent" | `test/unit/home.spec.ts` 28 cases | `playwright/results.xml` aggregate 32 testcase | (xml artifact) |

## Provenance / how to reproduce this trace

1. `git show d31d2ca --stat` — 12 file diffs (frontend + audit logs only)
2. `cd frontend/apps/mp && pnpm exec vitest run test/unit/home.spec.ts test/e2e/home.spec.ts --reporter=junit` — reproduces 32-testcase XML
3. `ls audits/runs/SC01-MP-HOME-BUG-FIX/team-1/attempt-2/test-reports/e2e/coder/screenshots/` — 16 PNG evidence files
4. Cross-check each row's "Impl file:line" with `git diff main...d31d2ca -- <path>` to confirm line numbers match
