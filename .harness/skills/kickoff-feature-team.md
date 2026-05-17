# Skill: kickoff-feature-team

> **用途**：把一个已经做完 4 件套(satellite biz + mockup + spec + feature_list)的 feature → 一份**完全 self-contained 的 TL Agent 启动 prompt** · TL 拿到 prompt 不需要看任何对话上下文即可串行派 team 跑 Stage 1 Test-Case-First 6-phase 流程
> **触发**：用户说「启动 TL Agent 开发 <FEATURE>」/「让 TL 派一个 team 跑 <SC>」/「kickoff <FEATURE>」/「开始开发 <FEATURE>」/「派活给 TL 跑 <SC>」
> **owner**：user · 首版于 2026-05-18 M-AI-ANSWER-JUDGE 4 件套完成后落地
> **配套**：上游必须完成 [gen-biz-doc.md](gen-biz-doc.md) + [gen-mockup.md](gen-mockup.md) + [gen-page-spec.md](gen-page-spec.md) + [gen-feature-list.md](gen-feature-list.md) 四件套 · 否则本 skill 阻断

---

## 0 · 调用参数

| 参数 | 必填 | 示例 | 默认 |
|---|---|---|---|
| `FEATURE_ID` | ✓ | `M-AI-ANSWER-JUDGE` / `M-MULTI-QUESTION-CAPTURE` / `P-WEEKLY-REVIEW` | — |
| `SC_LIST` | ✓ | `SC-20,SC-21,SC-22` (要跑的 SC 列表 · 决定 task 总数) | — · 必须在 satellite §2B 真存在 |
| `TEAM_COUNT` | — | `1` (串行 · 推荐) / `2` (backend + frontend 并行 · 仅复杂 feature) | **1** · 大于 1 必须 surface 给用户确认 |
| `BRANCH_NAME` | — | `feature/M-AI-ANSWER-JUDGE-team-1` | `feature/${FEATURE_ID}-team-${N}` |
| `START_TASK` | — | `SC-20-T01` (从某个 task 起 · 续跑场景) | feature_list 第 1 个 task |
| `OUTPUT_PATH` | — | `/tmp/tl-kickoff-${FEATURE_ID}.md` | 直接 inline 输出给用户复制 (不落盘默认) |

---

## 1 · 平台优先约定 (本项目铁律 · 2026-05-18 用户拍板 · 不可破)

> **微信小程序优先 · H5 不急** — 任何 feature 的 frontend 实装 · `frontend/apps/mp/` (微信小程序原生 TS + Vant Weapp) 必须先做 · `frontend/apps/h5/` (Vite 5 + React 18 + Konsta UI) 可推后到 P1.5 / P2 · 不阻塞 satellite 落地。

**强制要求** (TL Agent prompt 必含):
- 每个 frontend task 的 `primary_services` 字段必含 `frontend/apps/mp/...`
- frontend task 的 H5 实装 (`frontend/apps/h5/...`) 留 TODO comment · 不在本批次做
- 测试维度: E2E 跑 mp 端 · H5 E2E 留空 / 标 P1.5 (避免 dual-track 拖慢节奏)
- 视觉对齐: mockup HTML 是双端通用真相源 · mp 实装时按 mockup 视觉对齐 (字号 / 颜色 / 间距 / testid 命名空间一致)
- testid 命名: `frontend/packages/testids/src/index.ts` 是双端共享 · 加新 namespace 时考虑两端 · 但本批次只 wire mp 端

**反例 (禁止)**:
- ❌ "我先做 H5 再补 mp" — 违反本项目优先级
- ❌ "mp + h5 并行做" — 浪费 Coder token + 容易 drift · 串行 mp 优先
- ❌ "我 mp 跑 80% 就先做 h5 收尾" — 必须 mp 100% PASS audit 后再考虑 h5

---

## 2 · 方法论(6 步 · 严格按序)

### Step 1 · 验证 4 件套全部存在 (硬性 pre-check)

对 `${FEATURE_ID}` 跑:
- `ls biz/features/${FEATURE_ID}__*.md` (satellite biz 存在)
- `grep -l "${FEATURE_ID}" biz/features/${FEATURE_ID}__*.md` (主源真含 FEATURE_ID)
- `ls design/system/pages/*${LOWERCASE_FEATURE}*.spec.md` 或 satellite biz §16 引用的 spec 真存在
- `ls design/mockups/wrongbook/*${LOWERCASE_FEATURE_OR_NN}*.html` (mockup 存在)
- `ls .harness/feature_list_${SC}.json` for each SC in SC_LIST (feature_list 全存在)

任一不存在 → **阻断 + 报告缺什么 + 建议先跑哪个上游 skill**:
- satellite biz 缺 → `请先调 gen-biz-doc.md`
- mockup 缺 → `请先调 gen-mockup.md`
- spec.md 缺 → `请先调 gen-page-spec.md`
- feature_list 缺 → `请先调 gen-feature-list.md (按 SC 单独跑)`

### Step 2 · 抽取 8 类必读资产路径

按以下顺序整理路径表(供 TL prompt 的 §二 必读清单用):

| # | 资产 | 路径 | 抽取方式 |
|---|---|---|---|
| 1 | satellite biz (主源) | `biz/features/${FEATURE_ID}__${SLUG}.md` | Step 1 已得 |
| 2 | page spec (实装锚) | satellite §16 Next Steps 引用 / 或 `design/system/pages/${PAGE_ID}-${SLUG}.spec.md` | grep satellite §16 |
| 3 | master sibling spec (对照不动) | 若 satellite 是既有页增强 → `design/system/pages/${PAGE_ID}-${MASTER_SLUG}.spec.md` (master 派生) | grep satellite §15.4 |
| 4 | mockup HTML | satellite §16 / page spec §0 metadata Mockup 字段 | grep |
| 5 | feature_list × N | `.harness/feature_list_${SC}.json` for each SC | Step 1 已得 |
| 6 | sibling satellite (基础设施复用) | satellite §15.4 cross-ref 表里引用的其他 satellite (e.g. M-MULTI §6.1) | grep §15.4 |
| 7 | master biz (cross-ref · 按需查) | `biz/业务与技术解决方案_AI错题本_基于日历系统.md` + satellite §15.4 提到的具体行号 | 抽 §15.4 |
| 8 | 流程纲领 | `CLAUDE.md` (项目根) + `.harness/agents/tl-agent.md` (TL agent 定义) | 固定 |

### Step 3 · 计算 task 总数 + 依赖链 (从 feature_list JSON 读)

对每个 `${SC}` 在 SC_LIST · `python3 -c "import json; d=json.load(open('.harness/feature_list_${SC}.json')); print(d['total_tasks'], [t['task_id_short'] for t in d['tasks']])"` 拿 task list。

整理输出:
- 各 SC task 数 + total = sum
- 依赖链 (按 feature_list 注释 / common sense · e.g. DB migration 必先 · E2E 必后)
- team 分配 (feature_list 里 owner_team='team-1'/'team-2' 仅作建议 · 默认本 skill 串行 1 team 全包 backend+frontend+E2E)

### Step 4 · 生成 git workflow 段 (基于最新 main + 新建 branch)

固定模板 (`${BRANCH_NAME}` 默认 `feature/${FEATURE_ID}-team-${TEAM_NUM}`):
```bash
cd /Users/allen/workspace/longfeng
git fetch origin
git checkout main
git pull origin main
git checkout -b ${BRANCH_NAME}
```

**红线 (TL prompt 必含)**:
- ❌ 不允许在 main 分支直接开发
- ❌ 不允许 force-push
- ❌ 不允许在其他 satellite 分支上混做本 feature

### Step 5 · 写 Stage 1 6-phase 流程 + 铁律段

从 `CLAUDE.md` "Test-Case-First 流程编排" 节抄 6-phase 流程图。
从 CLAUDE.md "AI Agent 启动纪律" + "audit.js 卡口" 节抄铁律。
加 §1 平台优先约定 (mp 优先 / h5 不急) 作为第 6.X 节铁律。
加 satellite §1.4 三大宪法 (若有 · e.g. M-AI-ANSWER-JUDGE 的 A.1/A.2/A.3)。

### Step 6 · 拼装 TL prompt + 输出

按 §2 模板拼装完整 prompt(8 节: 一/二/三/四/五/六/七/八)·
- 若 `OUTPUT_PATH` 传了 → `Write ${OUTPUT_PATH}`
- 否则 → inline 用 ```` (4 backtick) 包裹直接给用户复制

**输出末尾必含使用建议**:
- 用户 spawn TL Agent 时把整段 prompt 完整粘贴
- TL 会按 Step 1-3 起步动作启动 Phase 0 → Phase 5

---

## 2 · TL Agent prompt 模板 (本 skill 最大章节 · 严格按序 8 节)

````markdown
# 任务: 启动 ${FEATURE_ID} feature 开发 · 仅 ${TEAM_COUNT} 个 team · 微信小程序优先

你是 TL Agent · 请按本 prompt 启动一个新 feature 的开发工作。

## 一、Feature 概览

**Feature**: ${FEATURE_ID} (${中文标题})

**核心业务变化**: ${从 satellite §0 TL;DR 抽 2-3 句}

**绝对不破坏 master sibling**: ${从 satellite §1.4 A.x 或 §16 抽}

**平台优先**: **微信小程序 (mp) 优先 · H5 不急** (用户 2026-05-18 项目铁律) · 本批次 frontend 仅做 `frontend/apps/mp/` · H5 留 P1.5 TODO

---

## 二、上游资产清单 (必须按顺序全读 · 不允许跳读)

### 1) satellite biz (主源 · 必读全文)
- `biz/features/${FEATURE_ID}__${SLUG}.md` (${行数} 行 · v${VERSION})
- 重点段: ${从 satellite §0 0.2 抽 4-5 个关键节号 · 含三大宪法 / SC 卡 / DB / API / 决策点}

### 2) page spec (实装锚 · 必读全文 · 14 节)
- `design/system/pages/${PAGE_ID}-${SLUG}.spec.md` (${行数} 行)
- 重点: §3 核心组件 / §4 数据绑定 / §5 API / §6 状态机 + 禁止行为 / §10 验收点 / §13 testid 表 / §15 drift fix 任务清单

### 3) page spec sibling (master · 不动 · 必读用于对照) ⭐ 若有
- `design/system/pages/${PAGE_ID}-${MASTER_SLUG}.spec.md` (${行数} 行)
- 目的: 理解 ${PAGE_ID} 现有 SC-XX 完整流程 · 你的实装不允许破坏这里任何行为

### 4) mockup (视觉真相 · 必读)
- `design/mockups/wrongbook/${NN}_${slug}.html` (${行数} 行 · ${testid 数} testid)
- 演示瞬间: ${从 satellite §0 抽}

### 5) feature_list (派发依据 · 共 ${total_tasks} task)
- ${for each SC in SC_LIST}: `.harness/feature_list_${SC}.json` (${task_count} task · ${SC 名称})

### 6) sibling satellite (基础设施复用) ⭐ 若有
- `biz/features/${SIBLING_FEATURE_ID}__${SIBLING_SLUG}.md` v${X}
- 用途: ${抽 §15.4 cross-ref 描述}
- yml namespace 隔离: ${若有 · 不允许混用}

### 7) master biz (cross-ref · 按需查)
- `biz/业务与技术解决方案_AI错题本_基于日历系统.md`
- 重点行: ${从 satellite §15.4 抽 3-5 个关键 master 行号}

### 8) 流程纲领 (你的执行铁律)
- `/Users/allen/workspace/longfeng/CLAUDE.md` 全文 (尤其 "Test-Case-First 流程编排" + "AI Agent 启动纪律" + "audit.js 卡口" 3 节 + "通用工程德行 12 条" + "Rule 6 tool-use budget")
- `.harness/agents/tl-agent.md` (你的 agent 定义 · 必读全文)

---

## 三、分支策略 (基于最新 main · 新建 feature branch)

1. **基于最新 main**:
   ```bash
   cd /Users/allen/workspace/longfeng
   git fetch origin
   git checkout main
   git pull origin main
   ```
2. **新建 feature branch**:
   ```bash
   git checkout -b ${BRANCH_NAME}
   ```
3. **红线**:
   - ❌ 不允许在 main 分支直接开发
   - ❌ 不允许 force-push
   - ❌ 不允许在其他 satellite 分支上混做本 feature
   - ❌ 不允许跳过 git pull (必须基于最新 main)

---

## 四、Team 规模 · 仅启动 ${TEAM_COUNT} 个

**仅 ${TEAM_COUNT} 个 team (team-1) · 串行跑** · 不允许多 team 并行 (用户明示)。

- team 跑完 SC-${FIRST} 全部 ${N} task → 再跑 SC-${SECOND} (${M} task) → 再跑 SC-${THIRD} (${K} task) · 共 ${total_tasks} task 串行
- feature_list JSON 里虽然有 owner_team='team-1'/'team-2' 标注 (按 backend / frontend 划分建议) · 但你**只派 ${TEAM_COUNT} 个 team** · 该 team 同时承担 backend + frontend (mp 优先) + E2E 全栈
- **frontend 只做 mp (`frontend/apps/mp/`) · H5 (`frontend/apps/h5/`) 留 P1.5 TODO** · 不在本批次做

---

## 五、Stage 1 Test-Case-First 6-Phase 流程 (每个 task 都走)

**opt-in**: 派每个 task 时 inflight payload 必须含 `"test_case_first_required": true` (启用 Stage 1)。

每个 task 严格按 CLAUDE.md "Test-Case-First 流程编排" 节走:

```
Phase 0 · 三方独立预读 (TestDesigner / Coder / Tester 并行 · 不互见)
  → 各自读 satellite biz §2B.XX SC 卡 + spec §10 验收点 + 源码 + CLAUDE.md + 自己 agent.md
Phase 1 · TestDesigner 写 test-cases.md (Gherkin 6 列表格 · ≥3 ≤6 用例)
  → 改 inflight.test_cases_drafted=true
Phase 2 · Coder + Tester 并行评审 (各自写 {coder,tester}-review.md · 不互见)
  → 红线: 至少 1 轮 REJECT (0 REJECT = 互相批准 = audit FAIL)
  → 双方 verdict: APPROVE → inflight.test_cases_reviewed_by_{coder,tester}=true
Phase 3 · Coder 按 test-cases.md 一对一翻译 it block + 7 step 开发
  → DoD: 用例 100% spec 覆盖 + lint + typecheck + ide-console.txt 0 [error]
  → frontend 只做 mp (`frontend/apps/mp/`) · H5 留 TODO
Phase 4 · Tester 跑 spec + 1 轮对抗 (Step 0 验 it 块数对齐)
  → DoD: 用例 100% PASS + IDE Console 0 [error]
Phase 5 · audit.js 7 dims (含 test_cases_alignment + 6 现有维度)
  → audit-verdict.json 7 维度全 PASS 才真 PASS · 任一 FAIL 走 REDO
```

---

## 六、铁律 (从 CLAUDE.md 项目宪法 + satellite 三大宪法 · 不可妥协)

### 6.1 sub-agent 启动纪律 (你派 sub-agent 时必须确保)
- 每个 sub-agent 第一件事: **完整读自己 `.harness/agents/<role>-agent.md` 全文** + 在第一条输出显式声明"已完整阅读" + 内化铁律
- 每次有副作用动作前: **双脑回看** CLAUDE.md (Rule 12 条 + Rule 6 tool-use 预算) + 自己 agent.md
- 结束前必做"反省自检": 对照每步 / 每条铁律 · 缺一不可

### 6.2 satellite 主源不破坏
- **Coder/Tester 实装时禁止 fork master biz §3 DDD / §6 Spring AI / §7 艾宾浩斯** · 全部复用 master · 仅按 satellite §4 加列 / §10 新 endpoint / §10 改字段
- **prompt / schema / 阈值 必须按 satellite §6 字面写入** · 不允许 Coder "我觉得这样更好" 改字面 · 改要先升 satellite 版本号

### 6.3 satellite 三大宪法 (若 satellite §1.4 有定义 · 实装时违反 = audit FAIL)
${从 satellite §1.4 三大宪法 字面抄 · 若 satellite 没定义则本节略}

### 6.4 向后兼容硬性 (master sibling 不破坏)
- 旧客户端 / 旧路径 / master sibling SC-XX 流程 100% 不受影响
- 验证脚本: 跑 master sibling 现有 E2E 在本 feature branch 上必须全绿

### 6.5 audit.js 卡口 (落 PASS 前最后一关)
- audit-verdict.json 7 维度全过才真 PASS · 任一不过 REDO + retries++ · audit_retries ≥ 3 触发熔断 + 人类介入
- `work_log_dir` 三件套必须真落盘 (Coder: coder.md + bugs-found.md · Tester: tester.md + adversarial.md + test-reports/)

### 6.6 平台优先铁律 (本项目 2026-05-18 拍板 · 微信小程序优先)
- **frontend 实装只做 `frontend/apps/mp/` (微信小程序原生 TS + Vant Weapp)**
- **`frontend/apps/h5/` 留 P1.5 TODO** · 不在本批次开发 · 不在本批次跑 E2E
- testid 命名空间在 `frontend/packages/testids/src/index.ts` 共享 · 加新 testid 时考虑两端 · 但本批次只 wire mp 端
- mockup HTML 是双端通用视觉真相 · mp 实装按 mockup 视觉对齐 (字号 / 颜色 / 间距 / testid 一致)
- 反例 (禁): "我先做 H5 再补 mp" / "mp + h5 并行" / "mp 80% 时先做 h5 收尾"

---

## 七、起步动作 (你接到此 prompt 的第一步)

### Step 1 · 自检与准备 (≤ 5 分钟)

输出一条消息确认:
1. "已完整阅读 `.harness/agents/tl-agent.md` 全文 · 铁律 N 条已内化"
2. "已 git fetch + 拉最新 main · HEAD = `<hash>`"
3. "已新建 branch `${BRANCH_NAME}` · 当前在该 branch"
4. "已读完上述 8 类资产 · satellite biz ${X} 行 / spec ${Y} 行 / mockup ${Z} 行 / feature_list ${total_tasks} task 全部确认"
5. "已确认 Stage 1 6-phase 流程 · 计划串行跑 ${total_tasks} task (SC-${A} T01-T0M → SC-${B} T01-T0N → SC-${C} T01-T0K)"
6. "已确认平台优先: frontend 只做 mp · H5 留 P1.5 TODO"

### Step 2 · 派发第一个 task (${START_TASK})

写 inflight payload `.harness/inflight/${START_TASK_SHORT}.json` · 必含字段:
```json
{
  "task_id": "${START_TASK}",
  "task_id_short": "${START_TASK_SHORT}",
  "team": "team-1",
  "branch": "${BRANCH_NAME}",
  "test_case_first_required": true,
  "platform_priority": "mp_only",
  "work_log_dir": "audits/runs/${START_TASK_SHORT}/team-1/attempt-1/",
  "log_requirements": {
    "coder": ["coder.md", "bugs-found.md"],
    "tester": ["tester.md", "adversarial.md", "test-reports/"]
  },
  "biz_refs": [...feature_list 里的 biz_refs 复制...],
  "spec_refs": [...feature_list 里的 spec_refs 复制...],
  "acceptance_criteria": [...feature_list 里 N 条 AC 复制...],
  "audit_gate": ".harness/audit.js 7 维度全过"
}
```

派 TestDesigner Agent 启动 Phase 0 → Phase 1 (Phase 0 同时让 Coder + Tester 也读 · 但 Phase 1 只 TestDesigner 写 test-cases.md)

### Step 3 · 跟踪 + 报告

每个 task 完成后:
- 报告 audit-verdict.json 7 维度结果
- 报告 git commit hash
- 报告下一个 task (按依赖链 ${依赖链 ASCII})
- 任一 task 熔断 (audit_retries ≥ 3) → **暂停 + 报告 + 等用户决策** · 不允许 silently skip

---

## 八、不允许的事

- ❌ 跳过 Phase 0 三方独立预读 (有读 = 输出"已读" 不等于真读 · Phase 0 必须产出 each-agent 的读后摘要)
- ❌ 跳过 Phase 2 互评 + ≥1 轮 REJECT (0 REJECT 视为互相批准 · 直接 audit FAIL)
- ❌ Coder/Tester 自行决定改 satellite §6 prompt/schema/阈值 字面 (必须 surface 给用户)
- ❌ 派多个 team 并行 (用户明示只 ${TEAM_COUNT} 个 team)
- ❌ 在 main 分支直接开发
- ❌ 跳过 audit.js · 即使你"觉得"task 完美也要跑 audit · audit 是确定性脚本 · 你不是
- ❌ silent fail (任何 task 卡住 / 任何维度 FAIL → 必须 surface · 不允许 hide)
- ❌ **做 H5 (`frontend/apps/h5/`)** — 本项目 2026-05-18 拍板 mp 优先 · H5 留 P1.5 · 任何 task primary_services 含 h5 路径 → audit FAIL
- ❌ mp + h5 并行做 / 先做 h5 后补 mp / mp 不到 100% 先做 h5

---

**Ready? 请按 Step 1 起步动作开始 · 输出 6 条确认后 · 写 ${START_TASK_SHORT} inflight payload + 派 Phase 0**。
````

---

## 3 · 反作弊红线(CLAUDE.md Rule 1 / 3 / 12 项目化)

1. **4 件套硬性 pre-check**: 任一缺失 → 阻断 + 报告缺哪个 + 建议先调对应上游 skill · 不允许"先开始 TL prompt 边写边等上游补"。
2. **SC 真存在校验**: `SC_LIST` 里每个 `SC-XX` 必须能在 satellite §2B grep 命中 (`grep -c "^### 2B\.[0-9]* SC-${N}" satellite.md` ≥ 1) · 不允许 invent SC 号。
3. **TEAM_COUNT > 1 必须 surface**: 默认 1 · 用户传 2/3 时本 skill 必须先用 AskUserQuestion 确认 "你确定并行 N team? 串行更安全更易追踪 audit · 大多数 feature 1 team 即可"。
4. **mp 优先铁律强制嵌入**: TL prompt §一 + §四 + §六.6 + §七 Step 1 第 6 条 + §八 第 8/9 条 · 共 5 处必含 mp 优先 / H5 不急 · 任一缺失 → skill 自检不过。
5. **task 依赖链不能 fabricate**: §七 Step 3 列的依赖链必须从 feature_list JSON 真读 (不允许"我觉得 T02 依赖 T01") · 依赖关系不明时留空白让 TL 按 task_id 顺序串行。
6. **CLAUDE.md 5 节强制引用**: §二 #8 必须含 "Test-Case-First 流程编排" + "AI Agent 启动纪律" + "audit.js 卡口" + "通用工程德行 12 条" + "Rule 6 tool-use budget" 5 节字面引用 (供 TL Agent grep 跳读)。
7. **三大宪法按需嵌入**: 若 satellite §1.4 定义了 A.1/A.2/A.3 类宪法(e.g. M-AI-ANSWER-JUDGE 的学生主体性/双信源溯源/优雅降级) · §六.3 必须字面抄。无 §1.4 则本节略。
8. **prompt 必须 self-contained**: 不允许 prompt 里出现 "见对话上文" / "如前所述" / "我刚才说的" · TL Agent 不会看本对话 · 任何引用必须是绝对路径或字面段。

---

## 4 · 与其他工具的边界

- 本 skill **只生成 TL Agent 启动 prompt**(text or markdown 文件)。不派 sub-agent、不写 inflight JSON、不跑 audit、不改 feature_list / spec / biz。
- 本 skill **是 4 件套上游的下游闭环**: gen-biz-doc → gen-mockup → gen-page-spec → gen-feature-list → **本 skill** → TL Agent → harness.js → Coder/Tester/TestDesigner Agents → audit.js。
- 本 skill **不替代 TL Agent**。TL 仍按 `.harness/agents/tl-agent.md` 自主决策 · 本 skill 只提供启动 brief(8 节 self-contained prompt)。
- 本 skill **不写 frontend 实装代码 / 不写 backend service / 不写 E2E spec.ts**。那是 Coder Agent 在 Phase 3 落地的事。
- 与 `anthropic-skills:scenario-driven-tdd-planner` 的区别: 那个产 phase 总规划(横跨多 SC + 多 phase) · 本 skill 把 N 个已就绪 SC 派给 1 个 TL 去串行跑。

---

## 5 · 用法示例(M-AI-ANSWER-JUDGE 实战 · 12 task 串行)

```
用户: kickoff M-AI-ANSWER-JUDGE · 跑 SC-20/21/22 · 1 team
```

执行步骤:

1. **Step 1 4 件套 pre-check**:
   - `ls biz/features/M-AI-ANSWER-JUDGE__ai-answer-judge.md` → 存在 (468 行)
   - `ls design/system/pages/P08-review-exec-ai-judge.spec.md` → 存在 (486 行)
   - `ls design/mockups/wrongbook/20_review_exec_ai_judge.html` → 存在 (414 行)
   - `ls .harness/feature_list_SC-20.json .harness/feature_list_SC-21.json .harness/feature_list_SC-22.json` → 全存在
   - ✓ 全过
2. **Step 2 抽 8 类资产路径**: 主源 satellite + spec + sibling P08-review-exec.spec.md (master 派生) + mockup + 3 feature_list + sibling satellite M-MULTI v1.2 + master biz §2A.4/§4.5/§7 + CLAUDE.md + tl-agent.md
3. **Step 3 计算 task 总数**: SC-20 6 task + SC-21 3 task + SC-22 3 task = **12 task** · 依赖链: SC-20 T01→T02/T03/T04→T05→T06 · SC-21 T01→T02→T03 · SC-22 T01→T02→T03 (3 SC 串行)
4. **Step 4 git workflow**: `feature/M-AI-ANSWER-JUDGE-team-1`
5. **Step 5 6-phase + 铁律**: Stage 1 全 6 phase + CLAUDE.md 5 节 + satellite §1.4 三大宪法 (A.1 学生主体性 / A.2 双信源溯源 / A.3 优雅降级) + §六.6 mp 优先 / h5 不急
6. **Step 6 拼装输出**: 8 节 prompt(约 250 行) · 默认 inline 用 4-backtick 包裹给用户复制

最终输出末尾: "用户 spawn TL Agent · 粘贴本 prompt · TL 按 Step 1-3 起步"

---

## 6 · Skill 自检 checklist(生成后必跑)

- [ ] TL prompt 含 8 节(一/二/三/四/五/六/七/八)· `grep -c "^## " prompt.md` ≥ 8
- [ ] §二 含 8 类资产路径 · 每条路径用 `ls` 真存在校验通过
- [ ] §三 git workflow 含 `git fetch + checkout main + pull + checkout -b ${BRANCH_NAME}` 4 行
- [ ] §四 明示 TEAM_COUNT(默认 1)+ 串行 + 全栈
- [ ] §五 含 Phase 0-5 完整描述 · 不简化
- [ ] §六 含 6.1-6.6 共 6 节铁律 · **6.6 平台优先必须存在**(字面 "微信小程序优先" / "H5 不急")
- [ ] §六.3 若 satellite §1.4 有三大宪法 → 必须字面抄
- [ ] §七 Step 1 含 6 条自检确认(第 6 条 "frontend 只做 mp · H5 留 P1.5 TODO" 必含)
- [ ] §八 含 9 条禁止(末 2 条 mp 优先红线)
- [ ] 整 prompt 不含 "见上文" / "如前所述" / 任何对话相对引用(self-contained)
- [ ] 若 OUTPUT_PATH 传了 → 文件落盘 · 否则 inline 4-backtick 包裹

打钩全过 → 报告输出方式(file path 或 inline) + 4 件套验证表 + 使用建议。

---

## 7 · 平台优先约定的 history(为什么 mp 优先 / h5 不急)

- **2026-05-14**: 项目初始假设 mp + h5 双端并行 (master biz §15.1 BOM 含两端)
- **2026-05-18 (本 skill 落地日)**: 用户明示 "我们先开发微信小程序客户端, h5 不急" → 本 skill §1 落地铁律 + §六.6 强制嵌入所有 TL prompt
- **理由 (推测)**: 1) mp 是用户实际使用端 · 优先级最高 · 2) 双端并行容易 drift · 串行先 mp 再 h5 更稳 · 3) Coder token 预算有限 · 集中火力打 mp 比双线作战效率高
- **何时解锁 h5**: 待 mp 端 SC-20/21/22 全部 audit PASS + 用户 review 后 · 单独跑 H5 后补批次 (P1.5 / P2)

---

**修订表**

| 版本 | 日期 | owner | 摘要 |
|---|---|---|---|
| v1 | 2026-05-18 | user (kickoff-feature-team 首次实战 · M-AI-ANSWER-JUDGE 4 件套完成后落地) | 首版 · 把"给 TL 启动 feature 开发"的 prompt 抽成可复用 skill · 8 节 self-contained 模板(一概览/二必读/三git/四team/五phase/六铁律/七起步/八禁止)· 内置项目铁律: 微信小程序优先 + H5 不急 (用户 2026-05-18 拍板 · 多处强制嵌入)· 4 件套 pre-check 硬性(任一缺失阻断 + 建议先跑上游 skill)· 三大宪法按 satellite §1.4 按需抄 · TL 自检 6 条确认起步 · audit.js 7 维度卡口 · 共形成完整闭环: gen-biz-doc → gen-mockup → gen-page-spec → gen-feature-list → 本 skill → TL → Phase 0-5 → audit |
