# P08 · 复习执行（ReviewExec）

**Status**: Active
**Owner**: design + frontend + backend
**Last-updated**: 2026-05-14
**Mockup**: design/mockups/wrongbook/08_review_exec.html
**Biz refs**: biz/业务与技术解决方案_AI错题本_基于日历系统.md §2A.4 P08 规格卡 (L556-L569) + §2B.2 SC-01 步 15-18 + §2B.3 SC-02 步 4-9 (推送深链唤起) + §2B.5 SC-04 (FORGOT 级联重排)
**Related tasks**: feature_list.json SC-01 T10 (open) · T11 (reveal) · T12 (grade MASTERED + TC-01.06 FORGOT 变体)

---

## §1 页面目的

P08 是 AI 错题本"复习驱动力"的核心承载页：**学生在不看答案的前提下重做一次错题 → 自评掌握度 → 由后端 SM-2 算法驱动节点推进/重排**。它把"复习行为"从被动的"刷卡片"升级为主动的"自评 + 元认知"——学生必须先输出（手写/键盘/公式面板），才能揭示答案，再为自己打分。这套"先做、再揭、后评"的三段式状态机是与艾宾浩斯 7 节点（T0..T6）耦合的：MASTERED 推进节点 T+1、PARTIAL 维持原计划、FORGOT 触发 SC-04 跨域级联重排（取消未来节点 + 重排 7 个 + 日历批删/批建）。P08 同时是 SC-02 推送深链的直达落点（绕过 P-HOME）和 SC-04 一致性测试的入口，是日活循环里最高频、状态机最复杂的一页。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区 (zone 划分)

```
┌──────────────────────────────────────────┐
│ statusbar 9:41                            │
├──────────────────────────────────────────┤
│ [< back] 复习执行·第 2 题      [×]        │  topbar (44px) + close
│ 25% · 预计 6 分钟  ▓▓▓▓░░░░░░             │  progress bar (4px)
├──────────────────────────────────────────┤
│ ⬤T2·第2次  数学·二次函数  中等★★★         │  meta chips (3 个)
├──────────────────────────────────────────┤
│ ┌─ 错题回顾 · 原题 ───────────────────┐   │
│ │  已知 f(x)=x²-4x+3, 请将其化为顶点式  │   │  question hero card
│ │  并写出顶点坐标与对称轴方程            │   │
│ └─────────────────────────────────────┘   │
├──────────────────────────────────────────┤
│ • 你的解答 · 手写                          │
│ ┌─ canvas paper ──────────────────────┐   │
│ │  (笔迹实时渲染区 · 3 mode tab)        │   │  answer area
│ │  [手写] [键盘] [公式面板]             │   │
│ └─────────────────────────────────────┘   │
├──────────────────────────────────────────┤
│  [    👁  揭示答案    ]   (reveal btn)    │  (REVEALED 前)
│        ─或─                               │
│  ┌─ ✓ 标准答案 ─────────────────────┐    │  (REVEALED 后)
│  │ f(x)=(x-2)²-1, 顶点(2,-1), x=2    │    │  reveal content (绿)
│  │ 第 1 步: ...                       │    │  + 3 步解法
│  │ 第 2 步: ...                       │    │  + 6 节点时间线
│  └────────────────────────────────────┘    │
├──────────────────────────────────────────┤
│  ⬤T0─⬤T1─◉T2─○T3─○T4─○T5─○T6              │  memory curve (6 节点)
├──────────────────────────────────────────┤
│ [✗ 未掌握] [◐ 部分] [✓ 已掌握]            │  grade buttons (底部固定)
└──────────────────────────────────────────┘
```

来源：biz §2A.4 P08 「布局分区」+ mockup `08_review_exec.html` 视觉。

### 2.2 关键视觉锚 (mockup HTML 真 selector)

| Zone | DOM selector / class | 用途 |
|---|---|---|
| Topbar | `.nav` (L130) | back / title / × / progress bar |
| Progress | `.ptrack` + `.pbar` (L142-L144) | 25% · 预计 6 分钟 |
| Meta chips | `.metarow` (L151) + `.chip.red/.indigo/.orange` | T 级 / 学科·KP / 难度 |
| Question hero | `.qcard` (L158) + `.qstem .fm` | 题干 + LaTeX |
| Answer area | `.work .paper` (L172) | 手写 canvas |
| Reveal card | `.reveal` (L66) + `.reveal .ans` + `.reveal .steps` | 绿色答案 + 3 步 |
| Memory curve | (inline node-progress § L81) | T0..T6 圆点 |
| Grade buttons | (底部固定 3 button) | ✗ / ◐ / ✓ |

> **mockup ⚠️**: 当前 `08_review_exec.html` (287 行) **未植入 data-testid**——属于 spec drift。frontend 实装时必须按 §13 表的 testid 注入 DOM。

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<P08Topbar>` | frontend/apps/h5/src/pages/P08 | `{cursor, total, percent, etaMin, onBack, onClose}` | 顶部进度 25% + "第 2/8 题" + × |
| `<MetaChips>` | frontend/packages/ui-kit | `{tLevel, subject, kp, difficulty}` | 3 chip 横排 (红/靛/橙) |
| `<QuestionHero>` | frontend/packages/ui-kit | `{stem, latex, difficulty, stars}` | 题干 Hero 卡 + KaTeX 渲染 |
| `<AnswerArea>` | frontend/packages/ui-kit | `{mode:'handwrite'｜'keyboard'｜'formula', value, onChange}` | 3 mode Tab + canvas + 键盘 + 公式面板 |
| `<RevealCard>` | frontend/packages/ui-kit | `{revealed:boolean, answer, steps[]}` | 揭示前隐藏 (display:none + aria-hidden) · 揭示后绿色展开 300ms easeOut |
| `<MemoryCurve>` | frontend/packages/ui-kit (P08/P09 共用) | `{nodes:[{T,state}], currentT}` | 6 节点时间线 · 当前 T 脉冲 |
| `<GradeButtons>` | frontend/apps/h5/src/pages/P08 | `{revealed, masteredEnabled, onGrade(grade)}` | 3 按钮 (红✗/橙◐/绿✓) · 揭示前全部 disabled · 揭示后 mastered 仅 quality≥3 可点 |
| `<ExitConfirmSheet>` | frontend/packages/ui-kit | `{open, onCancel, onExit}` | × 触发 · 文案"本次复习尚未自评，退出将保留在原计划" |

来源：biz §2A.4 P08 「核心组件」+ frontend/packages/ui-kit + mockup HTML DOM 名。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level State 绑定

```typescript
{
  sessionId: string;            // 来自 P-HOME / P07 全部开始 创建的 sid (内存 store · B02 决策 A)
  cursor:    number;            // 当前题 index (1-based · "2 / 8" 中的 2)
  total:     number;            // 会话总题数
  node: {
    nid:           string;      // ≡ wb_review_plan.id (B02 决策 A 命名映射)
    wrongItemId:   string;      // qid
    nodeIndex:     number;      // 0..6 (T0..T6)
    tLevel:        'T0'|'T1'|'T2'|'T3'|'T4'|'T5'|'T6';
    easeFactor:    number;      // SM-2 ease (1.3..3.0)
    status:        'ACTIVE'|'GRADED'|'CANCELLED';
    openedAt:      ISOString;   // lifecycleTracker.markOpened 落地
    revealedAt:    ISOString?;  // lifecycleTracker.markRevealed 落地
  };
  question: {
    qid:        string;
    stem:       string;         // 题干 (含 LaTeX)
    subject:    'MATH'|'PHYSICS'|...;
    kpName:     string;         // 知识点名
    difficulty: 1|2|3|4|5;
    answer:     string;         // 揭示前 UI 不渲染
    steps:      string[];       // 揭示前 UI 不渲染
  };
  answerDraft: { mode:'handwrite'|'keyboard'|'formula'; value:string|Blob };
  revealed:    boolean;         // false → true 单向 · 不可逆
  state:       'READING'|'ANSWERING'|'REVEALED'|'GRADED';
  timer:       { startedAt: ISOString; nowMs: number };
}
```

### 4.2 涉及的后端 Entity

- `wb_review_plan` (review-plan-service · B02 决策 A: spec 概念 `review_node` 在 DB 层落 `review_plan` · nid ≡ `review_plan.id`)
  - 关键列：`node_index 0..6`, `strategyCode='EBBINGHAUS_SM2'`, `ease_factor (init 2.5)`, `next_due_at`, `status (ACTIVE|GRADED|CANCELLED)`, `current_level`, `deleted_at`
- `review_outcome` (grade 写入：quality 0..5, ease_before/after, interval_before/after, duration_ms)
- `NodeLifecycleTracker` (内存 store · 跟 reboot 丢失) → `opened_at` / `revealed_at` 时戳
- `review_plan_outbox` (EVENT_OPENED · EVENT_GRADED · EVENT_MASTERED · EVENT_CALENDAR_BATCH_CREATE · EVENT_CALENDAR_BATCH_DELETE)
- `calendar_event` (FORGOT 路径级联：旧 6 条删 + 新 7 条建 · relation_id=`question:{qid}:node:{nid}`)

来源：biz §2A.4 P08 「数据绑定」+ audits/SC-01-PHASE-0/A05-review-plan.md §1.1-§1.5 + frontend/packages/api-contracts。

---

## §5 API 触点

> 字符级精准 path + method · 与 audits/SC-01-PHASE-0/A05-review-plan.md §2.1 表 #4/#5/#6 字面一致。

| # | Method | Path | Headers (req) | Body (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/api/review/nodes/{nid}/open` | `X-User-Id` | (空) | `200 {nid, openedAt}` + 写 `EVENT_OPENED` outbox + `NodeLifecycleTracker.markOpened(nid)` | ≤ 400ms | 幂等：同 nid 重放不重复写 outbox (lifecycleTracker 不刷 openedAt) · 502 仍允许进 READING (前端乐观更新) |
| 2 | POST | `/api/review/nodes/{nid}/reveal` | `X-User-Id` | (空) | `200 {nid, revealedAt}` · `NodeLifecycleTracker.markRevealed(nid)` (**只读 lifecycle 时戳 · 不改 plan / 不写 MQ**) | ≤ 400ms | 502 失败 UI 仍展开答案 (eventually consistent) · waitMs 埋点用本地时戳兜底 |
| 3 | POST | `/api/review/nodes/{nid}/grade` | `X-User-Id`, `X-Idempotency-Key` | `{grade: "MASTERED"｜"PARTIAL"｜"FORGOT", timeSpentMs: number, answerText?: string}` | `200 NodeResultResp {planId, wrongItemId, nodeIndex, nodeState, quality, easeBefore, easeAfter, intervalBefore, intervalAfter, nextDueAt, durationMs, mastered}` · 写 `EVENT_GRADED` outbox | ≤ 500ms (MASTERED/PARTIAL) · ≤ 1.5s (FORGOT 含级联) | FORGOT 级联失败 → outbox 补偿 (旧 events 删 + 新 events 建必须 5 min 内最终一致) · 重试按 idempotency_key 幂等 |
| 4 | GET | `/api/review/nodes/{nid}` | `X-User-Id` | (查) | `200 ReviewPlanDto {nid, nodeIndex, nextDueAt, easeFactor, status}` | ≤ 200ms | 404 → "节点已取消" 占位 + 返回 P07 |
| 5 | GET | `/api/review/nodes/{nid}/result` | `X-User-Id` | (查 · 跳 P09 时调用) | `200 NodeResultResp` (同 #3 response 字段) | ≤ 300ms | 见 P09 §5 |

**grade 三态映射 (后端 `req.toQuality()`)**:

| `grade` (req) | `quality` (SM-2) | 副作用 |
|---|---:|---|
| `MASTERED` | **5** | SM-2 重算 ease/interval · 推进到 T+1 (`next_due_at = NODE_OFFSETS[currentIndex+1]`) · 写 `EVENT_GRADED` |
| `PARTIAL` | **3** | SM-2 重算（quality≥3 路径）· **plan 维持原计划**（前端语义：next_due_at 不改 · 后端实际仍按 SM-2 在 quality=3 时温和推进 · spec 与代码已在 A05 audit §2.1 #6 对齐） · 写 `EVENT_GRADED` |
| `FORGOT` | **0** | Q-C 规则：`ease` reset 到 `easeInit (2.5)` · `intervalDays=1` · **触发 SC-04 级联**：当前 + 后续 nodes 全 CANCELLED → `forceCreateSevenNodes(qid, studentId, now)` (跳 `existsByWrongItemId` 闸门) · Feign `DELETE /internal/events?relationIds=[...]` + `POST /internal/events/batch` 新建 7 条 · 写 `EVENT_GRADED` + outbox 补偿 |

**MASTERED 触发软删 (A05 §1.2)**: 连续 3 次 `quality ≥ 3` 且 `ease ≥ 2.8` → `planRepo.markAllMasteredByWrongItemId(wrongItemId)` 软删全 7 行 (Q-G 聚合根原子性 · `MASTERED_CONSECUTIVE_COUNT=3` / `MASTERED_EASE_THRESHOLD=2.8`)。

来源：biz §2A.4 P08 「API 触点」+ audits/SC-01-PHASE-0/A05-review-plan.md §1.1 / §1.2 / §1.5 / §2.1 + A05 §3 "FORGOT 重排" 证据。

---

## §6 状态机

```
                       enter (deeplink/list)
                              │
                              ▼
   ┌────────────┐  POST /open ┌──────────┐  user starts writing  ┌───────────┐
   │ (page mnt) │────────────►│ READING  │──────────────────────►│ ANSWERING │
   └────────────┘   200 OK    └──────────┘   canvas onTouchStart  └───────────┘
                                                                       │
                                                          tap 「揭示答案」│
                                                          POST /reveal  │
                                                          200 OK        ▼
   ┌────────────┐  tap close  ┌──────────────┐  tap exit          ┌───────────┐
   │ EXIT_CONFRM│◄─────×─────┤ (any state)  │                    │ REVEALED  │
   └────────────┘  二次确认   └──────────────┘                    └───────────┘
        │ cancel ───► 回到原 state                                      │
        │ exit ────► /sessions/{sid}:pause → P-HOME                     │
        ▼                                                               │ tap ✗/◐/✓ (MASTERED only if revealed)
                                            POST /grade {grade,timeSpentMs} │
                                                         200 OK            ▼
                                                                    ┌───────────┐
                                                                    │  GRADED   │──nav P09
                                                                    └───────────┘
```

### 6.1 状态转移规则 (4 主态严格)

| From | To | Trigger | Side effect | 关联 task |
|---|---|---|---|---|
| (mount) | READING | `POST /open` 200 | EVENT_OPENED outbox · `wb_exec_open{nid,T,sessionId}` · 题干 Hero 渐入 | T10 AC2 |
| READING | ANSWERING | canvas onTouchStart / keyboard focus / formula insert | 笔迹实时渲染 · 计时器 ms 累加 · `wb_exec_writing_start` | T10 AC4 |
| ANSWERING | REVEALED | `POST /reveal` 200 | `revealed_at` 落地 · 答案卡 `display:none → auto · 300ms easeOut` · 3 步解法渲染 · 6 节点时间线高亮当前 T (pulse) · `wb_exec_reveal{nid,waitMs}` (waitMs = revealedAt − openedAt) | T11 AC2/AC3 |
| REVEALED | GRADED | `POST /grade` 200 · grade ∈ {MASTERED, PARTIAL, FORGOT} | EVENT_GRADED outbox · MASTERED 推进 T+1 · PARTIAL 维持计划 · FORGOT 触发 SC-04 级联 (Q-C ease reset + forceCreateSevenNodes + calendar 批删/批建) · `wb_exec_grade{nid,grade,totalMs}` · 跳 P09 | T12 AC2/AC3/AC5 |
| READING / ANSWERING | EXIT_CONFIRM | tap close (×) | 弹二次确认 Sheet · 文案"本次复习尚未自评，退出将保留在原计划" · canvas/计时器暂停 | T10 AC5 |
| EXIT_CONFIRM | (back to prev) | tap 取消 | Sheet close · 计时器恢复 | T10 AC5 |
| EXIT_CONFIRM | (P-HOME) | tap 退出 | `POST /api/review/sessions/{sid}:pause body {lastCompletedNid}` · session → PAUSED · `wb_exec_exit{nid,sessionId}` · P08 卸载跳 P-HOME (resume banner 显) | SC-03 复用 |
| REVEALED | (× 退出) | tap close after reveal | **同 EXIT_CONFIRM** · 仍弹二次确认 · 不允许"看完答案不打分就走" | 禁止行为 |

### 6.2 自评语义与算法对应 (biz §2A.4 + A05 §1.2)

| grade | quality | ease 重算 | interval 重算 | 后续节点 |
|---|---:|---|---|---|
| MASTERED | 5 | `ease_after = min(easeMax 3.0, ease_before + 0.1)` (SM-2 Q-A) | `interval_after = interval_before × ease_after` (cap maxDays 60) | 推进 T+1 · `next_due_at = baseInstant + NODE_OFFSETS[currentIndex+1]` |
| PARTIAL | 3 | `ease_after = max(easeMin 1.3, ease_before − qualityPenaltyStep 0.2)` (SM-2 Q-B) | 温和推进 (quality≥3 路径)：spec 业务表述"维持原计划"，代码实际按 SM-2 q=3 平滑推进；产品确认与设计文档已对齐（A05 §2.1 #6） | 保持 currentIndex (next_due_at 由 SM-2 算出 · 通常邻近原值) |
| FORGOT | 0 | **Q-C 规则: reset 到 `easeInit (2.5)`** | `intervalDays = 1` | **当前 + 后续 6 nodes 全 CANCELLED → `forceCreateSevenNodes(qid, studentId, now)` 重建 7 个 (T0..T6) · `plan.totalForget++`** · 日历 Feign 批删 + 批建 |

### 6.3 MASTERED 聚合根软删 (A05 §1.2)

```java
if (MASTERED_CONSECUTIVE_COUNT >= 3 && ease_after >= 2.8) {
  planRepo.markAllMasteredByWrongItemId(wrongItemId);  // 软删全 7 行 · Q-G 原子性
  outbox.write(EVENT_MASTERED, {wrongItemId, finalEase: ease_after});
}
```

→ 错题"已掌握"则整道题从复习池移除，下次拍同题再走 SC-01 重新生成 7 节点。

### 6.4 禁止行为 (biz §2A.4 P08 「禁止行为」铁律)

1. **揭示前不能看答案**：UI 锁 · `<RevealCard>` 在 `revealed=false` 时 `display:none + aria-hidden=true` · DOM 不渲染 answer / steps 文本 (devtools 也看不到 · 后端 `GET /nodes/{nid}` 在 revealedAt 为空时**不返回 answer 字段** · spec drift 后端补)。
2. **强制关闭弹二次确认**：tap × 不能直接退 · 必须弹 Sheet (文案见 §6.1 EXIT_CONFIRM 行)。
3. **已揭示后不能再 tap「✓ 已掌握」**：UI 禁用绿按钮 · 只能 tap PARTIAL / FORGOT (因为已看到答案后自评 "掌握" 失去诚实度) · 灰显 + aria-disabled · `<GradeButtons masteredEnabled={!revealed}>`。

来源：biz §2A.4 P08 「状态集」+「自评语义」+「禁止行为」+ biz §2A.5 ReviewNode 状态机 + audits/SC-01-PHASE-0/A05-review-plan.md §1.2 / §2.1。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| 路由 push | P07 (今日复习列表) tap「开始」按钮 | SC-01 步 15 · 创建 session 后第一题 |
| 路由 push | P09 tap「继续复习」 | SC-02 步 9 · session 内 next nid |
| 深链 | 推送 `wb://review/exec/{nid}` | SC-02 步 2 · 跳过 P-HOME 直达 · token 过期重定向 P00 (带 redirect) |
| 路由 push | P06 (错题详情) tap「立即复习」 | (Phase 1+) |

| 出口 | 目标 | 触发条件 |
|---|---|---|
| 路由 replace | P09 (`/review/done/{nid}`) | GRADED · `POST /grade` 200 |
| 路由 pop | P-HOME | EXIT_CONFIRM tap 退出 · `:pause` 成功 |
| 路由 pop | P00 登录 | 深链时 token 401 · 带 redirect 参数 |
| 路由 push | P07 | (Phase 1+) tap 返回到列表 · 当前规约用 × → pause |

来源：biz §2A.4 P08 「跳转」+ biz §2B.2 步 18 + §2B.3 步 4/9。

---

## §8 Wire format (SSE / WebSocket 事件)

本页**无 SSE / WS 通道**，事件通讯走 §5 三个 HTTP 触点（open / reveal / grade · 各一次性请求-响应）。前端依赖 polling/page-state 自管理，不订阅服务端推送。

> 备注：FORGOT 级联是后端**同步链 + 异步 outbox 补偿**，前端只在 `POST /grade` 响应里拿到 `nextDueAt` (新 T1 时戳)，不需要前端订阅 `calendar.event.batch.created` MQ。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| 节点已取消 (404) | `GET /nodes/{nid}` 在 SC-04 级联后旧 nid 404 | "该复习节点已取消，下次排期已更新" 占位 + CTA "查看新排期" → 跳 P05 qid=N | 不崩溃 · 静默吸收 | TC-05.04 |
| 推送 deeplink token 过期 (401) | SC-02 步 3 · token expired | "登录已过期" Sheet · 引导 P00 · 登录后回跳 P08 nid | redirect 参数透传 · 不丢埋点 | TC-02.02 |
| 推送 deeplink 越权 (403) | 推送 nid 不属于本学生 | "该复习节点不存在或无权访问" · 降级跳 P-HOME | 网关直接 403 · `wb_deeplink_forbidden` | TC-02.05 |
| `/grade` 网络中断 | tap ✓ 后断网 / 5xx | 按钮 loading 持续 · 重试 3 次 (相同 X-Idempotency-Key) · 3 次失败弹 toast "网络异常,稍后重试" · 状态留 REVEALED | 幂等键保证不重复写 EVENT_GRADED | T12 (内嵌) |
| FORGOT 级联 calendar 5xx | SC-04 步 2.⑤ Feign `DELETE /internal/events` 503 | UI 正常跳 P09 (乐观) | outbox 保留 `EVENT_CALENDAR_BATCH_DELETE` 未投递 · 30s 内补偿 · 最终一致 · 不允许中间态 > 5 min | TC-04.02 |
| FORGOT 级联批建部分失败 | 7 条 event 批建前 2 成功后 5 失败 | UI 不感知 | 按 `idempotency_key` per-event 粒度重入 · 最终 7 条全到 · 不重复 | TC-04.03 |
| 连续多次 FORGOT | 学生 2h 内 FORGOT 同题两次 | UI 正常 · P09 都展示 FORGOT variant | `plan.totalForget=2` · 旧新 node 正确级联 · 埋点两条 `wb_exec_grade{grade=FORGOT}` | TC-04.04 |
| T0 节点 FORGOT (无未来可取消) | 学生在第一次复习就 FORGOT | UI 正常 | 只重排 7 个新 node · 无 calendar 删除动作 · 只批建 7 | TC-04.05 |
| revealed 后 tap 已掌握 (绕过 UI) | 测试 / 篡改 DOM 直接 fire onClick | (UI 应已 disabled) | 后端不做额外校验 · 但前端 `<GradeButtons masteredEnabled={!revealed}>` 强约束 · DOM aria-disabled | 禁止行为 (§6.4) |
| × 强退出 (绕过 Sheet) | 系统返回键 / iOS swipe back | 仍 intercept · 弹 Sheet | navigation guard 拦截 · `beforeunload` hook | 禁止行为 (§6.4) |

来源：biz §2A.4 P08 「异常 & 降级」(无直接列 · 推导自 biz §2A.7 异常路径降级矩阵) + biz §2B 各 SC 用例 + audits/SC-01-PHASE-0/A05-review-plan.md §3。

---

## §10 验收点 (TC → AC 映射)

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-01.01 步 15-16 | 正常 | 学生在 P07 列表 · 第 1 题待复习 · session 已建 | tap「开始」 | `POST /open` 200 + EVENT_OPENED outbox 1 条 + P08 渲染 ≤ 400ms · 状态 READING (题干可见) → ANSWERING (笔迹起始) | T10 AC1/AC2/AC3/AC4 |
| TC-01.01 步 17 | 正常 | 同上 + 学生在 P08 已作答 | tap「揭示答案」 | `POST /reveal` 200 · 答案卡绿色展开 300ms easeOut · 3 步解法 + 6 节点 T 高亮脉冲 · `revealed_at` 落库 · **不发 MQ** | T11 AC1/AC2/AC3/AC4 |
| TC-01.01 步 18 | 正常 | 同上 + 揭示完成 | tap「✓ 已掌握」 | `POST /grade {grade:MASTERED,timeSpentMs}` 200 + EVENT_GRADED outbox 1 条 + SM-2 重算 (ease+0.1 ≤ 3.0) + 推进 T+1 · 跳 P09 ≤ 500ms · today 大卡 -1 | T12 AC1/AC2/AC3/AC4 |
| TC-01.06 | 边界 | 同 TC-01.01 步 1-17 · 步 18 改 FORGOT | tap 红色「✗ 未掌握」 | `grade=FORGOT, quality=0` · ease reset 2.5 · 当前 + 后续 6 nodes CANCELLED · `forceCreateSevenNodes` 重建 7 (T0..T6) · calendar 批删 6 + 批建 7 · `plan.totalForget++` · P09 FORGOT variant | T12 AC5 |
| TC-02.01 步 4 | 正常 | 推送送达 · nid PUSHED 态 · token 有效 | tap 推送 | 跳过 P-HOME 直达 P08 · `POST /open` 携 `sessionId` (会话连续性) · `wb_exec_open{nid,T,sessionId}` | T10 (SC-02 复用) |
| TC-02.02 | 异常 | 同上但 token 过期 | tap 推送 | 401 → "登录已过期" Sheet → P00 → 登录后跳 P08 nid · redirect 透传 · 不丢埋点 | §9 行 2 |
| TC-02.05 | 安全 | 深链 nid 不属本学生 | tap 推送 | 网关 403 · 降级 P-HOME · `wb_deeplink_forbidden` | §9 行 3 |
| TC-04.01 | 正常 (SC-04 主线) | plan 200 有 3 GRADED + 1 OPEN (T3) + 3 SCHEDULED | tap 未掌握 | DB: T0-T2 保留 / T3 GRADED·FORGOT / T4-T6 CANCELLED · 新 600..606 SCHEDULED · 日历批删 3 + 批建 7 | T12 AC5 |
| TC-04.02 | 异常 | SC-04 步 2.⑤ calendar 503 | tap 未掌握 | UI 正常 P09 · outbox 保留 · 30s 内补偿 · 5 min 内最终一致 | §9 行 5 |
| TC-04.03 | 异常 | SC-04 批建 7 条 前 2 成后 5 败 | tap 未掌握 | per-event idem 重入 · 最终 7 条全到 · 不重复 | §9 行 6 |
| TC-04.04 | 边界 | 2h 内连续 2 次 FORGOT | 连 tap 2 次 未掌握 | `plan.totalForget=2` · 旧新 node 正确级联 · 两条 `wb_exec_grade{grade=FORGOT}` | §9 行 7 |
| TC-04.05 | 边界 | T0 节点 FORGOT | tap 未掌握 | 无未来节点可取消 · 只批建 7 (新 T0..T6) · 无 calendar 批删 | §9 行 8 |
| TC-03.04 | 异常 (SC-03 复用) | EXIT_CONFIRM tap 退出后立即杀 App | 重启 App | 落 P-HOME · Resume Banner 出 (PAUSED 已落库) | §6.1 EXIT_CONFIRM 行 |

来源：biz §2B.2 TC-01.01..06 + §2B.3 TC-02.01..05 + §2B.5 TC-04.01..05 + §2B.4 TC-03.04 + feature_list.json T10/T11/T12 acceptance_criteria & test_invariants。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---:|---|
| P07 → P08 跳转 (open 含) | ≤ 400ms | biz §2B.2 步 15 「耗时预算」 |
| 推送深链 → P08 首屏 | ≤ 800ms (含 splash 200 + verify 200 + open 400) | biz §2B.3 步 2-4 |
| `POST /open` | ≤ 400ms | A05 §2.1 #4 + spec §5 |
| `POST /reveal` | ≤ 400ms | biz §2B.2 步 17 + A05 §2.1 #5 |
| reveal 展开动画 | 300ms easeOut | feature_list.json T11 AC3 |
| `POST /grade` (MASTERED/PARTIAL) | ≤ 500ms | biz §2B.2 步 18 + A05 §2.1 #6 |
| `POST /grade` (FORGOT 含级联) | ≤ 1.5s | biz §2B.5 步 2 「耗时预算」 |
| P08 → P09 跳转 | ≤ 500ms | biz §2B.2 步 18 |
| FORGOT 一致性窗口 (新 events 全到) | ≤ 5 min | biz §2B.5 关键断言点 |

来源：biz §2B.2 / §2B.3 / §2B.5 「耗时预算」列 + audits/SC-01-PHASE-0/A05-review-plan.md §2.1。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `wb_exec_open` | `POST /open` 200 后 | `{nid, T, sessionId, entry: 'p07'｜'push'｜'p09-continue'}` | biz §2A.4 P08 + §2B.2 步 15 |
| `wb_exec_writing_start` | canvas onTouchStart / keyboard focus | `{nid, mode: 'handwrite'｜'keyboard'｜'formula'}` | biz §2B.2 步 16 |
| `wb_exec_reveal` | `POST /reveal` 200 后 | `{nid, waitMs}` (waitMs = revealedAt − openedAt) | biz §2A.4 P08 + §2B.2 步 17 |
| `wb_exec_grade` | `POST /grade` 200 后 | `{nid, grade: 'MASTERED'｜'PARTIAL'｜'FORGOT', totalMs, sessionId}` | biz §2A.4 P08 + §2B.2 步 18 + §2B.5 步 1 |
| `wb_exec_exit_confirm` | tap × 弹 Sheet | `{nid, progress: number (0..1)}` | biz §2B.4 步 17 |
| `wb_exec_exit` | EXIT_CONFIRM 退出 | `{nid, sessionId}` | biz §2B.4 步 18 |
| `wb_exec_skip` | 进入 P08 但未自评退出 | `{nid}` | biz §2A.4 P08 |
| `wb_deeplink_forbidden` | deeplink 越权 | `{nid, reason: 403}` | biz §2B.3 TC-02.05 |
| `wb_push_click` | 推送 tap 进入 | `{nid, channel: 'APNS'｜'WECHAT'}` | biz §2B.3 步 2 |

来源：biz §2A.4 P08 「埋点事件」+ biz §2A.8 埋点字典 + §2B 各 SC 步埋点列。

---

## §13 testid 表

| testid | 用途 | 出现位置 | E2E 引用 |
|---|---|---|---|
| `p08-root` | P08 页面根 | TEST_IDS.p08.root (L425) | t10/t11/t12 beforeEach mount |
| `p08-topbar` | 顶部 nav 容器 | TEST_IDS.p08.topbar (L426) | t10 step "P08 渲染 ≤ 400ms" |
| `p08-topbar-cursor` | "第 2 / 8 题" 文字 | TEST_IDS.p08.topbarCursor (L427) | t10/t11 进度校验 |
| `p08-progress-bar` | 顶部进度条 (25%) | TEST_IDS.p08.progressBar (L428) | t10 VRT |
| `p08-meta-chips` | 3 chip 横排容器 | TEST_IDS.p08.metaChips (L429) | t10 (T 级 / 学科 / 难度) |
| `p08-question-hero` | 题干 Hero 卡 | TEST_IDS.p08.questionHero (L430) | t10 AC3 |
| `p08-answer-area` | 手写/键盘/公式 canvas | TEST_IDS.p08.answerArea (L431) | t10 AC4 (canvas onTouchStart) |
| `p08-reveal-btn` | 「揭示答案」按钮 | TEST_IDS.p08.revealBtn (L432) | t11 AC1 tap |
| `p08-reveal-content` | 揭示后绿色答案卡 | TEST_IDS.p08.revealContent (L433) | t10 TI2 (display:none 前) / t11 AC3 (展开后) |
| `p08-reveal-checkmark` | 答案卡左上勾图标 | TEST_IDS.p08.revealCheckmark (L434) | t11 VRT |
| `p08-reveal-step-${n}` | 第 n 步解法 (dynamic) | `p08Ids.revealStep(n)` (L482) | t11 AC3 (3 步渲染) |
| `memory-curve` | 6 节点时间线根 | TEST_IDS.p08.memoryCurve (L435) (P09 共享) | t11 AC3 高亮当前 T |
| `memory-curve-node-${T}` | T0..T6 单节点 (dynamic) | `p08Ids.memoryCurveNode(tLevel)` (L483) | t11 AC3 pulse · t12 AC2 推进 |
| `p08-grade-buttons` | 底部 3 按钮容器 | TEST_IDS.p08.gradeButtons (L436) | t12 AC1 |
| `p08-grade-buttons-forgot` | 红色 ✗ 未掌握 | TEST_IDS.p08.gradeBtnForgot (L437) | t12 AC5 (TC-01.06 FORGOT) |
| `p08-grade-buttons-partial` | 橙色 ◐ 部分 | TEST_IDS.p08.gradeBtnPartial (L438) | t12 TI2 (PARTIAL) |
| `p08-grade-buttons-mastered` | 绿色 ✓ 已掌握 | TEST_IDS.p08.gradeBtnMastered (L439) | t12 AC1/AC2 + §6.4 禁止行为 (revealed 后 aria-disabled) |
| `p08-close-btn` | 顶部 × 按钮 | TEST_IDS.p08.closeBtn (L440) | t10 AC5 弹 Sheet |
| `p08-exit-confirm-sheet` | 二次确认 Sheet | TEST_IDS.p08.exitConfirmSheet (L441) | t10 AC5 |

来源：frontend/packages/testids/src/index.ts `TEST_IDS.p08.*` (L424-L442) + dynamic `p08Ids` (L481-L484) + feature_list.json T10/T11/T12 `physical_verification.frontend_e2e`。

> **mockup drift**: 当前 `08_review_exec.html` (287 行) 未植入 data-testid · frontend 实装时按本表注入。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `exec.title` | 复习执行 · 第 {n} 题 | Review · Q{n} | 顶部 title |
| `exec.subtitle` | {cursor} / {total} · 剩余 {remaining} 题 | {cursor} / {total} · {remaining} left | 顶部 subtitle |
| `exec.progress.eta` | {pct}% · 预计 {min} 分钟 | {pct}% · ETA {min} min | 进度条 label |
| `exec.chip.tLevel` | T{n} · 第 {ordinal} 次复习 | T{n} · review #{ordinal} | meta chip 1 |
| `exec.qcard.kicker` | 错题回顾 · 原题 | Wrongbook · Original | 题干 kicker |
| `exec.answer.handwrite` | 手写 | Handwrite | mode tab 1 |
| `exec.answer.keyboard` | 键盘 | Keyboard | mode tab 2 |
| `exec.answer.formula` | 公式面板 | Formula | mode tab 3 |
| `exec.revealBtn` | 👁 揭示答案 | 👁 Reveal answer | 揭示按钮 |
| `exec.reveal.title` | 标准答案 | Standard answer | 答案卡标题 |
| `exec.reveal.stepN` | 第 {n} 步 | Step {n} | 解法步骤 |
| `exec.grade.forgot` | ✗ 未掌握 | ✗ Forgot | 红按钮 |
| `exec.grade.partial` | ◐ 部分掌握 | ◐ Partial | 橙按钮 |
| `exec.grade.mastered` | ✓ 已掌握 | ✓ Mastered | 绿按钮 |
| `exec.grade.masteredDisabledTip` | 看过答案后只能选 部分 / 未掌握 | After reveal: only Partial / Forgot | 绿按钮 disabled 提示 |
| `exec.exitSheet.title` | 退出本次复习？ | Quit this review? | Sheet 标题 |
| `exec.exitSheet.body` | 本次复习尚未自评，退出将保留在原计划 | Not yet graded · plan kept as is | Sheet 文案 |
| `exec.exitSheet.cancel` | 取消 | Cancel | Sheet 取消 |
| `exec.exitSheet.exit` | 退出 | Quit | Sheet 退出 |

来源：biz §2A.4 P08 「i18n Key」(隐式 · 由禁止行为列推导) + frontend/packages/i18n/。

---

## §15 关联与影响

- **上游 spec**: P07 (今日复习列表 · tap 开始入口) · P09 (tap 继续复习入口) · 推送 deeplink (SC-02 直达)
- **下游 spec**: P09 (review-done · grade 成功跳转) · P-HOME (EXIT_CONFIRM 退出回落) · P00 (token 过期回登)
- **关联 task**: feature_list.json SC-01 T10 (open) · T11 (reveal) · T12 (grade MASTERED + TC-01.06 FORGOT 变体)
- **关联 audit**: audits/SC-01-PHASE-0/A05-review-plan.md §1.1-§1.5 + §2.1 #4/#5/#6 + §3 (SM-2 + FORGOT 重排证据)
- **关联 SC**: SC-01 步 15-18 (黄金路径) · SC-02 步 4-9 (推送唤起会话连续性) · SC-03 (EXIT_CONFIRM + Resume Banner) · SC-04 (FORGOT 级联重排 · 跨域一致性)
- **关联 mockup**: design/mockups/wrongbook/08_review_exec.html (⚠️ 缺 data-testid · 需 frontend 实装时按 §13 注入)
- **关联架构**: design/arch/s5-review-plan.md §A1 (7 节点偏移) · ADR 0013 (SM-2 算法) · B02 决策 A (review_plan 表承载 review_node 概念 · nid ≡ id)
