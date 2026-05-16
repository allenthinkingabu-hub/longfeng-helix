# Skill: gen-biz-doc

> **用途**：把一份"模糊的新需求 + mockup/截图/口述"凝结成 `biz/features/<FEATURE_ID>__<slug>.md` (satellite biz doc · 增量章节 + 显式引用 master) · 并自动 patch 主 biz §15.5 跨文档对照表
> **触发**：用户说「为 <feature> 起草业务文档」/「补 P-XXX 落地页方案」/「satellite biz: <topic>」/「这块功能缺需求文档,按主 biz 格式起一份」
> **owner**：user · 首版于 2026-05-16 P-WEEKLY-REVIEW 缺口对话时验证落地
> **配套**：上游需要 mockup HTML + 用户口述需求 · 下游触发 [gen-page-spec.md](gen-page-spec.md) (page → spec.md) + [gen-feature-list.md](gen-feature-list.md) (SC → feature_list.json)

---

## 0 · 调用参数

| 参数 | 必填 | 示例 | 默认 |
|---|---|---|---|
| `FEATURE_ID` | ✓ | `P-WEEKLY-REVIEW` (有页) / `M-PARENT-WEEKLY-PUSH` (纯模块) | — |
| `SLUG` | ✓ | `weekly-review` / `parent-weekly-push` | kebab-case · 必须与 FEATURE_ID 语义一致 |
| `MASTER_BIZ` | — | `biz/业务与技术解决方案_AI错题本_基于日历系统.md` | 仓库唯一 master doc |
| `OUTPUT_PATH` | — | `biz/features/P-WEEKLY-REVIEW__weekly-review.md` | `biz/features/${FEATURE_ID}__${SLUG}.md` |
| `PRIORITY` | ✓ | `P0` (MVP) / `P1` / `P2` | — · 缺失自检不过 |
| `FORCE` | — | `--force` 覆盖已存在文件 | 不传则先 Read + 询问 |

---

## 1 · 方法论（6 步 · 严格按序 · Step 2/3 可并发 spawn sub-agent）

### Step 1 · 锚定主 biz 坐标

`grep -n "^### 2A\.3\|^### 2A\.4\|^### 2B\.\|^### 15\." $MASTER_BIZ` 拿到所有相关章节锚 + line number。Read：
- §2A.3 IA 路由表（看新 FEATURE_ID 应该插在哪一行后）
- §2A.4 已有页面卡（看 schema 15 行 + 15-16 列字段顺序）
- §2B SC 总览表（看下一个未用 SC-NN 序号）
- §15 附录区（找到 §15.4 末尾位置 · 决定 §15.5 子表插入点）

**输出**：master doc 锚点表 · 7-10 行 · 每行带 file:line。

### Step 2 · 并发缺口诊断 (spawn 2 Explore agents)

派 2 个 Explore agent 并发跑（Phase-0 风格 · 不互见）：
- **agent-A**: 扫 §2A 所有 page card · grep `FEATURE_ID` 或语义相关 keyword · 报告"主 biz 是否已有对应 page" + line number
- **agent-B**: 扫 §2B 全部 SC card + §10 API 契约 · grep keyword · 报告"主 biz 是否已有对应 SC / API" + line number

**输出**：缺口诊断表 · 每行: 缺什么 / 主 biz 哪一段最接近但不够 / 为什么不能 patch 现有段而要新写 satellite (这一条是关键 · 是 satellite 而非 master patch 的依据)。

### Step 3 · 并发草拟核心增量 (spawn 2 sub-agents)

派 2 个 agent 并发：
- **agent-page**: 按主 biz §2A.4 卡 schema 草拟 1 张新页面卡 (15 行表 · 列照抄 master · 含路径 / 首屏目标 / 布局分区 / 核心组件 / 数据绑定 / API 触点 / 状态集 / 跳转 / 异常态 / i18n / 埋点 / 可访问性 / 性能预算 / 优先级)
- **agent-SC**: 按主 biz §2B SC 卡 schema 草拟 1 个新 SC 卡 (叙事 header + 编排表 ≥7 步 + ≥3 QA TC · 含正常 1 + 异常 1 + 边界 1)

**输出**：page card draft + SC card draft (markdown)。

### Step 4 · cross-ref grep 校验

对 Step 1 拿到的每个 master 锚 + Step 2/3 draft 里引用的每个 `master §X (LNNN)`：
- `sed -n '${LNNN-5},${LNNN+5}p' $MASTER_BIZ` 看 ±5 行容差内是否能看到对应主题词
- 不通过的 → 修正 line number 或换更近的锚
- mockup HTML 路径 → `ls $MOCKUP_PATH` 真存在；不存在则在 page card 里写 `weekly_review.html (待补 mockup)` 字面 · 禁 invent

**输出**：cross-ref 验证表 · 每行 master §X + line + ±5 grep 命中证据。

### Step 5 · 强制 AskUserQuestion 闸 (落盘前)

把以下 3 张表 surface 给用户：
1. **§0 增量摘要表 draft** (类型 / ID / 名称 / 优先级 / Owner)
2. **§15.4 跨文档对照表 draft** (satellite §X ↔ master §X · 每行带 ±5 容差证据)
3. **打算 patch 主 biz 的位置** (例: §15 末尾追加 §15.5 子表 · 显示具体 line number)

调 `AskUserQuestion` 询问至少这 3 件事：
- "边界对吗?(新增的 page / SC / API 数量 + 优先级)"
- "应不应该 promote 成 master doc?(若 ≥5 个新 SC 或文档预估 ≥800 行)"
- "主 biz §15.5 插入位置对吗?"

**用户 OK 后才进 Step 6 落盘**。

### Step 6 · 落盘 satellite + 自动 patch 主 biz §15.5

按 §2 模板完整生成 `${OUTPUT_PATH}` (`Write` 工具)。

落盘成功后**立即**自动 patch master biz：
- 用 `Read` 找到 §15 末尾位置（最后一个 `### 15.X` 之后）
- 用 `Edit` 在那之后追加新 `### 15.5 与 satellite biz docs 对照表` 子表（如果 §15.5 已存在则只追加一行）
- 表头: `| Satellite | 覆盖范围 | 优先级 | 创建日期 |`
- 新增行: `| [biz/features/${FEATURE_ID}__${SLUG}.md](features/${FEATURE_ID}__${SLUG}.md) | <一句话覆盖范围> | ${PRIORITY} | ${YYYY-MM-DD} |`

**输出**：satellite 落点 + master patch 行 + 触发下游 skill 命令 (gen-page-spec / gen-feature-list)。

---

## 2 · satellite 文档模板 (本 skill 最大章节 · 严格按序 · 节号匹配 audit citation `satellite §X`)

````markdown
# ${FEATURE_ID} · ${中文标题} — Satellite Biz Doc

**Status**: Draft | Reviewed | Locked
**Owner**: ${OWNER} (frontend / backend / full-stack)
**Created**: ${YYYY-MM-DD}
**Priority**: ${P0|P1|P2}
**Master ref**: [biz/业务与技术解决方案_AI错题本_基于日历系统.md](../业务与技术解决方案_AI错题本_基于日历系统.md) (v1.x)
**Mockup**: design/mockups/wrongbook/${NN}_${slug}.html (或 `(待补 mockup)`)

---

## §0 TL;DR

(一段话 · 3-5 句 · 说明本 satellite 解决的问题 + 与主 biz 哪个缺口关联)

### 0.1 增量摘要表 [REQUIRED]

| 类型 | ID | 名称 | 优先级 | Owner |
|---|---|---|---|---|
| 新页面 | ${PAGE_ID} | ${中文名} | ${P0|P1|P2} | frontend |
| 新 SC | SC-${NN} | ${中文名} | ${P0|P1|P2} | full-stack |
| 新 API | ${METHOD} ${PATH} | ${用途} | ${P0|P1|P2} | backend |
| 新 DB 列 | ${TABLE}.${COL} | ${用途} | ${P0|P1|P2} | backend |
| 复用 | (列出复用 master 的 entity / table / API) | — | — | — |

---

## §1 业务目标增量

### 1.1 涉及角色 (引用 master §2A.1 · 不重新定义)
- 角色 X (引用 master §2A.1 行 NNN)
- 角色 Y (引用 master §2A.1 行 NNN)

### 1.2 MVP 边界 (本次做什么 / 故意不做什么)
- 本次做: ...
- 故意不做 (P1+): ...

### 1.3 北极星指标贡献 (引用 master §1.4)
- 本增量预计贡献 master §1.4 哪条北极星 (例: 提升周留存 ≥ X%)

---

## §2A.3 IA 增量

### 2A.3.1 新路由行 (插入 master §2A.3 路由表)

插入位置: master §2A.3 路由表第 ${N} 行后 (line ${LNNN})

| ID | 页面 | 小程序路径 | H5 路由 | 深链 | 登录态 | 源 HTML 稿 |
|---|---|---|---|---|---|---|
| ${PAGE_ID} | ${中文名} | `pages/.../...` | `/...` | `wb://...` | 正式账号 | ${NN}_${slug}.html (待补) |

### 2A.3.2 深链规则 (如有新增 wb://)
- `wb://...` → ${PAGE_ID} (语义说明)

---

## §2A.4 新页面卡 [REQUIRED if 有新页]

#### ${PAGE_ID} · ${中文名}

| 维度 | 内容 |
|---|---|
| **页面目的** | (3-5 句 · 给学生 / 给业务 / 给系统的价值) |
| **首屏目标 (≤3s 注意力)** | ① ... ② ... ③ ... |
| **布局分区**（从上到下） | `[zone1]` → `[zone2]` → `[zone3]` ... |
| **核心组件** | `<Comp1>` (新建 in ui-kit) · `<Comp2>` (复用 from ${master_ref}) ... |
| **数据绑定** | Page-level state shape · 涉及的 DTO 名称 |
| **API 触点** | (列出 §10 增量的接口 path · 复用的接口写 "复用 master §10.X") |
| **状态集** | `state1` → `state2` → `state3` (引用 §2A.5 状态机若复用) |
| **跳转** | 入: ... · 出: ... |
| **异常态** | `异常 1`: ... · `异常 2`: ... |
| **i18n Key** | `feature.title` · `feature.action` ... |
| **埋点事件** | `${prefix}_view` · `${prefix}_tap_xxx` ... |
| **可访问性** | (color contrast / aria-label / tab order 等关键约束) |
| **性能预算** | 首屏 TTI ≤ ${X}s · GET /api/... ≤ ${Y}ms |
| **优先级** | ${P0|P1|P2} |

---

## §2B 新 SC 卡 [REQUIRED if 有新场景]

### 2B.${N} SC-${NN} · ${场景名}

**场景目的**：(1-2 句 · 为什么需要这个场景 · 解决什么用户痛点)

**前置条件**：前置 SC: SC-00 路由分发已落 ${入口页} (学生已登录态)；${其他前置}

**核心路径编排（happy path）**：

| # | 用户动作 | 页面前台 | 后端/事件 | 前端状态 | 埋点 | 耗时预算 |
|---|---|---|---|---|---|---|
| 1 | (动作描述) | (UI 反馈) | (API + 状态机) | (state) | (event{props}) | ≤ Xs |
| 2 | ... | ... | ... | ... | ... | ... |
| 3 | ... | ... | ... | ... | ... | ... |
| ... (≥ 7 步) | ... | ... | ... | ... | ... | ... |

**关键断言点（System Invariants）**：
- (断言 1 · 不变量描述)
- (断言 2)
- (断言 3)
- (断言 4)

**QA 用例（GIVEN / WHEN / THEN）**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-${NN}.01 | 正常 | (前置) | (动作) | (期望) |
| TC-${NN}.02 | 异常 | (异常前置 · 例 API 5xx) | (动作) | (降级期望) |
| TC-${NN}.03 | 边界 | (边界前置 · 例 数据为空) | (动作) | (边界期望) |

---

## §4 DB 增量 [OPTIONAL · 仅在新增表/列/索引时出]

### 4.${N} 新表 / 新列 / 新索引

```sql
-- 新建表
CREATE TABLE wb_${name} (...);
-- 或: 给已有表加列
ALTER TABLE wb_${existing} ADD COLUMN ${col} ${type};
```

复用说明: 本 satellite 复用 master §4.X 的 `${table}` (不新建)。

---

## §10 API 增量 [OPTIONAL · 仅在新增接口时出]

### 10.${N} ${中文用途}

```
${METHOD} ${PATH}
Headers: ...
Body: ${ReqSchema}
Resp: 200 ${RespSchema}
Err:  4XX ${ErrCode}
```

复用说明: 本 satellite 复用 master §10.X 的 `${endpoint}` (不新建)。

---

## §12 部署增量 [OPTIONAL · 仅在落地节奏与 master 既有 S-stage 不一致时出]

归入 master ${SX} stage 的 checklist · 增 ${N} 条具体步骤 (列出)。
或新建 ${S11+} stage (列出工作量 + 工具 + 验证脚本)。

---

## §15.4 跨文档对照表 [REQUIRED]

本 satellite ↔ master 的双向引用清单 (skill 落盘时自动 grep 校验 ±5 行容差):

| satellite §X | master § | 行号 | 关系 |
|---|---|---|---|
| §2A.4 ${PAGE_ID} | master §2A.3.3 (P-HOME 入口锚) | L${NNN} | 落地页补缺 |
| §10 ${新接口} | master §10.X (复用后端逻辑) | L${NNN} | 共享 service |
| §1.3 北极星 | master §1.4 北极星指标 | L${NNN} | 增量贡献 |
| ... | ... | ... | ... |

---

## §16 Next Steps

落地本 satellite 后的下游动作：
- 触发 [gen-page-spec.md](../../.harness/skills/gen-page-spec.md): `为 ${PAGE_ID} 写 spec.md` → 生成 `design/system/pages/${PAGE_ID}-${SLUG}.spec.md`
- 触发 [gen-feature-list.md](../../.harness/skills/gen-feature-list.md): `为 SC-${NN} 生成 feature_list` → 生成 `.harness/feature_list_SC-${NN}.json`
- (可选) 补 mockup HTML: design 同学画 `design/mockups/wrongbook/${NN}_${slug}.html`
- (可选) 主 biz §15.5 patch 已自动追加 1 行 · 用户人工 review

---

**修订表**

| 版本 | 日期 | owner | 摘要 |
|---|---|---|---|
| v1 | ${YYYY-MM-DD} | ${owner} | 首版 · gen-biz-doc skill 生成 |
````

---

## 3 · 反作弊红线（CLAUDE.md Rule 1 / Rule 3 / Rule 9 / Rule 12 项目化）

1. **禁 silent duplicate master 既有章节**：master 已有的 §3 DDD / §5 架构 / §6 AI 链路 / §7 艾宾浩斯 / §8 日历集成 / §11 NFR / §15.1 BOM / §15.2 错误码 / §15.3 目录树 → satellite **必须只引用不复制**。同主题 copy ≥ 5 行原文 = 自检不过。
2. **禁 invent SC/Page ID**：新 SC 号必须 `grep -E "^### 2B\.[0-9]+ SC-[0-9]+" $MASTER_BIZ` 取下一个未用编号 (master 当前到 SC-15 → satellite 起 SC-16)。新 Page ID 必须 `grep -E "^\| P-?[A-Z0-9-]+" $MASTER_BIZ §2A.3` 确认不冲突。
3. **禁 fork DDD entity**：satellite 不允许自定义新 aggregate / entity / value object。要新 entity 必须先 surface 给用户决定是否回 patch master §3 · 不允许偷偷在 satellite §4 里加。
4. **禁 invent mockup path**：每个 mockup 引用必须 `ls design/mockups/wrongbook/${NN}_*.html` 真存在；不存在的必须字面写 `${NN}_${slug}.html (待补 mockup)` · 不允许编路径。
5. **强制 P0/P1/P2 标注**：§0.1 增量摘要表每行必须有 `优先级` 字段；§2A.4 新页面卡末行必须有 `优先级` 维度；§2B 新 SC 卡叙事 header 必须含 `(优先级: PX)`。缺失 → 阻断落盘。
6. **强制 cross-ref 可点击**：§15.4 跨文档对照表每行 `master §X (L${NNN})` 必须用 `sed -n '${NNN-5},${NNN+5}p' $MASTER_BIZ` 在 ±5 行容差内能看到对应主题词。grep 不通过 → 阻断落盘。
7. **强制双向治理**：satellite 落盘后**必须**自动 patch 主 biz §15.5 子表追加 1 行；patch 失败 (例如 §15 不存在 / Edit 报错) → satellite 立即回滚 (`rm` 已落盘文件) + 阻断 + 报告失败原因。**防止 satellite 孤立**。
8. **强制体量上限**：satellite ≤ 800 行。超过 → 自检不过 + surface 给用户讨论是否 promote 成独立 master doc (而非 satellite)。
9. **禁省略修订表**：末尾必须有 `**修订表**` 段 · 至少 v1 一行 · 含 owner + 日期 + 摘要。

---

## 4 · 与其他工具的边界

- 本 skill **只生成 satellite biz doc + patch master §15.5**。不生成 `design/system/pages/*.spec.md` (那是 [gen-page-spec.md](gen-page-spec.md) 的产物)、不生成 `.harness/feature_list*.json` (那是 [gen-feature-list.md](gen-feature-list.md) 的产物)、不写代码 / 测试 / mockup HTML。
- 三件套流水线顺序：**gen-biz-doc (本 skill) → gen-page-spec → gen-feature-list**。本 skill 是 source of truth 上游；其他两个 skill 的 `BIZ_DOC` 参数若指向本 satellite，可顺利下游展开。
- 与 master biz doc 的关系：satellite 是 **deferred extension**，master 是 single source of truth。satellite 永远引用 master · 反向 master §15.5 子表登记 satellite。两者形成双向闭环。**禁止** satellite fork 后失联。
- 与 `anthropic-skills:scenario-driven-tdd-planner` 的区别：那个 skill 输出 multi-SC + multi-phase 的整体落地计划 (横跨整个项目)。本 skill 只产 1 个 satellite biz doc (横跨 1 个 feature)。下游可用。
- 与 ADR (architecture decision record) 的区别：ADR 记录架构决策 + 理由 + tradeoff (例如 "为什么用 PostgreSQL pgvector 而不是独立向量库")。本 skill 产品需求 + 技术方案。两者正交。

---

## 5 · 用法示例

```
用户: 为本周回顾详情页起草业务文档
```

执行步骤（P-WEEKLY-REVIEW 案例 · 6 步走）：

1. **Step 1 锚定**: `grep -n "^### 2A\.3\|^### 2A\.4\|^### 2B\.\|^### 15\." biz/业务与技术解决方案_*.md` → 拿到 §2A.3 (L213) / §2A.3.3 P-HOME (L449) / §2A.4 (L464) / §2B 总览 (L749) / §15.4 末尾 (L3171)
2. **Step 2 并发缺口诊断**: spawn agent-A 扫 §2A 报告"无 P-WEEKLY-REVIEW page card" + agent-B 扫 §2B 报告"SC-05 提及'首页条带→日历'但无'本周回顾'动线"
3. **Step 3 并发草拟**: spawn agent-page 写 15 行 page card · agent-SC 写 7 步编排 + 3 TC SC card · 标 Priority=P1
4. **Step 4 cross-ref grep 校验**: §15.4 表里每个 `master §X (LNNN)` 用 sed ±5 行容差验证；mockup `14_weekly_review.html (待补 mockup)` 字面写入（design 还没画）
5. **Step 5 AskUserQuestion**: surface §0.1 增量摘要表 (1 page / 1 SC / 1 GET API / 0 DB · P1) + §15.4 cross-ref 表 (3 行) + "主 biz §15 末尾 (L3171) 插入 §15.5" · 用户 OK
6. **Step 6 落盘 + 自动 patch**:
   - `Write biz/features/P-WEEKLY-REVIEW__weekly-review.md` (~300 行)
   - `Edit biz/业务与技术解决方案_AI错题本_基于日历系统.md` 在 §15.4 后追加 `### 15.5 与 satellite biz docs 对照表` + 1 行 `| [biz/features/P-WEEKLY-REVIEW__weekly-review.md] | 学生周回顾详情页 + SC-16 + GET /api/home/weekly | P1 | 2026-05-16 |`
7. **报告**: 输出 satellite 路径 + master patch 行号 + 下游命令: `为 P-WEEKLY-REVIEW 写 spec.md` / `为 SC-16 生成 feature_list`

---

## 6 · Skill 自检 checklist (生成后必跑)

- [ ] satellite 文件 ≤ 800 行 (`wc -l` 验证)
- [ ] satellite 含 ≥ 6 个 `^## §` 章节 (§0 / §1 / §2A.3 / §2A.4 / §2B / §15.4 / §16 是 [REQUIRED])
- [ ] §0.1 增量摘要表每行带 Priority (P0/P1/P2 之一)
- [ ] §2A.4 新页面卡 15 行无 `TBD` / 无空格 / 无 `???`
- [ ] §2B 新 SC 卡 ≥ 3 TC (含正常 1 + 异常 1 + 边界 1 · `grep -c "^| TC-" ${OUTPUT_PATH}` ≥ 3)
- [ ] §15.4 跨文档对照表每行 `master §X (L${NNN})` 用 sed ±5 行容差 grep 通过
- [ ] mockup 路径要么 `ls` 真存在 · 要么字面含 `(待补 mockup)`
- [ ] master biz §15.5 子表已存在且包含本 satellite 一行 (`grep -n "${FEATURE_ID}__${SLUG}" $MASTER_BIZ` 命中 §15.5 段内)
- [ ] §16 Next Steps 含 `gen-page-spec` + `gen-feature-list` 两个下游命令
- [ ] 末尾修订表 ≥ v1 一行 · 含 owner + 日期 + 摘要
- [ ] markdown 合法 (无悬挂代码块 / 表格列数对齐)

打钩全过 → 报告满意度：satellite 路径 + master patch 行号 + 下游 skill 命令 (用户复制即跑)。

---

**修订表**

| 版本 | 日期 | owner | 摘要 |
|---|---|---|---|
| v1 | 2026-05-16 | user | 首版 · 在 P-WEEKLY-REVIEW 缺口对话时落地 · 三件套 (本 skill → gen-page-spec → gen-feature-list) 上游 |
