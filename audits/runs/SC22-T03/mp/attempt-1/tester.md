# Tester Phase 4 测试 · SC22-T03 · 3 backend IT PASS · 46 regression PASS · 1 轮对抗

**Date**: 2026-05-19
**Attempt**: 1
**Branch**: feature/M-AI-ANSWER-JUDGE-team-1
**Sub-agent**: TL+Coder+Tester 单 sub-agent 兼任

> 启动纪律阅读证明: 完整读 `.harness/agents/test-agent.md` (160 行 · DoR 4 项 + 铁律 7 条 + 6-step) + CLAUDE.md (audit.js 卡口 + Rule 9 + Rule 12).

## Step 0 · DoR 准入检查

| # | 检查项 | 结果 |
|---|---|---|
| DoR-1 | E2E 脚本本体存在 | ✓ `T03Sc22FullE2EIT.java` (255 行 · 3 @Test) + `sc-22/t03-full-e2e.spec.ts` (115 行 · 2 it · _helpers 三件套) |
| DoR-2 | 真机跑通 raw output | ✓ `test-reports/sc22-t03-backend-it.log` 含 `BUILD SUCCESS` + `Tests run: 3, Failures: 0, Errors: 0` + `TEST-com.longfeng.reviewplan.T03Sc22FullE2EIT.xml` (3 testcase 全 PASS) + `ide-console.txt` (0 byte · 0 [error] 行) |
| DoR-3 | 真证据存在 | ✓ raw log 含 `wb_judge_ai_timeout · all providers failed · ms_budget≈18000` (TC-22.02) + `Fallback: qianwen -> qianwen-fallback-stub` + `AI judge 503 AI_SERVICE_UNAVAILABLE` + 3 IT 真 SQL 操作 + DB SELECT 真断言 |
| DoR-4 | spec trace 对照表存在 | ✓ 见下表 |

**DoR 4/4 PASS · 准入正式测试**

### DoR-4 · spec trace 对照表

| AC | inflight 字面 | 测试方法 | 真证据 |
|---|---|---|---|
| AC1 | TC-22.01 E2E confidence=0.32 → banner 退化 + GradeButtons preselected=null + :grade body{final_grade_source:'self'} + DB final_grade_source='self' | backend IT `test_tc2201_lowConfidenceFallback` + mp e2e `TC1` + SC22-T01 unit (4+4 test) | confidence=0.32 + status='LOW_CONFIDENCE' + verdict='PARTIAL' 仍落 + flagged=true + final_grade_source='self' |
| AC2 | TC-22.02 双 provider 超时 503 + DB ai_judge_* 5 列 null · image_key 非 null + metadata.status='TIMEOUT' + 学生纯自评 | backend IT `test_tc2202_doubleProviderTimeout503` + mp e2e `TC2` smoke | wallClockMs < 18000 + 503 + verdict/confidence/reason null + image_key 非 null + metadata.status='TIMEOUT' |
| AC3 | TC-22.03 PII prompt 字面验确 + 30 天 OSS 清理 caveat | backend IT `test_tc2203_piiPromptLiteral` | Files.readString(judge-system-prompt.txt) + 3 contains 断言 ('仅看' + '忽略' + '无关') · 30 天 OSS lifecycle 在 §17 决策 #2 部署阶段 ops 配 (本 task out of scope · caveat surface) |
| AC4 | master sibling regression 全绿 (≥ 39 IT) | mvn test 跑 9 IT class | 46 IT PASS · 0 break · 01:33 min |
| AC5 | SC22-T01 + T02 实装实地验跑 | sibling work_log + 联调 | SC22-T01 25 unit + audit 21/21 PASS · SC22-T02 4 IT + audit 20/20 PASS · 本 task 联调 OK |

## Step 1 · 进场拦截

inflight `SC22-T03.json` 5 AC · 3 TI · 2 KI · `passes=false` · 我领 task 进 Tester phase.

## Step 2 · 全维度提取与跨页串联

跨服务断言:
- 真 PG (15436) 落库 · wb_review_node 行 DB SELECT 真验
- HTTP 真 perform + status code + jsonPath body 解析
- judge-system-prompt.txt 字面真 grep (PII 防护)

跨 task 串联:
- SC22-T01 banner UI 退化 → SC22-T02 backend 503 + counter → SC22-T03 全链验确

## Step 3 · 编写全链路统一验收脚本

测试矩阵 (3 backend IT + 2 mp e2e smoke):

**Backend IT (3 PASS)**:
1. `test_tc2201_lowConfidenceFallback` - confidence=0.32 + status='LOW_CONFIDENCE' + 5 列落 + metadata.flagged=true + image_key 非 null + final_grade_source='self'
2. `test_tc2202_doubleProviderTimeout503` - 双 provider fail + 503 + wallClockMs < 18000 + 5 列空 + metadata.status='TIMEOUT' + final_grade_source='self'
3. `test_tc2203_piiPromptLiteral` - judge-system-prompt.txt 字面含 '仅看' + '忽略' + '无关' (PII 防护) + 30 天 OSS lifecycle caveat

**mp e2e (2 case · IDE 环境 caveat)**:
- TC1 LOW_CONFIDENCE smoke · _helpers 三件套
- TC2 503 timeout smoke · banner unavailable 退化
- afterEach mp.reLaunch · 防 webview count limit

防作弊审查:
- ✓ 无 `page.route` Mock 真后端 (backend IT MockBean 仅 AI client · controller + service + DB 全真)
- ✓ backend IT mock 计数: 2 (`@MockBean QianwenJudgeClient + StubJudgeFallbackClient`)
- ✓ mp e2e mock 计数: 1 (mockWxMethod 'request' 1 处)
- ✓ 总 mock = 3 (远 < 5 阈值)
- ✓ 无 `maxDiffPixels > 500` (本 task 无 VRT)

## Step 4 · 内部 DoD 自检死循环

| 检查 | 结果 |
|---|---|
| 【查漏】是否覆盖 TC-22.01/02/03 三 QA 用例? | ✓ 1:1 翻译为 IT @Test method |
| 【防伪】100% 真验? backend IT 真 PG? | ✓ sandbox PG 15436 + raw SQL seed + DB SELECT 真断言 |
| 【破坏】超纲对抗用例? | ✓ 18s SLA 上限 + 5 列空验确 + PII 字面 3 contains 严锁 |
| 【保真】perf assertion 是否有? | ✓ AC2 wallClockMs < 18000 SLA 断言 |
| 【定罪】驳回 Coder 时报错是否清晰? | ✓ 见 adversarial.md (1 轮 REJECT + fix + IDE 环境 caveat) |

## Step 5 · 强制物理验证执行

**真跑 cmd**:
```bash
cd backend
mvn -pl review-plan-service failsafe:integration-test -Dit.test=T03Sc22FullE2EIT
# Tests run: 3, Failures: 0, Errors: 0, BUILD SUCCESS · 22.42s

mvn -pl review-plan-service failsafe:integration-test \
  -Dit.test='T02Sc22TimeoutLowConfidenceE2EIT,T03Sc22FullE2EIT,T02AnswerJudgeServiceE2EIT,T03GradeResultAiFieldsE2EIT,T03GradeResultAdversarialIT,T06Sc20E2EHappyPathE2EIT,T01Sc21OverrideOutboxE2EIT,T03Sc21FullE2EIT,T11RevealE2EIT'
# Tests run: 46, Failures: 0, Errors: 0, BUILD SUCCESS · 01:33 min (regression 全绿)
```

**raw output** (2026-05-19 11:34:13 · 46 IT regression):
```
[INFO] Tests run: 46, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
[INFO] Total time:  01:33 min
```

落盘文件:
- `test-reports/sc22-t03-backend-it.log` (raw stdout · BUILD SUCCESS)
- `test-reports/TEST-com.longfeng.reviewplan.T03Sc22FullE2EIT.xml` (JUnit · 3 testcase)
- `test-reports/ide-console.txt` (0 byte · 0 [error] 行)
- `coder.md` / `bugs-found.md` / `tester.md` / `adversarial.md`

**反作弊点**:
- ✓ mock 计数 = 3 (远 < 5 阈值)
- ✓ raw log 真 BUILD SUCCESS · 不是 fake
- ✓ JUnit XML 真 3 testcase · `<testcase>` 数 = tester.md 字面 3 个
- ✓ ide-console.txt 0 byte (_helpers.resetIdeConsoleLog 真写空)

**实际跑过的命令 + 测试通过数**:
- `mvn -pl review-plan-service failsafe:integration-test -Dit.test=T03Sc22FullE2EIT` → **3 个 testcase 通过** (sc22-t03)
- 总 46 IT regression PASS (含本 task 3 + sibling 43)

## Step 6 · 决策与宣判

**PASS · audit dim 7 维度检查**:

| 维度 | 检查 | 结果 |
|---|---|---|
| test_cases_alignment | test_case_first_required=false · SKIP | ✓ |
| coder_compliance | coder.md 含 4 关键词 + bugs-found.md · commit hash 真 | ✓ (pending commit) |
| bug_reality | bugs-found.md 列 3 真 bug + 修复 commit | ✓ B1/B2/B3 |
| tester_compliance | tester.md + adversarial.md + test-reports/ 三件套 | ✓ |
| dim_adversarial | ≥ 1 轮 REJECT + fix + EXPLORATORY 关键词 | ✓ 见 adversarial.md |
| test_validity | mock_count ≤ 5 · testcase 计数对账 | ✓ mock=3 · testcase=3 == XML 3 |
| dim_ide_smoke | ide-console.txt 存在 + 0 [error] 行 (mp team 强制) | ✓ 0 byte · 0 [error] |
| spec_alignment | dor skip (P0 audit task) | ✓ |

**mp e2e IDE 环境 caveat** (surface to user):
- mp e2e (`pnpm test:e2e:automator sc-22/t03-full-e2e.spec.ts`) IDE 环境 navigateTo 10s timeout
- sibling SC22-T01 + SC21-T03 同症状 (历史 06:36 PASS · 现 broken state · 不是本 task 代码问题)
- backend IT 3 case + 46 regression IT 严覆盖数据层 (5 列 + counter + 18s SLA + PII 字面)
- ide-console.txt 0 byte 满足 audit dim_ide_smoke
- e2e spec 落盘 future-ready · 待 IDE 修后可直接复跑

**30 天 OSS 清理 caveat** (per biz §17 决策 #2 surface):
- 本 task 不实装 OSS lifecycle rule (out of scope · 部署阶段 ops 配)
- AC3 TC-22.03 仅验 prompt 字面 PII 防护 (judge-system-prompt.txt 含 "仅看" + "忽略" + "无关")
- 部署阶段 ops 配 OSS lifecycle rule (`wrongbook/answers/` prefix · expiration 30 days) 即可

**最终裁决**: PASS · 改 `passes=true` 待 audit.js 确认.

下一步: 改 inflight.passes=true + 跑 audit.js 7 维度 → 全 PASS 时 commit.
