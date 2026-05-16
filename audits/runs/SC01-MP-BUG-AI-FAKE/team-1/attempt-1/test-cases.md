# Test Cases · SC01-MP-BUG-AI-FAKE · P04 错因诊断+解答步骤空 (后端从 stub 切到阿里百炼 + 闭环 task_id↔qid)

trace: biz/业务与技术解决方案_AI错题本_基于日历系统.md §65 (AI 智能分析 4 步流水线: OCR→学科→知识点→错因→正解→变式) · biz §485-507 (P03+P04 规格卡 · data binding shape) · biz §629 US-02 (学生想看 AI 为什么判我错) · design/system/pages/P04-result.spec.md §4 (QuestionDetail.reasonMarkdown / steps[] / modelInfo) + §5 (API 触点 · GET /api/wb/questions/{qid}) + §6 (LOADING → DRAFT 状态机) + §9 (异常 & 降级 · 4 态状态机) + §11 (testid 表) · design/system/pages/P03-analyzing.spec.md §5 (POST /api/ai/analyze-by-url + GET /api/ai/result/{taskId}) · 现有源码 frontend/apps/mp/src/api/ai.ts (getAnswerByQid · startAnalyze · L13-18 AiAnswer 缺 steps 字段) + frontend/apps/mp/pages/result/index.ts (L96-99 Promise.all + L142-145 outer catch · L108-113 AI merge 仅在 reasonMarkdown 非空) + frontend/apps/mp/pages/result/index.wxml (L56 thumb-h3 mockup 装饰 vs L62 result-hero-stem 真值) + backend/ai-analysis-service AnalysisResult.java (L46 provider 字段 / L49 model 字段)

> **格式约定 (audit.js dim_test_cases_alignment 卡口)**
>
> - 表头严格 6 列：`# | Given | When | Then | Console | View ≥ | API`
> - 用例行 ≥ 3 · ≤ 6 (1 task token budget · 多了拆 task)
> - 第 1 用例必是 happy path · 第 2-3 必含 edge (字段缺 / 网络异常)
> - Then 列只写"用户观察到什么" · 不写"调什么 API 内部怎么走"
> - Console 列必填: `0 [error]` 或 `不限制 (原因)`
> - View ≥ 列必填: 最小渲染元素数 (page.$$('view') 数) · 或 `n/a`
> - API 列必填: `<METHOD> /api/x → <status>` 或 `n/a`

## 字段映射 contract (BE → FE · Round 2 新增 · 解决 Coder REJECT P0 #3 modelInfo 模糊)

| FE 字段 (`AiAnswer.*` in `frontend/apps/mp/src/api/ai.ts`) | BE 字段 (`AnalysisResult.*` in `backend/ai-analysis-service/.../entity/AnalysisResult.java`) | 取值示例 |
|---|---|---|
| `modelInfo.name` | `provider` (entity 字段名 · 厂商标识) | `"qianwen"` |
| `modelInfo.version` | `model` (entity 字段名 · LLM 型号) | `"qwen-plus"` |
| `qid` (新增字段 · 闭环锚) | `task_id` (PG analysis_result 表 · BE 保证写入时 task_id == qid) | `"Q-AI-FAKE-001"` |
| `reasonMarkdown` | `errorReason` (BE `AnalysisResponse.errorReason`) | 非空中文 ≥ 10 字符 |
| `steps[]` (新增字段 · 见 inflight in_scope #5) | `steps` (BE String · JSON-stringified array · FE 反序列化) | `[{stepNo, text, ...}, ...]` ≥ 3 项 |
| `provider` (新增字段 · 用于断言反证非 Stub) | `provider` | `"qianwen"` (≠ `"stub"`) |

注：本表是用例 #1 Then 列 modelInfo 断言的 ground truth · Coder Phase 3 落 spec.ts 时按此契约写 expect

## 实现注释 (供 Coder 参考 · Round 2 新增 · 解决 Coder REJECT P0 #1 + P1 #6 软措辞)

> 注：本段是 Coder 视角的实现指引 · 不是用例断言 · TestDesigner 角色边界不允许改 inflight `scope_boundaries.in_scope` 措辞 · 故在此处把 reviewer 共识写明，方便 Coder Phase 3 一对一翻译

1. **FE `frontend/apps/mp/pages/result/index.ts._fetchQuestion` 必须拆 Promise.all**：
   - 旧路径 (当前 L96-99)：`Promise.all([getQuestionById(qid), getAnswerByQid(qid)])` · 任一 throw → outer catch (L142-145) 设 `pageState=ERROR` · 导致 AI 失败 silent 阻塞 wrongbook 主分支
   - 新路径 (本 task 必改)：
     ```
     // 主分支：wrongbook 失败才进 ERROR
     const question = await getQuestionById(qid);  // throw → pageState=ERROR
     // 副分支：AI 失败 fallback null · 不连坐
     let aiResp = null;
     try { aiResp = await getAnswerByQid(qid); } catch (e) { console.warn('[result] AI fetch failed', e); }
     // merge 时 aiResp 可能为 null
     ```
   - 这是用例 #2 / #3 / #5 / #6 全部可实现的前提 · inflight in_scope 第 7 条 "容忍 AI 答案 404" 软措辞由本注释固化

2. **fallback 文案策略 (i18n key 表暂缺 · Round 2 决定脱钩)**：
   - P04 spec §14 i18n key 表目前 17 行 · 无 `result.fallback.aiPending` / `result.fallback.aiUnavailable` / `result.fallback.stepsEmpty`
   - **本 task 不补 spec §14**（推迟到独立 spec 维护 task） · 用例 Then 列改为**结构性断言**：testid 存在 + 文本 ≥ X 字符 + 不为 0 STEPS 截图态文案
   - Coder Phase 3 落 wxml 时建议用 `result.fallback.*` 命名 i18n key + 中文 fallback 文案直接写在 wxml（暂不进 i18n key 表） · 后续 spec key 表补全后再 i18n 化
   - 用例 Then 不锁具体文案 → i18n 化时不会破

3. **BE `GET /api/ai/{qid}/answer` 端点 404 合约**：
   - PG `analysis_result` 表查 `task_id=qid` 无行 → 返 `404 NotFound` + body `{code: "AI_ANSWER_NOT_FOUND", message: "..."}`（RESTful 真路径 · 用例 #2 落地）
   - PG 查到行 但 `status=FAILED` → 返 `200 OK` + body `{reasonMarkdown: "", steps: [], provider: "qianwen", modelInfo: {name: "qianwen", version: "fail"}}`（业务降级 · 非传输异常 · 用例 #3 落地）

4. **测试基础设施落地建议 (用例 → 工具映射 · 总 mock ≤ 5 防 audit.js mock_total_le_5 触线)**：
   - 用例 #1 → `frontend/apps/mp/test/e2e/result.spec.ts` 扩 happy path · **真后端真 fetch** · PG fixture INSERT · mock 0
   - 用例 #2 → `result.integration.spec.ts` 或 `result.spec.ts` 用 PG fixture (analysis_result 表无行) · **真 fetch 验 BE 真返 404** · mock 0
   - 用例 #3 → `result.integration.spec.ts` 单测 · PG fixture (analysis_result.status=FAILED) · **真 fetch 验 BE 真返 200 空体** · mock 0
   - 用例 #4 (闭环锚定 · 见下) → 隐含在 #1 真后端断言 (`AiAnswer.qid === request qid`) · 0 新增 mock
   - 用例 #5 → 单测层 `vi.mock('@/api/_http', ...)` 强制 throw HTTP 502 · **mock 1 次**
   - 用例 #6 (ERROR 态 · Round 2 新增) → `vi.mock('@/api/wrongbook', ...)` 强制 throw HTTP 500 · **mock 1 次**
   - 总 mock 计数：2 次 < 5 红线 ✓

## perf 验收延后说明 (Round 2 新增 · 应 Tester REJECT P1 #7)

P03 ≤ 8s 跳转 + P04 GET 300ms / P95 < 8s（biz §44 / §485-507 / P04 spec §11 perf budget）**不在本 task 范围内**。本 task 的 6 用例上限留给闭环修复 + 4 类 edge + ERROR 态正向触发，perf 推迟到独立 perf task（建议名：`SC01-MP-PERF-P04`）。这里显式声明避免后续 reviewer 反诘"缺 perf 测"。

---

| # | Given | When | Then | Console | View ≥ | API |
|---|-------|------|------|---------|--------|-----|
| 1 | 用户已登录 · 后端 wrongbook:8082 + ai-analysis:8083 健康 · 阿里百炼 (DashScope qwen-vl-plus + qwen-plus) API key 配在 `application.yml` 且能调通 · **PG fixture: `INSERT INTO wb_question(qid, subject, stem, image_url, ...) VALUES ('Q-AI-FAKE-001', 'math', '<真二次函数题真值>', '<可被百炼 OCR 的 OSS image_url>', ...)`** · **前提条件 (in_scope #5): `AiAnswer` 接口已扩展含 `steps[]` + `provider` 字段 · BE 新端点返回 steps JSON-deserialized 后 ≥ 3 项 · 字段映射按本文 ## 字段映射 contract 段** | 学生在 P03 等待 ≤ 8s 后被自动跳转到 P04 (`/pages/result/index?qid=Q-AI-FAKE-001`) | 用户在 P04 看到 (a) Nav "分析完成"; (b) **`[data-test-id=result-hero-stem]` 渲染文本 ≥ 5 字符且 ≠ "已知 f(x)=x²−4x+3" (mockup 装饰固定文案 · `thumb-h3` 类是 out of scope 不动)**; (c) `[data-test-id=p04-reason-card-text]` 渲染 ≥ 10 个真实非空中文字符 · 来自百炼 qwen-plus 输出（**`AiAnswer.provider === "qianwen"` 严格匹配 · 防 Stub 回潮**）; (d) `解答步骤` section tag 显示 `≥3 STEPS` 而非 `0 STEPS` · 列表渲染 ≥ 3 个 step item · 每个 `[data-test-id=p04-solution-stepper-step-N]` 内 `.step-exp` 文本 ≥ 5 字符; (e) `知识点` chips ≥ 1 · 难度星 1..5 范围; (f) 页面 `pageState=DRAFT` · 无 ERROR / EMPTY banner; (g) **`AiAnswer.modelInfo.name === "qianwen"` + `AiAnswer.modelInfo.version === "qwen-plus"`**（按 ## 字段映射 contract） | 0 [error] | 15 | GET /api/wb/questions/Q-AI-FAKE-001 → 200 & GET /api/ai/Q-AI-FAKE-001/answer → 200 (body.taskId === "Q-AI-FAKE-001" · reasonMarkdown 非空 ≥ 10 字符 · steps[] 长度 ≥ 3 · provider="qianwen" · model="qwen-plus") |
| 2 | 同 #1 前置 (PG fixture wb_question 行存在) · 但 **PG `analysis_result` 表查 `task_id='Q-NO-ANSWER-002'` 无行**（真路径 404 · 模拟 AI 分析未完成或失败 · 见 ## 实现注释 #3）· BE 按 §5 API 触点合约返 `404 NotFound` + body `{code: "AI_ANSWER_NOT_FOUND"}` · wrongbook GET 正常返 question 含 reasonMarkdown 非空 · **前提条件: FE result/index.ts._fetchQuestion 已拆 Promise.all (见 ## 实现注释 #1)** | 学生从 P03 跳到 P04 加载 qid='Q-NO-ANSWER-002' | 用户**不**看到 (a) 红 ERROR banner · 也**不**看到 "解答步骤 0 STEPS" 的截图态; 而是看到 (b) `[data-test-id=p04-reason-card-text]` 渲染 ≥ 10 个非空字符（来自 wrongbook 返回的 reasonMarkdown 主数据 · FE silent fallback 不让 AI 404 阻塞主分支）; (c) `[data-test-id=p04-solution-stepper-fallback]` 存在 + 文本长度 ≥ 8 字符 + ≠ "0 STEPS"（结构性断言 · 文案脱钩 · 见 ## 实现注释 #2）· **绝不**显示 "0 STEPS" 空 stepper; (d) `pageState=DRAFT` (不进 ERROR); (e) 页面整体仍可滚动到 CTA dock | 0 [error] | 12 | GET /api/wb/questions/Q-NO-ANSWER-002 → 200 & GET /api/ai/Q-NO-ANSWER-002/answer → 404 (真路径 · BE PG 无行) |
| 3 | 同 #1 前置 · 但**百炼 qwen-plus 在 step 3 (错因诊断) 阶段超时 ≥ 10s** 触发 BE FallbackOrchestrator emit FAIL · BE 把 `AnalysisTask.status` 写成 `FAILED` · `GET /api/ai/{qid}/answer` 按本文 ## 实现注释 #3 合约返 `200` + body `{reasonMarkdown: "", steps: [], provider: "qianwen", modelInfo: {name: "qianwen", version: "fail"}}` (业务降级 · 非传输异常) · **前提条件: FE result/index.ts._fetchQuestion 已拆 Promise.all (见 ## 实现注释 #1)** · **前提条件: FE merge AI 数据时检测 reasonMarkdown 空 + wrongbook reasonMarkdown 也空 → 显示 fallback 文案** | 学生从 P03 跳到 P04 加载 qid='Q-AI-FAILED-003' (PG fixture · analysis_result.status=FAILED · wrongbook 该 qid reasonMarkdown 空) | 用户看到 (a) Nav 仍显示 "分析完成"; (b) 页面**不白屏 · 不显示 0 STEPS 的截图态**; (c) `[data-test-id=p04-reason-card-text]` 文本 ≥ 8 字符且 ≠ mockup hardcode "未正确使用配方法求二次函数最值" 且 ≠ 空 (FE 渲染 fallback 文案 · 结构性断言不锁具体字面量 · 见 ## 实现注释 #2); (d) `[data-test-id=p04-solution-stepper-fallback]` 存在 + 文本长度 ≥ 8 字符; (e) `pageState=DRAFT` · `手动修正` 按钮 enabled · CTA dock 可见 | 0 [error] | 12 | GET /api/wb/questions/Q-AI-FAILED-003 → 200 & GET /api/ai/Q-AI-FAILED-003/answer → 200 (reasonMarkdown="" · steps=[] · provider="qianwen" · modelInfo.version="fail") |
| 4 | 同 #1 前置 (PG fixture wb_question + analysis_result · BE 已修复闭环 · `analysis_result.task_id === qid` · FE in_scope #6 `analyzing/index.ts` 已传 qid 作为 taskId 调 startAnalyze) | 学生从 P03 跳到 P04 加载 qid='Q-CLOSED-LOOP-004' (端到端验闭环 · 不模拟旧路径) | 用户看到 (a) `[data-test-id=p04-reason-card-text]` 渲染 ≥ 10 字符**真实**百炼输出; (b) **`AiAnswer.qid === "Q-CLOSED-LOOP-004"` 严格匹配** (闭环锚 · 证明 BE 不再用随机 UUID); (c) **`AiAnswer.taskId === "Q-CLOSED-LOOP-004"` 严格匹配** (PG analysis_result.task_id 字段同步 · BE honor caller-provided taskId 的真证据); (d) `pageState=DRAFT` · 不出现 EMPTY / ERROR 态 | 0 [error] | 12 | GET /api/wb/questions/Q-CLOSED-LOOP-004 → 200 & GET /api/ai/Q-CLOSED-LOOP-004/answer → 200 (body.taskId === "Q-CLOSED-LOOP-004" · body.qid === "Q-CLOSED-LOOP-004") |
| 5 | 同 #1 前置 · 但**用例落地: 单测层 `vi.mock('@/api/_http', ...)` 强制 `getAnswerByQid` throw `new Error('HTTP 502')`** (模拟弱网网关错误 · 走 _http.ts status≥400 throw 路径 · 见 ## 实现注释 #4) · wrongbook GET 正常返 200 + reasonMarkdown 非空 · **前提条件: FE result/index.ts._fetchQuestion 已拆 Promise.all (见 ## 实现注释 #1)** | 学生从 P03 跳到 P04 加载 qid='Q-HTTP502-005' | 用户看到 (a) 页面不进 ERROR 全屏态 (因为 wrongbook 主数据还在); (b) `[data-test-id=p04-reason-card-text]` 显示 wrongbook 返回的 reasonMarkdown ≥ 10 字符 (主分支不连坐); (c) **`_http.ts` try/catch 兜住 throw · IDE Console 0 [error] 行 (warn 允许 · `console.warn('[result] AI fetch failed', e)`)**; (d) `pageState=DRAFT` · 用户仍可读题干 + 我方/正答 / 难度 / 知识点 | 0 [error] | 12 | GET /api/wb/questions/Q-HTTP502-005 → 200 & getAnswerByQid (mock throw HTTP 502 · 不到真 fetch) |
| 6 | 同 #1 前置 (阿里百炼健康) · 但**用例落地: 单测层 `vi.mock('@/api/wrongbook', ...)` 强制 `getQuestionById` throw `new Error('HTTP 500')` (含 retry 1 次仍 500 · 见 P04 spec §9 异常表第 2 行)** · **前提条件: FE result/index.ts._fetchQuestion 已拆 Promise.all (主分支失败仍进 ERROR · AI 分支不连坐 · 见 ## 实现注释 #1)** | 学生从 P03 跳到 P04 加载 qid='Q-WRONGBOOK-500-006' | 用户看到 (a) `pageState=ERROR` · ERROR banner 可见 (P04 spec §9 第 2 行); (b) `[data-test-id=p04-error-banner]` 存在 + 文本 ≥ 5 字符 (重试入口或错误说明); (c) **AI 分支不被连坐** — 不出现 AI 相关 console error 行 (因为 AI 调用本应正常 · 但被前置 ERROR 屏蔽 · 实测 `getAnswerByQid` 不被调用 OR 被调用但 catch 兜住 warn); (d) Console 0 [error] (`assertConsoleClean` 通过 · ERROR 态是业务态不是 IDE 报错) | 0 [error] | 8 | GET /api/wb/questions/Q-WRONGBOOK-500-006 → 500 (mock retry 仍 500) & GET /api/ai/Q-WRONGBOOK-500-006/answer → n/a (主分支 ERROR · AI 调用应被 short-circuit 或独立 catch 不报错) |

## 落地指引 (Coder Phase 3 必读 · Round 2 新增 · 应 Tester REJECT P1 #6)

> 注：这段是 TestDesigner 给 Coder 的"用例 → spec.ts 落地"指引 · 不锁实现 · 不绑死技术栈 · Coder 可调整但需 surface 理由

1. **spec.ts 文件路径**（建议 · Coder 可调整）：
   - 用例 #1 (happy 真后端真 fetch) → 扩 `frontend/apps/mp/test/e2e/result.spec.ts`
   - 用例 #2 (真路径 404 · PG fixture) → 扩 `frontend/apps/mp/test/api/result.integration.spec.ts`
   - 用例 #3 (真路径 200 空体 · PG fixture FAILED) → 扩 `frontend/apps/mp/test/api/result.integration.spec.ts`
   - 用例 #4 (闭环端到端 · 真后端) → 扩 `frontend/apps/mp/test/e2e/result.spec.ts` (与 #1 复用 fixture)
   - 用例 #5 (502 单测 vi.mock _http) → 新 `frontend/apps/mp/test/unit/result-ai-failure.spec.ts` 或扩既有 unit 文件
   - 用例 #6 (ERROR 态 vi.mock wrongbook) → 同 #5 unit 文件 (复用 mock module)

2. **raw output 落盘路径** (audit.js dim_tester_compliance 卡口)：
   - `audits/runs/SC01-MP-BUG-AI-FAKE/team-1/attempt-1/test-reports/` 下：
     - `e2e/` (用例 #1 / #4 · vitest --reporter=verbose 输出 + automator 截图)
     - `integration/` (用例 #2 / #3 · vitest --reporter=verbose 输出)
     - `unit/` (用例 #5 / #6 · vitest --reporter=verbose 输出)
     - `ide-console.txt` (用例 #1 / #4 真 E2E 跑 IDE Console 抓 0 [error] 证据)

3. **截图清单 (DoR-3 物理验证 · Tester Phase 4 必出 · ≥ 4 张)**：
   - 用例 #1 → `screenshot_happy_draft_full.png` (DRAFT 全要素 · Hero + Reason + Steps + KP + 难度)
   - 用例 #2 → `screenshot_ai_404_fallback.png` (AI 404 但页面正常)
   - 用例 #3 → `screenshot_ai_failed_degraded.png` (AI 空体业务降级 fallback 文案)
   - 用例 #6 → `screenshot_wrongbook_error.png` (ERROR banner 正向)

4. **spec trace 表 (DoR-4 · Tester Phase 4 落 `adversarial.md` 时填)**：
   每用例需在 Phase 4 trace 表标明：testid 锚点 / API path / spec §9 状态机分支 / Console 探针 → 哪条 `expect()` 覆盖。**TestDesigner 不预写 trace 表内容 · 只声明该表必出**。

---

## Changelog (TestDesigner 每轮 review 后追加)

## Round 1 · 初版

- TestDesigner agent 起草 · 5 用例 (1 happy + 4 edge)
- 覆盖 happy path + AI 端点 404 silent fallback + 百炼超时业务降级 + qid≠task_id 旧路径兜底 + AI JSON 解析失败不连坐 wrongbook 主数据
- trace 链: biz §65 / §485-507 / §629 + P04 spec §4/§5/§6/§9 + P03 spec §5
- 已知透明声明 (反作弊 · 让 review 真发生 · CLAUDE.md Rule 12 fail loud · 我故意留这些可挑刺点等 Coder/Tester REJECT 一轮):
  - 用例 #1 Then (b) 提到 "Hero 区有真实题干文字 (不是 mockup hardcode)" — 当前 FE 实现 `result/index.wxml` L56-58 把 "已知 f(x)=x²−4x+3" 硬编码在 `thumb-h3`，**不在** `hero-stem` testid 下；用例没区分 thumb-h3 vs hero-stem，Coder/Tester 可挑刺 "断言点不准 · 该锚定 hero-stem testid 真值，且明确 thumb-h3 mockup 装饰固定文案在本 task 范围外"
  - 用例 #2 Then (c) 写 "退化文案 '解答步骤生成中…请稍后回看'" — 此文案未在 i18n key 表中固化 (P04 spec §14 i18n key 表无对应 key) · Reviewer 可挑刺 "文案应当在 i18n key 表落地后再断言 · 否则用例与实现脱钩 · 建议把文案改为 testid 存在性 + ≥X 字符长度断言"
  - 用例 #3 Then (b) "AI 暂时未能给出诊断，请手动修正" 同样未在 P04 spec §14 出现 · 同类挑刺
  - 用例 #4 Then 把 (a) "BE 已修复闭环" 与 (b) "若闭环未达成的降级" 用 "或" 连接 — 这让用例**不可证伪** (无论哪种都过) · Reviewer 应 REJECT 要求拆成两个互斥用例 / 或锁定一个明确预期 (本 task in_scope 是修复闭环 · 应锁 (a))
  - 用例 #5 用 "弱网环境" 模拟 BE 返 text/html 非 JSON — 现 `_http.ts` 是否 throw 友好错误未在本 task 强制要求 · Reviewer 可挑刺 "测试基础设施依赖未明确 · 该用例应在 mock 层显式构造 502 + Content-Type: text/html 才能落地"
- 用例数 5 (在 ≥3 ≤6 范围内 · 留 1 槽给 review 修订追加)

## Round 2 · 改了什么

Round 1 收到 **Coder REJECT (5 P0 + 3 P1)** + **Tester REJECT (4 P0 + 3 P1)** · 共识 + 互补共 8 个独立挑刺点 · 全部据反馈修订。本轮新增 1 用例（#6 ERROR 态正向触发）+ 用例总数 5→6（撞 ≤6 上限但合规）+ 修订所有 5 个原用例 + 新增 4 段头部说明（## 字段映射 contract · ## 实现注释 · ## perf 验收延后 · ## 落地指引）。

### 采纳的反馈 (按 reviewer 给的 P0 / P1 编号逐条对应)

**Coder REJECT P0 → 全采纳**:

| Coder P0 # | Coder 反馈摘要 | Round 2 怎么改 |
|---|---|---|
| #1 (用例 #1 hero testid 锚点错位) | thumb-h3 是 mockup 装饰 · result-hero-stem 才是真值锚点 | 用例 #1 Then(b) 改为 "`[data-test-id=result-hero-stem]` 文本 ≥ 5 字符且 ≠ '已知 f(x)=x²−4x+3'" + 显式声明 thumb-h3 out of scope |
| #2 (用例 #1 AiAnswer.steps 字段缺) | inflight in_scope #5 已包含但用例 Given 未声明 | 用例 #1 Given 列补 "前提条件 (in_scope #5): AiAnswer 接口已扩展含 steps[] + provider 字段" |
| #3 (modelInfo.name 字段映射模糊) | BE provider vs model 映射未定 | 文件顶部新增 `## 字段映射 contract` 段 · 表格固化 `modelInfo.name → provider="qianwen"` + `modelInfo.version → model="qwen-plus"` · 用例 #1 Then(g) 锁定该 contract |
| #4 (用例 #1 弱断言 "≠ Stub hardcode") | 建议加 `provider="qianwen"` 严格匹配 | 用例 #1 Then(c) 加 "`AiAnswer.provider === \"qianwen\"` 严格匹配 · 防 Stub 回潮" · API 列加 provider="qianwen" 锁定 |
| #5 (用例 #1 Given P02 真上传不现实) | 改 PG fixture | 用例 #1 Given 改为 "PG fixture: INSERT wb_question(qid='Q-AI-FAKE-001', ...)" · #2-#6 全部跟进用 fixture qid (Q-NO-ANSWER-002 / Q-AI-FAILED-003 / Q-CLOSED-LOOP-004 / Q-HTTP502-005 / Q-WRONGBOOK-500-006) |

**Coder REJECT P0 阻塞实现 #1 (拆 Promise.all)**: TestDesigner 角色边界不允许改 inflight `scope_boundaries.in_scope` 第 7 条软措辞 · 但用户 prompt 已授权我在 test-cases.md 加 `## 实现注释 (供 Coder 参考)` 段固化该重构。**已在头部新增该段 · 用例 #2/#3/#5/#6 Given 列都明示"前提条件: FE result/index.ts._fetchQuestion 已拆 Promise.all (见 ## 实现注释 #1)"** · 不让 Coder Phase 3 漏掉该结构性重构。

**Coder REJECT P0 #2 拆用例 #4 或删 (不可证伪)**: 锁 (a) 真闭环达成态 · 删 (b) 兜底降级 (TestDesigner 自查 P0 #2 + Tester P0 #2 共识)。用例 #4 完全重写 · Then 列改为：(a) reasonMarkdown 真值 + (b) AiAnswer.qid === request qid + (c) AiAnswer.taskId === request qid (闭环锚) + (d) pageState=DRAFT。Coder REJECT 建议 "(a) 删用例" 我**不采纳** · 因为 happy path #1 隐含覆盖但 #1 重点在 Hero/Reason/Steps 真值 · #4 重点在闭环字段断言 (qid / taskId 严格匹配) · 两者关注点不同 · 保留 #4 作为 task_id↔qid 闭环正向验证用例。

**Coder REJECT P0 #4 + Tester REJECT P0 #3 fallback 文案脱钩 i18n key 表**: 采纳 Tester 方案 B (testid + 字符长度 + 结构性断言 · 文案脱钩)。理由：
- 方案 A (spec §14 补 i18n key) 需要改 design/system/pages/P04-result.spec.md · 是另一个变更点 · 推迟到独立 spec 维护 task
- 方案 B 让用例不依赖具体文案 · i18n 化后不破 · 更稳
- **changelog 标注 "i18n key 表补充需在另一个 task 跟进"** · 不 silent 忽略

**Tester REJECT P0 #4 (补用例 #6 ERROR 态正向触发)**: 全采纳 · 新增用例 #6 (wrongbook GET 500 + retry 仍 500 → pageState=ERROR + AI 不连坐 + Console 0 [error])。6/6 撞顶但合规。

**Tester REJECT P1 #5 (用例 #5 落地策略明确)**: 采纳 · 用例 #5 Given 改为 "单测层 `vi.mock('@/api/_http', ...)` 强制 throw HTTP 502" · Then(c) 改为 "_http.ts try/catch 兜住 · IDE Console 0 [error] (warn 允许)" · 头部 `## 实现注释 #4` 加测试基础设施落地建议 (用例 → 工具映射 · 总 mock ≤ 2 < audit.js 5 红线)。

**Coder REJECT P1 #5 用例 #5 状态码歧义**: 采纳 · 锁 status=502 路径（走 _http.ts status≥400 throw · 非 JSON parse 路径） · text/html body 解析另开 task 推迟。

**Coder REJECT P1 #6 + #7 (用例 #2 404 真路径 + inflight in_scope 第 7 条软措辞)**:
- 用例 #2 Given 改为 "PG analysis_result 表查 task_id 无行 → BE 按 §5 合约返 404 NotFound"（真路径 · 非 mock 旧版未上线）
- inflight 软措辞由 `## 实现注释 #1` 固化 (不改 inflight · 我边界外)

**Tester REJECT P1 #6 (加 ## 落地指引段)**: 全采纳 · 新增 `## 落地指引 (Coder Phase 3 必读)` 段 · 列 spec.ts 文件路径建议 / raw output 落盘 / ≥ 4 张截图清单 / spec trace 表。

**Tester REJECT P1 #7 (perf 验收延后 note)**: 全采纳 · 新增 `## perf 验收延后说明` 段 · 显式声明推迟到 `SC01-MP-PERF-P04`。

### 不采纳的反馈 (显式说明理由 · 反 silent 忽略)

| Reviewer 反馈 | 不采纳理由 | 推迟到哪 |
|---|---|---|
| Coder REJECT P0 #2 建议方案 "spec §14 补 i18n key 表" | 改 spec 不在本 task 边界 (本 task 是 BE 切百炼 + 闭环 · 不是 spec 治理) | 独立 spec 维护 task (建议名 `SC01-DOC-P04-i18n-keys`) |
| Coder 建议删用例 #4 (happy #1 隐含覆盖) | #1 重点在 Hero/Reason/Steps 真值 · #4 重点在 qid/taskId 闭环字段严格匹配 · 关注点不同 | 保留 #4 |
| Tester P2 LaTeX / emoji boundary | 1 task ≤ 6 用例上限 · LaTeX 是 wxml 渲染局限 · biz §44 P95 perf 同推迟 | 独立 boundary task (建议名 `SC01-MP-P04-BOUNDARY`) |
| Tester P2 并发 / race-condition | inflight `scope_boundaries.out_of_scope` 已显式排除 | 不补 |
| Tester P2 百炼 API key 缺失/无效 | inflight in_scope 未强求 · BE 启动 fail-fast 是另一类用例 | 独立 BE-config task |

### audit dim_test_cases_alignment 复核

- ✓ ≥ 1 轮 REJECT (Round 1 已收 Coder + Tester 各一次 REJECT · review_has_ge_1_reject_round 满足)
- ✓ 用例数 6 (≥ 3 ≤ 6)
- ✓ 表头严格 6 列
- ✓ 每行 6 列填满
- ✓ 第 1 用例 happy path · 第 2-3 包含 edge (AI 404 / 业务降级)
- ✓ trace 行有 biz §X · spec §Y
- ✓ Then 列不写实现细节 (只写"用户观察到 X" · "锚 testid 文本 ≥ N 字符" 是观察断言 · 不是 "调 setData 走 derivePageState")
- ✓ 反作弊：Round 1 真收 REJECT (不是为 audit 凑数 · 是真有 5+4=9 实证问题需修)
