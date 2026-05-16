# PHASE-A-LOGIN-H5 · team-1 · attempt-1 · tester.md

**Task**: P00 邮箱+密码 登录全栈链路 (h5 端) 验收
**Tester**: Tester agent (Opus 4.6 1M-ctx)
**Branch**: `claude/nifty-kepler-3deb2c`
**Date**: 2026-05-17

---

## 1. DoR 准入检查

| # | 检查项 | 结果 |
|---|--------|------|
| DoR-1 | E2E 脚本存在 `frontend/apps/h5/tests/e2e/auth/login.spec.ts` | ✅ PASS |
| DoR-2 | junit.xml + index.html 真实存在 · 4 testcase 0 failures | ✅ PASS (⚠️ 无独立 .log 文件) |
| DoR-3 | screenshots/ 目录 | ⚠️ 缺失 (inflight `dor_c1_to_c6_required: false` 松绑) |
| DoR-4 | coder.md §3.2 trace 对照表 | ✅ PASS |

`physical_verification.dor_c1_to_c6_required: false` → 准入通过, 进入正式测试。

---

## 2. 独立物理验证

### 2.1 后端 IT (独立运行)

**命令**: `cd backend/auth-service && mvn verify`
**结果**: `BUILD SUCCESS` · Tests run: 4, Failures: 0, Errors: 0, Skipped: 0 · Time: 15.84s
**验证**: 4 个 testcase 对齐 inflight scope_in #15 (happy / wrong_password / non_existent_email / 5_strike_lockout)

### 2.2 前端 Playwright (独立运行)

**前置**: 手动启动 auth-service (:8091 · `/actuator/health` → UP) + vite dev (:5174 → 200)
**命令**: `pnpm exec playwright test tests/e2e/auth/login.spec.ts --reporter=list`
**结果**: 4 passed (6.1s)
**验证**: 4 个 testcase 对齐 inflight scope_in #14

### 2.3 浏览器 Console 检查

**命令**: 自编 console-check.spec.ts 在 happy 流程中捕获所有 console 消息
**结果**: 0 `[error]` · 2 `[warning]` (React Router v7 Future Flag — 标准 deprecation, 非 error)
**结论**: 满足 PASS 定义 §2 "真浏览器 Console 零 [error]"

### 2.4 Git commits 验真

```
git cat-file -e 3cdb81d → EXISTS
git cat-file -e ce93117 → EXISTS
git cat-file -e e63bab5 → EXISTS
git cat-file -e d7e86dc → EXISTS
```

### 2.5 反作弊审查

- ✅ E2E 脚本无 `page.route` mock 真后端
- ✅ E2E 脚本无 `vi.mock` / `jest.mock`
- ✅ `maxDiffPixels` 未使用 (无 VRT 在此 spec)
- ✅ IT 真接 sandbox PG:15432 + Redis:16379 (无 H2/embedded)
- ✅ `resetFixture()` 用 `docker exec team-1-pg psql` 真 DB reset

---

## 3. 测试结果汇总

| 来源 | testcase 数 | 通过 | 失败 |
|------|:-----------:|:----:|:----:|
| Maven Failsafe IT (后端) | 4 | 4 | 0 |
| Playwright E2E (前端) | 4 | 4 | 0 |
| **合计** | **8** | **8** | **0** |

---

## 4. 对抗轮次 → 见 adversarial.md

Round 1: REJECT (consent toast spec violation) → fix applied → re-verify PASS.

---

## 5. 宣判

**PASS** — 8 testcase 全绿 · 1 轮对抗修复完成 · 浏览器 0 [error] · git commits 验真 · 无 mock 作弊。
