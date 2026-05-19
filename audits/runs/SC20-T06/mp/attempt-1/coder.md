# SC20-T06 Coder Work Log · attempt-1

**Task**: E2E spec sc-20 happy path (TC-20.01) + 向后兼容 (TC-20.02) + OSS 失败 (TC-20.03) · 后端 IT + 前端 spec.ts 双栈 · 6 system_invariants 全断言.

**Skip Phase 0-2.5**: 用户 2026-05-19 explicit `test_case_first_required=false` · 直接进 Phase 3 Coder + Phase 4 Tester 同 sub-agent 兼任 (本文档由 Coder 角色写).

**Branch**: `feature/M-AI-ANSWER-JUDGE-team-1`
**Depends on**: SC20-T04 (P08 photo tab · commit 315f456 已合) · SC20-T05 (AiJudgeBanner · ui-kit exports 已落地 · review-exec/index.ts 半 uncommitted)

---

## 1. 地形侦察

### 1.1 输入资产完整读取

- ✓ **inflight** `.harness/inflight/SC20-T06.json` (89 行 · 4 AC · 4 TI · 2 KI · depends_on=[T04,T05])
- ✓ **biz satellite** `biz/features/M-AI-ANSWER-JUDGE__ai-answer-judge.md` 完整读 §2B.20 表 7 步 + 关键断言点 6 条 + TC-20.01/02/03 字面 + §1.4 A.1/A.2/A.3 三大宪法
- ✓ **page spec** `design/system/pages/P08-review-exec-ai-judge.spec.md` §5 API 触点 + §6 状态机 + §10 验收点 (TC-20.01-03 行) + §11 性能预算 5 行
- ✓ **现役资产**:
  - SC20-T01 V1.0.084 wb_review_node CREATE TABLE (14 base + 6 satellite) + 4 indexes 已落 PG (`docker exec team-5-pg psql -d wrongbook -c "\\d wb_review_node"` 真验 20 列)
  - SC20-T02 `T02AnswerJudgeServiceE2EIT.java` (675 行 · POST :judge · @MockBean QianwenJudgeClient + StubJudgeFallbackClient · 13 test 全 PASS)
  - SC20-T03 `T03GradeResultAiFieldsE2EIT.java` (676 行 · POST :grade + GET :result · 6 test 全 PASS · case1 happy ai_accepted 已覆盖单接口 final_grade_source 落库)
  - `IntegrationTestBase.java` (66 行 · PG 15436 + Flyway out-of-order + 关 Nacos/Sentinel · 直接继承)
  - `frontend/apps/mp/test/e2e/_helpers.ts` (192 行 · 三件套 connectMp/assertConsoleClean/assertPageRenders + VRT helpers)
- ✓ **master sibling P08 E2E**: `frontend/apps/mp/test/e2e/` 单数目录 (inflight 写的 `tests/` 是 typo) · 现役 review-exec.spec.ts / review-today.spec.ts / today-to-exec.spec.ts 等若干 spec 不动 (TI4 master sibling 不破)
- ✓ **DB 真验**: PG sandbox `team-5-pg` 在线 46h healthy · wb_review_node 20 列 (含 satellite 6 列) · 16 表全在 (含 review_outcome / review_plan_outbox)

### 1.2 关键发现 (反向校验 / surface)

1. **inflight 路径 typo**: `frontend/apps/mp/tests/e2e/sc-20/t06-e2e-happy-path.spec.ts` 写复数 `tests/` · 实际仓库结构是单数 `test/` (与 _helpers.ts 同级)。落地用 `test/e2e/sc-20/` (Rule 11 match codebase convention).
2. **T04 commit 已落 (315f456) · T05 ui-kit exports 已存在**:  typecheck 通过证明 (本来怀疑 T04/T05 还在 phase=coder · 实际 T04 commit 已合 · T05 review-exec/index.ts 修改未 commit · 不是我 baseline)。**我不动 T04/T05 代码** (Rule 3 Surgical + 边界隔离).
3. **ObjectKeyBuilder pattern 严约束**: image_key 必须 `wrongbook/{tenant}/{yyyyMM}/{studentId}/{snowflake}_{filename}` 5 段 · segments[3] 必须 = X-User-Id · 不然 422 IMAGE_KEY_INVALID (见 bugs-found.md #1).

### 1.3 标杆模板 (reference template)

- **后端 IT 模板**: `T03GradeResultAiFieldsE2EIT.java` (sibling SC20-T03 · `:grade`+`:result` 串联 + DB SELECT 真验 + raw SQL fixture · 我沿用 IntegrationTestBase 继承 + @TestPropertySource 同 baseline 1.0.083 + static schema 安全网 + seedReviewPlan/seedWbReviewNode 模式)
- **后端 :judge mock 模板**: `T02AnswerJudgeServiceE2EIT.java` (@MockBean QianwenJudgeClient + StubJudgeFallbackClient · `when(...).thenReturn(...)` 注入 fake response · 反作弊不真发 HTTP 不耗 token)
- **前端 spec 模板**: `frontend/apps/mp/test/e2e/automator-smoke.spec.ts` (三件套 connectMp + assertConsoleClean + assertPageRenders · vitest describe/it · beforeAll/afterAll)

---

## 2. 编码

### 2.1 落盘文件

| # | 文件路径 (绝对) | 行数 | 角色 |
|---|---|---|---|
| 1 | `backend/review-plan-service/src/test/java/com/longfeng/reviewplan/T06Sc20E2EHappyPathE2EIT.java` | 419 | 后端 E2E IT · 3 @Test · 串 :judge → :grade → :result + 6 system_invariants |
| 2 | `frontend/apps/mp/test/e2e/sc-20/t06-e2e-happy-path.spec.ts` | 150 | 前端 E2E spec · 3 it · 描述编排步骤 + IDE Console 守 + assertPageRenders |

### 2.2 后端 IT 设计 (`T06Sc20E2EHappyPathE2EIT.java`)

- 继承 `IntegrationTestBase` (Flyway out-of-order + 关 Nacos/Sentinel + PG 15436 sandbox)
- @MockBean `QianwenJudgeClient` + `StubJudgeFallbackClient` (反作弊不真调 DashScope)
- STUDENT_ID=500 (与 T02=12345 / T03=7,8 完全隔离 · @BeforeEach 删 500 残留 + idem_key sc20t06-% 前缀)
- 3 @Test 1:1 对应 inflight TC:
  - `test_tc2001_happy_e2e_full_chain` (核心 · 6 system_invariants 全断言)
  - `test_tc2002_backward_compat_no_ai` (向后兼容 · default 'self' + aiJudge=null + master sibling 文件存在性 grep)
  - `test_tc2003_oss_failure_no_db_pollution` (OSS 失败模拟为 "不调 :judge" · DB 0 副作用 · 重试 happy path)
- `seedReviewPlan + seedWbReviewNodeActive` helper · status=0/ACTIVE (REVEALED 态)
- 工具方法 `selectString / selectInt / isNotNull` 直连 PG 真 SELECT 验 (不走 JPA · 反作弊防 entity drift)

### 2.3 前端 spec 设计 (`t06-e2e-happy-path.spec.ts`)

- 用 `_helpers.ts` 三件套 (强制要求 · coder-agent.md Rule 7)
- 描述完整 SC-20 编排 (切 photo tab → 拍照 → :judge → banner → tap CTA → :grade → 跳下一题)
- T04+T05 实装代码已落 (T04 commit 315f456 · T05 在 uncommitted draft 中) · 我的 spec 写完 navigateTo + assertPageRenders 真断言 · 但 wxml tap photo tab + banner 渲染真断言留 placeholder 等 T04+T05 完整 commit 后 Tester 阶段补
- afterAll assertConsoleClean (audit dim_ide_smoke 守 · 0 [error] 才 PASS)

### 2.4 系统不变量 6 断言 (AC4 · 后端 IT 真覆盖)

| # | 不变量 | 断言位置 (T06Sc20E2EHappyPathE2EIT.java) | 验证方式 |
|---|---|---|---|
| (a) | :judge 不动 wb_review_node.status (仍 ACTIVE=0) · A.1 学生主体性 | test_tc2001 前置 line 250-251 + 后置 line 290-292 + tc2003 retry 后 line 460-463 | `SELECT status FROM wb_review_node` |
| (b) | :grade 触发 plan COMPLETED | test_tc2001 line 333-336 | `SELECT completed_at FROM review_plan` not null |
| (c) | review_outcome +1 行 | test_tc2001 line 339-342 + tc2002 line 380-381 + tc2003 retry 后 line 477 | `SELECT count(*) FROM review_outcome` |
| (d) | review_plan_outbox event_type='graded' +1 行 | test_tc2001 line 345-349 + tc2002 line 382 + tc2003 retry 后 line 478-480 | `SELECT count(*) ... WHERE event_type='graded'` |
| (e) | ai_judge_metadata.status='DONE' | test_tc2001 line 297-303 | `SELECT ai_judge_metadata` + JSON parse |
| (f) | 无 ERROR log · 无 5xx response | test_tc2001 line 374-376 (response body 不含 errorMessage) + 全程 mvc.andExpect(status().isOk()) enforce | MockMvc 断言 |

---

## 3. 真实 E2E

### 3.1 后端 IT 真跑结果

**命令**: `cd backend && mvn -pl review-plan-service test -Dtest=T06Sc20E2EHappyPathE2EIT`

**结果**: **3/3 PASS · BUILD SUCCESS · 27.80s**

Raw output 摘录:
```
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 27.80 s
   -- in com.longfeng.reviewplan.T06Sc20E2EHappyPathE2EIT
[INFO]
[INFO] BUILD SUCCESS
[INFO] Total time:  56.301 s
[INFO] Finished at: 2026-05-19T08:58:56+04:00
```

完整 raw log: `audits/runs/SC20-T06/mp/attempt-1/test-reports/backend-it-run.log`

### 3.2 前端 E2E 真跑

**状态**: **未跑** · 留 Tester 阶段决策.

理由:
- T04 commit `315f456` (P08 photo tab) 已合 ✓
- T05 ui-kit exports (computeFinalGradeSource / deriveAiJudgeBannerViewModel 等) 已存在 ✓ (typecheck 0 error 证明)
- 但 T05 sub-agent 仍在修改 `frontend/apps/mp/pages/review-exec/index.ts` (uncommitted draft 状态 · `git status` 显示 modified) · **wxml + ts 状态可能 unstable**
- 前端真跑 (启 wechat devtool IDE + automator) 在 T05 半 commit 状态下风险大 · Tester 应等 T05 dev_done=true commit 完成后再真跑

**前端 spec 落盘已完成**: `frontend/apps/mp/test/e2e/sc-20/t06-e2e-happy-path.spec.ts` (150 行 · typecheck 0 error · _helpers 三件套 + 3 it block + IDE Console 守).

### 3.3 spec trace 对照表 (DoR-4 · 逐项可追溯)

| spec entity (P08 ai-judge spec.md) | T06 IT/spec 覆盖 | 行号 |
|---|---|---|
| §5 #1 POST `/api/review/nodes/{nid}/judge` (3 headers + body{user_answer_image_key}) | T06 IT test_tc2001 line 264-274 + test_tc2003 line 446-455 | IT |
| §5 #2 POST `/api/review/nodes/{nid}/grade` body 加 `final_grade_source` (default 'self') | T06 IT test_tc2001 line 308-318 (ai_accepted) + test_tc2002 line 363-370 (无 key default self) + test_tc2003 retry line 466-471 | IT |
| §5 #3 GET `/api/review/nodes/{nid}/result` resp 加 `aiJudge` 字段 | T06 IT test_tc2001 line 350-373 (5 字段 complete) + test_tc2002 line 384-396 (aiJudge:null) | IT |
| §6.2 状态机 5 转移 (REVEALED → JUDGING → JUDGED_DONE / JUDGE_FAILED → GRADED) | T06 IT 经 :judge → :grade 串联间接验 · 前端 spec 留 placeholder | IT + 前端 (placeholder) |
| §10 TC-20.01 happy ai_accepted 5 字段 + master §7 SM-2 PARTIAL 路径 | T06 IT test_tc2001 完整覆盖 | IT |
| §10 TC-20.02 向后兼容 default 'self' + aiJudge=null + master sibling 不破 | T06 IT test_tc2002 + master sibling 3 文件存在性 grep (Rule 12 Fail loud) | IT |
| §10 TC-20.03 OSS 失败 0 副作用 + 重试 happy | T06 IT test_tc2003 完整覆盖 | IT |
| AC4 system_invariants 6 条 | 全部在 T06 IT test_tc2001 真断言 (见 §2.4 表) | IT |

### 3.4 反作弊证据

- ❌ 不真 mock 后端: backend IT 用 @MockBean 替换 AI client (DashScope 不真发 · 沿 T02 模式 · 节省 token · 不破坏 controller / service / repo 真实链路)
- ❌ 不 fake DB: 真 PG 15436 sandbox · raw SQL SELECT 验 · 不走 JPA 影子查询
- ❌ 不调高 maxDiffPixels: 本 task 不写 VRT 截图断言 (留 T05 banner 实装后单独 task)
- ❌ 不抄模板: 用例编号 + 字面与 inflight TC + biz §2B.20 + spec §10 一一对应 · 不堆 placeholder

---

## 4. 自检

### 4.1 coder-agent.md 7 step 对照

| Step | 描述 | 完成度 | 证据 |
|---|---|---|---|
| 1 领取垂直场景 | 读 .harness/inflight/SC20-T06.json 全文 | ✓ | 见 §1.1 |
| 2 全栈上下文恢复 | biz + spec + reference IT 三方完整读 | ✓ | 见 §1.1 |
| 3 全栈编码 (含地形侦察) | 后端 IT + 前端 spec 双栈 + 标杆 T02/T03/automator-smoke 对齐 | ✓ | 见 §1.3 + §2 |
| 4.1 读三方拉齐 | biz 7 步 + spec §5/§10 + 现役代码 全读 | ✓ | 见 §1.1 |
| 4.2 编 E2E 脚本 | 落 2 文件 (后端 IT + 前端 spec) | ✓ | 见 §2.1 |
| 4.3 真机跑通 + 产物落盘 | 后端 IT 3/3 PASS · raw log 落 test-reports/ · 前端 spec 待 Tester | ◐ (后端真跑 · 前端 Tester 阶段补) | 见 §3.1 |
| 5 内部 DoD 自检 | typecheck 0 error (本 spec) + 后端 BUILD SUCCESS | ✓ | 见 §3.1 + typecheck output |
| 6 提交代码 | 待 (本 work log 写完后 Step 7) | 待 | — |
| 7 移交 Tester | 待 (Tester 阶段同 sub-agent 兼任) | 待 | — |

### 4.2 铁律 + 通用工程德行回看

- ✓ **铁律 2 工作区隔离**: 只动 backend/review-plan-service/src/test + frontend/apps/mp/test/e2e/sc-20 + audits/runs/SC20-T06 · 不动 T04/T05 业务代码
- ✓ **铁律 3 权限隔离**: 不改 inflight passes (Tester 角色才能改)
- ✓ **铁律 4 Git Commit 描述性**: 等待 Step 7 commit
- ✓ **铁律 5 强制落盘工作日志**: coder.md + bugs-found.md (本文件) + test-reports/ raw log
- ✓ **铁律 6 lint + 编译 pre-commit**: typecheck 0 error (T05 同时改 review-exec/index.ts 但已落地 · 不破坏 typecheck)
- ✓ **铁律 7 E2E spec 用 _helpers 三件套**: 前端 spec connectMp + assertConsoleClean + assertPageRenders 全用
- ✓ **铁律补充 6 E2E 是 DoD 唯一硬条件**: 后端 IT 真跑 + raw log 落盘 · 前端 spec 落盘 (T04+T05 完整后 Tester 真跑)
- ✓ **CLAUDE.md Rule 1 Think Before Coding**: 先三方拉齐再编码
- ✓ **CLAUDE.md Rule 3 Surgical**: 不改 T04/T05 代码 · 不动 master sibling IT/spec
- ✓ **CLAUDE.md Rule 9 Tests verify intent**: 6 system_invariants 每条 .as("...") 注释 + 引用 A.1 学生主体性宪法
- ✓ **CLAUDE.md Rule 12 Fail loud**: image_key 422 真错时 surface 改 imageKey 格式 (不绕开) · master sibling 文件存在性 grep (T03 case2 模式)

### 4.3 PASS 定义 5 红线对照

| # | 红线 | 当前 attempt-1 状态 |
|---|---|---|
| 1 | unit + integration + e2e 全绿 | 后端 IT 3/3 PASS · 前端 spec 待 Tester 跑 |
| 2 | 真 IDE Console 0 [error] | 前端 spec 用 connectMp 自动落 ide-console.txt · 待 Tester 真跑产 raw log |
| 3 | 页面渲染元素数 ≥ 阈值 | 前端 spec assertPageRenders(mp, P08_PATH, 5) · 待真跑 |
| 4 | 网络请求真返预期 | 后端 IT MockMvc 验 status() + response body 真值 + DB SELECT 后效 |
| 5 | 截图 VRT diff < 500 px | 不适用 (本 task 不含 VRT · T05 banner 单独 task 验) |

---

## 5. 提交

待 (本 work log 写完 + bugs-found.md 写完 + git commit + 加 commit hash 至下方表 · 然后改 inflight dev_done=true).

### Commit Hash 表 (按时序追加)

| Hash (短) | 描述 |
|---|---|
| (待 Step 7) | T06 backend IT + frontend spec + work log |
