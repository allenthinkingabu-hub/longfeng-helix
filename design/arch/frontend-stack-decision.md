# 前端技术栈决策 · ADR

**Status**: Accepted
**Date**: 2026-05-13
**Owner**: user
**Supersedes**: (none)

---

## Context

产品需要支持 4 个客户端形态：

1. **Web** —— 桌面浏览器 / 移动浏览器 H5 入口（错题分享、SEO、PWA）
2. **微信小程序** —— 微信生态裂变 + 内嵌入口
3. **iOS 原生 App** —— App Store 上架 + push + 离线 + 相机深度
4. **Android 原生 App** —— 应用市场上架 + 同上

当前仓库现状（Phase 1 · 2026-05 时点）：

- `frontend/apps/h5/` —— React 18 + Vite 5 + Konsta UI · 9 个页面已脚手架 · 55 TSX 文件
- `frontend/apps/miniapp/` —— WXML/WXSS/JS 原生小程序
- `frontend/packages/{api-contracts, ui-kit, testids, shared-logic, telemetry, i18n}` —— 40 ui-kit 组件 + zod schema + Storybook
- iOS/Android 原生 —— **尚未开始**

关键约束：

- **微信不允许第三方运行时**直接跑在小程序容器里 —— Flutter / RN / Capacitor 都无法编译到微信小程序。
- 4 个客户端中 **App Store/应用市场上架 + Push 通知 + 离线/弱网 + 相机硬件 API 深度** 都要求**真原生**，WebView 套壳（Capacitor）不能满足审核与体验。
- 已运行 SC-01 14 task 垂直切片研发流，**任何换栈都会让 SC-01 推进熔断重来**。

---

## Decision

采用**三栈并存（horse-for-courses）**架构，每个客户端形态用各自最适合的技术栈：

| 客户端 | 栈 | 启动 Phase |
| --- | --- | --- |
| Web / H5 | **React 18 + Vite + Konsta UI**（保留 · 现状） | Phase 1（进行中） |
| 微信小程序 | **WXML/WXSS/JS 原生**（保留 · 现状） | Phase 1（进行中） |
| iOS / Android 原生 App | **Flutter**（新增） | **Phase 2** · SC-01 14 task 全 PASS 后启动 |

**跨栈共享层**：

- **API 契约**：升级 `frontend/packages/api-contracts` 为 OpenAPI 3.1 单源 → 自动生成 TS（H5/miniapp） + Dart freezed models + Dio clients（Flutter）。**业务字段命名仅在 OpenAPI 单源定义一次**。
- **Design tokens**：颜色 / 间距 / 字体 / 圆角 / 投影中心化（JSON 单源），三栈各自消费（CSS variables / WXSS / Dart const）。
- **测试协议**：`ai/agents/SHARED-E2E-PROTOCOL.md` 加 Flutter 分支（`integration_test` + `golden_test` + spec trace 表）。

---

## Drivers · 为什么 Flutter 是原生 App 的正解

| Driver | Capacitor (WebView 壳) | React Native | Kotlin+Swift 双栈 | **Flutter** |
| --- | --- | --- | --- | --- |
| App Store / 应用市场审核通过率 | 中（WebView 套壳偶有 4.2.x 风险） | 高 | 最高 | **高** |
| Push 通知 iOS Safari 限制规避 | ✗ 受 Web Push 限制 | ✓ 原生 APNs | ✓ 原生 APNs | **✓ 原生 APNs** |
| 相机 / 硬件 API 深度（AR 拍题 / Pencil 笔迹） | 中（plugin 桥） | 中（bridge 性能） | 最强 | **强（自渲染）** |
| 离线 / 弱网渲染 | 弱（依赖 service worker） | 中 | 强 | **强（自渲染 + 本地缓存）** |
| 一套代码出 iOS + Android | ✓ | ✓ | ✗（双栈） | **✓（Dart）** |
| UI 一致性 | 取决于 WebView | bridge 抖动 | 双栈写两次 | **最强（自带渲染引擎）** |
| 60fps 性能可控 | 弱 | 中 | 强 | **强** |
| 研发成本（相对双栈） | 50% | 60% | 100%（基准） | **60%** |

**结论**：Flutter 在 App 上架 + push + 相机深度 + 离线 + 跨平台五项综合最优。

---

## Alternatives Considered

### ❌ Flutter 替换全部（一码多端含小程序）
**否决理由**：Flutter 不能编译到微信小程序。强行做会变成"Flutter + 微信小程序原生"两码三端，不解决问题反而增加复杂度。

### ❌ Taro 渐进迁移（React 同源出 H5 + miniapp + RN）
**否决理由**：
- 4 drivers 中 push / 相机深度 / 离线 三项 RN 弱于 Flutter
- Taro 的 RN target 长期维护不如官方 Flutter 稳定
- 需要重构现有 H5（React + Vite）+ miniapp（原生 WXML）—— 沉没成本太重

### ❌ Capacitor 套 H5 出 App
**否决理由**：
- WebView 套壳，App Store 审核风险（4.2.x 条款）
- Push 通知 iOS 限制无法绕过
- 相机 / AR / 离线渲染体验明显劣于真原生

### ❌ Kotlin + Swift 双原生
**否决理由**：研发成本 100%（基准），跨 App UI 一致性需要双栈两次实现。

---

## Phase 2 Entry Criteria · Flutter App 启动前必备

1. **SC-01 14 个 user-action task 全部 PASS** —— 业务漏斗在 H5/miniapp 跑通验证商业价值
2. **API 契约 OpenAPI 单源化完成** —— TS + Dart 双客户端自动生成
3. **Design tokens 中心化文件落地** —— `design/system/tokens.json` 三栈消费一致
4. **`SHARED-E2E-PROTOCOL.md` 加 Flutter 分支** —— Coder/Tester 协议覆盖 Flutter 测试栈

---

## Phase 2 Prep Work（不阻塞 SC-01，可与 SC-01 后期并行）

| Prep | Owner | Effort | When |
| --- | --- | --- | --- |
| OpenAPI 3.1 spec 抽取自 `packages/api-contracts/types.ts` | team-backend + team-frontend | 中（2-3 day） | SC-01 中后期 |
| Design tokens 抽离为 `design/system/tokens.json` | team-frontend | 小（1 day） | SC-01 任何时点 |
| `SHARED-E2E-PROTOCOL.md` Flutter 分支扩写 | TL + Coder/Tester agent | 小（0.5 day） | Phase 2 启动前一周 |
| Dart 团队建设 / hire / onboarding | 招聘 | 大（4-8 week） | Phase 2 启动前 1-2 月 |
| Flutter 项目脚手架（`apps/mobile/` flutter create + CI） | team-mobile | 中（2-3 day） | Phase 2 第一周 |

---

## Consequences

### 优点

- ✅ 现有 React + miniapp 代码 0 折损，沉没成本全保留
- ✅ 每端最优体验（H5 SEO/分享、miniapp 原生流畅、App Flutter 60fps）
- ✅ SC-01 黄金路径 0 干扰
- ✅ Flutter 是原生 App 性能 / 一致性 / 跨端成本综合最优

### 代价（必须接受）

- ⚠️ **三套 UI 各自维护** —— spec 变更需改 3 处。Design tokens 中心化能缓解颜色/间距类变更，但布局/交互变更仍 3 套各写一遍
- ⚠️ **业务逻辑 Dart 二次实现** —— `shared-logic` 包不能跨语言用，react-query state → Riverpod/Bloc 需要重写
- ⚠️ **测试协议 3 套**：Playwright（Web） + `miniprogram-automator`（小程序） + `integration_test` + `golden_test`（Flutter）
- ⚠️ **认证 / push / 深度链接 / 相机 / 上传** 3 栈各实现一遍（plugin 差异大）
- ⚠️ **需要 Dart 团队建设** —— 至少 1 个熟手主导

### 触发重新评估的条件

如果以下任一发生，需要回到这份 ADR 重新评估：

1. 微信开放第三方运行时（极不可能但记下来）
2. 产品弃用 App Store 上架计划（则 Flutter 必要性减弱，Capacitor 可能足够）
3. Flutter 跨端 UI 一致性出现重大事故
4. 团队 Dart 资源持续无法补齐（≥ 6 月）则降级为 Capacitor 兜底

---

## References

- `frontend/apps/h5/` 现状脚手架
- `frontend/apps/miniapp/` 原生小程序
- `frontend/packages/api-contracts/src/types.ts` —— 未来 OpenAPI 单源起点
- `ai/agents/SHARED-E2E-PROTOCOL.md` —— Coder/Tester E2E 协议（待加 Flutter 分支）
- `feature_list.json` v3.1 —— SC-01 14 task 垂直切片清单
