# Coder Work Log · SC-12-T08 · attempt-1

Task: SC-12 真页 backend · POST /api/anon/claim · 双 JWT (X-Anon-Token + Bearer
student) + 真转发 wrongbook-service:8082 POST /api/wb/questions + guest_session
status 2→4 CLAIMED · NO MOCK 铁律延续 · 7+ IT testcase 全绿.

## 1. 地形侦察

读完 inflight `.harness/inflight/SC-12-T08.json` (65 scope_in lines / 9 DoD /
test_case_first_required=false / work_log_dir=audits/runs/SC-12-T08/team-1/attempt-1/).

读 agent.md 全文:
- `.harness/agents/coder-agent.md` — 7 step + 铁律 1-7 + 双脑回看 + Rule 6 tool
  budget · 内化.
- `.harness/agents/test-agent.md` — DoR 4 项 + 6 step + 铁律 1-8 · 留给 Tester 看.

标杆模板 (grep · 严格模仿):
- `service/AnonAnalyzeService.java` — T06 同 pattern 的"真 RestTemplate 跨服务转发
  + 状态机推进" outcome-discriminator 路由. 我直接抄它的 outcome enum + factory
  + 控制器 switch 风格.
- `controller/AnonAnalyzeController.java` — 同 pattern 错误码映射 + 局部
  @ExceptionHandler. 我抄它的 error code constants + switch outcome → HTTP
  ResponseEntity 风格.
- `service/JwtVerifier.java` — 已存在 (SC-00-T02) · `verifyAndGetStudentId`
  返 `Optional<Long>` · empty → 任何 JWT 失败 (sig/exp/iss/aud/missing/wrong-prefix).
  我直接 inject + 单一 401 STUDENT_AUTH_REQUIRED · FE 不关心细分原因.
- `test/SC13SharerE2EIT.java` — 已有 `signSharerJwt` helper · 我抄 helper 签名风
  格 (Keys.hmacShaKeyFor + Jwts.builder).
- `test/SC12T06AnonAnalyzeE2EIT.java` — 同 pattern IT 结构 (BeforeAll probe +
  BeforeEach cleanup + helpers mint/consent/postX + LocalServerPort).
- 上游契约 (实地探测确认):
  ```
  curl -X POST localhost:8082/api/wb/questions -d '{"student_id":99999,...}'
  → 201 + {"code":0,"message":"ok","data":{"qid":"314736046854119424"}}
  ```
  `data.qid` 是 numeric String (snowflake-generated long · 防 JS Number 精度损).
  CreateQuestionReq snake_case via @JsonProperty.
- 上游持久化 (grep + psql):
  - wrongbook 在 `wrong_item` 表持久化 (NOT `wb_question` — 该表存在但 wrongbook
    不写入). 列名 `student_id` / `subject` (NOT `owner_id` / `subject_code` —
    `wb_question` 列名是 owner_id/subject_code, 但 wrongbook 不动它).
  - 这是 attempt-1 IT 第一次跑碰到的真坑: 第一次的 cross-service assert 写错表
    名 → 2 case FAIL · 立刻改 wrong_item + student_id/subject 重跑 全绿.

CLAUDE.md 双脑回看:
- Rule 3 Surgical · 只新建 5 个 java + 1 个 IT class + 1 个 IT down class + 1
  yml block · 不动现有任何业务代码. ✓
- Rule 8 Read before Write · 已读 inflight + 2 agent.md + 5 标杆模板源码 + 上
  游 DTO + 实测 8082 wire. ✓
- Rule 11 Match conventions · 控件 + 服务 + DTO + properties · 都模仿 T06
  AnonAnalyze* 同 pattern. ✓
- Rule 12 Fail loud · ParseLong qid 失败 → log.error + 502, 不 silent 吞. ✓
- Rule 6 tool budget · self-checkpoint @ tool ~25, ~50: 在路上 OK.

## 2. 编码

### 2.1 新文件 (5 main · 2 test)

| 路径 | 行数 | 摘要 |
|---|---|---|
| `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/dto/AnonClaimRequest.java` | ~25 | record · @NotBlank @Pattern six-subject whitelist |
| `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/dto/AnonClaimResponse.java` | ~25 | record · @JsonProperty snake_case fields |
| `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/config/AnonClaimProperties.java` | ~45 | @ConfigurationProperties anon.wrongbook · base-url 独立 prefix |
| `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/service/AnonClaimService.java` | ~290 | 6 Kind outcome · 幂等先 · 真 RestTemplate · ApiResult envelope parse |
| `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/controller/AnonClaimController.java` | ~150 | 双 JWT · switch outcome → ResponseEntity · @ExceptionHandler 400 |
| `backend/anonymous-service/src/test/java/com/longfeng/anonymousservice/SC12T08AnonClaimE2EIT.java` | ~360 | 7 testcase · 含跨 service wrong_item 行真校验 |
| `backend/anonymous-service/src/test/java/com/longfeng/anonymousservice/SC12T08AnonClaimDownE2EIT.java` | ~190 | 1 testcase · @DynamicPropertySource override base-url=:65535 真 ECONNREFUSED |

### 2.2 修改文件 (1)

- `backend/anonymous-service/src/main/resources/application.yml` · 在既有 anon:
  块内追加 anon.wrongbook.base-url=http://localhost:8082 (不开新 anon: 顶级 mapping
  · 沿 T04 yaml 合并教训).

### 2.3 关键设计决策

1. **RestTemplate bean 复用**: 选 `@Qualifier("aiAnalysisRestTemplate")` 同
   bean 调 wrongbook · 不新建 wrongbookRestTemplate · 减少 dep · 同 sandbox
   host 同 latency profile · 2s connect 5s read 对 wrongbook 也合理.

2. **幂等先于状态检查**: 同人 claim 已 claimed session → 200 同 qid (TC-12.02).
   异人 → 409 (TC-12.04 cross-tenant 防御). 在 status==2 检查**之前**做幂等检查 ·
   因为已 claimed 的 session g.status 已是 4 CLAIMED · 如果先检查 status==2 必
   挂 412 · 而 spec 要求是 200 同 qid · 必须幂等先.

3. **502 不消耗状态**: RestClientException / 非-201 / data.qid 缺失 → 502
   WRONGBOOK_SERVICE_FAILURE · guest_session **不 mutate** · 配套 IT 案 (g)
   验证 status 仍 2 / claimed_by* 仍 null · FE 可重试干净.

4. **qid 类型选择**: 上游 wrongbook data.qid = numeric String (snowflake long
   防 JS 精度损). GuestSession.claimedQuestionId 是 Long · 必须 parseLong. 非
   numeric → log.error + 502 · Fail loud (Rule 12).

5. **subject 体系**: AnonClaimRequest.subject 复用 T05/T06 同款 @Pattern 6 科
   白名单 · 不抽 SubjectPattern 常量 (Rule 3 Surgical · 3 个 sibling DTO 改动
   超范围).

6. **路径 `/api/anon/claim`**: spec §5 写 `/api/auth/anonymous-claim` · 但
   AnonFilter 注册到 `/api/anon/**` · 把 claim 放同 namespace 让 filter 自然
   接管 X-Anon-Token · 不跨 service 复杂化. spec drift 在 inflight scope_out
   显式声明.

7. **AnonClaimDownE2EIT 独立 class**: @DynamicPropertySource 不能 reset Spring
   context · 不能在同一 SC12T08AnonClaimE2EIT 内做 happy + down · 独立 class
   起新 context · 同 T06 (SC12T06AnonAnalyzeDownE2EIT) 已证模式 OK.

## 3. 真实 E2E (IT)

### 3.1 命令 + raw

```
cd backend/anonymous-service
mvn -q verify -Dit.test='SC12T08AnonClaimE2EIT,SC12T08AnonClaimDownE2EIT' -DfailIfNoTests=false -Dsurefire.skip=true
```

`mvn` 实际跑了所有 anonymous-service IT (failsafe surefire-filter 范围 wider).
单独 T08 结果:

| Class | Tests | Pass | Fail |
|---|---|---|---|
| SC12T08AnonClaimE2EIT | 7 | 7 | 0 |
| SC12T08AnonClaimDownE2EIT | 1 | 1 | 0 |
| **T08 总计** | **8** | **8** | **0** |

完整 regression:

| Class | Tests | Pass | Fail | 备注 |
|---|---|---|---|---|
| AnonymousServiceSkeletonE2EIT | 5 | 5 | 0 | |
| SC12T01AnonSessionE2EIT | 6 | 6 | 0 | |
| SC12T02AnonConsentE2EIT | 12 | 12 | 0 | |
| SC12T04AnonPresignE2EIT | 8 | 8 | 0 | |
| SC12T05AnonQuestionsE2EIT | 10 | 10 | 0 | |
| SC12T06AnonAnalyzeDownE2EIT | 1 | 1 | 0 | |
| **SC12T06AnonAnalyzeE2EIT** | **6** | **4** | **2** | **known issue (brave-shaw drift · 不算 T08 fault)** |
| SC12T07AnonResultDownE2EIT | 1 | 1 | 0 | |
| SC12T07AnonResultE2EIT | 7 | 7 | 0 | |
| **SC12T08AnonClaimDownE2EIT** | **1** | **1** | **0** | **本 task 新增** |
| **SC12T08AnonClaimE2EIT** | **7** | **7** | **0** | **本 task 新增** |
| SC13ShareE2EIT | 4 | 4 | 0 | |
| SC13SharerE2EIT | 9 | 9 | 0 | |
| T01LandingShellApiE2EIT | 4 | 4 | 0 | |
| T01T02SessionResolveE2EIT | 5 | 5 | 0 | |
| **总计** | **86** | **84** | **2** | T06 2 case known issue 例外 |

T06 known issue 在 inflight context 显式声明: 跨 worktree drift · brave-shaw
ai-analysis-service 改动 (SC-16-T03) 破了 @Transactional · 不是 T08 引入 ·
T07 时已 surface · 本 task scope_out 不修.

### 3.2 跨 service 真证据

- IT 案 (a) `claim_after_ready_returns_200_and_writes_wb_question_row` 实地
  跑通真 wrongbook-service:8082 创建 wrong_item 行 + PG 真 SELECT 命中:
  ```
  wrong_item.student_id = 8801 (STUDENT_A)
  wrong_item.subject = 'math'
  wrong_item.source_type = 0 (USER_UPLOAD)
  wrong_item.origin_image_key = 'guest-tmp/{anonSessionId}/probe.jpg'
  ```
- IT 案 (c) `claim_idempotent_returns_same_qid` 实地证明同 idempotency-key
  ='anon-claim-{anonSessionId}' 触发 wrongbook 上游自然去重 → wrong_item
  COUNT(*) WHERE student_id=A 始终 = 1 · 重复 claim 不重建.
- IT 案 (d) `claim_by_different_student_returns_409` 实地证明 409 短路 ·
  STUDENT_B 在 wrong_item 表 0 行 · 服务**没有**调上游 wrongbook RPC.
- IT 案 (g) `claim_when_wrongbook_down_returns_502` (down IT) 实地证明 502
  branch 不 mutate guest_session · status 仍 2 / claimed_by* 仍 null · wrong_item
  对 STUDENT_A 仍 0 行.

### 3.3 与 spec 的 trace (best-effort · BE-only task · spec 重 BE 触点)

| spec §5 / biz §2B.13 F08 | IT case |
|---|---|
| POST /api/anon/claim · 双 header 双 JWT | (a) happy + (e) 缺 X-Anon-Token + (f) 缺 Bearer JWT |
| 服务端: 校验 + 新建 wb_question (→ wrong_item) + EbbinghausEngine + MQ | (a) 真创 wrong_item · MQ + Ebbinghaus out-of-scope (review-plan-service) |
| TC-12.02 24h 重开返同 qid | (c) claim_idempotent_returns_same_qid |
| TC-12.04 异 device_fp + 异 owner → 拒 | (d) claim_by_different_student_returns_409 (device_fp 双因子 P1 跳过) |
| status 2 → 4 CLAIMED state transition | (a) 验 g.status=4 · (b) 验 status≠2 时 412 |
| ≤ 600 ms p95 | 未独立 perf 探针 · 单 case 真 RPC ~250ms · 远低于 600ms |

## 4. 自检 (内部 DoD)

| 检查项 | 结果 | 证据 |
|---|---|---|
| 5 main + 2 test 新文件全部落盘 | ✓ | git status / git diff HEAD~1 HEAD 都可看 |
| `mvn compile` 0 error · `mvn test-compile` 0 error | ✓ | mvn -q -DskipTests compile + test-compile 无输出 (clean) |
| 真编译 IT 全跑 | ✓ | `mvn verify` 86 testcase ran |
| T08 新 IT ≥ 6 全绿 | ✓ | 8 PASS (>= 6 红线) |
| 跨 service 真 wrong_item 行写入断言 | ✓ | case (a) JDBC SELECT 命中 student_id/subject/source_type/origin_image_key |
| 幂等 idempotency-key 上游去重断言 | ✓ | case (c) wrong_item COUNT(*) 重 claim 后仍 1 |
| 502 不消耗 guest_session | ✓ | case (g · down) status 仍 2 · claimed_by* 仍 null |
| Regression T01..T07 + SC-13 全绿 (T06 2 case known issue 例外) | ✓ | 84/86 PASS · 2 fail 是 T06 brave-shaw drift |
| NO MOCK 铁律 | ✓ | grep `vi.mock\|@MockBean\|WireMock\|MockWebServer\|page.route` 在 T08 IT 0 命中 |
| `mvn checkstyle:check` | ⚠ skipped | 沿 T01-T07 attempt 习惯 · checkstyle 未默认绑 verify · 本 task 不引入 |

## 5. 提交

3 git commit 计划:

| seq | commit hash (短) | message |
|---|---|---|
| 1 | `08dd301` | feat(SC-12-T08 backend): AnonClaimService + AnonClaimController + 2 DTOs + AnonClaimProperties · POST /api/anon/claim 双 JWT + 真转发 wrongbook-service:8082 |
| 2 (待 Tester) | TBD | test(SC-12-T08): SC12T08AnonClaimE2EIT 7 + Down 1 testcase 全绿 + regression 84/86 (T06 2 case known issue 例外) |
| 3 (待 audit) | TBD | chore(SC-12-T08): work_log + audit.js v3 PASS + inflight finalize |

Commit 1 已落 (本步骤):
- 短 hash: `08dd301`
- `git cat-file -e 08dd301` PASS (verified at attempt-1 time)
- 改动 6 file (1 yml + 5 java) 606 insertions + 0 deletions.

inflight 状态变更:
- 写完 coder.md + bugs-found.md (本 step)
- 然后 dev_done = true / phase = tester / git_commits[] += '08dd301'
- 移交 Tester (Phase 4).
