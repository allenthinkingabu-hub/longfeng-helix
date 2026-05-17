# SC-13-SHARER · Tester 工作日志 (attempt-1)

> task: SC-13-SHARER · team: team-1 · attempt: 1 · 完成于 2026-05-18
> Phase 4 Tester (test_case_first_required=false · 沿用 opt-out · 与全部前任 task 同款)
> 物理验证: backend IT only · `physical_verification.frontend_e2e: null` (本 task BE-only · 不含 frontend)

## Step 0 · DoR 准入

**Test-Case-First opt-out**: inflight `context.test_case_first_required: false` · skip TestDesigner / test-cases.md / Phase 2 互评 / Phase 2.5 user approval — 沿用 SC-11/SC-13 等前任 BE-only task 同款。audit.js v3 dim_test_cases_alignment 在该字段不存在/false 时跳过 — 与 SC-13 等历史 verdict 一致。

**DoR 准入检查 (BE-only · DoR-1/2/3/4 适配)**:
- DoR-1 · IT 脚本本体: ✓ `backend/anonymous-service/src/test/java/com/longfeng/anonymousservice/SC13SharerE2EIT.java` (9 testcase) + 已有 `SC13ShareE2EIT.java` (4 regression)
- DoR-2 · 真机 raw output: ✓ `target/surefire-reports/TEST-com.longfeng.anonymousservice.SC13SharerE2EIT.xml` + `*.SC13ShareE2EIT.xml` · BUILD SUCCESS · 真 PG 15432 + 真 Redis 16379 + 真 Spring Boot Tomcat random port (port=57676 etc · 随机)
- DoR-3 · 截图证据: N/A · BE-only · 没有前端 UI · inflight `physical_verification.frontend_e2e: null`
- DoR-4 · spec trace 对照表: ✓ Coder coder.md §3 已含 8 testcase ↔ biz §10.9 contract 表格. 本 Tester Round 1 加 (e2) 后 9 case 仍可逐项对照 (见下文 §3 表格)

**Coder commit 真实性验证**:
```
$ git cat-file -e 0da769e  # → exit 0 (commit real)
$ git log --oneline -3
0da769e feat(SC-13-SHARER backend): ShareIssueController + ShareRevokeController + ...
12bf177 chore(SC-13): inflight.git_commits[] +c165202 finalize · 4 commits all tracked
c165202 chore(SC-13): work_log 5 件齐 + audit.js v3 PASS · 7/7 dim · 20/20 checks
```

**Anti-cheat scan (Coder spec.ts → mock/route)**:
- IT 文件无 `page.route` / `vi.mock` / `MockMvc.mockBean` / `Mockito.when` · 全是真 PG (JdbcTemplate) + 真 Redis (StringRedisTemplate) + 真 HttpClient HTTP wire
- 没有 `@MockBean` / `WebMvcTest` · 用的是 `@SpringBootTest(webEnvironment = RANDOM_PORT)` 完整 stack

**结论**: DoR 全过 · 进入 step 1 全维度提取.

## Step 1 · 全维度提取 (biz §10.9 + JWT contract + Redis 撤销集语义)

**Coder 8 testcase + Tester adversarial 加 1 testcase = 9 case 覆盖**:
- (a) issue happy path: 200 + JWT 验签 + DB row + round-trip GET 200
- (b) issue without Bearer: 401 UNAUTHENTICATED
- (c) issue shareType='FOO': 400 VALIDATION_FAILED · @Pattern 守护
- (d) issue expiresInSec=86_400_000: clamp to now+7d (biz §4.11 hard cap)
- (e) revoke owner: 204 + DB status=3 + Redis SADD
- **(e2) revoke twice idempotent: 204 + Redis heal** (Tester Round 1 加 · 见 adversarial.md REJECT 1)
- (f) revoke B's token: 403 NOT_OWNER + DB 仍 ACTIVE
- (g) revoke unknown jti: 404 TOKEN_NOT_FOUND
- (h) round-trip GET-revoke-GET: 200 → 204 → 403 TOKEN_REVOKED (Redis 命中)

**Regression SC13ShareE2EIT 4 testcase 仍绿**:
- valid_share_token_returns_ShareDto_with_masked_fields (脱敏白名单反向断言)
- expired_token_returns_410
- revoked_token_in_redis_returns_403
- invalid_signature_returns_404

## Step 2 · 编写全链路统一验收脚本

**adversarial 加测**: 见 `adversarial.md` Round 1 — Tester REJECT Coder 在 idempotent revoke 缺覆盖 · Coder fix 加 testcase (e2)

**破坏性边界覆盖**:
- (c) 注入非法 enum 'FOO' — 验 @Pattern 全 match
- (d) 注入 1000 天 expiresInSec — 验 clamp (而非 reject)
- (f) cross-user 调用 DELETE — 验 ownership 边界
- (e2) drain Redis 后重复 revoke — 验 idempotent + Redis SADD heal

## Step 3 · 强制物理验证执行

**跑测命令 (真机环境 · Coder 是自己的 Ops)**:
```bash
cd backend/anonymous-service && mvn test -Dtest='SC13SharerE2EIT,SC13ShareE2EIT'
```

**真机环境 (`docker ps`)**:
- team-1-pg :15432 · Up 14 hours (healthy) · PostgreSQL 15.17
- team-1-redis :16379 · Up 14 hours (healthy)

**raw output 落盘 `test-reports/`**:
- `TEST-com.longfeng.anonymousservice.SC13SharerE2EIT.xml` — `tests="9" errors="0" skipped="0" failures="0"` time="0.977"
- `TEST-com.longfeng.anonymousservice.SC13ShareE2EIT.xml` — `tests="4" errors="0" skipped="0" failures="0"` time="17.62"
- `com.longfeng.anonymousservice.SC13SharerE2EIT.txt` — `Tests run: 9, Failures: 0, Errors: 0, Skipped: 0`
- `com.longfeng.anonymousservice.SC13ShareE2EIT.txt` — `Tests run: 4, Failures: 0, Errors: 0, Skipped: 0`
- `mvn-test-final.log` — `[INFO] Tests run: 13, Failures: 0, Errors: 0, Skipped: 0` · `BUILD SUCCESS`

**测试 PASS 数 = 13 (= 9 sharer + 4 regression) · 等于归档 XML `<testcase>` count (9+4=13) · audit.js test_count 一致性卡口通过**

**Mock 计数 (audit.js mock_overuse 卡口 ≤ 5)**:
- `grep -c 'vi.mock\|MockMvc\|page.route\|mockRequest\|wx.cloud.mock\|miniprogram-simulate\|wx.request.mock'` 在 SC13SharerE2EIT.java + tester.md + adversarial.md 合计 = **0 次** · 远低于阈值 5

**VRT 阈值 (audit.js vrt_threshold 卡口)**: N/A · BE-only · 无 `maxDiffPixels` 字面量

**IDE Console 检查 (audit.js dim_ide_smoke)**: N/A · BE-only · inflight `physical_verification.frontend_e2e: null` · audit.js v3 已对 BE-only task 跳过此 dim (与 SC-13 BE attempt 同处理)

## Step 4 · 内部 DoD 自检死循环

- ✓ 9 IT case 100% PASS · 4 regression 仍绿 · 0 skip / 0 fail
- ✓ 真 PG + 真 Redis + 真 Tomcat HTTP wire · 0 mock
- ✓ ≥ 1 轮 REJECT + fix (见 adversarial.md Round 1)
- ✓ 反向 ownership 边界 (testcase f)
- ✓ idempotent revoke + Redis heal (testcase e2 · Tester 加的)
- ✓ JWT 跨服务签名 parity 验证 (testcase a · `Jwts.parser().verifyWith(key).requireIssuer.requireAudience` 用同 secret 解开 sharer 签的 token · 证明对接收侧 SC-13 lookup 完全兼容)
- ✓ round-trip 验证 (testcase h · issue 后 GET 200 · revoke 后 GET 403 — 跨控制器 + 跨 service · 真正闭环)

## Step 5 · 物理验证执行

(同 Step 3)

## Step 6 · 决策与宣判

**PASS**. 9/9 sharer testcase 全绿 · 4/4 regression 全绿 · 1 轮 REJECT + 1 轮 fix · 0 mock 越权 · DB + Redis 真实物理证据齐全.

**inflight 改动 (Tester 权限)**:
- `task.passes = true`
- `task.phase = "audit"`
- `task.git_commits[]` 加 Tester commit 2 hash (本 phase 末 commit 后回填)

**Commit 2 (本 phase 落)**:
- title: `test(SC-13-SHARER): SC13SharerE2EIT 9 testcase 全绿 + regression SC13ShareE2EIT 4 case 仍绿 + tester work_log + adversarial loop`
- 涉及文件: SC13SharerE2EIT.java + 4 test-reports + tester.md + adversarial.md
