# PHASE-A-LOGIN-H5 · team-1 · attempt-2 · adversarial.md

---

## Round 1 · REJECT

**发现时间**: 2026-05-17T00:12+04:00
**严重度**: Medium (spec 功能偏差)
**文件**: `frontend/apps/h5/src/pages/Auth/Login.tsx` line 275-279

### Bug 描述

Inflight scope_in #12 明确要求:
> "ConsentBar 必勾才能点登录 · 未勾 → 主 CTA disabled (opacity 50%) + **tap 时 toast「请先同意服务条款与隐私政策」**"

实际行为: CTA 按钮使用 HTML `disabled` 属性, 导致 DOM 事件被浏览器拦截, onClick 永不触发, 用户 tap 时无 toast 反馈。

### 复现

```bash
# Playwright 验证 (adversarial-consent.spec.ts)
# 1. 打开 /auth/login
# 2. 填入 email + password, 不勾 consent
# 3. 点击 CTA → 无反馈 (Button disabled: true)
# 预期: 显示 toast "请先同意服务条款与隐私政策"
```

### 根因

`Login.tsx` 使用 `disabled={!canSubmit}` → HTML disabled 属性阻止所有 pointer events → onClick 永远不触发 → handleSubmit 中 lines 74-77 的 consent toast 逻辑不可达。

---

## Round 1 · FIX

**修复时间**: 2026-05-17T00:14+04:00
**修复人**: Tester (single-pass workflow)

### 改动

1. `Login.tsx`: 移除 `disabled={!canSubmit}` → 改为纯 CSS class `${!canSubmit ? s.btnDisabled : ''}`
2. `Login.module.css`: `.btnPrimary[disabled]` → `.btnDisabled` (opacity 0.5 + cursor not-allowed)

### 验证

```
✓ FIX VERIFY: tap CTA without consent → toast appears (612ms)
✓ FIX VERIFY: happy path still works (787ms)
✓ Full regression: 4/4 login.spec.ts PASS
```

---

## 探索性测试 (login-adversarial.spec.ts · 4 cases 全绿 · Playwright 物理验证)

### E1 · 连点防抖 (rapid clicks / race condition)

快速 triple-click CTA 按钮 (无 delay)。React state machine `authState === 'VERIFYING'` 成功阻断后续请求, 实际只发 ≤2 次网络请求 (handleSubmit L87: `if (authState === 'VERIFYING') return` guard)。导航至 /home 正常。

**为什么相信能抓回归**: 若 debounce guard 被移除或 authState 管理改动, 会发多次请求导致 assertion `requests.length <= 2` 失败。

### E2 · 注入/超长 (XSS script + 1000-char email)

在 email input 填入 1000 字符 + password 填入 `<script>alert("xss")</script><img src=x onerror=alert(1)>`。React JSX 自动转义 (innerHTML 中显示为 `&lt;script&gt;` 而非执行)。0 个 `alert()` dialog。后端返 graceful error, 页面不崩溃。

**为什么相信能抓回归**: 若前端改用 `dangerouslySetInnerHTML` 渲染 error message 或 email echo, XSS 将执行。

### E3 · SQL注入 (parameterized query defense)

email 填入 `' OR '1'='1'; DROP TABLE auth_user; --`。后端返回 401 (非 500)。查询 auth_user 表仍存在 + 1 row fixture intact。JPA parameterized query 防护有效。

**为什么相信能抓回归**: 若 repository 改用 native SQL 拼接 (e.g. `@Query(nativeQuery)` + string concat), SQL 将注入成功, table 被 drop, 最后一个 assertion `SELECT count(*) FROM auth_user` 将失败。

### E4 · 阻断网络 (abort inflight / race recovery)

通过 `page.route abort('connectionfailed')` 模拟网络故障。前端 catch block (L134-135) 正确显示 "网络不可用，请检查后重试"。unroute 后再次提交 → 登录成功导航 /home。状态机从 FAILED 正确恢复到 IDLE → VERIFYING → SUCCESS。

**为什么相信能抓回归**: 若 catch block 被移除或 authState 卡在 VERIFYING 不恢复 (忘记 setAuthState('FAILED')), 用户将永远无法重试。

---

## 最终裁定: PASS

- ≥ 1 轮 REJECT ✅ (consent toast spec violation)
- ≥ 1 轮 fix ✅ (disabled → CSS class)
- 全量 4+4+4 = 12 testcase 绿 ✅
- 探索性关键词覆盖: 连点 ✅ · 注入 ✅ · 超长 ✅ · SQL ✅ · 阻断 ✅ · race ✅
- 浏览器 Console 0 [error] ✅
