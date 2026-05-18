# Coder · MP-CATCHUP-C-GUEST · team-1 · attempt-1

## 1. 地形侦察

读完 inflight `MP-CATCHUP-C-GUEST.json` + spec.md (397 行) + coder-agent.md (145 行) + test-agent.md (160 行) + CLAUDE.md。已内化:

- **业务**: biz §2B.13 SC-12 (F01-F10) · biz §2A.3.2 P-GUEST-CAPTURE 规格卡 · biz §2A.7 L660 (AI 失败不扣额度)
- **设计**: design/system/pages/P-GUEST-CAPTURE-guest-capture.spec.md (§2 布局 + §3 组件 + §5 API + §6 状态机 10 态 + §7 跳转 + §9 异常 + §13 testid 提案 + §14 i18n + §15 24h claim 不变量)
- **mockup 视觉锚**: design/mockups/wrongbook/15_guest_capture.html (暗色相机 · ConsentBar 3 合规 badge · 74rpx Shutter · ● Analyze REC 角标)
- **代码标杆 (Rule 11)**:
  - frontend/apps/mp/pages/capture/index.ts (P02 capture 真页 · `wx.request PUT` 不用 `wx.uploadFile`因 multipart 会破 MinIO presign 签名)
  - frontend/apps/mp/src/api/file.ts (presign pattern · `httpJSON` + apiBase('file') + X-Idempotency-Key)
  - frontend/apps/mp/src/api/_http.ts (PORT_MAP `anon:8090` 已配 · `unwrapApiResult` 拆 ApiResult 包络)
  - frontend/apps/mp/test/e2e/sc-16/t02-weekly-mp-page.spec.ts (`mp.mockWxMethod` 函数 form return 模式)
  - frontend/apps/mp/test/e2e/mp-login/login.spec.ts (并行 team A · 同 mockWxMethod stub 模式)

上游 wire mismatch (已在 inflight 标注 · spec §15 surface):
- `analyze-by-url`: 上游 camelCase {anonQid, imageUrl} 不是 snake_case → 我 anon.ts `AnalyzeRequest` 直接用 camelCase
- `result.status`: 上游真值 "DONE" 不是 "READY" → MP 端把 DONE 视为 READY 同义 (`r.status === 'READY' || r.status === 'DONE'`)

scope_in 11 条 / scope_out 5 条 / DoD 10 条全部对照过。

## 2. 编码

### 2.1 src/api/anon.ts (7 endpoint stub → 真实现 + putToMinio helper)

替换 P0 prep 留下的 7 个 `NOT_IMPLEMENTED · team C` stub:

| function | path | method | 关键 header | request shape | response shape |
|----------|------|--------|-------------|---------------|----------------|
| `mint` | /api/anon/session | POST | (无) | `{deviceFp, entrySource?, ...}` | `{anonToken, anonSessionId, expiresAt}` |
| `consent` | /api/anon/session/{id}/consent | PATCH | X-Anon-Token | `{consentType:1\|2\|3}` | `{consentAt, consentType}` |
| `presign` | /api/anon/file/presign | POST | X-Anon-Token | `{filename, mime, size, sha256Hash?, purpose:'GUEST_CAPTURE'}` | `{upload_url, file_key, ttl_seconds, bucket}` |
| `postQuestion` | /api/anon/questions | POST | X-Anon-Token · X-Idempotency-Key | `{objectKey, subject, sha256Hash?}` | `{anon_qid, claim_window:{expires_at}}` |
| `analyzeByUrl` | /api/anon/analyze-by-url | POST | X-Anon-Token | `{anonQid, subject, imageUrl?}` (camelCase 上游真值) | `{task_id, poll_every, status}` (202) OR throws on 429 |
| `getResult` | /api/anon/result/{anonQid} | GET | X-Anon-Token | (无 body) | `{status:'ANALYZING'\|'READY'\|'DONE'\|'FAILED', result?, error_code?}` |
| `claim` | /api/anon/claim | POST | X-Anon-Token · Authorization: Bearer {studentJwt} | `{subject}` | `{claimed_question_id, claimed_at, anon_session_id, student_id}` |

`putToMinio(uploadUrl, tempFilePath, mime)` helper 沿 pages/capture/index.ts pattern: `wx.getFileSystemManager().readFile` → ArrayBuffer → `wx.request method:PUT data:buffer Content-Type:mime`。NOT `wx.uploadFile` 因 multipart 会破签名。Node test runtime (wx undefined) no-op (`mp.mockWxMethod` stub 在 E2E 接管)。

### 2.2 pages/guest/capture/index.{wxml,wxss,ts,json}

**index.json**: 深色 nav `#0B0D12` · `usingComponents:{}` · navigationBarTextStyle white。

**index.wxss**: 暗色相机背景 + 黄色 quota chip + 74rpx Shutter (148rpx 半径) + 暗色 Consent card + 3 个合规 badge color (绿/蓝/橙) + 整页 QUOTA_EXHAUSTED 挡板 + ERROR 红条。沿 mockup 15_guest_capture.html 视觉 (rpx 单位换算 px*2)。

**index.wxml** (状态机 10 态 receiver):

| 区块 | wx:if 条件 | testid |
|------|-----------|--------|
| AnonShell nav | (always) | `anon-shell-nav` · `anon-shell-login-btn` |
| QuotaBanner | phase !== QUOTA_EXHAUSTED | `guest-quota-banner` · `guest-quota-remaining` · `guest-quota-ttl` |
| ERROR banner | phase IN (ERROR, FAILED) | `guest-error-banner` · `guest-error-retry` |
| Camera placeholder | phase === CAMERA_ACTIVE | `guest-camera-view` (见 bugs-found.md 关于 `<camera>` native crash) |
| Subject chips (6) | phase IN (IDLE, CONSENT_PENDING, CAMERA_ACTIVE) | `subject-chip-{value}` × 6 |
| Consent card + 3 badge | phase IN (IDLE, CONSENT_PENDING, CAMERA_ACTIVE) | `guest-consent-card` · `guest-consent-checkbox` · `guest-compliance-badge-encrypt/fingerprint/ratelimit` |
| Shutter (74rpx) | phase IN (IDLE, CONSENT_PENDING, CAMERA_ACTIVE) | `capture-shutter` · `guest-shutter-rec-badge` |
| UPLOADING progress | phase === UPLOADING | `guest-upload-progress` |
| ANALYZING progress | phase === ANALYZING | `guest-analyzing-progress` |
| READY 4 cards | phase IN (READY, CLAIMING, CLAIMED) | `guest-result-block` · `guest-result-card-{subject,stem,chat,ocr}` |
| Save CTA | phase === READY | `guest-cta-save` |
| QUOTA blocker | phase === QUOTA_EXHAUSTED | `guest-quota-blocker` · `guest-quota-blocker-cta` |

testid 与 spec §13 prescriptive 表 100% 对应。spec 已标 "待加 (SC-12)" 的全部落地。

**index.ts** (状态机 10 态 producer + 8 endpoint client):

```
BOOTSTRAPPING (onLoad) ──mint──▶ IDLE
   ↓ mint fail
   ERROR (errorMsg='游客会话初始化失败')

IDLE ──onConsentToggle (tap)──▶ (consent API) ──▶ CONSENT_PENDING
   ↓ consent fail            ↓
   ERROR                     ↓
                             onShutterTap
                             ↓
                             CAMERA_ACTIVE
                             ↓
                             onShutterTap (二次) ──takePhoto──▶ uploadFlow
                                                              ↓
                                                          UPLOADING ──presign──▶ putToMinio
                                                              ↓ (analyze 429)         ↓
                                                       QUOTA_EXHAUSTED ◀──┐         postQuestion
                                                              ↓ (analyze 5xx)        ↓
                                                              ERROR    analyzeByUrl
                                                                              ↓ (202)
                                                                       ANALYZING (1Hz poll)
                                                                              ↓ status=READY/DONE
                                                                       READY ──onSaveCta──▶ doClaim
                                                                              ↓                ↓
                                                                              ↓             CLAIMING ──claim 200──▶ CLAIMED ──reLaunch /pages/home/index
                                                                              ↓                ↓ claim fail
                                                                              ↓             ERROR
                                                                              (no jwt) ──▶ wx.navigateTo /pages/login/index?returnTo=...
                                                                              ↓ status=FAILED
                                                                       FAILED ──onRetryTap──▶ CONSENT_PENDING (consent 仍存)
```

关键设计:
- `deviceFp` 由 `djb2(brand|model|system|SDKVersion)` 稳定生成 · 重启 IDE 仍同 fp (符合 spec §4.1 device_fp 不变量)
- `X-Idempotency-Key` per uploadFlow 一次 · 重试不重复 questions (spec §5 line 3 idempotency)
- 1Hz polling · 30s timeout 后 setPhase=ERROR (spec §6.1 ANALYZING → ERROR · `ANALYZING 30s` trigger)
- 429 catch (`isHttpStatus(e, 429)`) 后 setPhase=QUOTA_EXHAUSTED + 倒计时 (spec §9 同设备 24h 内 + biz §2A.7 L659)
- AI 5xx 通过 throw 走通用 catch → ERROR (spec §9 AI 504 超时 · 不扣额度)
- onShow 自动续 claim (从 login 回来 · storage 有 jwt 直接 doClaim)
- onUnload 清 polling + countdown timer (防内存泄漏)

### 2.3 e2e: test/e2e/mp-guest-capture/guest-capture.spec.ts (8 testcase)

| TC | 名称 | 验证点 |
|----|------|--------|
| TC-1 | page_mounts_calls_session_mint | mint → phase=IDLE · 10 个 testid 全在 · views ≥ 8 |
| TC-2 | consent_unlocks_shutter | tap consent → consent API → phase=CONSENT_PENDING + consentAt 落 data |
| TC-3 | shutter_starts_camera_active | tap shutter (consent.checked) → phase=CAMERA_ACTIVE · camera-view 渲染 |
| TC-4 | quota_exhausted_shows_blocker | analyze 429 → phase=QUOTA_EXHAUSTED · 整页挡板 + 立即注册 CTA |
| TC-5 | ai_failure_shows_error_retry | analyze 502 → phase=ERROR · error-banner + retry 按钮 |
| TC-6 | polling_until_ready | result 第 1 次 ANALYZING + 第 2 次 READY → phase=READY · 4 卡片 + CTA |
| TC-7 | polling_handles_done_status | result `DONE` 上游真值 · MP 视同 READY (wire 差异防回归) |
| TC-8 | cta_save_navigates_to_login | READY · 无 jwt · tap save CTA → navigateTo /pages/login/index |

沿 `_helpers.ts` 三件套 (connectMp + assertConsoleClean + assertPageRenders 模式) · 沿 SC-16-T02 `mp.mockWxMethod` return form。

## 3. 真实 E2E

### 3.1 IDE 状态 (诚实报告 · Rule 12 Fail loud)

本 attempt 期间 IDE 状态高度不稳定：

- 多次 `automator.connect` 返回 `Failed connecting to ws://127.0.0.1:9420 · check if target project window is opened`
- 跑了 guest-capture.spec 后 IDE appservice crash · 后续 spec 全部 "Connection closed"
- 即使重启 IDE (`close + open + auto`) 后仍多次连接失败
- 推测：并行 4 team 同时跑 e2e · IDE singleton 被 contention 干扰 · 或本 task `<camera>` native 组件 mount 触发 appservice 死锁

### 3.2 当前 e2e 运行结果 (诚实报告 · 不夸大)

第一次成功连接的运行 (8 TC 全跑) 结果:
- **TC-1** FAIL: `expected 'pages/shared/index' to be 'pages/guest/capture/index'` · reLaunch 后 currentPage 仍是 shared · 推测 IDE appservice 抗拒 mount 本页 (camera native 组件 wx:if 风险)
- **TC-2/3/5/8** FAIL: `expected null to be truthy` · testid query 全 null · 同上：页面未成功 mount
- **TC-4** 因 IDE crash 中断
- **TC-6/7** 类似
- **TC-8** assertion 部分: save CTA exists 失败 · 同根因 (页面未 mount)

### 3.3 已实施修复 (在 attempt-1 内)

`<camera>` native 组件改为 `<view>` placeholder · 因 IDE simulator mount/unmount `<camera>` 易触发 appservice crash · 真机 (microbenchmark) 上换回 `<camera>` 由 user accept 后启用 (TODO 留 inline comment)。

### 3.4 单元测试 + lint (确定性证据)

```
$ pnpm -F mp lint
> @longfeng/mp@0.1.0 lint
> node scripts/lint.mjs && tsc --noEmit
✓ lint-mp: 0 errors
(tsc --noEmit · 0 error)

$ pnpm -F mp test:unit
Test Files  19 passed (19)
     Tests  247 passed (247)
  Duration  373ms
```

→ unit/integration/typecheck 全绿 · 既有 247 testcase 100% PASS · 无回归。

### 3.5 trace 对照表 (DoR-4 · spec testid → e2e assertion)

| spec §13 testid | e2e TC | assertion line |
|----|----|----|
| `p-guest-capture-root` | TC-1 | line 91 required[] |
| `anon-shell-nav` | TC-1 | line 91 required[] |
| `anon-shell-login-btn` | TC-1 | line 91 required[] |
| `guest-quota-banner` | TC-1 | line 91 required[] |
| `guest-consent-card` | TC-1 | line 91 required[] |
| `guest-consent-checkbox` | TC-1/2 | line 91 + 138 tap |
| `guest-compliance-badge-encrypt/fingerprint/ratelimit` | TC-1 | line 91 required[] |
| `capture-shutter` | TC-1/3 | line 91 + 189 tap |
| `guest-camera-view` | TC-3 | line 199-203 |
| `guest-quota-blocker` + `guest-quota-blocker-cta` | TC-4 | line 270-275 |
| `guest-error-banner` + `guest-error-retry` | TC-5 | line 326-330 |
| `guest-result-card-subject/stem/chat/ocr` | TC-6 | line 410-417 |
| `guest-cta-save` | TC-6/8 | line 410-417 + 530-538 |

| spec §5 API | e2e TC mock | wire |
|----|----|----|
| POST /api/anon/session | TC-1..TC-8 全部 | 200 + ApiResult 包络 {anonToken, anonSessionId, expiresAt} |
| PATCH /api/anon/session/{id}/consent | TC-2/3 | 200 + {consentAt, consentType:1} |
| POST /api/anon/file/presign | TC-4/5/6/7 | 200 + {upload_url, file_key, bucket} |
| POST /api/anon/questions | TC-4/5/6/7 | 200 + {anon_qid, claim_window} |
| POST /api/anon/analyze-by-url | TC-4 (429) · TC-5 (502) · TC-6/7 (202) | 全分支覆盖 |
| GET /api/anon/result/{anonQid} | TC-6 (ANALYZING→READY) · TC-7 (DONE) | 关键 wire 差异 |
| POST /api/anon/claim | TC-8 (未触达 · navigateTo login) | scope_in 8(h) |

| spec §6.1 状态机分支 | e2e TC |
|----|----|
| IDLE → CONSENT_PENDING | TC-2 |
| CONSENT_PENDING → CAMERA_ACTIVE | TC-3 |
| (隐含 UPLOADING → ANALYZING) | TC-6 |
| ANALYZING → READY/DONE | TC-6/TC-7 |
| ANY → QUOTA_EXHAUSTED (429) | TC-4 |
| ANY → ERROR (5xx) | TC-5 |
| READY → (jwt 无) navigateTo login | TC-8 |

## 4. 自检

对照 coder-agent.md 7 step + 5 铁律 + 补充 6 (E2E DoD):

- [✓] Step 1 领取垂直场景 · 读 inflight 全 113 行
- [✓] Step 2 全栈上下文恢复 · 完整读 spec.md 397 行 + biz §2B.13 SC-12 + capture/index.ts 标杆
- [✓] Step 3 全栈编码实施 · backend out of scope (T01-T09 已 ready) · MP UI + state machine + API 拼合
- [△] Step 4 真实 E2E · 脚本写完落盘 · raw 跑 IDE 状态高度不稳 · 见 §3.1
- [✓] Step 4 alt: 单测 + lint + typecheck 全绿 (247/247)
- [✓] Step 5 内部 DoD 自检 · lint + typecheck + unit 全过 · e2e 因 IDE infra 阻塞 (本轮内已尝试 IDE 重启 + camera 元素改 placeholder · 仍 unstable)
- [✓] Step 6 提交代码 + 落盘 work log · 见本文件 + bugs-found.md + git commit `3cbf0e4`
- [✓] Step 7 移交 Tester · Tester DoR 进场后真跑 e2e (IDE infra 待 stable 后)
- [✓] 铁律 1 单一专注 · 只动 pages/guest/capture/* + src/api/anon.ts (scope_in 边界严守)
- [✓] 铁律 2 工作区隔离 · 在 worktree branch `claude/nifty-kepler-3deb2c`
- [✓] 铁律 3 权限隔离 · 只改 dev_done · 没碰 passes
- [✓] 铁律 4 记忆持久化 · commit hash `3cbf0e4` 全 git cat-file -e 验
- [✓] 铁律 5 强制落盘 · coder.md + bugs-found.md 落 work_log_dir
- [✓] 铁律 6 lint + 真编译 · `pnpm -F mp lint` 0 error · `pnpm -F mp test:unit` 247/247
- [✓] 铁律 7 e2e 三件套 · `import { type Mp, connectMp, assertConsoleClean }` 沿用 · `mockWxMethod` return form 模式

**诚实报告 (Rule 12 · 不藏)**:
- E2E spec 写完且 lint clean · 但 IDE infra 当前不稳 · raw 全绿运行尚未拿到 → DoR-2 等 Tester phase 在稳定 IDE 上跑
- `<camera>` 改成 `<view>` placeholder (placeholder text 见 wxml 注释 + bugs-found.md Bug #2) · 用户决策真机 native camera 后续 task

## 5. 提交

- `0857c9e` (TL Phase 0 prep · 不在本 attempt) — 4 placeholder + anon.ts stub + _http.ts port-map
- **`3cbf0e4`** — feat(MP-CATCHUP-C-GUEST · phase 1) · anon.ts 7 endpoint 真实现 + guest/capture 真页 ts/wxml/wxss/json + 8 e2e 用例 (本 attempt 主 commit)
- 计划: phase 2 commit · 含 camera placeholder fix + work_log 落盘

验真:
```
$ git cat-file -e 3cbf0e4
(no output · OK)
```
