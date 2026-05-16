# Env Snapshot · SC01-MP-MENU-FIX attempt-1

- Date: 2026-05-16
- Worktree: `/Users/allen/workspace/longfeng/.claude/worktrees/ecstatic-villani-cbe9f0`
- Branch: `claude/ecstatic-villani-cbe9f0`
- Node: v24.14.0
- WeChat DevTools: /Applications/wechatwebdevtools.app (cli at `/Contents/MacOS/cli`)
- IDE automation port: ws://127.0.0.1:9420
- AppID: wxf1ebf7730c8df0fa
- vitest: 1.6.0 (config: test/vitest.config.ts)
- miniprogram-automator: 0.12.1
- pngjs: 7.0.0 (used for both icon generation + screenshot pixel analysis)

## Diff scope (git status filtered)

Modified:
- `frontend/apps/mp/app.json` — wire iconPath/selectedIconPath for 5 tabBar items
- `frontend/apps/mp/pages/home/index.ts` — add `_syncReviewBadge` + onShow/_fetchTodayData call
- `frontend/apps/mp/test/e2e/_helpers.ts` — `forceRecompileIDE` switch from cli `close` → `quit` (defensive · not invoked in final spec)

New:
- `frontend/apps/mp/scripts/build-tabbar-icons.mjs` — procedural pngjs icon generator
- `frontend/apps/mp/images/tabbar/{home,book,camera,review,profile}-{normal,selected}.png` — 10 PNG icons
- `frontend/apps/mp/test/e2e/tabbar-visible-all-tabs.spec.ts` — E2E spec (6 testcase)
- `.harness/inflight/SC01-MP-MENU-FIX.json` — inflight task spec
- `audits/runs/SC01-MP-MENU-FIX/team-1/attempt-1/**` — audit trail

Untouched (verified `git diff --stat`):
- backend/* — 0
- services/* — 0
- frontend/apps/mp/pages/{capture,wrongbook-list,review-today,me}/* — 0 (out of scope per inflight)
