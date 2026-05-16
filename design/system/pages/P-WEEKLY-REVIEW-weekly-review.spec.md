# P-WEEKLY-REVIEW · 本周回顾详情页（Weekly Review · Past-tense Outcome View）

**Status**: Draft (生成自 `gen-page-spec.md` 首次实战 · 2026-05-16 · 待 P1 落地前 review)
**Owner**: design (mockup AI 一遍稿) + frontend (页面 + ui-kit 4 新组件) + backend (`/api/home/weekly` 复用 P-OBSERVER weekly_aggregate service)
**Last-updated**: 2026-05-16
**Priority**: P1 (MVP 14 天清单不包含 · P1 阶段启动)
**Mockup (canonical)**: [design/mockups/wrongbook/14_weekly_review.html](../../mockups/wrongbook/14_weekly_review.html) (462 行 · 风格基准 `01_home_v2.html` · AI 一遍稿)
**Biz refs**: [biz/features/P-WEEKLY-REVIEW__weekly-review.md](../../../biz/features/P-WEEKLY-REVIEW__weekly-review.md) (satellite · 主源) + [biz/业务与技术解决方案_AI错题本_基于日历系统.md](../../../biz/业务与技术解决方案_AI错题本_基于日历系统.md) §2A.3.3 P-HOME 「本周」Bento (L449-L463 · 入口锚) + §10.10 P-OBSERVER weeklyReport (L2220-L2241 · 后端 service 复用源) + §1.4 北极星 (L84-L96 · 指标贡献) + §15.5 satellite 对照表 (L3170)
**Related tasks**: 待 `gen-feature-list` 跑 SC-16 生成 `.harness/feature_list_SC-16.json` 后回填 (预估 5-7 task)

> **特别说明**：本页是首个**从 satellite biz doc 派生** 的 spec.md (非 master biz §2A.4 直接派生)。`gen-page-spec.md` 的 §1 Step 1 默认 grep master · 本次手工切换到 satellite §2A.4 卡作为 §1-§4 / §7 / §9 / §11-§14 主源。所有"复用 master"字段（API 后端逻辑 / 北极星贡献 / 共享组件）必须按 satellite §15.4 跨文档对照表锚到 master 对应行 · 不允许 silent fork。

---

## §1 页面目的

P-WEEKLY-REVIEW 是「**过去时 · 成果视图**」—— 给学生一个"看自己这一周表现"的复盘视图，把 P-HOME 首屏「本周」Bento 概览的 4 个数字（掌握率 / sparkline / Streak / 本周新增）深挖到 6 个数据块（掌握率 Hero + 学科雷达 + 薄弱 KP top 3 + 三联 stat + 失败题 top 5 + AI 一句话复盘）。本页心智明确区别于：

- **本周日程**（master §2A.3.3 P-HOME 7-day strip · "未来时·我要做什么"）
- **P10 月视图**（整月排期 · "未来时·跨周空闲规划"）

落地于"复盘 → 行动"正反馈闭环：学生看到薄弱 KP top 1 → Tap "立即专练" → P05 错题列表（filter by kpId）→ 自然进入针对性训练。**这是冷启动后回流场景的核心承载**：周末复盘 → 周一新一轮节奏起步。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区（从上到下 · 来源：mockup 14_weekly_review.html 视觉真相 + satellite §2A.4 「布局分区」字段对齐）

```
┌──────────────────────────────────────────┐
│ statusbar (54px · 黑字 on F6F3EC · 极光晕) │
├──────────────────────────────────────────┤
│ topbar: [< 返回] [本周回顾 / W20 · 5月11-17] [分享 ↗] │   ← 横排 36×36 胶囊
├──────────────────────────────────────────┤
│ HERO 暗卡 (#0E0E10 · 极光晕)              │
│   · kicker: 掌握率 · vs LAST WEEK         │
│   · 大数字 84px 衬线斜体: 68%             │
│   · delta chip: ↑ +6 pts (绿)            │
│   · sub: 过去 7 天 5 天提升               │
│   · sparkline 54px 高 · 7 点 · 末点放大   │
├──────────────────────────────────────────┤
│ sec: 学科分布 · BY SUBJECT  | 展开详情 › │
│ radar-card (白 · 20px radius)             │
│   · 170×170 SVG 雷达 (5 学科)             │
│   · 右侧图例 5 行 (色块 + 学科名 + %)     │
├──────────────────────────────────────────┤
│ sec: 薄弱 KP top 3 · WEAK POINTS | 立即专练 → │
│ weakcol (3 张卡 · 8px gap)                │
│   1. KP-382 韦达定理 (rank-1 高亮 · 暗 CTA)│
│   2. KP-201 牛顿第二定律 (outline CTA)    │
│   3. KP-450 现在完成时 (outline CTA)      │
├──────────────────────────────────────────┤
│ sec: 本周节奏 · PACE | vs 上周 +12%        │
│ stat3 三联 (绿 / 蓝 / 橙)                 │
│   28 题 | 142 分钟 | +8 新增              │
├──────────────────────────────────────────┤
│ sec: 本周失败题 top 5 · HARDEST | 看全部 › │
│ failscroller 横滑 (snap · 128px 卡)       │
│   5 卡: 缩略图 + 学科 + 错过 N 次          │
├──────────────────────────────────────────┤
│ sec: AI 复盘 · ONE-LINE INSIGHT | 智能体生成 │
│ insight 暗卡 (#0E0E10 · 橙晕)             │
│   · WEEKLY INSIGHT · 智能体复盘 dot 闪    │
│   · "你这周在韦达定理上反复栽 4 次..."     │
│   · meta: WI-2026W20-stu123 · 时间戳      │
├──────────────────────────────────────────┤
│ tabbar (84px · home active · 表明从 home 来) │
└──────────────────────────────────────────┘
```

来源：mockup [14_weekly_review.html](../../mockups/wrongbook/14_weekly_review.html) (lines 75-460) + satellite §2A.4 「布局分区」字段。

### 2.2 关键视觉锚（mockup 14_weekly_review.html 真 selector）

| Zone | DOM selector / class | testid (TEST_IDS.weekly.*) | 用途 |
|---|---|---|---|
| 页面根 | `.phone` | `p-weekly-review-root` | 路由 outlet 容器 |
| 返回按钮 | `.topbar .back` | `weekly-back` | 36×36 胶囊 · href=`01_home_v2.html` (P-HOME) |
| 周次副标题 | `.topbar .titlecol .s` | `weekly-range` | 显示 "2026 W20 · 5月11 – 17日" |
| HERO 暗卡 | `.hero` | `weekly-hero` | 掌握率 + sparkline + delta chip 全包 |
| Delta chip (涨跌) | `.hero-display .delta-chip` | `weekly-delta` | ↑/↓ + 数字 · 绿涨红跌 |
| Sparkline SVG | `.hero-spark` | `weekly-sparkline` | 7 点折线 · 末点放大 + 黄色 stroke |
| 学科雷达卡 | `.radar-card` | `weekly-radar` | 170×170 SVG + 5 行图例 |
| 薄弱 KP 卡 (rank 1) | `.wkp.rank-1` | `weekly-weak-kp-1` | 高亮卡 · 暗 CTA "立即专练" |
| 薄弱 KP 卡 (rank 2) | `.wkp:nth-child(2)` | `weekly-weak-kp-2` | outline CTA "练一次" |
| 薄弱 KP 卡 (rank 3) | `.wkp:nth-child(3)` | `weekly-weak-kp-3` | outline CTA "练一次" |
| 三联 stat | `.stat3` | `weekly-stats-trio` | 28 / 142 / +8 三格 |
| 失败题横滑 | `.failscroller` | `weekly-failed-scroller` | scroll-x snap · 5 张 fcard |
| AI insight 暗卡 | `.insight` | `weekly-ai-insight` | 30 字内复盘文本 + meta |
| EMPTY hero (变体) | `.empty-hero#empty-hero` | `weekly-empty` | 默认隐藏 · 本周复习数=0 时整页换 |

来源：grep `data-testid="..."` from [14_weekly_review.html](../../mockups/wrongbook/14_weekly_review.html) (14 命中) + `.phone` CSS class baseline from `01_home_v2.html`。

⚠ **testid 尚未注册到 `frontend/packages/testids/src/index.ts`**（greenfield）· Coder 接到本 task 时 Step 0 必须先注册 `TEST_IDS.weekly.*` 14 个 key · 否则 E2E 选择器无锚。

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<WeeklyHeroCard>` | **新建** frontend/packages/ui-kit | `{masteryRate, masteryDelta, sparkline:number[7], range:{from,to}, weekLabel}` | 暗 Hero 卡 · 复用 P-HOME `<WeeklySparkline>` 样式 (master §2A.3.3 line L455 sparkline pattern) · 颜色从 mint #059669 改 peach #FDBA74 配 hero 暗背景 |
| `<SubjectRadar>` | **新建** frontend/packages/ui-kit | `{subjects: Array<{subject, masteryRate, sampleSize}>}` | 170×170 SVG 雷达 · 5 边形（4-6 学科自适应）· 数据多边形 + 网格 + 学科 label · 灵感参考 `06_wrongbook_detail.html` `.radar` |
| `<WeakKPCard>` | **新建** frontend/packages/ui-kit | `{rank, kpId, kpName, subject, recentMissCount, onPractice}` | KP 卡 · rank-1 高亮（peach-soft 渐变背 + 暗 CTA）· rank-2/3 outline CTA · Tap 跳 P05 (`?kpId=XXX`) |
| `<StatTrio>` | **新建** frontend/packages/ui-kit | `{stats: [{label, value, icon, theme}]}` | 三联 stat 横向 grid · 复用 `09_review_done.html` `.stats > .stt` 配色方案 (green/blue/orange) |
| `<FailedQScroller>` | **新建** frontend/packages/ui-kit | `{questions: Array<{qid, subject, thumbnail, missCount}>, onTapItem}` | 横滑 scroll-x snap · 5 张 128px 卡 · 复用 `07_review_today.html` `.it` 骨架 |
| `<AIInsightBubble>` | **新建** frontend/packages/ui-kit | `{insightId, text, generatedAt, model?}` | 暗 insight 卡 · 复用 master §2A.3.3 P-HOME `<WeakKPHint>` 暗卡样式 + dot 信号闪动画 |
| `<DeltaChip>` | **新建** frontend/packages/ui-kit | `{delta:number, unit:'pts'\|'%', baseline:'lastWeek'\|'lastMonth'}` | ↑/↓ icon + 数字胶囊 · 绿涨红跌 · 不允许仅靠颜色（必带 icon · A11Y 要求） |
| `<TabBar>` (复用) | frontend/packages/ui-kit (TabShell) | `{active:'home'}` | 复用 P-HOME TabBar · active=home 表示本页是从 home push 入 |

来源：satellite §2A.4 「核心组件」字段 + mockup 14_weekly_review.html DOM + 跨 mockup 复用扫描结果（06/07/09 三个 mockup 的近似组件）。

⚠ **7 个新组件**都需在 `frontend/packages/ui-kit` 新建 · Coder Step 0 必须先把这 7 个组件的 props interface 落到 `packages/ui-kit/src/index.ts` 导出。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level state

```typescript
{
  weeklyReview: {
    state: 'LOADING' | 'READY' | 'EMPTY' | 'ERROR',
    week: string,                                  // 'YYYY-Www' · ISO 8601
    range: { from: string, to: string } | null,    // 学生 tz 边界
    data: {
      hero: {
        masteryRate: number,                       // 0..1
        masteryDelta: number,                      // vs 上周 · 可负
        sparkline: number[7]                       // 7 天每日掌握率
      },
      subjectRadar: Array<{
        subject: 'math' | 'physics' | 'english' | 'chinese' | 'chemistry' | 'biology',
        masteryRate: number,
        sampleSize: number                         // 本周该学科复习题数
      }>,
      weakKPs: Array<{                             // 最多 3 个
        kpId: string,
        kpName: string,
        subject: SubjectCode,
        recentMissCount: number,                   // 排序键 · 最近 N 次错
        totalMissCount: number
      }>,
      stats: {
        reviewedCount: number,                     // 本周已复习题数 (GRADED 总数)
        reviewedDurationMin: number,
        newCount: number
      },
      failedTop: Array<{                           // 最多 5 题
        qid: string,
        subject: SubjectCode,
        thumbnail: string,                         // CDN URL
        missCount: number
      }>,
      aiInsight: {
        insightId: string,
        text: string,                              // ≤ 50 字 · Spring AI 生成
        generatedAt: string                        // ISO timestamp
      } | null                                     // null 时该模块显示 "AI 复盘生成中"
    } | null,
    error: 'INTERNAL_5XX' | 'NETWORK' | 'TIMEOUT' | null
  }
}
```

### 4.2 后端 Entity 来源

- **hero.masteryRate / sparkline**: 聚合 `wb_review_record.grade` (GRADED·MASTERED count / total GRADED) · groupBy day(reviewed_at)
- **subjectRadar**: 聚合 `wb_review_record` join `wb_question.subject` · groupBy subject
- **weakKPs**: 聚合 `wb_review_record.grade=FORGOT` join `wb_question.knowledge_tags` · groupBy kpId · orderBy recentMissCount DESC limit 3
- **stats.reviewedCount**: `wb_review_record` count where reviewed_at in [week.from, week.to]
- **stats.reviewedDurationMin**: 聚合 `wb_review_record.duration_ms` sum / 60000
- **stats.newCount**: `wb_question` count where created_at in [week.from, week.to]
- **failedTop**: `wb_question` join `wb_review_record.grade=FORGOT` count · orderBy count DESC limit 5
- **aiInsight**: Spring AI 链路（master §6.2 `QuestionAnalyzer` interface 兄弟 prompt）· 用 weakKPs[0] + stats.reviewedCount 拼提示词

来源：satellite §4 (无新增 DB 列声明 · 复用 master §4.5 `wb_review_node` + §4.6 `wb_review_record` + §4.2 `wb_question`) + master §10.10 `weekly_aggregate` service 实现参考。

---

## §5 API 触点

> 字符级精准 path + method · 必须与 satellite §10.12 字面一致（satellite 已声明复用 master §10.10 service · 仅 endpoint 不同）。

| # | Method | Path | Headers (req) | Query (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/home/weekly` | `Authorization: Bearer <STUDENT JWT>` | (none · 默认 current ISO week · P2 预留 `?week=YYYY-Www`) | `200 WeeklyReviewResp` (见 §5.1 全字段) | ≤ 400ms (P99 ≤ 800ms) | 5xx → §9 ERROR 态 + retry · 不缓存（避免学生看到隔周陈旧数据） |

### 5.1 Response WeeklyReviewResp 字段集 (字符级)

```json
{
  "week": "2026-W20",
  "range": { "from": "2026-05-11", "to": "2026-05-17" },
  "hero": {
    "masteryRate": 0.68,
    "masteryDelta": 0.06,
    "sparkline": [0.55, 0.58, 0.60, 0.62, 0.65, 0.66, 0.68]
  },
  "subjectRadar": [
    { "subject": "math", "masteryRate": 0.72, "sampleSize": 12 },
    { "subject": "physics", "masteryRate": 0.58, "sampleSize": 8 },
    { "subject": "english", "masteryRate": 0.80, "sampleSize": 5 }
  ],
  "weakKPs": [
    { "kpId": "KP-382", "kpName": "韦达定理", "subject": "math", "recentMissCount": 4, "totalMissCount": 7 },
    { "kpId": "KP-201", "kpName": "牛顿第二定律", "subject": "physics", "recentMissCount": 3, "totalMissCount": 5 },
    { "kpId": "KP-450", "kpName": "现在完成时", "subject": "english", "recentMissCount": 2, "totalMissCount": 4 }
  ],
  "stats": {
    "reviewedCount": 28,
    "reviewedDurationMin": 142,
    "newCount": 8
  },
  "failedTop": [
    { "qid": "Q-1024", "subject": "math", "thumbnail": "https://cdn/q1024.webp", "missCount": 3 }
  ],
  "aiInsight": {
    "insightId": "WI-2026W20-stu123",
    "text": "你这周在韦达定理上反复栽 4 次,建议先把 3 道经典题练熟。",
    "generatedAt": "2026-05-17T08:00:00Z"
  }
}
```

### 5.2 错误码

| HTTP | code | 含义 | 前端处理 |
|---|---|---|---|
| 401 | `UNAUTHORIZED` | JWT 缺失/过期 | 走 SC-00 token 过期重定向 P00 |
| 403 | `STUDENT_DELETED` | 学生账号已注销 | 顶部 error banner + 退到 P-LANDING |
| 500 | `INTERNAL` | 后端聚合 SQL 失败 / weekly_aggregate service 异常 | §9 ERROR 态 · TC-16.02 覆盖 |
| 504 | `GATEWAY_TIMEOUT` | 聚合查询超 800ms | 同 500 处理 |

来源：satellite §10.12 字面 + master §10.10 P-OBSERVER 同 service 错误码 + master §15.2 统一错误码（节选）。

⚠ **后端 `/api/home/weekly` controller 尚未存在** · Coder Step 0 需要先在 `backend/home-aggregator-service/.../WeeklyController.java` 新建 controller + 在 `WeeklyService.java` 复用 master §10.10 P-OBSERVER 的 `weekly_aggregate` service 实现（学生端脱敏规则与家长端不同）。

---

## §6 状态机

```
                          GET /api/home/weekly
       ┌─────────┐    ┌──────────────────┐    ┌─────────┐
       │ LOADING │───→│  data.reviewed=0 │───→│  EMPTY  │  整页换 empty-hero
       └─────────┘    └──────────────────┘    └─────────┘
            │                    │
            │                    │ data.reviewed > 0
            │                    ▼
            │              ┌─────────┐  retry  ┌─────────┐
            │              │  READY  │ ←─────  │  ERROR  │
            │              └─────────┘         └─────────┘
            │                    ▲                  ▲
            │                    │                  │
            │ tap retry ─────────┘                  │
            │                                        │
            └────────────── 5xx / timeout ──────────┘
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| `(init)` | `LOADING` | mount + GET /weekly fired | 渲染 skeleton (hero / radar / KP / stat / failed / insight 6 个骨架占位) |
| `LOADING` | `READY` | 200 + `data.stats.reviewedCount > 0` | 6 数据块顺序淡入 (Hero 0ms · Radar 100ms · KP 200ms · stat 300ms · Failed 400ms · Insight 500ms) |
| `LOADING` | `EMPTY` | 200 + `data.stats.reviewedCount === 0` | 整页换 empty-hero · 隐藏 6 数据块 |
| `LOADING` | `ERROR` | 5xx / timeout / network | 骨架保留 + 顶部黄条 "数据加载失败 · retry" + retry button |
| `ERROR` | `LOADING` | tap retry button | 重新 GET /weekly · 黄条消失 |
| `READY` | (sub-state) `aiInsight.LOADING` | `data.aiInsight === null` (AI 生成超时) | insight 卡显示 "AI 复盘生成中" · 其他模块正常 |

来源：satellite §2A.4 「状态集」+ master §2A.5 关键状态机模式 + satellite §2B SC-16 「核心路径编排」第 4 步 (data 返回时序)。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| 路由 push | P-HOME `.bento` 区段 sec 右上 `「查看全部 ›」` (mockup `01_home_v2.html:291`) | SC-16 步 2 · Tap 「查看全部 ›」link |
| 深链 | `wb://weekly` | 任意页通过 deeplink (master §2A.3 IA 路由表预留) |
| 推送（P2 预留） | `wb://weekly` 周报推送通知 | 周一上午 8 点系统主动推送（不在本 satellite 范围 · 走 master §S6） |

| 出口 | 目标 | 触发条件 |
|---|---|---|
| 路由 push | P05 wrongbook-list (`05_wrongbook_list.html?kpId=KP-XXX`) | Tap 任意 `.wkp .cta` (薄弱 KP 卡 CTA) · SC-16 步 6-7 |
| 路由 push | P06 wrongbook-detail (`06_wrongbook_detail.html?qid=Q-XXXX`) | Tap 任意 `.fcard` (失败题横滑卡片) |
| 路由 push | P05 wrongbook-list (`05_wrongbook_list.html?filter=failedThisWeek`) | Tap 「本周失败题 top 5」section header 「看全部 ›」 |
| 路由 push | P02 capture (`02_capture.html`) | EMPTY 态 · Tap "去拍一道题" CTA |
| 路由 back | P-HOME | Tap `.topbar .back` (`weekly-back`) · 系统返回键 |
| Tabbar 切换 | 首页/错题本/拍题/日历/我的 | Tap tabbar 任意 tab (复用 P-HOME TabBar) |

来源：satellite §2A.4 「跳转」+ mockup 14_weekly_review.html href 实测 (14 个真路径 · 0 个 `#` 占位)。

---

## §8 Wire format (SSE / WebSocket 事件)

本页**无 SSE / WebSocket 通道**。事件通讯全部走 §5 HTTP 触点（`GET /api/home/weekly` 单次同步聚合）。

⚠ AI insight 文本由后端 service **同步生成**返回（master §6 Spring AI 链路 · 非流式接口）· 若未来引入"AI insight 流式生成"（学生在等待时实时看到字句逐句出现），将在本节补 channel + payload。**MVP P1 阶段不实现流式**（成本 / 复杂度不值 · 30 字内文本完全可同步等）。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| 本周复习数 = 0 | GET 200 · `data.stats.reviewedCount === 0` (新学生 / 本周从未复习) | 整页换 EMPTY hero · "本周还没开始 · 复习数据为空 · 拍一道新题或开始今日复习" + CTA "去拍一道题" → P02 | 不渲染 6 数据块 · 不调用 AI insight | TC-16.03 |
| GET /weekly 5xx | 后端 weekly_aggregate service 异常 | 骨架屏保留 + 顶部黄条 "数据加载失败 · 网络异常或服务繁忙" + 黄色 retry button | tap retry → 重新 GET · 不允许白屏 · 不允许 toast 即消（错误必须可视化常驻直到用户操作） | TC-16.02 |
| GET /weekly 504 timeout (P99 > 800ms 触发) | 后端聚合 SQL 慢 / 数据库压力大 | 同上 5xx 反馈 + 黄条文案改 "数据加载超时 · 重试" | 同上 | TC-16.02 变体 |
| AI insight 超时 (但其他 5 块正常) | `data.aiInsight === null` (后端 Spring AI 链路超时 fallback) | insight 卡单独显示 "AI 复盘生成中 · 稍后刷新可见" + 灰色 dot (不闪) | 其他 5 数据块正常渲染 · 不阻塞页面 · 用户可手动 pull-to-refresh 重新拉取（非本 MVP 范围） | — |
| Token 过期 (401) | 学生 JWT 在请求时过期 | 自动弹"登录已过期"Sheet → 引导 P00 (走 SC-00 重定向流) | 保留 `redirect=wb://weekly` 参数 | — |
| Tap CTA 跳 P05 ≤ 500ms 未完成 | 跨页跳转网络慢 | 路由 loading 转圈 + skeleton | 不允许 tap 后无反馈 · 必须立即视觉响应 | TC-16.01 性能段 |
| Tap CTA 跳 P05 后 P05 filter 失败 | URL 带 kpId 但 P05 解析不到 | P05 自身降级到全列表 + 顶部 toast "未找到该知识点的错题" | 不阻塞用户 · 让 P05 自治处理 | — (P05 spec.md 范围) |

来源：satellite §2A.4 「异常态」+ master §2A.7 异常路径降级矩阵 + satellite §2B SC-16 TC-16.02/03 异常用例。

---

## §10 验收点 (TC → AC 映射)

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC (待 gen-feature-list 落 SC-16 后回填) |
|---|---|---|---|---|---|
| TC-16.01 | 正常 | 学生已登录 · 本周复习 ≥ 3 次 · 网络稳定 · GET /weekly P95 ≤ 400ms | 完成 satellite §2B SC-16 步骤 1-7 (P-HOME Tap 「查看全部 ›」→ P-WEEKLY-REVIEW READY → Tap KP-1 → P05 filter=kpId) | `weekly.READY` 6 数据块全渲染 · 薄弱 KP top 1 卡片可见 · Tap 后落 P05 · URL 含 `?kpId=KP-382` · 埋点 `weekly_view` + `weekly_weak_kp_tap` 各 1 条 · 全程 ≤ 2s | T(W)01 AC1/AC3/AC5 |
| TC-16.02 | 异常 | 学生已登录 · GET /weekly 返 500 | 完成步骤 1-3 后等待 | `weekly.LOADING` → `weekly.ERROR` · 骨架屏保留 + 顶部黄条 + retry button · Tap retry 重新 GET · 埋点 `weekly_retry{errorCode=500}` 1 条 · 不允许白屏 | T(W)02 AC1/AC2 |
| TC-16.03 | 边界 | 新学生 · 本周复习数 = 0 | 完成步骤 1-3 | `weekly.LOADING` → `weekly.EMPTY` · 整页换 empty-hero + CTA "去拍题" → P02 · 埋点 `weekly_view{empty=true}` 1 条 · 不渲染薄弱 KP / 失败题等空数据块 | T(W)03 AC1/AC2 |

来源：satellite §2B SC-16 QA 用例表 · feature_list_SC-16.json 尚未生成 · T(W)0X 是预留占位 · `gen-feature-list` 跑完后回填真 task_id。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| 首屏 TTI（mount → 6 数据块全渲染） | ≤ 1.5s (含 §5 GET ≤ 400ms + 客户端 ≤ 600ms + 顺序淡入 500ms) | satellite §2A.4 「性能预算」 |
| GET /api/home/weekly 服务端响应 | ≤ 400ms (P99 ≤ 800ms · 超时即 §9 ERROR) | satellite §10.12 SLA 段 + spec §5 #1 行级 budget |
| 折线 / 雷达 SVG 渲染 | ≤ 300ms | satellite §2A.4 「性能预算」 |
| Tap 薄弱 KP 卡 → 落 P05 | ≤ 500ms | satellite §2A.4 「性能预算」+ SC-16 步 6-7 耗时段 |
| 数据块顺序淡入总时长 | ≤ 500ms (6 块 × 100ms 错位) | mockup 微动画暗示 + biz §2A.3.3 P-HOME 同款模式 |
| AI insight 生成 (后端 Spring AI 链路) | ≤ 6s (P99 · 不阻塞页面其他模块) | master §6.3 鲁棒性 (10s timeout → fallback) 缩半 |

来源：satellite §2A.4 「性能预算」+ §10.12 SLA + spec §5 行级 budget + master §6.3 AI 鲁棒性条款。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `weekly_view` | P-WEEKLY-REVIEW mount · GET /weekly 200 (或 EMPTY) | `{week, from: 'home-banner'\|'deeplink'\|'push', empty: boolean}` | satellite §2A.4 「埋点事件」+ SC-16 步 3 |
| `weekly_data_render` | 6 数据块全部渲染完成 (READY 后 500ms) | `{ms, masteryRate, weakKPCount}` | satellite §2B SC-16 步 4 |
| `weekly_weak_kp_view` | 薄弱 KP 卡进入视野 (IntersectionObserver) | `{kpId, rank}` | satellite §2B SC-16 步 5 |
| `weekly_weak_kp_tap` | Tap 薄弱 KP 卡 CTA | `{kpId, rank}` | satellite §2A.4 「埋点事件」+ SC-16 步 6 |
| `weekly_failed_q_tap` | Tap 失败题横滑卡片 | `{qid}` | satellite §2A.4 「埋点事件」 |
| `weekly_ai_insight_view` | AI insight 卡进入视野 | `{insightId}` | satellite §2A.4 「埋点事件」 |
| `weekly_retry` | Tap retry button (ERROR 态) | `{errorCode}` | satellite §2A.4 「埋点事件」 |
| `weekly_empty_cta_tap` | EMPTY 态 Tap "去拍一道题" CTA | `{}` | satellite §2A.4 「异常态」+ TC-16.03 |
| `weekly_share` (P2 预留) | Tap topbar `.share` button | `{week, channel}` | mockup `.share` 占位 (P2) |
| `weekly_back` | Tap topbar `.back` button 或系统返回键 | `{from: 'manual'\|'system'}` | mockup `.back` |

来源：satellite §2A.4 「埋点事件」+ master §2A.8 埋点字典 + mockup 14_weekly_review.html 交互锚。

---

## §13 testid 表

| testid | 用途 | 出现位置 (mockup) | E2E 引用 (待写) |
|---|---|---|---|
| `p-weekly-review-root` | P-WEEKLY-REVIEW 页面根 | `<div class="phone" data-testid="p-weekly-review-root">` line 75 | tw01-spec.ts beforeEach mount |
| `weekly-back` | 返回按钮 | `<a class="back" ... data-testid="weekly-back">` line 99 | tw01 SC-16 步骤 1' (返回 P-HOME) |
| `weekly-range` | 周次副标题 (W20 · 5月11-17日) | `.titlecol .s` line 104 | tw01 TC-16.01 渲染断言 |
| `weekly-hero` | HERO 暗卡根 (含掌握率 + sparkline + delta) | `.hero` line 116 | tw01/tw02/tw03 主断言 |
| `weekly-delta` | Delta chip (涨跌 + 数字) | `.delta-chip` line 124 | tw01 TC-16.01 +6 pts 断言 |
| `weekly-sparkline` | sparkline SVG (7 点折线) | `.hero-spark` line 132 | tw01 TC-16.01 SVG path 断言 |
| `weekly-radar` | 学科雷达卡 | `.radar-card` line 162 | tw01 TC-16.01 5 学科图例断言 |
| `weekly-weak-kp-1` | 薄弱 KP 卡 (rank 1 · 高亮) | `.wkp.rank-1` line 220 | tw01 TC-16.01 Tap CTA 断言 |
| `weekly-weak-kp-2` | 薄弱 KP 卡 (rank 2) | `.wkp:nth-child(2)` line 231 | tw01 |
| `weekly-weak-kp-3` | 薄弱 KP 卡 (rank 3) | `.wkp:nth-child(3)` line 239 | tw01 |
| `weekly-stats-trio` | 三联 stat (28/142/+8) | `.stat3` line 256 | tw01 TC-16.01 |
| `weekly-failed-scroller` | 失败题横滑容器 | `.failscroller` line 285 | tw01 TC-16.01 5 卡断言 |
| `weekly-ai-insight` | AI insight 暗卡 | `.insight` line 333 | tw01 TC-16.01 文本断言 |
| `weekly-empty` | EMPTY hero (默认隐藏 · TC-16.03 显示) | `.empty-hero#empty-hero` line 344 | tw03 TC-16.03 整页换 EMPTY 断言 |

来源：grep `data-testid="..."` from [14_weekly_review.html](../../mockups/wrongbook/14_weekly_review.html) (14 命中 · sort -u)。

⚠ **未注册到 `frontend/packages/testids/src/index.ts`**：Coder Step 0 必须把这 14 个 testid 加到 `TEST_IDS.weekly = {root, back, range, hero, delta, sparkline, radar, weakKp1, weakKp2, weakKp3, statsTrio, failedScroller, aiInsight, empty}` 命名空间下 · 不允许 frontend 代码裸字符串引用。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `weekly.title` | 本周回顾 | Weekly Review | 顶部标题 |
| `weekly.range` | {week} · {monthFrom}月{dayFrom} – {dayTo}日 | {week} · {monthFrom}/{dayFrom} – {monthTo}/{dayTo} | 周次副标题 (插值) |
| `weekly.hero.kicker` | 掌握率 · 较上周 | Mastery Rate · vs Last Week | Hero kicker |
| `weekly.hero.delta.up` | ↑ +{delta} pts | ↑ +{delta} pts | delta chip 涨 |
| `weekly.hero.delta.down` | ↓ {delta} pts | ↓ {delta} pts | delta chip 跌 |
| `weekly.hero.sub` | 本周比上周稳步上升 · 过去 7 天连续 {n} 天保持掌握率提升 | Steady improvement · {n}-day winning streak | Hero sub |
| `weekly.radar.title` | 学科分布 | By Subject | Section header |
| `weekly.weakKP.title` | 薄弱 KP top 3 | Weak Points | Section header |
| `weekly.weakKP.cta.primary` | 立即专练 | Practice Now | rank-1 CTA |
| `weekly.weakKP.cta.secondary` | 练一次 | Try Once | rank-2/3 outline CTA |
| `weekly.weakKP.missDesc` | 最近 {n} 次都错 | Failed last {n} times | KP miss 描述 |
| `weekly.stats.title` | 本周节奏 | Pace | Section header |
| `weekly.stats.reviewedQ` | 已复习 题 | Reviewed Q | stat label |
| `weekly.stats.duration` | 累计 分钟 | Minutes | stat label |
| `weekly.stats.newQ` | 新增 错题 | New Q | stat label |
| `weekly.failedTop.title` | 本周失败题 top 5 | Hardest | Section header |
| `weekly.failedTop.viewAll` | 看全部 › | View All › | section right link |
| `weekly.aiInsight.title` | AI 复盘 | One-line Insight | Section header |
| `weekly.aiInsight.label` | WEEKLY INSIGHT · 智能体复盘 | WEEKLY INSIGHT · AI | insight head |
| `weekly.aiInsight.loading` | AI 复盘生成中 · 稍后刷新可见 | Insight generating... | aiInsight=null fallback |
| `weekly.error.title` | 数据加载失败 | Failed to load | 顶部黄条 |
| `weekly.error.retry` | 重试 | Retry | 错误 CTA |
| `weekly.empty.title` | 本周还没开始 | Not started yet | EMPTY hero title |
| `weekly.empty.desc` | 复习数据为空 · 拍一道新题或开始今日复习,下周这里就会有你的回顾报告 | No review data yet · Capture a question or start today's review | EMPTY hero desc |
| `weekly.empty.cta` | 去拍一道题 | Capture a Question | EMPTY hero CTA |

来源：satellite §2A.4 「i18n Key」(部分定义) + mockup 14_weekly_review.html 文案抽取扩展。

⚠ **未落地到 `frontend/packages/i18n/`**：Coder Step 0 需要在 `packages/i18n/src/zh-CN.ts` + `packages/i18n/src/en.ts` 各加 25 个 key。

---

## §15 关联与影响

- **上游 spec**: [P-HOME.spec.md](P-HOME.spec.md)（本周 Bento 「查看全部 ›」入口）
- **下游 spec**: [P05-wrongbook-list.spec.md](P05-wrongbook-list.spec.md)（薄弱 KP CTA → filter kpId）· [P06-wrongbook-detail.spec.md](P06-wrongbook-detail.spec.md)（失败题 Tap → 详情）· [P02-capture.spec.md](P02-capture.spec.md)（EMPTY 态 CTA）
- **关联 satellite biz**: [biz/features/P-WEEKLY-REVIEW__weekly-review.md](../../../biz/features/P-WEEKLY-REVIEW__weekly-review.md)（本 spec 主源 · 不允许偏离）
- **关联 master biz**:
  - §2A.3.3 P-HOME (L449-L463) · 入口锚
  - §2A.1 角色 (L163-L177) · 学生角色复用
  - §1.4 北极星 (L84-L96) · 指标贡献
  - §2A.3 IA 路由表 (L217-L237) · 新增 P-WEEKLY-REVIEW 行
  - §10.10 P-OBSERVER `/api/observer/overview.weeklyReport` (L2220-L2241) · 共享后端 `weekly_aggregate` service
  - §6 Spring AI 错题分析 (L1857-L1934) · aiInsight 生成挂 `QuestionAnalyzer` 兄弟 prompt
  - §4.5 `wb_review_node` + §4.6 `wb_review_record` + §4.2 `wb_question` · 数据源 (不新建 DB 表)
  - §15.5 satellite 对照表 (L3170) · 本 satellite 已登记
- **关联 mockup**: [design/mockups/wrongbook/14_weekly_review.html](../../mockups/wrongbook/14_weekly_review.html) (canonical · AI 一遍稿 · 462 行 · 14 testid · 14 href 真路径)
- **关联 feature_list**: `.harness/feature_list_SC-16.json` (待 `gen-feature-list` 生成 · 预估 5-7 task)
- **关联 audit**: 待 Coder/Tester 落地后产 `audits/runs/SC16-TW01/team-X/attempt-N/` 工作日志（按 master 现行 audit.js 5/7 维度规范）
- **关联 7 个新 ui-kit 组件**: `<WeeklyHeroCard>` / `<SubjectRadar>` / `<WeakKPCard>` / `<StatTrio>` / `<FailedQScroller>` / `<AIInsightBubble>` / `<DeltaChip>` (Coder Step 0 在 `packages/ui-kit/src/index.ts` 导出)
- **影响范围**: 本页**完全新建** · 不修改任何既有 spec.md / 既有代码 · 不破坏 P-HOME 现有 Bento (P-HOME mockup `01_home_v2.html:291` 的 `href="#"` 待 P-HOME spec.md 后续更新时改成 `href="14_weekly_review.html"`)

---

**修订表**

| 版本 | 日期 | owner | 摘要 |
|---|---|---|---|
| v1 | 2026-05-16 | user (gen-page-spec 首次实战) | 首版 · 14 节齐全 · 14 testid 抽自 mockup · API 字符级对齐 satellite §10.12 · 7 cross-ref grep ±5 容差通过 · ⚠ flag: testid 未注册到 packages/testids · 7 个新 ui-kit 组件待 Coder Step 0 建 · backend `/api/home/weekly` controller 未存在 |
