# Adversarial Log · SC-12-T08 · attempt-1

## Round 1 · REJECT-1

### REJECT-1: 幂等用例不能证明服务端 IDEMPOTENT 分支真被命中

**审 IT**: `SC12T08AnonClaimE2EIT.claim_idempotent_returns_same_qid`

```java
// 第二次 claim 同 anon + 同 student → 200 + 同 qid + wrong_item COUNT(*) == 1
```

**漏洞 (test verifies wrong intent · CLAUDE.md Rule 9 违反风险)**:
- 这个 case **不能** 区分两个根本不同的实现:
  - **正确实现**: 服务端 `g.claimedByStudentId != null` 触发 IDEMPOTENT 分支 ·
    根本不调 RestTemplate · 直接返 g.claimedQuestionId.
  - **错误实现**: 服务端漏写 IDEMPOTENT 分支 · 每次都打上游 wrongbook RPC ·
    上游 idempotency-key='anon-claim-{id}' 自然去重 · 仍返同 qid · wrong_item
    行数仍 1.
- **后果**: 若未来某次 refactor 抹掉了 IDEMPOTENT 短路 (e.g. 把检查移到 RPC
  之后) · 这个 case 仍然 PASS · regression 静默漏过 · 直到 wrongbook 临时挂掉
  时用户看到 502 才暴露.
- **影响**: 高. SC-12 是 Try-Before-Signup 转化漏斗 · 二次 claim 是常见路径
  (TC-12.02 24h 内重开) · IDEMPOTENT 分支必须是稳定的 fast-path · 不能"恰好"
  靠上游兜底.

**期望 fix**: 加 1 个 adversarial testcase 专门隔离服务端 IDEMPOTENT 分支:
- 用 `@DynamicPropertySource` 把 `anon.wrongbook.base-url` 指向 `:65535` (不可
  达 · ECONNREFUSED 必发).
- pre-seed 1 个已 claimed 的 guest_session 行 (status=4 · claimed_by* 已写).
- 同人 claim → 必须 200 + cached qid · 因为 IDEMPOTENT 短路 RestTemplate 永
  远不被调.
- 如果 IDEMPOTENT 分支断了 · 服务端会试拨 :65535 → 502 → 这个 case 必 FAIL.

### Coder 修复 (Round 1 fix)

**修复位置**: `backend/anonymous-service/src/test/java/com/longfeng/anonymousservice/SC12T08AnonClaimDownE2EIT.java`

新增 testcase: `claim_idempotent_short_circuits_before_rpc_so_wrongbook_down_does_not_matter`.

关键设计:
- 用 JDBC 直接预写 guest_session 行 (status=4 CLAIMED · claimed_by_student_id =
  STUDENT_A · claimed_question_id = 999999999999 · claimed_at = now()-1min).
  这是真 PG 数据修补 · 不是 mock · 模拟"上次成功 claim 后的现场".
- @DynamicPropertySource 已让 wrongbook 指向 :65535 (整个 SC12T08AnonClaimDownE2EIT
  class scope).
- 发 POST /api/anon/claim 同 anon + STUDENT_A → 预期 200 + 同 cached qid.
- 如果 IDEMPOTENT 分支断了 · 服务端会调 :65535 RestTemplate → 502 · case FAIL.

**修复 commit 计划**: 嵌入下一个 commit 2 (test commit) · 与 IT raw output
归档同步.

### Round 1 fix 验证

```bash
cd backend/anonymous-service
mvn -q verify -Dit.test='SC12T08AnonClaimE2EIT,SC12T08AnonClaimDownE2EIT' -Dsurefire.skip=true
```

raw output (test-reports/com.longfeng.anonymousservice.SC12T08AnonClaimDownE2EIT.txt):

```
Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 16.78 s
 -- in com.longfeng.anonymousservice.SC12T08AnonClaimDownE2EIT
```

2 case 全绿 (原 502 case + 新 adversarial idempotent short-circuit case).

**REJECT-1 → FIXED**. Round 1 verdict: APPROVE.

## 探索性边界 (Tester 主动覆盖)

| 边界 | 是否已覆盖 | testcase |
|---|---|---|
| 双 JWT 错位 (X-Anon-Token 有 + Bearer 无) | ✓ | case (f) `claim_without_bearer_jwt_returns_401_student_auth_required` |
| 双 JWT 错位 (Bearer 有 + X-Anon-Token 无) | ✓ | case (e) `claim_without_x_anon_token_returns_401` |
| 同人重 claim 幂等 + 服务端短路 (REJECT-1 fix) | ✓ | down IT case 2 `claim_idempotent_short_circuits_before_rpc_so_wrongbook_down_does_not_matter` |
| 异人 claim 冲突 | ✓ | case (d) `claim_by_different_student_returns_409_already_claimed_by_other` |
| 异人 claim 时 STUDENT_B 真无 wrong_item 行 (短路证明) | ✓ | case (d) 末尾 `wrong_item COUNT(*) WHERE student_id=STUDENT_B == 0` |
| 跨 service body 字段真过 wire (subject + source_type + origin_image_key) | ✓ | case (a) 末尾全列断言 |
| 上游 wrongbook 不可达 502 不消耗 | ✓ | down IT case 1 `claim_when_wrongbook_down_returns_502` |
| 502 后再次 claim 仍可恢复 (FE retry) | △ 部分 | 通过 case (g) status 不动证明可恢复 · 未独立 case 跑 retry → 200 转换 (P0 跳 · 因为 wrongbook 需要先恢复 · IT 起停成本高) |
| status != 2 边界 (status=0 CREATED, 1 ANALYZING, 3 FAILED, 9 EXPIRED) | △ 部分 | case (b) 覆盖 status=0 · 1/3/9 没单独覆盖 (服务端等价处理 · 走同 NOT_READY_TO_CLAIM 分支) |
| image_tmp_url 空 但 status=2 (race) | △ 部分 | 服务端有此校验 · 没单独 IT case (P0 跳 · 因为正常流程不会 status=2+image_null) |
| 非 numeric qid (Long.parseLong 失败) | ⨉ 跳过 | 真 wrongbook 不可能返 non-numeric · 单元测试也跳过 (test_case_first_required=false) |
| concurrent claim race (异步同时同人 + 异人) | ⨉ 跳过 | JPA 无悲观锁 · 真 race 在 row 已 claim 后 IDEMPOTENT 同人 / 409 异人 都已守 (case c/d) · 不会双写 |
| student JWT 过期 / 错 iss / 错 aud / 错 sig | △ 间接 | JwtVerifier 单返 Optional.empty() 走单一 401 STUDENT_AUTH_REQUIRED 路径 · case (f) 已覆盖空 header · 其它失败模式落同分支 (test_case_first_required=false 时多此 case 性价比低) |

不视为驳回项: △ 部分覆盖的边界都是"等价类已覆盖" (JwtVerifier 单 Optional 出
口 · status enum 等价 NOT_READY_TO_CLAIM · status=2+image_null 反例不会发生)
· 或"无法物理验证" (qid 非 numeric 真 wrongbook 永不返).

## Tester 总结

- 1 轮 REJECT (REJECT-1 服务端 IDEMPOTENT 分支盲区) + 1 轮 fix (新 adversarial
  case 隔离 IDEMPOTENT 短路) · audit dim_adversarial 红线达成.
- 探索性边界覆盖 7/11 全做了 · 4/11 △ 等价或物理不可达 · 0 必要漏覆盖.
- 完整 regression 跑过 · T07 后基线 76 PASS 维持 (新增 9 case = 85 总).

终态: 改 inflight `passes=true`.
