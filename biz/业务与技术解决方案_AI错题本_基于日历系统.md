# 业务与技术解决方案 — AI 错题本（基于通用日历系统 + 艾宾浩斯复习引擎）

> 版本：v1.2 · 2026-04-21（+ §2A 用户 Journey 与页面流转，对齐 8 张效果图；+ 匿名态五场景 SC-11..SC-15，覆盖访客落地 / 游客试用 / 分享预览 / 回流唤起 / 只读观察者）
> 作者：Longfeng 架构组
> 适用：MVP → 可扩展至千万级学生侧并发
> 代码基线：
> - 后端 `/Users/allenwang/build/longfeng/backend`（Spring Boot 错题本骨架，包名 `com.longfeng.wrongbook`，已有 `QuestionController` / `ImageAnalysisService` / `AnalysisResult` / `QuestionResponse` / `WebConfig` / `application.yml` / `Dockerfile`）
> - 前端 `/Users/allenwang/build/longfeng/frontend`（待创建，按《AI 落地实施计划 — 前端 UI/UX 多端版 v2》执行）
> - 设计文档：
>   - `design/AI落地实施计划_通用日历系统.md`（后端通用日历 P0–P16）
>   - `design/AI落地实施计划_前端UI_UX与联调.md`（H5 + 微信小程序 F0–F17）
>   - `design/艾宾浩斯.md`（复习推送数据模型原则）

---

## 0. 执行摘要（TL;DR）

**核心业务**：学生用微信小程序 / H5 拍照或上传错题 → 后端调用 **Spring AI** 进行多模态识别与错因分析 → 结构化结果回显 → 系统自动在**现有通用日历**上生成一组**艾宾浩斯遗忘曲线**复习事项（T1–T6）→ 到点通过**多渠道通知**（小程序订阅消息 / APP 推送 / 邮件 / 短信）触达 → 学生完成复习后回写效果 → 下一节点自适应推进或重置。

**匿名态扩展（v1.2 新增）**：打破"P00 登录页 = 唯一入口"的登录墙，新增 5 种匿名态业务场景——**SC-11 访客落地 P-LANDING**（价值橱窗 + 样例 + 双 CTA）、**SC-12 游客试用 P-GUEST-CAPTURE**（设备维度 1 次免注册 AI 分析 + 24h claim 回正式账号）、**SC-13 分享预览 P-SHARED**（HS256 签名令牌 + 脱敏只读）、**SC-14 回流唤起 P-WELCOMEBACK**（设备指纹识别 + "还剩 N 个待复习"）、**SC-15 只读观察者 P-OBSERVER**（一次性邀请码 + 观察者会话，只读不写）。新增微服务 **anonymous-service**、网关过滤器 **AnonFilter / ObserverFilter**、Flyway 迁移 **V20260421_02**、前端 `bootstrap/resolve-entry.ts` 登录态决策树。

**核心技术**：Spring Boot 3.2 + **Spring Cloud 2023 + Spring Cloud Alibaba 2023** + **Spring AI 1.0** + PostgreSQL 16（`pgvector` 向量 / `pg_trgm` 模糊）+ Redis 7（+ Bloom Filter 令牌黑名单、Bucket4j 限流）+ RocketMQ 5 + Nacos 2.3 + XXL-Job 2.4 + MinIO/OSS + Elasticsearch 8（可选）+ Kubernetes/Helm；前端为 **pnpm workspace monorepo**，H5 用 **Vite 5 + React 18 + Konsta UI**（+ FingerprintJS 设备指纹 + 独立 Anonymous Shell），微信小程序用**原生 TS + Vant Weapp**，共享 `design-tokens` / `api-contracts` / `i18n` / `utils` 四个包。

**与日历系统关系**：**不重复造轮子**。错题复习计划通过日历的**多关联项**机制（`relation_type = STUDY` / `relation_id = question:{id}`）写入 `calendar_event` 与 `calendar_reminder`，所有"到点提醒 / 跨端同步 / 多视图展示 / 时区处理"能力直接复用通用日历的 core-service / reminder-service / notification-service。匿名态同样沿用日历的关联模型——游客 claim 成功后，`question.owner` 从 `guest_session_id` 换绑到 `student_id`，艾宾浩斯节点即刻补写进日历，无需二次造轮子。

**增长北极星（v1.2 新增）**：访客 → 游客试用 ≥ 35%、游客 → 注册 claim ≥ 25%、分享链 → 注册 ≥ 15%；三条曲线共同守护"从冷启动到首次留存"的漏斗。

**里程碑**：

| 阶段 | 名称 | 预计 | 核心产出 |
|---|---|---|---|
| S0 | 仓库对齐与骨架整合 | 0.5 天 | 单仓合并、包结构、BOM 对齐、**anonymous-service 骨架 + 网关 AnonFilter/ObserverFilter** |
| S1 | 领域建模 + DDL | 1 天 | 9 张核心表 + **6 张匿名态表**（guest_session / guest_rate_bucket / share_token / share_token_audit / observer_invite / observer_session / account_device）、Flyway 迁移（V20260421_01 + V20260421_02） |
| S2 | 文件上传 + OCR 前置 | 1 天 | 鉴权直传 OSS、预签名、OCR 预清洗 |
| S3 | Spring AI 错题分析 | 2 天 | 多模态 + 结构化输出 + 流式 SSE |
| S4 | 错题域 CRUD + 检索 | 1.5 天 | 列表 / 详情 / 标签 / 语义搜索 |
| S5 | 艾宾浩斯计划引擎 + 日历联动 | 2 天 | T0–T6 调度 + 效果回写 + 日历落库 |
| S6 | 多渠道推送 | 1 天 | 小程序订阅 / 邮件 / APP / 短信 |
| S7 | 前端 — 拍题 / 分析结果 / 错题本 | 2 天 | 小程序 + H5 双端 |
| S8 | 前端 — 复习计划与执行闭环 | 1.5 天 | 日历挂载 + 执行页 + 效果回写 |
| S9 | 端到端联调 + 冒烟 | 1 天 | Playwright + miniprogram-automator |
| S10 | 可观测 + 部署 | 1 天 | Prometheus / Sentry / Helm |

合计 **14 天** MVP，出口标准：端到端冒烟 100% PASS、AI 分析 P95 < 8s、艾宾浩斯节点触发漂移 < 30s；**匿名态三条漏斗指标（35% / 25% / 15%）首周达观测基线**，SC-11/12/13 Playwright 全绿。

---

## 1. 业务目标与产品定义

### 1.1 用户与价值主张

| 角色 | 登录态 | 痛点 | 我们的解法 |
|---|---|---|---|
| **陌生访客**（广告 / 搜索 / 扫码进入） | 匿名 | 不知道"AI 错题本"是什么，点到登录页直接退出 | **访客落地页 P-LANDING** 展示动图 + 3 组样例，0 注册成本看到价值 |
| **犹豫期潜在用户**（同学推荐、家长提示） | 匿名 | 不愿为未验证的工具贡献手机号 | **游客试用 SC-12**：允许 1 次完整拍题 + AI 分析，结果 24h 内可 claim 回正式账号 |
| **分享链接收方**（家长群 / 朋友圈点开的家长 / 同学） | 匿名 | 点到链接看不到内容，又不愿登录 | **分享链 P-SHARED** 走签名令牌，脱敏预览 + CTA 升级 |
| **流失用户**（卸载后重新打开 / 登出状态回访） | 匿名 | 被再次 onboarding 劝退 | **回流唤起 P-WELCOMEBACK**：识别设备指纹 → 展示"还剩 N 个待复习" → 一键回登 |
| **家长 / 班主任（观察者）** | 观察者会话 | 不想和学生共用账号，又想看进度 | **只读观察者 P-OBSERVER**：一次性邀请码换观察者会话，仅读、不写、不产生学生账号 |
| **学生**（K12 / 考研 / 语言学习者） | 正式账号 | 错题散在纸上、难复盘、容易"做过又忘" | 拍一下自动入库 + 自动排复习日程 + 到点提醒 |
| 老师（B 端 P2） | 正式账号 | 作业讲评效率低 | 整班错题聚类、错题簿导出 PDF |

### 1.2 MVP 业务范围（Must-have）

1. **错题入库**：拍照 / 相册 / H5 文件上传三入口，支持 JPG / PNG / HEIC / PDF（单页）。
2. **AI 智能分析**：OCR 题干 → 学科识别 → 知识点抽取 → 错因诊断 → 正确解法 → 拓展变式（可选）。
3. **错题本管理**：按学科 / 知识点 / 掌握度筛选，支持手动修正 AI 结果。
4. **艾宾浩斯复习计划**：自动生成 T1 (1h) / T2 (1d) / T3 (3d) / T4 (7d) / T5 (15d) / T6 (30d) 节点，挂到日历。
5. **多渠道提醒**：小程序订阅消息、APP 推送、邮件、站内消息，支持免打扰时段。
6. **复习执行**：到点弹出错题卡 → 学生独立作答 → 自评掌握 / 未掌握 → 节点自适应。
7. **数据统计**：个人维度掌握率 / 遗忘率 / 学科分布（简版）。
8. **访客落地页 P-LANDING**（价值橱窗 + 样例预览 + 双 CTA），0 注册成本展示产品价值，解决"登录墙跳出"漏斗洞（见 §2B.12 SC-11）。
9. **游客试用 + 注册认领**（Try Before Signup）：允许设备维度 1 次完整 AI 分析，结果保存在 `guest_session` 24 h；注册后一键 claim 到正式账号并自动排艾宾浩斯节点（见 §2B.13 SC-12）。
10. **分享链只读预览 P-SHARED**：分享者签名令牌 + 脱敏预览 + 升级 CTA，补齐 SC-09 接收方端（见 §2B.14 SC-13）。

### 1.3 非 MVP（明确不做 / 留给 P1–P2）

- 题目变式自动出题（P1，依赖 RAG + 题库）
- 老师端班级聚类（P2）
- 家长关注视图（P2）
- 海外版多语言题库（P2，仅做 i18n 骨架）
- **回流唤起 P-WELCOMEBACK**（P1）：设备指纹识别流失用户 → 一键回登（见 §2B.15 SC-14）。
- **只读观察者 P-OBSERVER**（P1）：家长 / 班主任一次性邀请码换观察者会话（见 §2B.16 SC-15）。

### 1.4 关键业务指标（北极星）

| 指标 | MVP 目标 | 观测口径 |
|---|---|---|
| 错题入库成功率 | ≥ 99% | 上传成功 ÷ 发起上传 |
| AI 分析可用率 | ≥ 95% | 结构化 JSON 解析成功 ÷ 调用总数 |
| AI 分析 P95 时延 | ≤ 8 s | 从入队到流式结束 |
| 7 日留存 | ≥ 40% | D0 入库学生中 D7 再触达 |
| 复习按时触达率 | ≥ 98% | 节点触发时间 − 计划时间 ≤ 30 s |
| 复习完成率 | ≥ 60% | 24h 内复习 ÷ 应复习节点 |
| **访客 → 游客试用转化率** | ≥ 35% | P-LANDING 进入 ÷ 点「试试看」抵达 P04 |
| **游客试用 → 注册转化率** | ≥ 25% | P04 游客态 ÷ 成功完成注册并 claim |
| **分享链 → 注册转化率** | ≥ 15% | P-SHARED 打开 ÷ 完成注册 |

---

## 2. 业务流程（端到端）

```
  ┌──────────────┐    (1)拍照/相册/文件上传
  │  学生前端    │──────────────────────────────┐
  │ 小程序/H5/App │                              │
  └──────────────┘                              ▼
         ▲                              ┌───────────────┐
         │(9)复习到点提醒弹窗            │ file-service  │ → OSS/MinIO 预签名直传
         │                              └───────┬───────┘
         │                                      │(2)上传完成回调
         │                                      ▼
         │                              ┌───────────────┐
         │                              │ wrongbook-svc │ (创建 question=PENDING)
         │                              └───────┬───────┘
         │                                      │(3)投递分析任务
         │                                      ▼  RocketMQ: ai.analyze.topic
         │                              ┌───────────────┐
         │                              │ ai-analysis   │ Spring AI 多模态
         │                              │   -service    │ + 结构化 JSON 输出
         │                              └───────┬───────┘
         │                                      │(4)SSE 流 + 终态入库
         │                                      ▼
         │                              ┌───────────────┐
         │                              │ wrongbook-svc │ 保存 analysis_result
         │                              └───────┬───────┘
         │                                      │(5)发布事件 question.created
         │                                      ▼  RocketMQ: wrongbook.event.topic
         │                              ┌───────────────┐
         │                              │ review-plan   │ 依艾宾浩斯生成 T0~T6
         │                              │   -service    │ plan + node
         │                              └───────┬───────┘
         │                                      │(6)写日历事件（多关联）
         │                                      ▼
         │                              ┌───────────────┐
         │                              │ calendar-core │ calendar_event 落库
         │                              └───────┬───────┘
         │                                      │(7)扫描到期节点（XXL-Job）
         │                                      ▼
         │                              ┌───────────────┐
         │                              │ reminder-svc  │ 生成待推送任务
         │                              └───────┬───────┘
         │                                      │(8)多渠道下发
         │                                      ▼
         │                              ┌───────────────┐
         └──────────────────────────────│ notification  │ 小程序/APP/邮件/短信
                                        │   -service    │
                                        └───────────────┘
                                                 │(10)学生完成 → 回写
                                                 ▼
                                        ┌───────────────┐
                                        │ review-plan   │ 掌握→推进；未掌握→重置 T0
                                        └───────────────┘
```

---

## 2A. 用户 Journey 与页面流转（UX 设计 + 开发权威参考）

> 本章节是 **UI/UX 设计与前后端开发的唯一权威参考**。后续所有设计稿（Figma / HTML 效果图）、前端路由、后端接口、埋点事件均应以此为准。章节结构遵循「人 → 场景 → 页面 → 数据 → 接口 → 状态 → 异常」七层，AI 可直接据此生成页面代码与服务端骨架。
>
> 设计稿基线：`design/mockups/wrongbook/01_capture.html` ~ `08_review_done.html` 共 8 张（+ `index.html` 作品集页）。本章节描述的 8 个核心页面与效果图一一对应。

### 2A.1 角色（Persona）与核心场景

| Persona | 典型身份 | 主要设备 | 动机 | 触发事件 | 关注的 KPI |
|---|---|---|---|---|---|
| **P1 — 学生小 A（K12）** | 初 / 高中生 | 微信小程序（最常用）+ H5（PC 看详情） | 把作业 / 考试错题"一拍入库"，不再抄错题本 | 当晚做完作业、考试返校后 | 入库速度 < 10 s、复习到点不漏 |
| **P2 — 学生小 B（考研 / 语培）** | 成人自学 | H5（PC）+ APP（P1 后） | 建立长期遗忘曲线复习，减少"学完又忘" | 刷完一套真题 / 一章讲义后 | 30 天留存、知识点掌握率 |
| **P3 — 家长 / 班主任（P2 阶段）** | 监护人 / 教师 | 小程序只读视图 | 看孩子 / 班级薄弱点 | 周报推送时 | 知识点薄弱聚类 |

**本方案 MVP 仅覆盖 P1 + P2 两个学生侧角色**，家长 / 老师侧放到 P2 阶段。

**三大核心场景**：

1. **入库场景 Scene-A**：`学生看到一道做错的题 → 拍照 → 等待 AI 分析 → 核对并保存 → 系统自动排下一次复习`
2. **复习场景 Scene-B**：`到点收到通知 → 打开今日复习 → 独立作答 → 自评掌握度 → 记忆曲线自适应推进`
3. **管理场景 Scene-C**：`打开错题本 → 筛选薄弱知识点 → 查看单题档案 → 触发主动复习 / 归档`

### 2A.2 端到端 Journey Map（首次用户 + 回访用户）

```
╔══════════════════ 首次使用 Journey（Onboarding + First Capture） ══════════════════╗
                                                               (阶段耗时)
 发现 ───► 登录 ───► 引导三步 ───► 拍题 ───► AI 分析 ───► 核对保存 ───► 曲线生成 ───► 关闭
 扫码/搜索    微信一键    权限 授权    10 s     4–8 s       3 s          自动 <1s      -
 (Discover)  (Auth)    (Onboard)  (P01)   (P02)       (P03)         (系统)      情感🎉

 情感曲线：  好奇 → 期待 → 略焦虑 → 专注 → 惊喜 → 满足 → 成就感

╠══════════════════ 回访使用 Journey（Daily Review Loop） ══════════════════╣

 推送 ───► 点击 ───► 今日复习 ───► 执行 ───► 完成 ───► 下一次 / 结束
 小程序订阅   深链        (P06)     (P07)    (P08)     自动循环
 消息        /deep-link
 (Reminder)  (Push CTR)   (Plan)    (Execute) (Reward)

 情感曲线：  略有压力 → 被看见 → 聚焦 → 挑战 → 成就 → 持续动力
╚══════════════════════════════════════════════════════════════════════════════════════╝
```

### 2A.3 信息架构（IA）与路由表

**Tab Bar 5 项**（方案 β · 今日聚合派；小程序与 H5 一致，H5 底部浮动；PC 宽屏自动升级为侧栏）：

| # | Tab | 图标 | 首屏 | 角标规则 |
|---|---|---|---|---|
| 1 | **首页** | Home | Today Hub（P-HOME） | 今日待复习数（红色） |
| 2 | **错题本** | 书卡 | 错题列表 P05 | 未分析或待修正数量 |
| 3 | **拍题**（主 CTA） | 相机 | 拍题 P02（全屏模态） | — |
| 4 | **复习** | 时钟环 | 今日复习 P07 | 待复习题数（红色） |
| 5 | **我的** | 用户 | 设置 / 统计 P13 | 重要通知红点 |

> **关键变更（相较 v1.0 的日历派）**：第 1 个 Tab 从「日历」降级为二级页 `P10 /calendar/month`，由 **今日聚合首页 P-HOME** 占据首 Tab；日历仍然是业务写入的唯一排期载体，但不再是用户的每日心智入口。进入完整日历有三个入口：① 首页"本周条带"右端 **"完整日历 →"** 链接；② 首页快捷入口 2×2 中的"完整日历"；③ 我的 Tab → "我的日历"行。

**完整路由表**（小程序 `pages/**` / H5 `react-router` / 后端 `deep-link`）：

| ID | 页面（中文 / 英文） | 小程序路径 | H5 路由 | 深链（推送点击） | 登录态 | 源 HTML 稿 |
|---|---|---|---|---|---|---|
| **P-LANDING** | **访客落地页**（价值橱窗 + 样例） | `pages/landing/welcome` | `/welcome` | `wb://welcome` | 匿名 | `landing_welcome.html`（P1）|
| **P-GUEST-CAPTURE** | **游客拍题**（Try Before Signup） | `pages/guest/capture` | `/guest/capture` | `wb://guest/capture` | 匿名 | `guest_capture.html`（P1）|
| **P-SHARED** | **分享链只读预览** | `pages/shared/view` | `/s/:shareToken` | `wb://s/:shareToken` | 匿名 | `shared_view.html`（P1）|
| **P-WELCOMEBACK** | **回流唤起**（P1）| `pages/welcome/back` | `/welcome-back` | `wb://welcome-back` | 匿名（设备指纹命中）| `welcome_back.html`（P1）|
| **P-OBSERVER** | **观察者会话**（P1）| `pages/observer/home` | `/observer` | `wb://observer/:code` | 观察者 | `observer_home.html`（P1）|
| P00 | 启动 / 登录 | `pages/auth/login` | `/auth` | — | 匿名 → 正式 | `00_login.html` |
| P-HOME | **今日聚合首页** | `pages/home/today` | `/` | `wb://home` · `wb://home?focus=review` | 正式账号 | `01_home.html` |
| P02 | 拍题相机 | `pages/camera/capture` | `/capture` | `wb://capture` | 正式账号（游客走 P-GUEST-CAPTURE）| `02_capture.html` |
| P03 | AI 分析中 | `pages/camera/analyzing?taskId=` | `/analyzing/:taskId` | `wb://analyzing/:taskId` | 正式 / 游客共用 | `03_analyzing.html` |
| P04 | AI 分析结果 | `pages/camera/result?qid=` | `/question/:qid/result` | `wb://result/:qid` | 正式 / 游客共用 | `04_result.html` |
| P05 | 错题本列表 | `pages/wrongbook/list` | `/wrongbook` | `wb://wrongbook` | 正式 / 观察者只读 | `05_wrongbook_list.html` |
| P06 | 错题详情 | `pages/wrongbook/detail?qid=` | `/wrongbook/:qid` | `wb://wrongbook/:qid` | 正式 / 观察者只读 | `06_wrongbook_detail.html` |
| P07 | 今日复习 | `pages/review/today` | `/review` | `wb://review/today` | 正式 | `07_review_today.html` |
| P08 | 复习执行 | `pages/review/exec?nodeId=` | `/review/exec/:nodeId` | `wb://review/exec/:nodeId` | 正式 | `08_review_exec.html` |
| P09 | 复习完成 | `pages/review/done?nodeId=` | `/review/done/:nodeId` | — | 正式 | `09_review_done.html` |
| P10 | **日历月视图**（二级页） | `pages/calendar/month` | `/calendar/month` | `wb://calendar` | 正式 / 观察者只读 | `10_calendar_month.html` |
| P11 | **事件详情 · 双形态**（融合锚点） | `pages/event/detail?eventId=` | `/event/:eventId` | `wb://event/:eventId` | 正式 / 观察者只读 / 分享链脱敏 | `11_event_detail.html` |
| P12 | 通知中心 | `pages/notification/list` | `/notifications` | `wb://notifications` | 正式 | `12_notifications.html` |
| P13 | 设置 / 我的 | `pages/me/settings` | `/me` | `wb://me` | 正式 | `13_settings.html` |

**深链默认落位策略**（方案 β）：

- `wb://home` → P-HOME，自动滚动到"今日复习大卡"位置（`focus=review`）。
- `wb://review/exec/:nodeId` → 登录未过期直达 P08；登录过期 → P00 → P-HOME → P08。
- 推送消息（T 级复习到期）默认点击跳 `wb://review/exec/:nodeId`，**不再**先落位日历月视图。
- 家长/教师在微信分享点击的"某考试日" → `wb://event/:eventId`（P11 通用事件形态），而非 P10。
- `wb://welcome` → **P-LANDING**（访客落地），冷启动首次默认命中。
- `wb://guest/capture` → **P-GUEST-CAPTURE**（游客拍题一次），设备维度每 24 h 1 次额度。
- `wb://s/:shareToken` → **P-SHARED**（脱敏分享预览），超过 TTL / 令牌无效 → 降级到 P-LANDING。
- `wb://welcome-back` → **P-WELCOMEBACK**（P1 · 回流唤起），设备指纹命中曾登录账号时触发。
- `wb://observer/:code` → **P-OBSERVER**（P1 · 观察者），邀请码一次有效；code 过期 → P-LANDING。

### 2A.3.1 登录态决策树（冷启动 / 深链 / 分享落位统一入口）

所有"首次打开 App / H5 / 小程序"与"深链点击"先经此决策树，再决定落位。**这是替代原先"统一跳 P00"逻辑的新路由层**，由前端 `bootstrap/resolve-entry.ts` + 后端 `GET /api/session/resolve` 协作完成：

```
                   ┌────────────────────────────────┐
                   │  入口（冷启动 / 深链 / 分享链） │
                   └───────────────┬────────────────┘
                                   ▼
                ┌─────────────────────────────────┐
                │  1) 当前是否持有合法 JWT？      │
                └────┬────────────────────────┬───┘
                     │ 是                     │ 否
                     ▼                        ▼
             ┌───────────────┐      ┌──────────────────────┐
             │ 直达目标页或  │      │ 2) URL 含 shareToken │
             │ P-HOME        │      │    / observerCode ？ │
             └───────────────┘      └────┬─────────────┬───┘
                                         │ 是          │ 否
                                         ▼             ▼
                              ┌──────────────┐  ┌───────────────────────┐
                              │ P-SHARED /   │  │ 3) 设备指纹命中已注册 │
                              │ P-OBSERVER   │  │    账号（曾登录）？   │
                              │ （只读/观察）│  └────┬──────────────┬───┘
                              └──────────────┘       │ 是           │ 否
                                                     ▼              ▼
                                          ┌────────────────┐  ┌──────────────┐
                                          │ P-WELCOMEBACK  │  │ P-LANDING    │
                                          │ （回流唤起 P1）│  │ （访客落地） │
                                          └────────────────┘  └──────────────┘
                                                                    │
                                                                    ▼
                                                         「试试看」→ P-GUEST-CAPTURE
                                                         「已有账号」→ P00
```

**决策节点细则**：

| 决策节点 | 判据 | 命中去向 | 未命中去向 |
|---|---|---|---|
| 1. 合法 JWT | `Authorization` 头解出 `student_id` 且未过期 | 直达 depLink 原目标；如无则 P-HOME | 继续节点 2 |
| 2. shareToken / observerCode | URL path 含 `/s/:token` 或 `/observer/:code` | 校验签名 + TTL → P-SHARED / P-OBSERVER | 继续节点 3 |
| 3. 设备指纹命中 | `device_fp` 在 `account_device` 表能回查到 `student_id`（软绑定，允许静默识别） | P-WELCOMEBACK（P1；P0 先按未命中处理） | P-LANDING |

**回退与降级**：
- 节点 2 令牌失效 → 直接 P-LANDING，不落 P00，避免"打开分享链被要求登录"造成二次放弃。
- 节点 3 的设备指纹仅用于"识别 + 提示回登"，**不自动完成登录**，否则触及未成年人信息风控。
- 所有匿名态进入 P-HOME 或其他正式页的 CTA，走 P00 登录后用 `redirect` 参数回到目标页。

**页面跳转全景图**：

```
 ┌──────────────── Anonymous Shell（匿名态 / 无 Tab Bar）────────────────┐
 │                                                                        │
 │     P-LANDING ──「试试看」──► P-GUEST-CAPTURE ──► P03 ──► P04 (游客)   │
 │        │                                                     │         │
 │        │「已有账号 → 登录」                               「保存到错题本」│
 │        │                                                     │         │
 │        │     P-SHARED ◄──分享链/扫码 (shareToken 签名)        │         │
 │        │     P-OBSERVER ◄──观察者邀请码 (P1)                  │         │
 │        │     P-WELCOMEBACK ◄──设备指纹命中 (P1)               │         │
 │        ▼                                                     ▼         │
 └────────┴─────────────────────────────► P00 登录 / 注册 ◄─────┴─────────┘
                                              │
                                              ▼ 成功 (含 guest_session claim)
 ┌────────────────────── Tab Shell（方案 β · 已登录）───────────────────┐
 │                                                              │
 │   ┌──────────────────────────────────────────────┐           │
 │   │  Tab 1 · P-HOME 今日聚合首页                  │◄── 默认落位
 │   │  · 今日复习大卡 (→ P07/P08)                   │           │
 │   │  · 本周条带 (→ P10 完整日历)                  │           │
 │   │  · 消息聚合 (→ P11 事件详情 / P12 通知)       │           │
 │   │  · 薄弱知识点 · 快捷入口 2×2                  │           │
 │   └────┬─────────────────┬──────────────┬────────┘           │
 │        │                 │              │                    │
 │        ▼                 ▼              ▼                    │
 │  [Tab 2 错题本 P05]  [Tab 3 拍题 P02]  [Tab 4 复习 P07]  [Tab 5 我的 P13]
 │        │                 │              │                    │
 │        ▼                 ▼ 上传完成     ▼ 单题 / 全部开始     │
 │  [错题详情 P06]    [分析中 P03]──►[结果 P04]──保存──►[列表 P05]
 │                         │                                    │
 │                         └──失败/取消──返回 P02                │
 │                                                              │
 │                              [执行 P08]──自评──►[完成 P09]   │
 │                                                   │          │
 │                                                   ▼          │
 │                                     继续 → 下一题 P08         │
 │                                     结束 → 回 P-HOME          │
 │                                                              │
 │   ┌──── 二级页（从首页 / 我的 / 通知 / 深链进入）────┐        │
 │   │  P10 日历月视图 ◄──┐                             │        │
 │   │      │             │ relation 查询               │        │
 │   │      ▼             │                             │        │
 │   │  P11 事件详情（双形态）                           │        │
 │   │      ├─ 复习节点形态 ──立即复习──► P08           │        │
 │   │      └─ 通用事件形态（考试/家庭）── 仅查看/编辑  │        │
 │   │  P12 通知中心 ──点击未读复习──► P08              │        │
 │   └──────────────────────────────────────────────────┘        │
 └──────────────────────────────────────────────────────────────┘
```

**硬性导航规则**（开发必须遵守）：

1. `P03` 只能由 `P02` 或推送深链进入；`P03` 页不允许左滑返回，取消分析走「取消任务 API」后才能退出。
2. `P04 保存` 成功后默认跳 `P05`（列表），且对刚保存的 `question` 置顶高亮 3 秒。
3. `P08` 若强制关闭（左上角 ×），弹二次确认 Sheet，未自评则视为「本次跳过」，节点保持原计划。
4. `P09` 点 "继续复习" → 自动取队列下一题 → `P08`；"结束本次" → 返回 **P-HOME** 并刷新"今日复习大卡"的进度。
5. **推送深链优先级**：登录未过期 → 目标页；登录过期 → `P00 → 目标页`（带 `redirect` 参数）；目标页不存在或已过期 → 降级到 **P-HOME** 而非 P10。
6. **P10 ↔ P11 的来源感知**：P11 从 P10 进入时，顶部返回指向 "4月"；从 P-HOME 消息卡进入时，返回指向"首页"；从 P12 通知进入时，返回指向"通知"。使用 `navigator.state.from` 字段决定。
7. **P-HOME 周条带**：点击某日 → P10 `/calendar/month?anchor=YYYY-MM-DD`；点击某日"· n 题复习"徽章 → P07 `/review?date=YYYY-MM-DD`（直接过滤该日队列，而非走日历）。
8. **匿名 Shell 硬性规则**：
   - P-LANDING / P-SHARED / P-WELCOMEBACK 不得出现 Tab Bar；P-GUEST-CAPTURE 允许显示"返回落地页"回退按钮但不得伪装成 Tab Bar 的"拍题 Tab"。
   - P-GUEST-CAPTURE 全流程**禁用 T0/T1 节点生成**：仅返回分析结果（写 `guest_session.analysis_result_json`），不调用 review-plan-service。
   - P-SHARED 点击任何写操作（评论 / 收藏 / 立即复习）都要求先完成 P00 登录，并在登录成功后回到 P-SHARED 的原锚点。
   - 观察者会话的 `OBSERVER` JWT **不得写任何 `wb_` 表**；所有写请求网关直接 403。
   - 游客态每个设备每自然日（Asia/Shanghai 00:00 重置）允许 **1** 次 `POST /api/guest/analyze`；额度耗尽后点「拍一道」直接跳 P00 而非 P-GUEST-CAPTURE。

### 2A.3.2 匿名态页面规格卡（5 张 · P-LANDING / P-GUEST-CAPTURE / P-SHARED / P-WELCOMEBACK / P-OBSERVER）

> 匿名态页面统一 Shell 规范：无 Tab Bar；顶部统一留 **Logo 左上 · 登录/注册右上** 的透明胶囊按钮；底部可出现全屏浮层 CTA，但不允许模拟 Tab Bar 的 5 图标阵列（避免用户误以为已登录）。埋点事件前缀统一为 `anon_`，事件需附带 `device_fp`、`entry_source`、`experiment_bucket` 三个通用属性。

#### P-LANDING · 访客落地页（价值橱窗）

| 维度 | 说明 |
|---|---|
| **页面ID / 路径** | P-LANDING / `/welcome` · 小程序 `pages/landing/welcome` · 深链 `wb://welcome` |
| **首屏目标（≤3s 注意力）** | ① 30 秒内明白"这是一个能自动排复习的拍题工具"；② 看到真实样例长什么样；③ 做出"试试看 / 已有账号"的选择 |
| **布局分区**（从上到下） | `[极光 hero + Slogan + 30s 演示动图]` → `[三步漫画：拍 → 分析 → 排进日历]` → `[3 组样例错题 Chips（数学 / 英语 / 物理，可点开 P-SAMPLE 浮层）]` → `[双 CTA 吸底："试试看（无需注册）" · "已有账号 → 登录"]` → `[家长 / 老师入口（小字）→ P-SHARED 说明页]` |
| **核心组件** | HeroDemo · ThreeStepComic · SampleChips · DualCTA · ParentHint · ConsentBar（未成年人保护提示） |
| **API 触点** | `GET /api/landing/samples?bucket=` 返回 3 组预置静态样本 + `GET /api/landing/kpi` 返回社区脱敏数据（累计入库 X 万题 / 日均分析 Y 次），**都可强缓存** |
| **状态集** | `LOADING`（<150 ms）→ `READY` / `DEGRADED`（接口失败时显示静态 hero） |
| **跳转** | 入：冷启动决策树节点 3 未命中 / `wb://welcome` / 从 P00 点"没有账号？先看看" / P-SHARED 过期降级；出：P-GUEST-CAPTURE（试试看）/ P00（登录）/ P-OBSERVER 说明（家长 / 老师入口，P1）|
| **异常态** | 弱网：hero 退为静态海报；样本加载失败：只露 CTA 与 slogan；地区合规（海外版）：`ConsentBar` 置顶展示 GDPR 提示 |
| **埋点事件** | `anon_landing_view{entry_source}` · `anon_landing_demo_play{sec}` · `anon_landing_sample_open{subject}` · `anon_landing_cta_try` · `anon_landing_cta_login` |
| **A/B 实验位** | `hero_copy_v1/v2`、`sample_count_3/5`、`cta_order_try_first / login_first` |
| **性能预算** | 首屏 TTI ≤ 1.0 s；hero 动图 ≤ 300 KB（WebP / APNG）；总包 ≤ 180 KB（不含动图）|

#### P-GUEST-CAPTURE · 游客拍题（Try Before Signup）

| 维度 | 说明 |
|---|---|
| **页面ID / 路径** | P-GUEST-CAPTURE / `/guest/capture` · 小程序 `pages/guest/capture` · 深链 `wb://guest/capture` |
| **首屏目标（≤3s 注意力）** | ① 对标 P02 的拍题体验，最小差异；② 顶部明显提示"**游客模式 · 本次不会保存到错题本**"；③ 额度剩余 N/1 可见 |
| **布局分区** | `[顶部游客横幅（额度 + 改登录的链接）] [取景器 70%] [学科 Chips] [模式 Tabs] [快门 + 辅助]` |
| **核心组件** | GuestBanner · CameraPreview · SubjectQuickSwitcher · Shutter · GuestQuotaHint |
| **API 触点** | `POST /api/guest/analyze`（见 §10）：请求体携带 `device_fp` + 图片；后端下发 `guest_session_id`，分析链路与正式账号共用 `ai-analysis-service`，**不写 wrongbook / review-plan** |
| **状态集** | `IDLE` → `UPLOADING` → `ANALYZING`（跳 P03 游客态）→ `RESULT`（跳 P04 游客态）→ `QUOTA_EXHAUSTED`（跳 P00）|
| **跳转** | 入：P-LANDING「试试看」/ 深链；出：P03（分析中，顶部横幅保留）/ P00（额度耗尽）/ P-LANDING（用户主动返回）|
| **异常态** | 额度耗尽：整页挡板 `你今天的免费额度已用完，注册后不限次` + CTA 到 P00；AI 失败：**不扣减额度**，静默重试 1 次后降级 `Toast + 建议注册` |
| **埋点事件** | `anon_guest_capture_view` · `anon_guest_capture_shoot` · `anon_guest_analyze_start` · `anon_guest_analyze_done{latency}` · `anon_guest_quota_exhausted` |
| **防刷控制** | 设备指纹（IndexedDB + Canvas + UA 组合）+ IP 维度 Redis bucket：`rate:guest:fp:{fp}` 1/day，`rate:guest:ip:{ip}` 10/day；触发 `429` 后前端降级到挡板页 |
| **合规要求** | 未成年人保护：上传图片前弹 `我已阅读 <未成年人信息保护声明>`，本地记录 `consent_at`；照片不落持久化 OSS，只 **内存 + 5 分钟签名预签名** 供 AI 调用 |

#### P-SHARED · 分享链只读预览（签名令牌）

| 维度 | 说明 |
|---|---|
| **页面ID / 路径** | P-SHARED / `/s/:shareToken` · 小程序 `pages/shared/view` · 深链 `wb://s/:shareToken` |
| **首屏目标（≤3s 注意力）** | ① 让接收方看到"分享者想让我看什么"（考试日 / 错题卡 / 复习节点）；② 脱敏到不暴露隐私；③ 一步升级为正式账号 |
| **内容形态（3 种）** | `EXAM_DAY`（考试日分享 · 复用 P11 通用事件只读视觉）· `QUESTION`（单题分享 · 复用 P06 视觉，题干打马赛克或仅露标题）· `REVIEW_NODE`（复习节点分享 · 复用 P11 复习形态 + 打码艾宾浩斯曲线）|
| **核心组件** | SharedBanner（"来自 <昵称脱敏> 的分享"）· MaskedContentCard · ShareMetaRow · UpgradeCTA |
| **API 触点** | `GET /api/share/:shareToken` → 返回 `{type, masked_payload, sharer_nick, ttl_sec, signature_valid}`；写操作全部 403 |
| **状态集** | `LOADING` → `READY` / `TOKEN_EXPIRED` / `TOKEN_INVALID` / `TOKEN_REVOKED` |
| **跳转** | 入：微信分享点击 / 扫码 / `wb://s/:token`；出：P00（"登录后完整查看"）/ P-LANDING（令牌失效）/ 外部微信授权页（"关注公众号获取更新"，P1）|
| **脱敏规则** | 题干保留前 12 字 + 打马赛克缩略图；错因诊断完全隐藏；学生昵称做 `*** 同学` 模糊；`relation_id` 不回传前端 |
| **埋点事件** | `anon_share_view{type,sharer_id_hash}` · `anon_share_upgrade_cta` · `anon_share_token_expired` · `anon_share_forward` |
| **令牌安全** | HS256 签名 + `exp ≤ 7d` + `usage_count` 软限制（前端无法拦，后端每次校验）；`revoke_list` Redis Bloom Filter 可在分享者端秒级撤销 |

#### P-WELCOMEBACK · 回流唤起（P1）

| 维度 | 说明 |
|---|---|
| **页面ID / 路径** | P-WELCOMEBACK / `/welcome-back` · 小程序 `pages/welcome/back` · 深链 `wb://welcome-back` |
| **首屏目标（≤3s 注意力）** | ① 让流失用户秒懂"你回来了，账号还在"；② 不要求重输手机号即可回登（一键刷新 Token）；③ 展示"还剩 N 个待复习"制造回归动力 |
| **布局分区** | `[问候 hero："欢迎回来 <nickname>"]` → `[账号摘要卡：最近一次登录 / 未完成节点数 / 已累计入库题数]` → `[主 CTA："一键回登"（一键微信 / Apple / 刷 Token）]` → `[次 CTA："换个账号登录"]` → `[底部提示："X 分钟不操作将退出此页"]` |
| **核心组件** | WelcomeBackHero · AccountSummaryCard · PrimaryOAuthCTA · SwitchAccountLink · AutoExitTimer |
| **API 触点** | `POST /api/session/resolve` 返回 `{fingerprint_matched:true, masked_account:{nick,last_login_at,pending_review}}`；`POST /api/auth/device-refresh` 完成一键回登（要求设备指纹 + 微信 wx.login code 双因子） |
| **状态集** | `LOADING` → `READY` / `DEVICE_MISMATCH`（降级 P00）/ `STUDENT_DELETED`（降级 P-LANDING）|
| **跳转** | 入：冷启动决策树节点 3 命中；出：P-HOME（一键回登成功）/ P00（用户选择换账号）/ P-LANDING（自动超时）|
| **埋点事件** | `anon_welcomeback_view` · `anon_welcomeback_oauth_success` · `anon_welcomeback_switch_account` · `anon_welcomeback_timeout` |
| **合规要求** | 展示 `nickname` 要先打码处理（只露首字 + `*`）；`pending_review` 是数量不是内容，不走详情 |

#### P-OBSERVER · 只读观察者会话（P1）

| 维度 | 说明 |
|---|---|
| **页面ID / 路径** | P-OBSERVER / `/observer` · 小程序 `pages/observer/home` · 深链 `wb://observer/:code`（家长 / 班主任扫码或点链接进入，首访需先兑换一次性邀请码）|
| **首屏目标（≤3s 注意力）** | ① 一眼看到被关注学生最近 7 天掌握率 / 待复习数 / 学科分布；② 不能拍题、不能编辑、不能触发推送；③ 明确"你正在以观察者身份查看 <学生昵称脱敏>" |
| **布局分区** | `[观察者横幅] [学生周报卡] [学科雷达（只读）] [最近错题时间线（只露题型标签）] [若需查看详情 → 复用 P06 只读模式]` |
| **核心组件** | ObserverBanner · WeeklyReportCard · SubjectRadar · RecentTimeline · ReadOnlyDetailWrapper |
| **API 触点** | `POST /api/observer/exchange {invite_code}` → 返回观察者 JWT（`role=OBSERVER`, `student_id`, `scope=READ`）；后续所有请求带该 JWT，网关强制 `scope=READ`；`GET /api/observer/overview`, `GET /api/observer/timeline`（都是只读聚合）|
| **状态集** | `INVITE_VALID` → `READY`；`INVITE_EXPIRED` / `INVITE_REVOKED` → 挡板页 + CTA 联系学生重发 |
| **跳转** | 入：观察者邀请链接；出：P06 只读 / P11 只读 / P-LANDING（会话过期，默认 30 天 TTL + 滑动续期）|
| **埋点事件** | `obs_exchange_success` · `obs_overview_view` · `obs_timeline_tap{subject}` · `obs_detail_readonly_view{qid}` · `obs_invite_expired` |
| **合规 / 权限** | 观察者会话**禁止**访问原图；`masked=true` 统一压图；家长模式下不暴露 `chat_id`、`student_email`；老师模式下 TTL 更长（90 天）但可被学生单点撤销 |

---

### 2A.3.3 P-HOME · 今日聚合首页（方案 β 核心）规格卡

| 维度 | 说明 |
|---|---|
| **页面ID / 路径** | P-HOME / `/` · 小程序 `pages/home/today` · 深链 `wb://home` |
| **首屏目标（≤3s 注意力）** | ① 今日有多少题要复习、现在点一下就能开始；② 本周节奏一眼看清；③ 有无新消息 / 弱项提醒 |
| **布局分区**（从上到下） | `[极光 hero + 问候 + 连续打卡带]` → `[今日复习大卡（圆环进度 / 学科 chips / 全部开始）]` → `[本周走势 sparkline + 4 统计]` → `[七日排期条带（T 级色点 / 考试红 / 家庭蓝）]` → `[消息聚合 3 条]` → `[薄弱知识点专练]` → `[快捷入口 2×2]` |
| **核心组件** | Greeting Hero · StreakBar · TodayReviewCard · WeeklySparkline · WeekStrip · MessagesList · WeakKPHint · QuickEntries |
| **API 触点** | `GET /api/home/today` 单聚合接口（后端内部并发调用 review-plan / wrongbook / notification / calendar）；返回 `{streak, todayReview:{total,done,estMin,subjectDist,circleProgress}, weekSparkline:[7], weekStrip:[{date,reviewCount,examHint,tLevels:[]}], messages:[3], weakKP, quickEntries}` |
| **状态集** | `LOADING` → `READY` / `EMPTY(今日无待复习)` / `ERROR(网络/服务降级)` |
| **跳转** | 入：登录成功 / Tab 1 / `wb://home` / P09 结束本次；出：P07（大卡→"全部开始"）/ P08（小卡片→单题）/ P10（条带→月视图）/ P11（消息条目→事件）/ P05（快捷→错题本）/ P02（快捷→拍题）/ P12（消息聚合→通知） |
| **异常态** | `今日无复习`：hero 退为 "今天没有复习安排，拍一道新题试试？" CTA →P02；`服务降级`：顶部黄条 "部分数据正在同步"，允许拉下刷新；`首次登录`：引导 onboarding 三步浮层 |
| **埋点事件** | `home_view` · `home_today_start_all{count,estMin}` · `home_week_tap{date}` · `home_msg_tap{type,refId}` · `home_weak_kp_drill{kpId}` · `home_quick_entry{target}` |
| **性能预算** | 首屏 TTI ≤ 1.2 s（聚合接口 P95 ≤ 400 ms；骨架屏同时渲染，数据到达后平滑替换） |


### 2A.4 逐页面规格卡（UI / 交互 / 数据 / 接口 / 状态 / 埋点）

> 每张卡都是一份可直接交付给 AI 的"单页 Spec Sheet"。建议前端按此顺序 1:1 实现。

#### P02 · 拍题相机（Capture）

| 维度 | 规格 |
|---|---|
| **页面目的** | 把"一道错题"用最少动作变成一份上传 |
| **布局分区** | `[顶部安全区] [取景器 70%] [学科 Chips] [模式 Tabs] [快门区] [辅助操作]` |
| **核心组件** | 相机预览 / 边缘检测框 / 学科快速切换（数学/物理/化学/英语/语文）/ 闪光灯 / 网格线 / 图库入口 / 文件入口 / 快门 78px |
| **数据绑定** | `student.defaultSubject` / `student.lastSubject` / `config.maxFileMB` / `device.permissions` |
| **API 触点** | `POST /api/file/presign` → 拿到上传 URL；`POST /api/wb/questions` 创建 `PENDING` question 并拿到 `questionId` |
| **状态集** | `IDLE` / `FOCUSING` / `CAPTURED(preview)` / `UPLOADING(progress %)` / `UPLOADED → navigate P03` / `ERROR` |
| **跳转** | 入：Tab3 / FAB / P05 右下 +；出：`P03`(success) / 返回 Tab |
| **异常 & 降级** | 权限拒绝 → 引导至系统设置；弱网 → 断点续传 chunk 2 MB；>10 MB 本地压缩到 <4 MB |
| **i18n Key** | `capture.title` / `capture.subject.*` / `capture.tip.lowLight` / `capture.error.permission` |
| **埋点事件** | `wb_capture_open` / `wb_capture_shutter` / `wb_capture_upload_start` / `wb_capture_upload_success{ms,bytes}` |
| **可访问性** | 快门按钮 `aria-label="拍摄"`；边缘检测状态 Live Region 朗读 |

#### P03 · AI 分析中（Analyzing）

| 维度 | 规格 |
|---|---|
| **页面目的** | 让学生在 4–8 s 的 AI 推理等待中保持被"看见"，心态平稳 |
| **布局分区** | `[缩略图卡] [模型 Badge] [4 步流水线] [JSON 流式区] [取消按钮]` |
| **4 步流水线** | `图像预处理 → OCR 题干 → 错因诊断 → 生成解法`（每步 `wait/now/done` 三态） |
| **数据绑定** | `task = { taskId, model, startedAt, steps[], partialJson }` |
| **API 触点** | 小程序：`WebSocket /ws/analyze/{taskId}`；H5：`EventSource GET /api/ai/stream/{taskId}`；取消：`POST /api/ai/cancel/{taskId}` |
| **状态集** | `QUEUED` → `STEP_1..4` → `SUCCEEDED → navigate P04` / `FAILED(errorCode) → retry` / `CANCELLED → back P02` |
| **跳转** | 入：`P02`；出：`P04`(success) / `P02`(cancel/fail) |
| **异常 & 降级** | 模型超时 10 s 自动切备用模型（qwen-vl-max → gpt-4o-mini）；连续 2 次失败进入「手动填写」降级页 |
| **埋点事件** | `wb_ai_stream_start{model}` / `wb_ai_stream_step{step,durMs}` / `wb_ai_stream_done{totalMs,tokens}` / `wb_ai_stream_fail{code}` |
| **禁止行为** | 返回键、左滑返回、系统 Home（小程序）都不能静默丢任务，必须调取消 API |

#### P04 · AI 分析结果（Result）

| 维度 | 规格 |
|---|---|
| **页面目的** | 让学生看懂「错在哪 / 对的是什么 / 为什么 / 下次怎么做」 |
| **布局分区** | `[Hero 题干+公式] [错解 vs 正解 双列] [错因红条] [3 步解法] [知识点+难度] [6 节点预告] [保存 CTA]` |
| **核心组件** | 纸张风缩略图、红 ✗ / 绿 ✓ 双答案卡、公式 chip、KP chips、难度 ★、T1–T6 节点预览、底部蓝色 CTA |
| **数据绑定** | `question{id,subject,stem,formula,myAnswer,correctAnswer,reasonMarkdown,steps[],knowledgePoints[],difficulty,thumbnailUrl,modelInfo}` |
| **API 触点** | `GET /api/wb/questions/{qid}`；`PATCH /api/wb/questions/{qid}`（学生人工修正）；`POST /api/wb/questions/{qid}/save`（确认保存） |
| **状态集** | `DRAFT(AI 出稿) → EDITING(学生改) → SAVED(触发计划生成)` |
| **跳转** | 入：`P03`；出：`P05`(保存) / `P06`(查看详情) / `P02`(重拍一张) |
| **异常 & 降级** | AI 结果置信度 <60% 时顶部黄条「AI 不太确定，请复核」；学生可编辑任意字段后保存 |
| **埋点事件** | `wb_result_view` / `wb_result_edit{field}` / `wb_result_save{subject,kpCount}` / `wb_result_reshoot` |
| **后端副作用** | `save` → `wrongbook-svc` 发 `question.created` → `review-plan-svc` 生成 `plan+node×7` → `calendar-core` 落 `calendar_event`（`relation_type=STUDY`） |

#### P05 · 错题本列表（Wrongbook List）

| 维度 | 规格 |
|---|---|
| **页面目的** | 管理所有历史错题，支持"以知识点找题、以掌握度找题、以语义找题" |
| **布局分区** | `[大标题+搜索] [学科 Chips] [掌握度 Filter Cards] [排序] [错题卡 List] [FAB 拍题]` |
| **核心组件** | 学科计数横滚 Chips（全部/数学 52/…）、掌握度 3 卡片（未掌握 42 / 部分 35 / 已掌握 51）、列表卡（左色条 / 缩略图 / KP / 难度 / 6 段阶段进度 / 下次到期） |
| **数据绑定** | `list{items[], total, filter:{subject,mastery,kp,q}, sort}`；`item{qid,subject,kp[],stemSnippet,thumb,mastery%,nextDueAt,nodeStage/6}` |
| **API 触点** | `GET /api/wb/questions?subject=&mastery=&q=&page=&sort=` |
| **搜索** | 关键字 → `pg_trgm`；语义 → `pgvector` 向量；混合排序 RRF；搜索框右侧 "AI 语义" Badge |
| **状态集** | `LOADING` / `EMPTY` / `LIST` / `ERROR` / `FILTERED`；下拉刷新、上拉加载 |
| **跳转** | 入：Tab2 / `P04 保存`；出：`P06`(点卡片) / `P02`(FAB) |
| **埋点事件** | `wb_list_view{total}` / `wb_list_filter{subject,mastery}` / `wb_list_search{q,mode}` / `wb_list_tap{qid}` |

#### P06 · 错题详情（Detail）

| 维度 | 规格 |
|---|---|
| **页面目的** | 单题"档案页"，沉淀每题学习历史、给学生提供"想练就能练"的入口 |
| **布局分区** | `[原图卡] [Segment: 分析 / 复习记录 / 变式] [AI 简报] [艾宾浩斯时间线] [能力雷达] [底部 CTA]` |
| **核心组件** | 原图 170px（支持放大）、Segment Tab、AI 分析简报卡（含错因红条）、SVG 遗忘曲线 + 6 节点（done/now/future 三态）、五维能力雷达、`归档 / 立即复习` 双按钮 |
| **数据绑定** | `detail{question, analysis, nodes[], records[], radar{axes,values}, variants[]}` |
| **API 触点** | `GET /api/wb/questions/{qid}`；`GET /api/wb/questions/{qid}/nodes`；`GET /api/wb/questions/{qid}/records`；`POST /api/wb/questions/{qid}/archive`；`POST /api/review/nodes/{nid}/start` |
| **状态集** | `VIEW` / `ARCHIVED(归档后只读)` |
| **跳转** | 入：`P05` / `P04`（查看详情）；出：`P08`(立即复习) / `P05`(归档后返回) |
| **埋点事件** | `wb_detail_view{qid}` / `wb_detail_tab{tab}` / `wb_detail_archive` / `wb_detail_review_now` |

#### P07 · 今日待复习（Today Review）

| 维度 | 规格 |
|---|---|
| **页面目的** | 把"今天应复习的 N 题"按时间窗排序并一键开始 |
| **布局分区** | `[Hero 渐变卡: 总览] [3 统计卡: 完成/进行/未开始] [进度条+掌握度] [时段 1: 现在·上午] [时段 2: 下午] [底部 CTA 全部开始]` |
| **核心组件** | Hero 渐变（深蓝→靛）+ 气泡粒子；时段分组（现在 / 上午 / 下午 / 晚上）；每题卡：时间列（HH:MM + T 级 pill）+ 左色条 + 学科/KP + 2 行题干 + 倒计时（now 红/soon 橙/wait 灰）；底部蓝色 CTA |
| **数据绑定** | `today{date,tzOffset,totalCount,estMinutes,doneCount,inProgressCount,waitCount,progressPct,masteryPct,slots[{slotKey,items[]}]}` |
| **API 触点** | `GET /api/review/today?tz=Asia/Shanghai`；`POST /api/review/sessions`（批量开始）；`GET /api/review/nodes/{nid}` |
| **状态集** | `EMPTY(今日无题 → 恭喜态)` / `LIST` / `ALL_DONE(庆祝态)` |
| **跳转** | 入：Tab4 / 推送深链 / `P06 立即复习`；出：`P08`(单题或全部开始) |
| **异常 & 降级** | 无网络 → 走本地缓存节点；节点跨天 → 后端每小时 `XXL-Job node-ready-scan` 兜底 |
| **埋点事件** | `wb_today_view{count}` / `wb_today_start_all{count}` / `wb_today_start_one{nid}` |

#### P08 · 复习执行（Review Execute）

| 维度 | 规格 |
|---|---|
| **页面目的** | 学生在不看答案的前提下重做一次 → 自评 → 驱动节点推进 |
| **布局分区** | `[进度条 25%] [题元信息 Chips] [题干卡] [手写作答区] [揭示答案卡] [6 节点时间线] [底部 3 按钮: 未掌握/部分/已掌握]` |
| **核心组件** | 顶部进度条 + "第 2/8 题" + ×；题元 Chips（T2 · 第 2 次 / 学科 / 难度）；题干卡（Hero 风）；作答区（手写 / 键盘 / 公式面板 3 模式 Tab）；揭示答案（绿色高亮 + 3 步解法）；自评三按钮（红 ✗未掌握 / 橙 ◐部分 / 绿 ✓掌握） |
| **数据绑定** | `exec{sessionId, cursor:2, total:8, node{nid,T,openedAt}, question{...}, answerDraft, revealed:false}` |
| **API 触点** | `POST /api/review/nodes/{nid}/open`（记录开始时间）；`POST /api/review/nodes/{nid}/reveal`（揭示）；`POST /api/review/nodes/{nid}/grade` body `{grade: MASTERED|PARTIAL|FORGOT, timeSpentMs, answerText}` |
| **状态集** | `READING(题干)` → `ANSWERING(作答中)` → `REVEALED(已揭示)` → `GRADED(自评完成 → navigate P09)` |
| **跳转** | 入：`P07` / `P06` / 通知深链；出：`P09`(grade 成功) |
| **自评语义** | MASTERED → 推进到 T+1；PARTIAL → 原计划不变；FORGOT → 取消后续节点，从当前时间重置为 T0 重排 |
| **埋点事件** | `wb_exec_open{nid,T}` / `wb_exec_reveal{nid,waitMs}` / `wb_exec_grade{nid,grade,totalMs}` / `wb_exec_skip{nid}` |
| **禁止行为** | 揭示前不能看答案；强制关闭弹二次确认；已揭示后不能再"掌握" only "部分/未掌握" |

#### P09 · 复习完成（Review Done）

| 维度 | 规格 |
|---|---|
| **页面目的** | 即时正反馈 + 展示记忆曲线推进 + 引导下一题 |
| **布局分区** | `[绿色庆祝 Hero: 大对勾+粒子] [记忆曲线卡: T1…T6 点] [AI Advance Banner] [下次复习卡+加日历] [今日战绩 3 stat] [KP 掌握度变化] [CTA: 结束/继续]` |
| **核心组件** | 庆祝 Hero（绿渐变 + confetti + 大对勾）；SVG 遗忘曲线 + 6 节点（T1/T2 done / T3 now 脉冲 / T4-T6 gray）；下次复习日期 + "加日历"按钮；3 统计卡（已掌握 / 部分 / 遗忘）；KP 列表（条形） |
| **数据绑定** | `done{nid, previousT, nextT, nextDueAt, masteryPct, todayStats{mastered,partial,forgot,total}, kpDelta[{kp,oldPct,newPct}]}` |
| **API 触点** | `GET /api/review/nodes/{nid}/result`；`POST /api/review/sessions/{sid}/next`（取下一题）；`POST /api/calendar/events/{eid}/subscribe`（+ 日历） |
| **状态集** | `RESULT` / `ALL_DONE(今日全部完成 → 庆祝升级态)` |
| **跳转** | 入：`P08`；出：`P08 下一题` / `P07 返回列表` / `P09 加入日历` |
| **埋点事件** | `wb_done_view{nid,nextT}` / `wb_done_continue` / `wb_done_exit` / `wb_done_add_calendar` |

### 2A.5 关键状态机（Entity State Machines）

**Question（错题卡）**：
```
PENDING ──upload done──► ANALYZING ──AI 成功──► READY ──学生保存──► ACTIVE
   │                        │失败≥3                    │归档
   └──────user cancel──────►CANCELLED              ARCHIVED
                             │
                             ▼ fallback 手填
                           READY(manual)
```

**ReviewNode（复习节点，由 ReviewPlan 生成 T0..T6）**：
```
SCHEDULED ──ready_at 到──► READY ──推送成功──► PUSHED ──学生进入 P08──► OPEN
                                │24h 未操作                           │
                                ▼                                    ▼
                             EXPIRED                        GRADED(MASTERED|PARTIAL|FORGOT)
                                                                     │
                                          ┌──MASTERED→推进下一节点─┘
                                          │PARTIAL →原计划不变
                                          └FORGOT →当前及后续取消 + 从 now 重排 T0
```

**PushTask（推送任务）**：`PLANNED → SENDING → SENT / FAILED(retry≤3) → DEAD`，幂等键 `MD5(nodeId + scheduledAt)`。

**GuestSession（游客会话）**：
```
CREATED ──POST /api/guest/analyze──► ANALYZING ──AI 成功──► RESULT_READY
   │                                     │失败≥2                │
   │                                     ▼                       ▼
   └──────ttl 过期(24h)──► EXPIRED   FAILED              ┌──用户注册 claim──► CLAIMED(student_id)
                                                         │
                                                         └──ttl 过期──► EXPIRED
```

**ShareToken（分享令牌）**：`ISSUED → ACTIVE(查询命中 signature_valid) → EXPIRED(ttl 到) / REVOKED(分享者主动撤销) / EXHAUSTED(usage_count 超限)`；状态机由 share-service 维护，前端只做只读展示。

**ObserverSession（观察者会话，P1）**：`INVITE_ISSUED → EXCHANGED(换到 OBSERVER JWT) → ACTIVE(滑动续期) → EXPIRED / REVOKED_BY_STUDENT`；所有写操作在网关直接 403，不进入此状态机。

### 2A.6 User Story → 页面 → 接口 映射（供 AI 直接派发任务）

| Story ID | 用户故事（I want to…） | 涉及页面 | 关键接口 | 验收标准 |
|---|---|---|---|---|
| US-01 | 作为学生，我想 10 秒内把一道错题拍进系统 | P02→P03→P04→P05 | `/file/presign` → `/wb/questions` → `/ai/analyze` → `/wb/questions/{qid}/save` | 首次上传到入库 P95 ≤ 12 s |
| US-02 | 作为学生，我想看到 AI 为什么判我错 | P04 | `/wb/questions/{qid}` | 包含错因文本 + 正解 + 3 步 |
| US-03 | 作为学生，我想找"所有我还没掌握的二次函数题" | P05 | `/wb/questions?subject=数学&mastery=weak&q=二次函数` | 返回含 KP 命中的语义结果 |
| US-04 | 作为学生，我想被按时提醒复习 | 推送 → P07/P08 | 订阅消息 + `/review/today` | 触达时间偏差 ≤ 30 s |
| US-05 | 作为学生，我想诚实告诉系统"我又忘了" | P08→P09 | `/review/nodes/{nid}/grade` (FORGOT) | 后续节点全取消，从 now 重排 |
| US-06 | 作为学生，我想看到自己在这题上的进步 | P06/P09 | `/records` + `radar` | 展示 ≥5 次复习轨迹 + 掌握度变化 |
| US-07 | 作为学生，我不想在免打扰时段被打扰 | P13 | `/me/preferences` | 23:00–07:30 不发推送 |
| US-08 | 作为学生，我想一屏看到"今天要做什么" | P-HOME | `/home/today`（聚合接口） | 首屏 TTI ≤ 1.2 s，含 today 卡 + 周条 + 消息 3 条 |
| US-09 | 作为学生，我想在完整日历中按月查看所有排期 | P-HOME → P10 → P11 | `/calendar/events?month=` + `/event/:id` | 月视图含复习色点 + 考试红点，点击进入事件详情双形态 |
| US-10 | 作为**陌生访客**，我想 30 秒内看懂这是什么工具，并能立刻看到样例 | P-LANDING | `/landing/samples` + `/landing/kpi` | 首屏 TTI ≤ 1.0 s；3 组样例可展开；双 CTA 漏斗转化 ≥ 35% |
| US-11 | 作为**犹豫期用户**，我想不注册就试一道错题看看效果 | P-LANDING → P-GUEST-CAPTURE → P03 → P04 | `/guest/analyze` + `/guest/claim` | 每设备 1/天；注册后一键 claim 历史结果到错题本 |
| US-12 | 作为**分享链接收方**，我想不注册就能看到家人/同学分享给我的内容摘要 | P-SHARED | `/share/:token` | 令牌校验 ≤ 100 ms；脱敏规则通过合规审查；升级转化 ≥ 15% |
| US-13 | 作为**流失用户**，我想在卸载重装后无感回登、看到还有多少待复习（P1） | P-WELCOMEBACK → P-HOME | `/session/resolve` + `/auth/device-refresh` | 指纹命中 ≤ 300 ms；一键回登成功率 ≥ 90% |
| US-14 | 作为**家长 / 班主任**，我想用一次性邀请码换观察者会话看孩子进度（P1） | P-OBSERVER → P06 / P11 只读 | `/observer/exchange` + `/observer/overview` + `/observer/timeline` | 会话只读；90 天 TTL；学生可单点撤销 |

### 2A.7 异常路径 & 降级矩阵

| 场景 | 触发 | 页面反馈 | 系统行为 |
|---|---|---|---|
| 权限拒绝 | P02 相册 / 相机 | 引导卡片 + "去设置"按钮 | 降级到文件选择 |
| 弱网上传 | P02 上传进度卡死 | 显示重传按钮 + 已上传 %（断点续传） | chunk 2 MB 分片，重试 3 次 |
| AI 超时 | P03 >10 s 无首字节 | 顶部黄条"切换备用模型中" | 自动切 `gpt-4o-mini` |
| AI 彻底失败 | 连续 2 次 fail | 进入手动填写兜底页 | 保留已 OCR 的题干文本 |
| 低置信度 | AI conf < 0.6 | P04 顶部黄条"AI 不太确定" | 强制学生确认后才 save |
| 节点漂移 | XXL-Job 延迟 | P07 Banner "数据同步中" | reminder-svc hourly 补偿扫描 |
| 推送被拒 | 学生未授权订阅 | P12 小红点 + 站内消息 | 降级站内消息，不丢节点 |
| 跨设备并发 | 同节点被两端标记 | Toast "已在另一设备完成" | `idempotency_key` 去重，返回最终态 |
| 时区变化 | 用户跨时区登录 | P13 询问"是否切换到 XX 时区" | 重算 `due_at` 展示，存 UTC |
| 登录过期 | 任意页 401 | 自动弹窗→P00 | 保留 `redirect` 回到原页 |
| P10 → P11 返回错乱 | 来源不同 | 返回键指向父级（首页/通知/日历） | 使用 `from=HOME|CAL|NOTIF` 决定返回文案 |
| **分享链令牌失效** | P-SHARED 返回 `410 TOKEN_EXPIRED` | 挡板页"这个分享已过期" + CTA 到 P-LANDING | 不回 P00；不透传 `relation_id` |
| **游客额度耗尽** | `/api/guest/analyze` 返回 `429 QUOTA_EXHAUSTED` | P-GUEST-CAPTURE 整页挡板 + "注册后不限次" CTA | 额度桶按设备指纹 + IP 双维度，阻挡 bot |
| **AI 对游客失败** | `/api/guest/analyze` 连续 2 次失败 | P03 游客态顶部红条 + "建议注册后重试" | **不扣减额度**；`guest_session.status=FAILED` 供后续 claim 重分析 |
| **设备指纹漂移** | P-WELCOMEBACK 查到多候选账号 | 降级 P00 "选择一个账号" | 任何歧义都不自动完成登录 |
| **观察者会话被撤销** | 任意只读页 `403 OBSERVER_REVOKED` | 弹窗 "学生已撤销你的查看权限" → P-LANDING | JWT 黑名单 Redis 秒级生效 |

### 2A.8 埋点事件字典（Analytics Dictionary）

| 事件名 | 触发页 | 关键属性 | 用于 |
|---|---|---|---|
| `wb_capture_upload_success` | P02 | `ms, bytes, subject` | 上传性能 / 学科分布 |
| `wb_ai_stream_done` | P03 | `totalMs, tokens, model` | AI 可用率 / 成本 |
| `wb_result_save` | P04 | `subject, kpCount, diff` | 入库转化 |
| `wb_list_search` | P05 | `q, mode(kw/sem), resultCount` | 搜索有效性 |
| `wb_today_start_all` | P07 | `count, estMin` | 复习启动率 |
| `wb_exec_grade` | P08 | `nid, T, grade, totalMs` | 掌握度分布 |
| `wb_done_continue` | P09 | `nid, nextT` | 连续复习深度 |
| `wb_push_click` | 通知 | `taskId, channel` | CTR |
| `anon_landing_view` | P-LANDING | `device_fp, entry_source, experiment_bucket` | 冷启动漏斗入口 |
| `anon_landing_cta_try` | P-LANDING | `device_fp` | Try Before Signup 起点 |
| `anon_guest_analyze_done` | P-GUEST-CAPTURE | `device_fp, latency, subject, success` | 游客 AI 可用率 |
| `anon_guest_claim_success` | P00 → P-HOME | `guest_session_id, student_id, ms` | 游客 → 注册转化 |
| `anon_share_view` | P-SHARED | `type, sharer_id_hash, token_age` | 分享二跳 |
| `anon_share_upgrade_cta` | P-SHARED | `type, cta_variant` | 分享 → 注册转化 |
| `anon_welcomeback_oauth_success` | P-WELCOMEBACK | `device_fp, elapsed_days` | 回流率 |
| `obs_exchange_success` | P-OBSERVER | `invite_code_hash, role` | 观察者激活 |
| `obs_detail_readonly_view` | P06 / P11 只读态 | `qid, student_id_hash` | 家长 / 老师粘性 |

埋点统一经由 `packages/analytics` 包，小程序端落 `wx.reportAnalytics`，H5 端落 `beacon.send`，服务端 `ClickHouse`（P1）或先落 `PostgreSQL` 明细表（MVP）。**所有 `anon_` / `obs_` 事件必须携带 `device_fp`（未登录）或 `student_id_hash`（观察者），禁止携带原始 PII**。

### 2A.9 AI Handover 清单（"一把梭"生成代码时请读这里）

当要求 AI 生成代码 / 设计稿时，把以下 **7 份输入 + 1 份输出契约** 一起丢进上下文，即可保证一致性：

| 输入 | 文件 / 章节 |
|---|---|
| 1. 业务目标 | §1 业务目标与产品定义 |
| 2. 端到端业务流 | §2 业务流程（端到端） |
| 3. **本章 Journey（本节）** | §2A |
| 4. 数据模型 | §4 数据库设计 |
| 5. 接口契约 | §10 关键 API 契约 |
| 6. 艾宾浩斯规则 | `design/艾宾浩斯.md` + §7 |
| 7. 视觉基线 | `design/mockups/wrongbook/00..13.html` + `index.html` 作品集 |
| 8. **场景编排** | **§2B 全 15 个 SC 卡 + QA 用例（10 登录态 SC-01..SC-10 + 5 匿名态 SC-11..SC-15）** |

| 输出契约 | 要求 |
|---|---|
| 前端页面 | 每页一个独立组件文件，使用 §2A.4 规格卡的字段 1:1 映射 Props；状态集用 XState 或 React useReducer；路由用 §2A.3 路由表；埋点用 §2A.8 字典 |
| 后端接口 | Controller / Service / Mapper 三层；所有 API 路径与 §2A.4 "API 触点" 列一致；幂等键 `idempotency_key` 必须在 headers；异常走全局 `GlobalExceptionHandler` 并返回 §附录 错误码 |
| 测试用例 | 每个 Story（§2A.6）至少一条 E2E 用例（Playwright / miniprogram-automator），场景编排（§2B）覆盖率 100% |
| i18n | 所有文案走 `packages/i18n/zh-CN/**`，key 命名遵循 §2A.4 i18n Key 列前缀 |

---

## 2B. 场景编排（Scenario Choreography · 用户操作 → 页面流转 → 系统响应 逐帧脚本）

> **为什么有这一章**：§2A 是静态规格——"每一页上有什么"；§2B 是动态脚本——"用户敲了这一下，页面 / 前端状态 / 后端 / 事件 分别发生什么"。四角色共用同一份表：
>
> - **UI/UX 高保真**：读"页面前台变化"列决定动效时序、Toast / Haptic / 弹层出现时刻
> - **前端开发**：读"前端状态"列写 reducer / XState transition；读"耗时预算"做骨架屏和过渡动画
> - **后端开发**：读"后端/事件"列画时序图；读"断言点"设计幂等与补偿
> - **QA**：读"GIVEN/WHEN/THEN"表直接变成手测脚本，Playwright 骨架见 §12.S9
>
> **本章与 §2A 的关系**：§2B 不重复定义任何组件 / 接口 / 状态名。所有名词都**指向** §2A 已有实体（页面 ID、API 路径、状态机、异常矩阵）。若 §2A 变更，§2B 对应 SC 卡必须同步修订——请把这作为 PR 检查清单第一项。
>
> **本章不做什么**：不是路径穷举。穷举靠 §2A.5 状态机 + §2A.7 异常矩阵。本章只写"典型业务场景的典型编排"。

### 2B.0 表头图例（Legend）

**核心路径编排表列义**：

| 列 | 含义 | 谁关心 |
|---|---|---|
| **#** | 步骤序号，从 1 开始 | 全员 |
| **用户动作** | 学生 / 家长在 UI 上的一个原子动作（tap / swipe / type / 等待） | QA · UI/UX |
| **页面前台** | 这个动作发生后屏幕上可见的变化（页面切换 / 组件态变 / Toast / 动效） | UI/UX · 前端 |
| **后端/事件** | 服务端触发的 API / MQ 事件 / DB 写入 / XXL-Job 调度 | 后端 · QA |
| **前端状态** | 该步骤后前端 state machine 的具体状态（来自 §2A.4 状态集列） | 前端 |
| **埋点** | 该步骤上报的埋点事件（来自 §2A.8 字典） | 数据 |
| **耗时预算** | 用户感知耗时上限（P95，动作结束到视觉可见） | 前端 · 性能 |

**QA 用例表列义**（GIVEN/WHEN/THEN 纯文本）：

| 列 | 含义 |
|---|---|
| **TC ID** | `TC-{SC编号}.{序号}`，唯一 |
| **类型** | 正常 / 异常 / 边界 / 安全 |
| **GIVEN** | 前置条件（账号态 / 网络 / 后端 mock / 时间） |
| **WHEN** | 具体动作序列（引用 SC 卡步骤号） |
| **THEN** | 期望断言（UI 可见 / DB 状态 / MQ 事件 / 埋点） |

### 2B.1 场景总览

| SC ID | 场景 | 核心价值 | 覆盖页面 | QA 用例数 |
|---|---|---|---|---|
| SC-01 | 首次拍题 → 今日首次复习完成 | 核心转化漏斗 | P-HOME · P02 · P03 · P04 · P05 | 6 |
| SC-02 | 推送唤起 → 复习执行 → 继续下一题 | 日活核心循环 | 推送 · P08 · P09 · P08 | 5 |
| SC-03 | 首页全部开始 → 连做 5 题 → 中途退出 | 会话连续性 | P-HOME · P08 ×5 · 二次确认 | 4 |
| SC-04 | 自评"忘了" → 节点重排 → 日历批量改写 | 跨域一致性 | P08 · P09 · P10 | 5 |
| SC-05 | 首页条带 → 日历 → 事件详情（复习）→ 立即复习 | 视图融合锚点 | P-HOME · P10 · P11(STUDY) · P08 | 6 |
| SC-06 | 日历 → 事件详情（通用/家庭形态）→ 编辑 | 双形态分支 | P10 · P11(FAMILY) | 4 |
| SC-07 | AI 连续 2 次超时 → 降级手填 | 异常降级 | P02 · P03 · 手填页 · P04 | 4 |
| SC-08 | 跨时区登录 → 日历重算 | 边界情况 | P00 · P13 · P-HOME | 3 |
| SC-09 | 家长分享考试日 → 学生接收 | 协同场景 | 家长端 · P12 · P11(EXAM) | 4 |
| SC-10 | 归档错题 → 级联取消节点 | 跨域写一致性 | P06 · P10 | 4 |
| **SC-11** | **陌生访客 → 落地页 → 样例预览** | 冷启动转化漏斗第 1 环 | P-LANDING · P-SAMPLE 浮层 | 5 |
| **SC-12** | **游客试用 1 次 → 注册 → Claim 历史** | Try Before Signup；MVP 核心增长动作 | P-LANDING · P-GUEST-CAPTURE · P03 游客态 · P04 游客态 · P00 · P-HOME | 6 |
| **SC-13** | **分享链接收方 → 脱敏预览 → 升级注册** | 病毒拉新；补 SC-09 接收端 | 微信分享 · P-SHARED · P00 · P-HOME | 5 |
| **SC-14** | **流失用户回流 → 一键回登 → 进 P-HOME**（P1） | 唤醒沉睡用户 | 冷启动 · 决策树节点 3 · P-WELCOMEBACK · P-HOME | 4 |
| **SC-15** | **家长 / 班主任观察者会话**（P1） | B 端陪跑；P2 班级聚类铺垫 | 邀请码 · P-OBSERVER · P06 只读 · P11 只读 | 5 |
| | **合计** | | | **70** |

---

### 2B.2 SC-01 · 首次拍题 → 今日首次复习完成

**场景目的**：学生第一次走完"拍题 → AI 分析 → 保存入库 → 复习计划落地 → 日历同步 → 首次复习完成"的端到端黄金路径。验证核心转化漏斗。

**前置条件**：学生已完成 P00 登录，首次打开 App 落位 P-HOME；网络良好；相机权限已授予；后端各服务健康。

**核心路径编排**：

| # | 用户动作 | 页面前台 | 后端/事件 | 前端状态 | 埋点 | 耗时预算 |
|---|---|---|---|---|---|---|
| 1 | Tap Tab 3 「拍题」 CTA | P-HOME → P02 全屏模态，相机预授权动画 200 ms | — | `home.READY` → `capture.IDLE` | `home_quick_entry{target=capture}` | 300 ms |
| 2 | 取景、学科切换为"数学" | 取景器边缘检测框贴合题目 | — | `capture.FOCUSING` | `wb_capture_subject_switch{subject=MATH}` | 800 ms |
| 3 | 按下快门 78px | 快门动画 + 底部缩略图飞入预览，触觉反馈 medium | `POST /api/file/presign` → 返回上传 URL | `capture.CAPTURED` | `wb_capture_shutter` | 300 ms |
| 4 | 等待自动上传 | 缩略图上方进度条 0→100%，文字"已上传 1.2 MB" | `PUT {presignedUrl}` 分片上传 | `capture.UPLOADING` | `wb_capture_upload_start / _upload_success{ms,bytes}` | ≤ 2 s |
| 5 | 上传完成自动跳转 P03 | 相机模态淡出，P03 骨架屏（4 步流水线占位） | `POST /api/wb/questions` 创建 PENDING；`POST /api/ai/analyze` 启任务；SSE 订阅 `/api/ai/stream/{taskId}` | `analyzing.QUEUED` → `STEP_1` | `wb_ai_stream_start{model=qwen-vl-max}` | ≤ 500 ms |
| 6 | 观看 AI 推理（4-8 s） | 流水线节点逐步 `wait→now→done`；右侧 JSON 流式打字机；底部"取消分析"始终可点 | SSE `data:{stage:OCR/ANALYSIS/STEPS/DONE}` 持续推送 | `STEP_1..4` | `wb_ai_stream_step{step,durMs}` × 4 | 4-8 s |
| 7 | 推理完成自动跳转 P04 | P03 淡出，P04 Hero 题干 + 公式 + 错解红条浮现，滚动条置顶 | SSE 收到 `DONE` event + `analysis_result` 落库 | `analyzing.SUCCEEDED` → `result.DRAFT` | `wb_ai_stream_done{totalMs,tokens}` / `wb_result_view` | ≤ 300 ms |
| 8 | 滚动浏览错因 / 3 步解法 / 6 节点预告 | 6 节点时间线 T0 done · T1-T6 future | — | `result.DRAFT` | `wb_result_scroll{depth%}` | — |
| 9 | Tap 底部蓝色「保存到错题本」 | 按钮 loading spinner + 触觉 success | `POST /api/wb/questions/{qid}:confirm` (`strategyCode=EBBINGHAUS_STD`) | `result.SAVING` | `wb_result_save{subject=MATH,kpCount=2}` | ≤ 800 ms |
| 10 | 后端链式写入（对用户透明） | — | `question.created.topic` → review-plan 生成 `plan + 7 nodes`；Feign → calendar-core 落 7 条 `calendar_event (relation_type=STUDY)` | `result.SAVED` | — | ≤ 1 s（异步，UI 不等） |
| 11 | 自动跳转 P05 | P04 淡出，P05 列表第一张卡片（刚保存的题）绿色高亮 3 s，滚动已置顶 | `GET /api/wb/questions?sort=created_desc&highlight={qid}` | `list.HIGHLIGHTED` | `wb_list_view{highlightedQid}` | ≤ 500 ms |
| 12 | Tap Tab 1「首页」返回 P-HOME | P-HOME 顶部重新渲染"今日复习大卡" | `GET /api/home/today` 聚合接口 | `home.LOADING` → `home.READY` | `home_view` | ≤ 1.2 s |
| 13 | 观察"今日复习大卡"数字 +1 | 大卡数字"8 题"→"9 题"，圆环进度从 38% 动画到 34% | — | `home.READY` | — | 300 ms 动画 |
| 14 | Tap 大卡「全部开始」 | P-HOME → P07 今日复习列表，滚动自动定位到最新一条 | `POST /api/review/sessions` 创建会话 `sid` | `today.LIST` → `session.OPEN` | `home_today_start_all{count=9}` | ≤ 500 ms |
| 15 | Tap 列表第一题「开始」 | P07 → P08 执行页，进度 1/9 | `POST /api/review/nodes/{nid}/open` | `exec.READING` | `wb_exec_open{nid,T=0}` | ≤ 400 ms |
| 16 | 在作答区用手写输入答案 | 作答 canvas 笔迹实时渲染 | — | `exec.ANSWERING` | `wb_exec_writing_start` | — |
| 17 | Tap「揭示答案」 | 答案卡绿色展开 + 3 步解法 | `POST /api/review/nodes/{nid}/reveal` | `exec.REVEALED` | `wb_exec_reveal{nid,waitMs}` | ≤ 400 ms |
| 18 | Tap 绿色「✓ 已掌握」 | 按钮 loading + 触觉 success + 跳 P09 | `POST /api/review/nodes/{nid}/grade` body `{grade:MASTERED,timeSpentMs}` → 推进 T1 | `exec.GRADED` → `done.RESULT` | `wb_exec_grade{nid,grade=MASTERED,totalMs}` | ≤ 500 ms |
| 19 | 观看 P09 庆祝 Hero | 绿渐变 + confetti + T0→T1 曲线动画推进 | — | `done.RESULT` | `wb_done_view{nid,nextT=1}` | 1 s 动画 |
| 20 | Tap「结束本次」 | P09 → P-HOME，大卡数字 9→8，圆环动画 | — | `home.READY` | `wb_done_exit` | ≤ 500 ms |

**关键断言点（System Invariants）**：

- DB：`wb_question` 1 条（status=ACTIVE），`wb_review_plan` 1 条，`wb_review_node` 7 条（T0=GRADED·MASTERED，T1..T6=SCHEDULED），`calendar_event` 7 条（relation_type=STUDY，第一条 state=COMPLETED 绿色）
- MQ：`question.created.topic` · `review.node.opened` · `review.node.graded` 各 1 条
- Outbox：无未投递消息滞留
- 幂等：重放步骤 9 的 confirm 不产生重复计划（按 `qid` 唯一）

**QA 用例（GIVEN / WHEN / THEN）**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-01.01 | 正常 | 学生新登录 · 网络稳定 · 相机权限已授予 · 后端各服务健康 | 完成 SC-01 步骤 1-20 | 屏幕最终落在 P-HOME · 今日复习大卡数字 -1 · DB 7 个 node（T0 已 GRADED） · 日历 7 个 event（第 1 条 COMPLETED 绿色） · 全部关键埋点上报 |
| TC-01.02 | 异常 | 同上，但步骤 4 上传中途断网 | 网络在 10 秒内恢复 | 断点续传自动继续 · 最终仍到步骤 5 · 不重复创建 question（按 `idempotency_key` 去重） |
| TC-01.03 | 异常 | 同 TC-01.01，但步骤 6 时 qwen-vl-max 超时 > 10 s | 等待 | 顶部黄条显示"切换备用模型中" · 自动切到 gpt-4o-mini · 后续步骤正常完成 · 埋点 `wb_ai_stream_fail{code=TIMEOUT}` 1 条 + `_start{model=gpt-4o-mini}` 1 条 |
| TC-01.04 | 异常 | 同 TC-01.01，但步骤 7 AI 置信度 conf=0.5 | 正常执行 | P04 顶部黄条"AI 不太确定，请复核" · 保存按钮可用但触发前端强制确认弹窗 · DB `analysis_result.confidence=0.5` · 埋点 `wb_result_low_conf` |
| TC-01.05 | 异常 | 同 TC-01.01，但步骤 10 calendar-core 返回 503 | 正常执行 | P04 saveSuccess + 顶部 toast "排期同步中，稍后自动重试" · outbox 表出现 `calendar_event_batch_create` 未投递记录 · 3 次重试后成功 · 最终 DB 7 个 event |
| TC-01.06 | 边界 | 同 TC-01.01，但学生在步骤 18 tap "✗ 未掌握" 而非"已掌握" | 按 SC-01 前 17 步正常 · 步骤 18 改 FORGOT | `grade=FORGOT` · 7 个 node 重新计算（T0=GRADED·FORGOT，T1..T6 全部 CANCELLED 后新建 7 个 SCHEDULED） · 日历旧 6 条 event 删除、新建 7 条 · （详见 SC-04） |

---

### 2B.3 SC-02 · 推送唤起 → 复习执行 → 继续下一题

**场景目的**：学生在"复习提醒"到期时被推送唤起，进入 P08 执行 → 完成 → 自动继续下一题（会话连续性）。验证日活核心循环与深链处理。

**前置条件**：学生已登录且 token 未过期；系统已推送 `T3 D7` 到期消息到手机；推送点击目标 `wb://review/exec/nid=12345`；学生有连续 3 题待复习。

**核心路径编排**：

| # | 用户动作 | 页面前台 | 后端/事件 | 前端状态 | 埋点 | 耗时预算 |
|---|---|---|---|---|---|---|
| 1 | 手机锁屏顶部看到推送"还有 3 题等你复习，韦达定理" | 系统推送横幅 | XXL-Job `node-ready-scan` 已 1 min 前把 nid=12345 置 READY；`node-due-push` 投 MQ；notification-service 调 APNs/微信模板 | — | `wb_push_sent{nid,channel=APNS}` | — |
| 2 | Tap 推送 | App 启动/切前台，闪现 splash 200 ms | 前端解析深链 `wb://review/exec/12345` | `launch.DEEPLINK_PENDING` | `wb_push_click{nid=12345,channel}` | 200 ms |
| 3 | 路由守卫检查登录 | — | `GET /api/auth/verify` 有效 | `launch.AUTH_OK` | — | ≤ 200 ms |
| 4 | 跳到 P08 执行页（**跳过 P-HOME**） | P08 首屏 Hero 渐入，题元 Chips "T3 · 第 3 次 · 数学 · 韦达定理" | `GET /api/review/nodes/12345` + `POST /api/review/nodes/12345/open` | `exec.READING` | `wb_exec_open{nid=12345,T=3}` | ≤ 400 ms |
| 5 | 阅读题干 + 手写作答 | 作答区笔迹 | — | `exec.ANSWERING` | — | — |
| 6 | Tap「揭示答案」 | 绿色答案卡展开 + 3 步解法 + 6 节点时间线高亮 T3 | `POST /api/review/nodes/12345/reveal` | `exec.REVEALED` | `wb_exec_reveal{nid,waitMs}` | ≤ 400 ms |
| 7 | Tap 橙色「◐ 部分掌握」 | 按钮 loading · 触觉 medium · 跳 P09 | `POST /api/review/nodes/12345/grade` body `{grade:PARTIAL,timeSpentMs}` → 节点保持原计划 | `exec.GRADED` | `wb_exec_grade{nid,grade=PARTIAL,totalMs}` | ≤ 500 ms |
| 8 | P09 反馈 Hero（非庆祝态） | 中性卡片"部分掌握 · 计划维持" + 记忆曲线 T3 保持脉冲 + 下一题预告卡"还剩 2 题" | — | `done.RESULT` | `wb_done_view{nid,grade=PARTIAL}` | 500 ms |
| 9 | Tap「继续复习」 | P09 → P08 · 进度 2/3 · 新题元 Chips | `POST /api/review/sessions/{sid}/next` → 返回下一个 nid（12346） · `POST /api/review/nodes/12346/open` | `done.EXIT` → `exec.READING` | `wb_done_continue{prevNid=12345,nextNid=12346}` | ≤ 500 ms |
| 10 | 重复执行 2 题 | … | … | … | `wb_exec_grade{nid=12346,12347,grade}` | … |
| 11 | 最后一题完成后 | P09 **庆祝升级态** "今日复习全部完成 🎉" + 3 统计卡 + KP 掌握度变化 | 服务端检测 session 完成 · `POST /api/review/sessions/{sid}:close` · MQ `review.session.completed` | `done.ALL_DONE` | `wb_done_session_complete{total=3,mastered,partial,forgot}` | — |
| 12 | Tap「结束本次」 | P09 → P-HOME · 大卡数字归零 · 圆环 100% 动画 · 切换为"今天已完成，拍一道新题试试？" hero | `GET /api/home/today` | `home.READY` | `wb_done_exit` | ≤ 1.2 s |

**关键断言点**：

- 深链优先级：直达 P08，不经过 P-HOME；若 token 过期需自动重定向 P00 → P08（带 redirect 参数）
- Session 连续性：3 个 node 属于同一个 `sessionId`，埋点可串起 `wb_exec_open` 的 `sessionId` 字段
- 日历状态：3 条 calendar_event 的 state 各自映射（MASTERED→COMPLETED·绿，PARTIAL→COMPLETED·橙，FORGOT→COMPLETED·橙红）

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-02.01 | 正常 | 学生已登录 · nid=12345 处于 PUSHED 态 · 会话有 3 题 | 完成 SC-02 步骤 1-12 | 3 个 node 全部 GRADED，session 状态 COMPLETED，日历 3 条 event state=COMPLETED（颜色对应 grade），最终落位 P-HOME，今日大卡数字 -3 |
| TC-02.02 | 异常 | 同 TC-02.01，但 token 在步骤 3 时已过期（401） | Tap 推送 | 自动弹"登录已过期"Sheet → 引导 P00 → 登录成功 → 跳 P08 nid=12345 · redirect 参数正确传递 · 不丢埋点 |
| TC-02.03 | 异常 | 同 TC-02.01，但步骤 9 时后端 `/sessions/{sid}/next` 返回 404 (session 已被另一设备关闭) | 点继续 | 弹 Toast "已在另一设备完成" · 返回 P-HOME 刷新 · 埋点 `wb_session_conflict` |
| TC-02.04 | 边界 | 学生已登录 · 会话只有 1 题 | 完成最后一题后 tap 继续 | 因无下一题，自动进入 `ALL_DONE` 庆祝升级态 · 不出现"继续"按钮（只有"结束本次"） |
| TC-02.05 | 安全 | 推送深链被篡改为 `wb://review/exec/99999`（非本学生的 node） | Tap 推送 | 403 Forbidden · 提示"该复习节点不存在或无权访问" · 降级跳 P-HOME · 埋点 `wb_deeplink_forbidden` |

---

### 2B.4 SC-03 · 首页全部开始 → 连做 5 题 → 中途退出

**场景目的**：学生在 P-HOME 触发"全部开始"批量会话，连做若干题后中途主动退出，验证会话连续性、退出恢复语义、未自评题的计划保持。

**前置条件**：学生在 P-HOME · 今日共 8 题 · 已完成 0 · 网络稳定。

**核心路径编排**：

| # | 用户动作 | 页面前台 | 后端/事件 | 前端状态 | 埋点 | 耗时预算 |
|---|---|---|---|---|---|---|
| 1 | Tap "今日复习大卡" 的「全部开始」 | P-HOME → P07 今日列表 → 自动跳转 P08 第 1 题 | `POST /api/review/sessions` body `{date,nodeIds:[...8]}` → 返回 `sid` · `POST /nodes/{nid1}/open` | `home → session.OPEN → exec.READING` | `home_today_start_all{count=8}` | ≤ 800 ms |
| 2-16 | 正常执行第 1-5 题（每题：阅读→作答→揭示→自评） | 每题间 P08→P09→P08 过渡，顶部进度 1/8…5/8 | 每题一组 open/reveal/grade 调用 | 每题在 `READING→ANSWERING→REVEALED→GRADED` | `wb_exec_grade{nid}` × 5 | ≈ 2 min/题 |
| 17 | 第 6 题进入 P08，学生改变主意 Tap 左上「×」 | 弹出二次确认 Sheet "本次复习尚未自评，退出将保留在原计划" [取消/退出] | — | `exec.READING → exec.EXIT_CONFIRM` | `wb_exec_exit_confirm{nid,progress}` | 瞬时 |
| 18 | Tap「退出」 | Sheet 关闭 + 跳 P-HOME | `POST /api/review/sessions/{sid}:pause` body `{lastCompletedNid}` → session 状态 PAUSED | `home.LOADING → home.READY` | `wb_exec_exit{nid=nid6,sessionId=sid}` | ≤ 500 ms |
| 19 | 观察"今日复习大卡" | 数字 8 → 3（已完成 5）· 圆环进度 5/8 · 大卡底部出现 Resume Banner "上次做到第 6 题，点我继续" | `GET /api/home/today` 含 `pausedSession{sid,nextNid=nid6}` | `home.READY (with resume banner)` | `home_view{resume=true}` | ≤ 1.2 s |
| 20 | Tap Resume Banner | 跳 P08 nid=nid6（**保留之前 session**） | `POST /api/review/sessions/{sid}:resume` · `POST /nodes/nid6/open` | `exec.READING` | `home_resume{sid,nextNid}` | ≤ 500 ms |

**关键断言点**：

- 已完成 5 题的 node 都是 GRADED；未完成的 nid6 保持 SCHEDULED（不因进入过 P08 而被消耗）
- 日历 event：5 条 state=COMPLETED，3 条保持 SCHEDULED（不变）
- Session：一个 `sid` 串起 paused + resumed 两段，而不是新建两个 session
- 进入过 P08 但未自评的 nid6 应被埋点记为 `wb_exec_skip{nid=nid6}` 而非 `grade`

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-03.01 | 正常 | P-HOME 有 8 题待复习 · session 不存在 | 完成 SC-03 步骤 1-20 | Session 状态：START→OPEN→PAUSED→OPEN；nid1-5 GRADED，nid6-8 SCHEDULED；大卡 Resume Banner 正确显示与消失 |
| TC-03.02 | 异常 | 同 TC-03.01，但步骤 18 时 `/pause` 返回 500 | Tap 退出 | UI 照常跳 P-HOME · outbox 有 pause 未投递 · 补偿后最终一致 · 若用户在此期间 Tap Resume Banner，先把 pending 操作刷掉再开始 |
| TC-03.03 | 边界 | 学生在 P-HOME 有 paused session · 隔日再打开 | 打开 App | 跨天的 paused session 应自动归档（resumedAt 为空 + createdAt < today 00:00 的 PAUSED 自动置 EXPIRED），大卡不显示 Resume Banner，原 nid6-8 按新一天重排 |
| TC-03.04 | 异常 | 学生 Tap 退出后立即杀掉 App | 重启 App | 打开还是落 P-HOME · Resume Banner 正常出现（PAUSED 已在服务端落地） |

---

### 2B.5 SC-04 · 自评"忘了" → 节点重排 → 日历批量改写

**场景目的**：学生在某 T3 节点自评 FORGOT，验证跨域一致性：复习域取消未来节点 + 重新从 T0 排 7 个，日历域级联删除旧 event 并批量新建。这是最容易出错的一致性场景。

**前置条件**：学生在 P08 执行 T3 节点（nid=500）· qid=200 的 plan 状态：T0/T1/T2 GRADED·MASTERED，T3 OPEN，T4/T5/T6 SCHEDULED · 日历存在 7 条 relation_id=question:200:node:* 的 event（3 COMPLETED + 4 SCHEDULED）。

**核心路径编排**：

| # | 用户动作 | 页面前台 | 后端/事件 | 前端状态 | 埋点 | 耗时预算 |
|---|---|---|---|---|---|---|
| 1 | Tap 红色「✗ 未掌握」 | 按钮 loading · 触觉 heavy | `POST /api/review/nodes/500/grade body{grade:FORGOT,timeSpentMs}` | `exec.GRADED` | `wb_exec_grade{nid=500,grade=FORGOT,totalMs}` | ≤ 500 ms |
| 2 | 后端链式处理（对用户透明） | — | ① `wb_review_node(nid=500)` → GRADED · FORGOT<br>② `wb_review_node(nid=501,502,503)` T4/T5/T6 → CANCELLED<br>③ `wb_review_plan(qid=200).totalForget += 1`<br>④ 重新调用 `EbbinghausEngine.plan(qid=200, now)` 生成 7 个新 node：`nid=600..606` (T0..T6) 基于 now<br>⑤ Feign `DELETE /internal/events?relationIds=[question:200:node:501,502,503]`<br>⑥ Feign `POST /internal/events/batch` 7 条新 event (relation_id=question:200:node:600..606)<br>⑦ outbox + 补偿 | — | — | ≤ 1.5 s（异步） |
| 3 | P08 跳转 P09（FORGOT 特殊 hero） | 橙红色背景 + "记住了新的起点" + 记忆曲线 T3 重置为 T0 脉冲 + 下次复习卡显示 "1 小时后" | `GET /api/review/nodes/500/result` + `GET /api/wb/questions/200/nodes`（返回新 7 个 node） | `done.RESULT (forgot variant)` | `wb_done_view{nid=500,grade=FORGOT,resetFromT0=true}` | ≤ 1 s |
| 4 | 观察"下次复习"卡 | "1 小时后 · 9:41 PM" | — | `done.RESULT` | — | — |
| 5 | Tap「+加入日历」 | Toast "已同步到日历" | 前端检测 T1 event 已由后端批量创建（步骤 2.⑥），不再重复调用 · 只刷新本地缓存 | — | `wb_done_add_calendar{nid=601}` | ≤ 300 ms |
| 6 | Tap「结束本次」 | P09 → P-HOME · 今日大卡的"已完成 - 1"（因为这题被 FORGOT 取消了对"今日完成度"的计数） | `GET /api/home/today` | `home.READY` | `wb_done_exit` | ≤ 1.2 s |

**关键断言点**：

- DB 最终态（qid=200）：
  - 旧 node：T0/T1/T2 保留（MASTERED），T3 GRADED·FORGOT，T4/T5/T6 CANCELLED
  - 新 node：600..606（T0..T6，SCHEDULED；600 的 ready_at = now，scheduled_at = now+1h 作为 T1 初始）
- 日历最终态：
  - 旧 event：question:200:node:500,501,502,503 全部存在但 state 不同（500 COMPLETED·橙红，501-503 CANCELLED 并被删除）
  - 新 event：question:200:node:600..606 共 7 条
- MQ 事件：`review.plan.reset` 1 条 / `calendar.event.batch.deleted` 1 条 / `calendar.event.batch.created` 1 条
- 一致性：若步骤 2.⑤/⑥任一失败，outbox 补偿；最终"旧计划 CANCELLED + 新计划 SCHEDULED"必须同时成立，不允许"旧 event 已删但新 event 未建"的中间态持续 > 5 min

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-04.01 | 正常 | plan 200 有 3 GRADED + 1 OPEN + 3 SCHEDULED | 学生对 nid=500 (T3) tap 未掌握 | DB 最终态如"关键断言点"；P09 展示 FORGOT variant；日历月视图上 question:200 的未来点位重新出现（1h / 1d / 3d / 7d / 15d / 30d） |
| TC-04.02 | 异常 | 同上，但步骤 2.⑤ 日历删除 503 | Tap 未掌握 | UI 正常进入 P09；outbox 保留未投递记录；30 s 内 calendar-core 补偿成功；最终一致 |
| TC-04.03 | 异常 | 同上，但步骤 2.⑥ 日历批量创建前 2 条成功、后 5 条失败 | Tap 未掌握 | 后端重试策略：按 `idempotency_key` 以"每条 event"为粒度重入；最终 7 条 event 全部落地；不重复 |
| TC-04.04 | 边界 | 学生连续 5 次 FORGOT（第二次在第一次 T0 后 2 小时内） | 连续两次"未掌握" | 第二次 FORGOT 再次触发 plan reset；`plan.totalForget=2`；旧新 node 正确级联；埋点连续两条 `wb_exec_grade{grade=FORGOT}` |
| TC-04.05 | 边界 | 学生在 T0 节点就 FORGOT | Tap 未掌握 | 因无未来节点可取消，只重排 7 个新 node；无日历删除动作，只有新建 |

---

### 2B.6 SC-05 · 首页条带 → 日历 → 事件详情（复习形态）→ 立即复习

**场景目的**：验证方案 β 的**视图融合锚点**路径——学生从任务视角（首页）主动切换到时间视角（日历），通过事件详情 P11 的"复习节点形态"回到任务执行。这是判断日历×复习关系 UX 是否成立的关键路径。

**前置条件**：学生在 P-HOME · 今日是 4 月 21 日 · 4 月 28 日有 T4 复习节点 `nid=700` qid=200 · 日历筛选"显示复习"默认为"开"。

**核心路径编排**：

| # | 用户动作 | 页面前台 | 后端/事件 | 前端状态 | 埋点 | 耗时预算 |
|---|---|---|---|---|---|---|
| 1 | 滑动到 P-HOME "本周走势"下方的七日条带 | 周条带横滚进入视野 | — | `home.READY` | `home_week_strip_view` | — |
| 2 | Tap 右端「完整日历 →」链接 | P-HOME → P10 · 月视图打开，顶部 title "2026 年 4 月 / Asia/Shanghai" | `GET /api/calendar/events?month=2026-04` | `home → calendar.LOADING → calendar.READY` | `home_open_full_calendar{from=weekstrip}` | ≤ 500 ms |
| 3 | 观察月格，Tap 4 月 28 日格子 | 28 日格高亮蓝色边框 · 下方事件列表刷新为"4 月 28 日 星期二 · 3 件事" | — | `calendar.DAY_SELECTED{date=2026-04-28}` | `calendar_day_tap{date}` | 300 ms |
| 4 | Tap 事件列表中的 "二次函数 T4 复习"（带靛蓝 studytag） | P10 → P11 · 事件详情模态（复习节点形态） | `GET /api/calendar/events/{eventId}` → `relation_type=STUDY, relation_id=question:200:node:700` · 前端自动 `GET /api/review/nodes/700` + `GET /api/wb/questions/200` 并发 | `calendar → event.LOADING_STUDY` | `calendar_event_tap{eventId,relationType=STUDY}` | ≤ 600 ms |
| 5 | P11 渲染"复习节点"变体 | T4 胶囊 + 标题 "韦达定理 · D7 回顾" + 题目缩略图 + 记忆曲线（T0-T3 done, T4 pulse, T5-T6 future） + 下次排期 "5 月 5 日" + 底部"立即复习"CTA | — | `event.READY_STUDY` | `event_view{variant=STUDY,nid=700,T=4}` | — |
| 6 | 观察"关联"区 | "错题 #200 韦达定理" / "知识点：韦达定理" / "相关考试：五月月考 · 还有 21 天" | — | — | — | — |
| 7 | Tap 底部「立即复习 →」 | P11 → P08 执行页（**跨越 P07**） | `POST /api/review/nodes/700/open` + 前端 URL 改为 `/review/exec/700` | `event.EXIT_REVIEW → exec.READING` | `event_review_now{nid=700}` | ≤ 500 ms |
| 8 | 完成自评（如 MASTERED） | 跳 P09 | `POST /grade{grade:MASTERED}` | `exec.GRADED → done.RESULT` | `wb_exec_grade` | — |
| 9 | Tap「返回完整日历」（P09 自定义返回） | P09 → P10 · 月格 4 月 28 日的 T4 复习点变绿 + 列表项改为"已完成 ✓" | `GET /api/calendar/events?month=...&refresh=true` | `done.EXIT → calendar.READY` | `wb_done_exit{returnTo=calendar}` | ≤ 800 ms |

**分支路径 B · 关闭"显示复习"开关**：

| # | 用户动作 | 页面前台 | 后端/事件 | 前端状态 |
|---|---|---|---|---|
| 2.B | 在 P10 顶部 Tap "显示复习 · 开" | 切换为"显示复习 · 关" · 月格所有 STUDY 类型的 T 级色点消失（只剩考试红点 / 家庭蓝点） · 下方事件列表自动过滤掉 studytag | 前端本地过滤（不调后端） · 持久化到 `user_setting.calendar.showStudy=false` 经 `PATCH /api/me/preferences` | `calendar.FILTER_CHANGED` |
| 3.B | Tap 4 月 28 日 | 仅显示 1 件事（五月月考，不再显示 T4 复习） | — | — |
| 4.B | 若学生切回"开" | 色点与 studytag 恢复 | `PATCH /api/me/preferences` | — |

**关键断言点**：

- P11 进入源感知：从 P-HOME → P10 → P11，顶部返回指向 "4月"（P10）；若直接从 P-HOME 消息卡进入 P11，返回指向"首页"
- 复习域零侵入：日历 event 的 state 变更仅由复习域 Feign 触发；P11 UI 变更由前端本地 refresh 驱动
- 筛选持久化：`showStudy=false` 跨会话保留；下次打开仍关闭状态
- 深链等价：`wb://event/{eventId}` 独立可达（扫码 / 分享），不必经过 P10

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-05.01 | 正常 | P-HOME 周条带 · 4/28 有 T4 复习 · 显示复习=开 | SC-05 步骤 1-9 | P11 渲染 STUDY 变体；tap 立即复习跳 P08；完成后返回 P10 月格点变绿；过程无多余 P07 跳转 |
| TC-05.02 | 正常 | 同上，但显示复习=关 | 同步骤 1-3 后步骤 4 | 4/28 列表无复习项；学生打开复习开关 → 色点立即恢复；preferences API PATCH 成功 |
| TC-05.03 | 边界 | 学生 4/28 有 3 个复习 + 1 考试 + 2 家庭 | 步骤 3 Tap 4/28 | 事件列表按时间升序：T1 复习 / T4 复习 / 数学月考（红 tag） / T6 复习 / 接奶奶放学 / 家庭聚餐；所有复习项带 studytag；所有项可 tap 进 P11 |
| TC-05.04 | 异常 | 步骤 4 时 `/review/nodes/700` 返回 404（被另一端 FORGOT 后取消） | Tap 事件 | P11 显示"该复习节点已取消，下次排期已更新"占位 + CTA "查看新排期" → 跳 P05 qid=200；无崩溃 |
| TC-05.05 | 安全 | 深链 `wb://event/abc` 属于另一学生 | 扫码进入 | 403 · 跳 P-HOME · 埋点 `wb_deeplink_forbidden` |
| TC-05.06 | 性能 | 月视图数据 200+ 条 event | Tap 任意日 | 下方事件列表渲染 ≤ 300 ms；虚拟列表滚动 60 fps |

---

### 2B.7 SC-06 · 日历 → 事件详情（通用事件 / 家庭形态）→ 编辑

**场景目的**：验证 P11 的**双形态同壳**在非复习事件下的行为——展示通用事件的完整字段（时间、地点、参与人、重复规则），隐藏复习特有的"记忆曲线 / 题目缩略"区域，共享的"时间&提醒""关联"壳体保持一致。

**前置条件**：学生在 P10 · 4/21（周二）· 17:30 有"接奶奶放学"家庭事件 `eventId=E900 · relation_type=FAMILY · relation_id=family:member:grandma`。

**核心路径编排**：

| # | 用户动作 | 页面前台 | 后端/事件 | 前端状态 | 埋点 |
|---|---|---|---|---|---|
| 1 | P10 中 tap 4/21 当日列表的 "接奶奶放学 17:30"（蓝点） | P10 → P11 | `GET /api/calendar/events/E900` → `relation_type=FAMILY` | `calendar → event.LOADING_GENERIC` | `calendar_event_tap{eventId=E900,relationType=FAMILY}` |
| 2 | P11 渲染"通用事件"变体 | hero 蓝色渐变（非靛紫）+ 标题 "接奶奶放学" + 图标 "家庭" + **不渲染**记忆曲线 / 缩略图 / T 级胶囊 | — | `event.READY_GENERIC` | `event_view{variant=FAMILY,eventId}` |
| 3 | 观察共享壳 | "时间&提醒"卡显示：开始 4/21 17:30 · 时长 30 分 · 提醒 开始前 10 分 · 重复 每周二 | — | — | — |
| 4 | 观察"关联"卡 | 参与人 "奶奶"（头像 + 关系"外祖母"） + 地点 "第二小学北门" | — | — | — |
| 5 | Tap 顶部右侧「编辑」 | P11 → 事件编辑抽屉（从底部滑出） | `GET /api/calendar/events/E900/editable` | `event.EDIT` | `event_edit_open` |
| 6 | 修改时长 30→45 分 | 表单字段更新 | — | `event.EDIT_DIRTY` | `event_edit_field{key=duration}` |
| 7 | Tap「保存」 | 抽屉关闭 + P11 时长文本变 45 分 + Toast "已保存" | `PATCH /api/calendar/events/E900 body{durationMin:45}` | `event.SAVING → READY_GENERIC` | `event_edit_save` |
| 8 | Tap 左上返回 | P11 → P10 · 4/21 列表中该事件时长更新 | — | `event → calendar.READY` | `event_exit{returnTo=calendar}` |

**关键断言点**：

- 双形态同壳一致性：header / 时间&提醒 / 关联 / action bar / tab bar 五个区域的 DOM 结构在两种形态下完全一致（仅视觉色差）；独有区域（记忆曲线 / 缩略图）通过条件渲染
- 复习域不干预：通用事件的编辑路径完全在日历域内（calendar-core · `PATCH /events/{id}`），不触发 review-plan 任何调用
- 重复规则语义：修改"每周二 17:30"的当次时长不影响后续发生；如果学生选"应用于所有未来" → 后端更新 RRULE 而非单条

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-06.01 | 正常 | P10 中 4/21 有 FAMILY event E900 | SC-06 步骤 1-8 | P11 渲染 GENERIC 变体（无曲线）；编辑保存成功；P10 列表刷新 |
| TC-06.02 | 边界 | E900 是重复事件（每周二）· 学生只改当次 | 步骤 6 修改时长 + 选"仅当次" | 后端为该 RRULE 生成 exdate + 新建单次 event · 其他周二不变 |
| TC-06.03 | 异常 | 步骤 7 时 PATCH 返回 409（另一端已修改） | Tap 保存 | 弹冲突解决 Sheet "另一端已修改，请选择：保留我的 / 采用对方 / 合并" |
| TC-06.04 | 安全 | E900 是家长共享的只读事件 | 学生 Tap 编辑 | "编辑"按钮置灰 · 提示"此事件由家长共享，如需修改请联系家长" |

---

### 2B.8 SC-07 · AI 连续 2 次超时 → 降级手填

**场景目的**：验证 AI 分析链路的降级策略——qwen-vl-max 超时 → gpt-4o-mini 备用 → 仍失败 → 学生手填兜底。

**前置条件**：学生完成 SC-01 步骤 1-4（成功上传），进入步骤 5 (P03)；后端 mock 两个模型均超时。

**核心路径编排**：

| # | 用户动作 | 页面前台 | 后端/事件 | 前端状态 | 埋点 | 耗时预算 |
|---|---|---|---|---|---|---|
| 1 | 等待 P03 分析 | 4 步流水线 STEP_1 停留 10s 无推进 | qwen-vl-max 超时 | `analyzing.STEP_1{slow}` | `wb_ai_stream_slow{ms=10000}` | 10 s |
| 2 | 顶部黄条出现 | "正在切换到备用模型..." + 流水线进度回退到 STEP_1 wait | ai-analysis-service `retry{model=gpt-4o-mini}` | `analyzing.FALLBACK_MODEL` | `wb_ai_stream_fail{code=TIMEOUT,model=qwen-vl-max}` + `_start{model=gpt-4o-mini}` | — |
| 3 | 再等 10 s | gpt-4o-mini 也超时 | 第二次超时 | — | `wb_ai_stream_fail{code=TIMEOUT,model=gpt-4o-mini}` | 10 s |
| 4 | 顶部红条 + 跳转手填页 | P03 淡出 → 手填页（`P03_MANUAL`）· Hero "AI 暂时帮不上忙，我们一起手填" · 已 OCR 的题干文本预填在第一栏 | `POST /api/ai/fallback/{taskId}` · 返回 OCR 初步结果（从 STEP_1 保留） | `analyzing.FAILED → result.MANUAL` | `wb_ai_stream_dead{taskId}` · `wb_result_manual_open` | ≤ 500 ms |
| 5 | 学生补全字段 | 题干 / 错解 / 正解 / 知识点（下拉）/ 难度（star）/ 解法步骤 | — | `result.MANUAL_EDITING` | `wb_result_manual_field{key}` | — |
| 6 | Tap「保存到错题本」 | 按钮 loading + 跳 P05 | `POST /api/wb/questions/{qid}:confirm body{source=MANUAL,...}` → 触发 plan+nodes 同 SC-01 步骤 10 | `result.SAVING → SAVED` | `wb_result_save{subject,manualFilled=true}` | ≤ 1 s |

**关键断言点**：

- 两次超时：埋点 `wb_ai_stream_fail` 必须 2 条（两个 model 各一条）
- OCR 保留：即使两次模型失败，STEP_1 的 OCR 文本必须已持久化（stream partial 结果）并在手填页预填
- 手填也走完整 plan：`wb_question.source=MANUAL` 但 plan 生成逻辑一致，不能因为"是手填的"就降级 plan
- 不阻塞后续：即使 AI 模型完全不可用，学生仍可走完整个"上传→保存→复习"链路

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-07.01 | 异常 | ai-analysis mock 两个模型均超时 | SC-07 步骤 1-6 | 最终 question 保存成功 · source=MANUAL · 7 个 node + 7 个 event 正常创建 · 用户感知 UI 明确（黄条 → 红条 → 手填页） |
| TC-07.02 | 异常 | qwen 失败但 gpt 成功 | 走步骤 1-2，gpt 10s 内返回 | 流水线继续推进 · 最终走 AI 正常路径（非手填）· 埋点 1 条 fail + 1 条 done |
| TC-07.03 | 边界 | OCR 自身失败（STEP_1 就崩） | 等待 | 手填页题干栏为空；提示"未能识别题目文本，请手动输入"；其他字段照常 |
| TC-07.04 | 安全 | 手填页学生上传的"解法步骤"含 HTML | 保存 | 后端做 sanitization · DB 存储转义后文本 · 前端渲染 `<pre>` 不解析 |

---

### 2B.9 SC-08 · 跨时区登录 → 日历重算

**场景目的**：验证时区切换时，复习计划的 `due_at`（UTC 存储）按新时区正确呈现；学生明示确认后不误刷。

**前置条件**：学生之前偏好 `Asia/Shanghai (UTC+8)`，当前通过 VPN 或出国在 `America/Los_Angeles (UTC-7/-8)` 登录。

**核心路径编排**：

| # | 用户动作 | 页面前台 | 后端/事件 | 前端状态 | 埋点 |
|---|---|---|---|---|---|
| 1 | 打开 App | 启动 splash · 检测 `navigator.timezone` 与 `user_setting.timezone` 不一致 | `GET /api/me` 返回 `timezone=Asia/Shanghai` · 前端比对浏览器/小程序时区 API | `launch.TZ_MISMATCH` | `tz_mismatch_detected{from,to}` |
| 2 | 跳 P13 前弹系统级 Sheet | "检测到你在美国/洛杉矶。要把时区切换过去吗？" [保留 Asia/Shanghai / 切换到 LA] | — | `tz.ASK` | `tz_prompt_shown` |
| 3 | Tap「切换到 LA」 | Sheet 关闭 + Toast "时区已更新，正在重新计算你的排期..." | `PATCH /api/me/preferences body{timezone:America/Los_Angeles}` | `tz.SAVING` | `tz_changed{from,to}` |
| 4 | P-HOME 重载 | 今日复习大卡数字按 LA 时间重算（原"今天 8 题"可能变"今天 3 题、明天 5 题"，因为 LA 的"今天"已是 SH 的"昨天下午"） | `GET /api/home/today?tz=America/Los_Angeles` | `home.LOADING → READY` | `home_view{tzRecalc=true}` |
| 5 | 观察日历 | P10 月视图的事件时间全部按 LA 呈现（数据库依然 UTC 存储） | — | — | — |

**关键断言点**：

- DB 不变：`wb_review_node.ready_at` 是 UTC，不会因切时区被写入
- 只改呈现：改的仅是 `user_setting.timezone` 这一条偏好；7 个 node 的 ready_at 不变
- 推送守时：推送时间以节点 `ready_at (UTC)` + 用户当前 tz 计算"用户本地时间"；不会因切换时区而重复推送
- 免打扰策略：23:00–07:30 按新 tz 计算（SH 23:00 不等于 LA 23:00）

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-08.01 | 边界 | 学生原 tz=SH · 当前设备 tz=LA | 打开 App 并选择切换 | preferences.timezone=LA；P-HOME & 日历按 LA 呈现；DB node.ready_at 不变；免打扰按 LA |
| TC-08.02 | 边界 | 同上，但选择"保留 SH" | Tap 保留 | preferences 不变；UI 仍按 SH 呈现（即使用户在 LA 看起来时间怪异）；下次登录仍提示 |
| TC-08.03 | 异常 | 步骤 3 PATCH 返回 500 | Tap 切换 | Toast "切换失败，稍后重试"；preferences 保持原值；埋点 `tz_change_fail` |

---

### 2B.10 SC-09 · 家长分享考试日 → 学生接收

**场景目的**：验证家长/学生跨角色协同——家长在家长端创建"五月月考"考试事件（通用事件），分享到学生日历；学生收到通知并在 P11（通用事件形态）查看。

**前置条件**：学生已绑定家长账号（通过 P13 "家长绑定"）；家长在家长端已登录。

**核心路径编排**：

| # | 角色/用户动作 | 页面前台 | 后端/事件 | 埋点 |
|---|---|---|---|---|
| 1 | 家长在家长端创建事件 "五月月考 · 5/12 08:30 · 学校 · 分享给：小明" | 家长端保存成功 | `POST /api/calendar/events body{type:EXAM,relationType:EXAM,sharedTo:[studentId],...}` · calendar-core 写 event · 写 `event_share(eventId, studentId)` · MQ `calendar.event.shared` | `parent_event_create_share` |
| 2 | notification-service 消费事件 | — | 按 `studentId.preference` 决策渠道（微信订阅消息 + 站内） · 推送 "妈妈给你分享了一个事项：五月月考" | `notif_share_push_sent{studentId,eventId}` |
| 3 | 学生手机弹出微信订阅消息 | 消息内容含"查看详情"深链 `wb://event/{eventId}?from=share` | — | `wb_push_sent{type=share}` |
| 4 | 学生 Tap 通知 | App 启动 + 路由 P11 · 通用事件形态（EXAM 变体：hero 粉红渐变 · 倒计时 21 天 · 地点 · 分享人 "妈妈"） | `GET /api/calendar/events/{eventId}` · 校验 shared_to 含当前 student · `PATCH /api/events/{eventId}/ack` 标记已查看 | `event_view{variant=EXAM,from=share}` |
| 5 | 观察"关联"卡 | 分享人 "妈妈（关系：母亲）" + 准备清单（若家长填了 note） | — | — |
| 6 | Tap "加入我的提醒" | 按钮变 "已加入"（已默认加入，此为额外个人提醒） | `POST /api/calendar/events/{eventId}/subscribe` (增加个人 reminder) | `event_subscribe` |
| 7 | 返回 P-HOME | 消息聚合区 "妈妈分享了五月月考" 从"未读"消息变"已读"（右上小红点消失） | `GET /api/notifications?unread=0` | `home_msg_read` |

**关键断言点**：

- 权限：学生只有"查看 + 个人提醒订阅"权限，不能编辑/删除家长共享的事件（SC-06 TC-06.04）
- 消息双通道：站内 + 微信订阅消息同时下发；两端点击都能路由到 P11
- 已读同步：消息读过后在所有设备（学生另一端 / 家长端的"学生已查看"标记）同步 `ack` 状态
- 绑定校验：若家长与学生的绑定已被撤销（如学生在 P13 解绑），步骤 1 的 share 操作在后端返回 403

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-09.01 | 正常 | 学生已绑定家长 · 学生微信订阅消息已授权 | SC-09 步骤 1-7 | 学生收到微信消息 · P11 渲染 EXAM 变体 · P-HOME 消息聚合显示 · 家长端显示"已查看" |
| TC-09.02 | 异常 | 学生未授权订阅消息 | 同上 | 降级为站内红点；无微信消息；学生下次打开 App 看到 P12 通知中心首条；埋点 `notif_fallback_inapp` |
| TC-09.03 | 安全 | 学生已解绑家长 · 家长尝试分享 | 步骤 1 | 后端返回 403 · 家长端 Toast "已不再绑定此学生" |
| TC-09.04 | 边界 | 家长一次分享 10 个考试事件 | 批量 POST | notification-service 聚合为 1 条消息 "妈妈分享了 10 个事项"，点击落 P12 列表 |

---

### 2B.11 SC-10 · 归档错题 → 级联取消节点

**场景目的**：学生认为某题已完全掌握，主动在 P06 归档，验证级联：question 置 ARCHIVED · 未来 node 全部 CANCELLED · 日历 event 全部 CANCELLED/删除。

**前置条件**：学生在 P06 查看 qid=200 · plan 状态：T0-T3 GRADED·MASTERED，T4-T6 SCHEDULED · 日历 7 条 event（3 COMPLETED + 3 SCHEDULED + 1 被当前）。

**核心路径编排**：

| # | 用户动作 | 页面前台 | 后端/事件 | 埋点 |
|---|---|---|---|---|
| 1 | 在 P06 右上角 Tap "⋯" 菜单 | 展开菜单：归档此题 / 分享 / 举报错误分析 | — | `wb_detail_menu_open` |
| 2 | Tap「归档此题」 | 弹二次确认 Sheet "归档后将停止所有未来复习提醒，可随时从错题本恢复" [取消/确认归档] | — | `wb_detail_archive_confirm_show` |
| 3 | Tap「确认归档」 | Sheet 关闭 + P06 顶部蓝条 "归档中..." | `POST /api/wb/questions/200/archive` · 服务端链式：① `wb_question.status=ARCHIVED`；② `wb_review_node` T4-T6 → CANCELLED；③ MQ `question.archived`；④ calendar-core 消费 → DELETE event(question:200:node:T4-T6) · 保留历史 T0-T3 的 COMPLETED event | `wb_detail_archive{qid=200}` |
| 4 | 跳回 P05 列表 | P06 淡出 · P05 顶部出现 Snackbar "已归档 · 撤销"（持续 5 s） · 列表中该卡被移除 | `GET /api/wb/questions?mastery=ACTIVE` (默认不含 ARCHIVED) | `wb_archive_success` |
| 5 | Tap Snackbar「撤销」（可选） | 5 s 内 tap 则复原：question.status=ACTIVE · 重新调用 EbbinghausEngine 从当前 T3 继续（不是 T0 重置） · 4 条 event 重建（T4-T6 + 下次） | `POST /api/wb/questions/200/unarchive` | `wb_archive_undo` |
| 6 | （若未撤销）进入 P10 查看历史 | 4/21 之前日期仍有 question:200 的 COMPLETED 点（浅色） · 4/21 之后**不再出现** | — | — |

**关键断言点**：

- 历史保留：T0-T3 已完成的 event 不删，仅未来的 4-6 号被取消
- 撤销语义：5s 内撤销走"恢复到归档前状态"，不是"重新从 T0"
- 埋点连续性：归档 → 撤销必须是一对 `archive` + `archive_undo`；不撤销则无 undo
- 统计影响：学生的"已掌握题数"增加 1（ARCHIVED 视为"主动掌握"），"错题本总数"减 1

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-10.01 | 正常 | qid=200 · plan T0-T3 GRADED · T4-T6 SCHEDULED | SC-10 步骤 1-4 | question ARCHIVED · T4-T6 CANCELLED · 日历未来 event 删除 · 历史 COMPLETED event 保留 · Snackbar 出现 |
| TC-10.02 | 正常 | 同上 | 步骤 5 在 5s 内 tap 撤销 | question ACTIVE · 节点恢复为撤销前态 · 日历 event 重建（幂等） · 埋点 undo 成功 |
| TC-10.03 | 异常 | 步骤 3 calendar 删除失败 | 等待补偿 | outbox 最终一致；期间 P10 可能暂时看到未来 event，1 min 内消失；不影响 question.ARCHIVED 状态 |
| TC-10.04 | 边界 | Snackbar 出现期间用户退出 App 再回来 | 超 5 s | Snackbar 自动消失；列表持久化不含该题；撤销入口从"我的 - 已归档"进入 |

---

### 2B.12 SC-11 · 陌生访客 → 落地页 → 样例预览

**场景目的**：验证冷启动漏斗第一环 —— 访客从任意广告 / 分享 / 搜索入口进入后，落地页能在 30 秒内让其理解产品价值并点入下一步（试试看 or 登录），跳出率 ≤ 65%。

**前置条件**：设备指纹 `device_fp=new`（冷启动、无 JWT、无 shareToken），从 H5 外链 / 小程序扫码 / App 深链 `wb://welcome` 进入。

**核心路径编排**：

| F## | 用户动作 | 页面前台 | 前端状态 | 后端/事件 | 埋点 | 时延预算 |
|---|---|---|---|---|---|---|
| F01 | 点击广告 / 扫码 / 分享卡 | 进入 `bootstrap/resolve-entry` | `entry_source=ad|qr|share` | `GET /api/session/resolve` 返回 `{fingerprint_matched:false}` | — | ≤ 200 ms |
| F02 | 决策树落位 P-LANDING | 极光 hero + slogan | `landing=LOADING` | `GET /api/landing/samples?bucket=default` + `GET /api/landing/kpi` 并发 | `anon_landing_view{entry_source}` | ≤ 400 ms |
| F03 | hero 自动播放 30s 动图 | 三步漫画淡入 | `landing=READY` | — | `anon_landing_demo_play{sec=30}` | — |
| F04 | Tap 样例「数学 · 二次方程」 | 底部浮层 P-SAMPLE 展开，露出 AI 结构化结果预览 | `sample_open=math_eq` | 直接读静态样本 JSON，不调真实模型 | `anon_landing_sample_open{subject=math}` | ≤ 200 ms |
| F05 | 滑动看完错因 / 正解 / 变式 | 浮层内 3 个卡片 | — | — | — | — |
| F06 | Tap 关闭浮层 → 看到 CTA | CTA 吸底 "试试看（无需注册）" + "已有账号 → 登录" | — | — | — | — |
| F07A | 分支 A：Tap「试试看」 | 跳 P-GUEST-CAPTURE（转接 SC-12） | — | — | `anon_landing_cta_try` | — |
| F07B | 分支 B：Tap「已有账号」 | 跳 P00 登录 | — | — | `anon_landing_cta_login` | — |
| F07C | 分支 C：直接退出 | — | — | 记 `anon_landing_bounce` | `anon_landing_bounce{dwell_ms}` | — |

**关键断言点**：
- `GET /api/landing/samples` 必须可以强缓存 ≥ 1 h，CDN 命中率 ≥ 95%
- P-LANDING 首屏 TTI 预算 ≤ 1.0 s，允许 hero 动图异步延迟
- A/B 桶 `hero_copy_v1/v2` 必须在 `anon_landing_view` 埋点中透传 `experiment_bucket`
- 冷启动路径不得触发任何需要登录的接口（避免浪费 JWT 握手成本）

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-11.01 | 正常 | 新设备首次打开 H5 | 冷启动 → 落位 P-LANDING → 看完 hero → 点 Sample | 落地页 TTI ≤ 1.0 s · 浮层开合顺畅 · 埋点 `landing_view → sample_open` 连续 |
| TC-11.02 | 正常 | 已进入 P-LANDING | 点「试试看」 | 跳转 P-GUEST-CAPTURE · URL 正确 · 埋点 `cta_try` · 不要求登录 |
| TC-11.03 | 异常 | `/api/landing/samples` 返回 500 | 进入 P-LANDING | 降级 `DEGRADED` 态：只露 hero + CTA · 不卡整页 · 有监控告警 |
| TC-11.04 | 边界 | 弱网 3G | 进入 P-LANDING | 动图不阻塞 CTA 渲染 · CTA 在 1.5 s 内可点 |
| TC-11.05 | 安全 | `entry_source` 被篡改为 `<script>` | 进入 P-LANDING | 埋点服务端校验 · 非白名单值标为 `unknown` · 不入 ClickHouse |

---

### 2B.13 SC-12 · 游客试用 1 次 → 注册 → Claim 历史

**场景目的**：MVP 核心增长动作 —— 让用户"先看到价值再注册"，把冷注册漏斗翻转为"拍题 → 看结果 → 注册"，并在注册后一键把游客态分析结果绑定到正式账号（claim）。

**前置条件**：接 SC-11 F07A，`device_fp` 当日未用 guest 额度，`guest_session_id=null`。

**核心路径编排**：

| F## | 用户动作 | 页面前台 | 前端状态 | 后端/事件 | 埋点 | 时延预算 |
|---|---|---|---|---|---|---|
| F01 | 从 P-LANDING 跳入 P-GUEST-CAPTURE | 顶部游客横幅 "游客模式 · 今日 1/1 次 · 本次不保存" | `guest=IDLE` | `POST /api/guest/session` 创建 `guest_session` → 返回 `guest_session_id` | `anon_guest_capture_view{fp}` | ≤ 200 ms |
| F02 | 阅读未成年人提示 → 勾选同意 | ConsentBar 勾选后 Shutter 解锁 | `consent_at=now` | `guest_session.consent_at` 写库 | `anon_guest_consent` | — |
| F03 | 拍一张错题（或选图） | 取景框 → 快门 → 图片预览 | `guest=UPLOADING` | 预签名上传到 **临时 bucket**（非生产 OSS），5 min 过期 | `anon_guest_capture_shoot` | ≤ 1 s |
| F04 | 自动跳 P03 游客态 | 顶部横幅保留 "游客" · 骨架屏 + SSE 流 | `guest=ANALYZING` | `POST /api/guest/analyze {session_id,image_url}` → 走 ai-analysis-service（与正式用户同链路） | `anon_guest_analyze_start` | SSE 首字节 ≤ 3 s |
| F05 | P04 结果页 （游客态） | 题干 / KP / 错因 / 纠正四卡 + 黄条 "本次结果 24 h 内可保存到错题本" | `guest=RESULT_READY` | `guest_session.analysis_result_json` 持久化 · 不写 wb_question | `anon_guest_analyze_done{latency,subject,success}` | — |
| F06 | Tap 「保存到我的错题本」（主 CTA） | 跳 P00 登录，带 `guest_session_id` 参数 | — | — | `anon_guest_cta_save` | — |
| F07 | P00 微信一键授权 / 手机号注册 | — | `auth=LOGGING_IN` | `POST /api/auth/wechat-login` 或 `/register` | `auth_wechat_success` | ≤ 800 ms |
| F08 | Claim 历史 | Loading Sheet "正在把你刚才的分析保存到错题本..." | `claim=RUNNING` | `POST /api/guest/claim {guest_session_id}` → 服务端：① 校验会话归属（device_fp 相同）② 新建 wb_question ③ 触发 EbbinghauEngine 排 T0/T1 ④ 发 `question.created` MQ | `anon_guest_claim_start` | ≤ 600 ms |
| F09 | 落位 P-HOME | 今日复习大卡出现 "1 题新入库" 徽章 | `home=READY` | `GET /api/home/today` 返回 `{todayReview:{total:1,done:0}}` | `anon_guest_claim_success{ms}` + `home_view` | — |
| F10 | Tap 大卡 → P07 | 今日复习队列出现刚才的题（T1 H1 节点）| — | — | `home_today_start_all` | — |

**关键断言点**：
- **数据一致性**：Claim 成功后 `wb_question.id` 绑定 `wb_review_node.question_id`；`guest_session.claimed_by_student_id` 更新；MQ `question.created` 必发
- **幂等**：同一个 `guest_session_id` 重复 claim 必须返回同一个 `qid`，不得产生重复入库
- **安全边界**：不同设备指纹不得 claim 他人的 guest_session（校验 `device_fp` + `ip_range` 双因子）
- **合规**：未勾选 consent 的 session 不允许 claim；consent 状态 `ADULT | MINOR_WITH_GUARDIAN | MINOR_NO_GUARDIAN`，最后一项强制挡板
- **计量**：游客态 AI 调用成本按 `guest_session_id` 归账，每天生成成本看板；单设备单日硬上限 1 次

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-12.01 | 正常 | 新设备首次 | 完整走 F01-F10 | session 创建 · 分析成功 · claim 成功 · P-HOME 显示新题 · 埋点链完整 |
| TC-12.02 | 正常 | 已分析完但未注册 · 关闭 App 20h 后重开 | 再次打开 → 通过决策树进入 P-LANDING → CTA 仍能 claim | `guest_session` 在 24h TTL 内 · claim 成功 |
| TC-12.03 | 异常 | AI 首次 504 超时 | F04 期间失败 | **不扣额度**（`guest_session.status=FAILED`）· P03 顶部红条 · 建议重试 · 重试成功后继续 F05 |
| TC-12.04 | 异常 | 用户注册后用了不同设备指纹 | F08 Claim | 服务端 403 `DEVICE_MISMATCH` · 前端 Toast 并保留结果到 24 h 外 TTL 失效 |
| TC-12.05 | 边界 | 同设备 1 天内尝试第 2 次 | 点 Shutter | 429 QUOTA_EXHAUSTED · 整页挡板 · CTA 到 P00 |
| TC-12.06 | 安全 | 伪造 device_fp 企图刷额度 | 连续多次不同 fp 同 IP | IP bucket 命中 `rate:guest:ip:{ip}` 10/day 上限 → 429 |

---

### 2B.14 SC-13 · 分享链接收方 → 脱敏预览 → 升级注册

**场景目的**：补齐 SC-09 的接收端 —— 当家长 / 同学在微信群 / 朋友圈点击「考试日」/「错题卡」/「复习节点」分享链接时，能安全看到脱敏内容，并有明显路径升级为正式用户。

**前置条件**：`shareToken` 由分享者端在 SC-09 生成，URL 形如 `/s/<HS256_token>`，令牌 `type ∈ {EXAM_DAY, QUESTION, REVIEW_NODE}` · 未过期。

**核心路径编排**：

| F## | 用户动作 | 页面前台 | 前端状态 | 后端/事件 | 埋点 | 时延预算 |
|---|---|---|---|---|---|---|
| F01 | 接收方在微信点击分享卡 | 打开 H5 / 小程序 `wb://s/:shareToken` | `entry_source=share` | 决策树节点 2 命中 → 落 P-SHARED | `anon_share_enter` | — |
| F02 | P-SHARED 加载 | 骨架屏 + 顶部横幅 "来自 @XX 同学的分享" | `shared=LOADING` | `GET /api/share/:shareToken` 返回 `{type, masked_payload, sharer_nick, ttl_sec, signature_valid}` | — | ≤ 300 ms |
| F03 | 渲染内容（按 type 分支）| `EXAM_DAY`：复用 P11 通用事件只读视觉 / `QUESTION`：题干前 12 字 + 打码缩略图 / `REVIEW_NODE`：打码艾宾浩斯曲线 | `shared=READY` | — | `anon_share_view{type,sharer_id_hash}` | — |
| F04 | Tap 任意写操作（收藏 / 评论 / 立即复习）| 底部半屏 Sheet "登录后可完整查看 · 立即加入错题本" | — | — | `anon_share_upgrade_cta{type,cta_variant}` | — |
| F05 | Tap「立即注册」 | 跳 P00 登录，带 `returnTo=/s/<token>` | — | — | `anon_share_cta_register` | — |
| F06 | 注册成功 | 回到 P-SHARED 原页面；如果分享类型是 QUESTION 则自动发起"一键加入我的错题本"（复用 SC-12 claim 机制） | `claim=RUNNING`（仅 QUESTION 类型）| `POST /api/share/:token/claim`（后端判断 sharer 授权是否允许接收方 claim，默认允许） | `anon_share_upgrade_success` | ≤ 600 ms |
| F07 | 落位 P-HOME 或原分享页面 | 如果 claim：跳 P-HOME + Toast "已加入错题本" · 否则留在 P-SHARED 已登录态 | — | — | `home_view` 或 `shared_view_logged_in` | — |

**关键断言点**：
- **脱敏边界**：服务端**永远不回传**原始 `relation_id`、`student_email`、`original_image_url`；`masked_payload` 的字段白名单硬编码在 `ShareDto`
- **令牌安全**：HS256 签名；`exp ≤ 7d`；`jti` 写 Redis Bloom Filter 支持秒级撤销；`/api/share/:token` 不得是 GET 幂等的含敏感数据接口（使用 `Cache-Control: no-store`）
- **写操作全拦**：未登录用户的任何写请求在网关 `GatewayAuthFilter` 直接 403，不走业务层
- **升级漏斗**：`anon_share_view` → `anon_share_upgrade_cta` → `anon_share_upgrade_success` 必须是一条完整转化链，丢失任一 step 触发 data quality 告警

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-13.01 | 正常 | 合法 token · type=EXAM_DAY | 进入 P-SHARED | 只读预览正确 · 脱敏字段缺失 · 写按钮点击弹登录 |
| TC-13.02 | 正常 | type=QUESTION · 分享者允许 claim | 完整走 F01-F07 | claim 成功 · 进入 P-HOME · 错题本 +1 |
| TC-13.03 | 异常 | token exp 已过 | 进入 /s/:token | 挡板页 "这个分享已过期" · CTA 到 P-LANDING |
| TC-13.04 | 安全 | 接收方尝试拼接 /api/share/:token/comment | 直接调接口 | 网关 403 `ANONYMOUS_WRITE_FORBIDDEN` |
| TC-13.05 | 合规 | QUESTION 类型含未成年人图片 | 进入 P-SHARED | 题干图片统一压成 240 px 缩略 + 打码 · 不含学生昵称全称 |

---

### 2B.15 SC-14 · 流失用户回流 → 一键回登 → 进 P-HOME（P1）

**场景目的**：对曾登录过又流失的用户，通过设备指纹识别 + 一键 OAuth 刷新，把"卸载重装 / 登出 30 天"的回归摩擦降到最低；同时用"还剩 N 个待复习"制造回归动力。

**前置条件**：`device_fp` 在 `account_device` 表能回查到 `student_id` · 上次登录距今 ≥ 7 天 · 未持有合法 JWT。

**核心路径编排**：

| F## | 用户动作 | 页面前台 | 前端状态 | 后端/事件 | 埋点 | 时延预算 |
|---|---|---|---|---|---|---|
| F01 | 打开 App / 小程序 | bootstrap → 决策树 | — | `POST /api/session/resolve` 返回 `{fingerprint_matched:true, masked_account}` | `anon_welcomeback_resolve{ms}` | ≤ 300 ms |
| F02 | 落位 P-WELCOMEBACK | Hero "欢迎回来 <张*>" + 摘要卡 | `welcome_back=READY` | — | `anon_welcomeback_view{elapsed_days}` | — |
| F03 | 看到"还剩 14 个待复习 · 累计入库 82 题" | 账号摘要卡 + 主 CTA "一键回登" | — | — | — | — |
| F04A | 分支 A：Tap「一键回登」 | OAuth 浮层（微信一键 / Apple Sign-In / Token 刷新）| `auth=OAUTH_LAUNCHING` | `POST /api/auth/device-refresh {device_fp, oauth_payload}` | `anon_welcomeback_oauth_launch` | — |
| F05A | OAuth 成功 | Loading Sheet "正在恢复你的错题本..." | `auth=OK` | 发 JWT + MQ `user.returned{student_id,elapsed_days}` | `anon_welcomeback_oauth_success{elapsed_days}` | ≤ 500 ms |
| F06A | 落位 P-HOME | 大卡顶部 Toast "欢迎回来！今天有 14 题待复习" | `home=READY` | `GET /api/home/today` | `home_view` | — |
| F04B | 分支 B：Tap「换个账号登录」 | 跳 P00 | — | 清 `device_fp` 软绑定记录 | `anon_welcomeback_switch_account` | — |
| F04C | 分支 C：停留 60 s 无操作 | 自动跳 P-LANDING（避免泄露 "有账号存在" 给他人）| — | — | `anon_welcomeback_timeout` | — |

**关键断言点**：
- **设备指纹软绑定**：仅用于"识别 + 提示回登"，**不自动完成登录**。用户必须完成 OAuth 动作才签发 JWT
- **多账号歧义**：同一 `device_fp` 命中 ≥ 2 个 `student_id` → 降级 P00 选择账号
- **被删除账号**：`student.status=DELETED` → 降级 P-LANDING
- **合规**：`masked_account.nick` 只露首字 + `*`；`pending_review` 只露数量不露内容；接口响应 `Cache-Control: no-store`

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-14.01 | 正常 | 流失 30 天 · 指纹唯一命中 | 完整走 F01-F06A | 2 秒内进入 P-HOME · Toast 欢迎回来 · JWT 正常 |
| TC-14.02 | 异常 | 指纹命中 2 个账号 | F01 后 | 降级 P00 · 列表展示 2 个脱敏账号供选择 |
| TC-14.03 | 边界 | 设备从未登录过 | F01 | 节点 3 未命中 → 降级 P-LANDING |
| TC-14.04 | 安全 | 他人拿到本机，60s 内无操作 | 自动跳 P-LANDING | 不泄露 `masked_account` · 不可通过回退键回到 P-WELCOMEBACK |

---

### 2B.16 SC-15 · 家长 / 班主任观察者会话（P1）

**场景目的**：让家长 / 班主任用一次性邀请码兑换**只读**观察者会话，不占用学生账号，不产生正式账号，也不污染学生的推送 / 数据统计。

**前置条件**：学生端在 P13「我的 - 观察者」点击 "生成邀请" → 得到 `invite_code`（6 位大写字母 + 数字）· 过期 24 h · 角色可选 `PARENT` / `TEACHER`。

**核心路径编排**：

| F## | 用户动作 | 页面前台 | 前端状态 | 后端/事件 | 埋点 | 时延预算 |
|---|---|---|---|---|---|---|
| F01 | 家长扫码 / 粘贴邀请码 | H5 打开 `wb://observer/:code` | `entry_source=invite` | 决策树节点 2 命中 | `obs_enter{code_hash}` | — |
| F02 | 兑换会话 | Loading "正在准备观察视图..." | `exchange=RUNNING` | `POST /api/observer/exchange {invite_code, purpose:'PARENT_VIEW'}` → 校验 code · 发 OBSERVER JWT（`role=OBSERVER, student_id, scope=READ, exp=30d`）· `observer_session` 入库 | `obs_exchange_success{role}` | ≤ 400 ms |
| F03 | 落位 P-OBSERVER | 观察者横幅 "你正在以家长身份查看 @张*" + 周报卡 + 学科雷达 + 最近时间线 | `observer=READY` | `GET /api/observer/overview` + `GET /api/observer/timeline?limit=20` | `obs_overview_view` | ≤ 600 ms |
| F04 | Tap 某条时间线 → 进 P06 只读 | P06 顶部紫色横幅 "观察者只读模式" · 右下角编辑/归档按钮置灰 | — | `GET /api/wb/questions/:qid` 带 `observer-token` header；原图字段返 `null`（只给脱敏缩略图） | `obs_detail_readonly_view{qid}` | — |
| F05 | Tap 日历事件 → P11 只读形态 | 复用 P11 视觉但所有写操作置灰 + 顶部紫条 | — | — | `obs_event_readonly_view` | — |
| F06 | 尝试操作（被拦）| Toast "观察者不可编辑 · 如需操作请联系 @张*" | — | 网关 403 `OBSERVER_FORBIDDEN_WRITE` | `obs_write_blocked{action}` | — |
| F07 | 学生端撤销 | 学生在 P13 点 "撤销观察权" · 家长端下次请求命中 | — | observer_session JWT `jti` 进 Redis 黑名单；家长端下次任何请求 403 → 跳 P-LANDING | `obs_revoked_by_student` | ≤ 100 ms |

**关键断言点**：
- **权限边界**：`OBSERVER` JWT 在 `GatewayAuthFilter` 强制 `scope=READ`；所有 `POST/PUT/DELETE/PATCH` 方法除 `/observer/exchange` 之外全拒
- **数据脱敏**：观察者视图不得返回 `original_image_url`、`student_email`、`chat_id`；时间线条目不得展开原图详情
- **TTL 与续期**：`PARENT` 30 d / `TEACHER` 90 d；每次 API 请求滑动续期 +7 d，封顶上限不变
- **撤销实时性**：学生 P13 撤销后 ≤ 1 s 内黑名单生效；观察者端无感知下次请求直接 403
- **不污染统计**：观察者的所有 `obs_*` 埋点**不进入学生维度统计**；独立 ClickHouse 表 `obs_events`

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-15.01 | 正常 | 有效邀请码 · 角色 PARENT | 完整走 F01-F05 | 兑换成功 · 周报正确 · 时间线脱敏 · P06 / P11 只读 |
| TC-15.02 | 异常 | 邀请码已过期 | F02 兑换 | 410 `INVITE_EXPIRED` · 挡板页 + CTA 联系学生重发 |
| TC-15.03 | 安全 | 观察者构造 `POST /api/wb/questions` | 直接调接口 | 网关 403 · 审计日志记录 `abuse_attempt` |
| TC-15.04 | 安全 | 学生撤销后观察者继续操作 | 任何 API 请求 | 403 `OBSERVER_REVOKED` · 前端跳 P-LANDING |
| TC-15.05 | 合规 | 观察者尝试看原图 | P06 图片区 | 只显示脱敏缩略图 · 点击放大不放行 |

---

### 2B.17 小结 · 章节维护与 Owner

**Owner 与同步规则**：

- **本章 Owner**：产品经理（scenario 业务正确性）+ 前端架构师（choreography 技术可行性） 双签
- **触发重写**：§2A.3 路由表变更 / §2A.4 规格卡增删页面 / §2A.5 状态机新增状态 / §2A.7 异常矩阵新增一类 → 必须同步修订对应 SC 卡
- **PR 检查清单**（在每个影响 UI/UX 的 PR 模板里固化）：
  1. 是否修改了 §2A 规格？如是 → 是否同步了 §2B 对应 SC 卡？
  2. 是否新增/修改用户可感知路径？如是 → 是否新增或修改 SC？
  3. QA 用例是否已覆盖新路径（每个新路径 ≥ 3 条 TC：正常 / 异常 / 边界 / 安全）？
  4. Playwright 骨架（§12.S9）是否已追加对应 `scx_spec.ts`？
  5. 若场景涉及匿名态（SC-11..15），是否评审脱敏规则 / 设备指纹 / 令牌安全？

**Scenario → 实施映射**：每个 SC 卡天然对应一份 E2E 测试脚本（文件名 `sc-01.spec.ts` … `sc-15.spec.ts`），Playwright 骨架样例已在 **§12.S9 端到端联调 + 冒烟** 中给出（覆盖 SC-01 / SC-02 / SC-05 三个已登录核心场景 + SC-11 / SC-12 / SC-13 三个匿名核心场景，其余 9 个按相同模板扩展）。

**未来演进**：当系统稳定后，可用 `@playwright/test` 的 VRT（视觉回归）对每个 SC 卡的关键步骤截图做基线；截图命名 `sc-12-step-F05-p04-guest.png` 与步骤号 + 页面 ID 严格绑定。

---

## 3. 领域模型（满足艾宾浩斯推送数据模型）

### 3.1 核心聚合

| 聚合根 | 说明 | 主要子实体 |
|---|---|---|
| **Student**（学生） | 登录主体，绑定年级 / 学科偏好 / 时区 | `student_preference` · `account_device`（设备指纹软绑定，用于 SC-14 回流）|
| **Question**（错题卡） | 一次拍题产出的一张错题卡 | `question_image`（原图/裁剪/水印版本）、`analysis_result`（AI 结果版本链） |
| **ReviewPlan**（复习计划） | 每张错题卡 1:1 一份复习计划 | `review_node`（T0–T6）、`review_record`（每次执行的流水） |
| **PushTask**（推送任务） | 由节点触发器批量生成，多渠道扇出 | `push_log`（触达流水） |
| **CalendarEvent** | 复用通用日历现有实体，通过 `relation_type=STUDY`/`relation_id=question:{id}` 挂接 | — |
| **GuestSession**（游客会话 · 匿名态）| 由 SC-11 / SC-12 触发，承载设备维度的一次游客 AI 分析结果；注册后 claim 到正式 `Question` | — |
| **ShareToken**（分享令牌 · 匿名态）| SC-09 分享者发出 / SC-13 接收方消费；签名 + TTL + 撤销位 | `share_token_audit`（访问审计）|
| **ObserverSession**（观察者会话 · 匿名态 P1）| SC-15 家长 / 老师只读会话；`OBSERVER` JWT + 黑名单 | `observer_invite`（一次性邀请码）|

### 3.2 状态机

**Question 状态**：
```
PENDING(0) ─OCR/分析任务入队─► ANALYZING(1)
  │                                     │成功
  │失败重试≥3                           ▼
  ▼                              ANALYZED(2) ─学生确认/修正─► CONFIRMED(3)
FAILED(9)                                                      │
                                                               ▼
                                                          ARCHIVED(8)（归档/删除）
```

**ReviewNode 状态**（**严格对齐《艾宾浩斯.md》**）：
```
SCHEDULED(0) ─前 30 分钟生成待推送─► READY(1) ─到点推送─► PUSHED(2)
     │                                                       │
     │失败                                                   ├──24h 内完成─► REVIEWED(3)
     ▼                                                       │                │掌握
   FAILED(9)                                                 │                ▼ 推进至下一节点
                                                             │                │未掌握
                                                             │                ▼ 当前节点重置为 T0
                                                             └──24h 超时──► FORGOTTEN(4)（计入遗忘率）
```

**艾宾浩斯节点定义**（常量表 `ebbinghaus_node_config`，可配置、可 AB）：

| Level | 代码 | 相对首学时间间隔 | 业务语义 |
|---|---|---|---|
| T0 | INITIAL | 0 | 首学 / 首次做错 |
| T1 | H1 | +1 小时 | 超短期巩固 |
| T2 | D1 | +1 天 | 隔日回顾 |
| T3 | D3 | +3 天 | 短期强化 |
| T4 | D7 | +7 天 | 周期巩固 |
| T5 | D15 | +15 天 | 中期再现 |
| T6 | D30 | +30 天 | 长期记忆 |

---

## 4. 数据库设计（PostgreSQL 16 + pgvector）

> 全部新表走 **Flyway** 迁移（`V20260421__init_wrongbook.sql`），与现有日历的 Flyway 版本线并行、不冲突。所有时间字段 `TIMESTAMPTZ`（UTC 存储），业务主键 `bigint` + Snowflake。

### 4.1 `student`（可复用日历系统 `user`，此处仅示业务视图）

> 实际实现：**复用** `user` 表（来自通用日历方案 P5）+ 新增 `student_profile` 视图 / 扩展字段 `grade_level`、`learning_stage` 到 `user_setting`。

### 4.2 `wb_question` — 错题卡主表

```sql
CREATE TABLE wb_question (
  id             BIGINT PRIMARY KEY,
  student_id     BIGINT NOT NULL,
  subject_code   VARCHAR(16) NOT NULL,          -- MATH/CHINESE/ENGLISH/PHYSICS/...
  grade_code     VARCHAR(16),                   -- G1..G12, COLLEGE, LANG_CEFR_B1 ...
  source_type    SMALLINT NOT NULL,             -- 1 拍照 2 相册 3 H5 文件 4 语音 5 手输
  origin_image   VARCHAR(512),                  -- OSS object key（原图）
  processed_image VARCHAR(512),                 -- 预处理后（去噪/矫正）
  ocr_text       TEXT,                          -- OCR 提取文本
  status         SMALLINT NOT NULL DEFAULT 0,   -- 0 PENDING 1 ANALYZING 2 ANALYZED 3 CONFIRMED 8 ARCHIVED 9 FAILED
  mastery        SMALLINT NOT NULL DEFAULT 0,   -- 0 未掌握 1 部分 2 已掌握（学生自评最终态）
  knowledge_tags JSONB NOT NULL DEFAULT '[]',   -- [{code,name,weight}]
  embedding      vector(1024),                  -- pgvector，语义检索
  tenant_id      BIGINT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX idx_wb_q_student_status ON wb_question(student_id, status, created_at DESC);
CREATE INDEX idx_wb_q_subject ON wb_question(student_id, subject_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_wb_q_tags_gin ON wb_question USING GIN (knowledge_tags jsonb_path_ops);
CREATE INDEX idx_wb_q_trgm ON wb_question USING GIN (ocr_text gin_trgm_ops);
CREATE INDEX idx_wb_q_embedding ON wb_question USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);
```

### 4.3 `wb_analysis_result` — AI 分析结果（版本化）

```sql
CREATE TABLE wb_analysis_result (
  id              BIGINT PRIMARY KEY,
  question_id     BIGINT NOT NULL,
  version         INT NOT NULL,                 -- 同一 question 的多次分析（重跑 / 换模型）
  model_provider  VARCHAR(32) NOT NULL,         -- openai / dashscope(qwen) / zhipu / anthropic / local
  model_name      VARCHAR(64) NOT NULL,         -- gpt-4o-mini / qwen-vl-max / glm-4v ...
  input_tokens    INT, output_tokens INT, cost_cents INT,
  stem_text       TEXT,                          -- 结构化：题干
  student_answer  TEXT,                          -- 学生作答（识别）
  correct_answer  TEXT,                          -- 正解
  error_type      VARCHAR(32),                   -- CONCEPT/CARELESS/METHOD/CALC/UNKNOWN
  error_reason    TEXT,                          -- 错因解释
  solution_steps  JSONB,                         -- [{step,explain,formula}]
  knowledge_points JSONB,                        -- [{code,name,bloom_level}]
  difficulty      SMALLINT,                      -- 1..5
  raw_json        JSONB NOT NULL,                -- 原始模型输出（保真）
  status          SMALLINT NOT NULL,             -- 0 running 1 ok 9 failed
  finished_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(question_id, version)
);
```

### 4.4 `wb_review_plan` — 复习计划（1:1 错题）

```sql
CREATE TABLE wb_review_plan (
  id              BIGINT PRIMARY KEY,
  question_id     BIGINT NOT NULL UNIQUE,
  student_id      BIGINT NOT NULL,
  strategy_code   VARCHAR(32) NOT NULL DEFAULT 'EBBINGHAUS_STD',  -- 可扩展
  start_at        TIMESTAMPTZ NOT NULL,          -- T0 = 首次做错/首学时间
  current_level   SMALLINT NOT NULL DEFAULT 0,   -- 0..6
  total_review    INT NOT NULL DEFAULT 0,
  total_forget    INT NOT NULL DEFAULT 0,
  mastery_score   NUMERIC(5,2) DEFAULT 0.00,     -- 动态掌握度 0~100
  status          SMALLINT NOT NULL DEFAULT 0,   -- 0 进行中 1 完成（T6 掌握）9 放弃/归档
  next_due_at     TIMESTAMPTZ,                   -- 最近一个待执行节点 due_at，冗余用于索引
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wb_plan_due ON wb_review_plan(status, next_due_at);
```

### 4.5 `wb_review_node` — 复习节点（T0–T6 展开）

```sql
CREATE TABLE wb_review_node (
  id              BIGINT PRIMARY KEY,
  plan_id         BIGINT NOT NULL,
  student_id      BIGINT NOT NULL,
  level           SMALLINT NOT NULL,             -- 0..6 对应 T0..T6
  level_code      VARCHAR(8) NOT NULL,           -- INITIAL/H1/D1/D3/D7/D15/D30
  due_at          TIMESTAMPTZ NOT NULL,          -- 艾宾浩斯计算得到
  window_end_at   TIMESTAMPTZ NOT NULL,          -- due_at + 24h
  ready_at        TIMESTAMPTZ,                   -- due_at - 30min（预生成任务时刻）
  status          SMALLINT NOT NULL DEFAULT 0,   -- 0 SCHEDULED 1 READY 2 PUSHED 3 REVIEWED 4 FORGOTTEN 9 FAILED
  pushed_at       TIMESTAMPTZ,
  reviewed_at     TIMESTAMPTZ,
  effect          SMALLINT,                       -- 1 掌握 2 部分 3 未掌握
  calendar_event_id BIGINT,                       -- 关联日历事件 ID（外挂到 calendar_event.relation_id）
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, level)
);
CREATE INDEX idx_wb_node_due_status ON wb_review_node(status, due_at);
CREATE INDEX idx_wb_node_student_due ON wb_review_node(student_id, due_at) WHERE status IN (0,1,2);
```

### 4.6 `wb_review_record` — 执行流水（学生每一次做题）

```sql
CREATE TABLE wb_review_record (
  id              BIGINT PRIMARY KEY,
  node_id         BIGINT NOT NULL,
  plan_id         BIGINT NOT NULL,
  student_id      BIGINT NOT NULL,
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ,
  duration_ms     INT,
  self_rating     SMALLINT,                      -- 1 掌握 2 部分 3 未掌握
  ai_rating       SMALLINT,                      -- 可选：AI 评估作答
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wb_rec_node ON wb_review_record(node_id);
```

### 4.7 `wb_push_task` & `wb_push_log` — 推送任务与流水

```sql
CREATE TABLE wb_push_task (
  id              BIGINT PRIMARY KEY,
  node_id         BIGINT NOT NULL,
  student_id      BIGINT NOT NULL,
  channels        VARCHAR(64) NOT NULL,           -- 'MP,APP,EMAIL'
  scheduled_at    TIMESTAMPTZ NOT NULL,
  status          SMALLINT NOT NULL DEFAULT 0,    -- 0 等待 1 处理中 2 成功 9 失败
  tried_times     SMALLINT NOT NULL DEFAULT 0,
  last_error      TEXT,
  idempotency_key VARCHAR(64) UNIQUE NOT NULL     -- MD5(node_id + scheduled_at)，避免重复
);
CREATE INDEX idx_wb_push_sched ON wb_push_task(status, scheduled_at);

CREATE TABLE wb_push_log (
  id           BIGINT PRIMARY KEY,
  task_id      BIGINT NOT NULL,
  channel      VARCHAR(16) NOT NULL,              -- MP/APP/EMAIL/SMS
  request_id   VARCHAR(64),
  success      BOOLEAN NOT NULL,
  error_code   VARCHAR(32),
  error_msg    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.8 `ebbinghaus_node_config` — 节点配置（热更新）

```sql
CREATE TABLE ebbinghaus_node_config (
  id          SERIAL PRIMARY KEY,
  strategy_code VARCHAR(32) NOT NULL,             -- EBBINGHAUS_STD / INTENSIVE / SLOW
  level       SMALLINT NOT NULL,
  level_code  VARCHAR(8) NOT NULL,
  offset_seconds BIGINT NOT NULL,                 -- 相对 T0 偏移量
  pre_notice_seconds INT NOT NULL DEFAULT 1800,   -- 前置 30 分钟预生成
  window_seconds INT NOT NULL DEFAULT 86400,      -- 有效复习窗口 24h
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(strategy_code, level)
);
-- 初始化 EBBINGHAUS_STD：T0=0, T1=3600, T2=86400, T3=259200, T4=604800, T5=1296000, T6=2592000
```

### 4.9 与 `calendar_event` 的联动（复用日历）

日历系统已存在的 `calendar_event`（来自通用日历 P5）有 `relation_type` + `relation_id` 多关联列：

```
relation_type = 'STUDY'
relation_id   = 'question:{wb_question.id}:node:{wb_review_node.id}'
title         = 复习 · {学科} · {知识点短摘}
start_at      = node.due_at    end_at = node.due_at + 30min
color_token   = iOS-blue / 与前端设计 tokens 对齐
payload       = { plan_id, node_level, effect_writeback_url }
```

`wb_review_node.calendar_event_id` 回填事件 ID，实现**双向指针**。

### 4.10 `guest_session` — 匿名态游客会话（SC-11 / SC-12）

```sql
CREATE TABLE guest_session (
  id               BIGINT PRIMARY KEY,
  device_fp        VARCHAR(128) NOT NULL,           -- 设备指纹（IndexedDB + Canvas + UA 组合）
  ip_hash          VARCHAR(64),                     -- IP 做 HMAC，避免明文留存
  ua               VARCHAR(256),
  entry_source     VARCHAR(32),                     -- ad/qr/share/direct
  experiment_bucket VARCHAR(32),                    -- A/B 桶
  image_tmp_url    VARCHAR(512),                    -- 临时 OSS bucket，5 min 签名
  analysis_result_json JSONB,                       -- AI 结构化结果快照
  consent_at       TIMESTAMPTZ,                     -- 未成年人保护合规
  consent_type     SMALLINT,                        -- 1 ADULT / 2 MINOR_WITH_GUARDIAN / 3 MINOR_NO_GUARDIAN
  status           SMALLINT NOT NULL DEFAULT 0,     -- 0 CREATED / 1 ANALYZING / 2 RESULT_READY / 3 FAILED / 4 CLAIMED / 9 EXPIRED
  claimed_by_student_id BIGINT,                     -- claim 后回写
  claimed_question_id   BIGINT,                     -- 绑定到 wb_question.id
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,            -- 默认 created_at + 24h
  claimed_at       TIMESTAMPTZ
);
CREATE INDEX idx_guest_session_fp_day ON guest_session(device_fp, created_at);
CREATE INDEX idx_guest_session_expires ON guest_session(expires_at) WHERE status IN (0,1,2);
CREATE UNIQUE INDEX uq_guest_claim ON guest_session(claimed_question_id) WHERE claimed_question_id IS NOT NULL;
```

**关联表** `guest_rate_bucket`（Redis 失败时降级写库）：`(device_fp, ip_hash, date)` 联合唯一，计数字段 `count`，上限 1/day。

### 4.11 `share_token` — 匿名态分享令牌（SC-09 / SC-13）

```sql
CREATE TABLE share_token (
  id               BIGINT PRIMARY KEY,
  jti              VARCHAR(64) NOT NULL UNIQUE,     -- HS256 JWT 的 jti
  sharer_student_id BIGINT NOT NULL,
  share_type       VARCHAR(16) NOT NULL,            -- EXAM_DAY / QUESTION / REVIEW_NODE
  relation_id      VARCHAR(128) NOT NULL,           -- question:id / event:id / node:id
  allow_claim      BOOLEAN NOT NULL DEFAULT false,  -- 接收方注册后是否允许一键加入错题本
  usage_limit      INT NOT NULL DEFAULT 1000,
  usage_count      INT NOT NULL DEFAULT 0,
  status           SMALLINT NOT NULL DEFAULT 1,     -- 1 ACTIVE / 2 EXPIRED / 3 REVOKED / 4 EXHAUSTED
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL             -- <= created_at + 7d
);
CREATE INDEX idx_share_token_sharer ON share_token(sharer_student_id, created_at);

CREATE TABLE share_token_audit (
  id               BIGINT PRIMARY KEY,
  jti              VARCHAR(64) NOT NULL,
  viewer_device_fp VARCHAR(128),
  viewer_ip_hash   VARCHAR(64),
  upgraded_student_id BIGINT,                       -- 接收方注册成功后回填
  viewed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_share_audit_jti ON share_token_audit(jti, viewed_at);
```

**撤销机制**：`status=REVOKED` 后，`jti` 同步写入 Redis Bloom Filter `share:revoked`，网关鉴权实时命中。

### 4.12 `observer_invite` / `observer_session` — 观察者（P1 · SC-15）

```sql
CREATE TABLE observer_invite (
  id               BIGINT PRIMARY KEY,
  invite_code      CHAR(6) NOT NULL UNIQUE,          -- 6 位大写字母+数字
  student_id       BIGINT NOT NULL,
  role             VARCHAR(16) NOT NULL,             -- PARENT / TEACHER
  status           SMALLINT NOT NULL DEFAULT 1,      -- 1 PENDING / 2 EXCHANGED / 3 EXPIRED / 4 REVOKED
  expires_at       TIMESTAMPTZ NOT NULL,             -- 默认 created_at + 24h
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE observer_session (
  id               BIGINT PRIMARY KEY,
  jti              VARCHAR(64) NOT NULL UNIQUE,
  student_id       BIGINT NOT NULL,
  role             VARCHAR(16) NOT NULL,
  device_fp        VARCHAR(128),
  status           SMALLINT NOT NULL DEFAULT 1,      -- 1 ACTIVE / 2 EXPIRED / 3 REVOKED_BY_STUDENT
  issued_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,              -- PARENT 30d / TEACHER 90d
  revoked_by_student_at TIMESTAMPTZ
);
CREATE INDEX idx_observer_session_student ON observer_session(student_id, status);
```

**撤销实时性**：学生端 P13 触发撤销 → `observer_session.status=3` → 同步写 Redis `obs:revoked:{jti}` → 网关 `GatewayAuthFilter` ≤ 1 s 命中。

### 4.13 `account_device` — 设备指纹软绑定（P1 · SC-14）

```sql
CREATE TABLE account_device (
  id               BIGINT PRIMARY KEY,
  student_id       BIGINT NOT NULL,
  device_fp        VARCHAR(128) NOT NULL,
  platform         VARCHAR(16),                      -- H5 / MINIP / IOS / ANDROID
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  login_count      INT NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX uq_account_device ON account_device(student_id, device_fp);
CREATE INDEX idx_account_device_fp ON account_device(device_fp);
```

**设计要点**：
- 仅登录成功后才写此表，**不在匿名态写**；
- `device_fp` 多对多命中 `student_id` 时，P-WELCOMEBACK 降级 P00 选择账号；
- 未成年人保护：`student.role=MINOR` 时不展示 `masked_account` 细节，仅露"有账号可恢复"字样。

---

## 5. 整体技术架构

### 5.1 架构分层

```
┌───────────────────────────────────────────────────────────────┐
│ 前端层（pnpm monorepo）                                      │
│  ├─ apps/miniprogram   小程序原生 + Vant Weapp + MobX        │
│  ├─ apps/h5            Vite + React 18 + Konsta UI           │
│  ├─ apps/app (P2)      React Native + Konsta RN              │
│  └─ packages/*         design-tokens / api-contracts / i18n  │
└──────────────────────────▲────────────────────────────────────┘
                          │ HTTPS (JWT) / SSE / WSS
┌──────────────────────────┴────────────────────────────────────┐
│ 接入层：Spring Cloud Gateway（WebFlux）                      │
│  - Nacos 注册中心路由                                         │
│  - Sa-Token / Spring Security 鉴权                           │
│  - 全局限流（Sentinel）/ 熔断                                │
│  - X-Timezone / X-Locale / Trace-Id 透传                     │
└──────────────────────────▲────────────────────────────────────┘
                          │
┌──────────────────────────┴────────────────────────────────────┐
│ 业务微服务（Spring Boot 3.2 + Spring Cloud Alibaba 2023）    │
│  ├─ auth-service          登录 / WeChat OAuth / JWT         │
│  ├─ user-service          用户画像 / 偏好 / 时区             │
│  ├─ wrongbook-service ★   错题卡 CRUD / 检索 / 标签修正      │
│  ├─ ai-analysis-service ★ Spring AI（多模态 + 结构化）       │
│  ├─ review-plan-service ★ 艾宾浩斯引擎 + 节点状态机         │
│  ├─ calendar-core-service [已有] 日历事件 CRUD               │
│  ├─ calendar-reminder-svc [已有] XXL-Job 扫描到期            │
│  ├─ notification-service  [已有] 多渠道模板化推送            │
│  ├─ file-service          OSS/MinIO 预签名直传 + 病毒扫描    │
│  └─ stats-service  (P1)   掌握率 / 遗忘率聚合                │
└──────────────────────────▲────────────────────────────────────┘
                          │ RocketMQ 5 / OpenFeign
┌──────────────────────────┴────────────────────────────────────┐
│ 数据层                                                        │
│  PostgreSQL 16 (主从 + PgBouncer) · pgvector · pg_trgm       │
│  Redis 7 Cluster (6 节点) · RocketMQ 5 · Elasticsearch 8(可选)│
│  MinIO / 阿里云 OSS（错题图片）                              │
└───────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────┐
│ 基础设施：Kubernetes + Helm + Istio(可选) + Nacos + XXL-Job  │
│ 观测：Prometheus + Grafana + SkyWalking 10 + ELK + Sentry   │
└───────────────────────────────────────────────────────────────┘
```

### 5.2 现有后端骨架的演进路径

当前 `backend/` 是**单模块** Spring Boot 骨架（`com.longfeng.wrongbook`，有 `QuestionController` / `ImageAnalysisService` 等）。演进策略：**保留现有代码与业务语义、平滑拆分为多模块**，避免推倒重来。

```
现在（backend/）                 →  目标（longfeng/）
─────────────────────────────────   ─────────────────────────────────────────
backend/                            longfeng/                 ← Maven 多模块根
  pom.xml                           ├── pom.xml               ← BOM + dependencyManagement
  Dockerfile                        ├── common-core/          ← 异常、基类、Snowflake
  uploads/                          ├── common-api/           ← Feign 客户端 + DTO
  src/main/java/com/longfeng/       ├── wrongbook-service/    ← ★ 由现骨架迁入
    wrongbook/                      │     com.longfeng.wrongbook.{controller,service,repo}
      WrongBookApplication.java     │     └─ QuestionController/QuestionService 保留
      controller/QuestionController │  
      service/QuestionService       ├── ai-analysis-service/  ← ★ ImageAnalysisService 迁入并升级为 Spring AI
      service/ImageAnalysisService  │     com.longfeng.ai.{analyzer,prompt,vision}
      model/dto/AnalysisResult      ├── review-plan-service/  ← ★ 新建（艾宾浩斯引擎）
      model/dto/QuestionResponse    ├── calendar-core-service/← 按日历方案 P5 建
      config/WebConfig              ├── calendar-reminder-svc/← 按日历方案 P7
  src/main/resources/               ├── notification-service/ ← 按日历方案 P8
    application.yml                 ├── file-service/         ← 新建（OSS 预签名）
                                    ├── gateway-service/      ← 按日历方案 P9
                                    ├── auth-service/
                                    ├── user-service/
                                    └── integration-test/
```

**迁移要点**：
- 现有 `AnalysisResult` / `QuestionResponse` DTO **升级并上移**到 `common-api` 作为跨服务契约；字段扩充为 §4.3 `wb_analysis_result` 的投影。
- `ImageAnalysisService` 的现有"调用 AI 分析图像"实现重写为 Spring AI `ChatClient` + 多模态 `UserMessage(Media…)`，保留原 Controller 的对外路径以**不破坏已有前端/测试**。
- 现 `application.yml` 的配置按"启动模式 = standalone | cloud"二分，cloud 模式接入 Nacos。
- `uploads/` 仅作本地开发降级路径；线上一律走 `file-service` → OSS。

---

## 6. Spring AI 错题分析详设

### 6.1 选型

| 能力 | 首选 | 备选 | 说明 |
|---|---|---|---|
| 多模态对话 | `spring-ai-openai-spring-boot-starter`（接 OpenAI / Azure / 兼容网关） | `spring-ai-qianwen-starter`（通义千问 VL）、`spring-ai-zhipuai-starter` | 网关层抽象 `ChatClient` 即可在供应商间切换 |
| 嵌入（语义搜索） | `spring-ai-openai-embedding` + `text-embedding-3-small` (1536) 或 1024 | 本地 `BGE-M3` via vLLM | 存入 `wb_question.embedding`（pgvector） |
| 结构化输出 | `ChatClient.call().entity(AnalysisResult.class)` | BeanOutputConverter / JSON Schema | 强类型落库 |
| RAG（P1） | `PgVectorStore`（Spring AI 官方 Starter） | Milvus | 已选 pgvector，避免多引擎 |
| 工具调用 | `@Tool` + `ToolCallingManager` | — | 知识点查询 / 题库关联 |
| 提示词管理 | `PromptTemplate` + `resources/prompts/*.st` | LangChain4j | 版本化、可审计 |

**为什么同时准备国内模型**：微信生态 + 国内合规（生成式 AI 服务备案）；通义千问 `qwen-vl-max` 对中文数学/物理识别强、国内延迟低。网关通过配置项 `longfeng.ai.provider` 热切换。

### 6.2 关键接口

```java
// ai-analysis-service/src/main/java/com/longfeng/ai/analyzer/QuestionAnalyzer.java
public interface QuestionAnalyzer {
    /** 同步：返回终态 AnalysisResult */
    AnalysisResult analyze(AnalyzeRequest req);

    /** 流式：SSE 分段输出（用于前端实时感知） */
    Flux<AnalysisChunk> analyzeStream(AnalyzeRequest req);
}
```

**Prompt 结构**（`resources/prompts/wrong-question-analysis.st`）：

```
你是资深中学{subject}教师。请以**严格 JSON**（无任何 Markdown 代码块、无多余文本）输出对以下学生错题的分析。

输入信息：
- 年级：{grade}
- 学生语言：{locale}
- OCR 预清洗文本：{ocrText}

输出 JSON Schema（字段缺失请以 null 占位）：
{
  "stem":          "题干完整文字",
  "studentAnswer": "识别到的学生作答（可为 null）",
  "correctAnswer": "标准答案",
  "errorType":     "CONCEPT|CARELESS|METHOD|CALC|UNKNOWN",
  "errorReason":   "不超过 80 字的中文错因解释",
  "solutionSteps": [{"step":1,"explain":"...","formula":"LaTeX 或纯文本"}],
  "knowledgePoints":[{"code":"MATH_ALG_01","name":"一元二次方程","bloomLevel":"APPLY"}],
  "difficulty":    1-5 的整数
}
```

**结构化解析**：

```java
AnalysisResult result = chatClient
    .prompt()
    .user(u -> u.text(promptTpl).params(Map.of(
        "subject", req.subject(), "grade", req.grade(),
        "locale",  req.locale(),  "ocrText", req.ocrText())))
    .user(u -> u.media(MimeType.IMAGE_JPEG, req.imageResource()))
    .options(ChatOptions.builder()
        .temperature(0.2)
        .responseFormat(ResponseFormat.JSON_OBJECT)
        .build())
    .call()
    .entity(AnalysisResult.class);  // Spring AI 自动 JSON → POJO
```

### 6.3 鲁棒性与降级

1. **JSON 校验**：`JsonSchemaValidator` 校验，失败则单次重试 + 降温 (`temperature=0`)；两次失败走降级 Prompt（更短、只要最关键 5 字段）。
2. **超时**：同步调用硬超时 8 s；流式调用 15 s；超时写 `status=FAILED` 并投递死信队列人工复核。
3. **幂等**：`question_id + version` 唯一；Redis `SETNX` 锁防并发同名 question 重复分析。
4. **成本**：记录 `input_tokens/output_tokens/cost_cents`，按学生出日报（P1）。
5. **安全**：图片经 `file-service` 的 NSFW + 人脸脱敏预处理后才进入 AI；Prompt 注入防御使用 Spring AI 的 `SafeGuardAdvisor`。

---

## 7. 艾宾浩斯计算引擎

### 7.1 计算规则（对齐《艾宾浩斯.md》）

```java
// review-plan-service/src/main/java/com/longfeng/review/EbbinghausEngine.java
public List<ReviewNode> plan(long questionId, long studentId,
                             Instant startAt, String strategyCode) {
    List<NodeConfig> cfg = repo.findEnabledByStrategy(strategyCode); // T0..T6
    return cfg.stream().map(c -> ReviewNode.builder()
        .planId(planId).studentId(studentId)
        .level(c.level()).levelCode(c.code())
        .dueAt(startAt.plusSeconds(c.offsetSeconds()))
        .windowEndAt(startAt.plusSeconds(c.offsetSeconds() + c.windowSeconds()))
        .readyAt(startAt.plusSeconds(c.offsetSeconds() - c.preNoticeSeconds()))
        .status(NodeStatus.SCHEDULED)
        .build()
    ).toList();
}
```

### 7.2 效果回写 → 节点自适应

```java
// 学生在执行页点"掌握 / 未掌握"
public void onReviewed(long nodeId, Effect effect) {
  ReviewNode node = repo.loadForUpdate(nodeId);        // SELECT ... FOR UPDATE
  node.setReviewedAt(Instant.now());
  node.setEffect(effect);
  node.setStatus(NodeStatus.REVIEWED);
  repo.save(node);

  ReviewPlan plan = planRepo.get(node.getPlanId());
  switch (effect) {
    case MASTERED -> {                                  // 掌握：推进
      plan.setCurrentLevel((short)(node.getLevel() + 1));
      if (plan.getCurrentLevel() > 6) plan.setStatus(PlanStatus.COMPLETED);
    }
    case PARTIAL  -> {/* 保持当前 level，延后重试 +12h */}
    case FORGOT   -> {                                  // 未掌握：重置 T0
      repo.cancelFutureNodes(plan.getId());             // 取消未来节点
      // 以"当前时间"为新的 T0，重新生成 T1..T6
      List<ReviewNode> nodes = engine.plan(plan.getQuestionId(),
                                           plan.getStudentId(),
                                           Instant.now(),
                                           plan.getStrategyCode());
      repo.saveAll(nodes);
      plan.setCurrentLevel((short)0);
    }
  }
  // 同步日历事件：删除取消的节点对应 event、为新节点补建 event
  calendarClient.syncPlanEvents(plan.getId());
}
```

### 7.3 调度触发（XXL-Job）

| Job | Cron | 行为 |
|---|---|---|
| `node-ready-scan` | 每 1 min | 扫 `status=SCHEDULED AND ready_at <= now()` → 更新为 `READY` + 生成 `wb_push_task` |
| `node-due-push`   | 每 30 s | 扫 `wb_push_task where status=0 and scheduled_at<=now()` → 投递 `notification.event.topic` |
| `node-forgotten-sweep` | 每 10 min | 扫 `status=PUSHED AND window_end_at<now()` → `FORGOTTEN`，触发 `plan.total_forget++` |
| `plan-mastery-refresh` | 每 1 h | 聚合 mastery_score = f(total_review, total_forget, level) |

**一致性**：所有写操作以 `wb_review_node` 为主，日历事件由 `calendar-core` 的 outbox 表异步投影，失败重试；最终一致性。

---

## 8. 与通用日历系统的集成契约

| 场景 | 方向 | 通道 | 关键字段 |
|---|---|---|---|
| 节点创建 → 生成日历事件 | review-plan → calendar-core | Feign `POST /internal/events/batch` | `relationType=STUDY, relationId=question:{qid}:node:{nid}` |
| 学生在日历点击事项 → 跳错题复习页 | calendar (前端) → wrongbook (前端) | URL scheme `longfeng://review?nodeId=...` + H5 `/review/:nodeId` | 透传 `nodeId` |
| 节点到期 → 推送 | reminder-service → notification-service | RocketMQ `notification.push.topic` | 模板 `wrong_question_review_v1` |
| 学生完成 → 更新日历事件颜色/状态 | review-plan → calendar-core | Feign `PATCH /internal/events/{id}/state` | `state=COMPLETED/FORGOTTEN` |
| 用户关闭某张错题 | wrongbook → review-plan → calendar-core | 级联事件 `question.archived.topic` | 取消未来节点与日历事件 |

**原则**：错题域**永不直接操作** `calendar_event` 表；必须通过 calendar-core 的 internal API。便于未来日历换引擎（如 CalDAV 对接）时业务无感。

---

## 9. 前端方案

### 9.1 信息架构（方案 β · 今日聚合派，替代原 v1.0 日历派 · 含匿名 Shell）

```
 ┌───────── Anonymous Shell（匿名态 · 无 Tab Bar）─────────┐
 │                                                        │
 │   P-LANDING ──「试试看」──► P-GUEST-CAPTURE ──► P03    │
 │       │                                          │     │
 │       │                                          ▼     │
 │       │                                        P04 游客态
 │       │                                          │     │
 │       │ 「登录」                                「保存」│
 │       │                                          │     │
 │       │      P-SHARED  ◄── 分享链 / 扫码               │
 │       │      P-OBSERVER ◄── 观察者邀请码(P1)           │
 │       │      P-WELCOMEBACK ◄── 设备指纹命中(P1)        │
 │       ▼                                          ▼     │
 └───────┴───────────► P00 登录 / 注册 (带 claim) ◄┴──────┘
                                │
                                ▼ Tab Shell 登录态
  ┌──────────────────────── Tab 栏（方案 β · 已登录）──────────────────────┐
  │  ┌─首页─┐  ┌─错题本─┐  ┌─拍题⊕─┐  ┌─复习─┐  ┌─我的─┐                 │
  └──┴──┬──┴──┴───┬────┴──┴───┬────┴──┴──┬──┴──┴──┬──┴────────────────────┘
        │         │            │           │        │
        ▼         ▼            ▼           ▼        ▼
     P-HOME    P05 列表       P02          P07     P13
    今日聚合   筛选/搜索      拍题相机     今日     设置/偏好
     · 今日复习大卡            (Tab CTA)   队列    · 家长绑定
     · 本周走势                             │      · 我的日历二级入口
     · 七日条带 ─┐            ▼             ▼      · 通知开关 · 观察者管理
     · 消息 3 条 │         P03 流式分析    P08 执行  · 隐私
     · 薄弱 KP   │            │             │
     · 快捷入口  │            ▼             ▼
                 │         P04 结果卡      P09 完成
                 │            │             │
                 │            ▼             ▼
                 │         P05 错题本 ◄──┐  返回 P-HOME 刷新"今日大卡"
                 │            │         │
                 │            ▼         │
                 │         P06 错题详情─┘
                 │
                 │ 二级页（3 个入口：首页条带 / 首页快捷入口 / 我的）
                 ▼
             P10 日历月视图 ──► P11 事件详情（双形态：复习节点 | 通用事件）
                                        │
                                        ├─ 复习节点 → "立即复习" → P08
                                        └─ 通用事件（考试/家庭）→ 查看/编辑
             P12 通知中心 ──► P11 事件详情 / P08 复习执行
```

> **方案 β 核心判断**：学习类产品的心智是"任务队列"而非"时间网格"，故第一 Tab 改为 **今日聚合首页（P-HOME）**；日历能力完整保留，但以二级页形态承载（P10），并通过 **事件详情 P11 的双形态同壳** 实现"日历×复习"视图融合。
>
> **匿名 Shell 的设计宗旨**：冷启动 / 深链 / 分享链 / 回流 / 观察者 5 条匿名入口统一经由 §2A.3.1 登录态决策树分流，**不让未登录用户撞在 P00 登录墙**；匿名页面共享独立 Shell（无 Tab Bar、顶栏仅保 Logo + 右上登录按钮），和登录态 Tab Shell 视觉隔离明确。

**19 页清单**（14 登录态 + 5 匿名态）：

| # | 页面 | 角色 | 核心元素 |
|---|---|---|---|
| P-LANDING | 访客落地页 | **匿名 Shell 核心入口** | hero 演示动图 · 三步漫画 · 3 组样例 · 双 CTA |
| P-GUEST-CAPTURE | 游客拍题 | **Try Before Signup** | 游客横幅 + 额度提示 · 共用 P02 取景器 · consent 勾选 |
| P-SHARED | 分享链只读预览 | 病毒拉新 | 脱敏卡片 · 升级 CTA · 3 种 type（EXAM_DAY/QUESTION/REVIEW_NODE）|
| P-WELCOMEBACK | 回流唤起 (P1) | 唤醒沉睡 | 欢迎回来 · 账号摘要卡 · 一键回登 |
| P-OBSERVER | 观察者会话 (P1) | B 端陪跑 | 观察者横幅 · 周报 · 学科雷达 · 时间线（只读） |
| P00 | 登录 | 一次性 | 微信登录 / 年级学科初始化 / 接收 `guest_session_id` claim 参数 |
| P-HOME | 今日聚合首页 | **Tab 1 · 核心** | hero 问候 · 今日复习大卡 · 周走势 · 七日条带 · 消息聚合 · 薄弱 KP · 快捷入口 |
| P02 | 拍题 | Tab 3 · 主 CTA | 相机预览 / 边缘检测 / 学科切换 |
| P03 | AI 分析中 | 流式 | 4 步流水线 · JSON 流式 · 可取消 |
| P04 | AI 结果 | 结构化 | 错解 vs 正解 · 错因红条 · 3 步解法 · 6 节点预告 |
| P05 | 错题本列表 | Tab 2 | 学科/掌握度/语义搜索 · 6 段阶段进度 · 到期提醒 |
| P06 | 错题详情 | 档案 | AI 简报 · 6 节点时间线 · 能力雷达 · 变式题 |
| P07 | 今日复习 | Tab 4 | 分时段队列 · 批量开始 |
| P08 | 复习执行 | 核心交互 | 题干→作答→揭示→自评三按钮 |
| P09 | 复习完成 | 反馈 | 庆祝 Hero · 曲线推进 · KP 变化 · 继续/结束 |
| P10 | 日历月视图 | **二级页** | 月格 T 级色点 + 复习数徽章 · 当日事件列表融合复习/考试/家庭 |
| P11 | 事件详情 | **融合锚点** | 双形态同壳：复习节点（T 级胶囊+曲线+立即复习）/ 通用事件（考试/家庭/提醒）|
| P12 | 通知中心 | 系统 | APNs/微信/站内 多通道聚合 · 免打扰策略 |
| P13 | 我的 | Tab 5 | 偏好 · 家长绑定 · 我的日历入口 · 隐私 |

### 9.2 小程序端关键点

- **订阅消息**：`wx.requestSubscribeMessage` 在"保存到错题本"后立刻申请，模板 `AT0001 - 复习提醒`；若用户拒绝则降级到站内红点。
- **分包加载**：主包 < 2 MB。`pages/camera/*` 与 `pages/review/*` 下沉到分包，首屏只留日历 + 错题本入口。
- **拍照**：`wx.chooseMedia({ mediaType:['image'], sourceType:['camera','album'], sizeType:['compressed']})`，上传 `wx.uploadFile` 直连 `file-service` 的预签名 URL。
- **SSE 替代**：小程序不支持 EventSource，改为 `wx.connectSocket` WebSocket，后端 `ai-analysis-service` 提供 `/ws/analyze/{taskId}` 双协议端点。

### 9.3 H5 端关键点

- **React Query + SSE**：`useEventSource('/api/ai/stream/{taskId}')`，按阶段渲染骨架屏 → 逐步填充。
- **PWA**：仅离线错题本浏览（图片和 JSON），不做离线分析。
- **可访问性**：错题题干 `role=img` + `aria-label` 放 OCR 文本，保证屏幕阅读器可读。

### 9.4 共享契约包（`packages/api-contracts`）

由 `ai-analysis-service` + `wrongbook-service` + `review-plan-service` 的 **SpringDoc** 聚合生成 OpenAPI 3.1 → Orval 7 → `packages/api-contracts/src/gen/*.ts`，H5 用 TanStack Query Hook，小程序用简化版 fetcher。**单一真源、零手写 DTO**。

---

## 10. 关键 API 契约（节选）

> 所有接口返回 `{code,message,data,traceId}` 统一结构；错误码见附录。

### 10.1 错题上传

```
POST /api/wb/questions:upload            multipart/form-data
Body: file=<binary>, subjectCode=MATH, gradeCode=G9, sourceType=1
Resp: { id, status:"ANALYZING", streamUrl:"/api/ai/stream/{taskId}" }
```

### 10.2 AI 分析流（SSE）

```
GET  /api/ai/stream/{taskId}             text/event-stream
data: {"stage":"OCR","progress":0.2}
data: {"stage":"ANALYSIS","chunk":"{\"stem\":\"..."}"}
data: {"stage":"DONE","result":{...AnalysisResult}}
```

### 10.3 保存并触发复习计划

```
POST /api/wb/questions/{id}:confirm
Body: { editedFields?:{...}, strategyCode:"EBBINGHAUS_STD" }
Resp: { planId, nodes:[{level,dueAt,levelCode},...], calendarEventIds:[...] }
```

### 10.4 今日待复习

```
GET  /api/wb/review/today?tz=Asia/Shanghai
Resp: [{ nodeId, questionId, level, dueAt, subject, knowledgePoints[] }]
```

### 10.5 效果回写

```
POST /api/wb/review/{nodeId}:mark
Body: { effect:"MASTERED|PARTIAL|FORGOT", durationMs, notes? }
Resp: { nextDueAt, currentLevel, planStatus }
```

### 10.6 匿名态入口解析（bootstrap / 决策树）

```
POST /api/session/resolve
Body: { deviceFp, entrySource, shareToken?, observerCode? }
Resp: {
  decision: "HOME" | "LANDING" | "SHARED" | "OBSERVER" | "WELCOME_BACK" | "LOGIN",
  maskedAccount?: { nickFirstChar, lastLoginAt, pendingReview },  // WELCOME_BACK 时有
  shareContext?: { type, sharerNick, ttlSec },                    // SHARED 时有
  observerContext?: { studentId, role }                            // OBSERVER 时有
}
```

### 10.7 访客落地页样例 & KPI

```
GET /api/landing/samples?bucket=<ab_bucket>
Resp: [{ subject, stemText, knowledgePoints[], errorReason, correction }, ...]  // 静态样本，可强缓存 ≥ 1h

GET /api/landing/kpi
Resp: { cumulativeQuestions, dailyAnalyses, happyUsers }   // 社区脱敏指标
```

### 10.8 游客分析 / 额度 / Claim

```
POST /api/guest/session
Body: { deviceFp, ipHash, ua, entrySource, experimentBucket }
Resp: { guestSessionId, quotaRemaining }

POST /api/guest/analyze
Body: { guestSessionId, imageTmpUrl, subjectCode?, consentType }
Resp: { streamUrl:"/api/ai/stream/{taskId}", quotaRemaining }
Err:  429 QUOTA_EXHAUSTED | 401 CONSENT_MISSING | 403 DEVICE_MISMATCH

POST /api/guest/claim
Headers: Authorization: Bearer <fresh JWT after login>
Body: { guestSessionId }
Resp: { questionId, planId, nodes:[{level,dueAt},...] }
Err:  410 GUEST_SESSION_EXPIRED | 403 DEVICE_MISMATCH | 409 ALREADY_CLAIMED (幂等返回原 questionId)
```

### 10.9 分享令牌（SC-09 / SC-13）

```
POST /api/share/tokens     // 分享者端生成
Body: { shareType:"EXAM_DAY|QUESTION|REVIEW_NODE", relationId, expiresInSec?, allowClaim? }
Resp: { shareToken, shareUrl, jti, expiresAt }

GET  /api/share/:shareToken
Resp: { type, maskedPayload, sharerNick, ttlSec, signatureValid }
Err:  410 TOKEN_EXPIRED | 403 TOKEN_REVOKED | 404 TOKEN_INVALID

POST /api/share/:shareToken:claim    // 接收方登录后一键加入（仅 QUESTION 且 allowClaim=true）
Headers: Authorization: Bearer <JWT>
Resp: { questionId }

DELETE /api/share/tokens/:jti        // 分享者主动撤销
Resp: 204
```

### 10.10 观察者会话（P1 · SC-15）

```
POST /api/observer/invites    // 学生端 P13 生成邀请
Body: { role:"PARENT|TEACHER", purpose? }
Resp: { inviteCode, expiresAt, qrUrl }

POST /api/observer/exchange   // 家长 / 老师兑换会话
Body: { inviteCode, deviceFp }
Resp: { observerToken, studentIdHash, role, expiresAt }
Err:  410 INVITE_EXPIRED | 403 INVITE_REVOKED

GET  /api/observer/overview
Headers: Authorization: Bearer <OBSERVER JWT>
Resp: { masteryRate, pendingReview, subjectRadar, weeklyReport }

GET  /api/observer/timeline?limit=20&cursor=
Resp: [{ qid, subject, kpTagsMasked, lastReviewedAt, mastery }, ...]

DELETE /api/observer/sessions/:jti   // 学生端撤销
Resp: 204
```

### 10.11 回流 / 设备刷新（P1 · SC-14）

```
POST /api/auth/device-refresh
Body: { deviceFp, oauthProvider:"wechat|apple", oauthPayload }
Resp: { jwt, student:{id,nick,...} }
Err:  403 DEVICE_MISMATCH | 410 STUDENT_DELETED
```

**鉴权总原则**：
- 匿名接口网关 `AnonFilter` 不要求 JWT，但强制携带 `device_fp` + `rate_limit`；
- 所有匿名写接口（`/api/guest/analyze`、`/api/guest/session`）限速：设备 1/day · IP 10/day；
- 观察者 JWT 在 `GatewayAuthFilter` 强制 `scope=READ`，命中 Redis 黑名单立即 403；
- 分享 token 校验走独立轻量过滤器，绝不调用用户表（只校签名 + Bloom Filter）。

---

## 11. 非功能需求

| 维度 | 目标 | 手段 |
|---|---|---|
| 性能 | 上传→ 终态 P95 ≤ 8 s | OSS 直传 + 异步分析 + 预置 Prompt 缓存 |
| 并发 | 单服务 2 k TPS；AI 分析 200 QPS | 无状态 + HPA；AI 走 RocketMQ 削峰 + 多供应商分流 |
| 可靠 | RPO 0 / RTO ≤ 15 min | PostgreSQL 主从 + PITR + RocketMQ 主从 |
| 安全 | 图片 E2E 可选；Prompt 注入防御 | 签名 URL 短时效 + WAF + `SafeGuardAdvisor` + PII 脱敏 |
| 合规 | 生成式 AI 备案、未成年人保护 | 备案模型 + 家长模式 + 广告屏蔽 + 不保存 Prompt 泄露 |
| 可观测 | 100% 采样入网；10% 采样入库 | SkyWalking trace、Prometheus metric、Sentry 前端 |
| i18n | zh-CN / en-US / ja-JP 骨架 | ICU MessageFormat + 资源包按地域下发 |
| 时区 | 存 UTC、按 `X-Timezone` 渲染 | Day.js + tz plugin；后端 `Clock` 注入 |
| 可访问性 | WCAG 2.2 AA | jest-axe + @axe-core/playwright CI 门禁 |

---

## 12. 分阶段落地计划（S0–S10）

> 每阶段严格对齐"目标 / 技术工具 / 执行步骤 / 验证 / 完成判定"五段式，与现有两份计划保持同一叙事风格。

### S0. 仓库对齐与骨架整合（0.5 天）

**目标**：把现 `backend/` 的 `com.longfeng.wrongbook` 代码迁入多模块根，与通用日历 P1 的 8 模块合并为 11 模块。

**工具**：Maven 3.9、`mvn -N io.takari:maven:wrapper`、Spring Boot 3.2.5、Spring Cloud 2023.0.1、Spring Cloud Alibaba 2023.0.1.0、Spring AI 1.0.0。

**步骤**：
1. 在 `calendar-platform/` 根新增子模块 `wrongbook-service` / `ai-analysis-service` / `review-plan-service` / `file-service` / `anonymous-service`（新增 · 承载 guest / share / observer / welcome-back 四类匿名能力）。
2. `git mv backend/src/main/java/com/longfeng/wrongbook → calendar-platform/wrongbook-service/src/main/java/com/longfeng/wrongbook`（保留历史）。
3. `ImageAnalysisService` 迁入 `ai-analysis-service`，重命名为 `QuestionAnalyzer`，原类在 `wrongbook-service` 中以 Feign `AiAnalysisClient` 替代。
4. BOM 固定 `spring-ai-bom:1.0.0`；新增 `spring-ai-openai-spring-boot-starter`。
5. 根 `pom.xml` 的 `<modules>` 新增 5 条。
6. 为 `anonymous-service` 搭骨架：`SessionResolveController` / `GuestController` / `ShareController` / `ObserverController` / `DeviceFingerprintService`；依赖 Redis、Bucket4j 限速、JJWT。
7. 网关新增 `AnonFilter`（校设备指纹 + 限速 + A/B 桶）和 `ObserverFilter`（强制 `scope=READ`），在 `AuthFilter` 之前生效。

**验证**：
```bash
mvn -q -DskipTests validate
mvn -pl wrongbook-service -am -q -DskipTests package
grep -q 'spring-ai-openai' ai-analysis-service/pom.xml
```

**完成判定**：所有模块能 `mvn package`；`WrongBookApplication` 能以 `-Dspring.profiles.active=cloud` 启动并注册到 Nacos。

---

### S1. 领域建模 + Flyway DDL（1 天）

**目标**：按 §4 建立 9 张错题域表；数据库迁移与日历域迁移不冲突。

**工具**：Flyway 10、`pgvector` 扩展、`pg_trgm`。

**步骤**：
1. `wrongbook-service/src/main/resources/db/migration/V20260421_01__init_wrongbook.sql` —— 9 张表。
2. 扩展：`CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pg_trgm;`（幂等）。
3. 初始化 `ebbinghaus_node_config` 的 `EBBINGHAUS_STD`、`INTENSIVE`、`SLOW` 三策略。
4. `anonymous-service/src/main/resources/db/migration/V20260421_02__init_anonymous.sql` —— §4.10-4.13 的 `guest_session` / `guest_rate_bucket` / `share_token` / `share_token_audit` / `observer_invite` / `observer_session` / `account_device` 七张匿名态表。
5. Flyway `outOfOrder=true` + `baselineOnMigrate=true`；每个服务有独立 schema `wrongbook.*` / `anon.*`，PG 搜索路径 `SET search_path = anon,wrongbook,public`。
6. JPA 实体 + QueryDSL Q 类生成；`guest_session` 的 `expires_at` 索引配 `BRIN`（过期扫描效率）。

**验证**：
```bash
mvn -pl wrongbook-service -am -q flyway:info
# 必须出现 V20260421_01 且 state=Success
psql -tAc "\\dt wb_*" | grep -c '^wb_' | grep -q '^7$'    # 7 张 wb_ 开头表
psql -tAc "select count(*) from ebbinghaus_node_config where strategy_code='EBBINGHAUS_STD'" | grep -q '^7$'
```

**完成判定**：`mvn -pl wrongbook-service -am test` 中的 `@DataJpaTest` 全绿，包含 `wb_question` insert/select 往返。

---

### S2. 文件服务 + OSS 直传（1 天）

**目标**：学生端拿到预签名 URL 直传 OSS；后端只收回调与 metadata。

**工具**：MinIO SDK 8 / 阿里云 OSS SDK 3；`spring-cloud-starter-alibaba-oss`（社区）或自封装；`ClamAV` 旁路扫描（P1）。

**步骤**：
1. `file-service`：
   - `POST /api/files/presign` 返回 `{url, method:PUT, objectKey, expiresInSec}`。
   - `POST /api/files/callback` 验证签名 → 写 `wb_file` 元表。
2. 小程序用 `wx.uploadFile`，H5 用 `fetch(PUT)`，统一 Content-Type。
3. 错题主流程：`POST /api/wb/questions:upload` 支持"已预上传（objectKey）"与"原始 multipart"两模式。

**验证**：Playwright 用例「拍题 3 次并发」100% 成功；OSS bucket 出现 3 个对象；`wb_question.origin_image` 回填。

**完成判定**：跨端（小程序 + H5）共用同一 `presign → PUT → callback` 流程，失败率 < 1%。

---

### S3. Spring AI 错题分析（2 天）

**目标**：完成 §6 的同步 + 流式两模式；JSON 解析成功率 ≥ 98%。

**工具**：Spring AI 1.0、`spring-ai-openai-spring-boot-starter`、`spring-ai-qianwen-starter`（可替换）、`spring-ai-pgvector-store`。

**步骤**：
1. 抽象 `ChatClientFactory` + `longfeng.ai.provider` 配置项（`openai|qianwen|zhipu`），运行时单例选择。
2. Prompt 模板放 `resources/prompts/*.st`，用 `PromptTemplate` 加载，支持热更新（Nacos 配置）。
3. 同步 `analyze()` + 流式 `analyzeStream()`，后者输出 `AnalysisChunk{stage,chunk,progressPct}`。
4. `@Tool` 定义 `lookupKnowledgePoint(code)`，失败时兜底。
5. 图片 → `org.springframework.core.io.Resource` → `UserMessage` 的 `Media`。
6. `pgvector` embedding 异步更新 `wb_question.embedding`。

**验证**：
```bash
# 100 张样本 JSON 可解析
mvn -pl ai-analysis-service -Dtest=QuestionAnalyzerGoldenTest test
# 金标断言：
#  - JSON 解析成功率 ≥ 98%
#  - 必填字段覆盖率（stem/errorType/solutionSteps）≥ 95%
```

**完成判定**：同步 P95 ≤ 6 s；流式首 chunk ≤ 1.2 s；JSON 二次重试后失败率 < 1%。

---

### S4. 错题域 CRUD + 检索（1.5 天）

**目标**：REST API 覆盖 §10.1–10.4 中错题部分，支持三种检索（学科、知识点、语义）。

**工具**：Spring Data JPA + QueryDSL 5；`pgvector <=> ` 近邻；`pg_trgm` 模糊。

**步骤**：
1. `QuestionController`：保留旧路径 `/api/question/*`（兼容老前端） + 新增 `/api/wb/questions/*`（新契约）。
2. 检索：`/api/wb/questions/search?q=二次函数&mode=semantic|fulltext|hybrid`。
3. 修正 AI 结果：`/api/wb/questions/{id}/correction` 写入 `wb_analysis_result` 新版本。
4. 归档：`/api/wb/questions/{id}:archive` 级联触发 `question.archived.topic`。

**验证**：OpenAPI 文档生成 / Orval 成功；契约测试（Spring Cloud Contract）全绿。

**完成判定**：前端 Orval 生成的 Hooks 能编译；所有列表接口支持 Keyset 分页，P99 < 150 ms。

---

### S5. 艾宾浩斯引擎 + 日历联动（2 天）

**目标**：§7 全部功能；与 calendar-core 的 internal API 串联。

**工具**：XXL-Job 2.4、RocketMQ 5、Feign + 幂等键（`Idempotency-Key`）。

**步骤**：
1. 实现 `EbbinghausEngine.plan()` + `onReviewed()`。
2. `@XxlJob("node-ready-scan")`、`@XxlJob("node-due-push")`、`@XxlJob("node-forgotten-sweep")`。
3. `CalendarEventClient`（Feign）批量建 / 改 / 删事件；失败 outbox 重试。
4. 事件：`question.confirmed.topic` → review-plan-service 消费并建计划；`review.reviewed.topic` → calendar-core 更新事件状态。
5. 单元测试覆盖 5 个关键分支：掌握推进、部分重试、未掌握重置、超 24h 超时、T6 完成。

**验证**：
```bash
# 故意把 T1 设为 3 秒偏移，跑集成测试验证完整节点时序
mvn -pl integration-test -Dtest=EbbinghausEndToEndIT test
```

**完成判定**：10 个样本错题 × 7 个节点 = 70 次预期触发，实际触发 ≥ 69 次、漂移 P99 < 30 s。

---

### S6. 多渠道推送（1 天）

**目标**：复用日历 notification-service，增加错题复习模板。

**工具**：微信订阅消息 API、阿里云邮件推送 / SendGrid、APP 推送（Getui / Firebase）、模板引擎 Thymeleaf/Pebble。

**步骤**：
1. 模板 `wrong_question_review_v1`（小程序订阅）含字段：`thing1=学科` `thing2=错因摘要` `time3=复习时间`。
2. 学生偏好：`免打扰时段 23:00–07:30`；到期命中免打扰的节点延迟至次日 08:00。
3. 失败重试 3 次 + 指数退避；最终失败写站内红点兜底。

**验证**：模拟 3 通道并发 1000 条推送，成功率 ≥ 99%，首触达 P95 < 5 s。

**完成判定**：模板审核通过（至少小程序 + 邮件两条链路通）；学生可在设置页按通道开关。

---

### S7. 前端 — 拍题 / 分析结果 / 错题本（2 天）

**目标**：W1–W5 页面在小程序 + H5 双端落地。

**工具**：见《前端计划 v2》 F6–F8 + F11–F13；增量库：`wxml-camera-helper`（拍照矫正，MIT）、`react-easy-crop`（H5 裁剪）。

**步骤**：
1. 小程序：新建分包 `packages/camera`、`packages/wrongbook`；拍题 → 预签名 → 上传 → SSE/WS 监听 → 结果卡。
2. H5：`/capture`、`/analyzing/:taskId`、`/questions`、`/questions/:id`；复用 Konsta UI `Page`、`Navbar`、`Block`、`Button`。
3. 结果卡组件：步骤条、知识点 chips、难度星标、"保存并开启复习"按钮（调 `/api/wb/questions/{id}:confirm`）。

**验证**：Playwright + miniprogram-automator 冒烟：上传 1 张样本图 → 终态 `CONFIRMED` → 出现日历事件 T1。

**完成判定**：双端 5 张页面 100% 覆盖；axe-core 无 serious 违规；Lighthouse Perf ≥ 85（H5）。

---

### S8. 前端 — 复习计划 / 执行闭环（1.5 天）

**目标**：W6–W7 页面；与日历 Tab 挂接。

**步骤**：
1. "今日待复习"列表：上拉加载；下拉刷新；item 点击跳执行页。
2. 执行页：三段式布局（题干 → 自答 → 揭示 → 自评）；埋点 `review_duration_ms`。
3. 日历 Tab 事项被点击 → 根据 `relationType=STUDY` 路由到执行页，而非通用详情。
4. 效果回写后 Toast + 振动反馈；刷新日历事件状态。

**验证**：端到端"拍题 → 等待 T1（测试模式 3 秒）→ 执行 → 掌握 → T2 出现"全路径 Playwright 跑通。

**完成判定**：执行页首屏 TTI < 1.5 s；自评按钮点击到日历刷新 < 400 ms。

---

### S9. 端到端联调 + 冒烟（1 天）

**目标**：把 §2B 的 15 个 Scenario Choreography（10 登录态 + 5 匿名态）以 Playwright 自动化脚本兜底，`e2e-smoke.sh` 扩展覆盖错题全链路 + 匿名态 claim / share / resolve 端到端。

**工具**：Playwright 1.45 + miniprogram-automator + allure-combine；Testcontainers 启动 PG/Redis/RocketMQ；`@playwright/test` 的 `test.step()` 与 §2B 的 Choreography 步骤 1:1 对应。

**目录结构**：
```
e2e/
├── playwright.config.ts        # baseURL / device profile / trace / video
├── fixtures/
│   ├── student.ts              # 登录态 & storageState
│   ├── testdata.ts             # 题目样本 / Mock 图片
│   └── clock.ts                # 冻结时间 / 快进记忆曲线
├── pages/                      # Page Object Model（14 页）
│   ├── LoginPage.ts            # P00
│   ├── HomePage.ts             # P-HOME
│   ├── WrongbookListPage.ts    # P05
│   ├── WrongbookDetailPage.ts  # P06
│   ├── CapturePage.ts          # P02
│   ├── AnalyzingPage.ts        # P03
│   ├── ResultPage.ts           # P04
│   ├── ReviewQueuePage.ts      # P07
│   ├── ReviewExecPage.ts       # P08
│   ├── ReviewResultPage.ts     # P09
│   ├── CalendarPage.ts         # P10
│   ├── EventDetailPage.ts      # P11
│   ├── NotificationsPage.ts    # P12
│   └── SettingsPage.ts         # P13
└── specs/                      # 15 个 Scenario Choreography 对应脚本（10 登录态 + 5 匿名态）
    ├── sc-01.spec.ts           # 首次拍题→入库→首节点排期
    ├── sc-02.spec.ts           # 推送唤起→执行→下一节点
    ├── sc-03.spec.ts           # 全部开始连做·中途退出
    ├── sc-04.spec.ts           # FORGOT 自评→节点重排
    ├── sc-05.spec.ts           # 首页条带→日历→事件详情→立即复习
    ├── sc-06.spec.ts           # 日历→通用事件→编辑
    ├── sc-07.spec.ts           # AI 二次超时→手填
    ├── sc-08.spec.ts           # 跨时区登录
    ├── sc-09.spec.ts           # 家长分享考试日
    ├── sc-10.spec.ts           # 归档错题
    ├── sc-11.spec.ts           # ★ 访客落地页 → 样例预览（匿名态）
    ├── sc-12.spec.ts           # ★ 游客试用 1 次 → 注册 → Claim（匿名态）
    ├── sc-13.spec.ts           # ★ 分享链接收方 → 脱敏预览 → 升级（匿名态）
    ├── sc-14.spec.ts           # ★ 流失用户回流 → 一键回登（匿名态 P1）
    └── sc-15.spec.ts           # ★ 观察者会话（只读）（匿名态 P1）
```

**命名约定**：
- 每个 `sc-XX.spec.ts` 至少落地对应场景的 `TC-XX.01`（正常 Happy Path），异常 / 边界 / 安全用例按 §2B 的 TC-XX.02…TC-XX.NN 逐条追加 `test()`。
- 步骤用 `test.step('F01 | ...', ...)` 承载，文本与 §2B 编排表的 `F##` 列一字不差，方便 QA 回溯失败到具体帧。
- 视觉回归（VRT）快照命名：`sc-0X-step-F##-{page-id}.png`，例如 `sc-01-step-F05-p03.png`。

**步骤**：

1. 搭骨架：在 monorepo `e2e/` 子工程安装 Playwright，写 `playwright.config.ts`（devices: `iPhone 13`, `Desktop Chrome`；trace: `on-first-retry`；reporter: allure）。
2. 建 19 个 Page Object（14 登录态 + 5 匿名态：LandingPage / GuestCapturePage / SharedPage / WelcomeBackPage / ObserverPage）；每个 POM 暴露语义动作（`home.clickTodayStripItem(n)` / `exec.selectSelfRate('MASTERED')` / `landing.tapTryNow()` / `guest.triggerAnalysis()`），避免测试脚本里散落选择器。
3. 落地 6 份 **核心骨架**（3 登录态 SC-01/02/05 + 3 匿名态 SC-11/12/13，见下）；其余 9 份按同模板扩展（PR 合入时必须附对应 `sc-XX.spec.ts`）。
4. `smoke.sh` 追加 8 个 curl 断言：上传 → SSE 终态 → 节点查询 → 掌握回写 → 下一节点生成 + `GET /api/session/resolve`（匿名态） + `POST /api/guest/:sid/claim`（幂等验证） + `GET /api/share/:token/preview`（脱敏字段抽检）。
5. 多供应商 AI：跑两次（`longfeng.ai.provider=openai` 与 `qianwen`），都必须 PASS。
6. CI：`pnpm e2e:smoke`（SC-01/02/05 登录态 + SC-11/12/13 匿名态，共 6 份，<8 min，合入 PR 红线）、`pnpm e2e:full`（15 个 SC，夜间 Nightly）。

#### S9.1 骨架样例 A：`sc-01.spec.ts`（首次拍题→入库→首节点排期）

对应 §2B.2 SC-01，覆盖 20 帧 F01–F20 与 TC-01.01 / TC-01.02。

```ts
// e2e/specs/sc-01.spec.ts
import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { CapturePage } from '../pages/CapturePage';
import { AnalyzingPage } from '../pages/AnalyzingPage';
import { ResultPage } from '../pages/ResultPage';
import { WrongbookListPage } from '../pages/WrongbookListPage';
import { freezeClock, advanceTo } from '../fixtures/clock';
import { loginAsStudent } from '../fixtures/student';
import { sampleWrongShot } from '../fixtures/testdata';

test.describe('SC-01 · 首次拍题 → 入库 → 首节点排期', () => {
  test.beforeEach(async ({ page, context }) => {
    // 固定时间到 2026-04-21 08:30:00 Asia/Shanghai，保证排期断言可复现
    await freezeClock(context, '2026-04-21T08:30:00+08:00');
    await loginAsStudent(page, { studentId: 'stu_qa_001' });
  });

  test('TC-01.01 | Happy path：拍题 → 分析 → 确认 → T0/T1 节点生成', async ({ page }) => {
    const home = new HomePage(page);
    const capture = new CapturePage(page);
    const analyzing = new AnalyzingPage(page);
    const result = new ResultPage(page);
    const list = new WrongbookListPage(page);

    // GIVEN 学生已登录，首页 Tab 可见
    await test.step('F01 | 打开 App 至 P-HOME', async () => {
      await expect(home.root).toBeVisible();
      await expect(home.todayStrip).toBeVisible();
    });

    // WHEN 学生从首页进入拍题
    await test.step('F02 | 点击「拍一道错题」FAB → 进入 P02', async () => {
      await home.clickCaptureFab();
      await expect(capture.viewfinder).toBeVisible();
    });

    await test.step('F03 | 选择样例错题图片上传', async () => {
      await capture.pickPhoto(sampleWrongShot('math_eq_quadratic'));
      await capture.clickConfirmUpload();
    });

    await test.step('F04 | P03 分析中：骨架屏 + 进度条 + SSE 流式字幕', async () => {
      await expect(analyzing.progressBar).toBeVisible();
      await expect(analyzing.streamCaption).toContainText(/识别|解析|抽取/);
    });

    await test.step('F05 | P04 结果页：题干 / 知识点 / 错因 / 纠正 四卡出现', async () => {
      await expect(result.stemCard).toBeVisible();
      await expect(result.knowledgePoints).toHaveCount({ min: 1 });
      await expect(result.errorReasonCard).toBeVisible();
      await expect(result.correctionCard).toBeVisible();
    });

    // THEN 确认入库后首节点落在日历上
    await test.step('F06 | 点击「确认加入错题本」', async () => {
      await result.clickConfirmArchive();
    });

    await test.step('F07 | 回到 P05 错题本列表：新错题在顶部', async () => {
      await expect(list.firstItemTitle).toContainText('二次方程');
      await expect(list.firstItemBadge).toHaveText('新');
    });

    await test.step('F08 | 后端断言：T0 INITIAL 完成 + T1 H1 已排期', async () => {
      const nodes = await page.request.get('/api/wb/review/nodes?qid=latest').then(r => r.json());
      expect(nodes).toContainEqual(expect.objectContaining({ level: 'T0', status: 'COMPLETED' }));
      expect(nodes).toContainEqual(expect.objectContaining({ level: 'T1', status: 'PENDING' }));
    });

    await test.step('F09 | 日历/首页条带：T1 节点在今日出现（测试模式 H1=3 s 已过）', async () => {
      await advanceTo(page.context(), '+4s');
      await home.goto();
      await expect(home.todayStripItem('T1')).toBeVisible();
    });
  });

  test('TC-01.02 | 异常：AI 首次超时 → 自动重试一次 → 成功', async ({ page }) => {
    const capture = new CapturePage(page);
    const analyzing = new AnalyzingPage(page);

    await test.step('GIVEN 打开拍题页', async () => {
      await new HomePage(page).clickCaptureFab();
    });
    await test.step('WHEN AI 首次返回 504，系统静默重试', async () => {
      await capture.mockAnalyzeOnce({ status: 504 });
      await capture.pickPhoto(sampleWrongShot('math_eq_quadratic'));
      await capture.clickConfirmUpload();
      await expect(analyzing.retryBadge).toBeVisible();
    });
    await test.step('THEN 第二次成功并落到结果页', async () => {
      await expect(new ResultPage(page).stemCard).toBeVisible({ timeout: 15_000 });
    });
  });
});
```

#### S9.2 骨架样例 B：`sc-02.spec.ts`（推送唤起 → 执行 → 下一节点）

对应 §2B.3 SC-02，12 帧 F01–F12 与 TC-02.01…02.05。

```ts
// e2e/specs/sc-02.spec.ts
import { test, expect } from '@playwright/test';
import { simulatePush } from '../fixtures/push';
import { loginAsStudent } from '../fixtures/student';
import { freezeClock, advanceTo } from '../fixtures/clock';
import { ReviewExecPage } from '../pages/ReviewExecPage';
import { ReviewResultPage } from '../pages/ReviewResultPage';
import { EventDetailPage } from '../pages/EventDetailPage';

test.describe('SC-02 · 推送唤起 → 进入 P08 执行 → 回写 → 下一节点', () => {
  test.beforeEach(async ({ context }) => {
    await freezeClock(context, '2026-04-22T19:00:00+08:00');
  });

  test('TC-02.01 | Happy path：点通知 → 执行 → 自评 MASTERED → T2 生成', async ({ page, context }) => {
    await loginAsStudent(page, { studentId: 'stu_qa_001' });

    await test.step('F01 | 模拟系统推送到达（deep link: wb://review/exec/:nodeId）', async () => {
      await simulatePush(context, {
        title: '该复习二次方程啦',
        deeplink: 'wb://review/exec/node_T1_abc',
      });
    });

    await test.step('F02 | 点击通知 → 直达 P08 执行页', async () => {
      await context.clickLatestNotification();
      await expect(new ReviewExecPage(page).timer).toBeVisible();
    });

    await test.step('F03~F08 | 作答 → 自评 MASTERED', async () => {
      const exec = new ReviewExecPage(page);
      await exec.typeAnswer('x = 2 或 x = -3');
      await exec.clickCheck();
      await exec.selectSelfRate('MASTERED');
      await exec.clickSubmit();
    });

    await test.step('F09 | P09 结果页：下一节点预告卡出现', async () => {
      const resultPage = new ReviewResultPage(page);
      await expect(resultPage.nextNodePreview).toContainText('T2 · D1');
    });

    await test.step('F10 | 日历事件变绿，P11 事件详情一致', async () => {
      await page.goto('wb://event/evt_T1_abc');
      const detail = new EventDetailPage(page);
      await expect(detail.statusChip).toHaveText('COMPLETED');
      await expect(detail.statusChip).toHaveCSS('background-color', /rgb\(16,\s*185,\s*129\)/); // 绿色
    });

    await test.step('F11 | 后端断言：T2 节点已生成，due_at = 当前 + 1d', async () => {
      const nodes = await page.request.get('/api/wb/review/nodes?qid=latest').then(r => r.json());
      expect(nodes).toContainEqual(expect.objectContaining({ level: 'T2', status: 'PENDING' }));
    });
  });

  test('TC-02.02 | 异常：推送点开时 token 过期 → 无感刷新 → 继续流转', async ({ page, context }) => {
    await loginAsStudent(page, { studentId: 'stu_qa_001', expireToken: true });
    await simulatePush(context, { deeplink: 'wb://review/exec/node_T1_abc' });
    await context.clickLatestNotification();
    await expect(new ReviewExecPage(page).timer).toBeVisible({ timeout: 10_000 });
  });
});
```

#### S9.3 骨架样例 C：`sc-05.spec.ts`（首页条带 → 日历 → 事件详情 → 立即复习）

对应 §2B.6 SC-05，9 帧主路径 + 分支 B，TC-05.01…05.06。

```ts
// e2e/specs/sc-05.spec.ts
import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { CalendarPage } from '../pages/CalendarPage';
import { EventDetailPage } from '../pages/EventDetailPage';
import { ReviewExecPage } from '../pages/ReviewExecPage';
import { loginAsStudent } from '../fixtures/student';
import { freezeClock } from '../fixtures/clock';

test.describe('SC-05 · 首页条带 → 日历 → 事件详情 → 立即复习（视图融合验证）', () => {
  test.beforeEach(async ({ page, context }) => {
    await freezeClock(context, '2026-04-22T10:00:00+08:00');
    await loginAsStudent(page, { studentId: 'stu_qa_001' });
  });

  test('TC-05.01 | Happy path：三路径抵达同一节点，事件详情数据一致', async ({ page }) => {
    const home = new HomePage(page);
    const calendar = new CalendarPage(page);
    const detail = new EventDetailPage(page);

    await test.step('F01 | 首页条带看到 T1 节点（二次方程）', async () => {
      await expect(home.todayStripItem('T1')).toBeVisible();
    });

    await test.step('F02~F03 | 切到日历 Tab → 定位今日 → 看到同一事件', async () => {
      await home.openSecondaryCalendar();
      await expect(calendar.todayCell).toHaveAttribute('data-event-count', '1');
      await calendar.clickTodayCell();
    });

    await test.step('F04 | 进入 P11 事件详情（复习节点形态）', async () => {
      await expect(detail.heroTLevelChip).toHaveText(/T1/);
      await expect(detail.memoryCurveSvg).toBeVisible();
      await expect(detail.thumbnailCard).toBeVisible();
    });

    await test.step('F05 | 核心断言：事件详情字段与首页条带/日历一致', async () => {
      const payload = await page.request.get('/api/calendar/events/evt_T1_abc').then(r => r.json());
      expect(payload.relation_type).toBe('STUDY');
      expect(payload.relation_id).toMatch(/^question:.+:node:.+$/);
    });

    await test.step('F06~F09 | 点击「立即复习」→ P08，与通知入口状态一致', async () => {
      await detail.clickStartNow();
      const exec = new ReviewExecPage(page);
      await expect(exec.timer).toBeVisible();
      await expect(exec.nodeIdLabel).toHaveText('node_T1_abc');
    });
  });

  test('TC-05.02 | 分支 B：在 P11 点击「延后 30 分」→ 节点 due_at + 30 min，日历事件时间回写', async ({ page }) => {
    const calendar = new CalendarPage(page);
    const detail = new EventDetailPage(page);

    await page.goto('wb://event/evt_T1_abc');
    await detail.clickSnooze30();

    await expect(detail.statusChip).toHaveText('PENDING');
    const node = await page.request.get('/api/wb/review/nodes/node_T1_abc').then(r => r.json());
    const now = new Date('2026-04-22T10:00:00+08:00').getTime();
    expect(new Date(node.due_at).getTime() - now).toBeGreaterThanOrEqual(30 * 60 * 1000);
  });

  test('TC-05.03 | 视图融合：同一 relation_id 在三个入口（首页/日历/推送）打开的 P11 payload 字段全等', async ({ page, context }) => {
    // … 参考 §2B.6 TC-05.03，断言三路 payload JSON.stringify 相等
  });
});
```

**POM 约定（节选）**：

```ts
// e2e/pages/EventDetailPage.ts（视图融合锚点，SC-05/06 共用）
export class EventDetailPage {
  constructor(public readonly page: Page) {}
  get heroTLevelChip()   { return this.page.getByTestId('event-hero-tlevel'); }
  get statusChip()       { return this.page.getByTestId('event-status-chip'); }
  get memoryCurveSvg()   { return this.page.getByTestId('memory-curve'); }
  get thumbnailCard()    { return this.page.getByTestId('wrong-thumbnail'); }
  clickStartNow()        { return this.page.getByRole('button', { name: '立即复习' }).click(); }
  clickSnooze30()        { return this.page.getByRole('button', { name: /延后\s*30/ }).click(); }
}
```

#### S9.4 匿名态骨架样例 D：`sc-11.spec.ts`（访客落地页 → 样例预览）

对应 §2B.12 SC-11，F01-F07 与 TC-11.01 / TC-11.03（降级）。

```ts
// e2e/specs/sc-11.spec.ts
import { test, expect } from '@playwright/test';
import { LandingPage } from '../pages/LandingPage';
import { mockSamples } from '../fixtures/landing';

test.describe('SC-11 · 陌生访客 → 落地页 → 样例预览', () => {
  test('TC-11.01 | Happy path：冷启动 → TTI ≤ 1.0s → 点 Sample 浮层', async ({ page, context }) => {
    const landing = new LandingPage(page);

    await test.step('F01~F02 | 冷启动决策树落位 P-LANDING', async () => {
      await page.goto('/welcome');
      await expect(landing.hero).toBeVisible({ timeout: 1000 });
    });

    await test.step('F03 | hero 动图播放', async () => {
      await expect(landing.heroDemo).toHaveAttribute('data-state', 'playing');
    });

    await test.step('F04 | 点「数学」Sample 展开浮层', async () => {
      await landing.openSample('math');
      await expect(landing.sampleSheet).toBeVisible();
      await expect(landing.sampleSheet).toContainText('二次方程');
    });

    await test.step('F07A | 点「试试看」进入 P-GUEST-CAPTURE', async () => {
      await landing.closeSample();
      await landing.clickTryItNow();
      await expect(page).toHaveURL(/\/guest\/capture/);
    });
  });

  test('TC-11.03 | 异常：/landing/samples 500 → 降级态', async ({ page }) => {
    await mockSamples(page, { status: 500 });
    await page.goto('/welcome');
    const landing = new LandingPage(page);
    await expect(landing.hero).toBeVisible();
    await expect(landing.ctaTryItNow).toBeVisible();  // CTA 仍然可点
    await expect(landing.sampleChips).toHaveCount(0); // 样例降级不展示
  });
});
```

#### S9.5 匿名态骨架样例 E：`sc-12.spec.ts`（游客试用 + Claim）

对应 §2B.13 SC-12，F01-F10 与 TC-12.01 / TC-12.03 / TC-12.05。

```ts
// e2e/specs/sc-12.spec.ts
import { test, expect } from '@playwright/test';
import { LandingPage } from '../pages/LandingPage';
import { GuestCapturePage } from '../pages/GuestCapturePage';
import { AnalyzingPage } from '../pages/AnalyzingPage';
import { ResultPage } from '../pages/ResultPage';
import { LoginPage } from '../pages/LoginPage';
import { HomePage } from '../pages/HomePage';
import { newDeviceFingerprint, resetGuestQuota } from '../fixtures/guest';
import { sampleWrongShot } from '../fixtures/testdata';

test.describe('SC-12 · 游客试用 1 次 → 注册 → Claim 历史', () => {
  test.beforeEach(async ({ context }) => {
    await newDeviceFingerprint(context);
    await resetGuestQuota(context);
  });

  test('TC-12.01 | Happy path：拍题 → 分析 → 注册 → claim → P-HOME 含新题', async ({ page, context }) => {
    await test.step('F01~F02 | P-LANDING → P-GUEST-CAPTURE, consent 勾选', async () => {
      await new LandingPage(page).goto();
      await new LandingPage(page).clickTryItNow();
      await new GuestCapturePage(page).acceptConsent();
    });

    await test.step('F03~F04 | 拍题 → SSE 流 → 游客态结果', async () => {
      await new GuestCapturePage(page).pickPhoto(sampleWrongShot('math_eq_quadratic'));
      await new GuestCapturePage(page).clickShutter();
      await expect(new AnalyzingPage(page).guestBanner).toBeVisible();
      await expect(new ResultPage(page).stemCard).toBeVisible({ timeout: 15_000 });
    });

    await test.step('F06~F08 | 点「保存到错题本」→ 登录 → claim', async () => {
      await new ResultPage(page).clickSaveToWrongbook();
      const login = new LoginPage(page);
      await login.loginWithWechatMock({ studentId: 'stu_qa_guest_claim_001' });
      await expect(page.getByTestId('claim-loading')).toBeVisible();
    });

    await test.step('F09 | P-HOME 出现新题徽章', async () => {
      const home = new HomePage(page);
      await expect(home.todayNewCount).toHaveText('1');
      const nodes = await page.request.get('/api/wb/review/nodes?qid=latest').then(r => r.json());
      expect(nodes).toContainEqual(expect.objectContaining({ level: 'T0', status: 'COMPLETED' }));
      expect(nodes).toContainEqual(expect.objectContaining({ level: 'T1', status: 'PENDING' }));
    });
  });

  test('TC-12.03 | 异常：AI 首次 504 → 不扣额度 → 重试成功', async ({ page, context }) => {
    const capture = new GuestCapturePage(page);
    await new LandingPage(page).goto();
    await new LandingPage(page).clickTryItNow();
    await capture.acceptConsent();
    await capture.mockAnalyzeOnce({ status: 504 });
    await capture.pickPhoto(sampleWrongShot('math_eq_quadratic'));
    await capture.clickShutter();
    await expect(capture.quotaRemaining).toHaveText('1/1'); // 不扣额度
    await expect(new ResultPage(page).stemCard).toBeVisible({ timeout: 20_000 });
  });

  test('TC-12.05 | 边界：同设备同日第 2 次 → 429 挡板', async ({ page, context }) => {
    await context.request.post('/api/_test/guest-quota/exhaust');  // Test-only hook
    await new LandingPage(page).goto();
    await new LandingPage(page).clickTryItNow();
    const capture = new GuestCapturePage(page);
    await expect(capture.quotaExhaustedOverlay).toBeVisible();
    await capture.clickGotoLogin();
    await expect(page).toHaveURL(/\/auth/);
  });
});
```

#### S9.6 匿名态骨架样例 F：`sc-13.spec.ts`（分享链接收方）

对应 §2B.14 SC-13，F01-F07 与 TC-13.01 / TC-13.03 / TC-13.04。

```ts
// e2e/specs/sc-13.spec.ts
import { test, expect } from '@playwright/test';
import { SharedPage } from '../pages/SharedPage';
import { LoginPage } from '../pages/LoginPage';
import { HomePage } from '../pages/HomePage';
import { issueShareToken, revokeShareToken } from '../fixtures/share';

test.describe('SC-13 · 分享链接收方 → 脱敏预览 → 升级注册', () => {
  test('TC-13.01 | Happy path：EXAM_DAY 令牌 → 只读预览 → 写按钮弹登录', async ({ page }) => {
    const token = await issueShareToken({ type: 'EXAM_DAY', eventId: 'evt_exam_2026_05_01' });
    await page.goto(`/s/${token}`);

    const shared = new SharedPage(page);
    await expect(shared.sharedBanner).toContainText('来自');
    await expect(shared.maskedCard).toBeVisible();
    await shared.clickUpgradeCTA();
    await expect(page).toHaveURL(/\/auth/);
  });

  test('TC-13.03 | 异常：令牌过期 → 挡板页', async ({ page }) => {
    const token = await issueShareToken({ type: 'QUESTION', questionId: 'q_1', expiresInSec: -1 });
    await page.goto(`/s/${token}`);
    const shared = new SharedPage(page);
    await expect(shared.expiredOverlay).toBeVisible();
    await shared.clickBackToLanding();
    await expect(page).toHaveURL(/\/welcome/);
  });

  test('TC-13.04 | 安全：匿名 POST 写操作 → 网关 403', async ({ page, request }) => {
    const token = await issueShareToken({ type: 'QUESTION', questionId: 'q_1' });
    const resp = await request.post(`/api/share/${token}/comment`, { data: { text: 'hi' } });
    expect(resp.status()).toBe(403);
    expect(await resp.json()).toMatchObject({ code: 'ANONYMOUS_WRITE_FORBIDDEN' });
  });
});
```

#### S9.7 其余 9 个场景

SC-03 / SC-04 / SC-06 / SC-07 / SC-08 / SC-09 / SC-10 / SC-14 / SC-15 按同一模板扩展：

- `test.describe('SC-0X · <标题>')` 对应 §2B.X 章节；
- 每个 `test()` 对应一行 TC-0X.YY；
- `test.step('F##', ...)` 与编排表 F## 一一对应；
- 后端副作用（节点状态 / 事件状态 / 计数器 / 黑名单 / 令牌）统一走 `page.request` 调 API 校验，避免只靠 UI 断言；
- **SC-14** 重点验证设备指纹命中 + 一键刷 Token；**SC-15** 重点验证 `OBSERVER` JWT 的 scope 限制 + 撤销秒级生效。

**POM 补充**：

```ts
// e2e/pages/LandingPage.ts
export class LandingPage {
  constructor(public readonly page: Page) {}
  get hero()          { return this.page.getByTestId('landing-hero'); }
  get heroDemo()      { return this.page.getByTestId('landing-hero-demo'); }
  get sampleChips()   { return this.page.getByTestId('landing-sample-chip'); }
  get sampleSheet()   { return this.page.getByTestId('landing-sample-sheet'); }
  get ctaTryItNow()   { return this.page.getByRole('button', { name: '试试看（无需注册）' }); }
  get ctaLogin()      { return this.page.getByRole('button', { name: /已有账号/ }); }
  goto()              { return this.page.goto('/welcome'); }
  openSample(s: string) { return this.sampleChips.filter({ hasText: s }).click(); }
  closeSample()       { return this.page.getByTestId('sample-sheet-close').click(); }
  clickTryItNow()     { return this.ctaTryItNow.click(); }
}

// e2e/pages/GuestCapturePage.ts
export class GuestCapturePage {
  constructor(public readonly page: Page) {}
  get banner()             { return this.page.getByTestId('guest-banner'); }
  get quotaRemaining()     { return this.page.getByTestId('guest-quota'); }
  get quotaExhaustedOverlay() { return this.page.getByTestId('guest-quota-overlay'); }
  acceptConsent()          { return this.page.getByTestId('consent-checkbox').check(); }
  pickPhoto(f: File | string) { return this.page.setInputFiles('input[type=file]', f); }
  clickShutter()           { return this.page.getByTestId('shutter').click(); }
  mockAnalyzeOnce(resp: any) { return this.page.route('**/api/guest/analyze', r => r.fulfill(resp), { times: 1 }); }
  clickGotoLogin()         { return this.page.getByRole('button', { name: /注册|登录/ }).click(); }
}

// e2e/pages/SharedPage.ts
export class SharedPage {
  constructor(public readonly page: Page) {}
  get sharedBanner()    { return this.page.getByTestId('shared-banner'); }
  get maskedCard()      { return this.page.getByTestId('masked-card'); }
  get expiredOverlay()  { return this.page.getByTestId('share-expired'); }
  clickUpgradeCTA()     { return this.page.getByRole('button', { name: /立即注册|登录后查看/ }).click(); }
  clickBackToLanding()  { return this.page.getByRole('button', { name: /回到首页/ }).click(); }
}
```

**完成判定**：
- 15 份 `sc-XX.spec.ts` 全部就位，CI 夜间 `pnpm e2e:full` 通过率 100%；
- PR 红线 `pnpm e2e:smoke`（SC-01/02/05 登录态 + SC-11/12/13 匿名态，共 6 份）< 8 min；
- Allure 报告 zero flaky；Trace 可下载；VRT 快照差异 < 1% 方可合入；
- 匿名态 spec **必须**开启 `testDeviceFingerprint` 固定值夹具，避免 CI 机器指纹漂移导致误命中 P-WELCOMEBACK。

---

### S10. 可观测 + 部署（1 天）

**目标**：Helm 上线；监控看板；Sentry 前后端接通。

**工具**：Helm 3、Prometheus Operator、Grafana、SkyWalking 10、Sentry 自托管。

**步骤**：
1. Helm chart 新增 `wrongbook-service` / `ai-analysis-service` / `review-plan-service` / `file-service`。
2. Grafana 仪表板：`AI 调用成功率`、`节点到期准时率`、`各通道推送成功率`、`错题日新增`、`掌握率趋势`。
3. Sentry DSN 按租户分发；前端错题页面打 `tag: feature=wrongbook`。
4. 流量压测（k6）对 `/api/wb/questions:upload` 500 并发 5 min。

**完成判定**：`helm upgrade --install` 成功；关键 SLO 看板上线；压测 P95 达标。

---

## 13. 现有代码最小侵入融合清单

| 现有位置 | 处置 | 原因 |
|---|---|---|
| `backend/src/main/java/com/longfeng/wrongbook/WrongBookApplication.java` | **保留为 wrongbook-service 启动类**，包路径不变 | 避免前端 / 测试客户端已配置的服务名失效 |
| `QuestionController` | 保留现路径 `/api/question/*`，新增 `/api/wb/questions/*`；两者共存 3 个月后下线旧路径 | 向前兼容 |
| `QuestionService` | **只改实现、不改签名**：分析调用从本地 → 走 Feign `AiAnalysisClient` | 渐进式升级 |
| `ImageAnalysisService` | **迁入 ai-analysis-service 并重写为 Spring AI**；保留同名接口（包路径变动） | 业务语义不变 |
| `AnalysisResult` / `QuestionResponse` | **上移到 common-api 模块**；字段扩充为 §4.3 的投影 | 单一契约源 |
| `WebConfig` | CORS + ObjectMapper 配置保留，合并到 `common-core` 的 `WebMvcAutoConfig` | 消除重复 |
| `application.yml` | 拆分：公共项走 Nacos，秘密走 Vault；保留 local profile 做开发降级 | 云原生标准做法 |
| `Dockerfile` | 每个子模块重写 Dockerfile；构建镜像改用 **Jib**（Maven 插件，无需本地 Docker daemon） | CI/CD 友好 |
| `uploads/` | 仅保留为 local 开发路径；生产删除 | OSS 接管 |
| **新增 `anonymous-service`** | 独立模块，不侵入现 wrongbook 代码 | 匿名逻辑与已登录业务解耦，便于合规审计 |
| **网关 `AnonFilter`** | 在 `AuthFilter` 之前生效，匿名请求走此分支 | 避免所有匿名请求都反复失败于登录鉴权 |

---

## 14. 风险与对策

| 风险 | 等级 | 对策 |
|---|---|---|
| 国内合规：生成式 AI 备案 | 高 | 默认国内模型（通义千问）+ 备案号注入响应头；海外版走 OpenAI 走不同租户 |
| 未成年人保护 | 高 | 学生注册强制家长同意；Prompt 前加儿童安全指令；图片 NSFW 前置拒绝；**匿名态新增**：P-GUEST-CAPTURE 前强制勾选 consent；P-SHARED 脱敏规则过合规评审；观察者视图禁止原图 |
| AI JSON 解析失败 | 中 | 双重重试 + 降级 Prompt + 结构化后处理（正则抢救）+ 手动标注兜底 |
| 推送延迟 | 中 | 节点前 30 min 预生成 task；XXL-Job 节点漂移告警；死信队列 10 min 接管 |
| 小程序审核驳回 | 中 | 不承载作业原文（版权）；图片不对外公开；小程序隐私政策单独审阅；**匿名态**：P-LANDING 不含作业原文，仅静态样例；P-SHARED 脱敏后二次审查 |
| 图片成本 | 中 | OSS 冷热分层；分析后 30 天仅保留低分辨率缩略图（学生可自主续期） |
| 模型价格波动 | 中 | 多供应商路由 + 每日成本看板 + 月度预算硬阈值 |
| 数据库热点 | 中 | `wb_review_node(due_at)` 索引 + 逻辑分区（按月）；ShardingSphere 按 `student_id` 分库（P1） |
| E2E 用例 Flaky | 低 | Testcontainers 固化时间 + Clock 注入 + 重试策略 |
| **匿名态 AI 被刷 / 成本爆表** | 高 | 设备指纹 + IP 双维度 Bucket4j 限速；CDN WAF 识别爬虫；日预算看板硬 kill；可疑指纹追加图形验证码 |
| **设备指纹被伪造** | 中 | 指纹组合多来源（Canvas/WebGL/AudioContext/UA/Accept-Language），单项失败自动降噪；命中多账号时降级 P00 选择 |
| **分享令牌泄露 / 链路劫持** | 中 | HS256 + `jti` 注册 + TTL ≤ 7d + 使用次数软限 + Bloom Filter 秒级撤销；响应强制 `no-store`；HTTPS only |
| **观察者越权** | 高 | 网关强制 `scope=READ`；`OBSERVER` JWT 独立签名密钥；黑名单秒级同步；所有写请求 403 + 审计 |
| **guest_session 过期清理压力** | 低 | `expires_at` BRIN 索引 + XXL-Job 每 30 min 批删 + 日表分区（按 `date_trunc('day', created_at)`） |
| **访客落地页被当着陆页当 SEO 滥用** | 低 | 不索引 `?entry_source=` 查询参数；canonical 指向 `/welcome`；rate limit `/api/landing/*` 单 IP 30/min |

---

## 15. 附录

### 15.1 核心技术选型一览

| 分类 | 组件 | 版本 | 用途 | 替代项 |
|---|---|---|---|---|
| 框架 | Spring Boot | 3.2.5 | 基础 | — |
| 微服务 | Spring Cloud | 2023.0.1 | OpenFeign / LoadBalancer | — |
| 中国生态 | Spring Cloud Alibaba | 2023.0.1.0 | Nacos / Sentinel / RocketMQ | — |
| AI | Spring AI | 1.0.0 | ChatClient / Embedding / RAG | LangChain4j |
| 持久 | Spring Data JPA + Hibernate | 6.4.x | ORM | MyBatis-Plus（拒用） |
| DB | PostgreSQL | 16 | OLTP + 向量 + 全文 | MySQL 8 |
| 向量 | pgvector | 0.7 | 语义检索 | Milvus 2.4 |
| 缓存 | Redis / Redisson | 7.2 / 3.27 | 分布式锁 / 热点缓存 | Hazelcast |
| MQ | RocketMQ | 5.2 | 事件 / 任务 | Kafka |
| 任务 | XXL-Job | 2.4.1 | 分布式定时 | Quartz Cluster |
| 配置 / 注册 | Nacos | 2.3 | 配置 + 注册 | Consul |
| 网关 | Spring Cloud Gateway | 4.1 | 反向代理 | APISIX |
| 鉴权 | Sa-Token 1.38 / Spring Security 6 | — | 会话 / JWT / 观察者 JWT / 分享 Token HS256 | Keycloak |
| 匿名态限速 | Bucket4j + Redis | 8 | 游客额度 / 分享链速率 / 落地页限流 | Sentinel Rule |
| 设备指纹 | FingerprintJS OSS | 4 | Canvas+WebGL+AudioContext 组合指纹 | 自研纯 Canvas 指纹 |
| CDN / WAF | Cloudflare / 阿里云 WAF | — | 匿名态落地页静态缓存 + 反爬 | AWS CloudFront |
| 存储 | MinIO / 阿里云 OSS | 8 / 3 | 错题图片 | S3 |
| 搜索 | Elasticsearch | 8.14 | 全文 + 聚合（P1 引入） | OpenSearch |
| 可观测 | SkyWalking / Prometheus / Grafana / ELK 8 | 10 / 2.x / 11 / 8 | Trace/Metric/Log | OpenTelemetry Collector |
| 部署 | Kubernetes / Helm / Jib | 1.29 / 3.14 / 3.4 | 云原生 | Docker Compose(dev) |
| 前端 H5 | Vite / React / Konsta UI / Tailwind | 5 / 18 / 3 / 3 | 移动 Web | Next.js |
| 小程序 | 原生 TS / Vant Weapp / MobX | — / 1.11 / 6 | 微信端 | Taro 3 |
| 跨端（P2） | React Native / Konsta RN | 0.74 / 3 | iOS/Android | Flutter |
| 共享 | pnpm / Turborepo / TypeScript | 9 / 2 / 5 | Monorepo | Nx |

### 15.2 统一错误码（节选）

| code | http | 含义 |
|---|---|---|
| 0 | 200 | 成功 |
| 40001 | 400 | 参数不合法 |
| 40101 | 401 | 未登录 / JWT 过期 |
| 42901 | 429 | 分析频率过高 |
| 50010 | 500 | AI 供应商不可用 |
| 50011 | 500 | AI 结果 JSON 解析失败 |
| 50020 | 500 | OSS 回调签名校验失败 |
| 50030 | 500 | 艾宾浩斯节点已过期 |
| 50031 | 500 | 节点状态非法跃迁 |
| 41001 | 410 | GUEST_SESSION_EXPIRED |
| 41002 | 410 | TOKEN_EXPIRED（分享 / 邀请）|
| 40301 | 403 | DEVICE_MISMATCH |
| 40302 | 403 | ANONYMOUS_WRITE_FORBIDDEN |
| 40303 | 403 | OBSERVER_FORBIDDEN_WRITE |
| 40304 | 403 | OBSERVER_REVOKED |
| 42902 | 429 | GUEST_QUOTA_EXHAUSTED |
| 42903 | 429 | LANDING_RATE_LIMIT |
| 40901 | 409 | GUEST_ALREADY_CLAIMED（幂等返回原 questionId） |

### 15.3 目录结构最终形态（截断）

```
calendar-platform/
├── pom.xml
├── common-core/
├── common-api/                         # AnalysisResult/QuestionResponse/ReviewNodeDTO 契约
├── gateway-service/
├── auth-service/
├── user-service/
├── wrongbook-service/                  # ★ 来自现 backend/
│   └── src/main/java/com/longfeng/wrongbook/{controller,service,repo,event}
├── ai-analysis-service/                # ★
│   └── src/main/java/com/longfeng/ai/{analyzer,prompt,vision,tool}
├── review-plan-service/                # ★
├── anonymous-service/                  # ★ 新增：guest / share / observer / welcome-back
│   └── src/main/java/com/longfeng/anon/{session,guest,share,observer,device}
├── calendar-core-service/              # [已有] 来自通用日历 P5
├── calendar-reminder-service/          # [已有] 来自通用日历 P7
├── notification-service/               # [已有] 来自通用日历 P8
├── file-service/                       # ★ OSS 预签名
├── integration-test/
├── infra/                              # docker-compose / k8s / helm
└── frontend/                           # pnpm workspace
    ├── apps/
    │   ├── miniprogram/
    │   └── h5/
    └── packages/
        ├── design-tokens/
        ├── api-contracts/              # Orval 生成
        ├── i18n/
        └── utils/
```

### 15.4 与《艾宾浩斯.md》条款对照

| 《艾宾浩斯.md》要求 | 本方案落地位置 |
|---|---|
| 核心 6 节点 1h/1d/3d/7d/15d/30d + T0 | §3.2 表 + `ebbinghaus_node_config` 初始化 |
| 前 30 分钟生成待推送任务 | `wb_review_node.ready_at` + `node-ready-scan` |
| 触发后 24h 有效窗口 | `wb_review_node.window_end_at` + `node-forgotten-sweep` |
| 掌握 → 推进 / 未掌握 → 重置 T0 | `EbbinghausEngine.onReviewed()` `case FORGOT` |
| 用户+内容唯一键避免重复推送 | `wb_push_task.idempotency_key = MD5(node_id+scheduled_at)` |
| 多端实时同步待复习 | 日历事件 + SSE 列表刷新 + WebSocket（小程序） |

---

## 16. 下一步行动

1. 本方案评审 → 2 天窗口收集意见，合并到 v1.2（含 §2B SC-11..SC-15 匿名态 5 场景）。
2. 启动 **S0** —— 预计 4 月 22 日合并仓库、对齐 BOM、跑通空启动；**新增 `anonymous-service` 骨架 + 网关 `AnonFilter` / `ObserverFilter`**。
3. 并行建立测试数据集 —— 100 张真实错题（已脱敏），用于 S3 金标测试；**额外 30 张用于 P-LANDING 样例与 P-SHARED 脱敏测试**。
4. 申请小程序订阅消息模板 AT0001（审核周期 1–3 天，提前启动）。
5. 采购 / 开通 AI 供应商账号（通义千问企业版 + OpenAI 备份）。
6. **UI/UX 新增**：P-LANDING / P-GUEST-CAPTURE / P-SHARED 三页高保真设计稿（P1：P-WELCOMEBACK / P-OBSERVER）；向法务 / 合规提交 P-SHARED 脱敏规则与未成年人保护声明。
7. **后端新增**：`anonymous-service` 代码骨架 + Flyway 迁移 V20260421_02 + `GuestSessionService.claim()` 幂等实现 + Redis Bloom Filter 撤销链路。
8. **前端新增**：`bootstrap/resolve-entry.ts` 决策树 + 匿名 Shell 组件（无 Tab Bar 的独立布局）+ `device-fingerprint` 工具 + 匿名 claim 流程。
9. **QA 新增**：SC-11 / SC-12 / SC-13 三份 Playwright spec 纳入 PR 红线冒烟（§12.S9）；设备指纹 Mock 夹具与 guest 额度 Test-only Hook。
10. **数据 / 增长**：接入 ClickHouse `anon_events` 表；搭建 P-LANDING A/B 实验（hero_copy / cta_order）；定义 3 个增长指标看板（游客试用转化 / 分享二跳 / 回流率）。

---

> **签收**：本方案一经评审通过即作为 AI 执行 Agent 的主线路书，后续《AI 落地实施计划 — 通用日历系统》与《AI 落地实施计划 — 前端 UI/UX 多端版》作为其子计划协同执行。三份文档共同构成 Longfeng AI 错题本的完整工程基线。
