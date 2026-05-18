# Coder Review · TestDesigner 提交的用例

reviewer: Coder agent (claude opus 4.7 · top-level spawn · 2026-05-18)
date: 2026-05-18
test_cases.md ref: audits/runs/SC20-T03/team-1/attempt-1/test-cases.md (Round 1 · 6 用例 · 1ee60ee)

## Round 1

### 视角
可实现性 / GradeReq record 加字段 兼容性 / 应用层 CHECK 实现位置 / Jackson @JsonInclude / 跨模块 IT 路径 / JSONB 提取 SQL

### 逐用例 review

- **用例 #1 (happy ai_accepted PARTIAL 路径 POST + GET 串联)**: 需调整 ⚠ — 可实现但 `easeAfter=2.50` 字面与 §2B.20 步 6 字面 "ease -0.2" 矛盾 · Then 列写 "PARTIAL 路径 ease 微调按 master §7 字面 -0.2 或保持 · 字面以 master §10.5 现役实现为准" 给 Coder 两态 escape hatch · 但 ApiResult 信封字面 `easeAfter=2.50` 已锁字面 · 同行内自相矛盾。
  - 二次问题: `ai_judge_metadata='{"model_used":"sonnet","status":"DONE","latency_ms":5400}'::jsonb` 在 fixture INSERT 时是 raw JSONB · 但 entity 字段 `aiJudgeMetadata` 是 `String` (raw JSON 字符串 · 见 `WbReviewNode.java:53`) · 取 `status` 子字段需要应用层 ObjectMapper.readTree 或 DB jsonb_extract_path_text SQL · TestDesigner 没标这个映射规则的实现细节归属 (是 Service 层用 ObjectMapper 拼装 · 还是 SQL 直接提取)

- **用例 #2 (向后兼容 · 不传 final_grade_source + 跨模块 IT 套件验证)**: 需调整 ⚠ — `mvn -pl backend/review-plan-service verify -Dtest='T06QuestionCreatedE2EIT,T11RevealE2EIT,HomeTodayIT'` 命令字面**类名缺包名前缀** · Surefire `<test>` 参数必须含完整 FQCN (e.g. `com.longfeng.reviewplan.T06QuestionCreatedE2EIT`) 或用通配 (`*T06QuestionCreatedE2EIT`) · 否则 Surefire 找不到类报 "No tests matching pattern" exit 0 但 0 tests run · 是经典 silent skip 反作弊点 (Fail loud Rule 12)。
  - 二次问题: Then 列 "wb_review_node 行根本不存在亦满足" 二选一字面是允许的 · 但 §10.18 字面是 ":grade 多落 final_grade_source 列到 wb_review_node" · 若 :grade endpoint 在无 wb_review_node 行时不创建行 · 则 final_grade_source 列无处可落 · TI1 向后兼容硬性是否要 Coder UPSERT vs 不落 留 Coder 二选一 · 但 §4.16 "NOT NULL DEFAULT 'self'" 暗示行存在时必有此列 · 行不存在时不写也合理 · 用例 #2 给的二选一是符合 spec 的 · 但需要在 coder.md 字面声明选哪态

- **用例 #3 (CHECK 违反返 422 不 500)**: 可实现 ✓ — 但应用层 CHECK 的**实现位置**未约束 · 是 Controller 用 @Valid + custom @Constraint · 还是 Service 层 throw + @ExceptionHandler 拦截 · 还是 GradeReq record compact constructor。`ReviewPlanController.java:447-454` 已有 `@ExceptionHandler(PlanNotFoundException.class)` 返 ResponseEntity 信封 (40401) · 但本 task 需要的 22XXX 类错误码 (`42201` 或 `4xxxx GRADE_SOURCE_MISMATCH`) 项目错误码字典里可能没有 · TestDesigner 自己说 "本 task 不应擅自定义新 code" 但 422 status + 自定义 code 的关系没说清。
  - 二次问题: Then 列 "transaction rollback 验证 review_outcome 0 行 / outbox 0 行" 是关键 · 但用例 Given 列没明示 "CHECK 必须在 planService.complete() 调用前置(pre-condition)" · 若 CHECK 在 complete() 内部一半 (e.g. 落 outcome 后才校验) · review_outcome 已写 1 行 + transaction rollback 才能保 0 行 · Coder 必须用 `@Transactional` 保边界 · 这点没在 Then 列字面强约束

- **用例 #4 (override ai_overridden 路径)**: 可实现 ✓ — `final_grade_source` 列从 default 'self' 被 :grade 覆盖到 'ai_overridden' · 实现是 Coder Step 4 直接 setFinalGradeSource(req.finalGradeSource()) + Repository.save() · 路径清晰。
  - 但 "review_outcome 表新增 1 行 quality=0" 字面有 master §10.5 现役 SM-2 FORGOT 路径反例 · master 现役 `gradeNode` quality=0 走 `rescheduleDownstreamForForgot` 级联重排 · 不只是 outcome+1 · 用例 Then 列没提级联重排的 wb_review_node 后效 (T1-T6 是否 CANCELLED) · 但 SC-21 master §2B.21 字面要求 "T1-T6 全 CANCELLED + 重排 7 new node"。**漏覆盖**: 用例 #4 仅验单节点 final_grade_source 落库 · 没验级联重排是 KI1 "master §7 FORGOT 路径不破坏" 的硬证据。

- **用例 #5 (GET happy aiJudge 完整 object)**: 需调整 ⚠ — `aiJudge.status` ← `ai_judge_metadata.status` JSONB 提取**实现路径**有歧义。两选项: (a) Service 层 ObjectMapper.readTree(metadata).path("status").asText() · Java 代码侧拼 (b) Repository custom @Query 用 PostgreSQL `metadata->>'status'` SQL 提取。TestDesigner 字面 "推论可接受 · 不擅自补 spec" 是态度 · 但 Coder 实现时若选 (a) 需要 ObjectMapper bean 注入 + null 兜底 (metadata 整体 null / status key 缺失 / JSON parse 失败三态) · 用例 #5 fixture 给的是有效 JSON 但**缺失 status key 的降级行为**没用例覆盖 (e.g. metadata='{"model_used":"sonnet"}' 没 status key · 应返 aiJudge.status=null 还是整个 aiJudge=null · 还是返字面字符串 "DONE" 兜底)。
  - 二次问题: "matched_steps + missed_steps 可选字段缺省 (空数组或不返均符)" · Coder 二选一 · 但若 `@JsonInclude(JsonInclude.Include.ALWAYS)` (项目 JudgeResp.java 已用 pattern) · null 字段必输出 · 那 matched_steps=null 与 [] 是两种输出 · 影响 JSON 字面 grep 结果 · TestDesigner 没锁字面是有道理 (二选一是 Coder 设计自由) · 但 audit grep test 时要注意不卡死字面

- **用例 #6 (GET aiJudge=null 降级)**: 可实现 ✓ — Jackson `@JsonInclude(JsonInclude.Include.ALWAYS)` 已是项目先例 (`JudgeResp.java:25` 字面 "让 null 字段也输出 verdict=null · 用例 #6 字面要求") · NodeResultResp 加同样注解可保 `"aiJudge":null` 字面输出。fixture 3 选 1 路径 (AI 超时 / 异步未完成 / 无 AI 判) 都触发 ai_judge_verdict=NULL 是合理设计。
  - 但 "fixture C: 学生纯自评从未走 AI 判路径 (但仍有 wb_review_node 行 e.g. SC20-T04 拍照上传未触发 judge)" 字面有现实存在性问题 · 在本 task (SC20-T03) 完成时 SC20-T04 尚未实装 · wb_review_node 行的创建路径目前只有 SC20-T02 entity 落地 + AnswerJudgeService.executeOrReplay (`AnswerJudgeService.java:131-141` 字面 "wb_review_node 尚未存在 → 404") · 即现役无 :grade 创建 wb_review_node 行的路径 · fixture C 的"行存在但 verdict=NULL"是测试 fixture 手工 INSERT · 不是生产代码路径 · 用例字面应说清"测试 fixture 模拟" 而非"业务路径"。

### 反馈给 TestDesigner

- 修复建议 1: **用例 #1 Then 列 easeAfter 字面冲突修复** · 把 "easeAfter=2.50" 字面去掉 · 改成 "easeAfter 字面以 master §7 SM-2 PARTIAL 路径计算 (-0.2 或保持 · 由 GradeReq.toQuality()=3 + master §10.5 SM-2 step 决定) · TestDesigner 不锁数值字面 · 保留 KI1 master §7 不破坏的弱断言"。统一 SC-08/SC-09 standalone task 才锁 ease 数值的边界。

- 修复建议 2: **用例 #2 mvn 命令字面补 FQCN** · 把 `-Dtest='T06QuestionCreatedE2EIT,T11RevealE2EIT,HomeTodayIT'` 改成 `-Dtest='com.longfeng.reviewplan.T06QuestionCreatedE2EIT,com.longfeng.reviewplan.T11RevealE2EIT,com.longfeng.reviewplan.HomeTodayIT'` · 防 Surefire silent skip 0 tests run (Rule 12 Fail loud)。

- 修复建议 3: **用例 #3 CHECK 实现位置 + transaction 边界字面化** · 在 Given 列补 "应用层 CHECK 必须在 planService.complete() 调用前置(pre-condition) · 或用 @Transactional 保边界 · 不允许 partial write (review_outcome 已写 1 行才回滚 = 浪费 transaction)" · 防 Coder 选 "complete() 后才 CHECK + rollback" 的低质实现路径。

- 修复建议 4: **用例 #5 ai_judge_metadata JSONB 提取实现路径锁定 + 缺 status key 降级用例补**: 在 Then 列加 "aiJudge.status 拼装规则: 当 ai_judge_metadata 整体 null 或 JSON 解析失败 或缺 status key 三种情况下 · aiJudge.status 返 null · 不抛 5xx · 不影响 aiJudge 其他 4 字段返回"。明示降级语义防 Coder 选 throw 路径。

- 漏覆盖 1: **用例 #4 缺级联重排后效断言** · FORGOT 路径 master §7 + master §10.5 现役 `rescheduleDownstreamForForgot` 行为是 KI1 "master §7 不破坏" 的硬证据。建议补一行用例 #4 Then 列 "review_plan T1-T6 节点(node_index=3..7)状态 SELECT 后效: master §10.5 现役级联重排路径执行 · 不破坏即可 · 不锁具体重排字面数值" OR 把"级联重排"显式列入用例 #2 跨模块 IT 套件 mvn 命令的覆盖范围。

- 漏覆盖 2 (可选): **缺 final_grade_source 应用层枚举校验用例** · TestDesigner 字面 "Coder Step 4 默认会做 enum check (DTO 用 record + @JsonValue + enum class 或 String + 枚举字面校验) · 不在用例字面强约束"。但若 Coder 选 String + 不校验路径 · 客户端传 `"final_grade_source":"invalid_source"` 字面 · 应用层 CHECK 会因 ai_judge_verdict 比对失败(任何 verdict 都 !== "invalid_source") 触发 422 · 但错误信息会是 "GRADE_SOURCE_MISMATCH" 而非 "INVALID_SOURCE" · 用户体验差。建议补 1 个用例: POST body 含 `final_grade_source: "garbage"` 字面 → 422 + 错误信息含 "INVALID_FINAL_GRADE_SOURCE" 或类似关键字 · 而非 fallthrough 到 GRADE_SOURCE_MISMATCH。

- 其他: TestDesigner Round 1 自标 6 故意可挑刺点中 · 我独立检视后真挑刺到的: (a) 用例 #1 ease 字面 (修建议 1 · TestDesigner 自标已覆盖) (b) 用例 #5 JSONB 提取规则 (修建议 4) (c) fixture C 现实存在性 (TestDesigner 自标已覆盖 · 我不重复挑)。剩余 TestDesigner 自标 (#2 UPSERT 二选一 / #3 ApiResult code 数字 / #6 matched_steps 字面) 我认为符合 spec 留 Coder 选择面合理 · 不强约束 · 不挑刺。我额外挑刺到的: mvn FQCN 命令(修建议 2) + CHECK transaction 边界(修建议 3) + 级联重排漏覆盖(漏覆盖 1) + 枚举校验漏覆盖(漏覆盖 2) · 这 4 点 TestDesigner Round 1 没标 · 是我作为 Coder 视角独立发现。

## verdict

verdict: REJECT
reason: Round 1 强制 REJECT (audit dim_test_cases_alignment.review_has_ge_1_reject_round 卡口) · 上述 4 修复建议 + 2 漏覆盖均为可实现性硬约束 (mvn FQCN / CHECK transaction 边界 / JSONB 提取降级 / 级联重排 KI1 硬证据) · TestDesigner 改完 Round 2 我再 review。
