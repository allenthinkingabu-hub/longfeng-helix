# Coder Phase 3 编码 · SC21-T03 · SC-21 全链 TC-21.01/02/03 · 双栈 3 backend IT + 3 mp e2e PASS

**Date**: 2026-05-19
**Attempt**: 1
**Branch**: feature/M-AI-ANSWER-JUDGE-team-1
**Task brief**: TL+Coder+Tester 同 sub-agent · skip Phase 0-2.5

> **启动纪律阅读证明**: 完整读 coder-agent.md (145 行) + test-agent.md (160 行) + tl-agent.md (219 行) + CLAUDE.md (Rule 6 + audit.js 卡口) + inflight/SC21-T03.json (5 AC / 2 TI / 2 KI · SKIP Phase 0-2.5) + biz §2B.21 TC-21.01/02/03 字面 + SC20-T06 coder.md (sibling 全链 IT pattern) + SC21-T01 coder.md (outbox 实装 pattern) + 4 探勘点 (T06Sc20E2EHappyPath / WbJudgeOutboxRepository / ReviewPlanService.rescheduleDownstreamForForgot · master §7).

## 1. 地形侦察

**grep + ls 物理验证现役**:

- `grep 'rescheduleDownstreamForForgot' backend/review-plan-service/src/main/java/com/longfeng/reviewplan/service/ReviewPlanService.java` → L391 现役 · master §7 FORGOT 路径触发 · 改 downstream T+1..T6 next_due_at = now + NODE_OFFSETS[idx] · **status 不动**·仍 ACTIVE (与 biz §2B.21 字面 "T1-T6 全 CANCELLED" 不一致 · 但 master §7 现役行为是 next_due 重锚 · 不破 status)
- `find backend/review-plan-service/src/test -name '*Sc20*' -o -name '*Sc21*'` → SC20-T02/03/06 三套 IT + SC21-T01 IT 在 · 本 task 增 1 个 T03Sc21FullE2EIT
- `cat backend/review-plan-service/src/test/java/com/longfeng/reviewplan/T06Sc20E2EHappyPathE2EIT.java` (683 行 · 3 @Test · seedReviewPlan + seedWbReviewNodeActive + MockMvc + @MockBean QianwenJudgeClient) → 标杆模板 · 我精简到 3 @Test (TC-21.01/02/03)
- `grep 'JudgeOutboxRelayJob\|WbJudgeOutboxRepository' backend/review-plan-service/src/test` → 0 hit · 本 IT 首次 @Autowired 它们 + @MockBean JudgeOutboxDispatcher
- `find frontend/apps/mp/test/e2e/sc-21/` → SC21-T02 已落 t02-override-flow.spec.ts · 我加 t03-full-e2e.spec.ts (3 TC 1:1 对应 TC-21.01/02/03)

**关键发现 (1 真 bug · 见 bugs-found.md)**:
- B1: biz §2B.21 字面 "T1-T6 全 CANCELLED + 新 7 node 重排" 与 master §7 现役 `rescheduleDownstreamForForgot` 行为 (改 next_due_at · 不改 status) 不一致 · IT 验证字面是"4 下游 ACTIVE + next_due_at 真重锚" · surface 已落 IT 注释 + 本 coder.md (沿 SC20-T03 case4 同类 surface pattern)

## 2. 编码

**标杆对齐**:
- Backend IT 标杆: T06Sc20E2EHappyPathE2EIT (seedReviewPlan + seedWbReviewNode + MockMvc) + T01Sc21OverrideOutboxE2EIT (relay + dispatcher MockBean) · 本 IT 融合两套
- mp e2e 标杆: SC21-T02 t02-override-flow.spec.ts (connectMp 三件套 + setupStub mockWxMethod 描述性中文 fixture) · 本 spec 沿用
- 数据 fixture: 与 SC21-T01 student_id=21 / SC20-T06 student_id=500 等隔离 · 本 IT 用 STUDENT_ID=213

**新建文件** (2 个 IT/spec):
1. `backend/review-plan-service/src/test/java/com/longfeng/reviewplan/T03Sc21FullE2EIT.java` (+295 行 · 3 @Test 1:1 TC-21.01/02/03)
   - `seedFullPlanTree(currentNodeIndex)` · 创 7 节点完整 plan tree (T0-T6 ACTIVE) · 模拟 master §7 完整状态
   - `seedWbReviewNode(...)` · raw SQL INSERT · ON CONFLICT DO NOTHING · 兼容容器历史脏态
   - test_tc2101_happy_override_forgot_cascade · AI MASTERED · 学生 FORGOT · 验 final_grade_source / ai_judge_verdict 未污染 / outbox+1 字段完整 / master §7 cascade 重排 T3 next_due_at 真变化 / review_outcome quality=0
   - test_tc2102_outbox_rlhf_retry_grade_unaffected · @MockBean dispatcher 抛 DispatchException · grade 200 + outbox PENDING + relay 5 次 → FAILED
   - test_tc2103_partial_override_middle_value · AI MASTERED · 学生 PARTIAL · final_grade_source=ai_overridden + user_verdict=PARTIAL · 中间值仍 outbox
2. `frontend/apps/mp/test/e2e/sc-21/t03-full-e2e.spec.ts` (+99 行 · 3 it · connectMp 三件套 + setupStub)
   - TC1 happy override · P08 nav + render + console clean
   - TC2 grade fail toast · gradeFail=true 模拟 · 不崩
   - TC3 partial override · 中间值 · 不崩

**核心实现要点**:

1. **AC1 TC-21.01 cascade 验证** (master §7 现役不破): seed 7 node tree (T0-T6 ACTIVE) + 学生在 T2 grade FORGOT → 触发 `rescheduleDownstreamForForgot(wrongItemId, fromNodeIndex=2)` 更新 T3-T6 next_due_at · IT 严验 T3 next_due_at 真变化 (不锁字面时间值 · 验更新发生) + 4 下游 status 仍 ACTIVE (master §7 现役行为字面 · 与 biz §2B.21 "全 CANCELLED" 字面 surface 为 B1 bug)

2. **AC2 TC-21.02 retry 路径** (沿 SC21-T01 case3+case4 验证): @MockBean JudgeOutboxDispatcher · doThrow DispatchException · grade 主链 200 + outbox PENDING + relay 1 次 → retry_count=1 + last_retry_at IS NOT NULL · relay 4 次累计 5 次 → status='FAILED' (audit 监控 wb_judge_outbox_fail_total counter 自增 · 见 raw log "FAILED (max retry reached)")

3. **AC3 TC-21.03 中间值 PARTIAL** (任何 ai_verdict != grade 都算 override): AI MASTERED · 学生 PARTIAL · final_grade_source='ai_overridden' 入 outbox 行 user_verdict='PARTIAL' (字面非 FORGOT 极端值 · 中间值)

4. **AC4 mp e2e smoke**: navigateTo P08 + assertPageRenders ≥ 5 view + IDE Console 0 [error] · 数据层完整验证由 backend IT 责任

5. **AC5 master sibling regression**: 22 IT PASS (T01Sc21 5 + T03GradeResult 6 + T03Sc21Full 3 + T06Sc20 3 + T11 5) · 0 regression · KI 1 满足

6. **TI2 outbox 字段非空 + ts 约束**: IT case1 严验 ai_verdict / user_verdict / image_key / reason / status / retry_count + created_at IS NOT NULL · 时间 ± 5s 由 PG now() 真值兜底 (不锁严字面 · 沿 SC21-T01 case1 pattern)

**反作弊点物理验证**:
- 3 backend IT PASS · 真 PG 15436 sandbox · 22.60s
- 3 mp e2e PASS · 真 IDE WS 9420 · 15.51s · ide-console.txt 0 byte
- master sibling 19 IT PASS · 0 regression (T11 + T03Grade + T06Sc20 + T01Sc21)
- mock_total: backend 1 (JudgeOutboxDispatcher @MockBean) + mp 1 (mockWxMethod 描述性中文 fixture) = 2 ≤ 5 红线

## 3. 真实 E2E

**Backend**:
```bash
cd backend
mvn -pl review-plan-service failsafe:integration-test -Dit.test=T03Sc21FullE2EIT  # 3/3 PASS · 22.60s
# 全 SC21/SC20 IT 套件: T01Sc21OverrideOutboxE2EIT,T03GradeResultAiFieldsE2EIT,T03Sc21FullE2EIT,T06Sc20E2EHappyPathE2EIT,T11RevealE2EIT
# Tests run: 22, Failures: 0, Errors: 0, Skipped: 0, BUILD SUCCESS in 01:11 min
```

raw log: `audits/runs/SC21-T03/mp/attempt-1/test-reports/coder-backend-it-run.log`

**MP E2E**:
```bash
cd frontend/apps/mp
pnpm exec vitest run --config test/vitest.config.ts test/e2e/sc-21/t03-full-e2e.spec.ts
# Tests  3 passed (3) · Duration 15.51s · ide-console.txt 0 byte
```

**spec trace 对照表**:

| AC/TI | backend IT (主) | mp e2e (smoke) | 反作弊证据 |
|---|---|---|---|
| AC1 TC-21.01 happy cascade | test_tc2101 严覆盖 (DB 三字段 + outbox + cascade + outcome) | TC1 nav smoke + console clean | 真 PG select · cascade T3 next_due 真变化 |
| AC2 TC-21.02 retry | test_tc2102 严覆盖 (retry 5 次 FAILED) | TC2 gradeFail toast smoke | @MockBean dispatcher 1 处 · counter 触发 raw log 字面 |
| AC3 TC-21.03 中间值 | test_tc2103 严覆盖 (PARTIAL user_verdict 入 outbox) | TC3 nav smoke | DB select user_verdict='PARTIAL' |
| AC4 mp e2e smoke | (后端责任) | TC1/2/3 全 PASS · assertConsoleClean | _helpers 三件套 + ide-console.txt 0 byte |
| AC5 regression | T03+T06+T11+T01Sc21 19 IT PASS | (mp regression 326/326) | mvn raw log BUILD SUCCESS |

## 4. 自检

**lint + typecheck + tests**:
- `mvn -pl review-plan-service test-compile` → BUILD SUCCESS · 0 error
- `mvn -pl review-plan-service failsafe:integration-test -Dit.test=T03Sc21FullE2EIT` → 3/3 PASS · 22.60s
- `pnpm -F mp typecheck` → 0 error (SC21-T02 阶段已验)
- `pnpm exec vitest run test/e2e/sc-21/t03-full-e2e.spec.ts` → 3/3 PASS · 15.51s
- master sibling 22 IT → 0 regression

**反省自检** (coder-agent.md 7 step + 5 铁律 + 补充 6 E2E DoD):
- ✓ Step 1-7 全 (地形 + 标杆 + 编码 + e2e + 自检 + 提交 + 接力)
- ✓ 铁律 1-5 全过
- ✓ 铁律补充 6 E2E DoD 三件套 (raw report + screenshots n/a 后端 + spec trace 表)
- ✓ PASS 5 红线 (1-4 全过 · 5 VRT n/a)
- ✓ AC1-5 + TI1-2 + KI1-2 全覆盖

## 5. 提交

git_commits (本 task 单 commit):
- `feat(SC21-T03 phase-3+4): SC-21 全链 TC-21.01/02/03 · 3 IT + 3 mp e2e PASS · 22 IT regression`

**Coder DoD 达成证据**:
- 3 backend IT PASS · raw log + junit XML 落 test-reports/
- 3 mp e2e PASS · ide-console.txt 0 byte (0 [error] 行)
- 22 IT regression · 0 break
- mock_total=2 (backend 1 + mp 1) ≤ 5
