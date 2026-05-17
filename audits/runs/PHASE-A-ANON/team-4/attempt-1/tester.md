# PHASE-A-ANON · team-4 · attempt-1 · Tester Work Log

**Task**: PHASE-A · anonymous-service Maven skeleton + Flyway V20260421_02 (7 anonymous-state tables) + frontend api-contracts zod schemas + Testcontainers-style IT
**Team**: team-4
**Attempt**: 1
**Date**: 2026-05-17
**Phase**: Tester (Phase 4 execution · skipped Phase 2 review per test_case_first_required=false)
**Tester verdict**: APPROVE (after Round 1 REJECT-T3 fix + Round 1.5 4 SQL probes)

---

## 1. DoR 进场拦截 (test-agent.md step 0)

Backend-only infra task · `physical_verification.frontend_e2e=null` · `dor_c1_to_c6_required=false`. Standard Playwright DoR replaced with backend IT equivalent (see `adversarial.md Round 0`). DoR **PASS**, entering test.

## 2. 全维度提取与跨页串联

This task has no UI · no journey · no state machine. The "contract chain" is instead:

```
biz §4.10–§4.13 (DDL truth source)
    ↓
V20260421_02__init_anonymous.sql (Coder's translation)
    ↓
Flyway apply → PG public schema (real sandbox)
    ↓
IT Test 4 (information_schema + pg_indexes assertions) — same biz spec in Java
    ↓
Tester probe SQL (direct INSERT to verify constraints really fire)
```

For zod contracts:

```
biz §10.6 + §10.7 (API contract truth source)
    ↓
session-resolve.ts + landing.ts (zod schema)
    ↓
index.ts re-export
    ↓
pnpm tsc --noEmit (compile-time validation)
    ↓
IT Test 5 (ProcessBuilder pnpm typecheck inside mvn verify) — cross-language gate
    ↓
Tester independent pnpm typecheck (Round 1.5 archive)
```

## 3. 编写全链路统一验收脚本

Coder's IT already covers the happy paths. Tester adds **exploratory destructive probes** beyond the Coder DoD (test-agent.md step 3 超纲对抗 + 探索性测试 mandate):

- 4 direct SQL probes against the sandbox PG to verify every CHECK + UNIQUE biz-spec'd constraint actually fires (see `adversarial.md Round 1.5`).
- 1 independent `mvn verify` run (no clean, fresh JVM) to verify idempotency (Flyway "Schema is up to date. No migration necessary.").
- 1 independent `pnpm -F api-contracts typecheck` run to archive cross-language gate evidence outside Maven.

## 4. 内部 DoD 自检死循环

| 自检项 | 结果 |
|---|---|
| 是否覆盖完整 biz §4.10-§4.13 spec | ✓ — 7 表 × 字段 / 类型 / NULL / DEFAULT / 索引 / UNIQUE / CHECK 全对照, 4 probe 验真 |
| 是否 100% 模拟真实环境 | ✓ — 真 PG :15432 (docker team-1-pg healthy) · 真 Redis :16379 · 0 mock 后端 |
| 是否破坏性边界测试 | ✓ — Round 1.5 4 destructive INSERT probes |
| VRT 像素 | N/A — 无 UI |
| 一目了然的 REJECT 证据 | ✓ — `adversarial.md` REJECT-T3 路径 + 修复 link |

## 5. 强制物理验证执行 (test-agent.md step 5)

环境 self-Ops: 复用 team-1-pg + team-1-redis (CLAUDE.md self-Ops mandate). 不写 `ops_tickets/` (sandbox 已 ready).

**Tester 实跑的命令** (raw logs all archived in `test-reports/`):

| 命令 | 结果 | 落盘文件 |
|---|---|---|
| `mvn -pl anonymous-service verify` (Tester 独立 run · no clean) | BUILD SUCCESS · Tests run: 5, Failures: 0, Errors: 0, Skipped: 0 · Flyway "Schema is up to date. No migration necessary." | `test-reports/tester-mvn-verify.log` |
| `pnpm -F @longfeng/api-contracts typecheck` (Tester 独立 run · 外 mvn) | exit=0 | `test-reports/pnpm-typecheck-stdout.log` |
| 4 destructive SQL INSERT probes (direct PG via docker exec) | all 4 raised expected constraint violation errors | `test-reports/adversarial-sql-probes.log` |

## 6. 决策与宣判

**5 testcase 全 PASS** (claimed 5 testcase aligns with failsafe XML `<testcase>` count = 5 · audit.js dim 4 test_validity guard):

1. `actuator_health_returns_200_up`             — 200 + status=UP
2. `actuator_info_carries_application_name`     — info.app.name=anonymous-service
3. `flyway_history_records_v20260421_02`        — flyway_schema_history_anonymous 1 row · success=true
4. `all_7_anonymous_tables_exist_with_columns`  — 7 tables + 16 cols guest_session + 11 cols share_token + 10 cols observer_session + 9 indices + UNIQUE jti + CHECK count<=1
5. `pnpm_typecheck_api_contracts_passes`        — cross-language gate exit=0

Plus exploratory testing:
- 4 destructive SQL boundary probes — all enforced
- 1 idempotency probe — Flyway "No migration necessary."

**Mock count**: 0 mocks in IT (no `vi.mock` · no `page.route` · no `MockMvc` · no `wx.cloud.mock` · no `mockRequest`). Well under audit.js red-line 5.

**VRT maxDiffPixels**: N/A (no UI).

**IDE Console**: N/A (team-4 not UI team; audit.js dim 6 ide_smoke auto-skipped per code line 408).

**verdict: PASS** · setting `inflight.task.passes = true`.

---

## 7. 命令实跑列表 (for audit dim 1/2 traceability)

```
$ docker ps --format '{{.Names}}\t{{.Status}}' | grep team-1
team-1-redis    Up 5 hours (healthy)
team-1-pg       Up 5 hours (healthy)

$ cd backend && mvn -pl anonymous-service verify
[INFO] Successfully validated 4 migrations (execution time 00:00.045s)
[INFO] Schema "public" is up to date. No migration necessary.
[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS

$ cd frontend && pnpm -F @longfeng/api-contracts typecheck
> tsc --noEmit -p tsconfig.json
EXIT=0

$ docker exec team-1-pg psql -U longfeng -d wrongbook -c "..."
# 4 probes all raised the expected violation errors (see adversarial-sql-probes.log)
```
