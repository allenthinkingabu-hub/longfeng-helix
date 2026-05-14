# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

This repository is empty — no source code, build configuration, or documentation has been added yet. Treat any task here as greenfield setup until the structure below is filled in.

## To populate (delete sections as they become real)

When the project takes shape, replace the placeholders below with concrete, repo-specific details. Keep it short — only document what would not be obvious to a new contributor reading the code.

### Documentation & Project Management (文档与项目管理)

为了理解业务逻辑和系统设计，请务必在修改代码前阅读以下文档：
- **需求与业务方案 (Business & Requirements)**: 存放在 `biz/` 目录下（例如：`biz/000_业务与技术解决方案_登录注册_v1.md`）。
- **架构与设计文档 (Design Docs)**: 存放在 `design/` 目录下（例如：`design/system/GUIDANCE.md`）。
- **任务规划 (Task Planning)**: TODOs 和当前进度通常在相关模块的 `todo/` 目录中找到。

### AI Agents & Workflow Assets (AI 代理与工作流资产)

本项目建立了一套 AI 驱动的研发体系。相关的 AI 组件（Agents, Skills, Hooks）**全部**位于 `.harness/` 根下（与 harness 运行时产物 `feature_list.json` / `inflight/` / `audit-verdict.json` 同根 · 2026-05-14 用户决策 · 统一 harness 资产命名空间）。当 AI 协助开发或执行自动化流程时，请参考以下规范：
- **Agents (智能体定义)**: 存放在 `.harness/agents/` 目录（例如：Coder / Tester / TL Agent · 架构审查 Agent · QA Agent 等）。负责做决策和拆解任务。
- **Skills (核心技能/工具)**: 存放在 `.harness/skills/` 目录（例如：`gen-feature-list.md` 把 biz SC 拆成 feature_list.json · 强制 E2E 测试脚本 · PDF 生成工具等）。负责具体执行的确定性脚本或函数。
- **Hooks (生命周期钩子)**: 存放在 `.harness/hooks/` 目录。负责在 Git 提交流水线或构建生命周期中自动唤醒上述 Agent。

## 通用工程德行（12 条 · 在项目铁律下生效）

**优先级**：本节在「AI Agent 启动纪律」+「audit.js 卡口」**之下**生效。冲突时按项目铁律走；本节只补充铁律未明说的工程判断。Bias: caution over speed on non-trivial work.

### Rule 1 — Think Before Coding
明示假设。不确定就问，不要猜。歧义时给出多种解读。能简化就 push back。困惑时停下，说清楚不懂在哪。

### Rule 2 — Simplicity First
最小代码解决问题。不投机性写代码。不为单次使用搞抽象。
**项目适配**：Tester 按 `test-agent.md` 铁律 3 要做的"破坏性边界用例 + 探索性测试" + Coder 修标杆模板，**不视为超范围**。本条只约束未被铁律明确授权的功能扩张。

### Rule 3 — Surgical Changes
只动必须动的。别"改进"相邻代码、注释、格式。别重构没坏的东西。匹配既有风格。
**项目适配**：标杆模板（reference module）确有 bug 必须先修才能落地新功能时，**视为必要修复**，不算 adjacent cleanup。

### Rule 4 — Goal-Driven Execution
定义成功标准，循环到验证为止。强 success criteria 让你独立 loop。
**项目映射**：Coder DoD = `coder-agent.md` 7 步骤全过 + audit.js coder_compliance + bug_reality PASS；Tester DoD = audit.js 5 维度全 PASS。

### Rule 5 — Use the model only for judgment calls
模型用于：分类、起草、总结、抽取。**不用于**：路由、重试、确定性变换。If code can answer, code answers.
**项目映射**：审计规则用 `harness/audit.js`（确定性程序），不用 AI 审计员 —— 这是本项目核心设计决策。

### Rule 6 — Tool-use budget（token 代理 · 项目适配版 · 不要套用原模板）

LLM 看不到自己的 token 计数器，所以本项目用 **tool use 次数作代理**。实测：Coder ~2.3K token/tool · Tester ~2.9K token/tool · 故 **85 次 tool use ≈ 200K tokens 红线**。

| 阈值 | tool use 次数 | 估算 token | 必做动作 |
| --- | ---: | ---: | --- |
| 软线 1 · self-checkpoint | 50 | ≈ 115K | 下条输出末必须附简短自检：「tool=50 · 估 115K · 已完成 X · 还剩 Y」 |
| 软线 2 · surface 接近预算 | 70 | ≈ 161K | 必须 surface "接近 Rule 6 红线"，主动询问 TL 是否需要 compact-then-handoff |
| **硬线 · 强制 compaction** | **85** | **≈ 200K** | 立即输出 Rule 6.5 compaction summary，return 控制权，**禁止再调任何工具** |

**TL（父 agent）责任**：SendMessage 续场前检查上轮返回的 `total_tokens`：
- `> 200K` → **禁止续场**，必须 spawn 新 agent + 用 Rule 6.5 compaction summary 当 brief
- `150K ≤ tokens ≤ 200K` → 续场前要求当前 agent 先输出 compaction summary，下次 brief 只带 summary 不带历史对话
- `< 150K` → 续场自由

原模板的 4K/30K token 阈值与"surface compaction"未定义动作 — **不适用于本项目**。

### Rule 6.5 — Compaction Summary 模板（触发 Rule 6 硬线时必出）

格式严格按下面 4 段，**不少于 4 段**。写完即 return，禁止再调工具：

1. **State** · 当前在 agent.md 哪一步（编号 + 标题），做完了什么。**必列**：
   - 落盘文件路径（绝对路径或 `audits/runs/<task>/<team>/attempt-<N>/` 子路径）
   - 本 attempt 已 commit 的 hash（短 hash 7 位即可 · 多个用逗号分隔）
   - 已改的源文件路径 + 行数变更（如 `backend/file-service/.../PresignController.java +42 -8`）
2. **Remaining** · 剩什么没做、依赖什么、预估还要几次 tool use。
3. **Findings** · 关键发现 / 风险 / 需要 TL 决策的点（≤ 5 条 · 每条 ≤ 100 字）。
4. **Handoff** · 下一个接力 agent **只需读**哪些文件（精确路径列表），不需要重读历史对话。建议必含：
   - `git log <branch> --oneline -20`（拿到本 attempt + 上轮的 commit message）
   - `audits/runs/<task>/<team>/attempt-<N>/{coder,bugs-found,tester,adversarial}.md`
   - `.harness/inflight/<task_id>.json`
   - `audits/runs/<task>/<team>/attempt-<N>/audit-verdict.json`（若存在）

写完此 summary 后：return 控制权 + `task.dev_done` / `task.passes` 不动（除非已真完成）+ 不调 `--advance`。TL 看到 summary 后决定 spawn 新 agent 还是熔断。

### Rule 7 — Surface conflicts, don't average them
两套规则冲突，选一套（更新/更经测试的） + 解释为什么 + 标记另一套清理。**绝不混用**两套互斥规则。

### Rule 8 — Read before you write
写代码前读 exports、直接调用方、共享 utility。"看起来正交"很危险。
**项目映射**：等价于启动纪律的"完整读 agent.md 全文 + 完整读 `.harness/inflight/<task>.json`"。

### Rule 9 — Tests verify intent, not just behavior
测试必须编码 WHY，不只是 WHAT。业务逻辑改了但测试不会失败 —— 这种测试是错的。
**项目映射**：Tester 必须在 `adversarial.md` 写清"我为什么相信这个测试能抓到回归"，不是凑 testcase 数。

### Rule 10 — Checkpoint after every significant step
每关键步骤后 summarize 做了什么、验证了什么、剩什么。从不能描述的状态继续是危险的。
**项目映射**：`coder.md`（5 段落）+ `tester.md`（6 步骤）+ `adversarial.md`（每轮 reject/fix）+ `audit-verdict.json`（5 维度）= 强制 checkpoint。

### Rule 11 — Match the codebase's conventions, even if you disagree
与项目内既有约定一致 > 个人口味。觉得有害就 surface，**不要 silent fork**。
**项目映射**：`coder-agent.md` 步骤 3 "标杆对齐" 已规定必须 grep 找同类模块当 reference template。

### Rule 12 — Fail loud
"完成" 错的：如果任何东西静默跳过。"测试通过" 错的：如果任何 test 被跳过。**默认 surface 不确定性**，不是 hide。
**项目映射**：`audit.js` 退出码 1 + `redo_reason` 把所有 silent-fail 维度强制暴露；Tester PASS 必须落 `adversarial.md` 真证据。

---

## AI Agent 启动纪律（铁律 · 不可妥协）

每次 spawn 一个 sub-agent（无论 Coder / Tester / TL / 其它角色），它**第一件事必须**：

1. **完整读自己的 agent 定义**（不是跳读、不是扫一眼）：
   - Coder Agent → 强制读 `.harness/agents/coder-agent.md` 全文
   - Tester Agent → 强制读 `.harness/agents/test-agent.md` 全文
   - TL Agent → 强制读 `.harness/agents/tl-agent.md` 全文
   - 在 sub-agent 的第一条输出里**显式声明**："已完整阅读 .harness/agents/{role}-agent.md，本文铁律 N 条 + 执行流程 M 步已内化。"
2. **内化任务步骤 + 铁律**（不允许跳读、跳步骤、用"我理解"替代真做）
3. **按步骤逐条执行**：对应 agent.md 每一步都要有具体动作产物
4. **结束前必做"反省自检"**：对照 agent.md 每一步、每条铁律，逐条回答：
   - 我做了吗？
   - 证据在哪（文件路径、命令输出、grep 命中行）？
   - 哪一步偷懒、跳过、打折了？
5. **任一步骤没做或打折 → 原地重做这一步**，循环直到 100% 符合 agent.md 才能修改 inflight 文件

任何 sub-agent **不读 agent.md 直接动手**、或**最后没做自检反省**、或自检发现遗漏却没补做的，TL 应视为"不合规产出"驳回，**该任务 retries++**，触发熔断后人类介入。

具体的执行要求看各自 agent.md（含权限边界、对抗规则、物理验证强度）。本节只保证"必读 + 自检"这两个前后置钩子永远不能被绕过。

### 启动纪律补充 · 每次动作前的「双脑回看」(owner: user, date: 2026-05-13)

**重要变更**：spawn 时读一次 CLAUDE.md + agent.md 不够。**sub-agent 在每次执行一个有副作用的动作（写文件、commit、改 inflight、运行测试、调用工具）之前**，必须先做以下双脑回看：

1. **回看 CLAUDE.md** 相关段落：
   - 通用工程德行 12 条 → 当前动作有没有违反 Rule 3 Surgical / Rule 9 Tests verify intent / Rule 12 Fail loud 等？
   - AI Agent 启动纪律 → 我是不是在按 agent.md 的当前 step 推进, 而不是跳步骤 / 自由发挥？
   - audit.js 卡口 → 我现在做的事是不是会破坏 work_log_dir 三件套 (coder: `coder.md`+`bugs-found.md`; tester: `tester.md`+`adversarial.md`+`test-reports/`)？
   - **Rule 6 tool-use budget** → 我数到第几次 tool use 了？已过软线 50 / 软线 70 / 硬线 85？
     - 过 50 线 → 本轮输出末必须加 self-checkpoint（tool 次数 + 估 token + 已完成/剩余）
     - 过 70 线 → 本轮输出必须 surface "接近预算"，主动问 TL 是否要 compact
     - 过 85 线 → **立即停止当前动作**，跳到 Rule 6.5 输出 compaction summary 后 return，禁止再调任何工具

2. **回看自己 agent.md** 相关段落：
   - 我现在处于哪一步（coder: step 1-7; tester: step 0 DoR / 1-6）？
   - 当前动作是不是这一步的产物？
   - 这一步要求的"证据形式"是什么（脚本 / 命令输出 / 截图 / 落盘文件 / commit hash）？
   - 当前动作有没有违反对应铁律（coder 铁律 1-5 + 补充 6; tester 铁律 1-7 + DoR 准入）？

3. **执行 = 严格按规则**：任何"我觉得这样更好" / "这样省事" / "这次先这么办" / "下次补" 的内心独白, 一律视为偷懒, 中断该动作, 重新对齐到 CLAUDE.md + agent.md 后再继续。

4. **明示双脑回看产物**：在执行真有副作用的动作前, sub-agent 可以（且鼓励）在输出里写一句简短回看摘要, 例如：
   ```
   [回看] CLAUDE.md Rule 3 Surgical · coder-agent.md §4.3 DoD 三件套
   动作: cp playwright-report/ → work_log_dir/test-reports/e2e/
   依据: §4.3 (b) 截图证据落盘
   ```
   这不强制每次都写, 但当外部审查或 TL 抽查时, 必须能给出该动作对应的 CLAUDE.md + agent.md 条款编号。

**反作弊**: spawn 时读一次后, **永远不重读 CLAUDE.md / agent.md** 的 sub-agent → 中后期容易漂移 (例如 attempt-2 时忘了 attempt-1 的 Tester reject 修复要求, 或在临时困境中放宽自己的对抗强度)。每次动作前**至少回看自己当前 step 对应的那一小段 agent.md**, 避免 silent drift。

**违反**: TL 抽查时如果 sub-agent 解释不出当前动作对应 CLAUDE.md / agent.md 的哪条规则, 视为「无指南动手」, 该轮产出驳回 retries++。

## audit.js 卡口（Tester PASS 后的确定性审计）

Tester 改完 `passes=true` 后，**harness 会自动同步调用 `harness/audit.js`**（确定性 JS 程序，**不是** AI 子代理；规则写死，不容讨价还价）。audit 5 维度全过才真 PASS，任一不过即 REDO 回到 Coder 或 Tester 重做，attempt 计数 ++，audit_retries ≥ 3 触发熔断。

每个 inflight payload 都带这些新字段，sub-agent 必须严格遵循：

- `work_log_dir`：本轮 attempt 的工作目录（形如 `audits/runs/<task>/<team>/attempt-<N>/`），harness 已自动 mkdir。
- `log_requirements`：本 phase 必须落盘的文件清单（Coder：`coder.md` + `bugs-found.md`；Tester：`tester.md` + `adversarial.md` + `test-reports/`）。
- `audit_gate`：审计规则说明。
- `previous_audit_verdict`：上一轮 REDO 时携带的 verdict 摘要（含 `redo_reason`）—— 必须对照修复，不可重复犯错。

**铁律补充（不可绕过）**：

1. **Coder spawn 第一件事不只是读 `coder-agent.md`**，还要打开 inflight 的 `work_log_dir` 路径，**在那里写 `coder.md` + `bugs-found.md`**。这两个文件落盘且符合 audit.js 规则（关键章节齐全、commit hash 真实），才能改 `dev_done=true`。
2. **Tester spawn 第一件事不只是读 `test-agent.md`**，还要在 `work_log_dir` 下写 `tester.md` + `adversarial.md` + 把真实测试 raw output 拷进 `test-reports/`。落盘且符合规则（至少 1 轮 REJECT+fix、mock 不过度）才能改 `passes=true`。
3. **任何"我口头说我做了"都无效** —— audit.js 只看落盘文件证据；文件不在、内容空、关键词缺失，一律 REDO。

audit.js 输出 `audit-verdict.json` 在 `work_log_dir/`，含 5 维度详细 pass/fail + 反例 + redo_target。被 REDO 后 sub-agent 必须读这个 verdict 修对应问题，而不是盲目重跑。

