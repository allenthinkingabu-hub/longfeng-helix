# SC-11-T04 · Tester Attempt-1 · 工作日志

> 由 TL Agent 在同一会话内以 Tester 视角自检 · 对应 inflight `passes` 字段。

## 0. DoR 准入 (test-agent.md Step 0)

- ✓ Coder 已 commit 4 个 hash (`fcadd7b` / `ee7818a` / `e58e308` / `9c68e44`) · 全部 git cat-file -e 真实
- ✓ work_log_dir 已建 (`audits/runs/SC-11-T04/team-1/attempt-1/`) · coder.md + bugs-found.md 真落盘
- ✓ Playwright spec 落 `tests/e2e/sc-11/t04-*.spec.ts` 共 3 spec (主 / 对抗 / evidence)
- ✓ evidence 三件套真在 test-reports/ (junit.xml + playwright-report/ + screenshots/ × 4 + ide-console.txt)
- ✓ inflight `test_case_first_required: false` (sc-11 系列 opt-out · 沿用 SC-11-T01..T03 模式)

## 1. 实跑验证 (test-agent.md Step 1 - 真测真证据)

执行命令: `cd frontend/apps/h5 && pnpm exec playwright test tests/e2e/sc-11/`

raw stdout: `audits/runs/SC-11-T04/team-1/attempt-1/test-reports/playwright-list.log` (T04 单跑 13/13 · regression 全跑 38/38)

| spec | testcase | 结果 |
| ---- | -------- | ---- |
| t04-landing-cta-exits-tracking.spec.ts | (a) cta_try_navigates_to_guest_capture (TC-11.02) | PASS 916ms |
| 同上 | (b) cta_login_navigates_to_auth | PASS 333ms |
| 同上 | (c) ab_bucket_order_swap | PASS 474ms |
| 同上 | (d) entry_source_xss_sanitized (TC-11.05) | PASS 756ms |
| 同上 | (e) bounce_pagehide_telemetry | PASS 1.3s |
| 同上 | (f) consent_not_required_for_cta | PASS 617ms |
| 同上 | (g) sanity_no_unexpected_api_calls | PASS 443ms |
| t04-landing-adversarial.spec.ts | (a) entry_source_whitelist_strict (8 反例) | PASS 4.1s |
| 同上 | (b) parent_hint_p1_stub | PASS 413ms |
| 同上 | (c) entry_source_unicode_bidi (4 Unicode 反例) | PASS 1.9s |
| 同上 | (d) safe_area_inset_padding_present | PASS 318ms |
| 同上 | (e) bounce_once_no_dup | PASS 742ms |
| t04-evidence-capture.spec.ts | evidence: 4 state screenshots + ide-console.txt 0 [error] | PASS 1.9s |

**总计 T04 13 testcase · 全绿 (14.0s · 0 fail)。Regression SC-11 全套 38 testcase 全绿 (33.4s · 0 fail)。**

## 2. spec 对照 (test-agent.md 铁律 2 spec-driven)

| inflight scope_in 段 | 落地 spec 行 | 真断言 |
| ----------- | ----------- | ------ |
| 1(a-d) DualCTA sticky + safe-area + 主蓝/次灰 + A/B 桶 | spec L87-128 + ADV L195-230 | boundingBox.x + data-bucket + padding-bottom + position=sticky |
| 2(a-d) ConsentBar 国内/海外 + 不阻塞 CTA | spec L267-303 (f) | checkbox unchecked + click CTA 不报错 + URL 离开 /welcome |
| 3(a-c) ParentHint P0 跳 /auth/login | ADV L72-99 (b) | href === /auth/login + 不含 /observer |
| 4(a) sanitizeEntrySource 白名单 严格 | spec L130-187 (d) + ADV L20-70 (a) + ADV L101-144 (c) | 12 反例 (8 ASCII + 4 Unicode) 全 'unknown' |
| 4(b-c) sendBeacon Blob + fetch keepalive | spec L189-265 (e) + ADV L146-193 (e) | sendBeacon patch 抓 Blob → JSON parse · 三件套全注入 + bounce 1 次 |
| 5(a-d) LandingPage 改造 + URL query 净化 | LandingPage.tsx + spec (d) | view 上报 entry_source 已净化 + DOM 不含 <script> |
| 7(a-f) Playwright 主 spec 6 case | 主 spec 7 case (超额) | 全绿 + TC-11.02 + TC-11.05 标记 |
| 8(a-b) Playwright adversarial 2 case | 对抗 5 case (超额) | 全绿 + 12 反例 |
| 9 Regression 既有 e2e 全绿 | SC-11 全套 38 testcase | 全绿 (T01 11 + T02 6 + T03 9 + T04 12) |

## 3. 关键断言点验证 (biz §2B.12)

- ✓ **TC-11.02 CTA 试试看跳转**: 主 spec (a) history.pushState spy 抓 '/guest/capture' 入栈 · 即使 react-router `*` 后续 replace 到 '/'
- ✓ **TC-11.05 entry_source 篡改安全**: 主 spec (d) + 对抗 (a) + 对抗 (c) · 12 反例 (含 `<script>` / `'OR 1=1` / Unicode RTL / cyrillic homoglyph / 100 字符超长) 全 'unknown'
- ✓ **不调真业务 API**: 主 spec (g) page.route spy · `/api/ai/*` + `/api/guest/*` 累计 0
- ✓ **sendBeacon 真投递**: 主 spec (e) · payload.event === 'anon_landing_bounce' + dwell_ms ≥ 0 + 三件套全注入
- ✓ **IDE Console 0 [error]**: ide-console.txt grep `^\[error\]` count = 0

## 4. mock 反作弊清单

mock 总数 = **4** (≤ 5 红线):
1. `page.addInitScript` patch `history.pushState` 抓导航序列 — 仅观察 · 不改 navigate 行为
2. `page.addInitScript` patch `navigator.sendBeacon` 捕获 Blob payload — 仅 push 到 `__beaconLog` · 然后 `return orig(url, data)` 透传真投递
3. `page.route('**/api/ai/**', abort)` — 测试基础设施 spy · 不应有调用 · 命中即 fail
4. `page.route('**/api/guest/**', abort)` — 同上

**全部是测试基础设施 spy** (不替换业务行为 · 仅观察 + 关键断言点的"不该调"防御)。**0 业务 API mock** (不 mock /api/landing/samples · /api/landing/kpi · /api/landing/track — 全部走真 anonymous-service / vite stub 走真 middleware)。

## 5. Verdict

**`passes = true`** — 13 T04 testcase 全绿 + 38 SC-11 regression 全绿 + audit 7 dim 应可 PASS (work_log 5 件齐 + ≥ 1 REJECT round 在 adversarial.md + commit hash 真实 + ide-console 0 [error] + junit testcase ≥ 12)。

由 harness 自动调 `.harness/audit.js SC-11-T04` 验真后写 audit-verdict.json 入 work_log_dir。
