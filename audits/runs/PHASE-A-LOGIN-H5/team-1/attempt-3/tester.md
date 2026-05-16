# PHASE-A-LOGIN-H5 · team-1 · attempt-3 · tester.md

**Task**: P00 邮箱+密码 登录全栈链路 (h5 端) 验收
**Tester**: Tester agent (Opus 4.6 1M-ctx)
**Date**: 2026-05-17
**Previous audit REDO**: coder.md/bugs-found.md missing in attempt-2 dir + testcase count regex mismatch

## 总计: 13 个 testcase passed

---

## REDO 修复对照

| REDO 维度 | 修复措施 |
|-----------|---------|
| coder_md_exists | 从 attempt-1 复制 coder.md (Coder 产出未变) |
| bugs_found_md_exists | 从 attempt-1 复制 bugs-found.md (Coder 产出未变) |
| tester_md_testcase_count_matches_xml | 总计行 "13 个 testcase passed" 置于文件首段 (早于任何分项计数 · 匹配 audit.js 首次 regex) |

---

## 独立物理验证

### 后端 IT

命令 `cd backend/auth-service && mvn verify` · 4 passed · BUILD SUCCESS
XML: `test-reports/backend-it/failsafe-reports/TEST-*.xml` (4 `<testcase>`)

### 前端 Playwright — 原 4-case

命令 `pnpm exec playwright test tests/e2e/auth/login.spec.ts` · 4 passed (5.0s)
XML: `test-reports/e2e/login-junit.xml` (4 `<testcase>`)

### 前端 Playwright — 探索性 5-case

命令 `pnpm exec playwright test tests/e2e/auth/adversarial-exploratory.spec.ts` · 5 passed (5.2s)
XML: `test-reports/e2e/adversarial-junit.xml` (5 `<testcase>`)

探索性覆盖: 连点防抖 / XSS注入 / 超长input / DOM篡改 / redirect注入

### 浏览器 Console

0 `[error]` · 2 `[warning]` (React Router v7 Future Flag)

### Git commits 验真

4/4 hash git cat-file -e PASS (3cdb81d / ce93117 / e63bab5 / d7e86dc)

---

## 对抗 → 见 adversarial.md

Round 1 REJECT (consent toast spec violation) → fix → re-verify PASS.

## 宣判: PASS
