# P04 · AI 分析结果 (Result)

**Status**: Active
**Owner**: design + frontend + backend (wrongbook-service / ai-analysis-service)
**Last-updated**: 2026-05-14
**Mockup**: design/mockups/wrongbook/04_result.html
**Biz refs**: biz/业务与技术解决方案_AI错题本_基于日历系统.md §2A.4 P04 规格卡 (L500-513) + §2B.2 SC-01 步 7-11 + §2B.2 TC-01.04 / TC-01.05
**Related tasks**: feature_list.json SC-01 T04 (analyze-done-to-result) + T05 (result-save-to-wrongbook)

---

## §1 页面目的

让学生看懂「错在哪 / 对的是什么 / 为什么 / 下次怎么做」——把 AI 4 步流水线产出的 `analysis_result` 翻译成可读、可校对、可保存的"错题档案首页"。是 SC-01 黄金路径的转化关卡：学生通过该页 tap 蓝色 CTA 才会触发 review-plan 落 plan+7 nodes 与日历批量同步。低置信度（`confidence < 0.6`）场景下，本页负责把 AI 不确定性 surface 给学生并强制二次确认（TC-01.04）。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区 (zone 划分)

```
┌─────────────────────────────┐  状态栏 (54px iOS chrome)
├─────────────────────────────┤  Nav  「分析」back + 「分析完成 4.2s」(96px)
├─────────────────────────────┤  [Low-conf 黄条]   ← conf<0.6 才渲染 (TC-01.04)
├─────────────────────────────┤  Hero  题干 + 公式 + 缩略图 (96px 高)
├─────────────────────────────┤  Answers  ✗ 你的作答 / ✓ 正确答案 双列
├─────────────────────────────┤  错因诊断  红条卡 (CONCEPT · 概念混淆)
├─────────────────────────────┤  3 步解法 stepper
├─────────────────────────────┤  KP chips + 难度 ★
├─────────────────────────────┤  艾宾浩斯 T1-T6 6 节点预告卡
├─────────────────────────────┤  CTA  [手动修正] [保存并开启复习]   (108px dock)
└─────────────────────────────┘  TabBar (84px · 拍题 tab active)
```

来源：biz §2A.4 「布局分区」(L505) + mockup HTML 视觉验证 (04_result.html L155-242)。

### 2.2 关键视觉锚 (mockup HTML 真 selector)

| Zone | DOM selector / class | 用途 |
|---|---|---|
| Root | `[data-testid="p04-root"]` | 页面根 · `data-mood="B"` (pure-warm) |
| Nav | `[data-testid="p04-navbar"]` | 返回 + 标题"分析完成 4.2s" |
| Low-conf banner | `[data-testid="result-lowconf-banner"]` | 黄条 (`isLowConf=true` 才渲染) |
| Hero | `[data-testid="p04-question-hero"]` | 缩略图 + 题干 + 公式 |
| Answers | `[data-testid="p04-answers-row"]` | 双列网格 wrong / right |
| Reason | `[data-testid="p04-reason-card"]` | 红左条 + 红方块图标 |
| Steps | `[data-testid="p04-solution-stepper"]` | 3 步带蓝圆角徽 |
| KP + 难度 | `[data-testid="p04-meta-chips"]` | 紫色 chip + 5 ★ |
| 6 节点预告 | `[data-testid="memory-curve"]` | T1..T6 进度条 + 日期 |
| CTA dock | `[data-testid="p04-save-cta"]` (legacy) / `result-save-btn` (E04c) | 蓝色"保存并开启复习" |
| Confirm modal | `[data-testid="result-confirm-modal"]` | 低置信度强制确认 |

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<Skeleton>` | `Result/index.tsx` 局部 | — | LOADING 态骨架屏（5 块） |
| `<QuestionHero>` | inline JSX | `{stem, formula, kicker, thumbnailUrl}` | 纸张风缩略图 + 题干 + 顶点式公式 |
| `<AnswerDuo>` | inline JSX (`.answers` grid) | `{myAnswer, correctAnswer}` | 红 ✗ / 绿 ✓ 双卡 |
| `<ReasonCard>` | inline JSX | `{reasonMarkdown, errorType?}` | 红左条 + 红方块 + `aria-live="polite"` |
| `<SolutionStepper>` | inline JSX | `{steps: SolutionStep[]}` | 蓝圆角数字 1/2/3 + 公式 chip |
| `<KPChips>` | inline JSX | `{knowledgePoints[]}` | 紫色 outlined chip（最后一项 outline 风） |
| `<DifficultyStars>` | inline JSX | `{difficulty: 1..5}` | 5 ★ 中前 N 个亮黄 |
| `<EbbinghausPreview>` | inline JSX `.ebbing` | `{nodes: PlannedNode[7]}` | T0..T6 (T0=now / T1-T6=future)，渐变背景卡 |
| `<LowConfBanner>` | inline JSX | `{visible: boolean}` | conf<0.6 顶部黄条 |
| `<ConfirmModal>` | inline JSX | `{open, onYes, onNo}` | role=dialog + aria-modal · TC-01.04 |
| `<SaveCTA>` | inline JSX `.cta` dock | `{isSaving, onClick}` | 蓝色主按钮 + loading spinner |

来源：mockup HTML `04_result.html` § hero/answers/steps/ebbing/cta + 现行实现 `frontend/apps/h5/src/pages/Result/index.tsx` (单文件 inline，未抽 ui-kit · 与 P02/P03 同形态)。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level State 绑定

```typescript
{
  pageState: 'LOADING' | 'DRAFT' | 'LOW_CONF' | 'SAVING' | 'SAVED' | 'ERROR',
  qid: string,                            // 路由 :qid 参数
  question: QuestionDetail,               // GET /api/wb/questions/{qid}.question
  nodes:    QuestionPlannedNode[],        // GET /api/wb/questions/{qid}.plannedNodes
  confirmOpen: boolean,                   // SC-01-E04b 低置信度强制确认 modal
  lowConfTracked: boolean,                // 防止 wb_result_low_conf 重复埋点
  saveToast: string | null                // SC-01-E04c 保存失败 toast
}
```

### 4.2 DTO shape (`@longfeng/api-contracts` · `types.ts` L131-153)

```typescript
interface QuestionDetail {
  id: string;
  subject: 'math' | 'physics' | 'chemistry' | 'english';
  stem: string;
  formula?: string;
  thumbnailUrl?: string;
  myAnswer: string;
  correctAnswer: string;
  reasonMarkdown: string;
  steps: { idx, title, detail?, formula? }[];
  knowledgePoints: { id, name, weight }[];
  difficulty: 1|2|3|4|5;
  confidence: number;          // ⚠️ 关键字段 · 见 §15 spec drift
  modelInfo: { name, version };
}
interface QuestionPlannedNode { tLevel: 'T1'..'T6'; dueAt: string; status: 'preview'|'future'|'done' }
interface QuestionDetailResp { question: QuestionDetail; plannedNodes: QuestionPlannedNode[] }
```

### 4.3 涉及的后端 Entity

- `wb_question` (wrongbook-service · status `DRAFT → ACTIVE`)
- `wrong_item_analysis` (analysis_result row · 含 `confidence` 列 · ai-analysis-service 写入)
- `wb_review_plan` + `wb_review_node × 7` (POST `/save` 后由 review-plan-svc 生成)

来源：biz §2A.4 「数据绑定」(L507) + `frontend/packages/api-contracts/src/types.ts` L113-174 + audits/SC-01-PHASE-0/A02 §1.1 行 2-4 + audits/SC-01-PHASE-0/A01 (wb_question / wrong_item_analysis schema)。

---

## §5 API 触点

> 字符级精准 path + method · ground truth = `audits/SC-01-PHASE-0/A02-wrongbook-api.md` §1.1 行 2-4 + `QuestionDetailController` (path `/api/wb/questions`)。

| # | Method | Path | Headers (req) | Body (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | GET   | `/api/wb/questions/{qid}` | — | — (path only) | `200 QuestionDetailResp{question, plannedNodes}` · **plain JSON 不裹 ApiResult** · FE 直接 destructure (A02 §1.1 行 2 + §3.4) | ≤ 300ms | retry 1 次 → 兜底 MOCK_QUESTION + LOW_CONF/DRAFT 推断 (`useQuery placeholderData`) |
| 2 | PATCH | `/api/wb/questions/{qid}` | `X-Request-Id` | `PatchQuestionReq` · 字段全 optional：`{stem?, ocr?, difficulty?, mastery?, processed_image_key?}` | `200 QuestionDetailResp` (聚合最新值) | ≤ 400ms | 留 P04 EDITING · banner "保存失败请重试" |
| 3 | POST  | `/api/wb/questions/{qid}/save` | `X-Request-Id` | `SaveQuestionReq{qid, edits?: Partial<QuestionDetail>}` · 可空 · echo 校验 · path 优先 (A02 §1.1 行 4) | `200 SaveQuestionResp{qid, planId, nodes: SavedReviewNode[7]}` | ≤ 800ms | 留 P04 + ERROR banner + outbox 兜底重试 · toast "保存中…稍后自动重试" (E04c · TC-01.05) |

**关键契约 note**：
- 端点 1 **不裹 `ApiResult` 信封**（与 `WrongItemController` 不同）—— `QuestionDetailController` class javadoc L34-40 显式声明 "FE destructures top-level data.question + data.plannedNodes, so wrapping in ApiResult would push everything one level deeper and break P04 rendering"。任何回滚到 `ApiResult` 信封都将破坏 P04 渲染。
- 端点 3 触发后端链式副作用：`question.created.topic` outbox → review-plan-svc 生成 `plan + 7 nodes` → Feign → calendar-core 落 7 条 `calendar_event (relation_type=STUDY)`（biz §2A.4 后端副作用列）。
- 端点 3 幂等：基于 `qid` 唯一索引，重放 INSERT 撞 unique → 走 catch 返当前快照（feature_list T05 TI2）。

来源：biz §2A.4 「API 触点」(L508) + audits/SC-01-PHASE-0/A02-wrongbook-api.md §1.1 行 2-4 + §2 表 2/3/4 + §3.4。

---

## §6 状态机

```
       ┌─────────┐ GET 200 conf<0.6  ┌──────────┐
       │ LOADING │──────────────────→│ LOW_CONF │──┐
       └─────────┘                   └──────────┘  │ tap save → confirmOpen
            │ GET 200 conf>=0.6          ▲ ▼       │
            ▼                            │ confirmYes
       ┌─────────┐  PATCH (optional)     │         │
       │  DRAFT  │←──────────────────────┘         │
       └─────────┘                                 │
            │ tap save                             │
            ▼ ◀───────────────────────────────────┘
       ┌─────────┐  200          ┌────────┐  setTimeout 200ms
       │ SAVING  │──────────────→│ SAVED  │────────→ navigate('/wrongbook?highlight={qid}')
       └─────────┘               └────────┘
            │ 5xx                                  ┌─────────┐
            └─────────────────────────────────────→│  ERROR  │ banner + outbox 兜底
                                                   └─────────┘
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| LOADING | DRAFT | GET 200 · `confidence ≥ 0.6` | 渲染 Hero 内容；track `wb_result_view` |
| LOADING | LOW_CONF | GET 200 · `confidence < 0.6` | 同 DRAFT + 渲染黄条 + track `wb_result_low_conf`（仅 1 次 · `lowConfTracked` 防重） |
| LOADING | ERROR | `isError && !data` (retry=1 后) | banner + 留页 · 用户可手动刷新 |
| DRAFT / LOW_CONF | SAVING (DRAFT 直接) | tap 「保存到错题本」· `isLowConf=false` | `saveMutation.mutate()` · CTA loading spinner |
| LOW_CONF | (confirmOpen=true) | tap 「保存到错题本」· `isLowConf=true` | 弹 `result-confirm-modal` (不进 SAVING) |
| confirmOpen | SAVING | tap `result-confirm-yes-btn` | `saveMutation.mutate()` |
| confirmOpen | LOW_CONF | tap `result-confirm-no-btn` / backdrop | `setConfirmOpen(false)` |
| SAVING | SAVED | POST `/save` 200 | track `wb_result_save{subject,kpCount}` · 200ms 后 nav → P05 |
| SAVING | DRAFT / LOW_CONF | POST `/save` 5xx | toast "保存中…稍后自动重试" 3s · outbox 后端兜底 |

来源：biz §2A.4 「状态集」(L509) + biz §2A.5 Question 状态机 (READY → ACTIVE) + 实现 `frontend/apps/h5/src/pages/Result/index.tsx` L92-184。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| 路由 push | P03 (`/result/{qid}`) | P03 收到 SSE `DONE` event · `analyzing.SUCCEEDED → result.DRAFT` (biz §2B.2 步 7) |
| 路由 push | P06 「查看详情 → 重新分析」 | 学生在 P06 触发重分析（少见路径，未实现） |

| 出口 | 目标 | 触发条件 |
|---|---|---|
| 路由 push | P05 (`/wrongbook?highlight={qid}`) | SAVED 后 200ms (biz §2B.2 步 11) |
| 路由 push | P06 (`/wrongbook/{qid}`) | 学生 tap "查看详情"（biz §2A.4 跳转列） |
| 路由 push | P02 (`/capture`) | 学生 tap "手动修正" (back) — 重新拍一张 |
| 路由 back | P03 | 系统返回键（少见，因 P03 通常已 unmount） |

来源：biz §2A.4 「跳转」(L510) + biz §2B.2 步 7 / 步 11。

---

## §8 Wire format (SSE / WebSocket 事件)

本页无 SSE/WS 通道，事件通讯走 §5 HTTP 触点。

**注**：P04 进场的前提条件是 P03 SSE 收到 `DONE` event 且 `analysis_result` 已落库（feature_list T04 key_invariant）。P03 stream 在 P04 mount 前已 disposed (`AnalysisStreamHub.dispose` after `done()`)。P04 通过 GET `/api/wb/questions/{qid}` 拉聚合详情，没有任何流式订阅。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| AI 低置信度 | `analysis_result.confidence < 0.6` | 顶部黄条 `result-lowconf-banner` "AI 不太确定，请复核" + 保存前弹 `result-confirm-modal` 强制二次确认 | 学生可 tap "返回复核" / "确认保存"；埋点 `wb_result_low_conf` 1 次 | TC-01.04 |
| GET 详情失败 | `/api/wb/questions/{qid}` 5xx · retry 1 次后仍失败 | `pageState=ERROR` + 错误 banner | `useQuery` `placeholderData` 兜底 MOCK_QUESTION + MOCK_NODES（dev/empty 体验） | — |
| POST save 5xx | `/api/wb/questions/{qid}/save` 失败 | toast "保存中…稍后自动重试" 3s · 状态回 DRAFT/LOW_CONF | 不写 plan + outbox 不发 (T05 AC5) | — |
| calendar-core 503 | save 成功 · 但下游 calendar-core 返 503 | P04 saveSuccess 显示 · 顶部 toast "排期同步中，稍后自动重试" | outbox 表出现 `calendar_event_batch_create` 未投递记录 · 3 次重试后成功 · 最终 DB 7 个 event | TC-01.05 |
| 学生编辑后保存失败 | PATCH 5xx | inline banner "保存失败请重试" · 留 EDITING 态 | 草稿暂存 localStorage（建议性，未在当前实现） | — |

来源：biz §2A.4 「异常 & 降级」(L511) + biz §2B.2 TC-01.04 (L817) + TC-01.05 (L818) + feature_list T05 AC5。

---

## §10 验收点 (TC → AC 映射)

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-01.01 | 正常 | SC-01 全链 happy path 至步 7 | P03 SSE `DONE` 后跳 P04 | P04 mount · GET `/api/wb/questions/{qid}` 200 · Hero+错因+3 步+6 节点齐全渲染 · `wb_result_view` 上报 | T04 AC1 / AC2 / AC3 / AC4 |
| TC-01.01 | 正常 | 续上 步 9 | tap 「保存到错题本」 | POST `/save` 200 · `wb_question.status=ACTIVE` · `question.created.topic` outbox 1 条 · 200ms 后跳 P05 · `wb_result_save{subject=MATH,kpCount=2}` | T05 AC1 / AC2 / AC3 |
| TC-01.04 | 异常 | 同 TC-01.01，但步骤 7 AI 置信度 `conf=0.5` | 正常执行 | P04 顶部黄条"AI 不太确定，请复核" · 保存按钮可用但触发前端强制确认弹窗 · DB `analysis_result.confidence=0.5` · 埋点 `wb_result_low_conf` | **T04 AC5** |
| TC-01.05 | 异常 | 同 TC-01.01，但步骤 10 calendar-core 返 503 | 正常执行 | P04 saveSuccess + 顶部 toast "排期同步中，稍后自动重试" · outbox `calendar_event_batch_create` 未投递记录 · 3 次重试后成功 · 最终 DB 7 个 event | T05 AC5 (间接 · save 200 但下游异步重试) |
| TC-01.01 (幂等) | 边界 | save 已成功一次 | 重放 POST `/save` 同 qid | 第 2 次返当前快照 · 不重复 plan/nodes/event | T05 AC4 / TI2 |

来源：biz §2B.2 QA 用例表 (L812-819) + `.harness/feature_list.json` T04 AC1-5 (L215-221) + T05 AC1-5 (L258-264)。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| P03 → P04 淡入 + 滚动条置顶 | ≤ 300ms | biz §2B.2 步 7 「耗时预算」(L788) + T04 AC2 |
| GET `/api/wb/questions/{qid}` 返聚合 | ≤ 300ms | spec §5 行 1 P95 (≈ A02 §1.1 plain JSON 不裹封信省 1 层 destructure) |
| 滚动浏览 (Hero → 6 节点) FPS | 60 fps | biz §2B.2 步 8（"滚动浏览错因 / 3 步解法 / 6 节点预告"） |
| tap 「保存」 → SAVING 视觉反馈 | ≤ 100ms | UX 触觉反馈 (haptic medium) |
| POST `/save` 200 → 跳 P05 | ≤ 800ms (含 200ms 跳转动画) | biz §2B.2 步 9 「耗时预算」(L790) + T05 TI4 |
| `question.created.topic` outbox → calendar 7 条 event | ≤ 1s (异步 · UI 不等) | biz §2B.2 步 10 (L791) |

来源：biz §2B.2 各步「耗时预算」列 + feature_list T04/T05 test_invariants。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `wb_result_view` | P04 进入 DRAFT/LOW_CONF | `{qid, subject, durationFromP03Ms?}` | biz §2A.4 + biz §2B.2 步 7 |
| `wb_result_scroll` | 滚动到底部（节流 200ms） | `{depth: 25/50/75/100}` | biz §2B.2 步 8 + feature_list T04 TI3 |
| `wb_result_low_conf` | LOW_CONF 进入（1 次去重） | `{qid, confidence}` | TC-01.04 + feature_list T04 AC5 |
| `wb_result_edit{field}` | PATCH 编辑某字段 | `{qid, field: 'stem'/'difficulty'/...}` | biz §2A.4 |
| `wb_result_save` | POST `/save` 200 | `{qid, subject, kpCount}` | biz §2A.4 + biz §2B.2 步 9 + feature_list T05 TI3 |
| `wb_result_reshoot` | tap "手动修正" → P02 | `{qid}` | biz §2A.4 |

来源：biz §2A.4 「埋点事件」(L512) + biz §2B.2 步 7/8/9 埋点列 + biz §2A.8 埋点字典。

---

## §13 testid 表

| testid | 用途 | 出现位置 | E2E 引用 |
|---|---|---|---|
| `p04-root` | P04 页面根 | `Result/index.tsx` L212 | t04-analyze-done-to-result.spec.ts beforeEach |
| `p04-navbar` | 顶部 Nav "分析完成" | index.tsx L220 | — |
| `p04-question-hero` | Hero 题干卡 | index.tsx L273 | T04 AC4 渲染断言 |
| `p04-answers-row` | 双答案 row 容器 | index.tsx L297 | T04 AC4 |
| `p04-answers-row-wrong` / `-text` | ✗ 你的作答 + 文本 | index.tsx L298, L305 | T04 AC4 |
| `p04-answers-row-right` / `-text` | ✓ 正确答案 + 文本 | index.tsx L309, L316 | T04 AC4 |
| `p04-reason-card` / `-text` | 错因红条卡 | index.tsx L332, L343 | T04 AC4 |
| `p04-solution-stepper` | 3 步 stepper 容器 | index.tsx L360 | T04 AC4 |
| `p04-solution-stepper-step-{1,2,3}` | 每步 | index.tsx L367 | T04 AC4 |
| `p04-meta-chips` | KP + 难度 row | index.tsx L387 | T04 AC4 |
| `subject-chip-math` | 数学学科 chip | index.tsx L395 | 跨页 (P05 复用) |
| `memory-curve` | 6 节点预告卡 | index.tsx L416 | T04 AC4 + TI1 |
| `memory-curve-node-T{1..6}` | T1-T6 节点（hidden 兼容） | index.tsx L436 | SC-02/03/04 复用 |
| `result-timeline-node-T{0..6}` | 7 节点 (含 T0=now) 新版 | index.tsx L430 | T04 TI1 |
| `result-lowconf-banner` | 低置信度黄条 (E04b) | index.tsx L266 | **TC-01.04** + T04 AC5 |
| `p04-low-conf-banner` | 低置信度黄条 (legacy) | index.tsx L264 | 同上 (双 testid 兼容) |
| `result-confirm-modal` | 强制确认弹窗 (E04b) | index.tsx L459 | TC-01.04 + T04 AC5 |
| `result-confirm-yes-btn` | 确认保存 | index.tsx L505 | TC-01.04 |
| `result-confirm-no-btn` | 返回复核 | index.tsx L492 | TC-01.04 |
| `result-save-btn` | 蓝色 CTA "保存并开启复习" (E04c) | index.tsx (CTA dock) | T05 AC1 |
| `result-save-loading` | save 进行中 spinner | index.tsx (CTA dock) | T05 AC1 |
| `p04-save-cta` | CTA dock (legacy) | index.tsx (dock) | — |
| `p04-skeleton` | LOADING 骨架屏 | index.tsx L76 | — |
| `result-hero-stem` | 题干文本 | index.tsx L285 | T04 AC4 cross-check |
| `result-cause-card` | 错因卡文本 wrapper | index.tsx L345 | T04 AC4 cross-check |
| `result-solution-card` | 解法卡 wrapper | index.tsx L362 | T04 AC4 cross-check |

来源：`frontend/packages/testids/src/index.ts` L54-90 (`TEST_IDS.p04.*`) + `frontend/apps/h5/src/pages/Result/index.tsx` data-testid grep。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `result.nav.title` | 分析完成 | Analysis done | 顶部标题（含动态 4.2s tag） |
| `result.section.reason` | 错因诊断 | Error cause | 红条卡 section header |
| `result.section.steps` | 解答步骤 | Solution steps | stepper section header |
| `result.section.kp` | 涉及知识点 | Knowledge points | KP 卡 |
| `result.section.difficulty` | 难度 | Difficulty | 难度卡 |
| `result.ebbing.title` | 艾宾浩斯复习计划预览 | Ebbinghaus preview | 6 节点卡标题 |
| `result.ebbing.subtitle` | 保存后将在日历自动生成 6 个复习节点 | 6 review nodes will be generated after save | 6 节点卡副标题 |
| `result.cta.save` | 保存并开启复习 | Save & start review | 蓝色主按钮 |
| `result.cta.reshoot` | 手动修正 | Edit manually | 灰色次按钮 |
| `result.cta.note` | 保存后将按《艾宾浩斯》自动生成 T1–T6 共 6 个日历提醒 | After save, 6 reminders (T1-T6) auto-added to calendar | CTA dock 底部 note |
| `result.lowConf.banner` | AI 不太确定，请复核答案再保存 | AI is uncertain, please review before save | 低置信度黄条 |
| `result.lowConf.confirmTitle` | AI 不太确定，确认保存？ | AI uncertain — confirm save? | confirm modal 标题 |
| `result.lowConf.confirmBody` | AI 对本题置信度较低，建议你先核对答案与错因，再保存到错题本 | Low confidence — please verify before saving | confirm modal 正文 |
| `result.lowConf.confirmYes` | 确认保存 | Confirm save | confirm yes btn |
| `result.lowConf.confirmNo` | 返回复核 | Back to review | confirm no btn |
| `result.toast.savingRetry` | 保存中…稍后自动重试 | Saving — will auto-retry | save 5xx toast |
| `result.toast.calendarSync` | 排期同步中，稍后自动重试 | Calendar sync pending — auto-retry | calendar 503 toast (TC-01.05) |

来源：biz §2A.4 「i18n Key」(隐含) + `frontend/apps/h5/src/pages/Result/index.tsx` 文案 grep。

---

## §15 关联与影响

- **上游 spec**: P03-analyzing (SSE `DONE` → 跳 P04)
- **下游 spec**: P05-wrongbook-list (`/wrongbook?highlight={qid}` save 后 200ms 跳) / P06-detail (查看详情) / P02-capture (手动修正回拍)
- **关联 task**:
  - feature_list.json SC-01 **T04** (analyze-done-to-result) — `branch: feature/SC-01-T04-analyze-done-to-result` — AC1-5 全部映射本 spec §10
  - feature_list.json SC-01 **T05** (result-save-to-wrongbook) — `branch: feature/SC-01-T05-result-save-to-wrongbook` — AC1-5 全部映射本 spec §5 行 3 + §10 + §6 SAVING 路径
- **关联 audit**:
  - `audits/SC-01-PHASE-0/A01-wrongbook-schema.md` — `wb_question` / `wrong_item_analysis` schema (含 `confidence` 列)
  - `audits/SC-01-PHASE-0/A02-wrongbook-api.md` §1.1 — **3 个端点字符级 ground truth** (GET / PATCH / POST save) + §3.4 plain JSON 不裹 ApiResult 决策
  - `audits/SC-01-PHASE-0/A04-ai-analysis.md` — P03 SSE `DONE` event 契约（P04 进场前提）
  - `audits/SC-01-PHASE-0/A05-review-plan.md` — `POST /save` 后链式 plan + 7 nodes 生成
- **关联 mockup**: `design/mockups/wrongbook/04_result.html`
- **关联实现**: `frontend/apps/h5/src/pages/Result/index.tsx` + `Result.module.css` + `Result.test.tsx`

### 15.1 ⚠️ Spec drift: `confidence` 字段来源未对齐 (A04 / T04 AC5 衍生)

**现状**：
- spec §4 / §5 / §9 / §10 都假定 `QuestionDetail.confidence: number` 由 `wrong_item_analysis.confidence` 列承载，ai-analysis-service 写入后由 wrongbook-service `QuestionDetailController.get()` 聚合返回。
- 但当前 FE 实现 `frontend/apps/h5/src/pages/Result/index.tsx` 在拿不到 BE 数据时**硬编码兜底** `MOCK_QUESTION.confidence = 0.85` (L51) + 特殊 qid `/low.?conf/i` 强制 `0.42` (L102)。
- A04 (`ai-analysis-service` controller / `AnalysisChunk`) 全文未出现 `confidence` 字段 —— SSE `DONE` event payload 当前不携带 confidence；FE 必须从 GET `/api/wb/questions/{qid}` 拉。
- A02 §1.1 GET 端点 response shape 只描述 `{question, plannedNodes}` 顶层，未字符级展开 `question.confidence` 是否真由 BE 写入或仅由 FE 兜底。

**影响**：
- T04 AC5 (TC-01.04) 要求 "DB `analysis_result.confidence=0.5`" + FE 据此渲染黄条。如果 BE 实际未在 `wrong_item_analysis` 表持久化 confidence、或 wrongbook-service 聚合时没读这列，则 AC5 在生产路径上不可达，**只能靠 mock qid 偶然触发**。
- 当前 e2e 测试如果只用 `qid 含 'low-conf'` 触发 LOW_CONF banner，是验 FE 兜底逻辑，**不是验 BE→FE 真链路**。

**Surface 决策（owner: backend wrongbook-service + ai-analysis-service）**：
1. **(必做)** ai-analysis-service 在 SSE `DONE` event 的 `AnalysisResult` payload 中携带 `confidence: number ∈ [0,1]` 字段，并在落库时写入 `wrong_item_analysis.confidence`（T04 TI2 已隐式要求 DB constraint `[0,1]`）。
2. **(必做)** wrongbook-service `QuestionDetailController.get()` 聚合时从 `wrong_item_analysis` 表读 `confidence` 注入 `QuestionDetail.confidence`，删除 FE 兜底 0.85。
3. **(必做)** spec §4 / §5 GET 端点 response 字段表把 `confidence` 标为 "**required, sourced from wrong_item_analysis.confidence**" 并附 DB 列定义引用 (A01)。
4. **(建议)** 当前 FE 兜底 `MOCK_QUESTION.confidence=0.85` / `/low-conf/ qid → 0.42` 作为 dev-only fixture，应在 production build 移除（或迁到 fixture pack）。

**状态**：此 drift 在 T04 实施前应由 backend / ai-analysis 团队拍板，避免 T04 Tester 仅用 FE mock 通过 AC5 而生产路径无效（CLAUDE.md Rule 9 — tests verify intent, not just behavior）。
