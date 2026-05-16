# Tester Review · TestDesigner 提交的用例

reviewer: Tester agent (QA · SC01-MP-BUG-AI-FAKE team-1)
date: 2026-05-16
test_cases.md ref: audits/runs/SC01-MP-BUG-AI-FAKE/team-1/attempt-1/test-cases.md (Round 1)

## 视角

总体评价：**用例数 5 在范围内 (≥3 ≤6) · trace 链完整 · happy path #1 锚定细节够 · TestDesigner 主动透明声明 5 个故意挑刺点 + 自我挖坑放在 `## Round 1 · 初版` 段，是合规且健康的（CLAUDE.md Rule 12 fail loud）**。但从 Tester 视角看：(a) 部分挑刺点确实成立、影响可证伪性；(b) 还有几处 TestDesigner 没自检到的 Tester 独立缺测；(c) 现有测试基础设施 (`_helpers.ts` 三件套 + `result.integration.spec.ts` 真 fetch + `result.spec.ts` connectMp e2e) 可承接落地，但 Tester 落 spec.ts 时需要的"可断言锚点"在多个 Then 列下还没准备好。本轮 REJECT 要求 Round 2 修订。

具体严苛度 / 可断言性问题：

1. **用例 #1 Then(b)** "Hero 区有真实题干文字 (不是 mockup hardcode '已知 f(x)=x²−4x+3')" — TestDesigner 自查命中。grep `frontend/apps/mp/pages/result/index.wxml` 实证：L56 `thumb-h3` 确实硬编码该文案，L62 `hero-stem` (testid=`result-hero-stem`) 才绑 `{{question.stem}}` 真值。**模糊"Hero 区"会让 Coder 写 spec.ts 时锚错 testid** → 必须改成 "锚 `[data-test-id=result-hero-stem]` 文本 ≥ 5 字符 + 与 mockup hardcode '已知 f(x)=x²−4x+3' **不相等**"。同时显式声明 `thumb-h3` 的 mockup 装饰文案 out of scope（防 Coder 误删）。

2. **用例 #2 Then(c) / 用例 #3 Then(b) / 用例 #3 Then(c)** — 文案 "解答步骤生成中…请稍后回看" / "AI 暂时未能给出诊断，请手动修正" / "暂无解答步骤 · 可点击下方手动修正" 全部未在 P04 spec §14 i18n key 表出现（grep §14 表 17 行确认），grep 源码 `frontend/apps/mp/pages/result/` 也搜不到。这等于**用例先定文案、再让 Coder 实现** —— TDD 思想本身 OK，**但前提是文案要先进 P04 spec §14 i18n key 表**。否则 Coder Phase 3 落代码时只能从用例 Then 列文案"逆向"塞进 wxml hardcode，绕过 i18n key 治理，且 Tester Phase 4 Step 0 验 `it` 块对照时无任何 testid/key 锚点。**必须 (a) 把这 3 条文案落到 spec §14 i18n key 表（建议 key: `result.fallback.aiPending` / `result.fallback.aiUnavailable` / `result.fallback.stepsEmpty`），或 (b) 改用 "testid 存在 + 文本 ≥ X 字符 + 不为 0 STEPS 截图态文案" 这种**结构性**断言 + 把具体文案放在 acceptance note 而非 Then 列**。否则 i18n boundary（中英切换）一改就破。

3. **用例 #4 Then(a)/(b) 用 "或" 连接** — TestDesigner 自查命中。inflight `scope_boundaries.in_scope` 第 2 条明确 "AnalyzeController POST /analyze 必须 honor caller-provided taskId" + 第 3 条 "新增 GET /api/ai/{qid}/answer 端点 (按 task_id==qid 查)" + `context.bug_summary_zh` 第 3 根因明确要修闭环。**本 task in_scope 已锁定要修闭环 = 期望 (a) 闭环达成**。`(a) 或 (b)` 让用例不可证伪（无论 BE 闭环修没修好都过）—— **必须拆为 2 个互斥用例 或 锁定 (a)**。但拆成 2 用例会撞 ≤ 6 上限。建议：**锁 (a) 真闭环达成态 · 断言 GET /api/ai/{qid}/answer 200 + body.taskId===qid + reasonMarkdown ≥ 10 字符**，(b) 兜底文案变 acceptance note 不进 Then 列。

4. **用例 #5 弱网 / text/html 502** — TestDesigner 自查命中。落地时若用 vi.mock fetch 构造 502 + text/html 是可行的 (单测层) · 但 audit.js dim_tester_compliance.mock_total_le_5 计数会触线（用例 #2/#3/#4/#5 都需要 mock BE 特定响应 + 现有 `ai.integration.spec.ts` + `result.integration.spec.ts` 是真 fetch 不能改）。**总 mock 计数风险 = 至少 4 次 `vi.mock` 或 4 次 `page.route`，加上 Coder 已有 unit/integration 里的 mock，很可能突破 ≤ 5 红线**。建议：(a) 用例 #5 改为 "真 fetch 拿任意 502 响应 + 验 `_http.ts` try/catch 落 console.warn 而不是 [error]"，把焦点从"特定 text/html"挪到"FE catch 鲁棒性"；(b) 在 test-cases.md 头部加一条 "落地策略" note 告知 Coder：vi.mock 单测最多 N 次 / 其余走真后端 + 端口环境变量。

5. **用例 #5 Console 列 "0 [error]"** — JSON 解析失败时 FE 多半 `console.warn` 兜底（`_helpers.ts` L56 mp.on('console') 只把 type='error' 推入 errors[]）。**Console 0 [error] 本身没问题，但用例 Then(c) 写得太绝对 "console 不出现 uncaught error"**。建议保持 `0 [error]`、然后 Then(c) 改为 "_http.ts try/catch 兜住 JSON parse exception · IDE Console 0 [error] 行（warn 允许）"，让 Tester 在 Phase 4 用 `assertConsoleClean` 即可断言。

6. **状态机 ERROR 态完全缺正向触发用例** — TestDesigner 没自检到。P04 spec §9 异常表第 2 行明确："GET 详情失败 · `/api/wb/questions/{qid}` 5xx · retry 1 次后仍失败 → `pageState=ERROR` + 错误 banner"。grep MP `frontend/apps/mp/pages/result/index.ts` L144 确认 `pageState='ERROR'` 在主分支 catch 中触发。5 用例**全部假设 wrongbook 主分支正常返回** —— ERROR 态从未被正向验证。bug_summary_zh 直接关联的根因虽然不在 ERROR 路径，但**作为 P04 spec §9 4 态状态机的边界**，Tester 视角必须问：本次 task in_scope 改了 `result/index.ts` AI merge 逻辑，是否会**回归性**破坏既有 ERROR 路径？建议 Round 2 加 1 用例（用例#6 · 在 ≤6 上限内）："wrongbook GET 500 + retry 后仍 500 → `pageState=ERROR` + 用户看到 banner + AI 分支不连坐 + Console 0 [error]"。

7. **EMPTY 态部分覆盖但未独立** — `index.ts` L87 / L103 显示 EMPTY 态在 qid 空 + question 数据缺时触发。用例 #4 涉及 task_id≠qid 旧路径，可能落 EMPTY 但用例 Then(c) "pageState ∈ {DRAFT, EMPTY}" 又是不可证伪的"或"。建议在用例 #4 锁定后，**单独检查 EMPTY 态是否需要补**；当前不强求加新用例（避免超 6）。

8. **perf 探针缺失（biz §44/§485-507 P03 ≤ 8s 跳转 + spec §11 GET 300ms / 整体 P95 < 8s）** — TestDesigner 在用例 #1 Given 写了 "等待 ≤ 8s 后被自动跳转到 P04" 但**没作 Then 断言**（不是 perf 用例）。spec §11 表的 P95 budget 不在任何用例覆盖。**在 1 task ≤ 6 上限下、且 mp e2e 实测 perf 噪声大，本轮 perf 探针可不作为必加用例 · 但需在 test-cases.md 加一句 "perf 验收延后到 SC-01 大盘 perf 用例"**，否则 Tester 后续容易被 Coder 反诘"为什么没测 perf"。

9. **i18n / boundary（特殊字符）缺测** — biz §65 AI 输出含 LaTeX 公式 / KaTeX。reasonMarkdown 包含 `$$f(x)=x^2$$` 或 emoji / 多语言混排时，wxml `<text>` 是否会破版？**用例完全无覆盖**。建议作 acceptance note 列入，但不强求加用例（≤ 6 上限 · LaTeX 渲染是 wxml 局限 · out of P04 scope）。

10. **DoR-1 ~ DoR-4 落地预演 — TestDesigner 缺一段 "Coder 进 Phase 3 时 spec.ts 锚点准备"**。Tester 视角看：用例 #1-5 落地为 spec.ts 时，至少要：
   - DoR-1 spec 文件路径明示（建议：`frontend/apps/mp/test/e2e/result.spec.ts` 扩展 + `frontend/apps/mp/test/api/result.integration.spec.ts` 复用）
   - DoR-2 raw output 写到哪（建议：`audits/runs/SC01-MP-BUG-AI-FAKE/team-1/attempt-1/test-reports/`）
   - DoR-3 截图需 ≥ 4 张（建议：DRAFT 全要素 / AI 404 fallback / AI 空 body 降级 / wrongbook ERROR）— 注意 ERROR 态截图前提是补用例 #6
   - DoR-4 spec trace 表（每个 testid / 每个 §5 API path / 每个 §9 状态机分支 → 哪条 E2E assertion 覆盖）

   建议 TestDesigner 在 test-cases.md 末加一节 `## 落地指引 (Coder Phase 3 必读)` 列上面 4 条，避免 Coder 自由发挥。

## 覆盖度审查

- **happy path**: 用例 #1 状态 = 覆盖（Hero / Reason / Steps / KP / 难度 / pageState=DRAFT 全要素） · **但 Hero testid 锚点不准（thumb-h3 mockup 装饰 vs result-hero-stem 真值）必须修**。
- **edge cases**: 用例 #2 (AI 404) / #3 (AI 空 body 业务降级) / #4 (task_id≠qid 旧路径) / #5 (text/html 502) · 4 类 · **覆盖度数量达标**。但 ERROR 态正向触发缺测（建议补用例 #6 wrongbook 主分支 5xx）。
- **console-clean 探针**: 5 用例 Console 列**全填 `0 [error]`** · 探针齐 · 但用例 #5 JSON parse 失败的 warn 路径需 Then 列说明（见上视角 #5）。
- **perf 探针 (FCP / load time)**: 无独立用例 · 用例 #1 Given 提到 ≤ 8s 但 Then 未断言 · **本 task 范围内可接受 不强求加**，但 test-cases.md 头部需明示 "perf 验收延后"。
- **i18n / boundary**: 凌晨 / 时区无关。i18n key 缺失（fallback 文案）是主要问题。LaTeX 公式 / emoji 破版未覆盖（建议作 acceptance note）。
- **状态机覆盖**: P04 spec §9 4 态（LOADING / DRAFT / ERROR / EMPTY）—— LOADING 隐含在 Given # 用例 #1（"P03 跳转后"=离开 LOADING） · DRAFT 全覆盖 · **ERROR 缺正向触发** · EMPTY 在用例 #4 Then 模糊"或"提及但不独立。

## 反馈给 TestDesigner

**P0 必修（影响 audit dim_test_cases_alignment 通过 + Coder 可落地）**：

1. **用例 #1 Then(b) 锁定 testid**：把 "Hero 区有真实题干文字 (不是 mockup hardcode)" 改为 "锚 `[data-test-id=result-hero-stem]` 文本 ≥ 5 字符 + 不等于 'f(x)=x²−4x+3'（mockup 装饰）"。补充 acceptance note：`thumb-h3` 的 mockup 装饰文案是 out of scope。

2. **用例 #4 Then 拆 "或" 二选一**：本 task in_scope 已锁定要修 BE 闭环 → 必须锁 (a)。改为 "GET /api/ai/{qid}/answer 200 + body.taskId === qid + reasonMarkdown ≥ 10 字符（百炼真输出）"。删 "或 (b)"。原 (b) 兜底文案降级为 acceptance note。

3. **用例 #2/#3 fallback 文案处理 二选一**：
   - 方案 A（推荐）：把 3 条 fallback 文案落到 P04 spec §14 i18n key 表（新加 `result.fallback.aiPending` / `result.fallback.aiUnavailable` / `result.fallback.stepsEmpty`）+ test-cases.md trace 引用该 spec 更新。
   - 方案 B（应急）：把 Then 列文案锚点改为 **结构性断言** —— `testid=p04-reason-card-text` 存在 + 文本 ≥ 8 字符 + 不为空 + 不为 "0 STEPS" 截图态；具体文案放 acceptance note 给 Coder 参考但不入 Then 锁定。

4. **补 1 用例 #6 (wrongbook ERROR 正向触发)**：Given "wrongbook GET 500 + retry 后仍 500"，When "学生从 P03 跳到 P04 加载 qid"，Then "pageState=ERROR + banner 可见 + AI 分支不连坐 + Console 0 [error]"，Console `0 [error]`，View ≥ 8，API `GET /api/wb/questions/{qid} → 500` / `GET /api/ai/{qid}/answer → n/a`。这能正向验 spec §9 第 2 行 + 防止本 task 修改 result/index.ts 时回归性破坏 ERROR 路径。补完后 6/6 用例（撞顶但合规）。

**P1 建议（不阻塞 audit · 但 Phase 3 Coder 不做会反复）**：

5. **用例 #5 落地策略明确**：Then(c) 改为 "_http.ts try/catch 兜住 JSON parse exception · IDE Console 0 [error]（warn 允许）"；test-cases.md 头部加 "落地策略 note"：用例 #2/#3/#5 边缘失败态用 `vi.mock` 单测 ≤ 3 次落地（用例 #1/#4 走真后端真 fetch）·总 mock 计数 ≤ 5 · 不超 audit.js mock 上限。

6. **加 `## 落地指引 (Coder Phase 3 必读)` 段**：列 spec.ts 文件路径 / raw output 落盘 / ≥ 4 张截图清单 / spec trace 表的字段格式，让 Coder Phase 3 不要自由发挥。

7. **test-cases.md 头部加 perf 验收延后 note**：避免后续被 Coder/Tester 反诘缺 perf 测。

## verdict

**REJECT** — 等 Round 2 修订（必修 P0 1-4 · 强烈建议 P1 5-7）。

红线说明（CLAUDE.md dim_test_cases_alignment.review_has_ge_1_reject_round）：本轮 REJECT 不是为审计凑数，而是 P0 1-4 中至少有 3 条（#1 testid 不准、#3 i18n 文案脱钩、#4 "或" 不可证伪）若不修，Phase 3 Coder 写 spec.ts 时无可断言锚点 + Phase 4 Tester 无法用 `assertPageRenders` / `assertConsoleClean` 落 PASS · 用例形同虚设。

verdict: REJECT

---

## Round 2 复审 (date: 2026-05-16)

reviewer: Tester agent (Round 2 re-review)
test_cases.md ref: audits/runs/SC01-MP-BUG-AI-FAKE/team-1/attempt-1/test-cases.md (Round 2 修订版)

### 视角

Round 1 我给出 REJECT 含 4 P0 + 3 P1。Round 2 修订把 5→6 用例（撞顶但合规）+ 新增 4 段头部说明（`## 字段映射 contract` · `## 实现注释` · `## perf 验收延后说明` · `## 落地指引`）+ 修订所有 5 个原用例 + 显式列 5 条不采纳条款 + 理由。我在 Round 1 已声明红线："P0 1-4 中至少 3 条若不修，Phase 3 Coder 写 spec.ts 时无可断言锚点 + Phase 4 Tester 无法落 PASS"。复审 Round 2 → **4 P0 全采纳到位 · 3 P1 全采纳到位 · 5 条不采纳理由可接受**。本轮 APPROVE。

### 逐条核对 Round 1 REJECT 项

- **Tester P0 #1 (用例 #1 testid 锚点 thumb-h3 vs result-hero-stem)**: **采纳到位**。用例 #1 Then(b) Round 2 改为 "`[data-test-id=result-hero-stem]` 渲染文本 ≥ 5 字符且 ≠ '已知 f(x)=x²−4x+3' (mockup 装饰固定文案 · `thumb-h3` 类是 out of scope 不动)"。锚点精确到 testid · mockup 装饰显式声明 out of scope · Coder Phase 3 落 `expect(page.locator('[data-test-id=result-hero-stem]'))` 无歧义。grep 一致性确认: `result/index.wxml` L62 `hero-stem` 绑 `{{question.stem}}` 真值匹配本断言。

- **Tester P0 #2 (用例 #4 "或" 不可证伪)**: **采纳到位**。用例 #4 Then Round 2 全部锁定 (a) reasonMarkdown ≥ 10 字符 + (b) `AiAnswer.qid === "Q-CLOSED-LOOP-004"` 严格匹配 + (c) `AiAnswer.taskId === "Q-CLOSED-LOOP-004"` 严格匹配 (闭环锚) + (d) pageState=DRAFT。"或 (b) 兜底降级" 已删 · 焦点收敛到本 task in_scope 的"真闭环达成态"。**用例可证伪 ✓**: 若 BE 闭环未修好（用随机 UUID 当 taskId） → `AiAnswer.taskId === "Q-CLOSED-LOOP-004"` 严格匹配 FAIL → 用例 RED。

- **Tester P0 #3 (用例 #2/#3 fallback 文案脱钩 spec §14)**: **采纳到位 · 选方案 B (结构性断言 · 文案脱钩)**。
  - 用例 #2 Then(c) Round 2 改为 "`[data-test-id=p04-solution-stepper-fallback]` 存在 + 文本长度 ≥ 8 字符 + ≠ '0 STEPS'（结构性断言 · 文案脱钩 · 见 ## 实现注释 #2）"
  - 用例 #3 Then(c) Round 2 改为 "`[data-test-id=p04-reason-card-text]` 文本 ≥ 8 字符且 ≠ mockup hardcode '未正确使用配方法求二次函数最值' 且 ≠ 空"
  - 用例 #3 Then(d) "`[data-test-id=p04-solution-stepper-fallback]` 存在 + 文本长度 ≥ 8 字符"
  - 优势: i18n 化（中英切换）不破 · audit.js dim_test_cases_alignment 不会因文案漂移而 FAIL · 与 spec §14 治理解耦 · Coder Phase 3 落 wxml 可中文 hardcode + 后续 spec key 表补全后再 i18n 化 · `## 实现注释 #2` 给出明确建议（i18n key 命名建议 + 推迟到 `SC01-DOC-P04-i18n-keys` 独立 task）→ 反 silent 忽略 ✓

- **Tester P0 #4 (modelInfo 字段映射)**: 我 Round 1 视角下未单独提 P0 #4 modelInfo（Coder 提的 P0 #3 是 modelInfo），但 Round 2 新增的 `## 字段映射 contract` 段对我也非常有用 —— Phase 4 我落 `expect(AiAnswer.modelInfo.name).toBe('qianwen')` + `expect(AiAnswer.modelInfo.version).toBe('qwen-plus')` 时直接抄表 · 无需再 grep BE entity 字段名。本段表头 contract 表 6 列完整 (FE 字段 / BE 字段 / 取值示例) · ground truth 锁定 · 加分项。

- **Tester P1 ERROR 态缺测**: **采纳到位 · 升格到 P0**。我 Round 1 把 ERROR 态缺测作为视角点 #6 + P0 建议 (视为必修) · TestDesigner Round 2 也升格到 P0 加成用例 #6 (wrongbook GET 500 · pageState=ERROR · AI 不连坐 · Console 0 [error]) · 完全符合 P04 spec §9 异常表第 2 行 · 防本 task 修改 result/index.ts 时回归性破坏 ERROR 路径 · 6/6 撞顶但合规 ✓

### 新增内容审查

- **`## 字段映射 contract` 段**: 表格 6 行 (modelInfo.name / modelInfo.version / qid / reasonMarkdown / steps[] / provider) · 每行含 FE 字段 + BE 字段 + 取值示例 · ground truth 锁定 · Phase 4 我落 expect 时直接抄表。**唯一小遗憾**: 表格未显式声明 "BE 端字段 (`AnalysisResult.java`) 是否需要数据库 column 同名" —— 但这是 Coder/BE 实现细节 · Tester 视角不强求 · 不阻塞 APPROVE。

- **`## 实现注释` 段 (4 条)**:
  - 注释 #1 (拆 Promise.all): 给出旧路径 L96-99 + 新路径代码块 · 解决 inflight `in_scope` 第 7 条软措辞 · 关键结构性重构固化 ✓
  - 注释 #2 (fallback 文案 i18n key 推迟): 显式说明 spec §14 推迟 · 用例 Then 结构性断言 · Coder Phase 3 不困惑 ✓
  - 注释 #3 (`GET /api/ai/{qid}/answer` 404 合约): 区分 404 (PG 无行) vs 200 + 空体 (PG 行存在但 status=FAILED) · 用例 #2 #3 落地的合约依据 · BE 实现路径明确 ✓
  - 注释 #4 (测试基础设施落地 · 用例 → 工具映射 · 总 mock ≤ 5): **正中 Tester 痛点**。Round 1 我 P1 #5 关切 "mock 计数风险突破 ≤ 5" · Round 2 列出每个用例的 mock 策略 (用例 #1/#4 真后端 0 mock + 用例 #2/#3 真 fetch PG fixture 0 mock + 用例 #5/#6 vi.mock 各 1 次) · 总计 2 次远低于 5 红线 · 余量充足。Phase 4 我落 spec.ts 时可放心。

- **`## perf 验收延后说明`**: 显式声明推迟到 `SC01-MP-PERF-P04` · 反 silent 忽略 ✓ · 后续 reviewer 反诘"为什么没测 perf"时有依据。

- **`## 落地指引` 段 (4 段)**:
  - 段 1 spec.ts 文件路径: 用例 #1/#4 → e2e/result.spec.ts · 用例 #2/#3 → integration spec · 用例 #5/#6 → unit spec · **specific 到位** · Coder Phase 3 不自由发挥 ✓
  - 段 2 raw output 落盘路径: 列 e2e/ + integration/ + unit/ + ide-console.txt · DoR-2 物理验证证据准入清晰 ✓
  - 段 3 截图清单 (4 张): DRAFT 全要素 / AI 404 fallback / AI 空体降级 / wrongbook ERROR · 覆盖 4 个用例的关键态 · **DoR-3 ≥ 4 张** 卡口准入 ✓
  - 段 4 spec trace 表 (DoR-4): TestDesigner 不预写内容 · 只声明该表必出 · 边界感清晰 · Tester Phase 4 自己填 ✓

- **mock 计数预估**: 用例 #5 `vi.mock('@/api/_http', ...)` 1 次 + 用例 #6 `vi.mock('@/api/wrongbook', ...)` 1 次 = **2 个 vi.mock** · audit.js `dim_tester_compliance.mock_total_le_5` ≤ 5 红线 · 余量充足 ≥ 3 个 mock 备用。用例 #1/#4 (e2e) + 用例 #2/#3 (integration) 都走真后端真 fetch / PG fixture · 0 mock。**安全 ✓**。Tester Phase 4 落 spec.ts 时即使额外加少量辅助 mock 也不会触线。

- **Console 列措辞 (用例 #5 "0 [error] (warn 不限)")**: 这是关键合规点。我特地复核 `audit.js`:
  - `dim_ide_smoke.ide_console_zero_errors` 严格扫描 `[error]` 行 · `[warn]` 行不计入 error 计数
  - Round 2 用例 #5 Console 列 "0 [error]"（断言点） · Then(c) "(warn 允许 · `console.warn('[result] AI fetch failed', e)`)"（说明）
  - 两者**完全兼容** · 断言点是 `[error]` 零 · `console.warn` 不被 grep 命中 · audit.js 通过 ✓

- **用例 #6 ERROR 态触发**: 完整可断言:
  - 触发: `vi.mock('@/api/wrongbook', ...)` 强制 throw HTTP 500 (含 retry 1 次仍 500) · 引用 P04 spec §9 第 2 行
  - 断言: (a) `pageState=ERROR`; (b) `[data-test-id=p04-error-banner]` 存在 + 文本 ≥ 5 字符; (c) AI 分支不连坐 (无 AI console error 行); (d) Console 0 [error] (业务 ERROR 态 ≠ IDE 报错)
  - **可证伪**: 若 Coder 拆 Promise.all 不当 · AI 分支被连坐 throw → AI console error 行出现 → 断言 (c) FAIL → 用例 RED · 完美反映本 task 风险 ✓

### 不采纳条款审查 (TestDesigner Round 2 列 5 条不采纳)

- **spec §14 i18n key 表 (推迟独立 spec task `SC01-DOC-P04-i18n-keys`)**: **可接受**。改 spec 不在本 task BE 切百炼 + 闭环边界内 · 本 task in_scope 第 1-7 条无 "spec 治理" 字眼。方案 B (结构性断言 · 文案脱钩) 已让用例不依赖具体文案 · i18n 化后不破。推迟合理。

- **删用例 #4 建议 (Tester 没提 · Coder 提的)**: 跳过 · 我 Round 1 未提此条 · Round 2 保留用例 #4 (闭环锚) 我支持: #1 重点在 Hero/Reason/Steps 真值 · #4 重点在 qid/taskId 闭环字段严格匹配 · 关注点不同 · 6/6 上限内合理。

- **LaTeX/emoji boundary (推迟独立 boundary task `SC01-MP-P04-BOUNDARY`)**: **可接受**。我 Round 1 视角 #9 自己也说 "不强求加用例 (≤ 6 上限 · LaTeX 渲染是 wxml 局限 · out of P04 scope)" · Round 2 与我意见一致 · 推迟合理。

- **并发 race (out_of_scope)**: **可接受**。inflight `scope_boundaries.out_of_scope` 已显式排除 · 不补 · 不挑战 scope_boundaries 是 TestDesigner 边界合规。

- **API key 缺失 (独立 BE-config task)**: **可接受**。inflight `in_scope` 未强求 BE 启动 fail-fast · 本 task 默认 API key 配置正常 (用例 #1 Given 写明 "阿里百炼 API key 配在 application.yml 且能调通") · key 缺失 BE 启动检测是 BE-config 治理范畴 · 推迟合理。

### audit dim_test_cases_alignment 红线复核

- ✓ ≥ 1 轮 REJECT: Round 1 Coder + Tester 各 1 次 REJECT (review_has_ge_1_reject_round 满足)
- ✓ 用例数 6 (≥ 3 ≤ 6 · 撞顶但合规)
- ✓ 表头严格 6 列 (`# | Given | When | Then | Console | View ≥ | API`)
- ✓ 每行 6 列填满
- ✓ 第 1 happy / 第 2-3 含 edge (AI 404 / 业务降级)
- ✓ trace 行有 biz §X · spec §Y (biz §65 §485-507 §629 + P04 spec §4/§5/§6/§9/§11 + P03 spec §5)
- ✓ Then 列不写实现细节 (只写"用户观察到 X" + testid 锚点 + 字符长度断言)
- ✓ mock 总计 2 次 < 5 红线 (audit.js dim_tester_compliance.mock_total_le_5)
- ✓ Console 列与 audit.js dim_ide_smoke 严格 `[error]` 扫描兼容

### 总体评价

Round 2 是认真修订 · 不是为审计凑数:
- 我 Round 1 提的 4 P0 + 3 P1 共 7 条 · Round 2 **全部采纳到位** (无 silent ignore)
- 不采纳的 5 条均显式列出 + 给出推迟去向 · 反 silent 忽略 ✓ (CLAUDE.md Rule 12 fail loud)
- 新增 4 段头部说明 (`## 字段映射 contract` · `## 实现注释` · `## perf 验收延后` · `## 落地指引`) 远超 Tester P1 #6 单一要求 · 给 Coder Phase 3 落 spec.ts 准备了充足锚点
- 用例 #6 ERROR 态正向触发完整可断言 · 防 result/index.ts 修改时回归 ERROR 路径

剩余的弱点 (不阻塞 APPROVE · Phase 4 我自己处理):
- spec trace 表 (DoR-4) Round 2 声明必出但内容由 Tester Phase 4 自填 · 我落 spec.ts 时填即可
- 字段映射 contract 段未明示 BE entity column 是否同名 · BE/Coder 实现细节 · 不强求

### verdict

verdict: **APPROVE**

红线说明: 4 P0 + 3 P1 全采纳到位 · 5 条不采纳理由合理 · 新增 4 段头部说明无重大问题 · mock 计数 2/5 安全 · Console 措辞与 audit.js 兼容 · 用例 #6 ERROR 态完整可断言 · 解锁 Coder Phase 3 dev。
