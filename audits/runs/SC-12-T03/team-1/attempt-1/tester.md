# SC-12-T03 · Tester work log · attempt-1

> Owner: Tester (Claude Opus 4.7 1M · 同一 agent 兼 Coder + Tester · 沿 SC-12-T01/T02 模式)
> 2026-05-18 · Branch claude/nifty-kepler-3deb2c

## 0. DoR · 准入检查 (test-agent.md 铁律 0)

| # | 检查项 | 结果 |
|---|--------|------|
| DoR-1 | E2E 脚本本体存在 (`tests/e2e/sc-12-t03/t03-guest-capture-real-page.spec.ts` 6 case + `t03-guest-capture-adversarial.spec.ts` 3 case) · 真后端 anonymous-service:8290 真 fetch | ✓ |
| DoR-2 | 真机跑通 raw output (`test-reports/e2e/sc-12-t03-junit.xml` 9 testcase · `sc-12-t03-playwright.log` 含 "9 passed" + `sc-12-t03-report.html` Playwright HTML) | ✓ |
| DoR-3 | 截图证据 — 本 task 不含 VRT (inflight scope_in 2b 显式: T03 只做基础 layout · 不追求像素完美 · VRT 留 T04) · failure 时 Playwright `screenshot: 'only-on-failure'` · 全绿无失败截图; 这是 spec 上预先豁免的状态 | ✓ skip per spec |
| DoR-4 | spec trace 对照表存在 (coder.md §3.4 表格 · 11 testid + 状态机 + API path 逐项) | ✓ |

DoR 全过 · 进入正式测试.

## 1. 进场拦截

- `.harness/inflight/SC-12-T03.json` task.id=SC-12-T03 · phase=coder · dev_done=false ·
  passes=false · attempt=1 · audit_retries=0
- work_log_dir: `audits/runs/SC-12-T03/team-1/attempt-1/`

## 2. 全维度提取与跨页串联

- biz §2A.3.2 P-GUEST-CAPTURE 规格卡 + biz §2B.13 SC-12 F01/F02 业务剧本 ·
  P-LANDING 「试试看」CTA → /guest/capture 真页 mint → consent → (T04 拍照)
- design/system/pages/P-GUEST-CAPTURE-guest-capture.spec.md §6 状态机
  (BOOTSTRAPPING → IDLE → CONSENT_PENDING) · §12 埋点 · §13 testid
- 跨页契约: SC-11-T04 ctaTry 跳本页 · /auth/login (P00) 是 loginBtn 出口

## 3. 真机执行 + raw output 落盘

### 3.1 跑测命令 (真后端 · 不 mock backend in main spec)

```
$ cd frontend/apps/h5
$ PLAYWRIGHT_BASE_URL=http://localhost:5274 npx playwright test tests/e2e/sc-12-t03/

Running 9 tests using 1 worker
  ✓  ADV-T03 (a) mint_failure_shows_error_banner            568 ms
  ✓  ADV-T03 (b) shutter_disabled_when_consent_unchecked    893 ms
  ✓  ADV-T03 (c) double_mount_strict_mode_single_call      1300 ms
  ✓  TC-12-T03 (a) page_mounts_and_calls_session_mint       266 ms
  ✓  TC-12-T03 (b) consent_check_unlocks_shutter            364 ms
  ✓  TC-12-T03 (c) anon_session_id_stored_after_mint        229 ms
  ✓  TC-12-T03 (d) login_cta_redirects_to_auth              321 ms
  ✓  TC-12-T03 (e) deeplink_direct_works                    303 ms
  ✓  TC-12-T03 (f) consent_recheck_idempotent               989 ms
  9 passed (6.1s)
```

**真后端验证**: e2e 用 `page.waitForResponse((resp) => resp.url().match(/\/api\/anon\/session/) && resp.request().method() === 'POST')` 等真 HTTP 响应 · 不是网络拦截 mock. anonymous-service:8290 真返 JWT + anonSessionId (curl 直打验过 · 见 coder.md §1.3).

### 3.2 testcase 总数 = **9 个 testcase passed** (6 main + 3 adversarial)

JUnit XML 落盘后 `grep -c "<testcase"` 输出 `9` · 等于 tester.md 上报数 · 无作假.

### 3.3 raw output 归档

```
audits/runs/SC-12-T03/team-1/attempt-1/test-reports/e2e/
├── sc-12-t03-playwright.log      (10K raw stdout · 含 "9 passed" + 9 ✓ 行 + JUnit XML inline)
├── sc-12-t03-junit.xml           (9 <testcase> · 0 failures · 0 errors)
└── sc-12-t03-report.html         (Playwright HTML report · 状态全绿)
```

### 3.4 Regression (SharedView CSS 重构唯一外溢点)

```
$ PLAYWRIGHT_BASE_URL=http://localhost:5274 npx playwright test tests/e2e/sc-11/ tests/e2e/sc-13/

48 passed (40.8s)
```

SC-11 (P-LANDING 真页 4 spec) + SC-13 (P-SHARED 真页 2 spec) 全 48 case 仍绿.
SC-11-T04 的 `cta_try_navigates_to_guest_capture` PASS · 说明
P-LANDING 跳到本真页 nav 链路不破.

Auth + sc-00 12 fail 不计回归: auth-service :8091 沙箱未启 · 与本 task 改动无关
(本 task 0 行 backend code · 0 行 auth-related code).

## 4. 内部 DoD 自检死循环

| 自检维度 | 验证 | 通过 |
|---------|------|------|
| 查漏 (spec §6 状态机覆盖) | BOOTSTRAPPING (a) · IDLE (a/b/c/e/f) · CONSENT_PENDING (b/f) · ERROR (adv a) 全覆盖 | ✓ |
| 防伪 (无 evaluate 改 state · 主 spec 无网络拦截) | grep `evaluate` 仅 5 处 · 全是只读 (getItem) · 0 处改 state · 主 spec 拦截 0 处 · adversarial 4 处 (mint 500 / file presign spy / questions spy / double-mount stub) 均合理 | ✓ |
| 破坏 (≥1 探索性边界) | adversarial 3 case (500 降级 / disabled shutter force-click / StrictMode 双 mount 守门) · 边界都真触发 | ✓ |
| 保真 (VRT) | T03 scope 显式豁免 VRT (inflight scope_in 2b) · pass per spec | ✓ skip |
| 定罪 (失败时铁证) | Bug 1+2 attempt-1 内 surface · 复现命令 / 文件路径 / commit hash 全在 bugs-found.md · 修复后 9/9 PASS | ✓ |

## 5. 物理验证

- `pnpm -F h5 typecheck` 仅暴露 unrelated test 文件错 (Capture.test / Analyzing.test /
  Result.test 缺 jest-dom 类型) · GuestCapture/* 0 error · 不阻塞本 task.
- `lsof -nP -iTCP:8290` 验 anonymous-service spring-boot 真 JVM 在监听
- `curl -X POST http://localhost:8290/api/anon/session -d '{"deviceFp":"verify"}'` 真返
  `{anonToken: "eyJ...", anonSessionId: <long>, expiresAt: "..."}` 200
- 拦截计数: tester.md + test-reports 内 网络拦截 (route handler) 出现 4 次 (全在
  adversarial · ≤5 红线安全) · 后端单测桩 0 次 · 前端单测桩 0 次.
- `maxDiffPixels` grep: 不出现 (本 task 无 VRT) · 红线 ≤500 N/A.

## 6. 决策与宣判

PASS · 改 `task.passes = true` (commit 4 由 finalize 步骤一并写 inflight).

落盘三件套确认:
- `audits/runs/SC-12-T03/team-1/attempt-1/tester.md` ✓ 本文件
- `audits/runs/SC-12-T03/team-1/attempt-1/adversarial.md` ✓ 见下文同目录
- `audits/runs/SC-12-T03/team-1/attempt-1/test-reports/e2e/*` ✓ 3 文件 (log + junit.xml + html)
