# P08 · 复习执行 + AI 辅助判题 (ReviewExec + AiJudge) — Satellite-aware Spec

**Status**: Active
**Owner**: design + frontend + backend
**Last-updated**: 2026-05-18
**Mockup**: `design/mockups/wrongbook/20_review_exec_ai_judge.html` (NEW · 414 行 · 22 testid · gen-mockup skill v1 第 3 次实战 · 演示 SC-20 step 5 瞬间 AI 已判 PARTIAL · confidence 75% · 自评 PARTIAL 预选高亮)
**Biz refs**:
- **主源 (satellite)**: `biz/features/M-AI-ANSWER-JUDGE__ai-answer-judge.md` v1 (方案 A 辅助式) — §0.1 改进矩阵 + §1.4 三大宪法 + §2A.4 P08 差量卡 + §2B.20-22 SC-20/21/22 + §4.16 DB 加列 + §6 AI Backend 详设 + §10.17-19 API 增量 + §15.4 cross-ref
- **cross-ref 锚 (master)**: `biz/业务与技术解决方案_AI错题本_基于日历系统.md` §2A.4 P08 (L556-L569) · §4.5 wb_review_node (L1559-L1580) · §7 艾宾浩斯 SM-2 (L856-L867)
- **复用 (sibling satellite)**: `biz/features/M-MULTI-QUESTION-CAPTURE__multi-question-capture.md` v1.2 §6.1 Spring AI ChatModel (Claude Sonnet 主 / GPT-4o 备) · §6.4 阈值 yml 模式
**Master spec sibling**: `P08-review-exec.spec.md` (master 派生 · 366 行 · 含 SC-01/02/03/04 流程 · 纯自评流) — 本 spec **不替代** master sibling · 是 P08 在 satellite (方案 A) 启用时的 AI 辅助判题增量扩展 · 两 spec 共存 (yml `wrongbook.ai-judge.enable-photo-input` 切换)
**Related tasks**: feature_list.json `SC-20` / `SC-21` / `SC-22` (待 gen-feature-list 拆 · 预估 11-15 task)

---

## §1 页面目的

本 spec 描述 P08 启用 **M-AI-ANSWER-JUDGE 方案 A 辅助式** 后的行为增量。master sibling spec 已说明 P08 "先做、再揭、后评" 三段式状态机驱动 SM-2 节点推进 — 本 spec 在不动这一核心的前提下,引入**第二判定信源**: 学生可选**拍照上传作答** → 后端 `AnswerJudgeService` (复用 M-MULTI §6.1 ChatModel) 给出 `{verdict, confidence, reason}` → P08 渲染 `<AiJudgeBanner>` + 高亮 AI 建议对应的自评按钮 → **学生 1 tap 采纳或 override** (A.1 学生主体性铁律) → 后端记 `final_grade_source ∈ {self, ai_accepted, ai_overridden}` (A.2 双信源溯源) → AI 失败/超时/`confidence<0.5` 时退化为纯自评 (A.3 优雅降级)。**业务价值**: 降低"虚标 MASTERED 跳过复习"虚高自评率 · 提升艾宾浩斯节奏对真实掌握度的拟合精度 · override 数据进 RLHF outbox 形成 closed-loop prompt 优化路径。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区 (zone 划分 · 与 master sibling 增量对比)

```
┌──────────────────────────────────────────┐
│ statusbar 9:41                            │
├──────────────────────────────────────────┤
│ [< back] 复习执行·第 2 题 [AI 已判] [×]  │  topbar + 紫色 AI flag (新)
│ 25% · 预计 6 分钟  ▓▓▓▓░░░░░░             │  progress bar (4px · 复用)
├──────────────────────────────────────────┤
│ ⬤T2·第2次 数学·二次函数 [AI 已判 75%]    │  meta chips (3 复用 + 1 新紫色)
├──────────────────────────────────────────┤
│ ┌─ 错题回顾 · 原题 ───────────────────┐   │
│ │  已知 f(x)=x²-4x+3 ...                │   │  question hero (复用)
│ └─────────────────────────────────────┘   │
├──────────────────────────────────────────┤
│ • 你的作答 · 拍照  [已上传]               │  block-title (新 photo mode)
│ ┌─ photo thumb ───────────────────────┐   │
│ │  [缩略图: 学生手写解答]    [✓ 上传]   │   │  uploaded answer thumb (新)
│ │                          487 KB·9:41 │   │
│ └─────────────────────────────────────┘   │
│ [手写] [键盘] [公式] [📷 拍照 active]    │  input tabs (4 个 · 第 4 新)
├──────────────────────────────────────────┤
│ ┌─ ✓ 标准答案 · 已揭示 ──────────────┐   │
│ │ f(x)=(x-2)²-1 顶点(2,-1) x=2        │   │  reveal card (复用 · master)
│ └─────────────────────────────────────┘   │
├──────────────────────────────────────────┤
│ ┌── AI 助手建议 [advisory] ──────────┐   │
│ │  🪄 AI 判定: 部分掌握  [75% 把握]    │   │
│ │  ◐ PARTIAL · 答案正确·步骤 2/3      │   │  <AiJudgeBanner> ⭐ 核心新组件
│ │  诊断: 配方✓ 顶点✓ 对称轴✗ ...      │   │
│ │  [步骤 chips: ✓配方 ✓顶点 ✗对称轴]  │   │
│ │  [紫色 采纳建议] [我有不同看法]      │   │
│ └─────────────────────────────────────┘   │
├──────────────────────────────────────────┤
│ ⬤T0─⬤T1─◉T2─○T3─○T4─○T5─○T6              │  memory curve (6 节点 · 复用)
├──────────────────────────────────────────┤
│ 🪄 AI 建议: 部分掌握 · 1 tap 即采纳      │  AI hint ribbon (新 · 在 rating 上方)
│ 本次复习你的自评?     将用于更新记忆曲线  │
│ [✗ 未掌握] [◐ 部分 AI★] [✓ 已掌握]       │  grade buttons (3 · partial 预选高亮)
└──────────────────────────────────────────┘
```

**与 master sibling P08-review-exec.spec.md §2.1 相比的增量**:
- nav center 加 `[AI 已判]` 紫色 chip
- metarow 加第 4 紫色 chip `[AI 已判 75%]`
- work zone: paper canvas → **uploaded photo thumb** (拍照模式) · tools 从 3 个扩到 **4 个** (加 `[📷 拍照]`)
- reveal 与 nodes 之间**新加 `<AiJudgeBanner>` zone** (核心)
- rating 区上方加 **AI hint ribbon** (1 行紫色提示)
- partial 按钮**双层 ring + AI★ 角标** (预选高亮)

来源:satellite §2A.4 P08 差量卡 (15 维度) + mockup `20_review_exec_ai_judge.html` 视觉。

### 2.2 关键视觉锚 (mockup HTML 真 selector)

| Zone | DOM selector / class | 用途 | 来源 |
|---|---|---|---|
| Topbar AI flag | `.nav .ai-flag` | 紫色 "AI 已判" badge | mockup L189 |
| Meta AI chip | `.metarow .chip.purple` | "AI 已判 75%" | mockup L220 |
| Photo thumb | `.work .photo-thumb` | 上传成功的作答缩略图 + 元数据 | mockup L244-L270 |
| Photo input tab | `.tools .tool.prime[data-testid=ai-judge-input-tab-photo]` | 第 4 input tab · active 高亮 | mockup L300 |
| AI Judge Banner | `.aijb` (主容器 · linear-gradient #FFFFFF→#F7F4FF · 紫色 border-radius:14) | 核心新组件 · 含 head/verdict/reason/steps/actions 5 子区 | mockup L322-L385 |
| Verdict chip | `.aijb-verdict` | 主 verdict badge + label + hint | mockup L344-L351 |
| Confidence pill | `.aijb-head .conf-pill` | "75% 把握" 橙色 pill (右上) | mockup L338-L341 |
| Reason text | `.aijb-reason` | AI 诊断理由 (含 matched/missed 高亮) | mockup L353-L355 |
| Step chips | `.aijb-steps .aijb-step.ok/.miss` | 步骤完成度 (配方✓/顶点✓/对称轴✗) | mockup L357-L369 |
| Accept CTA | `.aijb-cta.accept` | 紫色主 CTA "采纳建议" | mockup L373-L375 |
| Override CTA | `.aijb-cta.override` | 灰次 CTA "我有不同看法" | mockup L376 |
| AI hint ribbon | `.rating .ai-hint` | rating 区上方紫色 hint banner | mockup L401-L404 |
| Partial preselected | `.rbtn.partial` (双 border + box-shadow) + `.rbtn.partial .ai-mark` | 自评按钮 AI 预选高亮 + AI★ 角标 | mockup L156-L160 + L417 |

来源:mockup HTML `20_review_exec_ai_judge.html` 真实 DOM。

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<AiFlag>` | frontend/packages/ui-kit (新) | `{visible: boolean}` | nav center 紫色 "AI 已判" badge · 仅 aiJudge.status === 'DONE' 时显示 |
| `<AiMetaChip>` | frontend/packages/ui-kit (新) | `{confidence: number}` | metarow 第 4 紫色 chip "AI 已判 {pct}%" |
| `<UploadedAnswerThumb>` | frontend/packages/ui-kit (新) | `{imageKey: string, sizeBytes: number, capturedAt: ISOString}` | 已上传作答缩略图 + 上传 badge + 元数据 · 120px 高 · 点击放大查看 (P1.5) |
| `<PhotoAnswerTab>` | frontend/packages/ui-kit (新) | `{active: boolean, onTap: () => void}` | 第 4 input tab · 与现有 3 mode tab 同栏 · active 时蓝色高亮 |
| `<AiJudgeBanner>` ⭐ | frontend/packages/ui-kit (新 · satellite 灵魂组件) | `{verdict, confidence, reason, matchedSteps[], missedSteps[], status, modelUsed, latencyMs, onAccept, onOverride}` | 完整 banner · 含 head (avatar+title+conf-pill) + verdict (badge+label+hint) + reason (text + matched/missed highlight) + step chips (ok/miss) + 2 CTA | 紫色 linear-gradient · radial blur 装饰 |
| `<AiHintRibbon>` | frontend/packages/ui-kit (新) | `{aiVerdict: 'MASTERED' \| 'PARTIAL' \| 'FORGOT'}` | rating 区上方 1 行紫色提示 · "AI 建议: {verdict_zh} · 1 tap 即采纳 · 或选其他 override" |
| `<GradeButtons>` (扩展 master 现有) | frontend/apps/h5/src/pages/P08 (改) | `{revealed, masteredEnabled, preselected: 'MASTERED' \| 'PARTIAL' \| 'FORGOT' \| null, onGrade}` | master sibling 已有 · 新加 `preselected` prop · 对应按钮加双 border + box-shadow + AI★ 角标 |
| `<AiJudgeEmpty>` | frontend/packages/ui-kit (新) | `{reason: 'TIMEOUT' \| 'LOW_CONFIDENCE' \| 'SERVICE_UNAVAILABLE'}` | AI 失败/超时降级 fallback · 默认 display:none · 不阻塞自评 |

**复用 master sibling 现有组件** (不重新定义): `<P08Topbar>` / `<MetaChips>` / `<QuestionHero>` / `<AnswerArea>` (mode 加第 4 值 'photo') / `<RevealCard>` / `<MemoryCurve>` / `<ExitConfirmSheet>`

来源:satellite §2A.4 P08 差量卡 + mockup HTML DOM 名 + frontend/packages/ui-kit 既有组件清单。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level State 绑定 (扩展 master sibling §4.1)

```typescript
// 在 master sibling P08 state 基础上加 4 个字段:
{
  ...masterSiblingState,              // sessionId, cursor, total, node, question, revealed, state, timer (master 复用)

  // ============ satellite 新增 ============
  answerDraft: {
    mode: 'handwrite' | 'keyboard' | 'formula' | 'photo';   // ← master 'handwrite'|'keyboard'|'formula' 扩第 4 值
    value: string | Blob | { imageKey: string };            // ← photo 模式时为 {imageKey}
  };

  userAnswerImageKey: string | null;  // 拍照路径专属 · OSS object key · null = 学生未走拍照路径

  aiJudge: null | {
    status:        'IDLE' | 'UPLOADING' | 'PENDING' | 'DONE' | 'TIMEOUT' | 'LOW_CONFIDENCE' | 'SERVICE_UNAVAILABLE';
    verdict:       'MASTERED' | 'PARTIAL' | 'FORGOT' | null;
    confidence:    number;            // 0.0-1.0
    reason:        string;            // ≤ 200 字中文
    matchedSteps:  string[];          // 学生答对的步骤
    missedSteps:   string[];          // 学生缺的步骤
    modelUsed:     string;            // 'claude-3.5-sonnet' | 'gpt-4o'
    latencyMs:     number;
    requestedAt:   ISOString;
    receivedAt:    ISOString | null;
  };

  finalGradeSource: 'self' | 'ai_accepted' | 'ai_overridden' | null;
  // null = 未 grade · 学生 tap 自评后必须落值:
  //   tap 后端口与 aiJudge.verdict 同 → 'ai_accepted'
  //   tap 后端口与 aiJudge.verdict 异 → 'ai_overridden'
  //   aiJudge === null 时 → 'self'
}
```

### 4.2 涉及的后端 Entity (扩展 master sibling §4.2)

**复用** master sibling 已说明的 `wb_review_plan` / `review_outcome` / `NodeLifecycleTracker` / `review_plan_outbox` / `calendar_event` — 全部不动。

**扩展** master `wb_review_node` 表加 6 列 (来源: satellite §4.16):

```sql
ALTER TABLE wb_review_node
  ADD COLUMN user_answer_image_key VARCHAR(512),    -- OSS key · null = 未走拍照
  ADD COLUMN ai_judge_verdict      VARCHAR(16),     -- MASTERED|PARTIAL|FORGOT · null = AI 未判
  ADD COLUMN ai_judge_confidence   DECIMAL(3,2),    -- 0.00-1.00
  ADD COLUMN ai_judge_reason       TEXT,            -- ≤200 字中文
  ADD COLUMN ai_judge_metadata     JSONB,           -- {model_used, prompt_version, token_cost_usd, latency_ms, status}
  ADD COLUMN final_grade_source    VARCHAR(16) NOT NULL DEFAULT 'self';  -- self|ai_accepted|ai_overridden

CREATE INDEX idx_wrn_judge_source ON wb_review_node(final_grade_source) WHERE final_grade_source != 'self';
CREATE INDEX idx_wrn_low_confidence ON wb_review_node(ai_judge_confidence) WHERE ai_judge_confidence < 0.5;
```

**新增 outbox event type** (来源: satellite §12 S5.6.5):
- `EVENT_AI_JUDGE_OVERRIDDEN` (推 RocketMQ `ai-judge.overridden` topic · 用于后期 RLHF prompt 优化 · 本期仅落库不消费)

**字段约束** (来源: satellite §4.16):
- `final_grade_source='ai_accepted'` ⟹ `ai_judge_verdict === grade` (应用层校验)
- `final_grade_source='ai_overridden'` ⟹ `ai_judge_verdict != grade`
- `user_answer_image_key` 非 null ⟹ `ai_judge_*` 4 列同时非 null (事务边界)
- OSS retention 30 天 (`wrongbook.ai-judge.image-retention-days=30` · lifecycle rule 自动清理)

来源:satellite §4.16 + satellite §6.4 字段约束 + frontend/packages/api-contracts (待 Coder 加 `AiJudgeDto` type)。

---

## §5 API 触点

> 字符级精准 path + method · 与 satellite §10.17-19 字面一致。

**复用 master sibling §5 已有 5 个接口** (P08-review-exec.spec.md L144-L150) — open / reveal / grade / GET node / GET result — 全部不动。**新增 / 改造 3 个**:

| # | Method | Path | Headers (req) | Body (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 (新) | POST | `/api/review/nodes/{nid}/judge` | `Authorization`, `X-User-Id`, `X-Idempotency-Key` | `{ user_answer_image_key: string }` | `200 { verdict: 'MASTERED'\|'PARTIAL'\|'FORGOT', confidence: number, reason: string, status: 'DONE'\|'LOW_CONFIDENCE'\|'TIMEOUT', matched_steps?: string[], missed_steps?: string[] }` | ≤ 8s (Sonnet) · ≤ 12s P99 (含 GPT-4o fallback) | 503 AI_SERVICE_UNAVAILABLE (双模型都不可用) → 前端走 SC-22 banner 退化为 "AI 不可用 · 请用自评" · 不阻塞 |
| 2 (改) | POST | `/api/review/nodes/{nid}/grade` | `X-User-Id`, `X-Idempotency-Key` | (master 现有字段) + `final_grade_source?: 'self' \| 'ai_accepted' \| 'ai_overridden'` (缺省 'self' · 向后兼容) | (master 现有 NodeResultResp · 不变) · 后端 DB 多落 `final_grade_source` 列 · `'ai_overridden'` 时同步推 RocketMQ `ai-judge.overridden` outbox | (master 现有 · 不变) | 旧客户端不传 → default 'self' · 行为 100% 一致 |
| 3 (改) | GET | `/api/review/nodes/{nid}/result` | `X-User-Id` | (查 · 跳 P09 时调) | (master 现有字段) + `aiJudge: null \| { verdict, confidence, reason, status, matched_steps?, missed_steps?, final_grade_source }` (向后兼容: AI 未判时为 null) | ≤ 300ms | 见 P09 §5 |

**错误码** (POST :judge):
- `404 NODE_NOT_FOUND` — nid 不存在或已 CANCELLED
- `409 NODE_ALREADY_GRADED` — node 已是 GRADED 态 (禁止再判)
- `422 IMAGE_KEY_INVALID` — `user_answer_image_key` 不属本学生 / OSS 404
- `503 AI_SERVICE_UNAVAILABLE` — 主备模型都不可用 · 必在 18s 内返 (主 8s + 备 10s)

**幂等键约束**: `X-Idempotency-Key` 必填 · 同 key + 同 nid 重放返同 response (后端 5 min 内缓存) · 防学生重复 tap 拍照 button 触发多次扣费。

**OSS upload** (本接口前置依赖): 复用 master §10.1 `POST /api/file/presign` → PUT OSS 直传 · 返 image_key · 与 master `wb_question` 拍题流共用通道。

来源:satellite §10.17 / §10.18 / §10.19 (字符级) + satellite §6.1 模型选择 + satellite §6.4 阈值 SLA。

---

## §6 状态机

### 6.1 扩展 master sibling §6.1 加 JUDGING 中间态 (仅拍照路径)

```
                       enter (deeplink/list)
                              │
                              ▼
   ┌────────────┐  POST /open ┌──────────┐  user starts writing  ┌───────────┐
   │ (page mnt) │────────────►│ READING  │──────────────────────►│ ANSWERING │
   └────────────┘   200 OK    └──────────┘   canvas/keyboard/photo └─────┬─────┘
                                                                       │
                                                          tap 「揭示答案」│
                                                          POST /reveal  │
                                                          200 OK        ▼
                                                                ┌───────────┐
                                                                │ REVEALED  │
                                                                └─────┬─────┘
                                                                      │
                              ┌───────────────────────────────────────┼───────────────┐
                              │ user 自评路径 (master 复用 · 无照片)  │ photo 路径 (新)│
                              │                                       ▼               │
                              │                              ┌─────────────────┐     │
                              │                              │  JUDGING (5-8s) │     │
                              │                              │  POST /:judge   │     │
                              │                              └────────┬────────┘     │
                              │                                       │              │
                              │            ┌──────────────────────────┼──────────┐   │
                              │            │ DONE                     │          │   │
                              │            │ (banner 渲染 · 预选)     │          │   │
                              │            │                          │ TIMEOUT  │   │
                              │            │                          │ /LOW_CONF│   │
                              │            │                          │ /503     │   │
                              │            │                          │          │   │
                              │            ▼                          ▼          │   │
                              │  ┌───────────────────┐     ┌──────────────────┐  │   │
                              │  │ JUDGED_DONE       │     │ JUDGE_FAILED     │  │   │
                              │  │ (PARTIAL 预选高亮)│     │ (banner 退化)    │  │   │
                              │  └─────────┬─────────┘     └─────────┬────────┘  │   │
                              │            │                          │          │   │
                              └────────────┴──────────────────────────┴──────────┘   │
                                                  │                                  │
                                                  │ tap ✗/◐/✓ (或 tap accept CTA)    │
                                                  │ POST /grade {grade, final_grade_source}
                                                  │                                  │
                                                  ▼                                  │
                                          ┌───────────┐                              │
                                          │  GRADED   │──nav P09                     │
                                          └───────────┘                              │
                                                  ▲                                  │
                                                  └──────────────────────────────────┘
```

### 6.2 状态转移规则 (扩展 master sibling §6.1 加 5 行 satellite 新规则)

**复用 master sibling §6.1 全部 7 行规则** — open/reading/answering/reveal/grade/exit_confirm 不动。**新增 satellite 5 行**:

| From | To | Trigger | Side effect | 关联 task |
|---|---|---|---|---|
| ANSWERING | (sub-state: photo.UPLOADED) | 学生切 photo tab + 拍照 + OSS upload 完成 | `userAnswerImageKey` 落 state · `wb_judge_photo_upload_done{nid, ms}` 埋点 | SC-20 step 3 (T?? 待 gen-feature-list) |
| REVEALED + (photo.UPLOADED) | JUDGING | 自动触发 `POST /:judge` after reveal+upload 都 done | banner skeleton "AI 正在判题..." · `aiJudge.status='PENDING'` | SC-20 step 4 |
| JUDGING | JUDGED_DONE | `POST /:judge` 200 + `confidence ≥ 0.5` | banner 渲染 (verdict/confidence/reason/steps/CTA) · `<GradeButtons preselected={aiJudge.verdict}>` 对应按钮高亮 · `aiJudge.status='DONE'` | SC-20 step 5 |
| JUDGING | JUDGE_FAILED | `POST /:judge` 超时 18s / `confidence<0.5` / 503 / response schema 校验失败 | banner 退化 `<AiJudgeEmpty reason={cause}>` · 不预选自评按钮 · `aiJudge.status` ∈ {TIMEOUT, LOW_CONFIDENCE, SERVICE_UNAVAILABLE} | SC-22 step 1-2 |
| JUDGED_DONE / JUDGE_FAILED | GRADED | tap accept CTA / tap 任一自评按钮 + 「确认提交」 | `POST /:grade body{grade, timeSpentMs, final_grade_source}` · `final_grade_source` 按规则计算 (见 §4.1) · 复用 master §10.5 EVENT_GRADED outbox · `'ai_overridden'` 时额外推 `EVENT_AI_JUDGE_OVERRIDDEN` outbox | SC-20 step 6 / SC-21 step 3-4 |

### 6.3 final_grade_source 计算规则 (A.2 双信源溯源铁律)

```typescript
function computeFinalGradeSource(grade, aiJudge): 'self' | 'ai_accepted' | 'ai_overridden' {
  if (aiJudge === null || aiJudge.status !== 'DONE') return 'self';     // AI 未判 / 失败 → self
  if (aiJudge.verdict === grade)                       return 'ai_accepted';  // 学生选与 AI 同 → 采纳
  return 'ai_overridden';                                                 // 学生选与 AI 异 → override
}
```

### 6.4 禁止行为 (扩展 master sibling §6.4 加 2 条 satellite 铁律)

**复用 master sibling §6.4 全部 3 条** — 揭示前不能看答案 / × 弹二次确认 / revealed 后不能 tap 已掌握。**新增 satellite 2 条**:

4. **AI 判结果不允许直接落 grade (A.1 学生主体性铁律)**: `POST /:judge` 仅返 verdict · **不允许 backend 自动调 `POST /:grade`** · 任何 grade 写库必经学生主动 tap (UI 或 accept CTA · 两者等价) · 后端 `:judge` 接口不接受 `auto_grade=true` 参数 · 不允许此参数存在。
5. **AI confidence ≥ 0.95 不允许跳过自评 UI**: 即使 AI 极高把握 · 学生仍必须 tap 任一自评按钮 · 不允许"AI 高把握 → 静默落 grade 跳 P09"。

来源:satellite §1.4 三大宪法 + satellite §2A.4 P08 差量卡状态集 + satellite §2B.20 关键断言点。

---

## §7 跳转

**完全复用 master sibling §7** (P08-review-exec.spec.md L236-L250) — 入口 (P07/P09/推送 deeplink/P06) + 出口 (P09/P-HOME/P00/P07) 全部不变。AI 辅助判题不引入新跳转。

唯一变化:出口 P09 (`/review/done/{nid}`) 时 GET `:result` 响应增 `aiJudge` 字段 (见 §5 #3) · P09 spec 后续可决定是否展示 AI 判结果 (本期 P09 spec 不变 · aiJudge 字段为 P1.5 P09 展示预留)。

---

## §8 Wire format (SSE / WebSocket 事件)

本页**无 SSE / WS 通道** (与 master sibling §8 一致)。AI 判题走 **同步 REST** 而非 SSE — 单题 5-8s 总耗时 + 0 中间事件 · skeleton loading UI 足够 · 不上 SSE 复杂度 (来源: satellite §6.3 设计决策)。

**与 M-MULTI satellite 对比** (M-MULTI P03 用 SSE · 因 N×4-step 多事件):

| 维度 | M-MULTI P03 拍题分析 | M-AI-ANSWER-JUDGE P08 判题 |
|---|---|---|
| 总耗时 | 8-25s (N=3-20) | 5-8s (1 题 · 1 次 ChatModel 调用) |
| 中间事件数 | 多 (BATCH_SPLIT_DONE + N×STEP_DONE) | 0 |
| 通道 | **SSE** (需流式) | **同步 REST** (单一响应) |

---

## §9 异常 & 降级

**复用 master sibling §9 全部 9 行** (P08-review-exec.spec.md L264-L275) — 节点已取消 / token 过期 / deeplink 越权 / grade 5xx / FORGOT 级联失败 / 部分批建失败 / 连续 FORGOT / T0 FORGOT / DOM 绕过 / × 强退 — 全部不动。**新增 satellite 6 行**:

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| OSS 上传失败 | 拍照后 PUT OSS 5xx / 网络中断 | Toast "上传失败 · 请重试" + 自动切回上一个 input tab (handwrite/keyboard/formula) | 0 wb_review_node 字段被改 · 不调 `:judge` · 学生可重试拍照或走自评 | TC-20.03 |
| AI judge 主超时 (8s) | Sonnet 8s 内未返 | 后端自动切 GPT-4o · banner 仍 skeleton "AI 正在判题..." | 主备切换由 Resilience4j 自动 · 前端无感 | (内嵌 SC-20) |
| AI judge 双模型都超时 (18s) | 主 8s + 备 10s 全失败 | banner 退化 `<AiJudgeEmpty reason='TIMEOUT'>`: "AI 判超时 · 请用自评" · 自评按钮不预选 | `aiJudge.status='TIMEOUT'` · `ai_judge_*` 落 metadata 但 verdict=null · 学生纯自评 (与 master 一致) · 埋点 `wb_judge_ai_timeout{nid, ms:18000}` | TC-22.02 |
| AI 低置信度 (`confidence<0.5`) | `:judge` 200 但 confidence 不达阈 | banner 退化为 "🤔 AI 不太确定 · 请按你的理解自评" · 自评按钮不预选 | `aiJudge.status='LOW_CONFIDENCE'` · 5 列 metadata 全落库 (含 confidence=0.xx) · 用于后期 "AI 不擅长题型" dashboard 分析 | TC-22.01 |
| AI 503 (双模型不可用) | 后端 AnswerJudgeService 完全不可用 | banner 退化 `<AiJudgeEmpty reason='SERVICE_UNAVAILABLE'>` | `aiJudge.status='SERVICE_UNAVAILABLE'` · 学生纯自评 · 监控告警 `ai-judge.service.down` | TC-22.02 变体 |
| RLHF outbox 推送失败 (override 路径) | SC-21 step 5 RocketMQ broker 不可用 | UI 不感知 (grade 流不阻塞) | outbox 加重试标记 · 5 分钟后重试 · 监控告警 `ai-judge.outbox.fail` · 数据最终一致性 | TC-21.02 |

来源:satellite §2A.4 P08 差量卡「异常态」+ satellite §2B.20-22 各 SC TC 异常用例 + satellite §6.4 阈值 SLA。

---

## §10 验收点 (TC → AC 映射)

> 反向校验:每行 TC 必须能在 `biz/features/M-AI-ANSWER-JUDGE__ai-answer-judge.md` §2B.20-22 grep 命中 (skill §4 反作弊红线 #3)。**复用 master sibling §10 全部 12 行** (TC-01.01 / TC-01.06 / TC-02.01 / TC-02.02 / TC-02.05 / TC-04.01-05 / TC-03.04) — 不动。**新增 satellite 9 行**:

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-20.01 | 正常 (SC-20 happy) | 学生在 P08 节点 nid=500 已 REVEALED · 网络稳定 · `wb_review_node` 已 migration 6 新列 · AnswerJudgeService 已部署 | 完成 SC-20 步骤 1-7 (拍照 → upload → :judge 返 PARTIAL 75% → tap 「采纳建议」) | DB: `wb_review_node(nid=500).status=GRADED, ai_judge_verdict='PARTIAL', ai_judge_confidence=0.75, ai_judge_reason 非空, user_answer_image_key 非空, final_grade_source='ai_accepted'` · master §7 SM-2 PARTIAL 路径执行 (ease -0.2) · 跳 P09 ≤ 15s 总时长 | (待 gen-feature-list) |
| TC-20.02 | 正常 (向后兼容) | 同 TC-20.01 但学生选 handwrite mode (不拍照) | 揭示后直接 tap PARTIAL 自评 (不调 `:judge`) | DB: `wb_review_node.status=GRADED, ai_judge_*=null, final_grade_source='self'` · 与 master 现状 100% 一致 (master sibling spec.md 全部行为不变) | (待 gen-feature-list) |
| TC-20.03 | 边界 (OSS 失败) | 学生切 photo tab + 拍照 + 网络抖动 | OSS PUT 失败 | Toast "上传失败 · 请重试" + 自动切回 handwrite tab · 0 wb_review_node 字段被改 · 学生可重试或走自评 | (待 gen-feature-list) |
| TC-21.01 | 正常 (SC-21 override) | SC-20 step 1-5 完成 · banner 显示 verdict=MASTERED · confidence=0.85 · 学生想 "答案对是因为我猜的" | tap 底部 FORGOT 按钮 + 「确认提交」 | DB: `final_grade_source='ai_overridden', ai_judge_verdict='MASTERED', grade='FORGOT'` · master §7 SM-2 FORGOT 路径执行 (ease reset 2.5 · T0-T6 整 plan 重排 7 节点) · RocketMQ `ai-judge.overridden` outbox 含 1 条 | (待 gen-feature-list) |
| TC-21.02 | 异常 (outbox 失败) | 同 TC-21.01 但 step 5 RocketMQ broker 不可用 | step 5 异步推送 | grade 流不受影响 (学生体验 100% OK · 已跳 P09) · outbox 加重试标记 · 5 分钟后重试 · 监控告警 `ai-judge.outbox.fail` | (待 gen-feature-list) |
| TC-21.03 | 边界 (中间值 override) | AI 判 MASTERED · 学生 tap PARTIAL (中间值 · 非完全相反 FORGOT) | step 2-5 | DB: `final_grade_source='ai_overridden', ai_judge_verdict='MASTERED', grade='PARTIAL'` · RLHF outbox 仍推 (任何 ai_verdict != grade 都算 override) | (待 gen-feature-list) |
| TC-22.01 | 异常 (low confidence) | SC-20 step 1-4 完成 · AI 返 `confidence=0.32` | 完成 SC-22 步骤 1-5 | banner 退化文案 "🤔 AI 不太确定 · 请按你的理解自评" · 自评按钮无预选 · 学生独立选 PARTIAL · DB: `final_grade_source='self', ai_judge_confidence=0.32 (落库), grade='PARTIAL'` · master §7 流程不受影响 | (待 gen-feature-list) |
| TC-22.02 | 边界 (双模型超时) | Sonnet 8s + GPT-4o 10s 全失败 (总 18s) | step 5 sync REST 失败 | banner 显示 `<AiJudgeEmpty reason='TIMEOUT'>` "AI 判超时 · 请用自评" · 不预选 · `ai_judge_*` = null · `final_grade_source='self'` · 学生纯自评 (与 master 100% 一致) · 埋点 `wb_judge_ai_timeout{nid, ms:18000}` | (待 gen-feature-list) |
| TC-22.03 | 安全 (PII 不残留) | 学生拍含 PII 草稿纸 (e.g. 角落写家庭住址) | step 1-5 | AI 判 prompt §6.2 含 "仅看作答 · 忽略与题目无关的内容" 约束 · OSS 30 天后自动清理 (lifecycle rule · satellite §17 决策 #2) · 不留 PII 长期残留 | (待 gen-feature-list) |

**TC 来源真实性反向校验**:
```bash
grep -E "^\| TC-2[012]\.[0-9]" biz/features/M-AI-ANSWER-JUDGE__ai-answer-judge.md
# 应命中 9 行 (TC-20.01-03 / TC-21.01-03 / TC-22.01-03)
```

来源:satellite §2B.20 QA 表 (3 TC) + §2B.21 QA 表 (3 TC) + §2B.22 QA 表 (3 TC) = 9 TC · 全部字面引用 · 不 fabricate (满足 skill §4 反作弊红线 #3)。

---

## §11 性能预算

**复用 master sibling §11 全部 9 行** (P08-review-exec.spec.md L306-L315) — 不动。**新增 satellite 5 行**:

| 操作 | P95 budget | 来源 |
|---|---:|---|
| 拍照 OSS 上传 (image ≤ 500KB · 4G 网络) | ≤ 2s | satellite §2A.4 P08 差量卡「性能预算」 |
| `POST /:judge` Sonnet (主) | ≤ 8s P95 · ≤ 5s P99 | satellite §10.17 SLA |
| `POST /:judge` GPT-4o (备 · 主超时切) | ≤ 10s P95 · ≤ 7s P99 | satellite §6.4 阈值 SLA |
| 双模型都失败返 503 | ≤ 18s (主 8s + 备 10s · hard timeout) | satellite §10.17 错误码 SLA |
| `<AiJudgeBanner>` 首次渲染 (从 :judge 200 到 banner 完整可见) | ≤ 150ms | satellite §2A.4 P08 差量卡「性能预算」 |

来源:satellite §2A.4 P08 「性能预算」+ satellite §6.4 + §10.17 SLA 字面。

---

## §12 埋点事件

**复用 master sibling §12 全部 9 行** (P08-review-exec.spec.md L324-L333) — wb_exec_open/writing_start/reveal/grade/exit_confirm/exit/skip/deeplink_forbidden/push_click — 全部不动。**新增 satellite 8 行**:

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `wb_judge_photo_capture` | 学生 tap 拍照 + 触发系统相机 | `{nid, qid}` | satellite §2A.4 P08 差量卡「埋点事件」 |
| `wb_judge_photo_upload_done` | OSS PUT 100% | `{nid, ms, bytes}` | satellite §2A.4 |
| `wb_judge_ai_request` | 调 `POST /:judge` | `{nid, mode: 'photo' \| 'text'}` | satellite §2A.4 |
| `wb_judge_ai_done` | `:judge` 200 返 | `{nid, verdict, confidence, ms, model_used}` | satellite §2A.4 |
| `wb_judge_user_accept` | 学生 tap 「采纳建议」CTA 或 与 AI 同的自评按钮 | `{nid, ai_verdict}` | satellite §2A.4 + SC-20 step 6 |
| `wb_judge_user_override` | 学生 tap 与 AI 不同的自评按钮 (含中间值) | `{nid, ai_verdict, user_verdict}` ⚠️ 双 verdict 必填 · 用于后期 RLHF calibration | satellite §2A.4 + SC-21 step 2 |
| `wb_judge_ai_timeout` | `:judge` 双模型超时 (18s) | `{nid, ms: 18000}` | satellite §2A.4 + SC-22 TC-22.02 |
| `wb_judge_ai_low_confidence` | `:judge` 200 但 confidence < 0.5 | `{nid, confidence: 0.xx}` | satellite §2A.4 + SC-22 TC-22.01 |

来源:satellite §2A.4 P08 差量卡「埋点事件」字面 + satellite §2B.20-22 SC 编排表埋点列。

---

## §13 testid 表 (反向抽 mockup `20_review_exec_ai_judge.html` · 22 个)

> **drift fix 任务**: 本 22 个 testid 当前**未注册到** `frontend/packages/testids/src/index.ts` · frontend Coder 实装时必须按本表补到该文件 (建议 namespace `TEST_IDS.p08AiJudge.*`) · 待 gen-feature-list 拆 task 时单列 1 个 testid 注册 task。

| testid | 用途 | 出现位置 (mockup) | E2E 引用 (待) |
|---|---|---|---|
| `p-review-exec-ai-judge-root` | 页面根容器 | `20_review_exec_ai_judge.html` L181 (`.phone[data-testid="p-review-exec-ai-judge-root"]`) | t20/t21/t22 beforeEach mount |
| `ai-judge-back` | 返回按钮 (← 复习) | mockup L196 (`.nav .back`) | t20 (复用 master sibling t10 等价) |
| `ai-judge-progress` | 顶部进度条 (25%) | mockup L210 (`.nav .ptrack`) | t20 (progress VRT) |
| `ai-judge-question-card` | 题干 Hero 卡 | mockup L227 (`.qcard`) | t20 step 1 (题干渲染) |
| `ai-judge-photo-thumb` | 已上传作答缩略图容器 | mockup L243 (`.work .photo-thumb`) | t20 step 3 (上传成功视觉) |
| `ai-judge-input-tab-handwrite` | 输入 tab 1 (手写) | mockup L274 (`.tool[href=08_review_exec.html]`) | t20 切 tab 回 master sibling 流 |
| `ai-judge-input-tab-keyboard` | 输入 tab 2 (键盘) | mockup L281 | t20 切 tab |
| `ai-judge-input-tab-formula` | 输入 tab 3 (公式) | mockup L288 | t20 切 tab |
| `ai-judge-input-tab-photo` | 输入 tab 4 (拍照 · NEW · active) | mockup L295 (`.tool.prime[data-testid=ai-judge-input-tab-photo]`) | t20 step 1 (默认 photo tab active) |
| `ai-judge-reveal` | 揭示答案卡 (复用 master 视觉) | mockup L307 (`.reveal`) | t20 (REVEALED 态 reveal 渲染) |
| `ai-judge-banner` ⭐ | AiJudgeBanner 主容器 (核心) | mockup L322 (`.aijb`) | t20 step 5 (banner 渲染断言) · t22 (退化态断言) |
| `ai-judge-confidence` | 置信度 pill (75% 把握) | mockup L338 (`.aijb-head .conf-pill`) | t20 step 5 (confidence 文字断言) |
| `ai-judge-verdict-chip` | verdict 标签 (◐ PARTIAL) | mockup L344 (`.aijb-verdict`) | t20 step 5 (verdict 断言) |
| `ai-judge-reason` | AI 诊断理由文本 | mockup L353 (`.aijb-reason`) | t20 step 5 (reason 文本断言) |
| `ai-judge-cta-accept` | 紫色主 CTA "采纳建议" | mockup L373 (`.aijb-cta.accept`) | t20 step 6 (tap accept → :grade 200) |
| `ai-judge-cta-override` | 灰次 CTA "我有不同看法" | mockup L376 (`.aijb-cta.override`) | t21 (tap override 转入自评 flow) |
| `ai-judge-nodes-timeline` | T0-T6 7 节点时间线 (复用 master 视觉) | mockup L383 (`.nodes`) | t20 (T2 current 高亮 pulse) |
| `ai-judge-grade-forgot` | 自评 1 未掌握 (红) | mockup L411 (`.rbtn.forgot`) | t21 (tap FORGOT override AI MASTERED) |
| `ai-judge-grade-partial` | 自评 2 部分 (橙 · AI 预选高亮) | mockup L416 (`.rbtn.partial`) | t20 step 6 (预选 ring 视觉断言) |
| `ai-judge-grade-master` | 自评 3 已掌握 (绿) | mockup L422 (`.rbtn.master`) | t21 (tap MASTERED override AI PARTIAL) |
| `ai-judge-rating-source-hint` | rating 区上方 AI hint banner | mockup L401 (`.rating .ai-hint`) | t20 step 5 (hint 文本 "AI 建议: 部分掌握" 断言) |
| `ai-judge-empty` | AI 失败 fallback (默认 hidden) | mockup L390 (`.empty-hero[data-testid=ai-judge-empty]`) | t22 (timeout / low_confidence / 503 时 display:block) |

**真实性反向校验**:
```bash
grep -c 'data-testid="ai-judge-\|p-review-exec-ai-judge-root' design/mockups/wrongbook/20_review_exec_ai_judge.html
# 应 = 22
```

来源:mockup `20_review_exec_ai_judge.html` 真实 `data-testid` grep + satellite §2A.4 P08 差量卡「核心组件」(组件名映射 testid) + master sibling testid 命名空间约定 (但本 22 个走独立 namespace `p08AiJudge.*` · 避免污染 master `p08.*`)。

---

## §14 i18n key

**复用 master sibling §14 全部 20 行** (P08-review-exec.spec.md L373-L391) — exec.title / subtitle / progress.eta / chip.tLevel / qcard.kicker / answer.handwrite/keyboard/formula / revealBtn / reveal.title / reveal.stepN / grade.forgot/partial/mastered / grade.masteredDisabledTip / exitSheet.* — 全部不动。**新增 satellite 14 行**:

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `exec.answer.photo` | 拍照 | Photo | mode tab 4 (新) |
| `exec.flag.aiJudged` | AI 已判 | AI Judged | nav center 紫色 chip |
| `exec.chip.aiConfidence` | AI 已判 {pct}% | AI {pct}% sure | metarow 第 4 chip |
| `exec.photo.uploading` | 上传中... {pct}% | Uploading... {pct}% | OSS 上传进度 |
| `exec.photo.uploaded` | 上传成功 | Uploaded | 缩略图 badge |
| `exec.photo.uploadFailed` | 上传失败 · 请重试 | Upload failed · retry | OSS 失败 toast |
| `exec.judge.thinking` | AI 正在判题... | AI thinking... | banner skeleton loading |
| `exec.judge.verdict.mastered` | 已掌握 | Mastered | banner verdict label (MASTERED) |
| `exec.judge.verdict.partial` | 部分掌握 | Partial | banner verdict label (PARTIAL) |
| `exec.judge.verdict.forgot` | 未掌握 | Forgot | banner verdict label (FORGOT) |
| `exec.judge.cta.accept` | 采纳建议 | Accept | 紫色主 CTA |
| `exec.judge.cta.override` | 我有不同看法 | I disagree | 灰次 CTA |
| `exec.judge.lowConfidence` | 🤔 AI 不太确定 · 请按你的理解自评 | 🤔 AI unsure · please self-rate | banner 退化文案 (confidence<0.5) |
| `exec.judge.timeout` | AI 判超时 · 请用自评 | AI timeout · please self-rate | banner 退化文案 (双模型超时) |
| `exec.judge.serviceUnavailable` | AI 暂不可用 · 请用自评 | AI unavailable · please self-rate | banner 退化文案 (503) |
| `exec.rating.aiHint` | 🪄 AI 建议: <em>{verdict}</em> · 1 tap 即采纳 · 或选其他 override | 🪄 AI suggests: <em>{verdict}</em> · 1 tap to accept | rating 区 AI hint ribbon |

来源:satellite §2A.4 P08 差量卡「i18n Key」字面 + mockup `20_review_exec_ai_judge.html` 视觉文案。

---

## §15 关联与影响

- **上游 spec**:
  - **master sibling** `P08-review-exec.spec.md` (本 spec 是其 satellite 启用时的增量扩展 · 两 spec 共存 · 由 yml `wrongbook.ai-judge.enable-photo-input=true/false` 切换)
  - master sibling 所列全部上游不变 (P07 / P09 / 推送 deeplink / P06)
- **下游 spec**:
  - P09 (`/review/done/{nid}`) — GET `:result` 响应增 `aiJudge` 字段 · P09 后续可决定是否展示 AI 判结果 (本期 P09 spec 不变 · 字段为 P1.5 P09 展示预留)
  - P-HOME / P00 / P07 不变 (master sibling §7)
- **关联 task**: feature_list.json `SC-20` (T?? happy) · `SC-21` (T?? override + RLHF outbox) · `SC-22` (T?? 降级) — 待 gen-feature-list 拆 (预估 11-15 task)
- **关联 audit**: (本 satellite 暂无 audit · 待 P1 启动 Phase 0 完成后产)
- **关联 SC**: SC-20 (拍照 → AI → 采纳 happy) · SC-21 (AI 判错 · 学生 override · RLHF) · SC-22 (AI 不确定 · banner 退化 · 优雅降级)
- **关联 mockup**: `design/mockups/wrongbook/20_review_exec_ai_judge.html` (NEW · 414 行 · 22 testid · 不动原版 `08_review_exec.html`)
- **关联 satellite biz**: `biz/features/M-AI-ANSWER-JUDGE__ai-answer-judge.md` v1 (主源 · 468 行 · §6 AI Backend 详设 + §17 5 决策点)
- **复用 sibling satellite**: `biz/features/M-MULTI-QUESTION-CAPTURE__multi-question-capture.md` v1.2 §6.1 ChatModel + §6.4 阈值 yml 模式 (yml namespace `wrongbook.ai-judge.*` 与 `wrongbook.multi-question.*` 隔离 · 允许 ops 独立切换)
- **关联架构**:
  - 复用 master sibling §15 已列全部 (design/arch/s5-review-plan.md / ADR 0013 / B02 决策 A)
  - 新加 RLHF outbox 设计 (RocketMQ topic `ai-judge.overridden` · 5 min 重试 · 最终一致性 · 见 satellite §12 S5.6.5)
- **drift fix 任务清单** (待 frontend Coder P1 启动时做):
  - `frontend/packages/testids/src/index.ts` 加 22 个 `TEST_IDS.p08AiJudge.*` testid (本 spec §13 反向抽 mockup)
  - `frontend/packages/i18n/` 加 14 个 `exec.answer.photo` / `exec.judge.*` 等 i18n key (本 spec §14)
  - `frontend/packages/api-contracts/` 加 `AiJudgeDto` type + 改 `GradeReq` 加 `final_grade_source` 字段 + 改 `NodeResultResp` 加 `aiJudge` 字段 (本 spec §5)
  - `frontend/packages/ui-kit/` 加 7 新组件 (`<AiFlag>` / `<AiMetaChip>` / `<UploadedAnswerThumb>` / `<PhotoAnswerTab>` / `<AiJudgeBanner>` / `<AiHintRibbon>` / `<AiJudgeEmpty>` · 本 spec §3)
