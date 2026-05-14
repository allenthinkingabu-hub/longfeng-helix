# P05 · 错题本列表 (WrongbookList)

**Status**: Active
**Owner**: design + frontend + backend
**Last-updated**: 2026-05-14
**Mockup**: design/mockups/wrongbook/05_wrongbook_list.html
**Biz refs**: biz/业务与技术解决方案_AI错题本_基于日历系统.md §2A.4 (P05 规格卡 L515-527) + §2B.2 SC-01 步 11 + §2B.11 SC-10 (归档)
**Related tasks**: feature_list.json SC-01 T07 (list-highlight-newest) · SC-10 后续 T-archive

---

## §1 页面目的

错题本"档案室"——把学生历史所有错题集中起来，支持三轴检索：①学科 chips ②掌握度 cards ③搜索（关键字 `pg_trgm` + 语义 `pgvector` 混合 RRF）。这是 P-HOME 之外学生最常进入的二级入口（Tab 2），既是 SC-01 黄金路径的"成果展示页"（步 11 高亮新入库题），也是 SC-10 归档场景的"撤销缓冲区"（归档后 Snackbar 5s 撤销）。给学生提供"以知识点找题 / 以掌握度找题 / 以语义找题"的认知抓手。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区 (zone 划分)

```
┌─────────────────────────────────────┐  顶部安全区 (54px)
├─────────────────────────────────────┤  导航栏 (大标题 "错题本" + 筛选 icon)
│  搜索框  [二次函数 顶点    [AI 语义]]│  搜索区 (含语义 Badge)
│  全部 128 · 数学 52 · 物理 31 ...    │  学科 chips 横滚
├─────────────────────────────────────┤
│  [42 未掌握] [35 部分] [51 已掌握]    │  掌握度 3 卡 Filter
│  按 下次复习时间 · 升序   共 42 条    │  排序 hint
│  ┌──────────────────────────────┐   │
│  │ ▌ thumb │ KP·学科·时间        │   │  错题卡 List (左色条 / thumb /
│  │         │ 题干 2 行           │   │   tags / 阶段进度 / due)
│  │         │ chips · 阶段 · 未掌握│   │
│  └──────────────────────────────┘   │
│  ...                                │
│                              [📷 FAB]│  右下 FAB (拍题)
├─────────────────────────────────────┤
│ 首页 · 错题本 · 拍题 · 复习 · 我的    │  Tab Bar (84px)
└─────────────────────────────────────┘  Home Bar
```

来源：biz §2A.4 「布局分区」+ mockup HTML `.nav` / `.content` / `.mr` / `.card` / `.fab` / `.tabbar`。

### 2.2 关键视觉锚 (mockup HTML 真 selector)

| Zone | DOM selector / class | 用途 |
|---|---|---|
| Header | `.nav .row h1` | 大标题"错题本" |
| Search | `.nav .search` | 搜索输入 + 右侧 `.search .ai` AI 语义 Badge |
| Subject chips | `.nav .chips-row .sc` | 学科横滚（含计数 `.ct`，`.sc.on` 选中态） |
| Mastery filter | `.content .mr .mf` | 3 卡（`.mf.red/orange/green` + `.mf.on` 选中条 `.bar`） |
| Sort hint | `.content .sort` | "按下次复习时间 · 升序" + 总条数 |
| Card | `.content .card` | 列表卡（`.left-bar.red/orange/green/blue` + `.thumb` + `.body` + `.right`） |
| Stage bar | `.card .stage-bar .sb` | 6 段进度（`.sb.done` 绿 / `.sb.now` 蓝渐变 / 默认灰） |
| Due | `.card .right .due` | "T1 · 1 小时后" / "T1 · 已逾期" |
| FAB | `.fab` | 右下 60px 圆形拍题入口 |
| Tab Bar | `.tabbar .tab.active` | 第二格"错题本"激活 |

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<P05PageHeader>` | frontend/apps/h5 | `{title, onFilterIconTap}` | 大标题 + 右上筛选 icon |
| `<SearchBar>` | frontend/packages/ui-kit | `{value, mode:'kw'\|'sem', onChange, onSubmit}` | 含 AI 语义 Badge · mode 切换 |
| `<SubjectChipsRow>` | frontend/packages/ui-kit | `{items:[{subject,count}], value, onChange}` | 学科横滚 chips（含计数） |
| `<MasteryFilterCards>` | frontend/packages/ui-kit | `{cards:[{mastery,count}], value, onChange}` | 3 卡 Filter（未掌握/部分/已掌握） |
| `<SortHint>` | frontend/packages/ui-kit | `{sort, total}` | "按 X · 升/降序" + 共 N 条 |
| `<QuestionCard>` | frontend/packages/ui-kit | `{item:QuestionListItem, highlighted?:boolean, onTap}` | 列表卡 · 高亮态绿色 border 3s · biz §2B.2 步 11 |
| `<StageBar>` | frontend/packages/ui-kit | `{nodeStage:0..6}` | 6 段阶段进度（done/now/future） |
| `<CaptureFAB>` | frontend/packages/ui-kit | `{onTap}` | 右下 60px FAB · 跳 P02 |
| `<EmptyState>` | frontend/packages/ui-kit | `{onCaptureTap}` | EMPTY 态引导首次拍题 |
| `<ArchiveSnackbar>` | frontend/packages/ui-kit | `{qid, onUndo, timeoutMs=5000}` | SC-10 归档后撤销条 |

来源：biz §2A.4 「核心组件」+ frontend/packages/ui-kit + mockup HTML 真组件名。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level State 绑定

```typescript
{
  list: {
    state: 'LOADING' | 'EMPTY' | 'LIST' | 'FILTERED' | 'HIGHLIGHTED' | 'ERROR',
    items: QuestionListItem[],
    total: number,
    filter: {
      subject: 'ALL' | 'MATH' | 'PHYSICS' | 'CHEMISTRY' | 'ENGLISH' | 'CHINESE',
      mastery: 'ALL' | 'NOT_MASTERED' | 'PARTIAL' | 'MASTERED',
      kp: string[],            // 知识点 code 多选
      q: string,               // 搜索关键字
      qMode: 'kw' | 'sem'      // 关键字 / 语义
    },
    sort: 'created_desc' | 'next_due_asc' | 'mastery_asc',
    page: number,
    highlightedQid?: string    // SC-01 步 11 入参
  },
  archive: { snackbarQid?: string, undoTimeoutMs: number }
}

// QuestionListItem (biz §2A.4 「数据绑定」)
{
  qid: string,
  subject: SubjectCode,
  kp: string[],
  stemSnippet: string,         // 题干 2 行截断
  thumb: string,               // 缩略图 URL / object_key
  masteryPct: number,          // 0-100
  masteryLabel: 'NOT_MASTERED' | 'PARTIAL' | 'MASTERED',
  nextDueAt: ISO8601,
  nodeStage: 0 | 1 | 2 | 3 | 4 | 5 | 6,  // 当前 T 节点序号
  createdAt: ISO8601
}
```

### 4.2 涉及的后端 Entity

- `wb_question` (wrongbook-service · status / subject / kp / stem / processed_image_key / embedding=vector(1024))
- `wb_review_plan` + `wb_review_node` (review-plan-service · 提供 nodeStage / nextDueAt)
- 检索辅助：`pg_trgm` GIN index on stem · `pgvector <=>` HNSW index on embedding

来源：biz §2A.4 「数据绑定」+ biz §4 DB schema (L1423 起 · pgvector + pg_trgm) + frontend/packages/api-contracts。

---

## §5 API 触点

> 字符级精准 path + method + query · 必须与 audits/SC-01-PHASE-0/A02-wrongbook-api.md §1.1 一致。

| # | Method | Path | Headers (req) | Query / Body (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/wb/questions` | `X-Student-Id`, `X-Request-Id` | query `subject` / `mastery` / `kp` / `q` / `qMode` / `page=1` / `size=20` / `sort` (+ 可选 `highlight={qid}` SC-01 步 11) | `200 QuestionListResp{items[], total, page, size, sort, filter}` · plain JSON | ≤ 500ms | 5xx → skeleton 保留 + 顶部 toast retry |
| 2 | POST | `/api/wb/questions/{qid}/archive` | `X-Request-Id` (幂等) | path `qid:String` · body 空 | `200 QuestionListItem` (status=ARCHIVED 快照) · 二次调用同帧 | ≤ 800ms | 5xx → Snackbar 退场 + 顶部 toast "归档失败,请重试" |
| 3 | POST | `/api/wb/questions/{qid}/unarchive` | `X-Request-Id` | path `qid:String` · body 空 | `200 QuestionListItem` (status=ACTIVE · 节点从撤销前 T 继续) | ≤ 800ms | 走 outbox 兜底 · UI 乐观更新 |

**搜索语义（biz §2A.4 「搜索」段明文 L524）**：

- `qMode=kw` → `q` 走 PostgreSQL `pg_trgm` 模糊匹配（`stem % :q` · GIN 索引）
- `qMode=sem` → `q` 先 embedding (text-embedding-3-small / 1024 维) → `embedding <=> :qVec` 走 `pgvector` HNSW 近邻
- `qMode` 未传 / 为空 → **混合排序 RRF**（Reciprocal Rank Fusion · 关键字 rank + 语义 rank 倒数和重排）
- 搜索框右侧"AI 语义" Badge (mockup `.search .ai`) 默认显示 · tap 切 mode

**注**：A02 audit §3.1 指出 `WrongbookSearchController` 落地路径 `/wrongbook/questions/search` (POST) 与 javadoc 声明的 `/api/wb/questions/search` 不一致，是 tech debt；**P05 spec 走 GET `/api/wb/questions?q=&qMode=`（A02 §1.1 #5 audited path）而不调 POST search**，故 SC-01 不阻塞。

来源：biz §2A.4 「API 触点」+ audits/SC-01-PHASE-0/A02-wrongbook-api.md §1.1 (字符级 path + query 7 参数) + §2 表格 #5/#6 (1:1 spec 对齐确认)。

---

## §6 状态机

```
                    GET /api/wb/questions?... in flight
       ┌─────────┐ ──────────────────► ┌─────────┐ items=[] ┌─────────┐
       │ LOADING │                     │  fetch  │─────────►│  EMPTY  │
       └─────────┘                     └─────────┘          └─────────┘
            │                                │                   │ Tap FAB
            │ 5xx                            │ items>0           ▼
            ▼                                ▼              (跳 P02)
       ┌─────────┐                      ┌─────────┐
       │  ERROR  │                      │  LIST   │◄──────┐
       └─────────┘                      └─────────┘       │
                                             │            │
                              filter change  │            │ highlight=qid (SC-01 步 11)
                                             ▼            │ 3s timer
                                       ┌──────────┐       │
                                       │ FILTERED │       │
                                       └──────────┘       │
                                             │            │
                                             ▼            │
                                       ┌─────────────┐    │
                                       │ HIGHLIGHTED │────┘
                                       └─────────────┘
                                       (border green 2px · 3s fade)
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| (mount) | LOADING | 进入 P05 | 拉 GET list · skeleton 渲染 |
| LOADING | EMPTY | `total=0` | 渲染 `<EmptyState>` + 引导 FAB |
| LOADING | LIST | `total>0` | 渲染卡片 + sort hint |
| LOADING | ERROR | HTTP 5xx | toast + retry button |
| LIST | FILTERED | filter chips / mastery / search 变更 | URL query 同步 + 重拉 GET |
| LIST | HIGHLIGHTED | SC-01 步 11 进入 `?highlight={qid}` | 第 1 卡 border green 2px · 触发 3s timer |
| HIGHLIGHTED | LIST | 3s timer expire | border fade-out 至默认态 |
| LIST | LIST (archive) | SC-10 步 4 跳回 P05 | 该卡从 items 移除 + Snackbar "已归档 · 撤销" 5s |

来源：biz §2A.4 「状态集」 + biz §2B.2 步 11 (`list.HIGHLIGHTED`) + biz §2B.11 SC-10 步 4 (mastery=ACTIVE 默认不含 ARCHIVED)。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| Tab 2 | Tab Bar | 学生 tap "错题本" |
| P04 保存 | P04 → P05 | save 200 后自动 push `?highlight={qid}` (biz §2B.2 步 11) |
| `wb://wrongbook` | Deep link | 推送 / 分享 / 小程序 |

| 出口 | 目标 | 触发条件 |
|---|---|---|
| 路由 push | P06 (`/wrongbook/{qid}`) | 学生 tap 任意 `.card` |
| 路由 push | P02 (`/capture`) | 学生 tap 右下 FAB · 埋点 `entry=p05-fab` |
| 路由 push | P02 (`/capture`) | EMPTY 态 tap "拍第一张错题" CTA |
| 路由 back | P-HOME | Tab 1 切换 |

来源：biz §2A.4 「跳转」+ biz §2A.3 IA 路由表 L229 (`P05 → /wrongbook → wb://wrongbook`)。

---

## §8 Wire format (SSE / WebSocket 事件)

本页无 SSE/WS 通道；事件通讯走 §5 HTTP 触点（GET list / POST archive / POST unarchive）。SC-10 归档后的级联（节点 CANCELLED + 日历 event DELETE）通过 MQ `question.archived` 在后端异步完成，前端只 poll 或下次拉列表看效。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| 列表 5xx | GET `/api/wb/questions` 失败 | skeleton 保留 + 顶部 toast "加载失败,点击重试" | 自动重试 1 次 → 仍失败保留上一份缓存 | — |
| 空状态 | `total=0` (新用户 / 全归档) | `<EmptyState>` "还没有错题,拍一道试试" + 蓝色 CTA | tap 跳 P02 | — |
| `highlight={qid}` 不在 list | qid 已被归档 / 过滤掉 | 正常渲染 list (不高亮 / 不抛错) | fallback：仅滚到顶部 | T07 TI1 |
| 搜索无结果 | `pg_trgm` + `pgvector` 均 0 命中 | 列表区显示"没有找到 '{q}' 相关错题" + 建议 chips | 保留 filter / 允许重输 | — |
| 归档后 5s 内撤销 | tap Snackbar "撤销" | Snackbar 关闭 + 列表前端乐观恢复该卡 | POST `/api/wb/questions/{qid}/unarchive` · 节点从撤销前 T 继续 (biz §2B.11 步 5) | TC-10.02 |
| 归档级联失败 | calendar event 删除失败 | (后端 outbox 兜底 · 前端无感) | outbox 1 min 内补偿；question.ARCHIVED 不受影响 | TC-10.03 |
| Snackbar 期间退出 App | 5s 内退后台 | 回来后 Snackbar 已消失 | 列表持久化不含该题；撤销改从"我的-已归档"入 | TC-10.04 |

来源：biz §2A.4 「异常 & 降级」（隐含 LOADING/EMPTY/ERROR 状态）+ biz §2B.11 SC-10 QA 用例 TC-10.01~04 + feature_list.json T07 test_invariants TI1。

---

## §10 验收点 (TC → AC 映射)

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-01.01 (步 11) | 正常 (highlight) | P04 save 200 · `?highlight={qid}` push | P04 淡出后 P05 mount | ≤ 500ms 渲染 · 第 1 卡 qid 匹配 · 绿色 border 2px 3s 后 fade · 滚动置顶 (scrollY=0) · 埋点 `wb_list_view{highlightedQid}` 1 条 | T07 AC1/AC2/AC3 |
| TC-01.01 (步 11) | 正常 (卡片) | 同上 | 列表渲染完成 | 高亮卡左色条 + 学科 chip + KP chips + 难度 ★ + 6 段 stage bar (T0 done · T1-T6 future) + 下次到期 全部渲染 | T07 AC4 |
| T07-TI1 | 异常 | `?highlight={qid}` 但 qid 已不在 list (被归档/过滤) | 列表 mount | list 正常渲染 · 不高亮 · 不抛错 | T07 TI1 |
| T07-TI2 | 边界 | 高亮态 | 3s timer expire | border fade-out 至默认 · 不残留 | T07 TI2 |
| TC-10.01 | 正常 (归档) | qid=200 在 P05 list · 用户从 P06 归档 | SC-10 步 1-4 | 该卡从 list 移除 · 顶部 Snackbar "已归档 · 撤销" 5s · GET `?mastery=ACTIVE` 默认不含 ARCHIVED | — |
| TC-10.02 | 正常 (撤销) | TC-10.01 后 5s 内 | tap Snackbar "撤销" | POST `/unarchive` 200 · 卡复原 · 节点从撤销前 T 继续 · 埋点 `wb_archive_undo` 1 条 | — |
| TC-10.03 | 异常 (级联) | 步 3 calendar 删除失败 | 等待补偿 | outbox 1 min 内消失 · P05 状态不受影响 · question.ARCHIVED 持久 | — |
| TC-10.04 | 边界 | TC-10.01 Snackbar 期间退后台 | 超 5s 回前台 | Snackbar 已消失 · 列表不含该题 | — |

来源：biz §2B.2 步 11 + biz §2B.11 SC-10 QA 用例 TC-10.01~04 + feature_list.json T07 acceptance_criteria + test_invariants。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| P04 → P05 跳转 + 首屏渲染 | ≤ 500ms | biz §2B.2 步 11 「耗时预算」 |
| GET `/api/wb/questions` 返回 | ≤ 500ms | spec §5 行级 budget |
| 高亮卡绿色 border 持续 | 3000ms ± 100ms | biz §2B.2 步 11 "绿色高亮 3 s" + T07 AC3 |
| 学科 chip / mastery card 切换重拉 | ≤ 400ms | spec §5 + UI 体感预算 |
| POST `/api/wb/questions/{qid}/archive` | ≤ 800ms | spec §5 行级 budget |
| Snackbar 撤销窗口 | 5000ms 固定 | biz §2B.11 步 4 "持续 5s" |
| 上拉加载下一页 (size=20) | ≤ 600ms | spec §5 + 分页体感预算 |

来源：biz §2B.2 步 11「耗时预算」+ biz §2B.11 SC-10 + spec §5 行注。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `wb_list_view` | P05 mount + GET 200 | `{total, highlightedQid?, subject, mastery}` | biz §2A.4 + §2B.2 步 11 + §2A.8 埋点字典 L671 |
| `wb_list_filter` | 学科 / mastery 切换 | `{subject, mastery}` | biz §2A.4 |
| `wb_list_search` | 搜索提交 | `{q, mode: 'kw' \| 'sem', resultCount}` | biz §2A.4 + §2A.8 L671 |
| `wb_list_tap` | 学生 tap 任意卡 | `{qid, position}` | biz §2A.4 |
| `wb_archive_success` | POST archive 200 后 P05 收到 | `{qid}` | biz §2B.11 步 4 |
| `wb_archive_undo` | tap Snackbar "撤销" 成功 | `{qid}` | biz §2B.11 步 5 |

来源：biz §2A.4 「埋点事件」L527 + biz §2A.8 埋点字典 (`wb_list_search` L671) + biz §2B.11 (`wb_archive_success` / `wb_archive_undo`)。

---

## §13 testid 表

| testid | 用途 | 出现位置 (mockup / testids) | E2E 引用 |
|---|---|---|---|
| `wrongbook.list.root` | P05 页面根 | `TEST_IDS.wrongbookList.root` L112 | t07-list-highlight-newest.spec.ts mount |
| `p05-page-header` | 顶部导航容器 | `TEST_IDS.wrongbookList['page-header']` L125 | header smoke |
| `p05-page-header-title` | 大标题"错题本" | L126 | header 文案断言 |
| `p05-page-header-search` | 搜索框 input | L127 + mockup `.search` | search e2e |
| `p05-page-header-semantic-badge` | "AI 语义" Badge | L128 + mockup `.search .ai` | qMode 切换 e2e |
| `p05-subject-chips` | 学科 chips 横滚 | L129 + mockup `.chips-row` | filter e2e |
| `p05-mastery-status` | 掌握度 3 卡 Filter | L130 + mockup `.mr` | filter e2e |
| `p05-sort-bar` | 排序 hint 条 | L131 + mockup `.sort` | sort 切换 |
| `wrongbook.list.item-card` | 单张错题卡 | `TEST_IDS.wrongbookList['item-card']` L117 + mockup `.card` | T07 highlight 第 1 卡 |
| `wrongbook.list.filter-subject` | 学科 chip 单个 | L114 | filter e2e |
| `wrongbook.list.load-more` | 上拉加载触发 | L120 | 分页 e2e |
| `wrongbook.list.skeleton` | LOADING 态 | L122 | loading 4 态 VRT |
| `wrongbook.list.empty` | EMPTY 态容器 | L121 + `p05-empty-state` L133 | empty VRT |
| `p05-empty-capture-btn` | EMPTY 态首拍 CTA | L134 | empty → P02 跳转 |
| `p05-fab-capture` | 右下 FAB | L132 + mockup `.fab` | FAB → P02 跳转 |
| `wrongbook.list.tabbar-wrongbook` | Tab Bar 第二格 | L123 + mockup `.tab.active` | nav |

来源：frontend/packages/testids/src/index.ts L111-135 (`TEST_IDS.wrongbookList.*`) + mockup HTML 真 selector。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `wrongbookList.title` | 错题本 | Wrongbook | 大标题 |
| `wrongbookList.search.placeholder` | 搜索题干 / 知识点 | Search stems or KP | 搜索框 placeholder |
| `wrongbookList.search.semanticBadge` | AI 语义 | AI Semantic | 搜索右侧 Badge |
| `wrongbookList.subject.all` | 全部 | All | 学科 chip "全部" |
| `wrongbookList.mastery.notMastered` | 未掌握 | Not Mastered | 掌握度卡 |
| `wrongbookList.mastery.partial` | 部分掌握 | Partial | 掌握度卡 |
| `wrongbookList.mastery.mastered` | 已掌握 | Mastered | 掌握度卡 |
| `wrongbookList.sort.nextDueAsc` | 按下次复习时间 · 升序 | By next due · asc | sort hint |
| `wrongbookList.empty.title` | 还没有错题 | No wrong items yet | EMPTY 态标题 |
| `wrongbookList.empty.cta` | 拍第一道错题 | Capture first | EMPTY 态 CTA |
| `wrongbookList.archive.snackbar` | 已归档 · 撤销 | Archived · Undo | SC-10 Snackbar |
| `wrongbookList.archive.fail` | 归档失败,请重试 | Archive failed, retry | archive 5xx toast |

来源：biz §2A.4 「i18n Key」（隐含 · 上表对照 mockup HTML 文案）+ frontend/packages/i18n/（待补）。

---

## §15 关联与影响

- **上游 spec**: P-HOME (Tab 2 入口) · P04 (save 后 push `?highlight={qid}` SC-01 步 11) · P06 (归档后跳回 SC-10 步 4)
- **下游 spec**: P06 (`/wrongbook/{qid}` · tap 卡) · P02 (`/capture` · FAB / EMPTY CTA)
- **关联 task**: feature_list.json SC-01 T07 (list-highlight-newest · 主) · 后续 SC-10 archive task (T-archive)
- **关联 audit**: audits/SC-01-PHASE-0/A02-wrongbook-api.md §1.1 #5 (list) + #6 (archive)
- **关联 mockup**: design/mockups/wrongbook/05_wrongbook_list.html
