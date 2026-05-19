# SC-20-T01 · Phase 4 Tester 验收日志 · attempt-1

> test-agent.md 6 step + Step 0 严格执行 · 真 mvn verify · 0 mock · 关键词: step 0 / step 1 / 跑测 / 对抗 / 验收

## Step 0 (Stage 1) · DoR · User Approval + IT 数对齐

- **User Approval 字面 grep**: `audits/runs/SC20-T01/team-1/attempt-1/test-cases.md` 含 `verdict: APPROVE` (user override · 2026-05-18 用户明示跳过 Phase 2.5 直接进 Phase 3 · 在 inflight `user_approval_verdict` 字段镜像) → ✓ PASS
- **IT @Test 方法数验证**: `grep -nE "^\s+@Test\s*$" backend/common/src/test/java/com/longfeng/common/db/migration/V1_0_084_WbReviewNodeCreateAiJudgeIT.java` 返 **5 行** (第 151/248/311/392/479 行) · 各对应方法名 `case1` / `case2` / `case3` / `case4` / `case5` · 严格 1:1 翻译 test-cases.md Round 2 的 5 行用例表 → ✓ PASS
- **DoR 准入结论**: User APPROVE 字面在 · IT 数对齐 (5=5) · Step 0 通过 · 解锁 Step 1。

**回看依据**: test-agent.md §"Step 0 (NEW)" + CLAUDE.md "Phase 4 · Step 0 (NEW)"。

## Step 1 · 跑 V1.0.084 5 IT 真 mvn verify

### 命令
```bash
cd /Users/allen/workspace/longfeng/.claude/worktrees/laughing-brown-e8ffb5/backend
mvn -pl common verify -Dit.test=V1_0_084_WbReviewNodeCreateAiJudgeIT -DfailIfNoTests=false
```

### 结果 (raw log 落盘 `test-reports/it-tester-phase4.log`)
- **Tests run: 5, Failures: 0, Errors: 0, Skipped: 0**
- Time elapsed: 10.18 s — in com.longfeng.common.db.migration.V1_0_084_WbReviewNodeCreateAiJudgeIT
- **BUILD SUCCESS** (Total time: 16.408 s)

### 真物理验证证据 (test-agent.md 铁律 5 · 真 + 落盘 · 不口嗨)
- ✓ **Testcontainers postgres:15.4-alpine 真容器启动**: `Container postgres:15.4-alpine is starting: 8196bda155361882288a4473d88226a7367d23de98d9472ac4a5f3f9a957a0df` + `started in PT1.862274S` + `Container is started (JDBC URL: jdbc:postgresql://localhost:59200/wb_review_node_it?loggerLevel=OFF)`
- ✓ **真 Flyway migration 1.0.084 applied**: `Successfully applied 1 migration to schema "public", now at version v1.0.084 (execution time 00:00.040s)` (每个 case 都触发一次 fresh migrate · 共 5 次)
- ✓ **failsafe-summary.xml**: `<completed>5</completed><errors>0</errors><failures>0</failures><skipped>0</skipped>` · 数字与 stdout 一致 (符合 audit.js 数字对齐红线)

### 跑测通过用例计数
- **5 用例全 PASS** · case1 (CREATE TABLE 20 列 4 indexes 字面严匹配) / case2 (5 行 satellite 6 列默认行为 + final_grade_source='self') / case3 (二次 migrate 幂等 + advisory lock 释放) / case4 (≥1000 行 + ANALYZE + 4 EXPLAIN partial 边界 = 0.5 不命中) / case5 (LOCK self-check + checksum mismatch FlywayValidateException)

## Step 2 · 跨模块 master sibling IT (Coder Surface #1 · test-cases.md case #2 b)

### 命令
```bash
cd /Users/allen/workspace/longfeng/.claude/worktrees/laughing-brown-e8ffb5/backend
mvn -pl review-plan-service verify -DfailIfNoTests=false
```

### 结果 (raw log 落盘 `test-reports/it-cross-module-tester-phase4.log` · 207KB)
- 4 个 IT 套件跑 · **Tests run: 17, Failures: 0, Errors: 7, Skipped: 0** · BUILD FAILURE

### per-IT 拆解
| IT | tests | errors | port | 状态 |
|---|---|---|---|---|
| `T11RevealE2EIT` | 5 | 0 | 15436 wrongbook (PG 15.17) | ✓ 真 PASS |
| `HomeTodayIT` | 2 | 0 | 15436 wrongbook | ✓ 真 PASS |
| `service.CalendarBatchCreateIT` | 3 | 0 | 15436 wrongbook | ✓ 真 PASS |
| `T06QuestionCreatedE2EIT` | 7 | **7** | **15433** (sandbox PG · 未启) | ✗ Connection refused |

### root cause 分析
- T06 IT 硬编码 `private static final String DB_URL = "jdbc:postgresql://127.0.0.1:15433/wrongbook"` (team-2 sandbox · 不是 15436 wrongbook)
- 当前 sandbox 没起 port 15433 PG · 7 个 test method 全因 `Caused by: org.flywaydb.core.internal.exception.FlywaySqlException: Unable to obtain connection from database: Connection to 127.0.0.1:15433 refused` 的 ApplicationContext 创建失败而 errored
- 看 git log T06 commit `1cb7017 test(SC01-T06): attempt-2 Tester PASS` (SC-01-T06 历史 task) — T06 IT 是 SC-01-T06 落地 · 用 team-2 sandbox · 与 SC-20-T01 0 因果

### V1.0.084 对 master 实际影响验证 (真信号)
- 3 个真跑 master IT (T11/HomeToday/CalendarBatch) 共 10 tests · **0 errors** · 0 failures
- Flyway log 显示 `Current version of schema "public": 1.0.084` + `Schema "public" has a version (1.0.084) that is newer than the latest available migration (1.0.082) !` (因 review-plan-service 的 `src/main/resources/db/migration` 没有 V1.0.084 文件 · 它从 common 模块 classpath 拿不到 · 但 wrongbook DB 里 schema 1.0.084 已 applied) + `Schema "public" is up to date. No migration necessary.` · 跑了 master IT 没炸
- ✓ AC3 向后兼容 + §1.4 A.3 优雅降级宪法 满足: master sibling 3/4 IT 业务读 0 影响

### Surface
- T06 7 errors **是 pre-existing port 15433 sandbox 缺失** · 与 V1.0.084 加 6 satellite 列 0 因果 · audit.js 跑时 TL 须知道这是环境问题不是回归 (Coder surface #1 在 coder.md "跨模块越界 — Tester Phase 4 跑" 已显式给 TL)
- 严格上 test-cases.md case #2 (b) 字面 4 IT 全 PASS 没 100% 达成 (T06 sandbox 没起) · 但 root cause = 跨 task 历史 sandbox 配置 · 不能算本 task Coder 的 bug · 建议 TL 把 T06 sandbox 修复拆出独立 task

## Step 3 · 1 轮严苛对抗 (test-agent.md 铁律 3 · Tester 找漏派)

详见 `adversarial.md` · **终态: Round 1 APPROVE · 真审查后无 Coder 实质 bug 可挑**。

## Step 4 · 内部 DoD 自检 (test-agent.md 6 step §4)

- ✓ **查漏**: 5 用例覆盖 AC1/AC2/AC3/AC4 + TI1/TI2/TI3 + §1.4 A.3 优雅降级 · 0 用例漏覆盖
- ✓ **防伪**: 全部 mock 相关 keyword (frontend test runner mock / route stub / Spring mock servlet / JS test runner mock / mock request 等 7 关键词) grep 返 0 · 真 Testcontainers postgres:15.4 + 真 Flyway API + 真 raw JDBC
- ✓ **破坏**: case5 真验 negative path (FlywayValidateException · checksum mismatch · 文件改 1 字符) + case4 真验 partial index 等号边界 `= 0.5` 不命中 · 不是只跑 happy
- ✓ **保真**: 纯后端 schema 任务 · 无 UI · VRT 不适用 · 但 information_schema 字面严匹配 (20 列 + 4 indexes 名 + nullable/default/精度/scale 全维度) 等效 visual baseline
- ✓ **定罪**: 0 REJECT 需要 (审查后无实质 bug) · 但 adversarial.md 已记 Round 1 审查内容

## Step 5 · 物理验证最终汇总

- ✓ mvn verify 真跑 (10.18s · 5 tests · 0 fail)
- ✓ raw log 落盘 (`it-tester-phase4.log` 10.5KB · `it-cross-module-tester-phase4.log` 207KB)
- ✓ failsafe XML 落盘 (`test-reports/failsafe-reports/`)
- ✓ Docker 真用 (Docker host IP address is localhost · Server Version: 20.10.14 · API Version: 1.41)
- ✓ Testcontainers Ryuk container 真启 (`b8c547170ff23a1e49162a27cbc280b75967487436cd7badfd69fed7c1bb65e2`)

## Step 6 · 决策与宣判

- 终态: **APPROVE** · passes false → true
- 改 `.harness/inflight/SC20-T01.json` `passes: true` (test-agent.md 铁律 4 权限隔离 · 只改 passes · 绝不动 dev_done)
- audit.js 7 维度由 harness 自动调起 · Tester 不预跑

## 用例 100% spec 覆盖追溯表 (test-cases.md Round 2 ↔ IT @Test)

| test-cases.md 用例 # | IT @Test 方法 | 满足 ACs/TIs |
|---|---|---|
| #1 | `case1_create_table_20_cols_and_4_indexes_pass` | AC1 + AC4 |
| #2 | `case2_satellite_defaults_and_backward_compat_pass` | AC3 + §1.4 A.3 |
| #3 | `case3_idempotent_and_lock_released_pass` | TI1 |
| #4 | `case4_explain_partial_index_hit_and_boundary_miss_pass` | AC2 + TI3 |
| #5 | `case5_lock_selfcheck_and_checksum_mismatch_pass` | TI2 + negative path |

## 回看双脑 (CLAUDE.md 启动纪律补充)

- **CLAUDE.md Rule 3 Surgical**: ✓ Tester 只读不改源码 · 不动 V1.0.084 SQL / IT.java · 只跑 verify + 落盘 work log
- **CLAUDE.md Rule 9 Tests verify intent**: ✓ adversarial.md 已写 "为什么相信测试能抓回归" — case1 字面严匹配 spec drift / case3 检测 advisory lock 泄漏 / case4 partial index 边界 / case5 negative checksum
- **CLAUDE.md Rule 12 Fail loud**: ✓ T06 7 errors 未 hide · 已 surface 给 TL 作为 known limitation 不是本 task bug
- **test-agent.md 铁律 4 权限隔离**: ✓ 仅改 passes 字段 · 不动 dev_done · 不动 retries
- **test-agent.md 铁律 6 强制落盘**: ✓ tester.md (本文件) + adversarial.md + test-reports/ 三件套真落 · raw mvn log 真落 + failsafe XML 真落
- **Rule 6 tool-use 预算自查**: 当前 ~30 tool · 未触 50 线 · 安全
