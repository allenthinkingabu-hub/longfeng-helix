# Coder Log · SC01-MP-T14 · P09→P-HOME transition

## 1. 地形侦察

- 完整读 `coder-agent.md` 全文 + `CLAUDE.md` Rule 1-12
- 完整读 `.harness/inflight/SC01-MP-T14.json` — attempt 1, phase coder
- 完整读 `design/mockups/wrongbook/09_review_done.html` (P09 mockup · CTA: 结束本次 / 继续复习)
- 完整读 `design/mockups/wrongbook/01_home_ios_refined.html` (P-HOME mockup · 首页)
- 完整读 `frontend/apps/mp/pages/review-done/index.ts` (wave-1 T13 实现 · onEnd 用 switchTab)
- 完整读 `frontend/apps/h5/src/pages/ReviewDone/index.tsx` (H5 sibling · handleEnd → navigate('/'))
- 完整读 `frontend/apps/mp/src/api/review.ts` (completeSession export)
- 完整读 `frontend/apps/mp/test/unit/` (2 existing specs, pattern reference)
- 完整读 `frontend/apps/mp/test/transitions/exec-to-done.spec.ts` (sibling transition test pattern)
- 完整读 `frontend/apps/mp/app.json` — no `/pages/home/index` registered (T08 not merged)

标杆: `test/transitions/exec-to-done.spec.ts` as reference for wx mock pattern.

## 2. 编码

### 改动 1: `pages/review-done/index.ts` onEnd()
- **Before**: `wx.switchTab({ url: '/pages/capture/index' })`
- **After**: `wx.reLaunch({ url: '/pages/home/index', fail() { wx.reLaunch({ url: '/pages/capture/index' }) } })`
- 原因: T14 要求 P09→P-HOME transition; P-HOME (T08) 未 merge 故加 fallback 到 capture
- reLaunch (非 navigateTo) 清空页面栈 — 结束 session 后不应 back 到复习流

### 新增 2: `test/unit/review-done-end.spec.ts` (5 tests)
- completeSession 被调用 + sid 传递
- reLaunch 目标 `/pages/home/index`
- home 失败时 fallback 到 `/pages/capture/index`
- API 失败不阻塞导航
- reLaunch (非 navigateTo) 确认

### 新增 3: `test/transitions/done-to-home.spec.ts` (5 tests)
- onEnd → reLaunch to home
- fallback when home not found
- reLaunch used (stack clear)
- onContinue → navigateBack
- API error doesn't block nav

## 3. 自检

| 检查项 | 结果 |
|---|---|
| pnpm typecheck | PASS |
| pnpm test:unit (25/25) | 100% PASS |
| transition tests (20/20) | 100% PASS |
| review-done-end.spec.ts (5/5) | PASS |
| done-to-home.spec.ts (5/5) | PASS |

spec-trace: T14 仅涉及 transition — mockup 09 CTA "结束本次" → 触发 onEnd → navigate to home (mockup 01)

## 4. 自检

- [x] 铁律 1 单一专注: 只做 T14 P09→P-HOME transition
- [x] 铁律 2 工作区隔离: 仅在 claude/sc01-mp-t14-done-to-home 分支
- [x] 铁律 3 权限隔离: 仅改 dev_done, 不碰 passes
- [x] 铁律 4 Git commit: 描述性 commit message
- [x] 铁律 5 落盘: coder.md + bugs-found.md 在 work_log_dir
- [x] Rule 3 Surgical: 只改 onEnd() 3 行, 不动其他代码
- [x] Rule 9 Tests verify intent: 测试编码了 WHY (fallback 逻辑, stack clear)
- [x] Rule 12 Fail loud: 无 silent skip

## 5. 提交

Commit hash: (见 git log after commit)
