# SC-12-T02 · Coder Work Log · attempt-1

## 1. 地形侦察 (Read before write · CLAUDE.md Rule 8)

**Inputs read in full before writing any code**:

- `.harness/inflight/SC-12-T02.json` (51 scope_in items / 9 DoD) · 全文
- `.harness/agents/coder-agent.md` 全文 · 内化 7 步骤 + 6 铁律 + 双脑回看
- `CLAUDE.md` · 复习 Rule 3 Surgical / Rule 6 budget / Rule 8 Read before write / Rule 11 conventions
- `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/service/AnonTokenService.java` (T01 落) · 拿到 signingKey/issuer/audience 字段 + SUB_PREFIX 常量 + mintAnonToken 签名
- `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/service/AnonSessionService.java` (T01 落) · 拿到 mint pipeline + entry_source sanitize
- `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/controller/AnonSessionController.java` (T01 落) · 拿到 ExceptionHandler 本地 scope 写法 (避 @ControllerAdvice 冲突 ShareIssueController)
- `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/service/ShareTokenService.java` · 拿到验签模式 (Jwts.parser + verifyWith + requireIssuer + requireAudience + parseSignedClaims) 作为 reference template for verifyAnonToken
- `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/entity/GuestSession.java` · 确认 consent_at (OffsetDateTime) + consent_type (Short) 已有 getter/setter
- `backend/anonymous-service/src/main/resources/db/anonymous/V20260421_02__init_anonymous.sql` § guest_session · 确认 DDL:
  - `consent_at TIMESTAMPTZ` (nullable)
  - `consent_type SMALLINT` (nullable)
  - `status SMALLINT NOT NULL DEFAULT 0` enum `0 CREATED / 1 ANALYZING / 2 RESULT_READY / 3 FAILED / 4 CLAIMED / 9 EXPIRED` (无 CONSENTED 状态 · T01 spec drift surface 已确认)
- `backend/anonymous-service/src/test/java/com/longfeng/anonymousservice/IntegrationTestBase.java` · sandbox PG 15432 + Redis 16379 既定
- `backend/anonymous-service/src/test/java/com/longfeng/anonymousservice/SC12T01AnonSessionE2EIT.java` · IT 写法标杆 (HttpClient + JdbcTemplate + Jwts.parser 验签 helper)
- `backend/anonymous-service/src/test/java/com/longfeng/anonymousservice/SC13SharerE2EIT.java` § signSharerJwt helper · 仿之手签 student-style JWT (用于 testcase d)
- `backend/anonymous-service/src/main/resources/application.yml` · `anon.jwt.secret/issuer/audience` + `anon.guest-session-ttl-sec: 86400`
- `.harness/audit.js` (audit v3 7 dims) · 确认 `test_case_first_required=false` 时跳 dim_test_cases_alignment

**Existing testcase count baseline** (`grep -rn @Test backend/anonymous-service/src/test`): 33 testcases across 6 IT files
- AnonymousServiceSkeletonE2EIT (5) + SC13ShareE2EIT (4) + T01LandingShellApiE2EIT (4)
- SC12T01AnonSessionE2EIT (6) + T01T02SessionResolveE2EIT (5) + SC13SharerE2EIT (9)

**Reference template alignment** (CLAUDE.md Rule 11):
- DTO 类风格: 沿用 `AnonSessionRequest` mutable class + getter/setter (非 record) for request (jakarta-validation 在 setter 也可)
- DTO record 风格: 沿用 `AnonSessionResponse` record for response (immutable wire)
- Controller @ExceptionHandler 本地 scope: 沿用 T01 `AnonSessionController` 写法 (不用 @ControllerAdvice · 避免与 ShareIssueController / SessionResolveController 已有的 handler 冲突)
- Service Outcome 枚举判别式: 沿用 `ShareTokenService.ShareLookupOutcome` 模式
- 错误码命名: 沿 biz §2B.13 + P-GUEST-CAPTURE spec §5 `ANON_TOKEN_INVALID / ANON_SESSION_NOT_FOUND / ANON_SESSION_MISMATCH / VALIDATION_FAILED`

**Spec drift 复核 (T01 surfaced · T02 决策)**:
- DDL status enum 无 CONSENTED 状态 (0 CREATED → 1 ANALYZING 直跳 · 无中间 CONSENTED)
- 决策: T02 PATCH consent 仅写 `consent_at` + `consent_type` · **不动 status** (留待 T03 presign 时由 status: 0→1 触发)
- 评估: 这是 acceptable surgical scope · biz §2A.3.2 P-GUEST-CAPTURE Consent Card 业务语义是 "前端 gate Shutter" · consent_at 非空足够前端判断 · status 字段不需要 CONSENTED 中间态
- IT (a) 显式断言 `status == 0` 不变 · 锁定该决策 · 防回归

## 2. 编码 (Surgical scope · 全栈打通)

**Net-new files (6)**:
1. `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/filter/AnonFilter.java` · HandlerInterceptor · 拦 `/api/anon/**` · 白名单 `POST /api/anon/session` · 401 ANON_TOKEN_INVALID + 写 request.attribute `anonGuestSessionId`
2. `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/config/WebMvcConfig.java` · WebMvcConfigurer · `addInterceptors` 注册 AnonFilter 到 `/api/anon/**`
3. `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/controller/AnonSessionConsentController.java` · `PATCH /api/anon/session/{id}/consent` · path-id 与 filter attribute mismatch → 403 ANON_SESSION_MISMATCH · NOT_FOUND → 404 · 本地 @ExceptionHandler MethodArgumentNotValidException → 400 VALIDATION_FAILED
4. `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/service/AnonSessionConsentService.java` · applyConsent(id, type) → ConsentOutcome (NOT_FOUND / SUCCESS) · 写 consent_at = now + consent_type · 不动 status
5. `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/dto/AnonConsentRequest.java` · `@NotNull @Min(1) @Max(3) Short consentType`
6. `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/dto/AnonConsentResponse.java` · record(OffsetDateTime consentAt, Short consentType)

**Modified file (1)**:
- `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/service/AnonTokenService.java` · 新增 `public Optional<Long> verifyAnonToken(String tokenValue)` · 复用 signingKey/issuer/audience 字段 · 同模式于 ShareTokenService.lookup 验签步骤 · sub 必 startsWith `"anon:"` · suffix Long.parseLong · 失败 Optional.empty 不抛 · debug 日志不含 token 内容 (timing-side-channel 同 401 输出)

**Net-new test file (1)**:
- `backend/anonymous-service/src/test/java/com/longfeng/anonymousservice/SC12T02AnonConsentE2EIT.java` · 9 testcase
  - (a) consent_with_valid_token_returns_200_and_db_updated · 验 200 + DB consent_at 非空 + consent_type=1 + status=0 (不变)
  - (b) consent_without_header_returns_401_anon_token_invalid · 验白名单外 missing header → 401
  - (c) consent_with_garbage_token_returns_401 · 验 garbage 验签失败 → 401
  - (d) consent_with_student_jwt_returns_401_wrong_prefix · 验 sub="42" (auth-service style) 同 secret 签 · 但 sub 无 "anon:" prefix → 401 (核心反防混用断言)
  - (e) consent_with_token_for_different_session_returns_403 · session A token + session B path → 403 ANON_SESSION_MISMATCH
  - (f) consent_for_nonexistent_session_returns_404 · 手签 sub="anon:99999999" 无 DB 行 → 404 ANON_SESSION_NOT_FOUND
  - (g) consent_invalid_consent_type_returns_400 · consentType:0 → 400 VALIDATION_FAILED (下界)
  - (h) filter_lets_session_mint_pass · POST /api/anon/session 无 X-Anon-Token 仍 200 (白名单)
  - (i) consent_invalid_consent_type_upper_bound_returns_400 · consentType:4 → 400 (上界 · 锁 @Max(3))

**未触代码**:
- SC-12-T01 (AnonSessionService / AnonSessionController / GuestSession entity / GuestRateBucket / DTOs A-Z 全部)
- SC-13 / SC-13-SHARER 任何 Share* controller / service
- SC-00 / SC-11 (SessionResolveController / LandingController)
- guest_session.status 状态机推进 (留 T03 + 后续)
- frontend (无 ts 改动 · 无 spec drift)
- OSS presign / questions / analyze / claim / quota (T03-T06)

## 3. 真实 E2E (BE-only IT against real PG 15432)

**Run 1 · 只跑新 IT (sanity)**: `mvn -o -Dtest=SC12T02AnonConsentE2EIT test`
```
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 16.84 s -- in com.longfeng.anonymousservice.SC12T02AnonConsentE2EIT
[INFO] BUILD SUCCESS
```

**Run 2 · 全 IT 回归 `mvn -o verify`**:
```
AnonymousServiceSkeletonE2EIT  Tests run: 5
SC12T02AnonConsentE2EIT        Tests run: 9
SC13ShareE2EIT                 Tests run: 4
T01LandingShellApiE2EIT        Tests run: 4
SC12T01AnonSessionE2EIT        Tests run: 6
T01T02SessionResolveE2EIT      Tests run: 5
SC13SharerE2EIT                Tests run: 9
─────────────────────────────────────────
Total                          Tests run: 42, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

**Spec / API path / wire trace 对照表** (BE-only, no UI testid):

| Component | Wire path | Method | Status | Body / Header | Covered by testcase |
|-----------|-----------|--------|--------|---------------|---------------------|
| AnonFilter mint whitelist | `/api/anon/session` | POST | 200 | no `X-Anon-Token` required | (h) `filter_lets_session_mint_pass` |
| AnonFilter token check | `/api/anon/**` (non-mint) | PATCH | 401 | missing `X-Anon-Token` → `{code:ANON_TOKEN_INVALID}` | (b) |
| AnonFilter token check | `/api/anon/**` (non-mint) | PATCH | 401 | garbage `X-Anon-Token` → 401 | (c) |
| AnonFilter sub prefix | `/api/anon/**` (non-mint) | PATCH | 401 | JWT sub no `"anon:"` prefix → 401 | (d) |
| AnonSessionConsentController happy | `/api/anon/session/{id}/consent` | PATCH | 200 | `{consentType:1}` → `{consentAt,consentType}` + DB write | (a) |
| AnonSessionConsentController mismatch | `/api/anon/session/{id}/consent` | PATCH | 403 | token sub.id ≠ path id → `{code:ANON_SESSION_MISMATCH}` | (e) |
| AnonSessionConsentService NOT_FOUND | `/api/anon/session/{id}/consent` | PATCH | 404 | path id has no DB row → `{code:ANON_SESSION_NOT_FOUND}` | (f) |
| AnonConsentRequest @Min(1) | `/api/anon/session/{id}/consent` | PATCH | 400 | `consentType:0` → `{code:VALIDATION_FAILED}` | (g) |
| AnonConsentRequest @Max(3) | `/api/anon/session/{id}/consent` | PATCH | 400 | `consentType:4` → `{code:VALIDATION_FAILED}` | (i) |

**DB 物理证据 (testcase a)**: 通过 `JdbcTemplate.queryForMap("SELECT consent_at, consent_type, status FROM guest_session WHERE id = ?", anonSessionId)` 直读 PG · consent_at non-null · consent_type=1 · status=0 (T02 不动 · 锁定回归) — 真物理验证非 mock.

**inflight DoR**: `dor_c1_to_c6_required=false` (BE-only · 无 Playwright / 无截图 / 无 spec-trace 12 PNG) · audit dim_spec_alignment opt-out 路径 (audit.js line 245).

## 4. 自检 (DoD 对照 + 双脑回看)

| inflight DoD | 状态 | 证据 |
|--------------|------|------|
| 1. AnonTokenService.verifyAnonToken(String) → Optional<Long> · sub 前缀 "anon:" 严格校验 | ✓ | AnonTokenService.java:115-148 + IT (d) 反例验证 |
| 2. AnonFilter HandlerInterceptor 注册 /api/anon/** · 白名单 POST /api/anon/session · 401 ANON_TOKEN_INVALID | ✓ | AnonFilter.java + WebMvcConfig.java + IT (b)(c)(d)(h) |
| 3. PATCH /api/anon/session/{id}/consent endpoint · 验 path id == filter attribute (403 if mismatch) | ✓ | AnonSessionConsentController.java:73-79 + IT (e) |
| 4. AnonSessionConsentService.applyConsent 写 consent_at + consent_type · 不动 status | ✓ | AnonSessionConsentService.java:66-80 + IT (a) 物理 DB SELECT 验 status=0 |
| 5. SC12T02AnonConsentE2EIT ≥ 7 IT testcase 全绿 (含 401/403/404/400 全错误码 · 含 student JWT 反例) | ✓ | 9 testcase · 4xx 全覆盖 · (d) student JWT 反例 |
| 6. Regression 既有 33 IT 全绿 | ✓ | mvn verify 42 total = 33 prior + 9 new · 0 failure |
| 7. work_log 5 件齐 · ≥1 REJECT + ≥1 fix | 进行中 | coder.md / bugs-found.md 落盘 中 · tester.md / adversarial.md / test-reports/ 由 Tester 阶段落 |
| 8. git commit 2-3 个 · hash 入 inflight · audit.js v3 PASS | 进行中 | 本 commit 即 commit 1/3 (feat) |
| 9. 不动 guest_session.status (T01 spec drift surface) | ✓ | AnonSessionConsentService 注释 + IT (a) 物理断言 status=0 不变 |

**铁律双脑回看**:
- Rule 3 Surgical: 仅扩展 AnonTokenService 加 1 方法 · 净新 6 文件 + 1 test file · 不动 T01 任何东西 ✓
- Rule 8 Read before write: T01 5 个 java + SC-13 ShareTokenService.lookup + IntegrationTestBase + SC12T01AnonSessionE2EIT + SC13SharerE2EIT.signSharerJwt 全读过 ✓
- Rule 9 Tests verify intent: (a) 锁 status=0 防 T03 误改 · (d) 锁 sub prefix 防 secret 共享下 student-anon 混淆 · (e) 锁 token-session 绑定防越权 · (f) 锁 token-DB row 必须双在场 · 每个 testcase 写了 "intent" 而非 "behavior" ✓
- Rule 11 conventions: DTO class+getter 沿 AnonSessionRequest · DTO record 沿 AnonSessionResponse · @ExceptionHandler 本地 sc沿 AnonSessionController · Outcome enum 沿 ShareTokenService · 完全对齐 ✓
- Rule 12 Fail loud: verifyAnonToken Optional.empty + debug log 不静默 swallow · ExceptionHandler 显式映射 4xx · status=0 假设在 IT 显式断言 ✓
- Rule 6 budget: 当前 tool ≈ 30 次 · 估 ≈ 75K token · 远未触线 ✓

## 5. 提交

**Commit 1 of 3** · `feat(SC-12-T02 backend): AnonFilter HandlerInterceptor + AnonTokenService.verifyAnonToken + PATCH consent endpoint + AnonSessionConsentService + DTOs`

后续 commits:
- Commit 2 of 3 · `test(SC-12-T02): SC12T02AnonConsentE2EIT 9 testcase 全绿 + regression 33 prior IT 仍绿` (由 Tester 阶段提)
- Commit 3 of 3 · `chore(SC-12-T02): work_log + audit.js v3 PASS + inflight finalize`

Commit hash 由 Coder 写完 commit 后回填 (本文 §5 最后一段).

**Commit 1 hash · feat**: `6fc6570` (git cat-file -e PASS)
- 7 files changed · 470 insertions · 8 deletions
- net-new 6 java + 1 modified (AnonTokenService.java +63 -1)

后续 Tester / chore commits 由 Phase 4 / 5 落.
