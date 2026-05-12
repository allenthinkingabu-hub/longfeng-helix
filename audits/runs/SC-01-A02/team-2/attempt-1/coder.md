# SC-01-A02 · team-2 · attempt-1 · Coder 工作日志

- **Task type**: P0 审计任务（非 coding）— 输出 `audits/SC-01-PHASE-0/A02-wrongbook-api.md`
- **Branch**: 主工作树直接修改（inflight `isolation.worktree_disabled=true`，原因：Phase Z ops sandbox 未建）
- **Working directory**: `/Users/allenwang/build/longfeng/`
- **previous_audit_verdict**: `null`（首轮 attempt-1，无 REDO history）
- **Commit hash**: `616c112531ed5c022233a0098296461bd3446b37`

---

## 1. 地形侦察

**目标**：在写任何 audit 结论前，先穷尽阅读 6 份 controller 源码 + 3 份 spec §5 表格，确认现状。

### 1.1 已读 controller 源码（全部 cat-file -e 验真）

| 文件 | 行数 | 关键发现 |
| --- | --- | --- |
| `backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/controller/QuestionDetailController.java` | 193 行 | `@RequestMapping("/api/wb/questions")` · 6 个方法 1:1 对应 spec 6 触点 |
| `backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/controller/WrongItemController.java` | 116 行 | `@RequestMapping("/wrongbook/items")` · legacy v1，path var `id:Long`，SC-01 非触点 |
| `backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/controller/WrongAttemptController.java` | 已读 | `@RequestMapping("/wrongbook/items/{id}/attempts")` · SC-01 非触点 |
| `backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/controller/WrongbookSearchController.java` | 44 行 | ⚠️ `@RequestMapping("/wrongbook/questions/search")` 与 class javadoc 声明的 `/api/wb/questions/search` 不一致 |
| `backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/controller/WrongbookTagController.java` | 已读 | `@RequestMapping("/wrongbook")` · 仅 GET `/wrongbook/tags`，P05 chip filter 复用 |
| `backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/controller/HealthController.java` | 已读 | `/ready`, `/live` k8s 探针 |

### 1.2 已读 spec §5 触点表（grep 验证）

执行 `grep -n "API\|wb/questions\|wrongbook" design/system/pages/{P02-capture,P04-result,P05-wrongbook-list}.spec.md` 输出确认：
- P02 §5: `POST /api/wb/questions`（300ms · 弱网断点续传）
- P04 §5: `GET /api/wb/questions/{qid}`（400ms） / `PATCH /api/wb/questions/{qid}`（300ms） / `POST /api/wb/questions/{qid}/save`（1000ms · toast 保存中）
- P05 §5: `GET /api/wb/questions?subject=&mastery=&kp=&q=&qMode=&page=&sort=`（600ms · RRF） / `POST /api/wb/questions/{qid}/archive`（300ms · 失败 toast 回滚）

### 1.3 已读 DTO 清单（24 个）

执行 `ls backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/dto/` 输出包含全部 SC-01 必需 DTO：
- `CreateQuestionReq.java` / `CreateQuestionResp.java` — P02 POST
- `QuestionDetailResp.java` / `QuestionDetailDto.java` / `PlannedNodeDto.java` — P04 GET 聚合
- `PatchQuestionReq.java` — P04 PATCH
- `SaveQuestionReq.java` / `SaveQuestionResp.java` — P04 POST save
- `ListQuestionReq.java` / `QuestionListResp.java` / `QuestionListItem.java` — P05 GET list / archive

### 1.4 历史 audit 文件状态

旧版 `audits/SC-01-PHASE-0/A02-wrongbook-api.md` 已存在（85 行），但**严重过时**：
- 旧版判定 6/6 中只有 2 个 ✅（GET + save），其余 4 个标 ⚠️/❌
- 实际代码已在 SC-01-C01/C03 之前的某次重构里把 6 个端点全落地（`QuestionDetailController.java` L68/L84/L99/L134/L154/L187）
- audit 必须重写以反映 ground truth

### 1.5 inflight 元数据校对

读 `.harness/inflight/SC-01-A02.json` 全文确认：
- `phase = coder` · `assigned_team = team-2` · `attempt_number = 1`
- `work_log_dir = audits/runs/SC-01-A02/team-2/attempt-1`（已 `mkdir -p` 创建）
- `log_requirements.must_write` = [coder.md, bugs-found.md]
- `permissions.allowed_fields_to_modify` = [dev_done, git_commits]（**禁止** 改 passes）

### 1.6 标杆模板对齐

依 `ai/agents/coder-agent.md` 铁律 5 + 步骤 3"地形侦察与标杆对齐"要求：

- 邻近 audit `audits/SC-01-PHASE-0/A01-wrongbook-schema.md` 已存在，结构模板为「Scope / Source files / 现状 / vs Spec diff / 结论」。本审计沿用该 5 段结构（§1 现状 / §2 spec diff / §3 附加观察 / §4 SC-01 阻塞结论 / §5 完成证据）。
- 同一目录下 A03..A08 同步采用相同结构，无偏离团队约定。

---

## 2. 编码

**本任务是 P0 audit · 无业务代码改动。**

仅修改一份 markdown 文件 `audits/SC-01-PHASE-0/A02-wrongbook-api.md`：
- 旧版 85 行 → 新版 139 行，结构升级到 5 段（§1 现状 / §2 spec diff / §3 附加观察 / §4 SC-01 阻塞结论 / §5 完成证据）
- 核心改动：把 4 个 ⚠️/❌ 改为 ✅ 已实现，逐一标注源文件行号（`QuestionDetailController.java` L68/L84/L99/L134/L154/L187）
- 保留 §3.1 `WrongbookSearchController` 路径与 javadoc 不一致的 ⚠️ tech debt 标记（SC-01 范围外但需记录）
- 加 §4 阻塞 / 通行决断表 — 明确告诉下游 SC-01-C01 / SC-01-C03 不需要再造 controller skeleton

未触碰任何 Java 源码、SQL、前端代码、配置文件。

---

## 3. 真实 E2E

**本任务是 P0 audit · 无 E2E 测试需求。**

audit 是只读分析任务，输出是 markdown 文档。验真手段：
- §1.1 controller 现状表格中每行的 `@RequestMapping` 值通过 grep 直接从源文件提取（未脑补）
- §2 6 触点比对表中每个"实际落地"列的方法行号通过 `Read` 工具核实（`QuestionDetailController.java:68/84/99/134/154/187` 均在源文件中真实存在）
- spec 触点列通过 grep `design/system/pages/{P02,P04,P05}*.spec.md` §5 章节核实，无凭空捏造

无需向 `ops_tickets/` 写工单（无沙盒部署需求）。

---

## 4. 自检（对照 ai/agents/coder-agent.md 5 铁律 + 7 步骤逐条核对）

### 铁律核对

| 铁律 | 是否合规 | 证据 |
| --- | --- | --- |
| 1. 单一专注（只领 SC-01-A02 一个任务） | ✅ | inflight 只挂载 SC-01-A02，未触碰其他任务 |
| 2. 工作区隔离（在 inflight 指定 working_dir 改） | ✅ | 主工作树 `/Users/allenwang/build/longfeng/` · inflight `isolation.worktree_disabled=true` 显式允许 |
| 3. 权限隔离（只改 dev_done + git_commits，不碰 passes） | ✅ | 落盘日志后将在 inflight JSON 改 `dev_done=false→true` + `git_commits` append 当前 commit hash；passes 维持 false 不动 |
| 4. 记忆持久化（每节点必 commit + hash 入 git_commits） | ✅ | commit `616c112531ed5c022233a0098296461bd3446b37` 已落地（`git cat-file -e` 可验真）；本日志 + bugs-found.md 落盘后会触发第 2 个 commit |
| 5. 强制落盘工作日志（coder.md + bugs-found.md 关键章节 + commit hash） | ✅ | 本文件含 `地形侦察 / 编码 / 自检 / 提交` 4 个必需关键词章节；bugs-found.md 显式声明 "0 bug"（audit 类任务无 bug 修复） |

### 7 步骤核对

| 步骤 | 是否做了 | 证据 |
| --- | --- | --- |
| 1. 领取垂直场景 | ✅ | 读 `.harness/inflight/SC-01-A02.json`，未读 feature_list.json 总表 |
| 2. 全栈上下文恢复 | ✅ | 读 inflight `context.arch_docs / ui_specs / existing_code_map / spec_api_contracts / cross_page_flow / key_invariants` 全部字段 |
| 3. 全栈编码（含地形侦察 + 标杆模板） | N/A（audit 任务无代码） | §1 已完成穷尽侦察，§1.6 已对齐 A01 模板 |
| 4. 真实 E2E / VRT | N/A（audit 任务无运行时） | §3 已说明 audit 验真手段 |
| 5. 内部 DoD 自检 | ✅ | 本节即 §4 |
| 6. git commit + 落盘工作日志 | ✅ | commit `616c112...` 已完成；coder.md + bugs-found.md 即本批次落盘 |
| 7. 移交调度器 | ⏳ | 自检完成后改 inflight dev_done=true，append git_commits[]，然后 `node harness/harness.js --advance=SC-01-A02` |

### 自检反省

| 问 | 答 |
| --- | --- |
| 我做了吗？ | 5 铁律 + 7 步骤全部完成或显式 N/A 标注 |
| 证据在哪？ | §1 表格 + commit hash `616c112531ed5c022233a0098296461bd3446b37` + 本日志关键章节 |
| 哪一步偷懒了？ | 无。audit 是只读任务，无 E2E/VRT 需求，已显式 N/A 标注（非跳过） |

---

## 5. 提交

### 5.1 已落地 commits

| commit hash | message | 内容 |
| --- | --- | --- |
| `616c112531ed5c022233a0098296461bd3446b37` | `audit(SC-01-A02): refresh wrongbook-service Controller vs spec §5 — 6/6 触点已 1:1 落地于 QuestionDetailController` | 重写 `audits/SC-01-PHASE-0/A02-wrongbook-api.md`（85→139 行） |

第 2 个 commit（本日志 + bugs-found.md 落盘 + inflight 改 dev_done）的 hash 将在执行后由 harness 同步到 inflight `git_commits[]`。

### 5.2 inflight 写入

- `dev_done`: `false` → `true`
- `git_commits`: `[]` → `["616c112531ed5c022233a0098296461bd3446b37", "<hash2-after-this-log-commit>"]`
- `passes`: 不动（保持 `false`，留给 Tester）

### 5.3 移交

执行 `node harness/harness.js --advance=SC-01-A02` 唤醒 team-2 Tester。
