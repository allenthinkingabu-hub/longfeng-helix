# Bugs Found · SC01-MP-MENU-FIX · attempt-1

## Bug 9 (primary) · 底部 Menu (tabBar) 完全不显示

**用户视角原话** (Allen 2026-05-16): "现在首页没有下面的 Menu"

**Surface**: 用户在 IDE 模拟器打开 P-HOME 首页, 内容滚动到底部, 看到 "最近消息" 但**没有任何底部 5-tab 导航菜单**。Mockup [01_home.html](../../../../../design/mockups/wrongbook/01_home.html) line 471-498 明确有 5-tab tabBar (首页 / 错题本 / 拍题 / 复习+badge / 我的) · 实现完全缺失。

**根因**: 见 [coder.md §1](coder.md)。`app.json` `tabBar.list` 缺 `iconPath` / `selectedIconPath` → WeChat IDE silent fail 不渲染 native tabBar。

**Scope**: **全 5 个 tab 页同样受影响** (tabBar 是全局配置 · 非 home 单独问题):

- pages/home/index
- pages/wrongbook-list/index
- pages/capture/index
- pages/review-today/index
- pages/me/index

**Fix**: [coder.md §2](coder.md)。新增 10 PNG 图标 + `app.json` 接入 + home `setTabBarBadge` 动态复习红点。

## Bug 9.1 (verified fixed) · home / capture / wrongbook-list tabBar 现已渲染

E2E 截图 + 像素分析确认 (见 [coder.md §3.3](coder.md)):
- `tab_pages_home_index_visit1.png` 底部 100px 含 `#8E8E93` (icon) + `#1C1C1E` (text label) — tabBar 渲染中
- `tab_pages_capture_index_visit1.png` 底部 100px 含 `#0B0F1A` (page 暗 bg) — tabBar 区域非空
- `tab_pages_wrongbook-list_index_visit1.png` 底部 100px nonBg ratio 高

## Bug 9.2 (open · IDE state issue) · review-today + me 页面 tabBar 截图未现

E2E 截图分析 (见 [coder.md §3.4](coder.md)):
- `tab_pages_me_index_visit1.png` 底部 1260px 完全是 `#F2F2F7` 单一色, 0 个 icon / text 像素
- `tab_pages_review-today_index_visit1.png` 同样底部 99 行无 tabBar 内容

**真实性**: 两页**确实截图时 tabBar 未渲染**, 不是分析逻辑问题。

**根因推测**: IDE compileHotReLoad 不完整 · 多次 `cli auto` 间 state 降级 (Fix 在 app.json 全局生效, 不可能"只对 3 页生效不对 2 页生效" → 必是 runtime / IDE 缓存问题)。

**Mitigation**: TL 已请用户 (Allen) 在干净 IDE 状态下手动验证:
1. 关闭并重新打开 WeChat 开发者工具
2. 在 IDE 内点 "编译" / `Cmd+R`
3. 切到 me + review-today tab → 验证底部 5-tab menu 是否出现

如手动验证仍缺失, 升级为 Bug 9.3 真 source 问题。

## Bug 10 (env · 不阻塞 main fix) · IDE automator 连接 flaky

`miniprogram-automator` 连 `ws://127.0.0.1:9420` 在本次 session 中:
- 首次 connect 成功概率 ~50%
- 断开后再连 100% 失败 (需重跑 `cli auto`)
- `cli quit` 完全杀 IDE → 用户已开会话破坏

**影响**: E2E spec beforeAll 不能稳定 connect → 6 testcase 中 2-4 个能完整跑

**Mitigation 在 attempt-1**: 不强制 `forceRecompileIDE` (避免 `cli quit` 破坏用户 session) · 改在 spec beforeAll 假定 IDE 已 ready (调用方负责 `cli auto`)。

**Follow-up**: 该问题已知, 暂不阻塞 SC01-MP-MENU-FIX 关闭。如反复出现, 单独立 ticket `SC01-MP-IDE-AUTOMATOR-STABILITY-FIX`。
