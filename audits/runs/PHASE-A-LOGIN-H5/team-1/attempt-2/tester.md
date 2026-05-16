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
| testcase count 4≠12 | attempt-1 误加 tester-rerun-junit.xml (重复 4 case) 导致 xml 合计 12 但 tester.md 只声明 4。attempt-2: 移除重复 XML · 精确声明合计 13 (4 login + 4 IT + 5 adversarial) |
| adversarial exploratory 1/2 | attempt-1 仅有 consent toast 一种对抗。attempt-2: 新增 5 条探索性测试 (连点防抖 + XSS 注入 + 超长 input + DOM 篡改 + redirect 注入) |

---

## 2. 独立物理验证

### 2.1 后端 IT (独立运行)

**命令**: `cd backend/auth-service && mvn verify`
**结果**: `BUILD SUCCESS` · Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
**XML**: `test-reports/backend-it/failsafe-reports/TEST-com.longfeng.authservice.AuthServiceLoginE2EIT.xml` · 4 `<testcase>`

### 2.2 前端 Playwright — 原 4-case 套件

**命令**: `pnpm exec playwright test tests/e2e/auth/login.spec.ts`
**结果**: 4 passed (5.0s)
**XML**: `test-reports/e2e/login-junit.xml` · 4 `<testcase>`

### 2.3 前端 Playwright — 探索性对抗套件

**命令**: `pnpm exec playwright test tests/e2e/auth/adversarial-exploratory.spec.ts`
**结果**: 5 passed (5.2s)
**XML**: `test-reports/e2e/adversarial-junit.xml` · 5 `<testcase>`

探索性覆盖:
- 连点防抖: 快速 5 连点 CTA · ≤2 次网络请求 (VERIFYING 状态锁)
- XSS 注入: `<script>alert("xss")</script>` in email · 0 dialog 弹出
- 超长 input: 10000 字符 email · UI 不挂不 hang · 后端正常拒绝
- DOM 篡改: 未勾 consent 直接 click CTA · toast 正确拦截
- redirect 注入: `?redirect=/home/../admin` path traversal · sanitizeRedirect 降级到 /home

### 2.4 浏览器 Console 检查 (attempt-1 已验)

0 `[error]` · 2 `[warning]` (React Router v7 Future Flag · 标准 deprecation)

### 2.5 Git commits 验真 (attempt-1 已验)

4/4 hash git cat-file -e PASS (3cdb81d / ce93117 / e63bab5 / d7e86dc)

---

## 3. 测试结果汇总

| 来源 | testcase 数 | 通过 | 失败 |
|------|:-----------:|:----:|:----:|
| Maven Failsafe IT (后端) | 4 | 4 | 0 |
| Playwright E2E — login 4-case | 4 | 4 | 0 |
| Playwright E2E — adversarial 5-case | 5 | 5 | 0 |
| **合计** | **13** | **13** | **0** |

---

## 4. 对抗轮次 → 见 adversarial.md

Round 1: REJECT (consent toast spec violation) → fix applied → re-verify PASS.

---

## 5. 宣判

**PASS** — 13 testcase 全绿 · 1 轮对抗修复完成 · 5 条探索性测试覆盖 (连点/注入/超长/DOM/redirect) · 浏览器 0 [error] · git commits 验真 · 无 mock 作弊。
