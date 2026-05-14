# .harness/hooks/

> **Status**: Placeholder · 待实现 (CLAUDE.md L25 已声明位置 · 实际 hook 实现 backlog)
> **Owner**: user · 创建日期 2026-05-14
> **Path**: `.harness/hooks/` (与 `.harness/agents/` / `.harness/skills/` / `.harness/feature_list.json` 同根 · 统一 harness 资产命名空间)

---

## 用途

Hooks 是 **Git 提交流水线 / 构建生命周期** 中自动唤醒 Coder / Tester / TL Agent 的入口。本目录存放钩子脚本（shell / node / python 均可），由 `.harness/harness.js` 在关键生命周期点调用。

与 Agent 的区别：
- **Agent**（在 `.harness/agents/`）= 决策者 · 由 LLM 驱动 · 读 agent.md 后做出"接下来怎么做"的判断
- **Hook**（在 `.harness/hooks/`）= 触发器 · 由 git / CI 驱动 · 确定性脚本 · 在某事件发生时**唤醒**对应 agent

---

## 预期 Hook 清单（backlog · 按需实现）

| Hook | 触发时机 | 行为 | 状态 |
|---|---|---|---|
| `pre-commit.sh` | `git commit` 前 | 检查 `.harness/inflight/<task>.json` 一致性 · 任何 `dev_done=true` 但工作日志未落盘的 task 阻止提交 | 待实现 |
| `commit-msg.sh` | commit message 校验 | 强制 commit msg 含 `SC-XX-T<NN> attempt-<N>` 前缀 + AC 编号 · 防裸 commit | 待实现 |
| `post-commit.sh` | `git commit` 后 | 检测本次 commit 是否触达 `task.git_commits[]` · 是则同步更新 inflight 状态 | 待实现 |
| `pre-push.sh` | `git push` 前 | 检查所有 `task.passes=true` 的 task 是否真有 `audits/runs/<task>/.../audit-verdict.json` + 5 维度 PASS · 缺即阻止 push | 待实现 |
| `post-checkout.sh` | `git checkout <branch>` 后 | 自动 detect 该 branch 是否为 `feature/SC-XX-T<NN>-*` · 是则 spawn TL agent 进行 inflight payload 续注入 | 待实现 |
| `pre-rebase.sh` | `git rebase` 前 | 警告：rebase 跨越 audits/runs/ 提交时是否会 lose attempt log · 强制确认 | 待实现 |

## 命名约定

- 一律 lowercase + kebab-case + `.sh` / `.js` / `.py` 后缀
- 文件头部必须含: `# Triggered by: <git event>` 注释行
- 退出码 0 = pass · 非 0 = block + 输出原因到 stderr
- 与 git 原生 hooks (`.git/hooks/`) 关系：本目录是**源**·`.git/hooks/` 是 `harness.js --init` 时生成的 symlink (`pre-commit → ../../.harness/hooks/pre-commit.sh`)

## 实现优先级（建议）

1. **第一批** (T01 attempt-6 上线前必备): `pre-commit.sh` + `commit-msg.sh`
2. **第二批** (E2E DoR 自动化): `pre-push.sh`
3. **第三批** (跨 worktree 切换无缝): `post-checkout.sh` + `pre-rebase.sh`

---

## 当前替代方案 (在 hook 实现之前)

无 hook 期间，靠 **CLAUDE.md "AI Agent 启动纪律 · 双脑回看"** + **harness.js --advance / --init 手动调** + **.harness/audit.js 自动跑** 保证规范。Agent 自己读 CLAUDE.md 做自检。

一旦 hook 实装，sub-agent 的"自检"压力下降 (硬约束从软规范变成 fail-loud)。
