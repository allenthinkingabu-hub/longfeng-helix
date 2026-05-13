# SHARED-E2E-PROTOCOL.md · Coder ⇄ Tester E2E 协议 v1

> **唯一真相源 (Single Source of Truth)**：本文件是 Coder Agent 与 Tester Agent 在端到端测试（E2E）领域共享的**唯一**契约。
> 任何与本文件冲突的 inline 规则（散落在 `coder-agent.md` / `test-agent.md` 早期版本中）一律视为已废弃。

| 元数据 | 值 |
|---|---|
| owner | project (Coder + Tester 共用) |
| last-updated | 2026-05-13 |
| 版本 | v1 (initial landing) |
| 状态 | active |

## 修订表

| 版本 | 日期 | 作者 | 摘要 |
|---|---|---|---|
| v1 | 2026-05-13 | Coder attempt-2 设计 + user-ack | 三轴隔离 + DoR 升级 4→6 项 (C-1..C-6) + 跨 attempt 复用规则 |

---

## 1 · 三轴隔离（路径表）

E2E 资产严格按"源 / 产物 / 审计快照"三轴隔离。**禁止跨轴写入**。

| 轴 | 路径 | git tracked |
|---|---|---|
| 源 · 前端 E2E（Coder） | `frontend/apps/h5/tests/e2e/<scenario>/<task>.spec.ts` | ✓ |
| 源 · 前端 E2E（Tester 对抗） | `frontend/apps/h5/tests/e2e/<scenario>/<task>.adversarial.spec.ts` | ✓ |
| 源 · 后端 E2E IT（Coder） | `backend/<svc>/src/test/java/.../<Task>E2EIT.java` | ✓ |
| 源 · 后端 E2E IT（Tester 对抗） | `backend/<svc>/src/test/java/.../<Task>AdversarialIT.java` | ✓ |
| Playwright config | `frontend/apps/h5/playwright.config.ts` | ✓ |
| VRT baseline | `design/system/screenshots/baseline/<page>-<state>.png` | ✓ |
| 产物 · Playwright report | `frontend/apps/h5/playwright-report/` | ignored |
| 产物 · 测试结果 | `frontend/apps/h5/test-results/` | ignored |
| 审计快照 · Coder | `audits/runs/<task>/<team>/attempt-<N>/test-reports/e2e/coder/{playwright,backend-it,screenshots,spec-trace.md,env-snapshot.md}/` | ✓ |
| 审计快照 · Tester | `audits/runs/<task>/<team>/attempt-<N>/test-reports/e2e/tester/{playwright,backend-it,coverage-delta.md}/` | ✓ |

**关键规则**：
- 源是「跨 attempt 复用」的，attempt-N+1 只 append 修复，不在新 attempt 子目录里复制源
- 产物是「每次 run 重生成」的，由 Playwright/Surefire 写入，禁止 git tracking
- 审计快照是「每次 attempt 拍照存档」的，**手动 `cp` 从产物轴拷过来**，git tracked，是 audit.js + Tester DoR 的唯一证据源

---

## 2 · 命名约定

| 占位符 | 含义 | 示例 |
|---|---|---|
| `<scenario>` | feature id 短名 | `sc-01` |
| `<task>` | task id 短名 | `t01-capture-to-pending` |
| `<state>` | UI 状态（至少 4 态） | `idle` / `uploading` / `success` / `error` |
| `<page>` | UI 页面短名（对齐 spec.md） | `p03-capture` / `p04-analyzing` |
| `<svc>` | 后端微服务名 | `file-service` / `wrongbook-service` |
| `<Task>` | task id PascalCase | `T01CaptureToPending` |

**截图命名严格遵循**：`<state>-{baseline,actual,diff}.png`
- 例：`uploading-baseline.png` / `uploading-actual.png` / `uploading-diff.png`
- 每个 state 三张（baseline + actual + diff），4 态共 12 张

**后端 IT 类名严格遵循**：
- Coder：`<Task>E2EIT.java`（例：`T01CaptureToPendingE2EIT.java`）
- Tester：`<Task>AdversarialIT.java`（例：`T01CaptureToPendingAdversarialIT.java`）

---

## 3 · DoR · Definition of Ready（C-1..C-6 升级版）

> **变更说明**：原 DoR 4 项（E2E 脚本 / raw 输出 / 4 截图 / spec trace）升级为 6 项 C-1..C-6。
> 新增 **C-3 verify.log BUILD SUCCESS** + **C-6 env-snapshot docker ps 真证**。

Coder `dev_done=true` 之前必须满足以下 6 项。任一项缺失 → Tester 立即 REJECT，不开测，attempt++ 回 Coder。

### C-1 · 源脚本 git tracked

- 前端：`frontend/apps/h5/tests/e2e/<scenario>/<task>.spec.ts` 真实存在且已 `git add`
- 后端：`backend/<svc>/src/test/java/.../<Task>E2EIT.java` 真实存在且已 `git add`
- 文件顶部必须含 `// trace:` 头注释，引用本任务的 biz §X.Y 与 spec.md §5/§9 锚点
  - 例：`// trace: biz/业务与技术解决方案_AI错题本.md §3.2 + design/system/pages/P-03-capture.spec.md §5/§9`
- 验真命令：`git ls-files <path>` 必须命中

### C-2 · Playwright 产物落审计快照

Coder 必须把 Playwright 跑完后的产物**拷**进审计快照：

```bash
WORK_DIR=audits/runs/$TASK/$TEAM/attempt-$N
mkdir -p $WORK_DIR/test-reports/e2e/coder/playwright/
cp frontend/apps/h5/playwright-report/index.html       $WORK_DIR/test-reports/e2e/coder/playwright/
cp frontend/apps/h5/playwright-report/junit.xml        $WORK_DIR/test-reports/e2e/coder/playwright/results.xml
# 真跑时 stdout 重定向到 run.log
pnpm exec playwright test 2>&1 | tee $WORK_DIR/test-reports/e2e/coder/playwright/run.log
```

要求：
- `index.html` 存在
- `results.xml` 存在（JUnit 格式）
- `run.log` 存在且**全绿**（无 `failed` / `timed out`）

### C-3 · 后端 IT 产物落审计快照（含 BUILD SUCCESS 真证）

Coder 必须把 `mvn verify` 真跑过（不是 `mvn test`），并把 Failsafe XML + 完整 stdout 拷进审计快照：

```bash
mkdir -p $WORK_DIR/test-reports/e2e/coder/backend-it/failsafe-xml/
cd backend/<svc>/
mvn verify 2>&1 | tee $WORK_DIR/test-reports/e2e/coder/backend-it/verify.log
cp target/failsafe-reports/TEST-*.xml $WORK_DIR/test-reports/e2e/coder/backend-it/failsafe-xml/
```

要求：
- `verify.log` 存在
- `grep -q "BUILD SUCCESS" verify.log` 命中（**不允许 BUILD FAILURE**）
- `failsafe-xml/*.xml` 至少 1 个

### C-4 · 截图证据 4 态 × 3 张 = 12 张

Coder 必须在 Playwright 脚本里覆盖至少 4 态（`idle` / `uploading` / `success` / `error`），并在每态生成 baseline + actual + diff 三张图：

```bash
mkdir -p $WORK_DIR/test-reports/e2e/coder/screenshots/
# Playwright VRT 自动生成 baseline + actual + diff
cp frontend/apps/h5/test-results/**/*.png $WORK_DIR/test-reports/e2e/coder/screenshots/
```

命名严格遵循：`<state>-{baseline,actual,diff}.png`

要求：
- 至少 12 张 `.png`（4 态 × 3 类）
- 验真命令：`ls $WORK_DIR/test-reports/e2e/coder/screenshots/*.png | wc -l` ≥ 12

### C-5 · spec-trace.md 表格（行级别追溯）

Coder 在 `$WORK_DIR/test-reports/e2e/coder/spec-trace.md` 写一张表格，每行追溯一个 testid 或 API path 或 状态机分支到具体 E2E assertion 行号：

```markdown
| testid | §5 API | §9 状态机 | assertion 行号 |
|---|---|---|---|
| capture-shutter | POST /api/file/presign | idle → uploading | t01-capture-to-pending.spec.ts:42 |
| capture-retry-btn | POST /api/file/presign | error → uploading | t01-capture-to-pending.spec.ts:88 |
| ... | ... | ... | ... |
```

要求：
- 表格至少 4 行（覆盖 4 态切换 / 主要 testid / 主要 API path）
- 每行的"assertion 行号"必须真实存在于源脚本（不可编造）

### C-6 · env-snapshot.md（docker ps + BASE_URL + 端口真证）

Coder 在 `$WORK_DIR/test-reports/e2e/coder/env-snapshot.md` 落盘真实环境快照：

````markdown
# env-snapshot · attempt-<N>

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
NAMES                PORTS                                  STATUS
longfeng-pg          0.0.0.0:5432->5432/tcp                Up 3 hours
longfeng-minio       0.0.0.0:9000->9000/tcp                Up 3 hours
longfeng-redis       0.0.0.0:6379->6379/tcp                Up 3 hours
...
```

## E2E 跑时的 BASE_URL
- PLAYWRIGHT_BASE_URL: http://localhost:5174
- file-service: http://localhost:8081
- wrongbook-service: http://localhost:8082

## DB / MinIO 端口真证
- PG: 5432 (`docker exec longfeng-pg pg_isready` → accepting connections)
- MinIO: 9000 (`curl -sI http://localhost:9000/minio/health/live` → 200 OK)
````

要求：
- `docker ps` 真实输出存在
- 至少包含跑 E2E 用到的容器（PG / MinIO / Redis 等）
- BASE_URL / 端口与 playwright.config.ts + Spring 配置一致

---

## 4 · Tester DoR 检查脚本（直接抄进 test-agent.md）

Tester 进场第一动作（**在「全维度提取」之前必须先跑**）：

```bash
WORK_DIR=audits/runs/$TASK/$TEAM/attempt-$N

# C-2: Playwright 报告
test -f $WORK_DIR/test-reports/e2e/coder/playwright/index.html || echo "DoR-C-2 FAIL: index.html missing"
test -f $WORK_DIR/test-reports/e2e/coder/playwright/results.xml || echo "DoR-C-2 FAIL: results.xml missing"
test -f $WORK_DIR/test-reports/e2e/coder/playwright/run.log || echo "DoR-C-2 FAIL: run.log missing"

# C-3: 后端 IT BUILD SUCCESS 真证
test -f $WORK_DIR/test-reports/e2e/coder/backend-it/verify.log || echo "DoR-C-3 FAIL: verify.log missing"
grep -q "BUILD SUCCESS" $WORK_DIR/test-reports/e2e/coder/backend-it/verify.log || echo "DoR-C-3 FAIL: BUILD SUCCESS not found in verify.log"

# C-4: 截图 12 张
test $(ls $WORK_DIR/test-reports/e2e/coder/screenshots/*.png 2>/dev/null | wc -l) -ge 12 || echo "DoR-C-4 FAIL: screenshots < 12"

# C-5: spec trace 表格
test -f $WORK_DIR/test-reports/e2e/coder/spec-trace.md || echo "DoR-C-5 FAIL: spec-trace.md missing"

# C-6: env-snapshot.md docker ps 真证
test -f $WORK_DIR/test-reports/e2e/coder/env-snapshot.md || echo "DoR-C-6 FAIL: env-snapshot.md missing"
grep -q "docker ps" $WORK_DIR/test-reports/e2e/coder/env-snapshot.md || echo "DoR-C-6 FAIL: docker ps output not found"
```

任一行输出 `DoR-C-X FAIL` → Tester 立即 REJECT 不开测。

---

## 5 · Tester 对抗规则（不污染 Coder 子目录）

Tester 对抗增量遵循「**import 而非 fork**」原则：

### 5.1 · 源代码层

- Tester 写 `frontend/apps/h5/tests/e2e/<scenario>/<task>.adversarial.spec.ts`
- 在 `.adversarial.spec.ts` 顶部 `import` Coder 的 helper / setup / page object，**不拷贝**也**不修改**原 `<task>.spec.ts`
- Tester 后端：写 `backend/<svc>/src/test/java/.../<Task>AdversarialIT.java`，extends 或 import Coder 的 base class

### 5.2 · 破坏性增量内容

Tester 在 `.adversarial.spec.ts` / `AdversarialIT.java` 只 append 破坏性边界用例：
- 极速疯狂连点（debounce 验证）
- 强行篡改 DOM 绕过前端校验
- 注入超长 / 特殊字符 / SQL injection 试探
- 故意阻断 API（500 / 网络超时）验证状态机降级
- 真后端 race condition（并发上传同一 key）

### 5.3 · 产物分流（**严禁污染 `e2e/coder/`**）

Tester 跑完对抗脚本后，产物拷进 **`e2e/tester/`** 子目录，**不允许**写入 `e2e/coder/`：

```bash
mkdir -p $WORK_DIR/test-reports/e2e/tester/playwright/
mkdir -p $WORK_DIR/test-reports/e2e/tester/backend-it/
cp frontend/apps/h5/playwright-report/index.html $WORK_DIR/test-reports/e2e/tester/playwright/
cp frontend/apps/h5/playwright-report/junit.xml  $WORK_DIR/test-reports/e2e/tester/playwright/
pnpm exec playwright test tests/e2e/<scenario>/<task>.adversarial.spec.ts 2>&1 \
  | tee $WORK_DIR/test-reports/e2e/tester/playwright/run.log
```

### 5.4 · coverage-delta.md（Tester 必填）

Tester 在 `$WORK_DIR/test-reports/e2e/tester/coverage-delta.md` 写表格，每行说明：
- 对抗增量覆盖了哪个超纲边界（Coder 没覆盖的）
- 用什么手段触发（连点 / DOM 注入 / API 阻断）
- 真后端 / DB 状态如何被验证（不只是 UI，要落到 wire / DB）

---

## 6 · 跨 attempt 复用规则

attempt-N+1 复用 attempt-N 的**源**（路径表中 `git tracked` 部分），只在源里 append 修复，**不**复制源到新 attempt 目录。

**新跑的产物**必须拷进**新 attempt** 的 `test-reports/e2e/coder/`（或 tester/）。

例：attempt-2 → attempt-3 流程：
```bash
# 1. 源代码层：在 attempt-2 留下的 tests/e2e/sc-01/t01-capture-to-pending.spec.ts 上直接改
vim frontend/apps/h5/tests/e2e/sc-01/t01-capture-to-pending.spec.ts

# 2. 跑新一轮 E2E
pnpm exec playwright test

# 3. 把新产物拷到 attempt-3（而不是覆盖 attempt-2 的快照）
WORK_DIR=audits/runs/SC01-T01/team-1/attempt-3
mkdir -p $WORK_DIR/test-reports/e2e/coder/{playwright,backend-it,screenshots}/
cp frontend/apps/h5/playwright-report/index.html $WORK_DIR/test-reports/e2e/coder/playwright/
# ...

# 4. attempt-2 的 test-reports/ 不动，是历史快照
```

这样 attempt-N 的审计快照永远是「那一次 run 的真实证据」，不会被后续 run 覆盖。

---

## 7 · Coder 产物 cp 命令模板（直接抄）

```bash
# === Coder Step 4.3 真机跑通后产物落审计快照 ===
TASK=SC01-T01
TEAM=team-1
N=3                          # 当前 attempt 号
WORK_DIR=audits/runs/$TASK/$TEAM/attempt-$N

mkdir -p $WORK_DIR/test-reports/e2e/coder/playwright/
mkdir -p $WORK_DIR/test-reports/e2e/coder/backend-it/failsafe-xml/
mkdir -p $WORK_DIR/test-reports/e2e/coder/screenshots/

# (a) Playwright 报告
cp frontend/apps/h5/playwright-report/index.html       $WORK_DIR/test-reports/e2e/coder/playwright/
cp frontend/apps/h5/playwright-report/junit.xml        $WORK_DIR/test-reports/e2e/coder/playwright/results.xml
# (run.log 应是 tee 的产物，在跑测试时已落盘)

# (b) 后端 IT (在 backend/<svc>/ 真跑过 mvn verify 后)
cp backend/<svc>/target/failsafe-reports/TEST-*.xml    $WORK_DIR/test-reports/e2e/coder/backend-it/failsafe-xml/
# verify.log 应是 tee 的产物

# (c) 截图 4 态 × 3 张
cp frontend/apps/h5/test-results/**/*.png              $WORK_DIR/test-reports/e2e/coder/screenshots/
# 重命名为 <state>-{baseline,actual,diff}.png（Coder 自己整理）

# (d) spec-trace.md + env-snapshot.md 手写
# 见 §3 C-5 / C-6
```

---

## 8 · 与现有 agent.md 的关系

- `ai/agents/coder-agent.md` §4.3 + 铁律补充 6 → **改为引用本文件**，删除 inline 路径细节
- `ai/agents/test-agent.md` DoR §step 0 → **改为引用本文件 §3 + §4**，删除 inline DoR 4 项细节
- 任何 inline 重复定义都视为已 deprecated，以本文件为准（Rule 7 Surface conflicts, don't average them）
