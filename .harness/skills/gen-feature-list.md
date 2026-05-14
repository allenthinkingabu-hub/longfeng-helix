# Skill: gen-feature-list

> **用途**：把 biz §2B 的一个 SC（Scenario）卡 →  `.harness/feature_list.json`（v3.1 schema · 14 T-task 数组）
> **触发**：用户说「为 SC-XX 生成 feature_list.json」/「按 SC-XX 拆任务」/「回忆 SC-XX 的 feature_list」
> **owner**：user · 首版于 2026-05-14 SC-01 回忆时验证落地

---

## 0 · 调用时必须明示参数

| 参数 | 必填 | 示例 | 默认 |
|---|---|---|---|
| `SC_ID` | ✓ | `SC-02` / `SC-11` | — |
| `BIZ_DOC` | — | `biz/业务与技术解决方案_AI错题本_基于日历系统.md` | 默认值（仓库唯一一份） |
| `OUTPUT_PATH` | — | `.harness/feature_list.json` 或 `.harness/feature_list_SC-02.json` | 单 SC: `.harness/feature_list.json` · 多 SC: `.harness/feature_list_${SC_ID}.json` |
| `FORCE` | — | `--force` 覆盖已存在文件 | 不传则在已存在时先 Read + 询问 |

---

## 1 · 方法论（5 步 · 严格按序执行）

### Step 1 · 定位 SC 卡

`grep -n "^### 2B\." $BIZ_DOC` 找到该 SC 的章节锚。读完整段：
- 「场景目的」「前置条件」「核心路径编排」表（N 行 = N 步用户操作）
- 「关键断言点（System Invariants）」段
- 「QA 用例（TC-XX.YY）」表（正常 / 异常 / 边界 / 安全 4 类）

### Step 2 · 提取涉及页面 + 读 §2A.4 规格卡

「核心路径编排」表第 3 列「页面前台」列出涉及的 Page id（P02 / P03 / P-HOME ...）。对每个 page 在 `§2A.4 逐页面规格卡` 中 `grep -A 20 "#### $PAGE ·"` 读完整卡（API 触点 / 状态集 / 异常 & 降级 / 埋点事件）。

### Step 3 · N 步压缩为 T-task（核心规则）

**两条压缩规则**，**不**做 1:1 映射：

1. **合并 (UI-only)**：某步的「后端/事件」列为空（纯前端状态变化 · 例如 SC-01 步 8 滚动浏览 / 步 16 手写作答）→ 不独立成 task · 合并到**上下游 task 的 AC** 里
2. **合并 (邻步同页)**：相邻 N 步发生在同一页面 + 同一 API 链路 + 同一状态机分支 → 合并成 1 task（例如 SC-01 步 1-4 合成 T01 · 步 12-13 合成 T08 · 步 15-16 合成 T10 · 步 7-8 合成 T04）

**典型经验值**（SC-01 实证）：
- SC 表 20 步 → 14 task（净压缩 30%）
- SC 表 12 步 → ~8-10 task
- SC 表 6 步 → ~5-6 task（动作密度高 · 难压缩）

### Step 4 · TC-XX.YY 异常用例 → AC 增量

QA 用例表里的 TC：
- **TC-XX.01** 正常路径 = 14 task happy path AC 的并集 · **不**单独建 task
- **TC-XX.02..0N** 异常 / 边界 / 安全 → 嵌入到**相关** T-task 作为额外 AC（例如 SC-01 TC-01.03 模型超时 → T03 AC5 fallback；TC-01.05 calendar 503 → T06 AC5 outbox 兜底）

### Step 5 · 在用户确认前 surface 切片表

在写 `.harness/feature_list.json` **之前**，必须先用一张表把"步 → task"映射呈给用户（含每个 task 的 page / API / TC 嵌入点），让用户对边界。**用户确认后才写文件**。

表格模板：

| T | 切片名 | biz §2B.X 步 | 页面 | 关键 API | TC 嵌入 |
|---|---|---|---|---|---|
| T01 | <slug> | 步 1-4 | P02→P03 | POST /api/file/presign | TC-XX.02 |
| ... | ... | ... | ... | ... | ... |

然后调 `AskUserQuestion` 询问：「上面 N T-task 的边界划分对不对？这是后续生成全部 task AC 的根基,错一个边界后面全错。」

---

## 2 · 每个 task 的 JSON schema (v3.1)

照下面格式逐字段输出（参考 SC-01 的 [.harness/feature_list.json](.harness/feature_list.json) T01 节点）：

```jsonc
{
  "task_id": "SC-${N}-T${MM}",            // 长形 · spec / git branch / commit
  "task_id_short": "SC${N}-T${MM}",       // 短形 · .harness/inflight/<id>.json + audits/runs/<id>/
  "task_id_pascal": "T${MM}${PurposeShort}",  // PascalCase · *E2EIT.java 类名
  "task_title": "<一句话 · 含用户动作 + 关键 API + 跳转目标>",
  "scenario": "TC-${N}.01 主路径 · 内嵌 TC-${N}.0X (该 task 命中的异常用例)",
  "biz_step_range": "biz §2B.X 步 N-M",
  "page": "<Pcurr>-<slug>" or "<Pcurr>→<Pnext>",
  "page_state_machine": "<状态机迁移 · 来自 §2A.4 状态集>",
  "branch": "feature/SC-${N}-T${MM}-<slug>",
  "owner_team": "team-1" or "team-2",     // 复杂后端链路用 team-2
  "biz_refs": ["biz/xx.md §2B.X 步 N-M", "biz §2A.4 P0X 规格卡", "TC-${N}.0X"],
  "spec_refs": ["design/system/pages/P0X-xxx.spec.md §5 API 触点"],
  "phase_0_audit_refs": ["audits/SC-${N}-PHASE-0/A0X-xxx.md §Y"],  // 如有 · 没有就空数组
  "primary_services": ["frontend/apps/h5", "backend/<svc>"],
  "primary_apis": ["POST /api/...", "GET /api/..."],
  "acceptance_criteria": [
    { "id": "AC1", "text": "<动词 + 输入 + 期望响应 + 锚定 spec 行>" },
    // ... 4-6 条 AC · 含 1 条 TC 异常 AC
  ],
  "test_invariants": [
    "TI1: <数据不变量 · 例 同 idemKey 24h 内 wb_file 仅 1 行>",
    "TI2: <错误码不变量 · 例 缺 header 返 400 非 500>",
    "TI3: <顺序不变量>",
    "TI4: <UI VRT 4 态 screenshot>"
  ],
  "key_invariants": ["<从 §scenario 关键断言点提炼>"],
  "physical_verification": {
    "frontend_e2e": "frontend/apps/h5/tests/e2e/sc-${N}/t${mm}-<slug>.spec.ts",
    "backend_e2e_it": "backend/<svc>/src/test/java/.../T${MM}<Purpose>E2EIT.java"
  },
  "dev_done": false,                      // 全新 task 默认 false
  "passes": false,
  "retries": 0,
  "audit_retries": 0,
  "git_commits": [],
  "current_status": "NOT_STARTED",        // 或 "BLOCKED_AT_ATTEMPT_<N>" + "blocker" 字段
  "work_log_dir": "audits/runs/SC${N}-T${MM}/team-X/attempt-1/"
}
```

外层包装：

```jsonc
{
  "schema_version": "3.1",
  "scenario_id": "SC-${N}",
  "scenario_title": "<biz §2B.X 标题>",
  "scenario_goal": "<biz §2B.X 场景目的>",
  "generated_from": "biz/xx.md §2B.X (${N_steps} user-action steps)",
  "generated_at": "${YYYY-MM-DD}",
  "owner": "user",
  "scenario_biz_ref": "biz/xx.md §2B.X",
  "scenario_spec_refs": [/* 涉及的所有 P0X spec.md */],
  "scenario_tc_ids": ["TC-${N}.01", "TC-${N}.02", ...],
  "system_invariants": [/* 从 §scenario 关键断言点照抄 4 条 */],
  "work_log_dir_pattern": "audits/runs/<task_id_short>/<team>/attempt-<N>/",
  "log_requirements_template": {
    "coder":  ["coder.md", "bugs-found.md"],
    "tester": ["tester.md", "adversarial.md", "test-reports/"]
  },
  "audit_gate": "harness/audit.js 5 维度全过才真 PASS · 任一不过 REDO · audit_retries ≥ 3 触发熔断",
  "id_convention": {/* 三形态 ID 命名约定 · 照 SC-01 抄 */},
  "total_tasks": ${len(tasks)},
  "tasks": [/* 所有 task 数组 */]
}
```

---

## 3 · 反作弊红线（CLAUDE.md Rule 1 / Rule 9 / Rule 12 项目化）

1. **不要 fabricate AC**：每条 AC 必须能锚到 biz §2B.X 的某步行 / §2A.4 某页规格卡的 API 触点行 / phase-0 audit md 某段。Coder/Tester 跑这个 task 时第一眼会查 `biz_refs` + `spec_refs` 还原意图，锚错位 = 整个 task 偏题。
2. **不要 1:1 用户步映射**：N 步直接 → N task 是错的（违反 Step 3 压缩规则）。SC-01 实证 20 步 → 14 task。
3. **TC 不独立成 task**：TC-XX.0Y (Y > 1) 是 AC 增量，不是 task 单元。新加 task 视为 over-engineering。
4. **`dev_done` / `passes` 不可初始 true**：全新 SC 的所有 task 必须 dev_done=false / passes=false。例外：用户明示「T01 attempt-N 已 PASS · 沿用旧状态」，本工具读 audits/runs/<id>/ 实证后才可携带历史 retries + git_commits。
5. **存在文件时必须先 Read + 询问**：不要无脑覆盖。schema_version mismatch / total_tasks 变化 → 先 surface 给用户决定 merge 还是覆盖。

---

## 4 · 与其他工具的边界

- 这个 skill **只生成 feature_list.json**。不生成 `.harness/inflight/<task>.json`（那是 harness.js 派发时按 task 节点+ context 注入生成）。
- 这个 skill **不写 spec.md**。spec.md 是另一份独立产物（page 级 spec），按需另起 skill。
- 这个 skill **不生成 coder.md / tester.md**。那是 sub-agent 在跑 task 时落盘的 work log。
- 与 `anthropic-skills:scenario-driven-tdd-planner` 的区别：那个 skill 输出 phase 总规划（横跨多个 SC + 多个 phase）·  本 skill 只把 1 个 SC 拆成 N task。下游可用。

---

## 5 · 用法示例

```
用户: 为 SC-02 生成 feature_list.json
```

执行步骤：
1. `grep "^### 2B\." biz/xx.md` → 锁定 `### 2B.3 SC-02 · 推送唤起 → 复习执行 → 继续下一题`
2. Read biz §2B.3（核心路径编排 12 步 + 系统不变量 + TC-02.01..05 5 用例）
3. 提取页面：P00 / P08 / P09 / P-HOME · grep §2A.4 各页规格卡
4. Step 3 压缩：12 步 → 推算 ~8-10 task（推送解析 / 深链验证 / 跳过 P-HOME 直达 P08 / token 过期 redirect / session 连续性 / 庆祝升级态 等）
5. **生成切片表 → 用 AskUserQuestion 让用户对边界**
6. 用户 OK 后写 `.harness/feature_list_SC-02.json`（与 SC-01 文件并存，避免覆盖）
7. 告知用户：路径 / task 总数 / NOT_STARTED 状态 / 待 harness.js 派发首个 task

---

## 6 · Skill 自检 checklist (生成后必跑)

- [ ] JSON 合法（`python3 -c "import json; json.load(open(PATH))"` 不抛错）
- [ ] `total_tasks == len(tasks)`
- [ ] 每个 task 都有 ≥ 1 个 `biz_refs` 锚
- [ ] 每个 task 都有 ≥ 1 个 `spec_refs` 锚（即使 spec.md 尚未存在 · 路径占位也算）
- [ ] 每个 task 的 `acceptance_criteria` 数量 ∈ [3, 8]（少于 3 = 划分粒度太粗 · 多于 8 = task 边界太大需要拆）
- [ ] 每个 task 的 `task_id` 三形态（long / short / pascal）严格匹配 `id_convention` 模板
- [ ] 全部 `dev_done=false / passes=false`（除非用户明示沿用历史）
- [ ] `system_invariants` 字段从 §scenario「关键断言点」段照抄，**不**自己编

打钩全过 → 报告输出路径 + 14/N task 摘要表。

---

**修订表**

| 版本 | 日期 | owner | 摘要 |
|---|---|---|---|
| v1 | 2026-05-14 | user | 首版 · SC-01 回忆时验证生成方法 · 20 步 → 14 task |
