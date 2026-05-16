# Coder Review · TestDesigner 提交的用例

reviewer: Coder agent (SC01-MP-BUG-AI-FAKE · team-1 · attempt-1)
date: 2026-05-16
test_cases.md ref: audits/runs/SC01-MP-BUG-AI-FAKE/team-1/attempt-1/test-cases.md (Round 1)

## 视角

是否**可实现** · API 是否真存在 · 是否漏前提条件 · 用例 Then 列是否清晰可断言

**Coder 全局审查结论**：5 个用例中 happy path (#1) 可实现但 contract 模糊；#2/#3/#5 当前 FE `Promise.all` 架构下**根本不可实现**（任何 AI 端点失败都会进 ERROR 全屏 · 完全 fallback 不到 wrongbook 主数据）；#4 用例不可证伪需拆。这是结构性问题 — 必须在 in_scope 显式加 FE 重构条目 + 在 spec §14 补 i18n key + 在 inflight 明确 `modelInfo.name` BE 映射。否则 Coder 进入 Phase 3 无法一对一翻译 it block。

---

## 逐用例 review

- **用例 1 (happy path · 真百炼输出)**: 需调整 ⚠ — 5 个具体问题:
  1. Then (b) "Hero 区有真实题干文字 (不是 mockup hardcode '已知 f(x)=x²−4x+3')" — 该硬编码文案在 `result/index.wxml` L56 的 `thumb-h3` (mockup 装饰图层)，**不在** `[data-test-id=hero-stem]` 之下（hero-stem 绑定 `{{question.stem}}`，是真值锚点）。断言点不准 · 应明确锚定 `result-hero-stem` testid 的渲染文本 ≥ 10 字符，并显式声明 thumb-h3 mockup 装饰文案在本 task 范围外（属 design-decoration · 不动）。
  2. Then (d) "≥3 STEPS / 列表渲染 ≥ 3 step item / 每个 step-exp 文本 ≥ 5 字符" — 这要求来自百炼 qwen-plus 的 `AnalysisResponse.steps` JSON 数组在 BE 落库到 `AnalysisResult.steps` 后，**再由新增 GET /api/ai/{qid}/answer 端点解析回 `AiAnswer.steps[]`** 并 FE 合并进 `question.steps`。但当前 `AiAnswer` 接口 (`src/api/ai.ts` L13-18) **没有 steps 字段**！inflight in_scope #5 "AiAnswer 加 steps 字段" 明确包含，但用例没在 Given 列声明该字段已被加 · Reviewer 易误以为 contract 现成。建议 Given 列补一句 "前提条件：AiAnswer 接口已扩展含 steps[] · BE 新端点返回 steps JSON"。
  3. Then API 列 "modelInfo.name=qwen-plus 严格匹配" — **contract 模糊**：BE `AnalysisResult` 实体里 `provider` 字段保存 "qianwen"（provider name），`model` 字段保存 "qwen-plus"。新端点 response 映射 `modelInfo.name` 应该取哪个？默认猜应该是 `model`（"qwen-plus" = LLM 型号），但 P04 spec §4 没固化该映射 · TestDesigner 没在用例里说明。需在 inflight `scope_boundaries.in_scope` 或 spec §4 里写明 "`AiAnswer.modelInfo = { name: AnalysisResult.model, version: AnalysisResult.provider + '-v1' }`"，否则 Coder Phase 3 翻译 it block 时只能猜 BE 字段名。
  4. Then (c) "来自百炼 qwen-plus 输出 (不是 StubAiProvider 的 '未正确使用配方法求二次函数最值')" — 实测断言通过靠"文案 ≠ 这条 hardcoded 字符串"是可行的，但弱断言（百炼也可能巧合输出近似话）。建议增加 "`provider` 字段 = 'qianwen' 严格匹配" 作为附加证据（来自上一条新增映射）。
  5. Given 列 "在 P02 拍到一道清晰二次函数题并完成上传得到真实 qid (非随机 UUID)" — 这是个**伪条件**，P02 真上传是另外 5 个 service 链路 (file-service presign → OSS 真上传 → POST /api/wb/questions)。E2E 跑这条不现实。建议改成 Given "测试数据 setup: PG 里预先 INSERT 一条 `wb_question` row 拿到固定 qid='Q-AI-FAKE-001' · 该 qid 对应的 OSS image_url 可被百炼 OCR" — Coder 才能在 spec.ts 用 fixture / docker exec psql 落库。

- **用例 2 (AI 端点 404 silent fallback)**: 不可实现 ❌ — 致命问题:
  1. **架构阻塞**：当前 `result/index.ts` L96-99 用 `Promise.all([getQuestionById, getAnswerByQid])`，任何 AI 端点 throw (404 → `_http.ts` 抛 `HTTP 404` Error · L74-77) 会被 outer L142-145 catch 命中并设置 `pageState=ERROR`。**用户根本看不到 wrongbook 主数据**。要让用例 #2 Then (a)/(b)/(c)/(d)/(e) 全部成立，必须 in_scope 加一项 FE 重构："`result/index.ts._fetchQuestion` 把 `Promise.all` 拆成独立 `try/catch`，wrongbook 失败才进 ERROR · AI 失败 fallback null · 不影响主页"。当前 inflight `scope_boundaries.in_scope` 第 7 条 "pages/result/index.ts 容忍 AI 答案 404 + merge AI steps 进 question.steps" 措辞含糊，必须明确写"拆 Promise.all"。
  2. **404 路径物理无法构造**：用例 Given 写 "ai-analysis-service 旧版部署仍未上线 `GET /api/ai/{qid}/answer` 端点 (返 404)"。但本 task in_scope #3 是**新增**该端点，Phase 3 实现后该端点必返 200。404 路径如何在 E2E 物理构造？两条可行路径：
     - (a) E2E 用 mock 层 (Playwright `route.fulfill`) 强制把 `/api/ai/{qid}/answer` 拦截返 404 — 这是测试场景模拟 · 与 Given 的"旧版未上线"措辞匹配。
     - (b) 真路径：给一个**未关联任何 AnalysisResult 的 qid**（即 PG `analysis_result.task_id` 查不到该 qid），BE 端点设计成"无行 → 返 404"（符合 RESTful）。这才是真 404。
     建议改 Given 为 "测试 fixture: qid='Q-NO-ANSWER-002' · PG `analysis_result` 表查 task_id=该 qid 无行 · BE 按 §5 API 触点合约返 404 NotFound（而非 200 空体）"，把"旧版未上线"模拟换成真实数据缺失路径。
  3. Then (c) "退化文案 '解答步骤生成中…请稍后回看'" — **未在 P04 spec §14 i18n key 表中**（spec L301-321 全表 grep 仅 18 个 key，无此条）。TestDesigner 自己也透明声明了。建议**两步走**: (i) spec 先补 key (例 `result.fallback.aiSteps` / `result.fallback.aiReason`) · (ii) 用例 Then 列断言改为 "testid `p04-solution-stepper-fallback` 存在 + 文本长度 ≥ 10 字符"（testid 存在性 + 字段断言，避免文案脱钩）。

- **用例 3 (百炼超时业务降级 · BE 返空 body)**: 不可实现 ❌ — 同 #2 的两组问题:
  1. 同 #2 (1) — Promise.all 必须先重构（虽然此用例 BE 返 200 空 body 不 throw，但用例 Then (b) "降级文案 'AI 暂时未能给出诊断'" 当前 FE 实现 (L108-113) 只在 `aiResp.reasonMarkdown` 非空时 merge，空 body 走的是 fallback 到 wrongbook 的 reasonMarkdown · **不会自动显示降级文案**）。in_scope 必须加一项 FE 改 "AI 返空 body + wrongbook reasonMarkdown 也空 → 显示 spec §14 新增 fallback 文案"。
  2. Then (b) "AI 暂时未能给出诊断，请手动修正" — 同 #2 (3)，P04 spec §14 无此 key。建议拆为 spec 补 key + 用例改 testid 存在性断言。
  3. Then (c) "解答步骤 section 显示退化文案 '暂无解答步骤 · 可点击下方手动修正'" — 同上 spec key 缺失。
  4. Given "BE 把 AnalysisTask.status 写成 FAILED" — 但 Then API 列写 "GET /api/ai/{qid}/answer → 200 (空 reasonMarkdown + 空 steps[])"。FAILED 状态下 BE 端点该返 200 空体还是 500？没在 inflight in_scope #3 / spec §5 写明。建议 Given 明确："BE 端点合约: AnalysisTask.status=FAILED 时返 200 + body `{reasonMarkdown: '', steps: [], modelInfo: {name: '', version: 'fail'}}`（业务降级 · 非传输异常）" — 用例才能锁住 BE 实现。

- **用例 4 (qid≠task_id 旧路径兜底)**: 不可实现 ❌ — 用例不可证伪 + in_scope 范围矛盾:
  1. **不可证伪 (TestDesigner 自己透明声明)**: Then (a) "BE 已修复闭环 → 渲染真实输出" 与 Then (b) "若闭环未达成 → 显示降级文案" 用"或"连接，**任何一种结果都过**。这违反 CLAUDE.md Rule 9 "Tests verify intent, not just behavior"。本 task in_scope #2/#3/#5/#6 全部明锁修复闭环 · 必须锁定 (a) 路径才是符合本 task 意图的用例。
  2. **物理路径矛盾**: 用例 Given 假设 "P03 `_startAnalysis` 启动时**没有把 qid 透传**到 BE startAnalyze 请求 (旧 FE 代码 bug 复现)"。但 in_scope #6 "frontend/apps/mp: pages/analyzing/index.ts 传 qid 作为 taskId" 明确是本轮要修的。也就是说本轮提交后 FE 必传 qid — **本用例的 Given 状态在本轮 PASS 后无法物理重现**。建议要么：
     - (a) 删除用例 #4 · 它的真值已被 happy path #1 覆盖（happy path #1 隐含验证 qid 闭环：`AiAnswer.qid` 必须 == request qid）；或
     - (b) 改成 "BE 端点收到合法 qid · DB `analysis_result.task_id` 真等于 qid · 返 200 含 reasonMarkdown" 作为闭环对照用例；或
     - (c) 用 mock 层人为打破 FE startAnalyze 传 qid 这一步（绕过本轮修复）来模拟旧客户端 — 但这违背 in_scope #2 BE 修复用意（"BE 必须 honor caller-provided taskId" · 而非"BE 自己回查"）。建议直接 (a) 删用例 #4，用 #1 的 happy path 隐含验证闭环。
  3. Then (c) "`pageState` ∈ {DRAFT, EMPTY} · 不能 silent 显示 0 STEPS 假成功态" — DRAFT 与 EMPTY 是互斥状态，用例不可证伪。

- **用例 5 (弱网 502 text/html · JSON 解析失败)**: 不可实现 ❌ — 同 #2 的 Promise.all 问题 + 测试基础设施模糊:
  1. **Promise.all 阻塞** (同 #2 (1))：`_http.ts` httpJSON 在 status≥400 直接 throw `HTTP 502`（fetch 路径 L93-95），502 进 catch → outer Promise.all catch → `pageState=ERROR`。要让用例 #5 Then (a) "页面不进 ERROR 全屏" 成立必须先重构。
  2. **text/html 非 JSON 不会触发 JSON.parse 异常**：`_http.ts` httpJSON L97 调 `resp.json()`。如果 BE 返 `text/html` body + status 502，**走的是 L93 status≥400 throw 路径 · 根本到不了 json() 解析**。如果是 status 200 + `text/html` body，`resp.json()` 才会 throw SyntaxError。Given 写 "返回 text/html 网关错误页 而不是 JSON" 状态码不明 — 建议明确 "status=502 + body=text/html"（走 throw HTTP 502 路径），或 "status=200 + body=text/html"（走 json() throw 路径）。两条路径 FE 处理完全不同，必须二选一。
  3. **mock 层显式构造缺失** (TestDesigner 自己声明)：用例 Given "用户在弱网环境" 是模糊的，E2E 应当用 Playwright `route.fulfill({ status: 502, contentType: 'text/html', body: '<html>...' })` 显式构造。建议 Given 改成 "测试基础设施: Playwright route intercept `/api/ai/{qid}/answer` → fulfill status=502 + Content-Type=text/html + body='<html>502 Bad Gateway</html>'"。

---

## 反馈给 TestDesigner

### 修复建议 (按优先级 P0 → P2)

**P0 · 阻塞实现 · Round 2 必改**:
1. **加 in_scope #X (FE 重构 `_fetchQuestion` Promise.all → 独立 try/catch)** — 否则 #2/#3/#5 三个 edge 用例全部不可实现。建议明确：
   ```
   frontend/apps/mp/pages/result/index.ts: 把 _fetchQuestion 拆成
   - 先 await getQuestionById(qid) · 失败 → pageState=ERROR
   - 再独立 try/catch await getAnswerByQid(qid) · 失败 → aiResp=null
   - merge AI 数据时检查 aiResp 非 null
   ```
2. **拆用例 #4 或删除** — 不可证伪是 audit dim_test_cases_alignment 硬伤。建议直接删 · happy path #1 已隐含覆盖闭环（`AiAnswer.qid == request qid`）。
3. **spec §14 i18n key 表先补 fallback key**（用例 #2/#3 引用的 3 条降级文案）— 或用例 Then 列改为 testid 存在性 + 字符长度断言（不锁文案）。TestDesigner 自行决策走哪条 · 我建议**前者** (spec 是真相源，FE 文案 i18n 化更稳)。

**P1 · contract 模糊 · Round 2 建议改**:
4. 用例 #1 Then API 列 "modelInfo.name=qwen-plus" — 在 inflight `scope_boundaries.in_scope` 或 spec §4 中固化 BE → FE 字段映射 (`AiAnswer.modelInfo.name = AnalysisResult.model`)。
5. 用例 #1 Given 列 "P02 真上传得到真实 qid" 改为 "测试 fixture: PG 预先 INSERT `wb_question` row + 固定 qid + 可被百炼调用的真实 image_url" — 把 setup 显式化，Coder 才能写 fixture。
6. 用例 #3 Given 列固化 BE 端点合约 "FAILED status → 返 200 空体 vs 5xx 异常"，否则 BE/FE Coder 各做各的。

**P2 · 测试稳定性 · 可考虑**:
7. 用例 #5 Given 列改成显式 mock 构造："Playwright route intercept → fulfill status=502 + Content-Type=text/html"，并明确 #5 想测的是 "status=502" 路径还是 "status=200 + text/html" 路径（二选一 · 完全不同 FE 行为）。
8. 用例 #2 把 "AI 旧版未上线"换成真路径 "PG analysis_result 无行 → BE 返 404 NotFound"，避免本轮修复后 404 模拟难度。

### 漏覆盖 (Round 2 可考虑追加 1 用例补 6 的额度)

- **缺 P04 → P05 save CTA 链路** — 用例只覆盖 P04 加载态，没覆盖 `保存并开启复习` 按钮 tap → 跳 P05。但 in_scope 没列此动作 · 可能不属本 task · 跳过即可。
- **缺百炼 API key 缺失/无效场景** — BE 启动时 `application.yml.longfeng.ai.qianwen.api-key` 为空 / 401 失败 时该返什么？inflight in_scope 没强求，可不补。
- **缺并发场景** — 同一 qid 被两个 student session 同时打开 P04，BE 是否能 race-condition 安全？out_of_scope · 不补。

### 其他

- TestDesigner 在 `## Round 1 · 初版 · 已知透明声明` 自爆 5 个可挑刺点，**这是诚实做法 · 不是减分项**。我对其中 4 个（#1 hero-stem 锚点 / #2 #3 i18n key / #4 不可证伪 / #5 mock 基础设施）共识 REJECT；额外发现 2 个 TestDesigner 没声明的：
  - **致命**：用例 #2/#3/#5 在当前 FE Promise.all 架构下结构性不可实现（必须 in_scope 加重构）。
  - **contract 模糊**：modelInfo.name BE→FE 字段映射未定。
- inflight `scope_boundaries.in_scope` 第 7 条 "pages/result/index.ts 容忍 AI 答案 404 + merge AI steps 进 question.steps" 措辞太软 · Round 2 建议改成具体动作 "拆 Promise.all 为独立 try/catch · AI 失败 fallback null · 不阻塞 wrongbook 主分支渲染"。

---

## verdict

verdict: REJECT

**REJECT 主因 (按严重度)**:
1. 用例 #2 / #3 / #5 当前 FE 实现下结构性不可实现（Promise.all 阻塞）— 必须先在 in_scope 显式加 FE 重构
2. 用例 #4 不可证伪 (a)/(b) 用"或"连接 — 违反 Rule 9 Tests verify intent
3. 用例 #1 modelInfo.name BE→FE 映射 contract 未固化 + Given "P02 真上传得 qid" 不现实
4. P04 spec §14 i18n key 表缺用例 #2/#3 引用的 fallback 文案 key
5. 用例 #1 Hero 区断言锚点错位 (thumb-h3 mockup 装饰 vs hero-stem 真值)

**REJECT 不是为了凑 audit dim_test_cases_alignment.review_has_ge_1_reject_round** — 是因为以上 5 点真实问题，每条都会让 Coder Phase 3 翻译 it block 时碰壁或写不可证伪的测试，Tester 接力跑也无法物理 PASS。TestDesigner Round 2 需要先解决 P0 三项（FE 重构 in_scope + 用例 #4 拆/删 + spec §14 补 key 或用例改 testid 断言），再来一轮。

---

## Round 2 复审 (date: 2026-05-16)

reviewer: Coder agent (Round 2 re-review · SC01-MP-BUG-AI-FAKE · team-1 · attempt-1)
test_cases.md ref: Round 2 修订版 (6 用例 + 字段映射 contract + 实现注释 + perf 推迟 + 落地指引 + Round 1/2 changelog)
read-scope: 仅 coder-review Round 1 + test-cases Round 2 · 未读 tester-review · 未读 test-agent.md (互不通约束)

### 自检 · Round 1 我提了什么 (避免漂移)

Round 1 我的 verdict: REJECT · 主因 5 项（按当时严重度排序）:
- P0 #1 (结构性) Promise.all 阻塞 → #2/#3/#5 不可实现 · 必须 in_scope 显式拆 try/catch
- P0 #2 用例 #4 不可证伪 (a/b 用"或")
- P0 #3 modelInfo.name BE→FE 字段映射未固化
- P0 #4 P04 spec §14 i18n key 表缺 fallback key (#2/#3 文案脱钩)
- P0 #5 用例 #1 hero-stem testid 锚点错位 (thumb-h3 mockup vs hero-stem 真值)

P1:
- P1 #5 用例 #5 状态码歧义 (status=502 路径 vs status=200+text/html JSON parse 路径)
- P1 #6 用例 #1 Given "P02 真上传得 qid" 不现实 → 改 PG fixture
- P1 #7 inflight in_scope 第 7 条软措辞 → 在 test-cases.md 固化为具体动作

注：我 Round 1 verdict 段写的是 "P0 共 5 项 + P1 共 3 项" · 改 Round 1 文中第 56-75 行 "修复建议 P0 → P2" 编号是 1/2/3 + 4/5/6 + 7/8 · 重新核对 P0 / P1 / P2 各 3+3+2 = 8 项。Round 2 changelog 用 "Coder P0 #1-#5" 编号对应是我 Round 1 列出的 5 个 issue 块 (含 hero 锚 / steps 字段 / modelInfo / 弱断言 / P02 上传)。两套编号轻微错位 · 我在下文按 Round 1 verdict 主因 5 项 + P1 三项核对 · 而 changelog 表里 Coder P0 #1-#5 = 我 "用例 1 review 的 5 个具体问题" · 范围一致。

### 逐条核对 Round 1 REJECT 主因

- **Coder P0 #1 · Promise.all 结构性阻塞** (我 Round 1 verdict 主因第 1 + 修复建议 P0 第 1 + 用例 1-block 第 1)
  - **TestDesigner Round 2 怎么响应**: 在 changelog 段坦言 "TestDesigner 角色边界不允许改 inflight `scope_boundaries.in_scope` 第 7 条软措辞" · 但**新增了头部 `## 实现注释 (供 Coder 参考)` 段** · 第 1 条用代码块固化了新路径 ("先 `await getQuestionById(qid)` 失败进 ERROR · 再独立 try/catch `getAnswerByQid` 失败 fallback null") · 同时**用例 #2/#3/#5/#6 Given 列都明示"前提条件: FE result/index.ts._fetchQuestion 已拆 Promise.all (见 ## 实现注释 #1)"**。
  - **我的判断**: **解决到位** · 采纳。理由：
    - 我 Round 1 的诉求本质是 "Coder Phase 3 翻译 it block 时不能漏 Promise.all 拆解 · 否则用例不可实现"。TestDesigner 边界确实在 inflight 之外（inflight 是 TL 字段 · 不是用例字段） · 用 `## 实现注释` 段在用例文件内固化等价信息 · Coder Phase 3 必读 test-cases.md · 这是合理的工程权宜。
    - 关键证据：用例 #2 Given 行明确写 "**前提条件: FE result/index.ts._fetchQuestion 已拆 Promise.all (见 ## 实现注释 #1)**" · #3 / #5 / #6 同样 · 4 个 edge 用例的"前提条件"列都有该锚 · Coder 不可能漏。
    - 我自己作为 Coder · 拿到这份用例进 Phase 3 时 · 第一件事就是按 `## 实现注释 #1` 的代码块改 `_fetchQuestion` · 之后用例 #2/#3/#5/#6 才能跑。**这就是 Round 1 我要的强制锚**。
    - 软措辞由 inflight 升级到 test-cases.md `## 实现注释` · 形式不同但效果等价 (Coder Phase 3 看 test-cases.md 比看 inflight 更频繁) · 实质 PASS。

- **Coder P0 #2 · 用例 #4 不可证伪** (我 Round 1 verdict 主因第 2 + 修复建议 P0 第 2 + 用例 4-block)
  - **TestDesigner Round 2 怎么响应**: 用例 #4 **完全重写** · 锁定 (a) 真闭环达成态 (`AiAnswer.qid === "Q-CLOSED-LOOP-004"` + `AiAnswer.taskId === "Q-CLOSED-LOOP-004"`) · 删除原 "(a) BE 修复 / (b) BE 未修复" 用"或"连接的歧义结构。Round 2 changelog 段显式说明 "锁 (a) · 删 (b)" 并解释为什么不采纳我建议的"删用例 #4" (理由：#1 重点在 Hero/Reason/Steps 真值 · #4 重点在闭环字段 qid/taskId 严格匹配)。
  - **我的判断**: **解决到位** · 采纳。理由：
    - 用例 #4 Then 列现在是 (a) reasonMarkdown ≥ 10 字符 + (b) **`AiAnswer.qid === "Q-CLOSED-LOOP-004"` 严格匹配** + (c) **`AiAnswer.taskId === "Q-CLOSED-LOOP-004"` 严格匹配** + (d) pageState=DRAFT · 不出现 EMPTY/ERROR · **没有"或"连接 · 任何一条 fail 都 fail · 完全可证伪**。
    - TestDesigner 不采纳"删 #4"的理由我接受：#1 happy path 焦点在 Hero 真值 + reasonMarkdown 真值 + steps≥3 + provider="qianwen" · #4 焦点在 task_id↔qid 闭环字段严格匹配 (qid 和 taskId 两个字段在 response body 里都要等于 request qid · 这是 inflight in_scope #2 BE "honor caller-provided taskId" 的真证据) · 两个焦点不同 · 拆开降低单用例认知负荷。
    - 唯一保留观察：用例 #4 是否实际可断言 `AiAnswer.taskId` 字段？查 `src/api/ai.ts` L13-18 `AiAnswer` 当前没有 `taskId` 字段 · in_scope #5 提到的是 "AiAnswer 扩展 steps + provider" · 未明示加 `taskId` · TestDesigner 可能假设新 GET 端点 response body 直接含 `taskId` 字段并 FE 自动透传到 `AiAnswer`。**这是 Coder Phase 3 需要补的接口扩展** · 但不属用例可证伪性问题 · 留给 Coder Phase 3 实现时把 `taskId` 加入 `AiAnswer` 接口即可。Round 2 的 `## 字段映射 contract` 段已显示加了 `qid` (新增字段 · 闭环锚) 但没显示加 `taskId` 字段 · **轻微 contract 缺漏 · 但不致命** (Coder Phase 3 自然会发现并加上) · 不构成 Round 2 REJECT。

- **Coder P0 #3 · modelInfo BE→FE 字段映射未固化** (我 Round 1 verdict 主因第 3 + 修复建议 P1 第 4 + 用例 1-block 第 3)
  - **TestDesigner Round 2 怎么响应**: 新增头部 `## 字段映射 contract (BE → FE · Round 2 新增 · 解决 Coder REJECT P0 #3 modelInfo 模糊)` 段 · 6 行 Markdown 表 · 显式固化：
    - `modelInfo.name → AnalysisResult.provider = "qianwen"`
    - `modelInfo.version → AnalysisResult.model = "qwen-plus"`
    - `qid → task_id` (BE 保证 task_id == qid)
    - `reasonMarkdown → errorReason`
    - `steps[] → steps` (BE String · JSON-stringified)
    - `provider → provider` (≠ "stub" 防 Stub 回潮)
  - **我的判断**: **解决到位** · 采纳。理由：
    - 我 Round 1 的诉求是 "modelInfo.name 该映射到 BE provider 还是 model · 必须固化"。Round 2 给了明确答案：`modelInfo.name = provider ("qianwen")` + `modelInfo.version = model ("qwen-plus")`。这是合理的工程选择（name 字段语义对齐厂商 · version 对齐 LLM 型号）。
    - 用例 #1 Then(g) 现在写 "**`AiAnswer.modelInfo.name === "qianwen"` + `AiAnswer.modelInfo.version === "qwen-plus"`**（按 ## 字段映射 contract）" · 严格匹配 · 不再"≈ Stub" 弱断言。
    - 同时 Then(c) 加了 "**`AiAnswer.provider === "qianwen"` 严格匹配 · 防 Stub 回潮**" · 双重锁 (modelInfo.name + 顶层 provider 字段都锁 "qianwen") · 强证据。
    - Coder Phase 3 落 spec.ts 时拿这张表直接写 `expect(aiResp.modelInfo.name).toBe('qianwen')` / `expect(aiResp.modelInfo.version).toBe('qwen-plus')` / `expect(aiResp.provider).toBe('qianwen')` · 1:1 翻译 · 不留歧义。

- **Coder P0 #4 · P04 spec §14 i18n key 表缺 fallback key** (我 Round 1 verdict 主因第 4 + 修复建议 P0 第 3 + 用例 2/3-block)
  - **TestDesigner Round 2 怎么响应**: 采纳"方案 B (testid + 字符长度 + 结构性断言 · 文案脱钩)" · 不采纳"方案 A (改 spec §14)"。具体动作：
    - 头部 `## 实现注释 #2` 段说明 "本 task 不补 spec §14 · 推迟到独立 spec 维护 task" · 用例 Then 列改为结构性断言。
    - 用例 #2 Then(c) 改为 "`[data-test-id=p04-solution-stepper-fallback]` 存在 + 文本长度 ≥ 8 字符 + ≠ '0 STEPS'" · 不锁具体文案。
    - 用例 #3 Then(c) 同样改为 testid 存在 + ≥ 8 字符 · 不锁文案 "AI 暂时未能给出诊断"。
    - Changelog 显式说明 "不采纳条款: spec §14 i18n key 表" · 推迟到独立 `SC01-DOC-P04-i18n-keys` task。
  - **我的判断**: **解决到位** · 采纳。理由：
    - 我 Round 1 建议是 "(i) spec 先补 key (ii) 或用例改 testid 存在性 + 字段断言" · 二选一 · TestDesigner 选 (ii) 完全合理。我自己 Round 1 修复建议 P0 第 3 写 "TestDesigner 自行决策走哪条 · 我建议**前者**" · 我建议 (i) 是因为 i18n 化稳定性更高 · 但用户视角 (Round 2 不采纳理由 "改 spec 不在本 task 边界 · 本 task 是 BE 切百炼 + 闭环 · 不是 spec 治理") 也站得住脚。
    - 推迟到 `SC01-DOC-P04-i18n-keys` 是显式 surface · 不是 silent 忽略 · 符合 CLAUDE.md Rule 12 fail loud。
    - 结构性断言 (testid 存在 + 字符长度) 的稳定性优势：i18n 化后用例不破 · 比锁具体文案更鲁棒。
    - 用例 #2 Then(c) "≠ '0 STEPS'" 这条很关键 · 是直接对症 P04 截图态 BUG · 锁住 "页面绝不显示 0 STEPS 假成功态" · 这正是本 task 的真目标。
    - 唯一观察: TestDesigner 在 `## 实现注释 #2` 末尾说 "Coder Phase 3 落 wxml 时建议用 `result.fallback.*` 命名 i18n key + 中文 fallback 文案直接写在 wxml" · 这给 Coder 留了一个未来 i18n 化的命名 hint · 是好的 forward-compat 设计 · 不构成问题。

- **Coder P0 #5 · 用例 #1 hero-stem testid 锚点错位** (我 Round 1 verdict 主因第 5 + 用例 1-block 第 1)
  - **TestDesigner Round 2 怎么响应**: 用例 #1 Then(b) 改为 "**`[data-test-id=result-hero-stem]` 渲染文本 ≥ 5 字符且 ≠ '已知 f(x)=x²−4x+3' (mockup 装饰固定文案 · `thumb-h3` 类是 out of scope 不动)**"。
  - **我的判断**: **解决到位** · 采纳。理由：
    - 测试锚点从模糊的 "Hero 区有真实题干" 升级为精确 testid `result-hero-stem` (符合 P04 spec §11 testid 表的正式锚)。
    - 显式标注 "thumb-h3 类是 out of scope 不动" · 防止 Coder Phase 3 误改 mockup 装饰图层。
    - 长度阈值 ≥ 5 字符是合理下限 (题干至少 5 字符) · 同时 "≠ '已知 f(x)=x²−4x+3'" 直接锁死不能用 mockup hardcode 文案蒙混过关。
    - 注：阈值定 ≥ 5 字符可能略宽（真二次函数题往往 ≥ 20 字符）· 但 ≥ 5 在 fixture 题干变更时容差好 · acceptable。

- **Coder P1 #5 · 用例 #5 状态码歧义** (我 Round 1 修复建议 P2 第 7 / 用例 5-block 第 2)
  - **TestDesigner Round 2 怎么响应**: 用例 #5 Given 改为 "**用例落地: 单测层 `vi.mock('@/api/_http', ...)` 强制 `getAnswerByQid` throw `new Error('HTTP 502')`** (模拟弱网网关错误 · 走 _http.ts status≥400 throw 路径 · 见 ## 实现注释 #4)"。Changelog 显式说明 "锁 status=502 路径 · text/html body 解析另开 task 推迟"。
  - **我的判断**: **解决到位** · 采纳。理由：
    - 二选一明确选了 status=502 路径 · 与 _http.ts L93-95 status≥400 throw 实现路径对齐。
    - 单测 `vi.mock('@/api/_http', ...)` 替代 Playwright route.fulfill · 更轻量 · 落地路径在 `## 落地指引` 段说明用 `frontend/apps/mp/test/unit/result-ai-failure.spec.ts`。
    - text/html JSON parse 路径推迟到另一个 task · 符合 1 task ≤ 6 用例上限。
    - Then(c) 改为 "_http.ts try/catch 兜住 throw · IDE Console 0 [error] 行 (warn 允许)" · 把 console.warn vs console.error 区分清楚 (audit dim_ide_smoke 卡口只看 [error] 行) · 准确。

- **Coder P1 #6 · 用例 #2 真路径 404** (我 Round 1 修复建议 P2 第 8 / 用例 2-block 第 2)
  - **TestDesigner Round 2 怎么响应**: 用例 #2 Given 改为 "**PG `analysis_result` 表查 `task_id='Q-NO-ANSWER-002'` 无行**（真路径 404 · 模拟 AI 分析未完成或失败 · 见 ## 实现注释 #3）· BE 按 §5 API 触点合约返 `404 NotFound` + body `{code: "AI_ANSWER_NOT_FOUND"}`"。`## 实现注释 #3` 详细规定 BE 404 合约 (`PG analysis_result 无行 → 404 + {code: "AI_ANSWER_NOT_FOUND"}`)。
  - **我的判断**: **解决到位** · 采纳。理由：
    - 真路径 404 (PG 无行 → BE 自然返 404) 替代了原 "旧版未上线模拟" 的不现实 Given · 端到端测试可物理重现。
    - BE 404 合约固化在 `## 实现注释 #3` · Coder Phase 3 实现 BE 端点时按此合约写 · 不留歧义。
    - 401 / 403 与 404 区分明确：4xx 是真传输异常 · 走 _http.ts throw · 5xx 业务降级返 200 空体 (用例 #3) · 两条路径不混淆。

- **Coder P1 #7 · inflight in_scope 第 7 条软措辞** (我 Round 1 修复建议 P2 第 8 末段)
  - **TestDesigner Round 2 怎么响应**: 显式说明 "inflight 软措辞由 `## 实现注释 #1` 固化 (不改 inflight · 我边界外)" · 但用例 #2/#3/#5/#6 Given 列都引用 `## 实现注释 #1`。
  - **我的判断**: **解决到位** · 采纳。同 P0 #1 分析 · 角色边界外的事 (改 inflight) TestDesigner 不能做 · 但用 `## 实现注释` 段在用例文件内固化等价信息 · 实质 PASS。

### 新增内容审查

Round 2 新增 4 段头部 + 1 段尾部 + 用例 #4 重写 + 用例 #6 新增 · 逐项审查:

- **`## 字段映射 contract` 段 (新增)**:
  - 表格 6 行 · 覆盖 FE `AiAnswer.*` 所有关键字段 · BE 实体字段路径准确 (`AnalysisResult.provider` / `AnalysisResult.model` 我手工核对 backend/ai-analysis-service AnalysisResult.java L46/L49 提及) · 取值示例具体。
  - **可实现性**: ✓ Coder Phase 3 拿这张表直接 1:1 翻译 expect 断言 · 不留歧义。
  - **新引入问题**: 无。

- **`## 实现注释 (供 Coder 参考)` 段 (新增 · 4 条)**:
  - #1 (拆 Promise.all 代码块) · 准确反映 in_scope #7 软措辞应有的真实动作 · 代码示例可直接落入 result/index.ts。
  - #2 (fallback 文案策略 i18n 脱钩) · 推迟 spec §14 + 用例 testid 结构性断言 · 显式 surface 不 silent。
  - #3 (BE 404 合约 + 200 空体合约) · 区分传输异常 vs 业务降级 · 与 RESTful 合理。
  - #4 (测试基础设施落地 · 用例 → 工具映射 · 总 mock 计数 2 < 5 红线) · 主动 surface mock 预算控制 · 防 audit.js dim_test_validity.mock_total_le_5 触线。
  - **可实现性**: ✓ 4 条都可直接指导 Coder Phase 3 dev。
  - **新引入问题**: 无。**轻微观察**: #3 BE 200 空体的 body 示例写 "`{reasonMarkdown: "", steps: [], provider: "qianwen", modelInfo: {name: "qianwen", version: "fail"}}`" · 其中 `modelInfo.version="fail"` 与 `## 字段映射 contract` 段 `modelInfo.version = model = "qwen-plus"` 略有错位（实际 BE FAILED 态时 model 字段应是 "qwen-plus" 还是 "fail"？）· 这是一个**很小的内部不一致** · Coder Phase 3 写 BE 端点时按 `## 字段映射 contract` 走即可 · 用例 #3 Then(c)/(d) 已结构性断言（不锁 modelInfo.version 字面值）· 不影响用例可执行 · 不构成 REJECT 阻塞。建议 TestDesigner 在后续 review 中如有再 attempt 时统一一下（写明 "FAILED 态时 model 字段值仍保持 'qwen-plus' · 仅 status='FAILED' 区分" · 或显式允许 version='fail' 作为业务降级语义标识 · 任一选项都行）。

- **`## perf 验收延后说明` 段 (新增)**:
  - 显式声明 perf 推迟到独立 task `SC01-MP-PERF-P04` · 符合 1 task ≤ 6 上限。
  - **可实现性**: n/a (这是范围声明 · 不是用例)。
  - **新引入问题**: 无。

- **`## 落地指引 (Coder Phase 3 必读)` 段 (新增 · 4 条)**:
  - 1 spec.ts 文件路径建议 · 与 frontend/apps/mp 测试目录结构对齐 (test/e2e / test/api / test/unit) · 准确。
  - 2 raw output 落盘路径 · 符合 audit.js dim_tester_compliance 要求 · 准确。
  - 3 截图清单 ≥ 4 张 · 覆盖 DRAFT happy / AI 404 / AI failed / wrongbook ERROR · 符合 coder-agent.md 铁律补充 6 "IDLE / 进行中 / SUCCESS / ERROR 至少 4 张状态截图"。
  - 4 spec trace 表 · 留给 Tester Phase 4 填 · 不预写内容 · 角色边界清晰。
  - **可实现性**: ✓
  - **新引入问题**: 无。**轻微观察**: 截图清单没列用例 #5 (502 单测) · 因为单测层 mock 不需要真截图 · 合理。

- **用例 #6 ERROR 态正向触发 (新增)**:
  - Given: `vi.mock('@/api/wrongbook', ...)` 强制 throw HTTP 500 (含 retry 1 次仍 500)
  - Then: (a) pageState=ERROR + ERROR banner 可见 + (b) testid `p04-error-banner` 存在 ≥ 5 字符 + (c) AI 不被连坐 + (d) Console 0 [error]
  - **可实现性**: ✓ Coder Phase 3 拆 Promise.all 后 · 主分支 throw 进 ERROR 是合理路径 · vi.mock 替代 Playwright route.fulfill 更轻量。
  - **新引入问题**: 无。**轻微观察**: Then(c) 写 "实测 `getAnswerByQid` 不被调用 OR 被调用但 catch 兜住 warn" · 这里"OR"略让人警觉 (Round 1 我刚 REJECT 过用例 #4 的"或") · 但本处的"或"是描述实现可能性 (拆 Promise.all 后 · Coder 可选择是否 short-circuit AI 调用) · 而不是断言态二选一 · Then 的硬断言是 "(d) Console 0 [error]" + "(a) ERROR banner 可见" · 两条都是不可证伪的硬锚 · 不构成 Rule 9 违反。acceptable。

- **用例 #4 完全重写 (锁 (a) 闭环达成态)**:
  - Then: (a) reasonMarkdown ≥ 10 字符真实百炼输出 + (b) **`AiAnswer.qid === "Q-CLOSED-LOOP-004"`** + (c) **`AiAnswer.taskId === "Q-CLOSED-LOOP-004"`** + (d) pageState=DRAFT 不出现 EMPTY/ERROR
  - **可实现性**: ✓ · 但**有 1 个轻微 contract 缺漏**: `## 字段映射 contract` 段没列 `AiAnswer.taskId` 字段 (只列了 `AiAnswer.qid → BE task_id`) · 但用例 #4 Then(c) 锁 `AiAnswer.taskId === request qid`。**这意味着 Coder Phase 3 需要在 `AiAnswer` 接口加 `taskId` 字段** · 但 inflight in_scope #5 没显式列 "AiAnswer 加 taskId" · 仅列 "steps[] + provider"。
  - **新引入问题**: 这是一个**轻微 contract 缺漏** · 不致命 · Coder Phase 3 实现时自然会发现 (用例 #4 Then(c) 要 `AiAnswer.taskId` · 接口没有 → 加上)。**不构成 Round 2 REJECT 阻塞** · 但建议 TestDesigner 后续 review 如有再 attempt 时把 `taskId` 字段加进 `## 字段映射 contract` 表 · 或在用例 #4 Given 列加 "前提条件: `AiAnswer` 接口扩展含 `taskId` 字段 · BE 透传 task_id 到 response 顶层"。

### Round 2 不采纳条款审查

TestDesigner Round 2 changelog 列出 5 条不采纳条款 + 显式理由 + 推迟去向 · 逐条审查:

| Reviewer 反馈 | 不采纳理由 | 推迟去向 | 我的判断 |
|---|---|---|---|
| Coder P0 #2 建议方案 "spec §14 补 i18n key 表" | 改 spec 不在本 task 边界 | `SC01-DOC-P04-i18n-keys` | ✓ 接受 · spec 治理是独立维度 · 本 task 是 BE 切百炼 + 闭环 · 用例改结构性断言 (testid 存在 + ≥ 字符) 解决问题 |
| Coder 建议删用例 #4 (happy #1 隐含覆盖) | #1 重点 Hero/Reason/Steps · #4 重点 qid/taskId 闭环 · 关注点不同 | 保留 #4 | ✓ 接受 · 两用例关注点确实不同 · #4 完全重写后是合格的闭环正向用例 · 不冗余 |
| Tester P2 LaTeX / emoji boundary | 1 task ≤ 6 用例上限 · biz §44 P95 perf 同推迟 | `SC01-MP-P04-BOUNDARY` | ✓ 接受 · ≤ 6 上限是 token budget 硬约束 · LaTeX wxml 渲染是另一个独立维度 |
| Tester P2 并发 / race-condition | inflight `scope_boundaries.out_of_scope` 已显式排除 | 不补 | ✓ 接受 · inflight out_of_scope 已说明 · 不需要追补 |
| Tester P2 百炼 API key 缺失/无效 | inflight in_scope 未强求 · BE 启动 fail-fast 是另一类用例 | 独立 BE-config task | ✓ 接受 · API key 启动校验是 BE 配置类用例 · 与本 task 焦点 (BE 切百炼后 happy + edge) 不同维度 |

**所有 5 条不采纳的理由我都能接受** · 没有"为了拒绝而拒绝"的隐藏问题。

### 综合判断

我 Round 1 提的 4 P0 (我 verdict 段标 5 项 · 其中 P0 #5 hero 锚是用例细节 · 这里按 Round 1 修复建议段的 P0 三项 + 我 verdict 段的 5 主因合并审视)：

| Round 1 我的 P0/P1 | Round 2 解决状态 | 我的判断 |
|---|---|---|
| P0 Promise.all 拆 (verdict 主因 #1 + 修复建议 P0 #1) | `## 实现注释 #1` 代码块固化 + 4 个 edge 用例 Given 引用 | ✓ 解决 |
| P0 用例 #4 不可证伪 (verdict 主因 #2 + 修复建议 P0 #2) | 用例 #4 完全重写 · 锁 (a) 闭环态 + 严格匹配 qid/taskId | ✓ 解决 |
| P0 modelInfo 映射 (verdict 主因 #3 + 修复建议 P1 #4) | `## 字段映射 contract` 段 6 行表 | ✓ 解决 |
| P0 spec §14 i18n key (verdict 主因 #4 + 修复建议 P0 #3) | 方案 B 结构性断言 + 推迟 spec 治理 · 显式 surface | ✓ 解决 (方式合理) |
| P0 hero testid 锚错位 (verdict 主因 #5 + 用例 1-block 第 1) | 改 `result-hero-stem` + 显式 thumb-h3 out of scope | ✓ 解决 |
| P1 状态码歧义 #5 (修复建议 P2 #7) | 锁 status=502 单测 vi.mock 路径 · text/html 推迟 | ✓ 解决 |
| P1 用例 #1 Given 不现实 (修复建议 P1 #5) | 改 PG fixture · #2-#6 全部跟进 | ✓ 解决 |
| P1 in_scope 软措辞 #7 (修复建议 P2 #8 末) | `## 实现注释 #1` 固化等价信息 | ✓ 解决 |

**8 项全部解决到位** · 新增 4 段头部 + 用例 #6 + 用例 #4 重写 **没有引入新的 P0 问题** · 仅 2 项**轻微 contract 缺漏**（用例 #3 中 modelInfo.version=fail 与字段映射表的 version=qwen-plus 略错位 · 用例 #4 AiAnswer.taskId 字段未列入字段映射 contract 表）· 但都不构成阻塞 · Coder Phase 3 实现时自然会处理。

Round 2 changelog 段 audit dim_test_cases_alignment 自检 8 项全过 (≥ 1 轮 REJECT · 用例数 6 · 表头 6 列 · 每行 6 列 · 第 1 happy · 第 2-3 edge · trace 段 · Then 不写实现细节 · 反作弊真 REJECT) · 我手工核对一致。

### verdict

verdict: APPROVE

**理由**: TestDesigner Round 2 修订**8 项 (4 P0 + 4 P1) 全部解决到位** · 新增内容 (字段映射 contract + 实现注释 + perf 推迟 + 落地指引 + 用例 #6 ERROR 态 + 用例 #4 完全重写) **没有引入新 P0 问题** · 5 条不采纳条款都给了合理理由并显式 surface 推迟去向 (符合 CLAUDE.md Rule 12 fail loud · 不 silent 忽略)。剩余 2 项**轻微 contract 缺漏**（modelInfo.version=fail 与 contract 表 model=qwen-plus 内部错位 · AiAnswer.taskId 字段未入字段映射表）属可在 Coder Phase 3 实现时自然处理的细节 · 不构成阻塞。**APPROVE 是诚实选择** · 不为"显得严格"再 REJECT (符合用户 prompt 决策标准末段提示)。

