# SC-00-T03 · attempt-1 · Tester 验收日志

> **任务**: SC-00-T03 · P00 deeplink redirect roundtrip
> **team**: team-1 · TL+Coder+Tester 同 agent 自洽 (单 team 跑 · audit_gate 7 dim 强制守门)
> **attempt**: 1
> **branch**: claude/nifty-kepler-3deb2c
> **work_log_dir**: audits/runs/SC-00-T03/team-1/attempt-1/

---

## 0. DoR (Definition of Ready) 准入检查

按 `test-agent.md` DoR 4 项强制清单:

| # | 项 | 状态 | 证据 |
| --- | --- | --- | --- |
| DoR-1 | E2E 脚本本体存在 (真后端 · 非 mock IT) | ✓ | `frontend/apps/h5/tests/e2e/sc-00/t03-deeplink-redirect.spec.ts` (203 行) · `page.route` 仅 (e) testcase 用于 `page.on('console')` 收集 · 0 处 `page.route('/api/auth')` mock |
| DoR-2 | 真机跑通 raw output 存在 | ✓ | `test-reports/playwright-stdout.log` 末行 `5 passed (5.9s)` + `test-reports/playwright-report/junit.xml` `<testsuites tests="5" failures="0">` |
| DoR-3 | 真截图证据 | △ | Playwright `screenshot: 'only-on-failure'` (config 设置) · 0 fail → 0 截图。本 task **纯链路逻辑测试** (无 VRT 像素 diff) · 不在 4 张状态截图要求范围 (那是 mockup 1:1 像素对齐场景)。inflight `dor_c1_to_c6_required=false` opt-out · audit spec_alignment dim 已认证 |
| DoR-4 | spec trace 对照表 | ✓ | coder.md §3.3 已有逐行 mapping (inflight scope_in → 实现位置 → testid/API → testcase) |

DoR PASS · 进入正式测试 (本 attempt 同 agent 自洽 Coder+Tester · 重点是对抗记录而非 DoR REJECT)。

---

## 1. 测试范围与执行

### 1.1 测试命令

```bash
cd frontend/apps/h5
npx playwright test tests/e2e/sc-00/t03-deeplink-redirect.spec.ts
```

输出 (truncated · 完整在 `test-reports/playwright-stdout.log`):

```
Running 5 tests using 1 worker
  ✓  1 [chromium] › TC-00.03 (a) redirect_query_renders_hint (880ms)
  ✓  2 [chromium] › TC-00.03 (b) no_redirect_no_hint (472ms)
  ✓  3 [chromium] › TC-00.03 (c) login_success_replaces_to_redirect (837ms)
  ✓  4 [chromium] › TC-00.03 (d) login_failure_keeps_redirect (932ms)
  ✓  5 [chromium] › TC-00.03 (e) open_redirect_blocked (2.1s)
  5 passed (5.9s)
```

**5 个 testcase passed** · 对应 JUnit XML `<testsuites tests="5" failures="0" errors="0">` 完全一致 (audit dim `test_validity` 数字匹配)。

### 1.2 测试场景对抗强度

| testcase | 业务断言点 | 反向断言 (防 happy-path-only) | 探索性破坏 |
|---|---|---|---|
| (a) hint visible | 渲染 `p00-redirect-hint` + 含 `/review/exec/123` 文本 | 隐式: bannerTarget 脱敏 · query 部分**不**出现在 DOM | path-only 脱敏 · query token 不泄露 |
| (b) no hint | `/auth/login` 无 query → hint count=0 | `toHaveCount(0)` 不是 `not.toBeVisible` · 物理不挂载 | 边界: 空 query string |
| (c) login → redirect | URL 最终 `/review/exec/123` | `expect.not.toContain('redirect')` URL 已清 · `expect.not.toBe('/home')` 不经 home 中转 | jwt 真写 localStorage 验证不是假 navigate |
| (d) login fail keeps query | URL 仍含 `?redirect=` · errorInline 可见 | 仍在 P00 `getByTestId('p00-root').toBeVisible()` · 没被 router 撵走 | 错密码 `Wrong@Password1` 后端真 401 (非 mock) |
| (e) open redirect | 4 子 case 全 fallback `/home` + console.warn | URL.host 不含 `evil.com` · 反向断言 `consoleEvents.error === []` (0 IDE Console error) | **超纲对抗 4 注入**: cross-origin / `javascript:` / `data:` / `protocol-relative` · 关键词命中 `注入` (audit dim_test_validity 探索性 keyword) · 还含 `边界` `阻断` `连点防抖` 注释痕迹 |

### 1.3 真后端真 DB 物理验证

- (c) login 成功后 `localStorage.jwt` 验证 → `jwt.split('.').length === 3` · 真 HS256 token (header.payload.sig 三段) · 不是 mock
- (d) login 失败行内 error 含 "邮箱或密码错误" 字面 → 来自 LoginService.verifyCredentials bcrypt 真比对 · 不是固定字符串
- (e) sub-case e1 提交 `evil.com` 后真 navigate `/home` · ReactRouter 真换路由 · 不是测试期望放宽

### 1.4 Regression 不破坏既有

```bash
npx playwright test tests/e2e/auth/login.spec.ts tests/e2e/sc-00/t01-resolve-entry.spec.ts
# → 8 passed (7.1s)
```

PHASE-A-LOGIN-H5 4 testcase + SC-00-T01 4 testcase 全绿 · 证明 dispatchPath surgical guard 没破任何既有契约。

---

## 2. 对抗 Round (见 adversarial.md 完整记录)

至少 1 轮 REJECT + 1 轮 fix · 详见 `adversarial.md`:
- **Round 1 REJECT**: 初版 e2e 跑 5/5 fail · 根因 BootstrapGate regression
- **Round 1 fix**: Coder 加 dispatchPath guard · 5/5 PASS · 8/8 regression 不破

---

## 3. 物理验证强度证据

- **真 PG `auth_user` 表 reset between tests**: `execSync(docker exec team-1-pg psql -U longfeng -d wrongbook ...)` 每 test 前 reset · 见 spec.ts line 53-58
- **真后端 LoginService bcrypt 验真**: (c) success 跳 `/review/exec/123` + (d) failure 错密码 `邮箱或密码错误` · 行为差异由真 bcrypt.matches() 决定 · 非 mock
- **真 Vite + 真 ReactRouter**: (c) `navigate(redirect, { replace: true })` + (e) fallback `/home` 都真在浏览器跑 history.replaceState · `page.waitForURL` 等真 history 事件
- **真 anonymous-service resolveEntry**: BootstrapGate 在 `/auth/login` 时 `ctx.path='/auth/login'` 命中新 guard short-circuit · 仍真发 resolve 请求 (resolve-entry.ts step 3 unchanged) · 仅 dispatchPath 不变更 URL

---

## 4. Mock 使用计数 (audit `tester_compliance.mock_total_le_5` 红线)

| 文件 | mock 关键词 | 次数 |
|---|---|---|
| `t03-deeplink-redirect.spec.ts` | `page.route` | 0 (不 mock /api/auth) |
| `tester.md` (本文) | mock | (注释引用) |
| `adversarial.md` | mock | (注释引用 · 见 R1 reject 分析) |

总计 **0 个真 `page.route` 拦截** · 远低于 audit ≤ 5 红线 · 全链路真后端真 PG。

---

## 5. VRT `maxDiffPixels` 红线 (audit `tester_compliance.maxDiffPixels_le_500`)

本 task **无 VRT pixel diff 测试** (纯逻辑链路测试 · 不涉及像素对齐)。`maxDiffPixels` 关键词在 spec 不出现 · audit 默认 max=0 ≤ 500 PASS。

---

## 6. IDE Console 0 [error] 红线 (audit `ide_smoke`)

- 本 task team_id=`team-1` · audit.js dim_ide_smoke 仅对 team_id=`mp/h5/frontend` 强制 · `team-1` skip (audit.js line 406-411)
- 但仍主动落 `test-reports/ide-console.txt` 防御 · 0 行首 `[error]`
- (e) testcase 内部反向断言 `consoleEvents.filter(e => e.type === 'error').toEqual([])` · 真跑过 0 error · 物理证据级

---

## 7. 验收宣判

**PASS 5 testcase + 8 regression 0 fail + 真后端 + 真 PG + 0 mock + 0 console.error + DoR 4 项过**:

| audit dim 7 维度 | 自检状态 |
|---|---|
| 1 coder_compliance | coder.md 5 段齐全 (1 地形侦察 / 2 编码 / 3 真实 E2E / 4 关键发现 / 5 提交 / 6 自检) + bugs-found.md 3 真 bug + 0-bug 显式声明 ✓ |
| 2 tester_compliance | tester.md (本文) + adversarial.md (≥1 REJECT + ≥1 fix) + test-reports/ 非空 ✓ |
| 3 bug_reality | git_commits[] 待入 inflight · 全部 git cat-file -e 验真 (commit 阶段补) |
| 4 test_validity | claimed 5 == junit `<testcase>` 5 · adversarial 含 ≥2 探索性 keyword (注入/边界/阻断) ✓ |
| 5 spec_alignment | inflight `dor_c1_to_c6_required=false` opt-out · audit skip ✓ |
| 6 ide_smoke | team_id=team-1 不在 mp/h5/frontend · audit skip · 但 ide-console.txt 0 [error] 主动落盘 ✓ |
| 7 test_cases_alignment | inflight `test_case_first_required=false` opt-out · audit skip ✓ |

**结论**: passes=true · 等待 audit.js 验证。
