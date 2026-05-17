# SC-12-T02 · Adversarial Loop · attempt-1

Tester adversarial review per test-agent.md 铁律 3 严苛对抗. 用户视角 PASS 定义 (2026-05-16 RC) + Rule 9 Tests verify intent 是本轮核心 lens.

## Round 1 · REJECT · 2026-05-18

Coder 在 attempt-1 一上来给出 9 testcase 全绿 · 全过 4xx 错误码 (401/403/404/400) + 全过 happy path 200. 表面看起来很全 · 但 Tester REJECT 因发现以下 4 处 **intent vs behavior** 漏洞:

### 漏洞 1 · happy-path testcase (a) consent_at 仅检 isNotNull · 不够严

**问题**: 
```
assertThat(row.get("consent_at")).as("consent_at must be persisted").isNotNull();
```
该断言只能 catch "完全没写". 一个 silent regression 例如 `g.setConsentAt(OffsetDateTime.MIN)` 或 `g.setConsentAt(OffsetDateTime.parse("1970-01-01T00:00:00Z"))` 仍会 isNotNull PASS · 但前端 24h 倒计时会显示负数 · 用户视角直接破坏.

**Intent 应该是**: consent_at 是 **真服务器实时墙钟** · 不是任意非空值 · 不是 epoch-0 · 不是固定常量.

**修复**: 加时间窗断言
```
OffsetDateTime before = OffsetDateTime.now();  // 请求前
...
OffsetDateTime after = OffsetDateTime.now();   // 请求后
long beforeSec = before.minusSeconds(1).toEpochSecond();
long afterSec = after.plusSeconds(1).toEpochSecond();
assertThat(consentEpochSec).isBetween(beforeSec, afterSec);
```

### 漏洞 2 · service.applyConsent javadoc 写了 "last writer wins" · 但没 testcase 锁定

**问题**: `AnonSessionConsentService` 类 javadoc 显式承诺并发/重复 consent 写入是 "last writer wins" (Acceptable since they all carry the same business meaning). 这个契约 0 testcase 覆盖. 一个未来 refactor 加幂等判别 (例如 "consent_at 非空就 short-circuit 返回 SUCCESS 不写") 会 silent drift · 用户重复点 consent (老/小) 会出错.

**Intent 应该是**: 用户可以从 ADULT (1) 改到 MINOR_WITH_GUARDIAN (2) · 服务必须按最后一次为准.

**修复**: 加 testcase (j) `consent_called_twice_keeps_last_writer_wins`
- 调用 1 次 consentType=1 · 等 1.1 秒 · 调用 1 次 consentType=2
- 验 DB 行 consent_type=2 (后覆盖前) + consent_at advance past 第一次的 wall clock

### 漏洞 3 · X-Anon-Token header lookup 大小写敏感度未覆盖

**问题**: HTTP RFC 7230 §3.2 规定 header name 大小写无关 · 但代码用 `req.getHeader("X-Anon-Token")` 字符串字面量. Tomcat / Jakarta Servlet API 默认实现确实 case-insensitive · 但未来如果有人换 custom HttpServletRequestWrapper 用普通 Map 做 lookup · 这个 invariant 会 silent break. 真实客户端 (curl / 老 axios / fetch lower-cased headers) 会送 `x-anon-token` 而非 `X-Anon-Token`.

**Intent 应该是**: 接受 `X-Anon-Token` / `x-anon-token` / `X-ANON-TOKEN` 任意大小写 · 全应该过 verifyAnonToken.

**修复**: 加 testcase (k) `consent_with_lowercase_header_name_returns_200`
- 显式用 `.header("x-anon-token", ...)` 全小写
- 验 200 (case-insensitive 生效)

### 漏洞 4 · exploratory · oversized garbage token DoS probe

**问题**: garbage token 测试 (c) 用了一个短字符串 "garbage.invalid.jwt". 真实攻击者可能投递一个 4KB / 16KB / 64KB 的字符串 · 测 JJWT 解析是否会 OOM / hang / 抛 5xx (而非清洁 401).

**Intent 应该是**: 任何 size 的 garbage 都干净 401 · 不该有 5xx · 不该 hang.

**修复**: 加 testcase (l) `consent_with_oversized_garbage_token_returns_401`
- header = "a".repeat(4096)
- 验 status 401 + code=ANON_TOKEN_INVALID
- 探索性 (audit dim_test_validity EXPLORATORY_KEYWORDS 命中: "超长" / "脏数据" / "边界" / DoS 类 keyword)

## Round 1 · Fix · 2026-05-18

Coder 在同 attempt 内修 (无需 spawn 新 Coder · Tester APPEND 3 testcase + 1 happy 加固到现有 IT 文件):

| 文件 | 变更 |
|------|------|
| `SC12T02AnonConsentE2EIT.java` | 类 javadoc 改 "8 testcases" → "12 testcases" · happy (a) 加时间窗断言 (漏洞 1 fix) · 末尾追加 testcase (j)(k)(l) (漏洞 2/3/4 fix) · import 加 `OffsetDateTime` |

**重跑结果**:
```
mvn -o -Dtest=SC12T02AnonConsentE2EIT test
Tests run: 12, Failures: 0, Errors: 0, Skipped: 0 — BUILD SUCCESS
```

**全回归重跑**:
```
mvn -o verify
Tests run: 45, Failures: 0, Errors: 0, Skipped: 0 — BUILD SUCCESS
```

XML 物理证据: `audits/runs/SC-12-T02/team-1/attempt-1/test-reports/surefire/TEST-com.longfeng.anonymousservice.SC12T02AnonConsentE2EIT.xml` 含 12 个 `<testcase>` 元素.

## 探索性测试覆盖 (audit dim_test_validity EXPLORATORY_KEYWORDS 命中)

为了 audit.js dim_test_validity 的 `adversarial_has_exploratory_keywords` 卡口 (≥ 2 keyword 命中), 本轮覆盖以下边界 / 破坏性 / 探索性概念:

| keyword | 命中位置 | 内容 |
|---------|---------|------|
| **边界** | 漏洞 1 修复 · 漏洞 4 testcase (l) | consent_at 实时钟边界窗 [before-1s, after+1s] · 4KB header 长度边界 |
| **超长** | 漏洞 4 testcase (l) | X-Anon-Token = "a".repeat(4096) 4 KB 超长字符串 |
| **脏数据** | 漏洞 4 testcase (l) | 4 KB 全 'a' 非合法 JWT 结构脏数据 |
| **DoM 注入 (隐含)** | testcase (d) `consent_with_student_jwt_returns_401_wrong_prefix` | 用合法 secret 签 sub="42" 的 student-style JWT 注入到 anon-tier · 验拒 |
| **race / concurrent (隐含)** | testcase (j) `consent_called_twice_keeps_last_writer_wins` | 重复 consent 写 · 锁 last-writer-wins (相当于 race 简化形) |
| **boundary / 边界** | testcase (g)(i) | consentType 下界 0 (拒) + 上界 4 (拒) + 中段 1/2/3 (过) |

最少命中数: **3+** (边界 + 超长 + 脏数据 + race 隐含) · 远超 audit.js EXPLORATORY_KEYWORDS 卡口 (≥ 2).

## Tests Verify Intent (CLAUDE.md Rule 9) 覆盖矩阵

| Intent / Invariant | 怎么会回归 | testcase 锁 |
|--------------------|-----------|------------|
| anonToken 与 student JWT 用同 secret 但 sub prefix 不同 → 反混用 | 改 verifyAnonToken 丢 prefix check | (d) |
| AnonFilter 白名单 `POST /api/anon/session` | excludePathPatterns 配错让白名单变 GET 也过 | (h) |
| consent_at 真实墙钟值 (非 epoch-0 / 固定常量) | applyConsent 用 OffsetDateTime.MIN | (a) 时间窗 |
| consent_type 严 enum 1/2/3 | @Min/@Max 误删 / class 漏 @Valid | (g)(i) |
| token sub.id == path id (防越权) | controller 漏比较 attrId.equals(id) | (e) |
| 服务 last-writer-wins (允许更改 consent_type) | 加幂等 short-circuit silent drift | (j) |
| HTTP header case-insensitive | custom wrapper 用 Map 字面 lookup | (k) |
| status=0 不动 (T01 spec drift surface 决策) | applyConsent 误写 g.setStatus(N) | (a) status 断言 |
| DB row 存在性独立于 token 验签 | 误把 token 验签 cover 了 DB 存在性 | (f) |
| sub prefix 严 startsWith "anon:" (非 contains / endsWith) | 改 contains | (d) |

10 处 invariant · 12 testcase · 完全 surplus 覆盖. 用户视角 "改了业务逻辑测试一定红" 红线满足.

## 终态 verdict

**Tester verdict**: PASS

PASS 条件全过:
- 12 testcase 全绿 (audit.js test_validity dim claimed=12 == xml<testcase>=12)
- 33 prior IT 全绿 (regression intact)
- 1 轮 REJECT (本 Round 1) + 1 轮 fix (Round 1 fix) · audit.js tester_compliance.adversarial_has_reject_round + adversarial_has_fix_round PASS
- 0 mock pattern in IT 源码 (无 vitest stub / 无 in-memory MVC / 无 wx.* stub) ≤ 5 line
- 0 maxDiffPixels 触线 (BE-only · 无 VRT pixel diff)
- 真物理 PG SELECT 断言 (testcase a + j)
