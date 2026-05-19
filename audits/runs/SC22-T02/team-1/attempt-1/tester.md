# Tester Phase 4 测试 · SC22-T02 · 4 IT PASS · SC20-T02 13 regression PASS · 1 轮对抗

**Date**: 2026-05-19
**Attempt**: 1
**Branch**: feature/M-AI-ANSWER-JUDGE-team-1
**Sub-agent**: TL+Coder+Tester 单 sub-agent 兼任

> 启动纪律阅读证明: 完整读 `.harness/agents/test-agent.md` (160 行 · DoR 4 项 + 铁律 7 条 + 6-step) + CLAUDE.md (audit.js 卡口 + Rule 12 Fail loud + Rule 9 Tests verify intent).

## Step 0 · DoR 准入检查

| # | 检查项 | 结果 |
|---|---|---|
| DoR-1 | E2E 脚本本体存在 | ✓ `T02Sc22TimeoutLowConfidenceE2EIT.java` 330 行 · 4 @Test method |
| DoR-2 | 真机跑通 raw output 存在 | ✓ `test-reports/sc22-t02-it.log` 含 `BUILD SUCCESS` + `Tests run: 4, Failures: 0, Errors: 0` + `test-reports/TEST-com.longfeng.reviewplan.T02Sc22TimeoutLowConfidenceE2EIT.xml` |
| DoR-3 | 真证据存在 | ✓ raw log 含 `wb_judge_ai_timeout` warn + `Judge provider qianwen failed: qianwen: timeout after 8000ms` + 4 IT 真 SQL 操作 + Counter 真增量 |
| DoR-4 | spec trace 对照表存在 | ✓ 见下表 |

**DoR 4/4 PASS · 准入正式测试**

### DoR-4 · spec trace 对照表

| AC | inflight 字面 | IT @Test 方法 | 真证据 |
|---|---|---|---|
| AC1 | 双 provider 双断 18s 上限 + ai_judge_metadata.status='TIMEOUT' + image_key 非 null + 5 列空 | `it_ac1_doubleProviderTimeout_returns503Within18s` | 503 + status='TIMEOUT' + image_key 非 null + verdict/confidence/reason null · wallClockMs < 18000 |
| AC2 | wb_judge_ai_timeout counter (tags nid + provider) 双断时 increment | `it_ac2_wbJudgeAiTimeoutCounter_increment` | counter delta = 1.0 · readTimeoutCounter(nid) 真验 |
| AC3 | LOW_CONFIDENCE flagged=true + verdict 仍落 + image_key 非 null | `it_ac3_lowConfidenceFlaggedTrue` | confidence=0.32 + metadata.status='LOW_CONFIDENCE' + flagged=true + verdict='PARTIAL' 仍落 |
| AC4 | 真 sleep 注入 · 18s 内必返 503 · 不挂死 | `it_ac4_perProviderHardTimeout_within18s` | sleep(9000) > 8000ms timeout · wallClockMs ∈ [7500, 18000] · CompletableFuture 截断验证 |
| AC5 | master sibling regression 全绿 | (跑 T02AnswerJudgeServiceE2EIT) | 13/13 PASS · 0 break |

## Step 1 · 进场拦截

inflight `SC22-T02.json` 5 AC · 4 TI · 2 KI · `passes=false` · 我领 task 进 Tester phase.

## Step 2 · 全维度提取与跨页串联 (Journey Check)

本 task 是 backend service 增强 · 无跨页 journey. 测试矩阵已在 DoR-4 对照表覆盖.

跨服务断言:
- 真 PG (15436) 落库 · wb_review_node 行 truly inserted · SELECT 验
- Micrometer registry counter delta · Counter.builder + Search.in pattern
- HTTP 真 perform + status code + jsonPath body 解析

## Step 3 · 编写全链路统一验收脚本

测试矩阵 (4 IT @Test · 见 `T02Sc22TimeoutLowConfidenceE2EIT.java`):

1. **it_ac1** · path-A (同步抛) · 验 503 18s SLA · DB 5 列 + metadata.status='TIMEOUT' + image_key 非 null
2. **it_ac2** · 双断时 wb_judge_ai_timeout counter += 1 · Search.in MeterRegistry 真读
3. **it_ac3** · confidence=0.32 · status='LOW_CONFIDENCE' + metadata.flagged=true + verdict 'PARTIAL' 仍落
4. **it_ac4** · path-B (真 Thread.sleep 9000ms) · 验 CompletableFuture timeout 截断 · 503 在 [7500, 18000] ms 内返

防作弊审查:
- ✓ 无 `page.route` Mock 真后端 (本 task 是后端 IT · MockBean 仅替换 AI client · 不替换 controller / service / DB)
- ✓ MockBean 计数: 2 处 (`@MockBean QianwenJudgeClient + StubJudgeFallbackClient`) · 远小于 5 阈值
- ✓ 无 `maxDiffPixels > 500` (本 task 无 VRT)
- ✓ E2E assertion 与生产代码一致 (`error_code` 字面与 controller JudgeErrorResp 字面对齐 + jsonPath 真解析 + DB 真 SELECT)

## Step 4 · 内部 DoD 自检死循环

| 检查 | 结果 |
|---|---|
| 【查漏】是否覆盖 503 + LOW_CONFIDENCE + 18s 上限 + counter 真验? | ✓ 4 IT 全覆盖 (3 状态机分支 + 1 上限验证) |
| 【防伪】是否 100% 真验? 无 mock 后端? | ✓ MockBean 仅 AI client (sealed SPI 边界) · controller + service + DB 全真 + Counter 真增量 |
| 【破坏】超纲对抗用例? | ✓ AC4 真 Thread.sleep(9000ms) 注入挂死 · 验上限保护 (探索性 boundary 测试) |
| 【保真】perf assertion 是否有? | ✓ AC1 < 18000 / AC4 [7500, 18000] 双向 SLA 断言 |
| 【定罪】驳回 Coder 时报错是否清晰? | ✓ 见 adversarial.md (1 轮 REJECT + fix) |

## Step 5 · 强制物理验证执行

**真跑 cmd** (本 task 是单 sub-agent · TL+Coder+Tester 兼任 · 不开 ops 工单):
```bash
cd /Users/allen/workspace/longfeng/.claude/worktrees/laughing-brown-e8ffb5/backend
mvn -pl review-plan-service failsafe:integration-test -Dit.test=T02Sc22TimeoutLowConfidenceE2EIT
```

**raw output** (2026-05-19 10:55:22):
```
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 30.57 s -- in com.longfeng.reviewplan.T02Sc22TimeoutLowConfidenceE2EIT
[INFO] Results:
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

**regression 验确**:
```
[INFO] Tests run: 13, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 22.67 s -- in com.longfeng.reviewplan.T02AnswerJudgeServiceE2EIT
[INFO] BUILD SUCCESS
```

落盘文件:
- `test-reports/sc22-t02-it.log` (raw stdout)
- `test-reports/TEST-com.longfeng.reviewplan.T02Sc22TimeoutLowConfidenceE2EIT.xml` (JUnit XML)
- `coder.md` / `bugs-found.md` / `tester.md` / `adversarial.md`

**反作弊点**:
- ✓ mock 计数 = 2 (远 < 5 阈值)
- ✓ raw log 真 BUILD SUCCESS · 不是 fake
- ✓ JUnit XML 真 4 testcase · `<testcase>` 数 = tester.md 字面 4

**实际跑过的命令 + 测试通过数**:
- `mvn -pl review-plan-service failsafe:integration-test -Dit.test=T02Sc22TimeoutLowConfidenceE2EIT` → **4 testcase passed** · 等于 XML `<testcase>` 4 个

## Step 6 · 决策与宣判

**PASS · audit dim 5 + 6 + 7 检查**:

| 维度 | 检查 | 结果 |
|---|---|---|
| dim_coder_compliance | coder.md 含 4 关键词 + bugs-found.md · commit hash 真 | ✓ (pending commit) |
| dim_bug_reality | bugs-found.md 列 3 真 bug + 修复 commit · 0 bug 也明示 | ✓ B1/B2/B3 |
| dim_tester_compliance | tester.md + adversarial.md + test-reports/ 三件套落盘 | ✓ |
| dim_adversarial | ≥ 1 轮 REJECT + fix · 1 轮 EXPLORATORY 边界 | ✓ adversarial.md (1 REJECT + 1 EXPLORATORY) |
| dim_test_validity | mock_count ≤ 5 · maxDiffPixels 不超 · IDE Console 0 [error] | ✓ mock=2 · 无 VRT · 无 mp IDE |
| dim_ide_smoke | (mp task 才检查 · 本 task 是 backend · 跳) | N/A |
| dim_test_cases_alignment | (test_case_first_required=false · 跳) | SKIP |

**最终裁决**: PASS · 改 `passes=true` 待 audit.js 确认.

下一步: 改 inflight.passes=true + 跑 audit.js 7 维度 → 全 PASS 时 commit.
