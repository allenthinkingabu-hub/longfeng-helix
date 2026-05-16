# M-MULTI-QUESTION-CAPTURE · 多题拍照支持 — Satellite Biz Doc

**Status**: Reviewed v1.2 (5/8 决策已定 · 2/8 沿用 sane defaults · 1/8 留 P1 spike · §6 AI Backend 实装详设新增 · 模型选择/Split Prompt/JSON Schema/置信度阈值 4 项已锁)
**Owner**: full-stack (backend DDD 改造 + AI service 切割 pipeline + frontend swiper)
**Created**: 2026-05-16
**Priority**: **P1** (MVP 14 天不做 · P1 启动)
**Master ref**: [../业务与技术解决方案_AI错题本_基于日历系统.md](../业务与技术解决方案_AI错题本_基于日历系统.md) (v1.2)
**Mockup**: `design/mockups/wrongbook/19_result_multi.html` (P04 多题结果页 · 含 `<AnnotatedOriginPhoto>` 红圈标注 + Swiper + BatchSummary · gen-mockup skill v1 第 2 次实战 · 371 行 · 18 testid · 风格基准 01_home.html · 模仿 SC-18 混合处理场景: 题 1 已掌握 绿圈 / 题 2 待入库 红圈高亮 / 题 3 已跳过 灰虚框) · P02/P03/P05 后续按需追加

---

## §0 TL;DR

**这不是"加一个新功能"· 是修一个 4 层 silent drift + 对齐业内主流的优化项**。

学生做作业的真实场景：**一张作业纸通常 3-8 道题** · 拍 1 张照片入 1 题违反真实使用习惯 · 必须分次拍 N 张 · 体感笨重。同时本项目当前已经有"半残" UI 占位（H5 端"多题"按钮存在但点了走单题 · silent fail）· **再不收编就成永久技术债**。

### 0.1 改进点矩阵 [REQUIRED · 本 satellite 灵魂]

| 维度 | 当前现状（status quo） | 改进后 | 改进的"为什么" |
|---|---|---|---|
| **用户认知** | 拍多题 → 系统只识其中 1 题 (随机) · 用户不知道 | 拍多题 → 自动识别 N 题 → 用户在 P04 swiper 浏览 → 选择保存哪些 | 对齐学而思 / 作业帮 / 一起作业等业内主流 · 真实学习场景 |
| **数据完整性** | 1 photo → 1 wb_question · 严格 1:1 (master §3.1 L1430) | 1 photo → 1 wb_question_batch → N wb_question · 1:N 聚合根 | DDD 演进 · 符合"一张作业纸有 N 题"领域真相 |
| **AI 处理能力** | 单题 imageUrl in · 单题 stem/result out (master §6.2) | 多题 imageUrl in · 先 region split → N 题并行分析 · 返 batch result | 复用现有 4-step pipeline · 仅前置加 "region detection" step |
| **mockup vs 代码 一致性 (silent drift)** | 4 层 drift: biz 单题假设 / mockup 3-mode / testids 注册 modeMulti / H5 渲染"多题"假按钮 | 4 层全收编：biz 加多题 SC · mockup 加新元素 · testid 命名空间清理 · H5 按钮真正可用 | 防止"silent UI 占位 → 用户误点 → 体验崩塌"· 治理类似 [SC01-MP-HOME-BUG-FIX 教训](../../audits/) |
| **复习节奏** | 一次拍 1 题 → 1 plan → 7 节点 | 一次拍 N 题 → N plans (共享 batch_id 溯源) → 7N 节点 (master §7 艾宾浩斯 per-question 独立) | 不破坏现有艾宾浩斯引擎 · 仅扇出 · 学习节奏更紧凑 |
| **错题本组织** | 列表项 1:1 = 1 wb_question | 列表项仍 1:1 = 1 wb_question · 加 batch chip "本题来自 2026-05-16 拍的 3 题中第 2 题" | 错题本心智不变 · 只加溯源 |

### 0.2 增量摘要表 [REQUIRED]

| 类型 | ID | 名称 | 优先级 | Owner |
|---|---|---|---|---|
| 改造页 (非新页) | P02 | 拍题相机 · 加 AI auto-detect 多题 + 用户 hint | P1 | frontend |
| 改造页 (非新页) | P03 | AI 分析中 · 流程改 (1 split + N×4 analyze) · 进度卡改 N 列 | P1 | frontend + backend |
| 改造页 (非新页) | P04 | 结果页 · 单题 hero 改 swiper 1/N · 加选择保存 checkbox · **顶部加 `<AnnotatedOriginPhoto>` 红圈标注原图 (实时反映 swiper 选择 / mastery decision)** | P1 | frontend |
| 改造页 (非新页) | P05 | 错题列表 · 项加 batch chip "1/3" | P1 | frontend |
| **新 UI 组件** | `<AnnotatedOriginPhoto>` | P04 顶部展示原图缩略 + SVG 叠加红圈标注每题区域 · 红=待入库(默认) / 绿=已掌握 / 灰=discard · 实时跟随 swiper checkbox 与 mastery 切换 · ≤ 150px 高 | P1 | frontend (ui-kit) |
| **新配置项** | `wrongbook.multi-question.max-per-batch` | application.yml 后端配置 · 默认 20 · 可热更 · 超限走 SC-19 分支 B 降级 | P1 | backend |
| 新 SC | SC-17 | 多题拍照 → 全部保存 (happy path) | P1 | full-stack |
| 新 SC | SC-18 | 多题混合处理 (部分掌握 / 部分需复习 / 部分跳过) | P1 | full-stack |
| 新 SC | SC-19 | 多题分析降级 (切割失败 / N > 上限 / 部分 OCR 失败) | P1 | full-stack |
| 新 DB 表 | `wb_question_batch` | 多题聚合根 (batch_id, student_id, origin_image_key, total_questions, status, created_at) | P1 | backend |
| 新 DB 列 | `wb_question.parent_batch_id` + `wb_question.region_json` + `wb_question.batch_order` | 子题指向 batch · region 标注切割框 · 顺序 | P1 | backend |
| 改造 API | `POST /api/wb/questions` | 接受 single image_key · 返 `{batchId, qids[]}` 而非单 `{qid}` (向后兼容: N=1 时仍返 batch with 1 qid) | P1 | backend |
| 改造 API | `SSE /api/ai/analyze/{taskId}` | 加 event type `BATCH_SPLIT_DONE{regions[]}` + N 个并发 `STEP_DONE{qid, regionIdx}` | P1 | backend |
| 新 API | `POST /api/wb/batches/{batchId}:confirm` | 用户在 P04 选定要保存的 qids · `{savedQids[], discardedQids[]}` | P1 | backend |
| **删除 (drift 治理)** | H5 假按钮 + testid namespace cleanup | `Capture/index.tsx:75 Mode='photo'\|'multi'\|'file'` → 改成真功能 · `testids/src/index.ts:29 modeMulti` 改成真用 | P1 (随本 satellite 落地一起做) | frontend |

---

## §1 业务目标增量

### 1.1 涉及角色 (引用 master §2A.1 · 不重新定义)
- **学生** (master §2A.1 L163-L177) — 唯一直接用户 · 拍题场景占核心学习路径 70%+

### 1.2 MVP 边界 (本次做什么 / 故意不做什么)

**本次做** (P1):
- AI 后端自动检测 N 题 (1 ≤ N ≤ **N_MAX** · 默认 **20** · 后端 `application.yml: wrongbook.multi-question.max-per-batch` 可配置热更) · 用户无需主动切"多题模式"
- P04 顶部 **`<AnnotatedOriginPhoto>` 红圈标注原图**：缩略图叠加 SVG 圆圈 · 红=待入库(default) / 绿=已掌握 / 灰虚框=discard · **实时跟随 swiper checkbox 与 mastery 切换** · 学生一眼看清"哪些题在做哪些处理"
- P04 swiper 1/N 浏览 · 每题独立 checkbox · 用户可取消不要的题
- N 题独立分析（并行 · 不破坏 master §6 pipeline · 加前置 split step）
- N 题独立入库（N wb_question rows + 1 wb_question_batch row · FK 关联）
- N 题独立艾宾浩斯节点（N × 7 = 7N 节点 · master §7 不变）
- P05 错题列表加 batch chip 溯源（不改列表结构）

**故意不做** (留 P2 / 不做):
- **N > N_MAX 自动降级**：超 N_MAX 题直接弹"题目过多 · 请分多次拍" toast · 不拍智能 paginate · N_MAX 默认 20 · 后端可调
- **拍多页 PDF**：master §1.2 「单页」假设保留 · PDF 多页仍走单页处理（**保持兼容**）
- **批量批改对错**：本 satellite 不引入"对/错答案判定" · 沿用 master 单题"自评掌握度"机制 (但 P04 swiper 内允许学生 per-题 自标 ✓/✗ · 红圈跟随变绿/红)
- **多题统一打包推送**：N 题 → N 个独立推送任务 (master §7 wb_push_task) · 不合并 · 学生可在 P13 设置"打包推送"开关 (P2)
- **拍考试整张卷子**：业务场景错位 (考试卷应走"考前知识点诊断"另一产品线) · 但 **N_MAX=20 技术上限近似覆盖整张卷子尺寸** · 业务上 N ≥ 10 时触发 toast "看起来像试卷? 推荐用考前诊断功能" (P2 引导)
- **P04 默认勾选**：N ≤ 5 时默认全勾选 (沿用 satellite v1) · **N > 5 时默认全不勾选**(N=20 时一键全保会冲艾宾浩斯节奏 · 强制用户 per-题 主动 ✓)

### 1.3 北极星指标贡献 (引用 master §1.4 L84-L96)

- **入库效率**：拍题入库步数从"N 张 → N 次操作"压到"1 张 → 1 次操作" · 预计入库速度提升 60-80% (拍多题学生群体)
- **激活留存**：解决 silent drift "假按钮 → 用户失望" 信任问题 · 预计降低首日卸载率
- **AI 成本**：每题独立 4-step pipeline 不变 · 总 token 消耗与拍 N 次单题相当 (无明显增量)
- **不影响**匿名漏斗三条曲线 (本 satellite 是登录态后置场景 · 与 master §1.4 v1.2 新增的 35%/25%/15% 漏斗正交)

### 1.4 N=20 设计后果 (用户 2026-05-16 拍 N_MAX=20 决策的次生影响)

用户拍板 N_MAX=20 (vs satellite v1 默认 5) · 大 4 倍 · 触发以下 4 维度影响需在落地前消化:

| 维度 | N=5 默认 | N=20 实际 | 应对策略 |
|---|---|---|---|
| **AI 成本** | 每 batch 20 token (单题 ≈ 5 token × N=5 题) | 4 倍: 80-100 token / batch | 加 prometheus 告警 `multi_question_token_per_batch > 150` 触发查看 · 不阻断业务 · P1 上线后 1 个月 review 实际分布 |
| **P03 UI 进度卡布局** | 5 列横排刚好 (每列 width ≈ 60px) | 20 列横排拥挤 (每列 < 20px · 不可读) | 改设计: **4 列 × 5 行 grid** 而非单行横排 · `<MultiQuestionProgress>` 组件 props 加 `layout: 'row'\|'grid'` 自适应 (N ≤ 5 用 row · N > 5 用 grid) |
| **P04 swiper UX** | 1/5 浏览快 (< 30s) | 1/20 浏览累 (3 min) | **默认勾选改默认不选** (N > 5 时) · 强制用户每题主动 ✓ · 否则 20 题一键全保会过载艾宾浩斯节奏 · 沿用 swiper 1/N 不改组件 |
| **DB 事务大小** | 5 plan + 35 node + 35 event = 75 rows / 事务 | 20 + 140 + 140 = 300 rows / 事务 | PostgreSQL 单事务 300 rows OK · 加 statement_timeout 5s 保护 · 失败回滚整 batch (与 §17 #3 全或无决策一致) |
| **业务边界冲突** | N=5 明确不是"拍考试卷" | N=20 几乎就是"拍考试整卷" (典型作业 6-12 题 · 试卷 15-30 题) | 业务上 N ≥ 10 触发 toast 提示 "看起来像试卷? 推荐用考前诊断功能" (P2 引导) · 不阻断 · 不强制 |

**N_MAX 配置项约定**:
- 默认值: 20 (`application.yml`)
- 调小窗口: 可降到 3-5 应对 AI 成本告警 (无破坏性)
- 调大窗口: 可升到 30-50 应对学生反馈 "20 不够" (需先做 §1.4 P03 grid 自适应 · 否则 UI 崩)
- 热更: `Spring Boot @RefreshScope` + `POST /actuator/refresh` · 无需重启服务

---

## §2A.3 IA 增量

### 2A.3.1 新路由行 (插入 master §2A.3 路由表)

**无新增 page route** · 本 satellite 是 4 个既有页 (P02/P03/P04/P05) 的行为增强 · 路由不变。

### 2A.3.2 深链规则 (如有新增 wb://)

新增深链 (用于 push / 分享场景):
- `wb://batch/:batchId` → P04 swiper 模式默认打开第 1 题 (P2 预留 · 用于"邀请家长看本周新增 batch")

---

## §2A.4 页面差量卡 [REQUIRED]

> **特殊说明**：本 satellite 是 4 个既有页的行为增强 · 不是新页面卡 · 故用"差量"格式 · 仅写"与 master §2A.4 既有卡相比改了什么"。每项改动末标注 `[CHANGED]` / `[ADDED]` / `[REMOVED]`。

### P02 · 拍题相机 (差量 vs master §2A.4 L469)

| 维度 | 变化 |
|---|---|
| **首屏目标** | [CHANGED] 加第 ③ "AI 智能识别多题 · 不需手动切模式" |
| **核心组件** | [ADDED] `<MultiQuestionHint>` 取景器内浮 hint "AI 会识别多题 · 一次拍多道也可以" (拍照前提示 · 拍后消失) |
| **数据绑定** | [ADDED] `capture.detectedRegions: Array<BoundingBox>` (实时检测 · 取景器内显示红框) |
| **API 触点** | [CHANGED] `POST /api/file/presign` 不变 · `POST /api/wb/questions` 响应从 `{qid}` 改 `{batchId, qids: [qid1,qid2,...]}` (N=1 时仍是 batch 含 1 qid · 向后兼容) |
| **状态集** | [CHANGED] `UPLOADED → DETECTING → ANALYZING (N 题并行)` (插入 DETECTING 中间态) |
| **跳转** | [CHANGED] UPLOADED 后跳 P03 时 URL 带 `?batchId=...` 而非 `?qid=...` |
| **异常态** | [ADDED] N > N_MAX (默认 20) → 拍后 toast "本张照片识别到 X 题 · 已超出 {N_MAX} 题上限 · 请分多次拍" + 返回 P02 取景 · [ADDED] N ≥ 10 时 toast 软提示 "看起来像试卷? 推荐用考前诊断功能" (P2 引导 · 不阻断) |
| **埋点事件** | [ADDED] `wb_capture_multi_detect{N, modeAuto=true}` (用户拍照后检测出 N>1 题时上报) |
| **drift 清理** | [REMOVED] H5 端 `Mode='multi'` 假按钮 + 改用 auto-detect · `testids/src/index.ts:29 modeMulti` 测试 ID 名义复用为 `p02-multi-hint` (取景器内 hint testid) |

### P03 · AI 分析中 (差量 vs master §2A.4 L483)

| 维度 | 变化 |
|---|---|
| **首屏目标** | [CHANGED] "等待 4 步 pipeline 完成" → "等待 1 步切割 + N×4 步并行分析" |
| **核心组件** | [ADDED] `<MultiQuestionProgress>` 替代 `<SingleQuestionProgress>` · 顶部 1 横条显示切割进度 · 下方 N 列 × 4 step 网格 |
| **数据绑定** | [CHANGED] `analyzing.task.steps[4]` → `analyzing.task: {split: 1-step, questions: Array<{qid, regionIdx, steps[4]}>}` |
| **API 触点** | [CHANGED] SSE `/api/ai/analyze/{taskId}` 加 event type `BATCH_SPLIT_DONE{regions: BoundingBox[]}` 在 N 个 question 的 4-step 之前 · 后续 N 个 `STEP_DONE` 加 `{qid, regionIdx}` 字段 |
| **状态集** | [ADDED] `splitting.PENDING → splitting.DONE → analyzing.PARTIAL → analyzing.ALL_DONE` |
| **异常态** | [ADDED] `splitting.FAILED` (AI 切不开): 降级单题处理 + 顶部 banner "切割失败 · 按单题处理 · 仅识别第 1 题" · [ADDED] 部分 question 4-step 失败: 该列变红 + 其他列继续 · P04 跳转时该题 marked as ERROR |
| **耗时预算** | [CHANGED] 单题 ≤ 8s P95 → 多题 ≤ 12s P95 (N=5 · 切割 +1s · 4-step 并行 not serial) |

### P04 · AI 分析结果 (差量 vs master §2A.4 L498)

| 维度 | 变化 |
|---|---|
| **首屏目标** | [CHANGED] "审单题结果" → "**顶部红圈标注原图一眼看清哪几道是哪几道** + 审 N 题结果 + 选择保存哪几道" |
| **核心组件** | [ADDED] **`<AnnotatedOriginPhoto>` (顶部 · 缩略原图 ≤ 150px 高 + SVG 叠加 N 个圆圈 · 圆圈颜色实时跟随每题状态: 红 (待入库 default) / 绿 (已掌握) / 灰虚框 (discard) · 圆内显示数字 1..N 与 swiper position 对应 · Tap 圆圈快捷跳 swiper 到对应题)** · [ADDED] `<QuestionSwiper>` (中段 swiper 1/N · 左右切换 · indicator dots) · `<SaveCheckbox>` (每题右上 · N ≤ 5 默认勾选 / N > 5 默认不勾选 · 见 §1.2) · `<BatchSummary>` (页脚: "已选 X/N 题 · 保存") |
| **数据绑定** | [CHANGED] `result.question` → `result.batch: {batchId, originImageUrl, questions: Array<{qid, regionJson: {x,y,w,h}, regionImage, analysisResult, userChoice: 'save'\|'discard'\|null, masteryDecision: 'mastered'\|'forgot'\|null}>}` · `<AnnotatedOriginPhoto>` 用 originImageUrl 渲染缩略 + 用每题 regionJson 计算 SVG circle 中心 + radius (取 box 对角线 × 0.6 · 保证圈住整题但不重叠) |
| **API 触点** | [REMOVED] `POST /api/wb/questions/{qid}:confirm` (单题确认) · [ADDED] `POST /api/wb/batches/{batchId}:confirm body{savedQids[], discardedQids[], masteryMap}` (批量确认) · [CHANGED] `GET /api/wb/batches/{batchId}` 响应加 `originImageUrl` (后端 OSS presign URL · 1 小时过期 · 仅 owner 学生可访问) |
| **跳转** | [CHANGED] 单题保存后跳 P-HOME → 批量保存后跳 P05 错题列表 + filter `?batchId=...` 高亮本次新增 · [ADDED] Tap `<AnnotatedOriginPhoto>` 上任意红/绿/灰圈 → swiper 滑动到对应题 (UX 增强) |
| **异常态** | [ADDED] N 题全部 discard: 弹"全部丢弃确认?" 二次确认 + 走 master 现有 `wb_question.status=DISCARDED` 路径 · [ADDED] `regionJson === null` (SC-19 分支 A 切割失败降级 / 单题): `<AnnotatedOriginPhoto>` 退化为普通缩略图 · 不渲染圆圈 (避免假视觉) · [ADDED] `originImageUrl` presign 过期: 显示 placeholder "原图加载失败" + retry · 不阻塞 swiper |
| **埋点事件** | [ADDED] `wb_result_annotation_view{batchId, N, circleColors: {red,green,gray}}` (首次渲染时上报) · `wb_result_annotation_tap{qid, fromCircleRank}` (Tap 圈跳 swiper) |
| **耗时预算** | [CHANGED] 单题保存 ≤ 1s → 批量 N 题保存 ≤ 4s P95 (N=20 · 后端并行 plan 创建) · [ADDED] `<AnnotatedOriginPhoto>` 首次渲染 ≤ 300ms (含 OSS presign URL 解析 + SVG draw N circles) |

### P05 · 错题本列表 (差量 vs master §2A.4 L513)

| 维度 | 变化 |
|---|---|
| **核心组件** | [ADDED] `<BatchChip>` (列表项右上 · 仅 batch.total > 1 时显示 · "1/3" · Tap 跳同 batch 其他题) |
| **数据绑定** | [ADDED] `wb_question_list[i].batch: {batchId, total, order}` (后端 list API 返响应增字段) |
| **API 触点** | [CHANGED] `GET /api/wb/questions` 响应每项加 `batch:{batchId, total, order}` 字段 (向后兼容: batch.total === 1 时前端不渲染 chip) |
| **跳转** | [ADDED] Tap batch chip → P05 自身 filter `?batchId=...` (展示同 batch 的所有 N 题 · 类似"相关错题"快速浏览) |

---

## §2B 新 SC 卡 [REQUIRED]

### 2B.18 SC-17 · 多题拍照 → 自动切割 → 全部保存 (happy path) (优先级: P1)

**场景目的**：验证多题完整 happy path · 学生拍 1 张含 3 题的作业纸照片 · AI 自动切出 3 题 · 学生 P04 swiper 浏览后全选保存 · 入库 3 wb_question + 1 wb_question_batch · 触发 3 plan (各 7 节点)。

**前置条件**：前置 SC: master §2B.2 SC-01 (单题流) 已 PASS · 学生已登录 P-HOME · 相机权限已授予 · backend `wb_question_batch` 表已 migration · AI service split pipeline 已部署 · 网络稳定 · 拍照素材是清晰多题作业纸。

**核心路径编排（happy path · N=3）**：

| # | 用户动作 | 页面前台 | 后端/事件 | 前端状态 | 埋点 | 耗时预算 |
|---|---|---|---|---|---|---|
| 1 | P-HOME Tap 快捷入口「拍新题」 | 进 P02 取景器 + hint "AI 会识别多题 · 一次拍多道也可以" | — | `capture.IDLE` | `wb_capture_open{entry='quick'}` (复用) | ≤ 200ms |
| 2 | 取景对准 3 题作业纸 · 按快门 | 缩略图飞入 + 触觉 | — | `capture.CAPTURED` | `wb_capture_shutter` (复用) | ≤ 100ms |
| 3 | 自动上传 | 进度条 0→100% | `POST /api/file/presign` → PUT OSS → `POST /api/wb/questions` body `{image_key}` · 后端创 1 wb_question_batch · 暂返 `{batchId, qids: []}` 空 qids (待 AI 切割后填充) | `capture.UPLOADING → UPLOADED` | `wb_capture_upload_success{ms,bytes}` (复用) | ≤ 2s |
| 4 | 自动跳 P03 | 路由 → P03 + skeleton | `POST /api/ai/analyze body{batchId}` 启动 SSE | `analyzing.SPLITTING` | `wb_ai_split_start{batchId}` | ≤ 500ms |
| 5 | 切割中... | 顶部 1 横条进度 "AI 识别题目..." | SSE event `BATCH_SPLIT_DONE{regions: [{idx:0,box},{idx:1,box},{idx:2,box}]}` · 后端 update wb_question_batch.total_questions=3 + 创 3 wb_question rows (parent_batch_id, region_json, batch_order) | `analyzing.SPLITTING → analyzing.PARTIAL` | `wb_ai_split_done{N=3, ms}` | ≤ 2s |
| 6 | 切割完渲染 N 列进度 | 顶部"已识别 3 题" + 下方 3 列 × 4 step 网格全部 PENDING | — | `analyzing.PARTIAL` | `wb_ai_multi_render{N=3}` | ≤ 200ms |
| 7 | 3 列并行 4-step 分析 | 每列依次亮 step1→2→3→4 · 列内自洽 · 列间并发 | SSE 多个 `STEP_DONE{qid, regionIdx, step}` 交错 · 后端 N 路并发调 QuestionAnalyzer | `analyzing.PARTIAL` | `wb_ai_question_done{qid, ms}` × 3 | ≤ 8s (并行 · 不是 24s) |
| 8 | 全部完成 | 3 列全 ✓ | SSE event `BATCH_DONE{batchId, qids:[q1,q2,q3], totalMs}` | `analyzing.ALL_DONE` | `wb_ai_batch_done{batchId,N=3,totalMs}` | — |
| 9 | 自动跳 P04 (swiper 默认第 1 题) | 路由 → P04 + **顶部 `<AnnotatedOriginPhoto>` 缩略原图 + 3 个红圈标注 (rank 1-3 数字 · 跟随 swiper position 高亮)** + swiper 1/3 + checkbox 默认全选 (N=3 ≤ 5) | `GET /api/wb/batches/{batchId}` 返 3 题完整 analysisResult + originImageUrl + regionJson × 3 | `result.LOADING → result.READY` | `wb_result_view{batchId, N=3}` + `wb_result_annotation_view{N=3, circleColors:{red:3,green:0,gray:0}}` | ≤ 500ms |
| 10 | 浏览 swiper · 1→2→3 切换 | swiper 滑动动画 · **顶部缩略图当前题红圈外圈加粗高亮 (其他题红圈正常)** | — | `result.READY` | `wb_result_swipe{from, to}` × 2 | — |
| 10a | (备选交互) Tap 顶部缩略图任意红圈 | swiper 直接跳到对应题 (跳过中间题) · 该圈外圈高亮 | — | `result.READY` | `wb_result_annotation_tap{qid, fromCircleRank}` | ≤ 100ms |
| 11 | 三题都看了 · 默认全选 · Tap 底部「保存 3/3 题」 | 按钮 loading | `POST /api/wb/batches/{batchId}:confirm body{savedQids:[q1,q2,q3], discardedQids:[], masteryMap:{q1:null,q2:null,q3:null}}` · 后端串行创 3 plan (master §7 EbbinghausEngine.expand × 3) + 3 × 7 node + 21 calendar event | `result.SAVING → result.SAVED` | `wb_batch_confirm{batchId, saved:3, discarded:0}` | ≤ 2s |
| 12 | 跳 P05 错题列表 + filter ?batchId=... · 高亮 3 题 | 列表渲染 3 项 · 顶部 banner "已保存 3 题 · 来自本次拍照" | `GET /api/wb/questions?batchId=...` | `wrongbook.READY` | `wb_list_view{filter='batchId', count:3}` | ≤ 500ms |

**关键断言点（System Invariants）**：
- `wb_question_batch.total_questions === wb_question.count(parent_batch_id=batchId)` (referential integrity)
- 每个 wb_question 必有非 null `parent_batch_id` · N=1 时 batch 仍存在 (向后兼容 · 单题也走 batch)
- N 题并行分析 · backend 失败任 1 题不影响其他 N-1 题 (per-题 ACID)
- 用户 P04 discard 的 qid 后端 set `wb_question.status='DISCARDED'` · 不创 plan · 不产生节点
- 跳 P05 后 URL `?batchId=...` filter 可分享 · 复制链接给家长可见同 batch 题 (P2)
- **`<AnnotatedOriginPhoto>` 红圈数 === swiper 题数** (N=3 → 3 圈 · N=20 → 20 圈) · 数字 1..N 与 swiper position 严格对应 · 不允许错位
- **红圈颜色不变量**: red = `userChoice='save'` (default) · green = `masteryDecision='mastered'` · gray virtual = `userChoice='discard'` · 同一时刻每圈唯一颜色 (state 优先级: discard > mastered > save default)
- **regionJson null 降级**: 单题或 SC-19 分支 A · 顶部退化为普通缩略图 · 不渲染任何圈 · UI 一致性保护

**QA 用例（GIVEN / WHEN / THEN）**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-17.01 | 正常 | 学生已登录 · 拍 3 题清晰作业纸 · 网络稳定 | 完成 SC-17 步骤 1-12 | 屏幕最终落 P05 · 列表 3 项高亮 · DB: 1 wb_question_batch + 3 wb_question (parent_batch_id 一致 · region_json 齐 · batch_order=0,1,2) + 3 wb_review_plan + 21 wb_review_node + 21 calendar event · 全程 ≤ 15s |
| TC-17.02 | 边界 | 同 TC-17.01 但拍 N=1 题（单题） | 完成步骤 1-12 | 仍走 batch 流程 · DB 落 1 wb_question_batch (total=1) + 1 wb_question (parent_batch_id 非 null) · P03 不显示 swiper · P04 不显示 checkbox 列表（单题 hero · 沿用 master SC-01 UI）· **向后兼容性确认** |
| TC-17.03 | 边界 | 拍 N=20 题 (默认 N_MAX 上限) | 完成步骤 1-12 | 4 行 × 5 列 grid 并行分析 · 总耗时 ≤ 25s P95 (并行 · 不是 N×8s) · P04 顶部 20 圈红色 · 默认全不勾选 (N > 5 规则) · 用户主动 ✓ 选定后保存成功 · DB 落 1 batch (total=20) + 20 wb_question + 20 plan + 140 node + 140 calendar event (后端事务 statement_timeout 5s 保护) |
| TC-17.04 | 边界 | 拍 N=21 题 (超 N_MAX) | 完成 SC-19 分支 B (见 §2B.20) | 立即返 P02 · 0 wb_question 入库 · toast 提示 |
| TC-17.05 | 验证 | 拍 N=3 题 · 完成 step 9 后 Tap 顶部 `<AnnotatedOriginPhoto>` 第 2 个红圈 | step 10a 备选交互 | swiper 直接跳到第 2 题 · 不需手动滑动 · 该圈外圈高亮 · 埋点 `wb_result_annotation_tap{qid:q2, fromCircleRank:2}` 1 条 |

---

### 2B.19 SC-18 · 多题混合处理 (部分掌握 / 部分需复习 / 部分跳过) (优先级: P1)

**场景目的**：验证 SC-17 之后 · 学生在 P04 swiper 内对 N 题做差异化处理 (题 1 "已掌握" · 题 2 "需复习" · 题 3 "discard")。这是本 satellite 核心增量价值 · 承载"一张作业纸里题难度有梯度"的真实学习场景。

**前置条件**：前置 SC: SC-17 步骤 1-9 完成 · 进入 P04 swiper 1/3。

**核心路径编排**：

| # | 用户动作 | 页面前台 | 后端/事件 | 前端状态 | 埋点 |
|---|---|---|---|---|---|
| 1 | swiper 第 1 题 · 浏览 analysisResult · Tap "✓ 已掌握" (内嵌于 swiper card) | 第 1 题卡 mark ✓ + 角标 "已掌握" + checkbox 仍保持勾选 · **顶部缩略图第 1 个圈从红 → 绿色 (300ms 过渡)** | — (本地 state · 待 step 6 批量提交) | `result.questions[0].masteryDecision='mastered'` | `wb_result_per_q_mastery{qid:q1, decision:'mastered'}` |
| 2 | swipe 到第 2 题 · 浏览 · Tap "✗ 需复习" | 第 2 题卡 mark ✗ + 角标 "需复习" + checkbox 仍勾选 · **顶部第 2 圈保持红色 (强调待复习)** | — | `result.questions[1].masteryDecision='forgot'` | `wb_result_per_q_mastery{qid:q2, decision:'forgot'}` |
| 3 | swipe 到第 3 题 · 浏览后认为不重要 · 取消 checkbox | 第 3 题 checkbox 灰化 + 半透明 + 显示 "本题将不保存" · **顶部第 3 圈从红色 → 灰虚框 (300ms 过渡 · 数字 3 灰化)** | — | `result.questions[2].userChoice='discard'` | `wb_result_per_q_discard{qid:q3}` |
| 3a | (此时顶部缩略一眼可见: 圈 1 绿 / 圈 2 红 / 圈 3 灰虚) | 静态视觉一览本次处理决定 | — | `result.READY` (no state change) | — (回看动作 · 无埋点) |
| 4 | Tap 底部「保存 2/3 题 · 1 题跳过」 | 按钮 loading | `POST /api/wb/batches/{batchId}:confirm body{savedQids:[q1,q2], discardedQids:[q3], masteryMap:{q1:'mastered', q2:'forgot'}}` · 后端: q3 set status=DISCARDED 不创 plan · q1 创 plan 但 T0 直接 GRADED·MASTERED (master §7 onReviewed) → T1 计算下次节点是 +24h · q2 创 plan T0 直接 GRADED·FORGOT → 全部 7 节点重排 (master §7 case FORGOT) | `result.SAVING → result.SAVED` | `wb_batch_confirm{saved:2, discarded:1, masteryBreakdown:{mastered:1, forgot:1}}` |
| 5 | 跳 P05 + filter ?batchId | 列表 2 项 (q1 + q2 · 不含 q3) · 顶部 banner "已保存 2 题 (1 已掌握 + 1 需复习) · 1 题已跳过" | `GET /api/wb/questions?batchId=...` (返 status != DISCARDED 的 2 项) | `wrongbook.READY` | `wb_list_view{filter='batchId', count:2, hint='1 mastered'}` |

**关键断言点**：
- DB: q3 wb_question.status='DISCARDED' · **无对应 wb_review_plan / wb_review_node / calendar_event** (确认: 不消耗艾宾浩斯)
- q1 plan T0 状态 = GRADED·MASTERED (不是 SCHEDULED) · T1-T6 状态正常 SCHEDULED
- q2 plan 7 节点全部 cancel 后重排（master SC-04 流程复用 · 7N=7 节点重写）
- swiper 顺序与 batch_order 一致（不允许乱序 · 影响学生心智）
- **顶部 `<AnnotatedOriginPhoto>` 实时反映 swiper 选择**: state 优先级 discard (灰) > mastered (绿) > save default (红) · 任意 swiper 内交互必须同步更新缩略图圈色 (≤ 300ms transition)
- **保存按钮文案动态反映**: red 圈数 + green 圈数 = "已选 X 题 · Y 题已掌握 · Z 题跳过" (文案模板)

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-18.01 | 正常 | SC-17 步 1-9 完成 (3 题) | 完成 SC-18 步骤 1-5 | DB 终态: 2 wb_question (q1 mastered/q2 forgot) + 1 DISCARDED · 2 wb_review_plan · 14 wb_review_node (q1: 7 含 T0=MASTERED · q2: 7 重排 含 T0=FORGOT) · P05 列表 2 项 |
| TC-18.02 | 异常 | 同 TC-18.01 但 step 4 后端 q2 plan 创建失败 (DB connection drop) | step 4 后端事务 | 整 batch 回滚 · 0 题入库 · 顶部 toast "保存失败 · 请重试" · 不允许部分成功 (避免数据不一致 · DDD 聚合根事务边界) · 埋点 `wb_batch_confirm_fail{code='DB_TRANSACTION_FAIL'}` |
| TC-18.03 | 边界 | 同 TC-18.01 但全部 3 题 discard | step 4 前点保存 (按钮文案变 "全部丢弃 · 确认?") | 弹二次确认 modal · 用户 Tap 确认 → 全 3 题 DISCARDED · 跳 P-HOME · 不跳 P05 (因无新题) · 顶部 toast "已丢弃 3 题" · 埋点 `wb_batch_discard_all{batchId, N=3}` |

---

### 2B.20 SC-19 · 多题分析降级 (切割失败 / N>5 / 部分 OCR 失败) (优先级: P1)

**场景目的**：验证多题流程在 3 种异常时优雅降级 · 不破坏现有 master §2B.8 SC-07 单题降级逻辑。

**前置条件**：前置 SC: SC-17 步骤 1-4 完成 · P03 已发起 `POST /api/ai/analyze body{batchId}`。

**核心路径编排（3 个分支 · 每分支 5 步）**：

**分支 A · AI 切割失败 (e.g. 拍的是单色背景 · AI 检测不出题目边界)**：

| # | 触发 | 反馈 |
|---|---|---|
| 1 | P03 SSE 等待 ≥ 5s 无 `BATCH_SPLIT_DONE` | 顶部 banner 黄色 "AI 识别题目慢 · 请耐心等待" |
| 2 | 超 10s SSE event `BATCH_SPLIT_FAILED{reason: 'NO_BOUNDARY_DETECTED'}` | 弹 modal "AI 未识别到题目 · 按单题处理?" + 两按钮 |
| 3 | 用户 Tap "按单题" | 降级到 master §2B.2 SC-01 单题流 · backend 创 1 wb_question (parent_batch_id=batchId · batch_order=0 · total_questions=1) · region_json=null |
| 4 | 跳 P04 单题 hero (不是 swiper) | 沿用 master 原 UI |
| 5 | 保存路径同 SC-01 | DB 落 1 wb_question + 1 batch (total=1) |

**分支 B · N > N_MAX 上限 (默认 N_MAX=20)**：

| # | 触发 | 反馈 |
|---|---|---|
| 1 | SSE `BATCH_SPLIT_DONE{regions: [...21 个]}` | P03 检测 N=21 > N_MAX=20 · 不进入 analyzing 阶段 · 立即终止 SSE |
| 2 | 跳回 P02 + 顶部 banner | 红色 "本张照片识别到 21 题 · 已超出 {N_MAX} 题上限 · 请分多次拍" + CTA "重新取景" |
| 3 | 后端 cleanup | wb_question_batch.status='DISCARDED' · 不创任何 wb_question · 不消耗 AI 配额 |
| 4 | 用户重新取景 · 框选 ≤ N_MAX 题 | 重走 SC-17 happy path |
| 5 | 埋点 | `wb_capture_multi_exceed{N=21, limit=20}` 用于运营观测 (调上限的依据) · 触发"看起来像试卷? 推荐考前诊断" P2 引导 toast |

**分支 D · `regionJson` 缺失时 P04 `<AnnotatedOriginPhoto>` 降级 (单题 / 切割失败兜底)**：

| # | 触发 | 反馈 |
|---|---|---|
| 1 | P04 mount · `GET /api/wb/batches/{batchId}` 返 N=1 或 regionJson 全 null | P04 检测 regionJson 缺失 |
| 2 | `<AnnotatedOriginPhoto>` 渲染策略 | 退化为普通缩略图 (无 SVG circle 叠加) · 不渲染数字 · 视觉与 master SC-01 单题 hero 一致 |
| 3 | swiper 显示 | N=1 时不显示 swiper indicator dots · 表现为单题 hero |
| 4 | 埋点 | `wb_result_annotation_degrade{batchId, reason: 'no_region_json'}` |
| 5 | 不影响保存路径 | 沿用 SC-17 step 11 批量 confirm 路径 (N=1 仍走 batch 接口 · 向后兼容) |

**分支 C · 部分 OCR 失败 (5 题中第 3 题 stem 抽取失败)**：

| # | 触发 | 反馈 |
|---|---|---|
| 1 | SSE `STEP_DONE{qid:q3, regionIdx:2, step:1, fail:true, code:'OCR_LOW_CONFIDENCE'}` | P03 第 3 列红色叉号 + tooltip "题目识别失败" |
| 2 | 其他 4 题继续 4-step pipeline | 不受影响 (per-题 隔离) |
| 3 | SSE `BATCH_DONE{successCount:4, failCount:1}` | P04 swiper 5/5 · 第 3 题卡显示 "AI 识别失败 · 手动填题" CTA (走 master §2B.8 SC-07 单题 fallback 复用) |
| 4 | 用户选: 手填第 3 题 / 跳过第 3 题 | 走 master SC-07 manualFilled 流 / 取消 checkbox discard |
| 5 | 保存 4 题或 5 题 (取决用户选择) | DB 一致 |

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-19.01 | 异常 | 分支 A · 拍单色背景纸 | 完成分支 A 步 1-5 | 降级单题流成功 · DB 落 1 batch (total=1) + 1 wb_question (region_json=null) · 用户体感不阻塞 |
| TC-19.02 | 边界 | 分支 B · 拍 21 题 (超 N_MAX=20) | 完成分支 B 步 1-5 | 立即返 P02 · 0 wb_question 入库 · 不消耗 AI 配额 (后端早断) · 埋点上报 + 试卷提示 |
| TC-19.03 | 异常 | 分支 C · 5 题中第 3 题 OCR 失败 | 完成分支 C 步 1-5 | 4 题正常分析 + 1 题降级手填 · 不阻塞其他题 · per-题 隔离 |
| TC-19.04 | 安全 | 用户拍含敏感内容 (e.g. 手写日记夹在作业纸里 · AI 误识别为题) | 分支 A 类似流程 | 后端 + 前端不存储原图含 PII (master §11 NFR 合规) · 用户可在 P04 swiper discard 该题 |
| TC-19.05 | 边界 | 分支 D · N=1 单题 或 regionJson 全 null | 完成分支 D 步 1-5 | `<AnnotatedOriginPhoto>` 退化为普通缩略图 · 不渲染圆圈 · 不渲染数字 · swiper 表现为单题 hero · 埋点 `wb_result_annotation_degrade` 上报 · 保存路径不受影响 |

---

## §4 DB 增量 [REQUIRED]

### 4.14 新表 `wb_question_batch` (多题聚合根)

```sql
-- V20260516_01__multi_question_batch.sql
CREATE TABLE wb_question_batch (
  id                  BIGSERIAL PRIMARY KEY,
  student_id          BIGINT NOT NULL REFERENCES student(id),
  origin_image_key    VARCHAR(512) NOT NULL,         -- OSS object key · 1 张原图
  total_questions     INT NOT NULL DEFAULT 0,        -- AI 切割后填充 · 0 = pending split
  status              VARCHAR(32) NOT NULL DEFAULT 'PENDING',  -- PENDING / SPLITTING / READY / DISCARDED / FAILED
  ai_split_metadata   JSONB,                         -- 切割元数据: model_used / split_confidence / region_count
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wqb_student_created ON wb_question_batch(student_id, created_at DESC);
CREATE INDEX idx_wqb_status ON wb_question_batch(status) WHERE status IN ('PENDING', 'SPLITTING');
```

### 4.15 `wb_question` 加 3 列 (FK 到 batch · 区域 · 顺序)

```sql
-- V20260516_02__wb_question_add_batch_columns.sql
ALTER TABLE wb_question
  ADD COLUMN parent_batch_id BIGINT REFERENCES wb_question_batch(id),
  ADD COLUMN region_json JSONB,                       -- {x,y,w,h} 切割框 · 单题时 null
  ADD COLUMN batch_order INT NOT NULL DEFAULT 0;      -- 在 batch 内顺序 · 单题时 0
CREATE INDEX idx_wq_batch ON wb_question(parent_batch_id, batch_order);

-- backfill: 历史单题数据每条建独立 batch (向后兼容)
INSERT INTO wb_question_batch (student_id, origin_image_key, total_questions, status, created_at)
SELECT student_id, origin_image_key, 1, 'READY', created_at FROM wb_question WHERE parent_batch_id IS NULL;
-- 然后 UPDATE wb_question.parent_batch_id 关联到刚建的 batch (单 SQL 完成 · 见 migration 详细脚本)
```

**复用说明**：本 satellite 复用 master §4.5 `wb_review_plan` (per 题 1:1 不变) + §4.6 `wb_review_node` (per plan × 7 不变) + §4.9 calendar_event 联动 (per node 1:1 不变)。**艾宾浩斯引擎完全不变**。

---

## §6 AI Backend 实装详设 [v1.2 新增 · 补 v1.1 留白 4 项]

> **范围说明**: 本段补 v1.1 留白的 AI 落地骨架 4 项 (模型选择 + split prompt + JSON schema + 置信度阈值) · 写到 Coder 可对接精度。剩 3 项 (并行编排实装 / prometheus 监控 / Resilience4j 熔断) 留 §17 决策 #8 让 backend Coder 跑 spike 后回写。
>
> **复用 master §6**: master §6 Spring AI QuestionAnalyzer (单题 4-step pipeline: subject/kp/stem/result) 完全不变 · 本段仅在其前面加 1 个 `RegionSplitter` step · 输出 N 个 sub-imageRef 喂给 N 路并行 QuestionAnalyzer。

### §6.1 模型选择 (主 + 备 + 成本)

| 维度 | 主模型 | 备模型 (fallback) | 决策依据 |
|---|---|---|---|
| **模型** | `Claude 3.5 Sonnet` (Anthropic) | `GPT-4o` (OpenAI) | Claude 多模态对中文手写作业纸 OCR + 几何定位 综合优 (P1 启动 spike 20 样本实测后由 backend Coder 终决 · 见 §17 决策 #8) |
| **接入** | Spring AI `ChatModel` interface · `application.yml: ai.split.provider=anthropic` | `ai.split.provider.fallback=openai` (主 5 次连失或主 P95 > 8s 触发 Resilience4j 切换) | 复用 master §15.1 BOM Spring AI 多 provider abstraction |
| **成本预算** | Sonnet $3/M input · $15/M output · 单 split ≈ 800 token in (图) + 200 token out (regions JSON) ≈ **$0.005/batch** | GPT-4o $5/$15 · 单 split ≈ $0.007/batch | N=20 极端 batch (1 split + 20×4-step) ≈ $0.10 · 月活 1k 学生 × 月 3 拍 = **月 $300 预算** (粗估 · 实测见 §17 #8) |
| **图像传输** | base64 inline 直送模型 · 不存中间 OSS | 同 | image_key 已在 OSS · 按需读 · 不沉淀 AI 中间产物 (合规 · master §11 PII 保护) |

### §6.2 Split Prompt 模板 (主 + 备模型共用)

**System Prompt** (固定 · 锁字面 · 改字面需走 satellite 版本号):

```
你是教育场景多题切割助手。任务: 给定 1 张学生作业纸照片 · 定位其中所有独立题目的边界框。

输入: 1 张 jpg/png 图像 (可能含 0-25 道题)。
输出: 严格 JSON 数组 (不许 markdown 包裹 · 不许解释文字) · 仅定位 · 不输出解题内容。

规则:
1. 每题边界框包含: 题号 + 题干 + 学生作答 (含手写涂改) · 不包含与本题无关内容
2. 题间距 < 8% 图高 视为同题 · ≥ 8% 视为题间隔
3. 单选/多选/填空/解答 不区分类型 · 都视为 1 题
4. 表格/图形 紧靠题干 < 5% 距离 → 并入该题 · 否则单独 1 题
5. 全空白纸 / 单色背景 / 非作业纸 → 返空数组 []
6. 题数超 25 → 返前 25 题 (不报错 · 上层按 N > N_MAX 处理)
```

**User Prompt** (per-call 动态拼装):

```
[image: base64-jpg-data]

请定位上述作业纸所有题目的边界框 · 严格按 JSON schema 输出:
[{"idx": 0..N-1, "box": [x, y, w, h], "confidence": 0.0-1.0}]
```

**JSON Schema** (Spring AI `StructuredOutputConverter` 校验 · response 不符直接走 SC-19 分支 A 降级):

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "type": "array",
  "minItems": 0,
  "maxItems": 25,
  "items": {
    "type": "object",
    "required": ["idx", "box", "confidence"],
    "properties": {
      "idx":        { "type": "integer", "minimum": 0, "maximum": 24 },
      "box":        { "type": "array", "minItems": 4, "maxItems": 4,
                      "items": { "type": "number", "minimum": 0.0, "maximum": 1.0 } },
      "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 }
    }
  }
}
```

### §6.3 regions 字段精确格式 (v1.1 留白补完)

| 字段 | 类型 | 单位 / 范围 | 说明 |
|---|---|---|---|
| `idx` | int | 0..24 | 题在 batch 内顺序 · 0-indexed · 直接落 `wb_question.batch_order` · 严格按图像 从上到下 + 从左到右 排 |
| `box` | array[4] | **归一化 0.0-1.0** (相对原图宽高) | `[x, y, w, h]` · 左上角原点 · 与 SVG / Canvas 坐标系一致 · 前端按 `originImage.width × box[0]` 还原像素位置 |
| `confidence` | float | 0.0-1.0 | 切割框置信度 · 用于 §6.4 阈值判断 |

**为什么归一化而非像素**: 后端 OSS 可能存压缩 / 缩略多版本 · 前端 `<AnnotatedOriginPhoto>` 渲染时 `<img>` 实际 viewport 尺寸变化 · 归一化坐标避免 "DB 存 1920×1440 box · 前端 320×240 渲染错位" 的常见 bug。`wb_question.region_json` JSONB 字段直接落归一化值 · 前端 SVG `viewBox` 按比例计算 · 后端按需 crop 时按 originImage 实际像素乘归一化值。

### §6.4 置信度阈值 SLA (v1.1 留白补完)

**单题接受阈值**:

| 场景 | 阈值 | 处理 |
|---|---|---|
| `confidence ≥ 0.75` | **接受** | 落 wb_question · 走正常 4-step 分析 |
| `0.5 ≤ confidence < 0.75` | **接受但 flag** | 落 wb_question · `ai_split_metadata.low_confidence_qids` 加入该 idx · P04 swiper 该题角标显示 "AI 不太确定" 浅 hint · 不阻塞 |
| `confidence < 0.5` | **静默丢弃** | 不落 wb_question · 不计入 N · `ai_split_metadata.discarded_count++` · 不通知前端 (用户不感知 AI 自信度噪声) |
| 全部 regions 都 < 0.5 (= 0 题接受) | **切割失败** | 走 SC-19 分支 A · 降级单题处理 |

**region 重叠 IoU 阈值** (防 AI 把 1 题切成 2 框):

| IoU 范围 | 处理 |
|---|---|
| `IoU > 0.4` (重叠 ≥ 40%) | **合并**: 取并集 box · confidence 取平均 · idx 取较小值 · `ai_split_metadata.merged_pairs++` |
| `0.1 ≤ IoU ≤ 0.4` | 接受两题独立 (常见: 上下题边界轻微相接) |
| `IoU < 0.1` | 完全独立 · 接受 |

**切割总时长 SLA**:

| 模型 | P95 | P99 | 超时 |
|---|---|---|---|
| Claude 3.5 Sonnet | ≤ 2s | ≤ 5s | 8s → SSE `BATCH_SPLIT_FAILED{reason:'TIMEOUT'}` |
| GPT-4o (fallback) | ≤ 3s | ≤ 7s | 10s → 同上 |

**配置化**: 本段所有阈值落 `application.yml: wrongbook.multi-question.ai.*` (`split-confidence-accept=0.75` / `split-confidence-flag=0.5` / `region-iou-merge=0.4` / `timeout-primary-ms=8000` / `timeout-fallback-ms=10000`) · `@RefreshScope` 可热更 · 不需重启。完整 yml key 列表由 backend Coder 在 §17 决策 #8 spike 完成后补 `application-default.yml` 模板。

### §6.5 留 §17 决策点 #8 (P1 启动时 backend Coder spike 后定)

下列 3 项依赖实测数据 · 提前写 90% 会废 · 故 v1.2 不锁:

- **N 路并行编排具体实装**: CompletableFuture vs Reactor `Flux.parallel(N)` vs Spring `@Async` thread pool · 含线程池大小 + backpressure 策略
- **Prometheus metrics 命名 + Grafana 告警规则 yaml**: `wrongbook_split_duration_seconds` / `wrongbook_split_confidence_histogram` / `wrongbook_batch_token_cost_total` 等
- **Resilience4j 熔断完整配置**: retry 次数 / 退避策略 (exponential vs linear) / fallback 路径 (主 → 备 → 降级 SC-19A) · 含 `resilience4j.circuitbreaker.instances.ai-split.*` 全 yml

### §6.6 端到端调用链 (Coder 实装时一图看清)

```
[前端 P02] POST /api/wb/questions {image_key}
  └→ [Backend WrongbookController.create]
      ├→ 落 wb_question_batch (status=PENDING, total_questions=0)
      └→ 返 {batchId, qids:[]}

[前端 P03] POST /api/ai/analyze {batchId} → 开 SSE
  └→ [Backend AiAnalyzeService.analyzeBatch]
      ├→ Step 1: RegionSplitter.split(imageBase64)
      │   ├→ Spring AI ChatModel (Claude Sonnet · §6.1)
      │   ├→ Prompt §6.2 · response → JSON schema 校验 §6.2
      │   ├→ 阈值过滤 §6.4 (accept ≥0.75 / flag 0.5-0.75 / drop <0.5 / IoU>0.4 合并)
      │   ├→ 落 wb_question_batch.ai_split_metadata + total_questions
      │   ├→ 批量 INSERT N 行 wb_question (parent_batch_id, region_json, batch_order)
      │   └→ SSE emit BATCH_SPLIT_DONE{regions:[...]}
      ├→ Step 2: N 路并发 QuestionAnalyzer.analyze(subImage_i)
      │   (实装方式 §6.5 决策 · 复用 master §6 单题 4-step)
      │   └→ per-题 SSE emit STEP_DONE{qid, regionIdx, step}
      └→ 全完 emit BATCH_DONE{batchId, successCount, failCount, totalMs}

[前端 P04] GET /api/wb/batches/{batchId} → 返 originImageUrl + N 个 question (含 regionJson 归一化)
  └→ 前端 <AnnotatedOriginPhoto> SVG circle 按 viewBox × regionJson 渲染

[前端 P04 保存] POST /api/wb/batches/{batchId}:confirm {savedQids, discardedQids, masteryMap}
  └→ [Backend BatchConfirmController] 按 master §7 艾宾浩斯 per-qid 创 plan + 7 node + 7 event
```

---

## §10 API 增量 [REQUIRED]

### 10.13 改造 `POST /api/wb/questions` (向后兼容)

```
POST /api/wb/questions
Headers: Authorization · X-Idempotency-Key
Body:    { image_key, subject?, source? }            // 与 master §10.1 相同 (无 breaking change)
Resp:    201 { batchId, qids: [] }                   // 改: 之前 {qid} → 现在 {batchId, qids[]} · qids 初始空 (待 AI 切割后异步填充)
```

**向后兼容**: 客户端旧代码用 `resp.qid` 会 undefined · 前端需升级到 `resp.qids[0]` (N=1 时取首项)。建议加 `Accept-Version: v2` header 隔离 (后端按 header 返不同 shape)。

### 10.14 改造 SSE `/api/ai/analyze/{taskId}` (加 2 个 event type)

```
SSE event type 新增:
  - BATCH_SPLIT_DONE  { regions: [{idx, box:{x,y,w,h}, confidence}] }
  - BATCH_SPLIT_FAILED { reason: 'NO_BOUNDARY_DETECTED' | 'IMAGE_TOO_DARK' | 'TIMEOUT' }
SSE event type 增强 (加字段):
  - STEP_START       { ..., qid?, regionIdx? }     // 多题时带 · 单题时 null
  - STEP_DONE        { ..., qid?, regionIdx?, fail?, code? }
  - BATCH_DONE       { batchId, successCount, failCount, totalMs }    // 替代单题 DONE
```

### 10.15 新增 `POST /api/wb/batches/{batchId}:confirm` (批量保存)

```
POST /api/wb/batches/{batchId}:confirm
Headers: Authorization
Body:    {
           savedQids: ["q1", "q2"],
           discardedQids: ["q3"],
           masteryMap: { "q1": "mastered", "q2": "forgot" }   // null 表示未自评 · 默认走艾宾浩斯 T0 SCHEDULED
         }
Resp:    200 {
           batchId,
           savedCount: 2,
           discardedCount: 1,
           planIds: ["plan-1", "plan-2"],
           firstNodeIds: ["node-1-T0", "node-2-T0"]
         }
Err:     400 INVALID_QID_NOT_IN_BATCH · 409 BATCH_ALREADY_CONFIRMED (幂等 · 二次提交相同 body 返 200 不返 409)
SLA:     P95 ≤ 2s (N=5) · ≤ 4s (N=20 默认 N_MAX · 后端事务内并行创 20 plan + 140 node + 140 event · PostgreSQL statement_timeout 5s 保护)
```

### 10.16 改造 `GET /api/wb/questions` 响应加 batch 字段

```
GET /api/wb/questions?batchId=&filter=&page=
Resp:    {
           items: [{
             qid, ..., 
             batch: { batchId, total, order }    // 新加 · total === 1 时前端不渲染 batch chip
           }]
         }
```

**复用说明**：本 satellite 复用 master §10.5 `:grade` 效果回写接口 · 复用 master §10.2 SSE 通道基础协议 · 不新建独立 SSE endpoint。

---

## §12 部署增量 [REQUIRED]

归入 master §S5 (艾宾浩斯引擎 + 日历联动 · L2396) 之**后** · 新增 **S5.5 多题切割 pipeline** 阶段 (估 3 人天):

| 步骤 | 内容 | 验证 |
|---|---|---|
| S5.5.1 | DB migration V20260516_01 + V20260516_02 · backfill 历史单题为 batch | `SELECT COUNT(*) FROM wb_question WHERE parent_batch_id IS NULL` = 0 |
| S5.5.2 | 后端: 改 `CreateQuestionReq` + `WrongbookController.create` 返 batch shape · 加 `BatchConfirmController` | E2E: POST 单 image → 返 batch · GET batch → 含 1 qid |
| S5.5.3 | AI service: 加 `RegionSplitter` step (Spring AI 多模态接口前置) · SSE 加 2 个 event type · per-题 并发 future | E2E: 拍 3 题图 → SSE 序列含 BATCH_SPLIT_DONE + 3 个 STEP_DONE × 4 |
| S5.5.4 | mp 前端: P02 加 hint · P03 加 multi-progress 组件 · P04 加 swiper + checkbox · P05 加 batch chip | E2E spec sc-17/18/19 全绿 |
| S5.5.5 | H5 前端 drift 治理: 删 `Mode='multi'` 假按钮代码 · `testids/src/index.ts:29 modeMulti` 改命名为真用 (取景器 hint testid) | grep `Mode='multi'` 0 命中 · testid 重命名后 H5 build 通过 |

---

## §15.4 跨文档对照表 [REQUIRED]

本 satellite ↔ master 的双向引用清单 (gen-biz-doc Step 4 ±5 行容差校验已通过):

| satellite §X | master § | 行号 | 关系 |
|---|---|---|---|
| §0.2 改进点 "用户认知" | master §2A.4 P02 (L469 起) "拍题相机" | L469 | 行为增强 (差量 §2A.4 P02 卡) |
| §0.2 改进点 "数据完整性" | master §3.1 Question Aggregate (一次拍题=一张错题卡) | L1430 | DDD 演进 (1:1 → 1:N · 加 batch 聚合根) |
| §0.2 改进点 "AI 处理能力" | master §6 Spring AI 详设 | L1857-L1934 | 复用 4-step pipeline · 前置加 split step |
| §0.2 改进点 "drift 治理 (1/4)" | master §1.2 MVP 范围 "单页" 字面 | L62 | biz 收编多题 → 不再"单页"假设 |
| §0.2 改进点 "drift 治理 (2/4)" | mockup `02_capture.html:165-169` "modes" 3 mode | mockup L165 | mockup 加新元素 (auto-detect hint) |
| §0.2 改进点 "drift 治理 (3/4)" | `frontend/packages/testids/src/index.ts:29` modeMulti | code L29 | testid 重命名为真用 |
| §0.2 改进点 "drift 治理 (4/4)" | `frontend/apps/h5/.../Capture/index.tsx:75 + 401` `Mode='multi'` 假按钮 | code L75/401 | 删除假按钮 · 改 auto-detect |
| §1.1 角色 | master §2A.1 学生角色 | L163-L177 | 复用 |
| §1.3 北极星 | master §1.4 关键业务指标 | L84-L96 | 增量贡献 (入库效率 / 激活留存) |
| §2A.4 P02-P05 差量卡 | master §2A.4 既有 P02 (L469) / P03 (L483) / P04 (L498) / P05 (L513) 卡 | L469-L528 | 行为增强 · 不替换 |
| §2B.18-20 SC-17/18/19 | master §2B.0 表头图例 + §2B.1 SC 总览 | L725-L769 | 完全复用 SC 卡 schema (编排表 + QA 表) |
| §4.14-15 DB 增量 | master §4.5 wb_review_plan + §4.6 wb_review_node + §4.9 calendar_event | L1539-L1660 | 复用 · 不变 (艾宾浩斯不变) |
| §10.13-16 API 增量 | master §10.1 上传 + §10.2 AI SSE + §10.5 grade | L2119-L2158 | 改造 + 新增 · 向后兼容 |
| §12 部署增量 | master §S5 艾宾浩斯 + 日历联动 | L2396 | 加 S5.5 多题切割 pipeline 阶段 (3 人天) |
| §1.2 + §2A.4 P04 `<AnnotatedOriginPhoto>` | master §4.2 wb_question.origin_image_key 字段 + 本 satellite §4.15 wb_question.region_json 新列 | L1485 + satellite L295 | 红圈视觉依赖 originImageUrl (后端 OSS presign) + regionJson 几何 · 切割失败时 region 为 null · 退化为普通缩略图 |
| §1.4 N=20 配置项 | master §15.1 BOM (Spring Boot + actuator/refresh) | L3073 | 复用 Spring `@RefreshScope` 热更 application.yml |
| §1.4 业务边界 (N≥10 试卷提示) | master §1.3 非 MVP "考前知识点诊断" P1-P2 | L75-L82 | 软引导 · 不强制 · 防止业务越界 |
| §6.1 模型选择 (Claude Sonnet 主 / GPT-4o 备) | master §15.1 BOM Spring AI 多 provider | L3073 | 复用 ChatModel interface · 切换走 `ai.split.provider` yml |
| §6.2 Split Prompt 模板 + JSON Schema | master §6.2 单题 Spring AI QuestionAnalyzer prompt | L1857-L1934 | 本段在 master 4-step pipeline 前 加 1 个 RegionSplitter step · 单题 prompt 不变 |
| §6.3 regions 归一化坐标 | satellite §4.15 wb_question.region_json | satellite L338 | DB 存归一化 · 前端 SVG viewBox 还原 · 后端按需 crop |
| §6.4 置信度阈值 SLA | SC-19 分支 A (切割失败降级) + §4.14 ai_split_metadata | satellite L264 + L324 | 阈值 0.75/0.5/IoU 0.4 锁字面 · 配置化 yml 可调 |

---

## §16 Next Steps

落地本 satellite 后的下游动作 (按优先级排):

- **(用户决策 6 件 · 见 §17 开放问题 · 必须先答完才推进)**
- **(立即 · 0.5 人天 · 不依赖 6 决策)** 删 H5 假按钮 (drift 治理 · 4/4 点第 4 个 · 可单独 PR · 不破坏任何现有功能) — 该项独立成 mini-fixit · 走 `gen-biz-doc` 之外的快速通道 · 用户人工提 PR
- **(决策后 1 周)** 触发 [gen-mockup.md](../../.harness/skills/gen-mockup.md): 不新建 mockup HTML · 而是改 `02_capture.html` (加 multi hint) + `03_analyzing.html` (改 multi progress) + `04_result.html` (加 swiper) + `05_wrongbook_list.html` (加 batch chip) — 4 处 diff · 单独写 PR
- **(决策后 1 周)** 触发 [gen-page-spec.md](../../.harness/skills/gen-page-spec.md) × 4: 为 P02/P03/P04/P05 各产 satellite-aware spec.md (§9 异常 + §10 验收点增量 · 不重写整 spec)
- **(决策后 2 周)** 触发 [gen-feature-list.md](../../.harness/skills/gen-feature-list.md) × 3: 为 SC-17/18/19 各产 feature_list (预估 SC-17: 6-8 task · SC-18: 4-5 task · SC-19: 4-6 task · 共 14-19 task)
- **(决策后 3 周)** 主 biz §15.5 已自动追加 1 行 cross-ref · 等 P1 立项确认后由 owner 把本 satellite 合 main 分支 (本 satellite Created=2026-05-16 · 真 P1 落地预计 2026-06 中)

---

## §17 决策记录 (用户 2026-05-16 拍板 · 4/6 已决 · 2/6 沿用 sane defaults)

| # | 决策点 | 状态 | 用户决策值 | 备注 |
|---|---|---|---|---|
| 1 | **N 上限** | ✓ **已决** | **可配置 · 默认 N_MAX=20** | 后端 `application.yml: wrongbook.multi-question.max-per-batch` · `@RefreshScope` 可热更 · 触发 §1.4 4 维度次生影响应对 |
| 2 | **触发方式** | ✓ **已决** | **Auto-detect 全程** | 与 satellite v1 默认一致 · 用户无感 · H5 假按钮 mini-PR 删除后无残留 toggle |
| 3 | **batch 事务边界** | ✓ **已决** | **全或无入库** | 与 satellite v1 默认一致 · DDD 聚合根标准做法 · 失败回滚整 batch (TC-18.02) |
| 4 | **drift 治理时机** | ✓ **已决** | **立刻拆独立 mini-PR** | 0.5 人天 · 本周 · 不依赖 P1 启动 · 见 §16 Next Steps + plan 文件 task C |
| 5 | **拍考试整卷** | 沿默认 | 明确不支持 + N≥10 软引导 | satellite v1 默认 + §1.4 业务边界补充 (推荐"考前诊断") · 用户未明示反对 |
| 6 | **保存后跳哪** | 沿默认 | P05 高亮新增 | satellite v1 默认 · 与 master SC-01 单题流心智一致 · 用户未明示反对 |
| **新 7** | **P04 红圈标注 (用户 2026-05-16 加项)** | ✓ **已决** | **顶部 `<AnnotatedOriginPhoto>` 红圈标注 · 红/绿/灰 三态实时跟随 swiper choice + mastery decision** | 见 §1.2 本次做新加点 + §2A.4 P04 + SC-17 step 9-10a + SC-18 红圈过渡 + SC-19 分支 D 降级 + §15.4 cross-ref |
| **新 8** | **AI Backend 实装详设 (用户 2026-05-16 v1.2 加项)** | ✓ **4 项已决 · 3 项 P1 spike 后定** | **§6.1 模型 Claude Sonnet 主 / GPT-4o 备 · §6.2 Split Prompt + JSON Schema 锁字面 · §6.3 regions 归一化 0-1 · §6.4 置信度阈值 0.75/0.5 + IoU 0.4 + 超时 8s/10s** · 留 §6.5: N 路并行编排具体实装 / Prometheus 监控规则 / Resilience4j 熔断完整配置 (P1 启动 backend Coder spike 20 样本后定) | 见 §6 全段新增 + §15.4 cross-ref 加 4 行 |

---

**修订表**

| 版本 | 日期 | owner | 摘要 |
|---|---|---|---|
| v1 | 2026-05-16 | user (gen-biz-doc 第 2 次实战) | 首版 · 侧重 "4 层 silent drift 治理 + 业内对齐" 改进角度 · 不是简单加新功能 · 跨 4 既有页 (P02-P05) 行为增强 · 3 SC (SC-17/18/19) · 2 新 DB 表/列 · 4 API 改造/新增 · §17 6 决策点开放等用户拍板 |
| v1.1 | 2026-05-16 | user | 4/6 决策已定 + 新加 P04 `<AnnotatedOriginPhoto>` 红圈标注组件 · 主要回写: §0.2 加 1 行 UI 组件 + 1 行配置项 / §1.2 改 N=5→N_MAX 默认 20 + P04 红圈作为本次做 / §1.4 新增 N=20 设计后果段 (4 维度) / §2A.4 P02 异常 + P04 加 `<AnnotatedOriginPhoto>` + 数据绑定 + 异常 + 埋点 + 性能 / SC-17 step 9 改 10a 新加 红圈跳 swiper + 关键断言加红圈不变量 + TC-17.03 改 N=20 + 加 TC-17.04 (N>N_MAX) + 加 TC-17.05 (红圈跳) / SC-18 编排 3 步加红圈过渡 + 加 step 3a 静态视觉 + 关键断言加红圈优先级 / SC-19 分支 B 改 N_MAX + 加分支 D (regionJson null 降级) + 加 TC-19.05 / §10.15 SLA 改 N=20 / §15.4 加 3 行 cross-ref / §17 决策表整体重写 (4 已决 + 2 默认 + 新加红圈决策) |
| v1.2 | 2026-05-16 | user | **AI Backend 实装详设 §6 全段新增 (补 v1.1 留白)** · 答用户问 "satellite 有没有设计 AI 后端实现一次拍照多题、出多个错题的解释" · 加: §6.1 模型选择 (Claude Sonnet 主 / GPT-4o 备 · 月 $300 预算粗估) / §6.2 Split Prompt 模板 (System 6 规则 + User + JSON Schema) / §6.3 regions 归一化 0-1 字段格式 + 为什么不用像素 / §6.4 置信度阈值 SLA (单题 0.75/0.5/丢弃 + region IoU 0.4 合并 + 超时 8s/10s) / §6.5 留 3 项 P1 spike (并行编排实装 / Prometheus 监控 / Resilience4j 熔断) / §6.6 端到端调用链 ASCII 一图看清。同步: Status v1.1→v1.2 / §15.4 cross-ref 加 4 行 (§6.1-6.4 各 1 行) / §17 加决策 #8 AI Backend (4 已决 + 3 P1 spike) |
