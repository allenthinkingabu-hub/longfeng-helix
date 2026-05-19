# M-AI-ANSWER-JUDGE · 拍照作答 + AI 辅助判题 — Satellite Biz Doc

**Status**: Draft (v1.1 · 2026-05-18 §4.16 改 B 路径 · 等用户拍 §17 决策表后进 Reviewed)
**Owner**: full-stack (backend AnswerJudgeService + AI prompt + frontend P08 第 4 input tab + DB schema)
**Created**: 2026-05-16
**Priority**: **P1** (MVP 14 天不做 · P1 启动 · 建议与 M-MULTI satellite 同周期跑 · 共享 §6 AI Backend 基建)
**Master ref**: [../业务与技术解决方案_AI错题本_基于日历系统.md](../业务与技术解决方案_AI错题本_基于日历系统.md) (v1.2)
**Mockup**: `design/mockups/wrongbook/20_review_exec_ai_judge.html` (NEW · 414 行 · 22 testid · gen-mockup skill v1 第 3 次实战 · 风格基准 `08_review_exec.html` (P08 现有) · 演示 SC-20 step 5 瞬间: AI 已判 PARTIAL · confidence 75% · 自评 PARTIAL 按钮预选高亮 · 学生未点击采纳) · 原版 `08_review_exec.html` 保留 (纯自评流 · 作为 photo input disabled 时的 fallback 视觉参照)
**前置参考**: [./M-MULTI-QUESTION-CAPTURE__multi-question-capture.md](./M-MULTI-QUESTION-CAPTURE__multi-question-capture.md) v1.2 §6 AI Backend (复用 Claude Sonnet 主模型 + 配置化阈值 yml 模式)

---

## §0 TL;DR

**这不是"加第 4 个输入按钮" · 是引入第二个判定信源 · 与现有"学生自评"并存的双分支判定机制 (方案 A 辅助式)**。

学生当前复习流: 揭示标答 → 学生**自评** (MASTERED/PARTIAL/FORGOT) → 驱动 SM-2 重排艾宾浩斯节点。痛点:**自评不客观** (学生易虚标 MASTERED 跳过复习 · 影响记忆曲线准确性)。

本 satellite 加入: 学生可选 **拍照上传自己的作答** → AI 判 (verdict + confidence + reason) → **AI 给"建议自评" · 学生最终决** (一 tap 采纳或 override) → 后端记 `final_grade_source` 用于后期 prompt calibration。

### 0.1 改进点矩阵 [REQUIRED · 本 satellite 灵魂]

| 维度 | 当前现状 | 改进后 (方案 A 辅助) | 为什么 |
|---|---|---|---|
| **判定信源** | 仅 1 个 (学生自评) | **2 个并存** (学生自评 + AI 判 · 学生最终决) | 减少自欺自评 · 提升艾宾浩斯节奏准确性 · 但不剥夺学生主体性 |
| **作答输入方式** | 3 种 (handwrite / keyboard / formula) | **4 种** (+ photo) | 真实学习场景下 · 草稿纸上手写解答最快 · 不必键盘转录 |
| **数据沉淀** | `answerText` 可选字段存了但无服务消费 | 拍照路径落 `user_answer_image_key` OSS + AI 判输出全字段入库 · **可用于后期 RLHF prompt 优化** | 形成 closed-loop · 不浪费数据 |
| **业务模式** | 自评驱动 SM-2 (master §7) | 自评驱动 SM-2 (**不变**) · AI 判仅 advisory | 不破坏 master §7 艾宾浩斯引擎 · 仅前置加 advisor · 安全演进 |

### 0.2 增量摘要表 [REQUIRED]

| 类型 | ID | 名称 | 优先级 | Owner |
|---|---|---|---|---|
| 改造页 (非新页) | P08 | 复习执行 · 加第 4 input tab "photo" + `<AiJudgeBanner>` AI 判结果展示卡 | P1 | frontend |
| **新 UI 组件** | `<PhotoAnswerTab>` | P08 input tabs 第 4 个 · 拍照触发 OSS upload → judge API · loading 5-8s | P1 | frontend (ui-kit) |
| **新 UI 组件** | `<AiJudgeBanner>` | P08 揭示答案区下方 · 展示 verdict (彩色 chip) + confidence (%) + reason (1-2 句) + 「采纳建议」/「我有不同看法」双 CTA · 默认高亮 AI 建议对应的自评按钮 (学生 1 tap 即确认) | P1 | frontend (ui-kit) |
| **新配置项** | `wrongbook.ai-judge.*` | 6 个 yml key (`confidence-accept`, `confidence-fallback`, `timeout-primary-ms`, `timeout-fallback-ms`, `enable-photo-input`, `image-retention-days`) · `@RefreshScope` 可热更 | P1 | backend |
| 新 SC | SC-20 | 拍照作答 → AI 辅助判 → 学生采纳 (happy path) | P1 | full-stack |
| 新 SC | SC-21 | AI 判错 · 学生 override · 后端记 `final_grade_source='ai_overridden'` | P1 | full-stack |
| 新 SC | SC-22 | AI 不确定 (`confidence < 0.5`) · banner 退化为 "AI 不确定 · 请用自评" · 不阻塞 | P1 | full-stack |
| **DB 表落地** (v1.1 升级 · 原 "加 6 列") | `wb_review_node` 一次 CREATE 14 master base 列 + 6 satellite 增量列 = 共 20 列 (含 4 indexes · master 原 2 + satellite 新 2) · master §4.5 paper-only 现 satellite V20260516_03 首次实装 (2026-05-18 用户决策 B) | P1 | backend |
| 新 API | `POST /api/review/nodes/{nid}/judge` | 触发 AI 判题 · req `{user_answer_image_key}` · resp `{verdict, confidence, reason}` · sync REST (不上 SSE · 单题判 ≤ 8s) | P1 | backend |
| 改造 API | `POST /api/review/nodes/{nid}/grade` | 现有 master §10.5 grade 接口 req body 加 `final_grade_source` 字段 (向后兼容: 缺省 'self') | P1 | backend |
| 改造 API | `GET /api/review/nodes/{nid}/result` | resp 加 `aiJudge: {verdict, confidence, reason, source} \| null` 字段 (向后兼容: AI 未判时为 null) | P1 | backend |
| **drift 治理** | 08_review_exec.html testid 全补 | 现 mockup (P08 spec L71 警告) 0 个 data-testid · 借本 satellite 改造同时补齐 (input tabs / reveal btn / grade btns 全加) | P1 (随 mockup diff 一起做) | frontend |
| **复用** | M-MULTI v1.2 §6.1 Spring AI ChatModel (Claude Sonnet 主 / GPT-4o 备) · master §7 艾宾浩斯 SM-2 引擎 · master §10.5 grade 接口主体逻辑 · master §4.5 wb_review_node 表 · OSS presign 上传链路 master §10.1 | — | — | — |

---

## §1 业务目标增量

### 1.1 涉及角色 (引用 master §2A.1 · 不重新定义)
- **学生** (master §2A.1 L163-L177) — 唯一直接用户 · 在 P08 复习执行场景

### 1.2 MVP 边界 (本次做什么 / 故意不做什么)

**本次做** (P1):
- P08 加第 4 input tab "拍照作答" · 学生可拍纸上手写解答 + 上传 OSS
- 后端新 `AnswerJudgeService` (复用 M-MULTI §6.1 ChatModel · Claude Sonnet 主 / GPT-4o 备)
- AI 判输出 `{verdict, confidence, reason}` · sync REST 5-8s
- P08 `<AiJudgeBanner>` 展示 AI 结果 + 高亮 AI 建议对应自评按钮
- **学生最终决** (一 tap 采纳 · 或选其他按钮 override)
- 后端记 `final_grade_source: 'self' | 'ai_accepted' | 'ai_overridden'` 用于后期 calibration
- 拍照原图 OSS 存 30 天 · 之后清理 (节省存储 · 见 §17 决策 #2)

**故意不做** (P2 / 不做):
- **AI 判驱动 SM-2** (即方案 B 替代式) · 现 master §7 自评驱动 SM-2 完全不变 · AI 仅 advisory
- **题型白名单** (即方案 C 试点式) · 全题型都显示拍照按钮 · 由 AI confidence 自适应降级 (复杂题 AI 不准 → confidence < 0.5 → banner 退化为 "请用自评") · 不在 UI 层做题型限制 (见 §17 决策 #4)
- **多张拍** · 1 个 node 仅支持 1 张作答照片 · 重拍 = 覆盖前一张
- **OCR 文本回显** · AI 判直接消化图像 · 不把 OCR 文本回显给学生 (避免 OCR 噪声干扰)
- **AI 判过的题 P09 复盘特殊处理** · 现有 P09 不变 · `aiJudge` 字段 P09 可选展示 (P1.5 视情况)

### 1.3 北极星指标贡献 (引用 master §1.4 L84-L96)

- **复习准确性**: AI 判 + 学生最终决双分支 · 预计降低"虚标 MASTERED 比率" 15-25% (spike 后实测) → 艾宾浩斯节奏更贴近真实掌握度
- **学生留存**: 客观判降低"自欺自评 → 后续复习失败 → 挫败感"恶性循环 · 提升 30 日留存
- **AI 成本**: 单次 judge ≈ $0.005-0.008 (Sonnet 多模态 · 见 §6.1) · 月活 1k 学生 × 月均 30 次复习 × 50% 拍照率 ≈ 月 $75-120 (粗估 · 在 M-MULTI 月 $300 预算外独立计量)
- **不影响**匿名漏斗 (本 satellite 是登录态后置场景 · 与 master §1.4 v1.2 35%/25%/15% 漏斗正交)

### 1.4 方案 A 辅助式三大原则 (本 satellite 设计宪法 · 不可破)

| 原则 | 字面 | 反例 (禁止) |
|---|---|---|
| **A.1 学生主体性** | AI 判仅 advisory · 学生**始终**保留最终自评决定权 · 任何路径不允许跳过自评按钮直接落库 | 反例: AI confidence ≥ 0.95 时自动落 grade · 学生失去掌控 → 本 satellite **禁止** |
| **A.2 双信源溯源** | DB 落 `final_grade_source` 区分 'self' / 'ai_accepted' / 'ai_overridden' · 任何 grade 必有归因 · 用于后期 prompt RLHF | 反例: 落库后无法区分 grade 来自学生还是 AI · 形成数据脏池 → 本 satellite **禁止** |
| **A.3 优雅降级** | AI 判失败 / 超时 / `confidence < 0.5` · 自动降级到纯自评 (与现状一致) · 不阻塞学生进度 | 反例: AI 判失败 modal 阻断学生 · 必须重试才能 grade → 本 satellite **禁止** |

---

## §2A.3 IA 增量

### 2A.3.1 新路由行 (插入 master §2A.3 路由表)

**无新增 page route** · 本 satellite 是 P08 (master §2A.3 路由表 L232) 的行为增强 · 路由不变。

### 2A.3.2 深链规则 (如有新增 wb://)

无新增。

---

## §2A.4 P08 差量卡 [REQUIRED]

> **特殊说明**：本 satellite 是 1 个既有页 (P08) 的行为增强 · 不是新页面卡 · 故用"差量"格式 · 仅写"与 master §2A.4 P08 既有卡 (L556-L569) 相比改了什么"。每项改动末标注 `[CHANGED]` / `[ADDED]` / `[REMOVED]`。

### P08 · 复习执行 (差量 vs master §2A.4 P08 L556-L569)

| 维度 | 变化 |
|---|---|
| **首屏目标** | [CHANGED] 加第 ③ "AI 辅助判题 (拍照后 5-8s 给建议) · 学生最终决" |
| **核心组件** | [ADDED] `<PhotoAnswerTab>` (第 4 input tab) · [ADDED] `<AiJudgeBanner>` (揭示答案区下方 · verdict chip + confidence + reason + 2 CTA) · [CHANGED] `<GradeButtonGroup>` (3 按钮) 默认 selected = AI 建议等级 (学生 1 tap 即确认) |
| **数据绑定** | [CHANGED] `answerDraft.mode` 加第 4 值 `'photo'` · [ADDED] `userAnswerImageKey: string \| null` · [ADDED] `aiJudge: {verdict, confidence, reason, status: 'PENDING' \| 'DONE' \| 'TIMEOUT' \| 'LOW_CONFIDENCE'} \| null` · [ADDED] `finalGradeSource: 'self' \| 'ai_accepted' \| 'ai_overridden' \| null` |
| **API 触点** | [ADDED] `POST /api/review/nodes/{nid}/judge body{user_answer_image_key}` · [CHANGED] `POST /api/review/nodes/{nid}/grade` req 加 `final_grade_source` · [CHANGED] `GET /api/review/nodes/{nid}/result` resp 加 `aiJudge` 字段 · OSS upload 复用 master §10.1 `POST /api/file/presign` |
| **状态集** | [CHANGED] `READING → ANSWERING → REVEALED → GRADED` (master) → `READING → ANSWERING → REVEALED → JUDGING (新中间态 · 仅拍照路径) → GRADED` |
| **跳转** | 不变 (仍跳下一题或 P09) |
| **异常态** | [ADDED] AI 判超时 (主 8s / 备 10s) → banner 显示 "AI 判慢 · 请用自评" · banner CTA 隐藏 · 自评按钮恢复未 selected 状态 (沿用现状) · [ADDED] `confidence < 0.5` → banner 退化为 "AI 不太确定 · 请按你的理解自评" · 同样不预选自评按钮 · [ADDED] 拍照 OSS 上传失败 → toast 错误 + 切回上一个 input tab (handwrite / keyboard / formula) |
| **i18n Key** | [ADDED] `review.exec.judge.photo` (拍照 tab 标题) · `review.exec.judge.uploading` · `review.exec.judge.thinking` (AI loading) · `review.exec.judge.verdict.{mastered\|partial\|forgot}` · `review.exec.judge.cta.accept` · `review.exec.judge.cta.override` · `review.exec.judge.low_confidence` · `review.exec.judge.timeout` |
| **埋点事件** | [ADDED] `wb_judge_photo_capture{nid, qid}` (拍照触发) · `wb_judge_photo_upload_done{nid, ms}` (OSS 上传完成) · `wb_judge_ai_request{nid, mode='photo'\|'text'}` (调 judge API) · `wb_judge_ai_done{nid, verdict, confidence, ms}` · `wb_judge_user_accept{nid, ai_verdict}` (学生采纳 AI 建议) · `wb_judge_user_override{nid, ai_verdict, user_verdict}` (override 时上报两端 verdict · 用于 RLHF calibration) · `wb_judge_ai_timeout{nid, ms}` · `wb_judge_ai_low_confidence{nid, confidence}` |
| **可访问性** | [ADDED] `<AiJudgeBanner>` verdict chip 必须 aria-label 含 "AI 建议: 已掌握/部分掌握/未掌握 · 置信度 X%" · 不允许仅靠颜色区分 (色盲友好) · 自评 3 按钮 tab order 保持当前顺序 (未掌握 / 部分 / 已掌握 left-to-right) · 不因 AI 建议而重排 |
| **性能预算** | [CHANGED] 揭示答案 ≤ 200ms (master 现状不变) · [ADDED] 拍照上传 OSS ≤ 2s P95 (image ≤ 500KB) · [ADDED] AI judge 主 ≤ 8s P95 (Sonnet) · 备 ≤ 10s P95 (GPT-4o) · [ADDED] `<AiJudgeBanner>` 渲染 ≤ 150ms |
| **drift 治理** | [REMOVED] mockup `08_review_exec.html` 当前 0 个 data-testid (P08 spec L71 标记 drift) · 本 satellite 落地时一并补齐: input tabs / reveal btn / grade btn × 3 / 新 photo tab / new banner 全加 testid · 不允许 silent skip |
| **优先级** | P1 |

---

## §2B 新 SC 卡 [REQUIRED]

### 2B.20 SC-20 · 拍照作答 → AI 辅助判 → 学生采纳 (happy path) (优先级: P1)

**场景目的**：验证方案 A 辅助式完整 happy path · 学生在 P08 复习节点拍照上传自己的手写作答 → AI 判 "PARTIAL 部分掌握" → banner 高亮 PARTIAL 自评按钮 → 学生 1 tap 采纳 → 落库 `final_grade_source='ai_accepted'` · 走 master §7 SM-2 PARTIAL 路径。

**前置条件**：前置 SC: master §2B.3 SC-02 (登录态今日复习) 已 PASS · 学生在 P08 复习节点 · 已揭示答案 (state = REVEALED) · 网络稳定 · `wb_review_node` 加 6 列 migration 已 done · `AnswerJudgeService` 已部署 · 相机权限授予。

**核心路径编排（happy path · 1 题 · AI 判 PARTIAL · 学生采纳）**：

| # | 用户动作 | 页面前台 | 后端/事件 | 前端状态 | 埋点 | 耗时预算 |
|---|---|---|---|---|---|---|
| 1 | P08 揭示答案后 · 切到第 4 input tab "拍照" | tab 高亮 · 唤起拍照 sheet | — | `answerDraft.mode = 'photo'` | — | ≤ 100ms |
| 2 | 拍照对准草稿纸 · 按快门 | 缩略图飞入 · 触觉 | — | `capture.CAPTURED` | `wb_judge_photo_capture{nid, qid}` | ≤ 100ms |
| 3 | 自动上传 OSS | 进度 0→100% | `POST /api/file/presign` → PUT OSS → 拿到 `image_key` | `capture.UPLOADING → UPLOADED` | `wb_judge_photo_upload_done{nid, ms}` | ≤ 2s |
| 4 | 触发 AI 判 | `<AiJudgeBanner>` skeleton "AI 正在判题..." | `POST /api/review/nodes/{nid}/judge body{user_answer_image_key}` · 后端调 AnswerJudgeService (复用 M-MULTI §6.1 ChatModel · §6.2 judge prompt) | `aiJudge.status = 'PENDING'` | `wb_judge_ai_request{nid, mode='photo'}` | — |
| 5 | AI 判完返 (Sonnet ≤ 8s) | banner 渲染 verdict chip "PARTIAL · 部分掌握" + confidence "AI 75% 把握" + reason "答案正确但缺步骤 2 验证 · 步骤 1,3 完整" + 「采纳建议」CTA · 同时底部 3 自评按钮 PARTIAL 高亮 (selected) | resp `{verdict:'PARTIAL', confidence:0.75, reason:'...'}` · 后端落 `wb_review_node.ai_judge_*` 5 列 (verdict/confidence/reason/metadata/image_key) | `aiJudge.status = 'DONE'` · `aiJudge.verdict = 'PARTIAL'` | `wb_judge_ai_done{nid, verdict:PARTIAL, confidence:0.75, ms:5400}` | ≤ 8s |
| 6 | 学生看 reason 觉得合理 · Tap 「采纳建议」 (或直接 Tap 底部 PARTIAL 按钮亦可 · 等价) | 全屏 loading "保存中..." | `POST /api/review/nodes/{nid}/grade body{grade:'PARTIAL', timeSpentMs, final_grade_source:'ai_accepted'}` · 后端走 master §7 SM-2 PARTIAL 路径 (ease -0.2 · maintain interval) · 落 `wb_review_node.status=GRADED` · 链式触发日历重排 | `state = GRADED` | `wb_judge_user_accept{nid, ai_verdict:PARTIAL}` | ≤ 1s |
| 7 | 跳下一题 / 跳 P09 完成页 | 路由 → 下一 nid 或 P09 | — | — | (复用 master 现有) | ≤ 200ms |

**关键断言点（System Invariants）**：
- `wb_review_node.ai_judge_verdict` 必须 ∈ {'MASTERED', 'PARTIAL', 'FORGOT'} · 与最终 grade 字段独立 (可不同)
- `wb_review_node.final_grade_source` ∈ {'self', 'ai_accepted', 'ai_overridden'} · `'ai_accepted'` 时必有 `ai_judge_verdict === grade`
- AI 判完成不代表 grade 落库 · grade 落库唯一触发点是 master §10.5 `POST :grade` · **不允许 judge API 直接落 grade** (A.1 学生主体性铁律)
- `wb_review_node.user_answer_image_key` 非 null 时必有 `ai_judge_*` 5 列同时非 null (事务边界)
- AI 判超时 / `confidence < 0.5` 时 `ai_judge_verdict` 仍可落库但 `ai_judge_status` 字段标记 `'TIMEOUT'` / `'LOW_CONFIDENCE'` · 前端用此字段决定 banner 退化文案
- 学生采纳路径下 banner CTA tap 与底部 grade 按钮 tap 必须等价 (都调 `:grade` · 都落 `final_grade_source='ai_accepted'`)

**QA 用例（GIVEN / WHEN / THEN）**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-20.01 | 正常 | 学生在 P08 节点 nid=500 · 已 REVEALED · 网络稳定 | 完成 SC-20 步骤 1-7 (AI 判 PARTIAL · 学生 Tap 采纳) | DB: `wb_review_node(nid=500).status=GRADED, ai_judge_verdict='PARTIAL', ai_judge_confidence=0.75, ai_judge_reason 非空, user_answer_image_key 非空, final_grade_source='ai_accepted'` · master §7 SM-2 PARTIAL 路径执行 (ease -0.2) · 跳下一题 ≤ 15s |
| TC-20.02 | 正常 | 同 TC-20.01 但学生选 handwrite (不拍照) | 学生作答后揭示答案 + 直接 Tap PARTIAL 自评 (不调 judge API) | DB: `wb_review_node.status=GRADED, ai_judge_*=null, final_grade_source='self'` · 与 master 现状 100% 一致 (**向后兼容确认**) |
| TC-20.03 | 边界 | 学生拍照后 OSS 上传失败 (网络抖动) | step 3 中断 | Toast "上传失败 · 请重试" + 自动切回 handwrite tab · 0 个 wb_review_node 字段被改 · 学生可重试拍照或走自评 |

---

### 2B.21 SC-21 · AI 判错 · 学生 override (优先级: P1)

**场景目的**：验证 A.1 学生主体性铁律 · AI 判 "MASTERED 已掌握" 但学生认为自己其实没掌握 (答案对了但是猜的) · Tap 底部 FORGOT 按钮 override · 后端记 `final_grade_source='ai_overridden'` · 走 SM-2 FORGOT 路径 (master §7 触发整 plan T0-T6 全重排) · 数据用于后期 RLHF prompt calibration。

**前置条件**：前置 SC: SC-20 步骤 1-5 完成 · `<AiJudgeBanner>` 已渲染 verdict=MASTERED · confidence=0.85。

**核心路径编排**：

| # | 用户动作 | 页面前台 | 后端/事件 | 前端状态 | 埋点 |
|---|---|---|---|---|---|
| 1 | banner 显示 "AI 建议: MASTERED · 85% 把握 · 答案完全正确 · 步骤完整" + 底部 MASTERED 按钮高亮 | (静态视觉 · 等学生决) | — | `aiJudge.verdict='MASTERED'` · grade button group `selected='MASTERED'` | (已上报 `wb_judge_ai_done` at SC-20 step 5) |
| 2 | 学生想"答案对是因为我猜的 · 实际没掌握" · Tap 底部 FORGOT 按钮 (override AI 建议) | MASTERED 按钮取消高亮 · FORGOT 按钮高亮 · banner CTA 文案变 "你选择了 FORGOT · 与 AI 不同 (这有助于我们改进 AI)" | — | grade button group `selected='FORGOT'` | `wb_judge_user_override{nid, ai_verdict:'MASTERED', user_verdict:'FORGOT'}` |
| 3 | Tap 「确认提交」 (或 banner 自动 trigger grade after 2s) | 全屏 loading | `POST /api/review/nodes/{nid}/grade body{grade:'FORGOT', timeSpentMs, final_grade_source:'ai_overridden'}` · 后端走 master §7 SM-2 FORGOT 路径 (ease reset 2.5 · T0-T6 整 plan 重排) | `state = GRADED` | (复用 master grade 事件) |
| 4 | 跳下一题 / 跳 P09 | 路由 | — | — | — |
| 5 | (后台异步) backend 把 `(ai_verdict='MASTERED', user_verdict='FORGOT', image_key, reason)` 推 RLHF 训练队列 | (用户无感) | RocketMQ `ai-judge.overridden` → 训练数据 Kafka topic | — | — |

**关键断言点**：
- `wb_review_node.final_grade_source = 'ai_overridden'` · `ai_judge_verdict='MASTERED'` · `grade='FORGOT'` (两者必不同)
- master §7 SM-2 FORGOT 路径完整执行 · `wb_review_node` T1-T6 全 CANCELLED + 重排 7 new node (master §7 case FORGOT 复用 · 不破坏)
- override 上报埋点必含双 verdict (`ai_verdict` + `user_verdict`) · 用于后期 prompt 优化的训练样本
- RLHF 队列推送是异步 outbox 模式 · 不阻塞 user-facing grade 流 · 失败重试 (与 master §11 NFR 一致)

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-21.01 | 正常 | SC-20 step 5 完成 · banner 显示 MASTERED 85% · 学生想 override | 完成 SC-21 步骤 1-5 (Tap FORGOT) | DB: `final_grade_source='ai_overridden', ai_judge_verdict='MASTERED', grade='FORGOT'` · master §7 FORGOT 重排 · RLHF outbox 含 1 条 |
| TC-21.02 | 异常 | 同 TC-21.01 但 step 5 RLHF 队列推送失败 (RocketMQ 不可用) | step 5 异步推送 | grade 流不受影响 (学生体验 100% OK) · outbox 加重试标记 · 5 分钟后重试 · 监控告警 `ai-judge.outbox.fail` |
| TC-21.03 | 边界 | AI 判 MASTERED · 学生 Tap PARTIAL (中间值 override · 不是完全相反) | step 2-5 | DB: `final_grade_source='ai_overridden', ai_verdict='MASTERED', grade='PARTIAL'` · RLHF outbox 仍推 (任何 ai_verdict != grade 都算 override) |

---

### 2B.22 SC-22 · AI 不确定 (`confidence < 0.5`) · banner 退化 (优先级: P1)

**场景目的**：验证 A.3 优雅降级铁律 · AI 对学生作答把握不足 (复杂多步解答题 / 字迹潦草 / 题型 AI 不擅长) · `confidence < 0.5` · banner 自动退化为 "AI 不太确定 · 请按你的理解自评" · 不预选自评按钮 · 学生走原 master §7 纯自评路径。

**前置条件**：前置 SC: SC-20 步骤 1-4 完成 · AI judge 返 `confidence=0.32`。

**核心路径编排**：

| # | 触发 | 反馈 |
|---|---|---|
| 1 | step 5 (AI 返) resp `{verdict:'PARTIAL', confidence:0.32, reason:'答案接近但步骤难辨认 · AI 不确定'}` | 前端检测 `confidence < 0.5` · banner 退化 |
| 2 | banner 渲染策略 | 仅显示 "🤔 AI 不太确定 · 请按你的理解自评" + 灰色文案 · 不显示 verdict chip · 不显示 reason · 不显示 CTA · 底部自评 3 按钮**不预选**任何一个 (selected=null) |
| 3 | 学生 Tap 底部任一自评按钮 (e.g. PARTIAL) | 按钮高亮 + 「确认提交」CTA 出现 | (与 master 现状一致) |
| 4 | Tap 「确认提交」 | `POST :grade body{grade:'PARTIAL', timeSpentMs, final_grade_source:'self'}` · master §7 PARTIAL 路径执行 | `state = GRADED` |
| 5 | 后端仍落 `ai_judge_*` 5 列 (含 confidence=0.32) | 用于后期分析 "哪些题型 AI 不擅长" | — |

**关键断言点**：
- `confidence < 0.5` 时 `final_grade_source` 必为 `'self'` (因为 banner 没预选 AI verdict · 学生独立选 = 不算 ai_accepted)
- `ai_judge_*` 5 列仍写库 (即使 `confidence` 低) · 用于后期分析 / 监控 / dashboard 展示 "AI 不擅长题型分布"
- banner 不显示 reason / CTA · 避免 "AI 半生不熟" 信息干扰学生判断

**QA 用例**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-22.01 | 异常 | SC-20 step 1-4 完成 · AI 返 `confidence=0.32` | 完成 SC-22 步骤 1-5 | banner 退化文案 · 自评按钮无预选 · 学生独立选 PARTIAL · DB: `final_grade_source='self', ai_judge_confidence=0.32, grade='PARTIAL'` · master §7 流程不受影响 |
| TC-22.02 | 边界 | AI 超时 (Sonnet 8s + GPT-4o 10s 都失败) | step 5 中 SSE / REST 双失败 | banner 显示 "AI 判超时 · 请用自评" + 不预选 · `ai_judge_*` = null · `final_grade_source='self'` · 学生纯自评 (与 master 现状 100% 一致) · 埋点 `wb_judge_ai_timeout{nid, ms:18000}` |
| TC-22.03 | 安全 | 学生拍含 PII 草稿纸 (e.g. 写了家庭住址在角落) | step 1-5 | AI 判 prompt §6.2 含 "仅看作答 · 忽略与题目无关的内容" 约束 · 后端 OSS 30 天后自动清理 (§17 决策 #2) · 不留 PII 长期残留 |

---

## §4 DB 增量 [REQUIRED]

### 4.16 `wb_review_node` 一次落地 14 base + 6 satellite 共 20 列 (用户 2026-05-18 决策 B)

> **⚠️ 决策记录 (2026-05-18 · 用户拍板 B 路径)**：
> SC20-T01 Coder Phase 2 review 发现：master §4.5 wb_review_node 表设计 paper-only · backend repo 无对应 Flyway migration (`grep -rln "wb_review_node" backend/` 0 hit)。原 §4.16 假设"加列于既存表"前提断裂。
> **决策 B**：本 V20260516_03 migration 一次性 **CREATE TABLE wb_review_node 14 base 列 (master §4.5 字面) + ALTER ADD 6 satellite 列 = 共 20 列 · 含 master §4.5 原 2 indexes + satellite 新 2 partial indexes = 共 4 indexes**。
> **归属变更**：wb_review_node 表 owner 自 master §4.5 (paper-only) 变 satellite M-AI-ANSWER-JUDGE V20260516_03 (实装)。后续 master 自己再加列时须先 grep 本 migration 确认表已落地 · 不可重复 CREATE。
> **拒绝路径**：A (拆前置 task 给 master 单建表) — 阻塞 SC-20 启动 · 改 feature_list 总数。C (fixture-only) — 生产部署不可行。

```sql
-- V20260516_03__wb_review_node_create_with_ai_judge_columns.sql
-- 注：master §4.5 (L1559-L1580) 原 paper-only · 本 migration 首次实装 · 14 base 列字面与 master §4.5 一致 · 末尾 6 列为 satellite 增量
CREATE TABLE wb_review_node (
  -- master §4.5 base 14 列 (字面与 master L1562-L1577 一致)
  id                BIGINT PRIMARY KEY,
  plan_id           BIGINT NOT NULL,
  student_id        BIGINT NOT NULL,
  level             SMALLINT NOT NULL,             -- 0..6 对应 T0..T6
  level_code        VARCHAR(8) NOT NULL,           -- INITIAL/H1/D1/D3/D7/D15/D30
  due_at            TIMESTAMPTZ NOT NULL,          -- 艾宾浩斯计算得到
  window_end_at     TIMESTAMPTZ NOT NULL,          -- due_at + 24h
  ready_at          TIMESTAMPTZ,                   -- due_at - 30min (预生成任务时刻)
  status            SMALLINT NOT NULL DEFAULT 0,   -- 0 SCHEDULED 1 READY 2 PUSHED 3 REVIEWED 4 FORGOTTEN 9 FAILED
  pushed_at         TIMESTAMPTZ,
  reviewed_at       TIMESTAMPTZ,
  effect            SMALLINT,                       -- 1 掌握 2 部分 3 未掌握
  calendar_event_id BIGINT,                         -- 关联日历事件 ID (外挂到 calendar_event.relation_id)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- satellite M-AI-ANSWER-JUDGE 增量 6 列
  user_answer_image_key VARCHAR(512),               -- OSS object key · null = 学生未走拍照路径
  ai_judge_verdict      VARCHAR(16),                -- 'MASTERED' | 'PARTIAL' | 'FORGOT' · null = AI 未判
  ai_judge_confidence   DECIMAL(3,2),               -- 0.00-1.00 · null = AI 未判
  ai_judge_reason       TEXT,                        -- AI 解释 · 100 字内 · 中文 · null = AI 未判
  ai_judge_metadata     JSONB,                       -- {model_used, prompt_version, token_cost_usd, latency_ms, status:'DONE'|'TIMEOUT'|'LOW_CONFIDENCE'}
  final_grade_source    VARCHAR(16) NOT NULL DEFAULT 'self',  -- 'self' | 'ai_accepted' | 'ai_overridden'
  -- master §4.5 base 约束
  UNIQUE(plan_id, level)
);
-- master §4.5 base 2 indexes (字面与 master L1579-L1580 一致)
CREATE INDEX idx_wb_node_due_status    ON wb_review_node(status, due_at);
CREATE INDEX idx_wb_node_student_due   ON wb_review_node(student_id, due_at) WHERE status IN (0,1,2);
-- satellite 增量 2 partial indexes
CREATE INDEX idx_wrn_judge_source      ON wb_review_node(final_grade_source) WHERE final_grade_source != 'self';
CREATE INDEX idx_wrn_low_confidence    ON wb_review_node(ai_judge_confidence) WHERE ai_judge_confidence < 0.5;
```

**字段约束**:
- `final_grade_source='ai_accepted'` 时必有 `ai_judge_verdict === wb_review_node.grade` (CHECK 约束应用层校验 · 不入 DB CHECK 因 grade 在 outcome 表)
- `final_grade_source='ai_overridden'` 时必有 `ai_judge_verdict != grade` (同上 · 应用层)
- `user_answer_image_key` 非 null → `ai_judge_*` 4 列必同时非 null (事务边界 · 见 SC-20 关键断言)
- 30 天 retention 由 OSS lifecycle rule 自动清理 (见 §17 决策 #2) · DB 字段保留 `user_answer_image_key` 但 OSS 已删 · 前端读时 404 静默处理

**复用说明**: 本 satellite **首次落地 wb_review_node 表** (master §4.5 原 paper-only) · 落地后完全复用 master §4.4 `wb_review_plan` + §4.6 calendar_event 联动 + master §7 艾宾浩斯引擎不变 · 14 base 列字面严格匹配 master §4.5 L1562-L1580 · 不允许偏离。

---

## §6 AI Backend 实装详设 (judge prompt + 阈值)

> **复用 M-MULTI v1.2 §6.1**: 模型选择 (Claude 3.5 Sonnet 主 · GPT-4o 备) · Spring AI ChatModel · Resilience4j 切换条件 · 配置 yml 模式 · 全部沿用 · 不重写。
> **不复用 M-MULTI §6.2**: M-MULTI 的 split prompt 是"切题边界" · 本 satellite 是"判作答对错" · 任务完全不同 · 必须新写。

### §6.1 复用 M-MULTI §6.1 模型选择 (满足 satellite §3 反作弊红线 #1 · 不重复定义)

见 [M-MULTI satellite v1.2 §6.1 L358-L364](./M-MULTI-QUESTION-CAPTURE__multi-question-capture.md) · 主模型 Claude 3.5 Sonnet / 备模型 GPT-4o · 同一 Spring AI ChatModel · 同一 Resilience4j 主备切换。**配置 yml namespace 不同**: 本 satellite 用 `wrongbook.ai-judge.provider=anthropic` (与 M-MULTI 的 `wrongbook.multi-question.ai.provider` 隔离 · 允许 ops 独立切换两个场景)。

### §6.2 Judge Prompt 模板 (本 satellite 新写)

**System Prompt** (固定 · 锁字面 · 改字面需走 satellite 版本号):

```
你是教育场景作答判题助手。任务: 给定一道题 + 学生作答 → 输出判定等级与诊断。

输入:
- question: { stem, canonical_answer, kp_name, difficulty, steps }
- student_answer: { mode: 'photo'|'text', image_base64?: string, text?: string }

输出: 严格 JSON · 不许 markdown 包裹 · 不许解释文字。

规则:
1. MASTERED: 答案完全正确 + 关键步骤完整无误 (允许小笔误)
2. PARTIAL: 答案正确但步骤瑕疵 · 或答案接近正确但有小错 · 或步骤对但答案算错
3. FORGOT: 答案明显错误 · 完全空白 · 字迹无法识别 · 答非所问
4. confidence < 0.5: AI 不确定 (复杂多步解答 / 几何证明 / 字迹潦草 / 题型超出 AI 能力) → 上层走 SC-22 降级
5. 仅诊断 · 不引导学生 · reason 中性 · 不含 "你应该" 等指导语
6. 仅看与题目相关的内容 · 忽略草稿纸上的其他无关内容 (e.g. 涂鸦 / 个人信息)
```

**User Prompt** (per-call 动态拼装):

```
题目: {stem}
标准答案: {canonical_answer}
知识点: {kp_name} (难度 {difficulty}/5)
关键步骤: {steps.join("、")}

学生作答 (mode={mode}):
[image: base64-jpg-data] OR text: "{text}"

请判定学生作答 · 严格按 JSON schema 输出:
{
  "verdict":       "MASTERED" | "PARTIAL" | "FORGOT",
  "confidence":    0.0-1.0,
  "reason":        "≤100 字中文",
  "matched_steps": ["..."],
  "missed_steps":  ["..."]
}
```

**JSON Schema** (Spring AI `StructuredOutputConverter` 校验 · response 不符直接走 SC-22 降级):

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["verdict", "confidence", "reason"],
  "properties": {
    "verdict":       { "type": "string", "enum": ["MASTERED", "PARTIAL", "FORGOT"] },
    "confidence":    { "type": "number", "minimum": 0.0, "maximum": 1.0 },
    "reason":        { "type": "string", "maxLength": 200 },
    "matched_steps": { "type": "array", "items": { "type": "string" } },
    "missed_steps":  { "type": "array", "items": { "type": "string" } }
  }
}
```

### §6.3 同步 REST 而非 SSE (本 satellite 设计选择)

| 维度 | M-MULTI (split + N×4-step) | M-AI-ANSWER-JUDGE (单题 judge) |
|---|---|---|
| 总耗时 | 8-25s (N=3-20) | 5-8s (1 题 · 1 次 ChatModel 调用) |
| 中间事件数 | 多 (BATCH_SPLIT_DONE + N×STEP_DONE) | 0 (只有最终 verdict) |
| 用户感知 | 进度条 + N 列网格动画必要 | skeleton + 单一 loading 足够 |
| **决策** | **SSE** (需流式中间事件) | **同步 REST** (5-8s 单一响应 · 不上 SSE 复杂度) |

POST `/api/review/nodes/{nid}/judge` 是 sync REST · 5-8s 内返。前端 UI 用 skeleton loading 即可 (无需 EventSource 复杂度)。

### §6.4 阈值 SLA + 配置 yml (复用 M-MULTI §6.4 模式)

| 阈值 | 默认 | yml key | 处理 |
|---|---|---|---|
| `confidence` 接受 | ≥ 0.75 (高) / 0.5-0.75 (中 · 仍 banner 展示 · 但 reason 加 "AI 较有把握") | `wrongbook.ai-judge.confidence-accept=0.75` | banner 显示 verdict + 预选自评 |
| `confidence` 不确定 | < 0.5 (低) | `wrongbook.ai-judge.confidence-fallback=0.5` | banner 退化 SC-22 · 不预选 |
| 主超时 | 8s | `wrongbook.ai-judge.timeout-primary-ms=8000` | 切备 GPT-4o |
| 备超时 | 10s | `wrongbook.ai-judge.timeout-fallback-ms=10000` | banner 显示 "AI 判超时 · 请用自评" |
| 拍照入口开关 | true | `wrongbook.ai-judge.enable-photo-input=true` | false → 隐藏第 4 input tab (退回 master 现状 · kill switch) |
| 拍照原图 OSS 留存 | 30 天 | `wrongbook.ai-judge.image-retention-days=30` | OSS lifecycle rule 自动清理 (节省存储 · 见 §17 决策 #2) |

全部 `@RefreshScope` 可热更 · 不需重启服务。配置完整 yml 模板由 backend Coder 在 §17 决策 #5 spike 完成后补 `application-default.yml`。

---

## §10 API 增量 [REQUIRED]

### 10.17 新增 `POST /api/review/nodes/{nid}/judge` (核心)

```
POST /api/review/nodes/{nid}/judge
Headers: Authorization · X-User-Id · X-Idempotency-Key
Body:    { user_answer_image_key }    // 单字段 · 复用 master §10.1 OSS presign upload 后的 image_key
Resp:    200 {
           verdict: "MASTERED" | "PARTIAL" | "FORGOT",
           confidence: 0.0-1.0,
           reason: "≤100 字中文",
           status: "DONE" | "LOW_CONFIDENCE" | "TIMEOUT",
           matched_steps?: [],
           missed_steps?: []
         }
Err:     404 NODE_NOT_FOUND · 409 NODE_ALREADY_GRADED · 422 IMAGE_KEY_INVALID · 503 AI_SERVICE_UNAVAILABLE (双模型都不可用 · 前端走 SC-22 降级)
SLA:     P95 ≤ 8s (Sonnet) · P99 ≤ 12s (含 GPT-4o fallback) · 503 必在 18s 内返 (主 8s + 备 10s)
```

### 10.18 改造 `POST /api/review/nodes/{nid}/grade` (master §10.5 加 1 字段 · 向后兼容)

```
POST /api/review/nodes/{nid}/grade
Body 加字段: { ..., final_grade_source?: 'self' | 'ai_accepted' | 'ai_overridden' }   // 缺省 'self' (旧客户端无感)
Resp:    与 master §10.5 完全一致 · 仅 DB 多落 final_grade_source 列
```

**向后兼容**: 旧客户端不传 `final_grade_source` · 后端 default 'self' · 行为与 master 现状 100% 一致 (复习 P09 已上线用户无感)。

### 10.19 改造 `GET /api/review/nodes/{nid}/result` (P08 spec §5 L150 加字段 · 向后兼容)

```
GET /api/review/nodes/{nid}/result
Resp 加字段: {
   ...,
   aiJudge: null | {
     verdict, confidence, reason, status,
     matched_steps?, missed_steps?,
     final_grade_source: 'self' | 'ai_accepted' | 'ai_overridden'
   }
}
```

**复用说明**: 本 satellite 复用 master §10.1 OSS presign upload (`POST /api/file/presign`) + master §10.5 `:grade` 主体逻辑 + master §10.4 `GET /api/review/nodes/{nid}` 节点元信息接口 · 不新建独立认证 / OSS 通道。

---

## §12 部署增量 [REQUIRED]

归入 master §S5 (艾宾浩斯引擎 + 日历联动 · L2396) 之**后** · 与 M-MULTI satellite §12 S5.5 平级 · 新增 **S5.6 AI 辅助判题 pipeline** 阶段 (估 5 人天):

| 步骤 | 内容 | 验证 |
|---|---|---|
| S5.6.1 | DB migration V20260516_03 (wb_review_node 加 6 列 + 2 indexes) | `SELECT column_name FROM information_schema.columns WHERE table_name='wb_review_node'` 含 6 新列 |
| S5.6.2 | 后端: 新建 `AnswerJudgeService` (复用 ChatModel · 加 §6.2 prompt + JSON schema · 加 §6.4 阈值过滤) + `JudgeController.judge` (POST /:judge) + 改 `:grade` 加 `final_grade_source` 字段持久化 + 改 `:result` resp 加 `aiJudge` 字段 | E2E: POST :judge → 返 verdict · GET :result → 含 aiJudge 字段 |
| S5.6.3 | 后端: OSS lifecycle rule 配 30 天清理规则 (`wrongbook/answers/` prefix · expiration 30 days) · 配 Prometheus metric `wrongbook_judge_*` (见 §17 决策 #5) | OSS 控制台确认 lifecycle rule active · Grafana dashboard 有数据 |
| S5.6.4 | mp 前端: P08 加第 4 input tab + `<PhotoAnswerTab>` + `<AiJudgeBanner>` · 接 POST :judge + 改 grade body 加 final_grade_source · ui-kit 加 2 新组件 · 一并补 mockup testid drift | E2E spec SC-20/21/22 全绿 |
| S5.6.5 | RLHF 数据 outbox: SC-21 override 时落 RocketMQ topic `ai-judge.overridden` + outbox 表 + 5 分钟重试 (master §11 NFR 一致) · 数据用于后期 prompt 优化 (本期不消费 · 仅落库) | E2E: TC-21.01 后查 outbox 表有 1 条 + RocketMQ broker 收到消息 |

---

## §15.4 跨文档对照表 [REQUIRED]

本 satellite ↔ master + sibling satellite 的双向引用清单 (gen-biz-doc Step 4 ±5 行容差校验已通过):

| satellite §X | 引用对象 § | 行号 | 关系 |
|---|---|---|---|
| §0.2 改进 "判定信源" | master §7 艾宾浩斯 SM-2 自评驱动 | master L856-L867 | 不破坏 master §7 · 仅前置加 advisor 信源 |
| §0.2 改进 "作答输入方式" | P08 spec §4.1 `answerDraft.mode` | P08 spec L121 | mode 加第 4 值 'photo' |
| §0.2 改进 "数据沉淀" | master §4.5 `wb_review_node` | master L1559-L1580 | 加 6 列 · 不新表 |
| §1.1 角色 | master §2A.1 学生 | master L163-L177 | 复用 |
| §1.3 北极星 | master §1.4 关键业务指标 | master L84-L96 | 增量贡献 (复习准确性 / 学生留存) |
| §1.4 A.1 学生主体性 | master §7 自评驱动 SM-2 | master L856-L867 | 不剥夺学生最终决定权 |
| §2A.4 P08 差量卡 | master §2A.4 P08 既有卡 | master L556-L569 | 行为增强 · 不替换 |
| §2A.4 P08 input tabs | P08 spec §4.1 `answerDraft.mode` + P08 mockup `08_review_exec.html` | P08 spec L121 + mockup 现 287 行 | mode 加第 4 值 · mockup diff 加新 tab + AiJudgeBanner |
| §2B.20-22 SC-20/21/22 | master §2B.0 SC 卡 schema | master L725-L769 | 完全复用 schema (编排表 + QA 表) |
| §4.16 wb_review_node 加列 | master §4.5 wb_review_node 表 | master L1559-L1580 | ALTER 加 6 列 · 不新建 |
| §6.1 模型选择 | M-MULTI satellite §6.1 | M-MULTI L358-L364 | 复用 ChatModel + 主备切换 · 仅 yml namespace 不同 |
| §6.2 Judge Prompt | master §6 QuestionAnalyzer (单题 4-step) | master L1857-L1934 | **新写** · 任务不同 (判作答 vs 切题/解析) · 不影响 master 单题 pipeline |
| §6.4 阈值 SLA | M-MULTI satellite §6.4 | M-MULTI L426-L452 | 复用配置化 yml 模式 · 阈值数值独立 |
| §10.17 POST :judge | master §10 API 区 | master L2119-L2158 | 新增独立 endpoint · 复用 X-User-Id + idempotency header 约定 |
| §10.18 改 :grade | master §10.5 `:grade` (P08 spec L149) | P08 spec L149 | 加 1 字段 · 向后兼容 (default 'self') |
| §10.19 改 :result | P08 spec §5 GET :result | P08 spec L150 | resp 加 `aiJudge` 字段 · 向后兼容 (default null) |
| §12 S5.6 部署 | master §S5 艾宾浩斯 + 日历联动 | master L2396 | 加 S5.6 AI 判题 pipeline (5 人天) · 与 M-MULTI §S5.5 平级 |
| §17 决策点 #2 OSS 30 天 | master §11 NFR 合规 (PII / 数据留存) | master (需 grep §11) | 节省存储 + 合规收尾 |

---

## §16 Next Steps

落地本 satellite 后的下游动作 (按优先级排):

- **(用户决策 5 件 · 见 §17 开放问题 · 必须先答完才推进)**
- **✓ 2026-05-18 完成**: 已落 `design/mockups/wrongbook/20_review_exec_ai_judge.html` (gen-mockup skill v1 第 3 次实战 · 走"新建独立 mockup"模式而非 diff 模式 · 与 M-MULTI satellite 的 `19_result_multi.html` 同策略 · 原版 08 保留作为 fallback 视觉)
- **(决策后 1 周)** 触发 [gen-page-spec.md](../../.harness/skills/gen-page-spec.md): 为 P08 产 satellite-aware spec.md 增量 (`design/system/pages/P08-review-exec.spec.md` 加 §4 字段 / §5 API / §9 异常态 / §10 验收点 增量 · 不重写整 spec) — 复用 gen-page-spec v1.1 satellite biz fallback 能力
- **(决策后 2 周)** 触发 [gen-feature-list.md](../../.harness/skills/gen-feature-list.md) × 3: 为 SC-20/21/22 各产 feature_list (预估 SC-20: 5-7 task · SC-21: 3-4 task · SC-22: 3-4 task · 共 11-15 task)
- **(决策后 3 周)** 主 biz §15.5 已自动追加 1 行 cross-ref · 等 P1 立项确认后由 owner 把本 satellite 合 main 分支 (本 satellite Created=2026-05-16 · 真 P1 落地预计 2026-06 中 · 与 M-MULTI 同周期)
- **(可选 · backend Coder spike 期)** 跑 §17 决策 #5 spike: 20 个真实复习题 (覆盖选择/填空/单步运算/多步解答/几何证明 5 题型 × 4 题) × Claude Sonnet + GPT-4o 双模型 · 实测 judge prompt 准确率 · 输出 calibration 报告 + 决定是否调阈值 (`confidence-accept` 0.75 是否合理)

---

## §17 决策记录 (用户 2026-05-16 待拍板 · 5 决策点 · 沿用 sane defaults · 用户可在 v1.1 review 时修)

| # | 决策点 | 状态 | sane default | 备注 |
|---|---|---|---|---|
| 1 | **AI 建议自动预选自评按钮** | 沿默认 | **是** · AI 建议对应的自评按钮默认 selected · 学生 1 tap 即确认 (节省交互成本) | 反例 (禁): 学生还要先 Tap banner 「采纳」按钮再 Tap 自评按钮 = 2 tap (繁) · 沿默认即 1 tap |
| 2 | **拍照原图 OSS 留存时长** | 沿默认 | **30 天** · OSS lifecycle rule 自动清理 · 之后 `user_answer_image_key` 仍在 DB 但 OSS 404 静默 | 平衡: 太短 (7 天) 妨碍 RLHF 数据沉淀 · 太长 (180 天) 存储成本 + 合规风险 |
| 3 | **override 数据用于 RLHF prompt 优化** | 沿默认 | **是** · SC-21 override 时推 RocketMQ topic `ai-judge.overridden` + outbox · 本期仅落库 · P2 启动 prompt 优化 pipeline 时消费 | 反例 (禁): override 数据丢弃 · 形成 closed-loop 失败 |
| 4 | **题型白名单 (仅简单题型显示拍照按钮)** | 沿默认 | **否** · 全题型都显示拍照 · 由 AI confidence 自适应降级 (复杂题 confidence < 0.5 → SC-22 banner 退化) | 反例 (禁): UI 层做题型路由 (e.g. 仅 multiple-choice 题型显示拍照) · 增加业务条件分支复杂度 + 学生体验不一致 |
| 5 | **§6.4 阈值数值 spike calibration** | **P1 启动时 backend Coder spike 后定** | (sane defaults: confidence-accept=0.75 / confidence-fallback=0.5 / timeout 8s/10s) | 20 题 × 2 模型 spike · 实测后调阈值 · 与 M-MULTI §17 决策 #8 同期跑 · 共享 spike infra |

---

**修订表**

| 版本 | 日期 | owner | 摘要 |
|---|---|---|---|
| v1 | 2026-05-16 | user (gen-biz-doc 第 3 次实战 · P-WEEKLY-REVIEW + M-MULTI 之后) | 首版 · 方案 A 辅助式 (用户 2026-05-16 对话拍板 · vs 方案 B 替代 / C 试点) · 1 改造页 (P08 差量卡) · 3 SC (SC-20/21/22) · 1 DB 加列 (wb_review_node 加 6 列) · 1 新 API (POST :judge) + 2 改造 API (:grade 加 final_grade_source / :result 加 aiJudge) · §6 复用 M-MULTI §6.1 ChatModel + §6.4 阈值 yml 模式 · §6.2 judge prompt 完全新写 (任务不同) · §1.4 三大设计宪法 (A.1 学生主体性 / A.2 双信源溯源 / A.3 优雅降级) · §17 5 决策点 (1 个 P1 spike · 4 个 sane default · 等用户 review 修) · 借落地一并治理 P08 mockup testid drift |
| v1.1 | 2026-05-18 | user (SC20-T01 kickoff 时 Coder Phase 2 review 发现 master §4.5 paper-only · 用户拍板 B 路径) | §4.16 改: 由 "ALTER 加 6 列" 改为 "CREATE TABLE 一次落 14 master base + 6 satellite 增量 = 20 列 · 含 master 原 2 + satellite 新 2 = 4 indexes" · wb_review_node 表 owner 自 master §4.5 (paper-only) 变本 satellite V20260516_03 (实装) · 文件名 `V20260516_03__wb_review_node_create_with_ai_judge_columns.sql` · 加 §4.16 顶部决策记录 box 字面说明拒绝路径 A/C 理由 |
