# P06 · 错题详情 (WrongbookDetail)

**Status**: Active
**Owner**: design + frontend + backend
**Last-updated**: 2026-05-14
**Mockup**: design/mockups/wrongbook/06_wrongbook_detail.html
**Biz refs**: biz/业务与技术解决方案_AI错题本_基于日历系统.md §2A.4 (P06 规格卡 L529-540) + §2B.11 SC-10 (归档 → 级联取消节点 L1127-1158) + §2A.5 Question/Plan/Node 状态机 (L584+)
**Related tasks**: feature_list.json SC-10 T-archive (归档主链) · SC-10 T-undo (5s 撤销) · SC-10 T-outbox (calendar 补偿) · SC-05 关联（立即复习入口复用 P06 主 CTA）

---

## §1 页面目的

单题"档案页"——给学生提供**沉淀**与**操作**两个维度的统一界面：左半（沉淀）展示该错题的完整学习历史（AI 简报、6 节艾宾浩斯时间线、能力雷达、复习流水、变式题）；右半（操作）下沉到底部 CTA，"想练就能练"（立即复习）+ "已掌握就归"（归档）。这是 SC-10 归档级联场景的**唯一发起点**：学生认为某题完全掌握 → tap 归档 → 后端链式置 ARCHIVED + T4-T6 CANCELLED + 日历未来 event DELETE，并保留历史 COMPLETED event 作为"已成长"证据。也是 SC-05 / P11 立即复习的二级入口（在错题本里二次回看后再开练）。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区 (zone 划分)

```
┌─────────────────────────────────────┐  顶部安全区 (54px)
├─────────────────────────────────────┤  导航栏 (< 错题本 · 编辑 ✏ · ⋯ 菜单)
│  错题 #17  [未掌握]                  │  大标题 + mastery pill
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │  原图卡 170px (含放大 magn 按钮)
│  │ [paper 旋转 -2° · 红笔批注]   │  │
│  └───────────────────────────────┘  │
│  [分析] [复习记录] [变式题]          │  Segment Tab (3 段)
│  ┌───────────────────────────────┐  │
│  │ AI 简报: KP chips + 题干       │  │  AI 分析简报卡
│  │ ✗ 你的答 (红)  ✓ 正解 (绿)     │  │
│  │ 错因: h,k 含义混淆 (红条)      │  │
│  └───────────────────────────────┘  │
│  ── 艾宾浩斯 复习时间线 · 3/6 已完成─│  Section divider
│  ┌───────────────────────────────┐  │
│  │ SVG 曲线 + T1✓ T2✓ T3✓ T4● .. │  │  时间线 + 6 节点
│  │ 5次累计 · 68% 掌握 · 1次遗忘   │  │  3 stat 底栏
│  └───────────────────────────────┘  │
│  ┌──────────────┬────────────────┐  │
│  │ 雷达图 5 维   │ 知识点 legend  │  │  Radar + KP list
│  └──────────────┴────────────────┘  │
├─────────────────────────────────────┤
│  [ 归档 ]  [ ▶ 立即复习 ]            │  底部 CTA (78px · 1:2 比例)
├─────────────────────────────────────┤
│ 首页 · 错题本● · 拍题 · 复习 · 我的  │  Tab Bar (84px · 错题本 active)
└─────────────────────────────────────┘  Home Bar
```

来源：biz §2A.4 「布局分区」L534 + mockup HTML `.nav` / `.content` / `.img` / `.stab` / `.brief` / `.tl` / `.radar-row` / `.cta` / `.tabbar`。

### 2.2 关键视觉锚 (mockup HTML 真 selector)

| Zone | DOM selector / class | 用途 |
|---|---|---|
| Nav back | `.nav .back` | "< 错题本" 返回 P05 |
| Nav right icons | `.nav .r` (✏ edit · ⋯ menu) | 编辑入 P04 · ⋯ 弹归档/分享/举报菜单 (SC-10 步 1) |
| Title + pill | `.nav h1` + `.nav h1 .pill` | "错题 #17" + mastery 标签 |
| Origin image | `.img` + `.img .paper` | 170px 原图卡 + 内嵌纸张视觉 |
| Zoom button | `.img .magn` | 右下放大按钮 → 全屏图浏览 |
| Segment tab | `.stab` (`.on` active) | 分析/复习记录/变式题 三段切换 |
| Analysis brief | `.brief` (`.kicker` / `.stem` / `.ans.w` / `.ans.r` / `.err`) | AI 简报：错误答/正解 grid + 错因红条 |
| Timeline section | `.sec` + `.tl` | "艾宾浩斯 复习时间线" 标题 + 卡 |
| Curve SVG | `.tl .axis svg` | SVG 渐变遗忘曲线 |
| Node dots | `.nodes .nd` (`.done` / `.now` / 默认) | T1-T6 6 节点（3 态） |
| Timeline stats | `.tl .stats .st` | 5次累计 · 68% 掌握 · 1次遗忘 |
| Radar | `.radar svg` (5 维 polygon) | 顶点式/配方/对称轴/判别式/韦达 |
| KP legend | `.legend .it` | 4 条本题 KP + 百分比 |
| CTA archive | `.cta .btn.ghost` | 归档按钮（左 · flex:1） |
| CTA review | `.cta .btn.primary` | 立即复习按钮（右 · flex:2 蓝渐变） |

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<P06PageHeader>` | frontend/apps/h5 | `{qid, masteryLabel, onBack, onEdit, onMenuOpen}` | 大标题 + mastery pill + 右上 ⋯ 菜单 |
| `<OriginImageCard>` | frontend/packages/ui-kit | `{src, sizeMB, onZoom}` | 170px 原图卡 · 支持放大 |
| `<SegmentTab>` | frontend/packages/ui-kit | `{value:'analysis'\|'records'\|'variants', onChange}` | 3 段切换（默认 analysis） |
| `<AIAnalysisBrief>` | frontend/packages/ui-kit | `{kp[], stem, wrongAns, correctAns, reasonHtml}` | AI 简报卡（含错因红条） |
| `<EbbinghausTimeline>` | frontend/packages/ui-kit | `{nodes:Node[], stats:{total,masteryPct,forgot}}` | SVG 渐变曲线 + 6 节点（done/now/future）+ 3 stat |
| `<KPRadarChart>` | frontend/packages/ui-kit | `{axes:[5], values:[0..100]}` | 五维能力雷达（SVG 5-gon） |
| `<KPLegend>` | frontend/packages/ui-kit | `{items:[{name, pct, color}], bloom?}` | 本题 KP 列表 + 百分比 + Bloom 等级 |
| `<RecordsTimeline>` | frontend/packages/ui-kit | `{records:ReviewRecord[]}` | Segment "复习记录" tab 内容（time × grade × ms） |
| `<VariantsList>` | frontend/packages/ui-kit | `{variants:Variant[], emptyHint}` | Segment "变式题" tab（P1 多为空） |
| `<DetailMenuSheet>` | frontend/packages/ui-kit | `{onArchive, onShare, onReport}` | ⋯ 菜单 ActionSheet（SC-10 步 1-2） |
| `<ArchiveConfirmSheet>` | frontend/packages/ui-kit | `{qid, onConfirm, onCancel}` | 二次确认 Sheet（SC-10 步 2-3） |
| `<P06CTABar>` | frontend/packages/ui-kit | `{disabled:boolean, onArchive, onReviewNow}` | 底部双 CTA（1:2 比例） |

来源：biz §2A.4 「核心组件」L535 + frontend/packages/ui-kit + mockup HTML 真组件名。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level State 绑定

```typescript
{
  detail: {
    state: 'LOADING' | 'VIEW' | 'ARCHIVED' | 'ERROR',
    qid: string,
    activeTab: 'analysis' | 'records' | 'variants',
    question: {
      qid, subject, kp[], stem, ocrText,
      processedImageKey, sizeMB,
      masteryLabel: 'NOT_MASTERED' | 'PARTIAL' | 'MASTERED',
      status: 'ACTIVE' | 'ARCHIVED',
      wrongAns: string,            // 学生的错答（题号选项）
      correctAns: string,
      bloom: 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVAL' | 'CREATE'
    },
    analysis: {
      versionId, reasonHtml,        // 错因 (含 <b> 红色高亮)
      stepByStep: string[]
    },
    nodes: Array<{
      nid, nodeIndex:0..6, t:'T0'..'T6',
      status:'COMPLETED'|'SCHEDULED'|'CANCELLED'|'NOW',
      plannedAt:ISO8601, completedAt?:ISO8601, quality?:'MASTERED'|'PARTIAL'|'FORGOT'
    }>,
    records: Array<{ recId, nid, gradedAt, grade, timeSpentMs, answerText? }>,
    radar: { axes:string[5], values:number[5] },     // 0..100
    variants: Array<{ vid, stemSnippet, sourceKp }>,
    archive: {
      menuOpen: boolean,
      confirmSheetOpen: boolean,
      undoSnackbarUntil?: number   // P05 接力消费 (本页提交后跳转 P05)
    }
  }
}
```

### 4.2 涉及的后端 Entity

- `wb_question` (wrongbook-service · §4.2 status/subject/kp/stem/processed_image_key/embedding)
- `wb_analysis_result` (wrongbook-service · §4.3 版本化 reason_html + step_by_step)
- `wb_review_plan` (review-plan-service · §4.4 1:1 question · easeFactor / nextDueAt)
- `wb_review_node` (review-plan-service · §4.5 T0-T6 + status:SCHEDULED/COMPLETED/CANCELLED)
- `wb_review_record` (review-plan-service · §4.6 学生每次做题流水)
- `calendar_event` (calendar-core · §4.9 1:1 wb_review_node · 归档级联删除未来 event)

来源：biz §2A.4 「数据绑定」L536 `detail{question, analysis, nodes[], records[], radar{axes,values}, variants[]}` + biz §4.2-4.6 + biz §4.9。

---

## §5 API 触点

> 字符级精准 path + method · 必须与 audits/SC-01-PHASE-0/A02-wrongbook-api.md §1.1 + A05-review-plan.md §1 一致。

| # | Method | Path | Headers (req) | Body / Query (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/wb/questions/{qid}` | `X-Student-Id`, `X-Request-Id` | path `qid:String` | `200 QuestionDetailResp{question, plannedNodes}` · plain JSON (A02 §1.1 #2) | ≤ 400ms | 5xx → skeleton + 顶部 toast retry |
| 2 | GET | `/api/wb/questions/{qid}/nodes` | `X-Student-Id`, `X-Request-Id` | path `qid:String` | `200 {nodes:[{nid,nodeIndex,t,status,plannedAt,completedAt,quality}]}` | ≤ 300ms | 复用 #1 `plannedNodes` 作降级源 |
| 3 | GET | `/api/wb/questions/{qid}/records` | `X-Student-Id`, `X-Request-Id` | path `qid:String` · query `size=50` | `200 {records:[{recId,nid,gradedAt,grade,timeSpentMs}]}` | ≤ 400ms | 5xx → "复习记录" tab 显示 "暂未加载" + retry |
| 4 | POST | `/api/wb/questions/{qid}/archive` | `X-Request-Id` (幂等) | path `qid:String` · body 空 | `200 QuestionListItem` (status=ARCHIVED 快照) · 二次调用同帧 (A02 §1.1 #6) | ≤ 800ms | 5xx → CTA 恢复 + 顶部 toast "归档失败,请重试" |
| 5 | POST | `/api/review/nodes/{nid}/start` | `X-Student-Id`, `X-Request-Id` | path `nid:String` · body 空 | `200 {nid, sessionId?}` · 后端记 `opened_at` + 发 `review.node.opened` outbox | ≤ 500ms | 5xx → 留 P06 · 顶部 toast retry |

**注 1（`/nodes` 与 `/records` 实现现状）**：A02 audit §2 表（6/6 SC-01 触点）目前**只覆盖** `/{qid}` 聚合返 `QuestionDetailResp{question, plannedNodes}` —— `plannedNodes` 已含节点数据，FE 可先以 #1 聚合作主源，**`/nodes` `/records` 作为 P06 真档案页**需要独立 endpoint（spec canonical）；待 SC-10 实施时由 backend 在 `QuestionDetailController` 增 `GET /{qid}/nodes` + `GET /{qid}/records` 两个 wrapper（数据查 `wb_review_node` + `wb_review_record`）。

**注 2（`/start` vs `/open`）**：biz §2A.4 P06 卡 L537 明文规定 P06 "立即复习" 调 `POST /api/review/nodes/{nid}/start`；当前 review-plan-service `ReviewPlanController` 落地是 `POST /api/review/nodes/{nid}/open`（A05 §1.2 #4）。SC-05 步 7（L955）也用 `/open`。**Spec canonical 是 `/start`**，A05 audit 表中 `/open` 是 review-plan-service 既有命名 —— 建议 SC-10 实施时在 controller 上为 `/start` 加 alias（或直接重命名 `/open` → `/start`）。spec 走 `/start` 不变。

来源：biz §2A.4 「API 触点」L537 + audits/SC-01-PHASE-0/A02-wrongbook-api.md §1.1 #2/#6 + A05-review-plan.md §1.2 + biz §2B.11 SC-10 步 3。

---

## §6 状态机

```
       GET /{qid} + /nodes + /records
       ┌─────────┐ ────────────────► ┌────────┐  status=ARCHIVED
       │ LOADING │                   │  VIEW  │ ─────────────────┐
       └─────────┘                   └────────┘                  ▼
            │ 5xx                         │                ┌──────────┐
            ▼                             │ Tap ⋯ → 归档    │ ARCHIVED │
       ┌─────────┐                        │ → confirm → 200│ (只读)   │
       │  ERROR  │                        ▼                └──────────┘
       └─────────┘                  ┌─────────────┐              │
                                    │  ARCHIVING  │──────────────┘
                                    │  (蓝条 hint) │  → navigate P05 (+Snackbar)
                                    └─────────────┘

  VIEW 子机:  tap segment → activeTab 切换 (analysis/records/variants)
              tap "立即复习" → POST /nodes/{nid}/start → navigate P08
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| (mount) | LOADING | 进入 P06 (`/wrongbook/{qid}`) | 并发 GET `/{qid}` + `/{qid}/nodes` + `/{qid}/records` |
| LOADING | VIEW | 三个 GET 全 200 + `question.status='ACTIVE'` | 渲染 4 卡 + 双 CTA |
| LOADING | ARCHIVED | `question.status='ARCHIVED'` (深链入 / 已归档) | CTA "归档" disabled · "立即复习" disabled · 顶部加灰底 hint |
| LOADING | ERROR | 任一 GET 5xx | skeleton 保留 + 顶部 toast |
| VIEW | VIEW (tab change) | tap `.stab span` | activeTab 切换 · 不重拉数据 |
| VIEW | ARCHIVING | tap "归档" → 二次确认 → POST `/archive` in-flight | 顶部蓝条 "归档中..." · 双 CTA disabled |
| ARCHIVING | (P05 + Snackbar) | POST `/archive` 200 | P06 淡出 + navigate P05 + Snackbar 5s "已归档 · 撤销" |
| ARCHIVING | VIEW | POST `/archive` 5xx | 顶部 toast "归档失败,请重试" + CTA 恢复 |
| VIEW | (P08) | tap "立即复习" → POST `/nodes/{nid}/start` 200 | navigate P08 (`/review/exec/{nid}`) |

来源：biz §2A.4 「状态集」L538 (`VIEW / ARCHIVED(归档后只读)`) + biz §2B.11 SC-10 步 3 (`ARCHIVING` 中间态从 "归档中..." 蓝条推出) + biz §2A.5 Question 状态机。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| P05 错题卡 | P05 列表 | 学生 tap `.card` → `/wrongbook/{qid}` |
| P04 保存后查看详情 | P04 → P06 | save 成功 + 学生 tap "查看详情" |
| Deep link `wb://wrongbook/{qid}` | 推送 / 分享 | 历史推送回看 |
| SC-05 P11 立即复习 (相邻入口) | P11 事件详情 (复习节点形态) | P11 也调 `/start` → 直接 P08 不入 P06 |

| 出口 | 目标 | 触发条件 |
|---|---|---|
| 路由 push | P08 (`/review/exec/{nid}`) | tap "立即复习" + POST `/nodes/{nid}/start` 200 (biz §2A.4 L539) |
| 路由 navigate | P05 (`/wrongbook?archived=just-now`) | 归档 200 + Snackbar 5s 撤销窗口 (biz §2B.11 步 4) |
| 路由 back | P05 / 上一页 | tap `.nav .back` "< 错题本" |
| 路由 push | P04 (`/result/{qid}`) | tap `.nav .r` 编辑 ✏ icon |

来源：biz §2A.4 「跳转」L539 + biz §2B.11 SC-10 步 4。

---

## §8 Wire format (SSE / WebSocket 事件)

本页无 SSE/WS 通道；事件通讯走 §5 HTTP 触点（GET detail / GET nodes / GET records / POST archive / POST start）。SC-10 归档级联（节点 CANCELLED + 日历 event DELETE）通过 MQ `question.archived` 在后端异步完成，前端不订阅；下次进入或回到 P05 看效果。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| 详情 5xx | GET `/{qid}` 失败 | skeleton 保留 + 顶部 toast "加载失败,点击重试" | 重试 1 次 → 仍失败保留上一份缓存 | — |
| 节点流水缺失 | GET `/{qid}/nodes` 失败 | 用 `/{qid}.plannedNodes` 兜底渲染时间线 | A02 §2 中 `QuestionDetailResp.plannedNodes` 是 fallback 源 | — |
| 复习记录缺失 | GET `/{qid}/records` 失败 | "复习记录" tab 显示 "暂未加载" + retry | 不影响 analysis / variants tab | — |
| 归档级联主链 | tap ⋯ → 归档 → confirm | 顶部蓝条 "归档中..." · 双 CTA disabled · 200 后 navigate P05 + Snackbar 5s | 后端链式：① question.ARCHIVED ② T4-T6 CANCELLED ③ MQ `question.archived` ④ calendar event 删除（仅未来 · 保留历史 COMPLETED） | **TC-10.01** |
| 5s 撤销 | P05 接力 · Snackbar tap "撤销" | Snackbar 关闭 + 列表前端乐观恢复 | POST `/api/wb/questions/{qid}/unarchive` · 节点从撤销前 T 继续（不是 T0 重置） | **TC-10.02** |
| 日历删除失败 | 步 3 calendar event DELETE 5xx | 学生无感（异步） | outbox 兜底；1 min 内补偿；P10 期间可能短暂看到未来 event；不影响 `question.ARCHIVED` | **TC-10.03** |
| Snackbar 期间退 App | 5s 内退后台再回 | 回来后 Snackbar 已消失 | 列表持久化不含该题；撤销改从"我的-已归档"入 | **TC-10.04** |
| 立即复习 5xx | POST `/nodes/{nid}/start` 失败 | CTA 恢复 + 顶部 toast "请重试" | 不污染 `wb_review_node` · 幂等可重 | — |
| ARCHIVED 状态深链 | URL 携 qid + `question.status='ARCHIVED'` | 整页只读：双 CTA disabled + 顶部灰底 hint "此题已归档" | 不调 archive / start | — |

来源：biz §2A.4 「异常 & 降级」（隐式 LOADING/ERROR）+ biz §2B.11 SC-10 步 3-6 + biz §2B.11 QA 用例 TC-10.01~04 L1155-1158。

---

## §10 验收点 (TC → AC 映射)

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-10.01 | 正常 | qid=200 · plan T0-T3 GRADED · T4-T6 SCHEDULED · 日历 7 条 event（3 COMPLETED + 3 SCHEDULED + 1 当前） | SC-10 步骤 1-4：tap ⋯ → 归档此题 → 确认归档 → 跳回 P05 | question ARCHIVED · T4-T6 CANCELLED · 日历未来 event 删除 · **历史 COMPLETED event 保留** · Snackbar 出现 | SC-10 T-archive AC1/AC2/AC3 (级联三件套) |
| TC-10.02 | 正常 | 同 TC-10.01 步骤 4 后 | 步骤 5：5s 内 tap "撤销" | question ACTIVE · 节点恢复为撤销前态（不是 T0 重置） · 日历 event 重建（幂等） · 埋点 `wb_archive_undo` 成功 | SC-10 T-undo AC1/AC2 |
| TC-10.03 | 异常 | 步骤 3 calendar 删除失败 | 等待补偿 | outbox 最终一致；期间 P10 可能暂时看到未来 event，1 min 内消失；**不影响** question.ARCHIVED 状态 | SC-10 T-outbox AC1 |
| TC-10.04 | 边界 | Snackbar 出现期间用户退出 App | 再回来 · 已超 5s | Snackbar 自动消失；列表持久化不含该题；撤销入口转移到"我的 - 已归档" | SC-10 T-archive AC4 |

来源：biz §2B.11 SC-10 QA 用例 L1153-1158 + feature_list.json SC-10 task acceptance_criteria。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| GET `/{qid}` 聚合返回 | ≤ 400ms | spec §5 #1 行 budget |
| GET `/{qid}/nodes` | ≤ 300ms | spec §5 #2 行 budget · 直查 `wb_review_node` |
| GET `/{qid}/records` | ≤ 400ms | spec §5 #3 行 budget · 直查 `wb_review_record` (size=50) |
| Tap "归档" → Sheet 出现 | ≤ 100ms | UI 即时反馈预算 (biz §2B.11 步 2) |
| POST `/archive` → 200 + navigate P05 | ≤ 800ms | spec §5 #4 + biz §2B.11 步 3-4 端到端 |
| POST `/nodes/{nid}/start` → navigate P08 | ≤ 500ms | spec §5 #5 + biz §2B.6 SC-05 步 7 (`event_review_now` ≤ 500ms) |
| Segment tab 切换（无网请求） | ≤ 100ms | 客户端切换 · biz §2A.6 「P → 接口映射」 |

来源：biz §2B.11 步 3-4 + biz §2B.6 步 7 + spec §5 行级 budget。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `wb_detail_view` | P06 mount + GET 200 | `{qid, masteryLabel, status}` | biz §2A.4 L540 |
| `wb_detail_tab` | Segment tab 切换 | `{qid, tab:'analysis'\|'records'\|'variants'}` | biz §2A.4 L540 |
| `wb_detail_menu_open` | tap ⋯ 菜单 | `{qid}` | biz §2B.11 步 1 |
| `wb_detail_archive_confirm_show` | 二次确认 Sheet 出现 | `{qid}` | biz §2B.11 步 2 |
| `wb_detail_archive` | tap "确认归档" → POST `/archive` 发起 | `{qid}` | biz §2A.4 L540 + biz §2B.11 步 3 |
| `wb_archive_success` | 200 + 跳 P05 + Snackbar | `{qid, latencyMs}` | biz §2B.11 步 4 |
| `wb_archive_undo` | P05 Snackbar tap "撤销" → POST `/unarchive` | `{qid, sinceArchiveMs}` | biz §2B.11 步 5 |
| `wb_detail_review_now` | tap "立即复习" → POST `/nodes/{nid}/start` | `{qid, nid, T}` | biz §2A.4 L540 |
| `wb_detail_zoom` | tap 原图放大按钮 | `{qid}` | mockup `.img .magn` 推断（biz §2A.4 「核心组件」"支持放大"） |

来源：biz §2A.4 「埋点事件」L540 + biz §2B.11 SC-10 步 1-5 埋点列。

---

## §13 testid 表

| testid | 用途 | 出现位置 (mockup / testids 包) | 备注 |
|---|---|---|---|
| `wrongbook.detail.root` | P06 页面根 | testids `wrongbookDetail.root` | 老命名空间（兼容 SC-02/03/04 旧 spec） |
| `p06-origin-image` | 原图 170px 卡 | testids `wrongbookDetail.'origin-image'` + mockup `.img` | — |
| `p06-origin-image-zoom` | 放大按钮 | testids `'origin-image-zoom'` + mockup `.img .magn` | — |
| `p06-segment-tab` | Segment Tab 容器 | testids `'segment-tab'` + mockup `.stab` | — |
| `p06-segment-tab-analysis` | "分析" tab | testids `'segment-tab-analysis'` + mockup `.stab .on` 默认 | — |
| `p06-segment-tab-records` | "复习记录" tab | testids `'segment-tab-records'` + mockup `.stab span:nth-child(2)` | — |
| `p06-segment-tab-variants` | "变式题" tab | testids `'segment-tab-variants'` + mockup `.stab span:nth-child(3)` | — |
| `p06-ai-brief` | AI 简报卡容器 | testids `'ai-brief'` + mockup `.brief` | — |
| `p06-ai-brief-reason-bar` | 错因红条 | testids `'ai-brief-reason-bar'` + mockup `.brief .err` | — |
| `p06-ai-brief-difficulty` | 难度 chip (KP kicker 区) | testids `'ai-brief-difficulty'` + mockup `.brief .kicker` | — |
| `memory-curve` | 艾宾浩斯时间线 SVG | testids `'memory-curve'` + mockup `.tl .axis svg` | 跨页复用命名（与 P09 共享） |
| `p06-records-timeline` | "复习记录" tab 内容 | testids `'records-timeline'` | Segment 切换后渲染 |
| `p06-variants-empty` | "变式题" tab 空态 | testids `'variants-empty'` | MVP 大概率空 |
| `p06-radar-chart` | 能力雷达 SVG | testids `'radar-chart'` + mockup `.radar svg` | — |
| `p06-bottom-actions` | 底部 CTA 容器 | testids `'bottom-actions'` + mockup `.cta` | — |
| `p06-bottom-actions-archive-btn` | 归档按钮 | testids `'bottom-actions-archive-btn'` + mockup `.cta .btn.ghost` | SC-10 步 1 主入口（或走 ⋯ 菜单） |
| `p06-bottom-actions-review-btn` | 立即复习按钮 | testids `'bottom-actions-review-btn'` + mockup `.cta .btn.primary` | SC-05 入口复用 |
| `wrongbook.detail.delete.btn` | 删除（legacy） | testids `wrongbookDetail.delete.btn` | 与归档区分 · MVP 不暴露 |

来源：frontend/packages/testids/src/index.ts `TEST_IDS.wrongbookDetail.*` (L137-172) + mockup HTML 06_wrongbook_detail.html selector grep。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `detail.title.prefix` | 错题 # | Wrong Question # | 大标题前缀 (mockup `.nav h1`) |
| `detail.mastery.notMastered` | 未掌握 | Not Mastered | 顶部 pill (`.pill` 红底) |
| `detail.mastery.partial` | 部分 | Partial | mastery pill 橙底 |
| `detail.mastery.mastered` | 已掌握 | Mastered | mastery pill 绿底 |
| `detail.tab.analysis` | 分析 | Analysis | Segment Tab 1 |
| `detail.tab.records` | 复习记录 | Records | Segment Tab 2 |
| `detail.tab.variants` | 变式题 | Variants | Segment Tab 3 |
| `detail.brief.wrongAns` | ✗ 你的答 | ✗ Your answer | AI 简报错误答标签 (`.ans.w .l`) |
| `detail.brief.correctAns` | ✓ 正解 | ✓ Correct | AI 简报正解标签 (`.ans.r .l`) |
| `detail.brief.reason.prefix` | 错因： | Reason: | 错因红条前缀 |
| `detail.timeline.title` | 艾宾浩斯 复习时间线 | Ebbinghaus Timeline | Section 标题 |
| `detail.timeline.stats.total` | 累计复习 | Reviews | 底栏 stat |
| `detail.timeline.stats.mastery` | 掌握度 | Mastery | 底栏 stat |
| `detail.timeline.stats.forgot` | 遗忘 | Forgot | 底栏 stat |
| `detail.radar.title` | 知识点能力 | KP Ability | Radar 标题 |
| `detail.legend.title` | 本题知识点 | Question KPs | Legend 标题 |
| `detail.cta.archive` | 归档 | Archive | CTA 左 |
| `detail.cta.reviewNow` | 立即复习 | Review Now | CTA 右 |
| `detail.menu.archive` | 归档此题 | Archive | ⋯ 菜单项 |
| `detail.menu.share` | 分享 | Share | ⋯ 菜单项 |
| `detail.menu.report` | 举报错误分析 | Report | ⋯ 菜单项 |
| `detail.archive.confirm.title` | 归档此题 | Archive this question | 二次确认 Sheet 标题 |
| `detail.archive.confirm.body` | 归档后将停止所有未来复习提醒，可随时从错题本恢复 | Future reminders will stop; you can restore anytime | 二次确认 Sheet body (biz §2B.11 步 2 原文) |
| `detail.archive.hint.archiving` | 归档中... | Archiving... | 顶部蓝条 (ARCHIVING 中间态) |
| `detail.archive.readonly` | 此题已归档 | This question is archived | ARCHIVED 状态顶部 hint |
| `detail.error.load` | 加载失败,点击重试 | Failed to load, tap to retry | LOADING → ERROR toast |

来源：biz §2A.4 「i18n Key」隐式（biz §2B.11 步 2 文案为权威）+ frontend/packages/i18n + mockup HTML 文字。

---

## §15 关联与影响

- **上游 spec**: P05 (`/wrongbook` 列表卡 tap) · P04 (`/result/{qid}` 保存后查看详情) · 推送/分享深链 `wb://wrongbook/{qid}`
- **下游 spec**: P08 (`/review/exec/{nid}` · 立即复习) · P05 (归档后 navigate + Snackbar) · P04 (编辑 ✏ 入)
- **关联 SC**: **SC-10 归档主流（本页是发起点）** · SC-05 P11 立即复习（CTA 共享语义） · SC-04 自评 FORGOT 后回 P06 可看时间线重排
- **关联 task**: feature_list.json SC-10 T-archive (主链) · T-undo (5s 撤销 P05 Snackbar) · T-outbox (calendar 补偿)
- **关联 audit**: audits/SC-01-PHASE-0/A02-wrongbook-api.md §1.1 #2/#6 (`/{qid}` `/archive`) + A05-review-plan.md §1.2 (`/nodes/{nid}/open` · spec drift 待 `/start` alias)
- **关联 mockup**: design/mockups/wrongbook/06_wrongbook_detail.html
- **关联实体**: `wb_question` / `wb_analysis_result` / `wb_review_plan` / `wb_review_node` / `wb_review_record` / `calendar_event` (跨服务 outbox)
