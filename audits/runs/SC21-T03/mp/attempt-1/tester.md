# Tester Phase 4 验收 · SC21-T03 · 3 backend IT + 3 mp e2e PASS · 1 轮 REJECT-fix

**Date**: 2026-05-19 · Attempt: 1
**Branch**: feature/M-AI-ANSWER-JUDGE-team-1

> **启动纪律阅读证明**: 完整读 test-agent.md (160 行 · DoR + 铁律 7 + 6-step) + CLAUDE.md (Rule 12 + audit.js 卡口) + Coder 阶段 coder.md + bugs-found.md.

## Step 0 · DoR

| # | 检查项 | 结果 | 证据 |
|---|--------|------|------|
| DoR-1 | E2E 脚本本体 | ✓ | `backend/.../T03Sc21FullE2EIT.java` (295 行 · 3 @Test) + `frontend/.../sc-21/t03-full-e2e.spec.ts` (99 行 · 3 it · _helpers 三件套) |
| DoR-2 | 真机跑通 raw output | ✓ | `test-reports/coder-backend-it-run.log` (BUILD SUCCESS · 22.60s) + `test-reports/TEST-com....T03Sc21FullE2EIT.xml` (3 testcase) + `test-reports/junit-mp-e2e.xml` (3 testcase) + `test-reports/ide-console.txt` (0 byte) |
| DoR-3 | 真截图 | n/a | 本 task 不写 VRT baseline (sibling SC20-T05 已覆盖 banner 视觉 · SC21-T02 ack CTA 仅文案增量 · 不需独立 baseline) |
| DoR-4 | spec trace 表 | ✓ | coder.md §3 给出 AC1-5 + TI1-2 → IT/e2e case 对照表 |

DoR 全过.

## Step 1-4 · 进场 + 全维度 + 编写 + 内部 DoD

Coder 已落 3 backend IT + 3 mp e2e · 5 AC + 2 TI 全 cover. Tester 复用.

内部 DoD 死循环:
- ✓ 查漏: TC-21.01 cascade 重排 / TC-21.02 retry 5 次 / TC-21.03 中间值 PARTIAL · 三 QA 用例 1:1 严覆盖
- ✓ 防伪: backend IT 用真 PG select · mock 仅 dispatcher 抽象 1 处 · mp e2e 用 mockWxMethod 描述性中文 fixture · mock_total=2 ≤ 5
- ✓ 破坏: master §7 cascade 边界 (T2 grade · T3-T6 4 downstream 重锚) · TC-21.02 第 5 次失败边界
- ✓ 保真: VRT n/a 后端 + e2e (本 task 不验)
- ✓ 定罪: 若 fail · raw log assertThat trace 行号一目了然

## Step 5 · 物理验证

**真跑 cmd + 结果**:

```bash
# Backend
cd backend
mvn -pl review-plan-service failsafe:integration-test -Dit.test=T03Sc21FullE2EIT
# Failures 0 / Errors 0 · BUILD SUCCESS · 22.60s · 3 IT (TC-21.01/02/03)

# MP E2E
cd frontend/apps/mp
pnpm exec vitest run --config test/vitest.config.ts test/e2e/sc-21/t03-full-e2e.spec.ts
# (TC1/2/3 passed · 15.51s · IDE Console 0 [error])

# Master sibling regression (KI 1)
cd backend
mvn -pl review-plan-service failsafe:integration-test \
  -Dit.test=T01Sc21OverrideOutboxE2EIT,T03GradeResultAiFieldsE2EIT,T03Sc21FullE2EIT,T06Sc20E2EHappyPathE2EIT,T11RevealE2EIT
# (22 IT regression · 0 fail · 01:11 min · BUILD SUCCESS)
```

**testcase 计数对账**: Tests run: 6 (本 task primary · 3 backend IT + 3 mp e2e) == junit XML `<testcase>` 数 6 (`TEST-...T03Sc21FullE2EIT.xml` 3 + `junit-mp-e2e.xml` 3) · audit dim_test_validity testcase_count_matches_xml PASS.

**反作弊核查**:
- mock 关键字: backend IT 1 (@MockBean JudgeOutboxDispatcher) · mp e2e 1 (mockWxMethod 描述性中文 fixture setupStub) · 总 2 ≤ 5 红线
- maxDiffPixels: n/a 本 task 不写 VRT (audit 默认 PASS)
- IDE Console: ide-console.txt 0 byte · 0 [error] · audit dim_ide_smoke PASS

## Step 6 · 决策与宣判

**通过 (PASS)**:
- 3 backend IT + 3 mp e2e = 6/6 PASS · 22 IT regression PASS (0 break)
- 5 AC + 2 TI + 2 KI 全覆盖
- mock_total=2 · IDE 0 [error] · adversarial.md 1 轮 REJECT-fix 已落 (见同目录)

落 passes=true 前已落:
- ✓ tester.md (本文件)
- ✓ adversarial.md (1 轮 REJECT + fix · 探索性 边界/boundary/race/并发 4 关键字)
- ✓ test-reports/coder-backend-it-run.log (mvn raw output BUILD SUCCESS · 22.60s)
- ✓ test-reports/TEST-com.longfeng.reviewplan.T03Sc21FullE2EIT.xml (junit · 3 testcase backend)
- ✓ test-reports/junit-mp-e2e.xml (vitest junit · 3 testcase mp e2e)
- ✓ test-reports/ide-console.txt (0 byte · 0 [error])

**Tester 6 testcase passed** (3 IT + 3 e2e = 6 == junit XML 6).

宣判 PASS · 移交 audit.js.
