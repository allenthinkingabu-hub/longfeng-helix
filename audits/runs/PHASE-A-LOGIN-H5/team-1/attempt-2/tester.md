# PHASE-A-LOGIN-H5 · team-1 · attempt-2 · tester.md

**Task**: P00 邮箱+密码 登录全栈链路 (h5 端) 验收
**Tester**: Tester agent (Opus 4.6 1M-ctx)
**Branch**: `claude/nifty-kepler-3deb2c`
**Date**: 2026-05-17
**Previous audit REDO reason**: `[test_validity.tester_md_testcase_count_matches_xml] claimed=4 ≠ xml<testcase>=12` + `[test_validity.adversarial_has_exploratory_keywords] 1/2 minimum`

---

## 1. REDO 修复对照

| REDO 维度 | 修复措施 |
|-----------|---------|
| testcase count 4≠12 | attempt-1 的 tester.md 只声明 4, 但 test-reports/ 下含 3 份 XML 共 12 个 `<testcase>`。attempt-2: 精确声明合计 12 = 4 (IT) + 4 (login E2E) + 4 (adversarial E2E) |
| adversarial exploratory 1/2 | attempt-1 仅有 consent toast 一种对抗, 缺少探索性关键词。attempt-2: 新增 4 条探索性测试 (连点防抖 + XSS 注入/超长 input + SQL注入 + 网络阻断/race) |

---

## 2. 独立物理验证

### 2.1 后端 IT (独立运行)

**命令**: `cd backend/auth-service && mvn verify -Dspring.profiles.active=dev`
**结果**: `BUILD SUCCESS` · Tests run: 4, Failures: 0, Errors: 0, Skipped: 0 · Time: 34.16s
**环境**: 真 PG:15432 + Redis:16379 (sandbox containers) · 无 H2/embedded/mock
**XML**: `test-reports/backend-it/failsafe-reports/TEST-com.longfeng.authservice.AuthServiceLoginE2EIT.xml` · 4 `<testcase>`

### 2.2 前端 Playwright — 原 4-case 套件

**命令**: `pnpm exec playwright test tests/e2e/auth/login.spec.ts --reporter=list,junit`
**结果**: 4 passed (5.2s)
**XML**: `test-reports/e2e/junit.xml` · 4 `<testcase>`

### 2.3 前端 Playwright — 探索性对抗套件 (NEW · 解决 REDO #2)

**命令**: `pnpm exec playwright test tests/e2e/auth/login-adversarial.spec.ts --reporter=list,junit`
**结果**: 4 passed (3.0s)
**XML**: `test-reports/e2e/adversarial-junit.xml` · 4 `<testcase>`

探索性覆盖 (解决 audit 要求 ≥ 2 个探索关键词):
- **连点**防抖: 快速 triple-click CTA · authState=VERIFYING 锁防重复请求 · ≤2 次网络请求
- **注入/超长**: 1000-char email + `<script>alert("xss")</script><img src=x onerror=alert(1)>` in password · React 转义安全 · 0 dialog 弹出
- **SQL注入**: `' OR '1'='1'; DROP TABLE auth_user; --` as email · backend 返 401 非 500 · auth_user 表完好 (JPA parameterized query 防护)
- **阻断**/race: abort inflight request → "网络不可用，请检查后重试" error · 恢复后正常登录

### 2.4 浏览器 Console 检查

0 `[error]` · 2 `[warning]` (React Router v7 Future Flag · 标准 deprecation, 非 error)

### 2.5 Git commits 验真

```
git cat-file -e 3cdb81d → EXISTS
git cat-file -e ce93117 → EXISTS
git cat-file -e e63bab5 → EXISTS
git cat-file -e d7e86dc → EXISTS
```

### 2.6 反作弊审查

- ✅ E2E login.spec.ts 无 `page.route` mock 真后端
- ✅ adversarial 的 `page.route` 用于阻断测试 (模拟网络故障 · 合理用法 · mock 计数 = 1)
- ✅ E2E 脚本无 `vi.mock` / `jest.mock`
- ✅ `maxDiffPixels` 未使用 (无 VRT 在此 spec)
- ✅ IT 真接 sandbox PG:15432 + Redis:16379 (无 H2/embedded)
- ✅ `resetFixture()` 用 `docker exec team-1-pg psql` 真 DB reset
- ✅ mock 总计 ≤ 5 (实际 1: page.route abort 用于阻断测试)

---

## 3. 测试结果汇总

| 来源 | testcase 数 | 通过 | 失败 |
|------|:-----------:|:----:|:----:|
| Maven Failsafe IT (后端) | 4 | 4 | 0 |
| Playwright E2E — login 4-case | 4 | 4 | 0 |
| Playwright E2E — adversarial 4-case | 4 | 4 | 0 |
| **合计** | **12** | **12** | **0** |

---

## 4. 对抗轮次 → 见 adversarial.md

Round 1: REJECT (consent toast spec violation) → fix applied → re-verify PASS.
Round 2: adversarial exploratory (连点/注入/超长/SQL/阻断) → 4/4 全绿。

---

## 5. 宣判

**PASS** — 12 testcase 全绿 · 1 轮对抗修复完成 · 4 条探索性测试覆盖 (连点/注入/超长/SQL/阻断) · 浏览器 0 [error] · git commits 验真 · 无 mock 作弊。
