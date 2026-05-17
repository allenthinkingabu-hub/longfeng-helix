# PHASE-A-ANON · team-4 · attempt-1 · Coder Work Log

**Task**: PHASE-A · anonymous-service Maven skeleton + Flyway V20260421_02 (7 anonymous-state tables) + frontend/packages/api-contracts (session-resolve.ts + landing.ts zod schemas) + Testcontainers-style IT against sandbox PG/Redis
**Team**: team-4
**Attempt**: 1
**Date**: 2026-05-17
**Phase**: Coder (skipped TestDesigner per inflight.test_case_first_required=false — infra task with no user scenario)

---

## 1. 地形侦察

读了 `.harness/agents/coder-agent.md` 全文 + `.harness/inflight/PHASE-A-ANON.json` 全文 + CLAUDE.md 全文。本文 Coder 铁律 1-5 + 补充 6/7 + 执行流程 7 步已内化。

**标杆模板对齐** (coder-agent.md step 3 强制 grep 找同类模块):

| 标杆来源 | 复用要素 |
|---|---|
| `backend/auth-service/pom.xml` | wrongbook-parent 继承 · failsafe `**/*IT.java` 模式 · `maven-compiler-plugin` 覆盖 `testExcludes` 解锁 IT 编译 · spring-boot-starter-{web,actuator,jdbc,data-redis} + flyway-core/flyway-database-postgresql + testcontainers junit-jupiter (10.15.0 / 1.20.1) |
| `backend/auth-service/src/main/resources/application.yml` | namespace 隔离的 flyway locations `classpath:db/auth` + 隔离的 history table `flyway_schema_history_auth` · 不踩 common 模块 V*.sql · 我对应改 `db/anonymous` + `flyway_schema_history_anonymous` |
| `backend/auth-service/src/test/java/.../IntegrationTestBase.java` | `@DynamicPropertySource` 直接指向 sandbox 容器 (`localhost:15432` PG + `localhost:16379` Redis) · 不另起 Testcontainers (因 docker 长期在线 · 沿用 PHASE-A-LOGIN-H5 决策) |
| `backend/auth-service/src/test/java/.../AuthServiceLoginE2EIT.java` | JDK 内置 `HttpClient` (避免 TestRestTemplate 把 4xx 当 throwable) · `@SpringBootTest(webEnvironment=RANDOM_PORT)` · ObjectMapper + assertThat 风格 |
| `biz/.../业务与技术解决方案_AI错题本_基于日历系统.md §4.10–§4.13` | 7 张表 DDL 字面真相源 · 每个字段 / 索引 / UNIQUE / CHECK 逐字符对照 · 字段顺序保持 biz 行序 |

**Sandbox 容器实测**:
```
$ docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' | grep team-1
team-1-redis    Up 4 hours (healthy)    0.0.0.0:16379->6379/tcp
team-1-pg       Up 4 hours (healthy)    0.0.0.0:15432->5432/tcp
team-1-minio    Up 4 hours (healthy)    0.0.0.0:9000-9001->9000-9001/tcp
```
PHASE-A-LOGIN-H5 已立先例:复用 team-1 容器,不另起 team-4 compose。

---

## 2. 编码

### 2.1 Maven 模块 (scope_in 1, 13)
- `backend/anonymous-service/pom.xml` — inherit `wrongbook-parent` · `<artifactId>anonymous-service</artifactId>` · 依赖与 auth-service 同款剪裁 (web + actuator + jdbc + data-redis + postgresql + flyway-core + flyway-database-postgresql + spring-boot-starter-test + testcontainers junit-jupiter + testcontainers postgresql).
- `backend/pom.xml` — `<modules>` 段加 `<module>anonymous-service</module>` (其他 5 服务一行未动).
- `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/AnonymousServiceApplication.java` — `@SpringBootApplication(scanBasePackages = {"com.longfeng.anonymousservice","com.longfeng.common"})`.
- `backend/anonymous-service/src/main/resources/application.yml` — port 8090 + 隔离 Flyway namespace `classpath:db/anonymous` + 隔离 history table `flyway_schema_history_anonymous` + `ignore-migration-patterns: "*:missing"` (见 §3 Bug 2).

### 2.2 Flyway V20260421_02 7 张表 (scope_in 4-6)
落盘到 `backend/anonymous-service/src/main/resources/db/anonymous/V20260421_02__init_anonymous.sql` (340 行). 严格对照 biz §4.10-§4.13:

| 表 | biz 引用 | 字段数 | 索引/约束 |
|---|---|---|---|
| guest_session | §4.10 line 1670 | 16 字段 | idx_guest_session_fp_day · idx_guest_session_expires (部分索引 WHERE status IN (0,1,2)) · uq_guest_claim (部分 UNIQUE WHERE claimed_question_id IS NOT NULL) |
| guest_rate_bucket | §4.10 末尾 line 1693 | 7 字段 | uq_guest_rate_bucket_fp_ip_date (device_fp+ip_hash+bucket_date 三元 UNIQUE) · CHECK count<=1 |
| share_token | §4.11 line 1698 | 11 字段 | idx_share_token_sharer · jti UNIQUE |
| share_token_audit | §4.11 line 1713 | 6 字段 | idx_share_audit_jti |
| observer_invite | §4.12 line 1729 | 7 字段 | invite_code UNIQUE |
| observer_session | §4.12 line 1739 | 11 字段 | jti UNIQUE · idx_observer_session_student |
| account_device | §4.13 line 1759 | 8 字段 | uq_account_device (student_id+device_fp UNIQUE) · idx_account_device_fp |

每张表都附 `COMMENT ON COLUMN ... IS '...'` 注释字段含义,直接复述 biz 行尾注释 (e.g. `consent_type` "1 ADULT / 2 MINOR_WITH_GUARDIAN / 3 MINOR_NO_GUARDIAN").

物理证据见 `test-reports/psql-schema-evidence.txt` (140 行 `\d <table>` 完整输出).

### 2.3 frontend api-contracts zod (scope_in 7-9)
- `frontend/packages/api-contracts/src/session-resolve.ts` — `ResolveDecisionSchema` (6 枚举 `HOME|LANDING|SHARED|OBSERVER|WELCOME_BACK|LOGIN` 对齐 biz §2A.3.1 + §10.6) + `ResolveRequestSchema` (deviceFp 非空 / entrySource 非空 / shareToken? / observerCode?) + `ShareContextSchema` + `ObserverContextSchema` + `ResolveResponseSchema`.
- `frontend/packages/api-contracts/src/landing.ts` — `LandingSampleSchema` (subject / stemText / knowledgePoints[] / errorReason / correction) + `LandingSamplesResponseSchema` (z.array) + `LandingKpiResponseSchema` (cumulativeQuestions / dailyAnalyses / happyUsers — z.number().int().nonnegative()).
- `frontend/packages/api-contracts/src/index.ts` — 末尾追加 `export * from './session-resolve'` + `export * from './landing'`. 前 9 行原有 client export 完全未动.
- 新建 `frontend/packages/api-contracts/tsconfig.json` (复制 h5 tsconfig 风格 · strict + ESM + bundler resolution + noEmit).
- `frontend/packages/api-contracts/package.json` 加 `scripts.typecheck = "tsc --noEmit -p tsconfig.json"` + `dependencies.zod ^3.23.0` + `devDependencies.typescript ^5.4.5`.

### 2.4 IT 测试 (scope_in 10-12)
- `backend/anonymous-service/src/test/java/.../IntegrationTestBase.java` — `@DynamicPropertySource` 锁定 sandbox PG/Redis + `spring.flyway.locations=classpath:db/anonymous` + `spring.flyway.table=flyway_schema_history_anonymous` + `spring.flyway.ignore-migration-patterns=*:missing`.
- `backend/anonymous-service/src/test/java/.../AnonymousServiceSkeletonE2EIT.java` — 5 @Test method (超过 inflight DoD 的 ≥3 要求):

| # | @Test | DoD 验证项 |
|---|---|---|
| 1 | `actuator_health_returns_200_up` | scope_in #3 健康检查 200 + status=UP |
| 2 | `actuator_info_carries_application_name` | scope_in #3 /actuator/info 含 anonymous-service 名 |
| 3 | `flyway_history_records_v20260421_02` | scope_in #5 flyway_schema_history_anonymous 含 V20260421_02 行 + script + success |
| 4 | `all_7_anonymous_tables_exist_with_columns` | scope_in #4,6,11 — 7 表 in + guest_session/share_token/observer_session 关键字段 + 9 个核心索引 + 2 个核心约束 (share_token.jti UNIQUE + ck_guest_rate_bucket_count_le_1 CHECK) |
| 5 | `pnpm_typecheck_api_contracts_passes` | scope_in #12 跨语言断言 · ProcessBuilder 跑 `pnpm -F @longfeng/api-contracts typecheck` 断言 exit=0 |

---

## 3. 真实 E2E (mvn verify + pnpm typecheck)

**3.1 pnpm typecheck** (跨语言契约护栏 · scope_in #9, #12):
```
$ cd frontend && pnpm -F @longfeng/api-contracts typecheck
> @longfeng/api-contracts@0.1.0 typecheck
> tsc --noEmit -p tsconfig.json
EXIT=0
```
归档:本 attempt 中由 IT Test 5 (`pnpm_typecheck_api_contracts_passes`) 通过 ProcessBuilder 再次跑过,exit=0,纳入 failsafe XML 的绿 case.

**3.2 mvn verify** (主 IT · 5/5 PASS):
```
$ cd backend && mvn -pl anonymous-service -am clean verify
...
[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 10.71 s
[INFO] --- maven-failsafe-plugin:3.1.2:verify (default) @ anonymous-service ---
[INFO] BUILD SUCCESS
```
Raw log 落 `test-reports/mvn-verify-green.log` (完整 stdout + Flyway info + Spring Boot startup + IT 跑动).

**3.3 Idempotency (Flyway 不重复应用)**:
第二次 `mvn -pl anonymous-service verify` (复用已存在的 history)输出 `Successfully validated 4 migrations` + `Tests run: 5, Failures: 0, Errors: 0` + `BUILD SUCCESS`. 即 V20260421_02 不重复 apply, 验证 scope_in #5 幂等要求.

**3.4 7 张表 schema 对齐 biz §4.10-§4.13**:
落盘 `test-reports/psql-schema-evidence.txt` (140 行 `\d <table>` + flyway_schema_history_anonymous SELECT). 对照表:

| 检查项 | biz 真相 | PG 实测 (psql \d) | 状态 |
|---|---|---|---|
| guest_session 字段数 | 16 (id+device_fp+ip_hash+ua+entry_source+experiment_bucket+image_tmp_url+analysis_result_json+consent_at+consent_type+status+claimed_by_student_id+claimed_question_id+created_at+expires_at+claimed_at) | 16 | ✓ |
| guest_session 索引 | idx_guest_session_fp_day + idx_guest_session_expires (部分 WHERE status IN (0,1,2)) + uq_guest_claim (部分 UNIQUE WHERE claimed_question_id IS NOT NULL) | "idx_guest_session_expires" btree (expires_at) WHERE status = ANY (ARRAY[0, 1, 2]) · "uq_guest_claim" UNIQUE, btree (claimed_question_id) WHERE claimed_question_id IS NOT NULL | ✓ |
| share_token.jti UNIQUE | "NOT NULL UNIQUE" | "share_token_jti_key" UNIQUE CONSTRAINT | ✓ |
| guest_rate_bucket UNIQUE | "(device_fp, ip_hash, date) 联合唯一" | "uq_guest_rate_bucket_fp_ip_date" UNIQUE, btree (device_fp, ip_hash, bucket_date) | ✓ |
| guest_rate_bucket count 上限 | "上限 1/day" | Check constraints: "ck_guest_rate_bucket_count_le_1" CHECK (count <= 1) | ✓ |
| observer_session.jti UNIQUE | "jti VARCHAR(64) NOT NULL UNIQUE" | UNIQUE 已建 (查 indices 含 observer_session_jti_key) | ✓ |
| account_device 联合 UNIQUE | uq_account_device(student_id, device_fp) | "uq_account_device" UNIQUE, btree (student_id, device_fp) | ✓ |

Diff vs biz = **0** (字段名 / 类型 / NULLABLE / DEFAULT / 索引 / UNIQUE / CHECK 全部对齐).

---

## 4. 自检 (DoD 12 项逐条对照)

| # | DoD (inflight.deliverables_definition_of_done) | 证据 |
|---|---|---|
| 1 | Maven 模块 + parent inherit + compile BUILD SUCCESS | `mvn -pl anonymous-service -am compile` SUCCESS · 见 §3.2 |
| 2 | AnonymousServiceApplication + application.yml (8090) + /actuator/health 200 | IT Test 1 `actuator_health_returns_200_up` PASS |
| 3 | Flyway V20260421_02 迁移成功 + 7 表 + 索引 + UNIQUE + CHECK + psql \d 落盘 | `test-reports/psql-schema-evidence.txt` 140 行 + Flyway 日志 "Successfully applied 1 migration to schema public, now at version v20260421.02" |
| 4 | 7 表 schema 100% 对齐 biz §4.10-§4.13 | §3.4 对照表 diff=0 |
| 5 | session-resolve.ts + landing.ts + index.ts re-export + pnpm typecheck PASS | EXIT=0 见 §3.1 |
| 6 | IT AnonymousServiceSkeletonE2EIT ≥ 3 @Test · mvn verify BUILD SUCCESS | 实际 5 @Test 全绿 · 见 §3.2 |
| 7 | IT 内 ProcessBuilder 跑 pnpm typecheck exit=0 (跨语言断言) | IT Test 5 实测 PASS · 真子进程执行 |
| 8 | backend/pom.xml `<modules>` 加 anonymous-service · 其他 5 服务 src/ 不动 | `git diff --stat` 验:backend/pom.xml +1 行 · 0 SC-01 服务 src/ 改动 |
| 9 | work_log: coder.md (5 段) + bugs-found.md | 本文件 · 见 bugs-found.md |
| 10 | work_log: tester.md + adversarial.md + test-reports/ | 留给 Tester (本文是 Coder 阶段) · `test-reports/` 已含 mvn-verify-green.log + psql-schema-evidence.txt + failsafe-reports/ |
| 11 | git add + commit · commit hash 写 inflight.git_commits[] | 待本段写完后执行 (见 §5) |
| 12 | dev_done=true | 待 commit 完后执行 |

---

## 5. 提交

提交分两步:(a) anonymous-service module + Flyway + IT  (b) frontend api-contracts zod + index re-export. Commit hash 写入 inflight.task.git_commits[] (本段 §5 在 commit 后回填).

**Commit hashes**:
- `<HASH-1>` chore(PHASE-A-ANON): anonymous-service Maven skeleton + Flyway V20260421_02 (7 tables) + IT 5/5 green
- `<HASH-2>` feat(api-contracts): session-resolve + landing zod schemas + index re-export + typecheck PASS
- `<HASH-3>` docs(PHASE-A-ANON): attempt-1 coder.md + bugs-found.md + test-reports archived

(actual hashes filled in by post-commit append below — kept verifiable via `git cat-file -e`).
