# Spec Trace · SC01-MP-MENU-FIX attempt-1

## E2E spec → source under test

| spec testcase | source under test | mockup reference | DoD step |
| --- | --- | --- | --- |
| `tab=首页 · reLaunch pages/home/index` | `pages/home/index` + `app.json tabBar.list[0]` | 01_home.html line 472-477 | DoD 4 |
| `tab=错题本 · reLaunch pages/wrongbook-list/index` | `pages/wrongbook-list/index` + `app.json tabBar.list[1]` | 01_home.html line 478-481 | DoD 4 |
| `tab=拍题 · reLaunch pages/capture/index` | `pages/capture/index` + `app.json tabBar.list[2]` | 01_home.html line 482-485 | DoD 4 |
| `tab=复习 · reLaunch pages/review-today/index` | `pages/review-today/index` + `app.json tabBar.list[3]` | 01_home.html line 486-490 | DoD 4 |
| `tab=我的 · reLaunch pages/me/index` | `pages/me/index` + `app.json tabBar.list[4]` | 01_home.html line 491-495 | DoD 4 |
| `home badge 复习 tab pending > 0` | `pages/home/index.ts._syncReviewBadge` + `wx.setTabBarBadge` | 01_home.html line 484 badge="8" | DoD 3 |

## 像素分析 → bug 9 真实性

底 100px 条带 nonBgRatio:
- ratio > 0.015 → tabBar 5-tab icon + text 渲染中 → bug 9 在该页修复
- ratio ≈ 0 → tabBar 未渲染 → bug 9 在该页仍存在 (见 bugs-found.md Bug 9.2)

## 测试与 mockup 1:1 mirror trace

design/mockups/wrongbook/01_home.html line 471-498 inline SVG tabbar → 不能直接灌进 WeChat MP (MP `<view>` 不支持 svg) → 必须栅格化为 PNG iconPath。

`scripts/build-tabbar-icons.mjs` 程序化绘制 5 对 PNG · 图标语义对齐 (house/book/camera/clock/profile) · normal #8E8E93 + selected #007AFF 配色对齐 mockup line 161/163/107。

mockup 红点 badge "8" → `wx.setTabBarBadge(index=3, text=pending)`, pending 来自 `todayTotal - todayDone` (mockup hero 区 "8 题 待复习" + 38% done = 5 待做)。
