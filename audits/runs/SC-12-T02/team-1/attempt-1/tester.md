# SC-12-T02 · Tester Work Log · attempt-1

## 进场 · DoR 准入

inflight `physical_verification.dor_c1_to_c6_required: false` (BE-only IT task · 不需要 Playwright / 不需要 4 张状态截图 / 不需要 spec-trace 12 PNG). audit dim_spec_alignment 跳过该卡口 (audit.js line 245).

Coder 交付物核验:
- ✓ `backend/anonymous-service/src/test/java/com/longfeng/anonymousservice/SC12T02AnonConsentE2EIT.java` 存在
- ✓ 真后端 IT (Spring Boot + 真 PG 15432 + 真 Flyway · 非 mock-only IT · 非 in-memory MVC)
- ✓ Coder commit `6fc6570` git cat-file -e PASS

DoR 通过 · 准入测试.

## 命令执行 (真物理验证)

### Run 1 · 只跑新 IT (Coder attempt-1 produced 9 testcases)
```
cd backend/anonymous-service && mvn -o -Dtest=SC12T02AnonConsentE2EIT test
```
**结果**: Tests run: 9, Failures: 0, Errors: 0, Skipped: 0 — BUILD SUCCESS

### Run 2 · Tester Round 1 REJECT · 加 3 testcase 后再跑
- 见 adversarial.md · Round 1 REJECT 找出 3 个 Tests-verify-intent 弱点 + 1 个 exploratory 盲区
- 加 3 testcase: (j) double consent last-writer-wins · (k) lowercase header case-insensitive · (l) 4KB oversized garbage probe
- 加 1 处 happy-path 加固: (a) consent_at 真实时间窗 (before, after+1s) 而非仅 isNotNull

```
cd backend/anonymous-service && mvn -o -Dtest=SC12T02AnonConsentE2EIT test
```
**结果**: Tests run: **12**, Failures: 0, Errors: 0, Skipped: 0 — BUILD SUCCESS

### Run 3 · 全 IT 回归 (full `mvn verify`)
```
cd backend/anonymous-service && mvn -o verify
```
**结果 (raw, see test-reports/verify.log)**:
```
AnonymousServiceSkeletonE2EIT  Tests run: 5
SC12T02AnonConsentE2EIT        Tests run: 12   ← +12 net-new (9 happy/edge + 3 adversarial fix)
SC13ShareE2EIT                 Tests run: 4
T01LandingShellApiE2EIT        Tests run: 4
SC12T01AnonSessionE2EIT        Tests run: 6
T01T02SessionResolveE2EIT      Tests run: 5
SC13SharerE2EIT                Tests run: 9
─────────────────────────────────────────────
Total                          Tests run: 45, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

**12 testcase passed** in SC12T02AnonConsentE2EIT (= XML `<testcase>` count exactly 12 — audit dim_test_validity claimed=12==xml=12 PASS).

Regression: 33 prior IT (= 45 - 12 new) 全绿 · 0 失败 · 既有 SC-12-T01 / SC-13 / SC-13-SHARER / SC-00 / SC-11 全部不破.

## 物理 DB 断言证据 (testcase a)

testcase (a) 通过 `JdbcTemplate.queryForMap("SELECT consent_at, consent_type, status FROM guest_session WHERE id = ?", anonSessionId)` 直读真 PG 15432:
- `consent_at` 非空 + 在 [request-start - 1s, request-end + 1s] 时间窗内 (锁实时钟写, 防 epoch-0 类回归 · Tester Round 1 fix)
- `consent_type` == 1
- `status` == 0 CREATED (锁 T02 不动 status 决策, 防 T03 误改回归)

testcase (j) 双调用后 DB 行: consent_type=2 (后写覆盖前写 · last-writer-wins) + consent_at 推进 (锁服务 javadoc 契约).

非 mock · 真物理 DB 读断言.

## DoD 5 项 PASS 定义对照 (2026-05-16 用户视角对齐 红线)

| 红线 | 状态 | 证据 |
|------|------|------|
| 1. unit + integration + e2e 全绿 | ✓ | mvn verify 45/45 PASS · 0 fail |
| 2. 真 IDE / 真浏览器 Console 零 [error] | N/A | BE-only task · 无前端 ide-console.txt 适用范围 |
| 3. 页面渲染元素数 ≥ 预期阈值 | N/A | BE-only task · 无前端 wxml/HTML 适用范围 |
| 4. 网络请求真返预期 · 非 catch 静默吞 fallback | ✓ | testcase (a)(b)(c)(d)(e)(f)(g)(h)(i)(j)(k)(l) 全用真 HttpClient + 真 HTTP status code 断言 · 无 catch 吞 |
| 5. 截图与 mockup baseline 差 < 500 pixel (VRT) | N/A | BE-only task · 无 VRT 适用范围 |

(2 / 3 / 5 N/A 因为 dor_c1_to_c6_required=false · 这是 BE-only IT task 的固定形态)

## 自检 (test-agent.md 6 step + 铁律)

- step 0 DoR: 见进场段 ✓
- step 1 进场拦截: 读 inflight + Coder 交付物 ✓
- step 2 全维度提取: 读 biz §2B.13 F02 (inflight scope 已带) + P-GUEST-CAPTURE §5 X-Anon-Token 用法 + AnonFilter javadoc + AnonSessionConsentController 全 4xx 路径 ✓
- step 3 编脚本: Coder 已编 · Tester APPEND 3 adversarial-fix testcase + 1 happy 加固 (见 adversarial.md Round 1) ✓
- step 4 内部 DoD 自检: 见上表 ✓
- step 5 强制物理验证: mvn verify 真 PG 真 Flyway 真 HTTP · 见 test-reports/verify.log + surefire/*.xml ✓
- step 6 决策: PASS · 落 tester.md + adversarial.md + test-reports/ 三件套后改 passes=true

铁律双脑回看:
- Rule 1 真人操作: 真 java.net.http.HttpClient · 非 page.evaluate · 非 in-memory MVC stub ✓
- Rule 3 严苛对抗: 1 轮 REJECT (Round 1 找 3 个 intent 弱点 + 1 个 exploratory 盲区) + 1 轮 fix (加 3 testcase + 加固 1 testcase) ✓
- Rule 4 权限隔离: 只改 IT + 落 work_log + 改 inflight.passes · 不改 dev_done ✓
- Rule 5 物理验证: 真 PG SELECT 断言 · 非 mock ✓
- Rule 6 落盘三件套: tester.md (本) + adversarial.md + test-reports/{verify.log + surefire/} ✓
- Mock count audit: 0 mock pattern in IT 源码 + test-reports (全真 IT · 无 vitest stub / 无 in-memory MVC / 无 wx.* stub) ≤ 5 ✓
- Rule 9 Tests verify intent: 每个 testcase 写了 intent javadoc · 见 SC12T02AnonConsentE2EIT.java testcase Javadoc · (d) 锁 sub prefix discriminator · (j) 锁 last-writer-wins 服务契约 · (k) 锁 RFC 7230 header case-insensitive ✓
- Rule 6 token budget: 当前 tool ≈ 48 · est ~110K · 接近软线 50 · 本输出末附 self-checkpoint ✓
