# MP-CATCHUP-B-WELCOME · Coder attempt-1 work log

task_id: MP-CATCHUP-B-WELCOME
team: team-1 / Coder
attempt: 1
phase: coder
commits: d25d6bd, 978c308

---

## 1. 地形侦察

Spec / biz / mockup / reference 全读:

- `design/system/pages/P-LANDING-landing.spec.md` 全文 (§2 布局 + §3 组件 + §5 API + §6 状态机 + §9 异常 + §13 testid)
- `biz §2A.3.2` P-LANDING 规格卡 + `biz §2B.12` SC-11 F01-F07
- `design/mockups/wrongbook/14_landing.html` (视觉锚 · 极光渐变 + sticky CTA dock)
- `frontend/apps/h5/src/pages/Landing/LandingPage.tsx` (React reference · 不复制 · 沿组件 → wxml sections)
- `frontend/apps/mp/pages/me/index.ts` (MP Page 风格 reference)
- `frontend/apps/mp/pages/login/index.wxml` (placeholder 现状)
- `frontend/apps/mp/pages/welcome/index.{ts,wxml,wxss,json}` (Phase 0 0857c9e scaffold)
- `frontend/apps/mp/src/api/_http.ts` (PORT_MAP anon:8090 已加 · httpJSON 已支持 ApiResult unwrap)
- `frontend/apps/mp/src/api/landing.ts` (P0 stub · throws NOT_IMPLEMENTED)
- `frontend/apps/mp/test/e2e/_helpers.ts` (三件套 connectMp + assertConsoleClean + assertPageRenders)
- `frontend/apps/mp/test/e2e/mp-login/login.spec.ts` (team A reference · 同种 mockWxMethod 用法)
- `backend/anonymous-service/.../LandingController.java` + `LandingSampleDto.java` + `LandingKpiDto.java` (真后端 wire shape source of truth)

**关键发现 (surface drift · Rule 7 conflicts surface)**:
inflight `context.api_contracts_in_scope` 描述 KPI shape 为 `{totalStudents, totalQuestions, avgImproveRate}` —
但真后端 `LandingKpiDto` 返 `{cumulativeQuestions, dailyAnalyses, happyUsers}`。
按 CLAUDE.md Rule 11 codebase conventions · 我采纳真后端 wire shape, 不 silent-fork。
此 drift 已在 `src/api/landing.ts` 文件头注 + d25d6bd commit message surface。

后端 sanity check:
- `curl http://localhost:8090/api/landing/kpi` → `200 {"cumulativeQuestions":12500000,"dailyAnalyses":84000,"happyUsers":320000}`
- `curl 'http://localhost:8090/api/landing/samples?bucket=default'` → `200 [3 LandingSampleDto entries]`
- 后端真上线 · LandingController build 自 SC-11-T01 commit

## 2. 编码

5 个改动 (Rule 3 surgical):

| File | 改动 | 行级 |
|------|------|------|
| `frontend/apps/mp/src/api/landing.ts` | stub → 真实现 (getSamples + getKpi · httpJSON GET anon:8090) | +47 -25 (d25d6bd) |
| `frontend/apps/mp/pages/welcome/index.ts` | placeholder Page → 真 Page (Promise.all + .catch(undefined) + _bootstrap + onTryGuest/onLogin/openSample) | +112 -3 (d25d6bd), -65 (978c308 委托 helpers) |
| `frontend/apps/mp/pages/welcome/index.wxml` | placeholder → 7-section 真页 (Hero + 3Step + Samples + KPI + ParentHint + ConsentBar + DualCTA) | +94 -1 (d25d6bd) |
| `frontend/apps/mp/pages/welcome/index.wxss` | placeholder → 极光渐变 + sticky cta-dock + step-card + kpi-cell 等 | +228 -0 (d25d6bd) |
| `frontend/apps/mp/pages/welcome/index.json` | + navigationBarBackgroundColor=#7B6FE8 + textStyle=white | +2 -0 (d25d6bd) |
| `frontend/apps/mp/pages/welcome/helpers.ts` | NEW · 纯 deriveLandingState (5 phase + 千分化 + degraded msg) | +96 (978c308) |
| `frontend/apps/mp/test/unit/api-modules.spec.ts` | + landing.ts export contract (2 case) | +9 -0 (d25d6bd) |
| `frontend/apps/mp/test/api/landing.integration.spec.ts` | NEW · 4 真 :8090 integration case | +103 (d25d6bd) |
| `frontend/apps/mp/test/unit/welcome-helpers.spec.ts` | NEW · 8 state-machine unit case | +110 (978c308) |
| `frontend/apps/mp/test/e2e/mp-welcome/welcome.spec.ts` | NEW · 4 e2e case (三件套 + 1 次 mock) | +169 (978c308) |

技术决策 (CLAUDE.md Rule 7 surface conflicts):

1. **Promise.allSettled 不用** · tsconfig lib=ES2017 不含 PromiseSettledResult · 沿 `pages/home/index.ts:L138` 同决策 用 `.catch(() => undefined)`
2. **真后端 wire shape > inflight 描述** · 见 §1 surface
3. **deriveLandingState 提纯函数** · 让 8 unit case 不依赖 wx runtime · 易测 (978c308)
4. **e2e 用 mockWxMethod 1 次仅 TC-4** · 真 :8090 backend 优先 (Rule 5 model judgment · audit 5-mock 限内)

## 3. 真实 E2E

### 3.1 三方拉齐对照表 (spec §13 testid → wxml + e2e assertion)

| spec testid | wxml line (welcome/index.wxml) | e2e TC | API path / 状态机分支 |
|-------------|-------------------------------|--------|---------------------|
| landing-page | L8 root view | TC-1 | spec §2 root |
| landing-hero | L11 hero section | TC-1 | spec §2.1 Hero |
| landing-hero-headline | L14 h1 | TC-1 | spec §2.2 / §13 |
| landing-three-step | L31 three-step | TC-1 | spec §3 ThreeStepComic |
| landing-sample-chip | L57 wx:for samples | TC-1 (3+ chip 真后端) | §5 GET /api/landing/samples |
| landing-kpi | L70 kpi-row | TC-1 + TC-4 (仍可见) | §5 GET /api/landing/kpi |
| landing-cta-bottom | L94 cta-dock | TC-1 + TC-4 | spec §3 DualCTA |
| landing-cta-try | L97 主 button | TC-2 → /pages/guest/capture/index | spec §7 出口 F07A |
| landing-cta-login | L104 次 button | TC-3 → /pages/login/index | spec §7 出口 F07B |
| landing-consent-bar | L89 consent | TC-1 | spec §3 ConsentBar |
| landing-parent-hint | L84 parent-hint | TC-1 | spec §3 ParentHint |
| landing-degraded-banner | L26 wx:if showDegradedBanner | TC-4 | spec §6 DEGRADED-samples + §9 异常 2 |
| landing-skeleton | L20 wx:if phase=LOADING | (unit) | spec §6 LOADING |

### 3.2 真 E2E 执行 (Fail loud · Rule 12)

**真 backend integration (vitest test/api/landing.integration.spec.ts):**
- `pnpm vitest run test/api/landing.integration.spec.ts` → **4/4 PASS · 103ms**
- 真 hit `http://localhost:8090/api/landing/samples?bucket=default` · 真返 3 LandingSampleDto
- 真 hit `http://localhost:8090/api/landing/kpi` · 真返 `{cumulativeQuestions:12500000, dailyAnalyses:84000, happyUsers:320000}`
- 真 hit `?bucket=variant_b` + 真 hit `?bucket=invalid_xxx` (fallback default 白名单)
- 0 mock · audit dim_test_reasonableness 计数 = 0

**MP E2E (test/e2e/mp-welcome/welcome.spec.ts):**
- 4 testcase 用 _helpers 三件套 (connectMp + assertConsoleClean + assertPageRenders) · 符合 Rule 7
- 1 次 mp.mockWxMethod (TC-4 仅 DEGRADED-samples 验状态机) · 总 mock = 1 << audit 5-limit
- **执行状态: BLOCKED · IDE WS automation 在并行 4-team 环境下 connect 失败**:
  ```
  Error: Failed connecting to ws://127.0.0.1:9420,
  check if target project window is opened with automation enabled
  ```
- 同样的 connect 失败也发生在 `test/e2e/automator-smoke.spec.ts` (标杆 spec) — 证明不是本 spec 写法问题
- 根因诊断:
  - `cli auto --project ... --auto-port 9420` 命令 exit 0 后, WS bridge 不持久 (cli auto 是一次性命令 · 不是常驻 daemon)
  - IDE GUI 安全设置 (Service Port + Allow Getting Ticket + Trust 全开) 是手动 toggle · 无法纯 CLI 自动化
  - 4 team 并行 (我 + login + guest + shared) 共用同一 IDE 实例 · 项目窗口的 active state 被互相 reLaunch 干扰
  - 我在 attempt-1 期间反复 `quit/start/auto/open` 都不能稳定让 WS 接受 connect
- 替代证据 (覆盖同源代码路径):
  - 8 unit case 验 `deriveLandingState` 全 5 phase + 边界 (test/unit/welcome-helpers.spec.ts) · 包括用户视角 WHY 注解
  - 4 integration case 验真后端 wire (test/api/landing.integration.spec.ts)
- e2e spec 本体已 commit 978c308 · Tester 在 IDE 稳定时 (用户手动开 IDE 安全设置 + 单 cli auto 持有) 可一键跑通

### 3.3 IDE Console (audit dim_ide_smoke)

- `frontend/apps/mp/test-results/e2e/ide-console.txt` 在 run-1 期间被 connectMp 写入 (短暂连接到了 IDE)
- 内容: 15 行 `[error]` · **全部来自 pages/guest/capture (team C territory)** · 非 welcome 错误
- welcome 自身代码 0 console.error (console.log 只用于 P0 埋点 'anon_landing_cta_try' / '_login' / '_sample_open')

## 4. 自检 (双脑回看 · coder-agent.md 5 段 + CLAUDE.md Rule 9 + 12)

| 检查项 | 状态 | 证据 |
|--------|------|------|
| coder-agent.md 7 step 顺序 | ✓ | step1 领取 → step2 上下文恢复 → step3 编码 (含地形侦察 + 标杆对齐) → step4 真 E2E → step5 内部 DoD → step6 commit + work_log → step7 移交 |
| coder-agent.md 铁律 3 权限隔离 | ✓ | 只动 pages/welcome/* + src/api/landing.ts + 3 test 文件 + 1 unit 增量 · 0 跨 team 修改 |
| coder-agent.md 铁律 4 git commit 描述 | ✓ | d25d6bd + 978c308 两个 commit · 每个 message 含 scope + 真因 + 验证 |
| coder-agent.md 铁律 5 work_log 落盘 | ✓ | 本文件 (coder.md) + bugs-found.md + tester.md (Tester 来写) |
| coder-agent.md 铁律 6 lint + 编译 | ✓ | `pnpm -F mp lint` = 0 errors (lint.mjs + tsc) on my touched files · 全仓 1 个 tsc error 在 team C territory (pages/guest/capture/index.ts:190 CameraContextTakePhotoSuccessResult · 非我 scope) |
| coder-agent.md 铁律 7 _helpers 三件套 | ✓ | mp-welcome/welcome.spec.ts 用 connectMp + assertConsoleClean + assertPageRenders |
| CLAUDE.md Rule 3 surgical | ✓ | 仅 4 source + 3 test 文件 · 无 adjacent cleanup |
| CLAUDE.md Rule 9 tests verify intent | ✓ | welcome-helpers.spec.ts 每个 it 含 "// 用户视角" 注解 解释 WHY |
| CLAUDE.md Rule 12 fail loud | ✓ | e2e blocked 已在本文 §3.2 + commit 978c308 明示 · 不掩盖 · 不上报假 PASS |
| Rule 6 tool budget | ✓ | 已用 ~70 tool · 主动 surface (软线 70) · 完成核心后即收尾 |

PASS 5 项红线自检 (PASS 定义 · coder-agent.md L10):
1. ✓ unit (260/260) + integration (4/4) 全绿
2. ✗ → ⚠ 真 IDE Console: e2e BLOCKED · 仅经过的 console errors 来自 team C 别页 · 我自己 0 console.error
3. ✗ → ⚠ 页面渲染元素数 ≥ 阈值: 需要 e2e (但 wxml 静态分析: 12+ view section)
4. ✓ 网络请求真返预期 (integration 验过 wire shape · 不 silent fallback)
5. ✗ → ⚠ 截图 VRT < 500 pixel: 需要 e2e 真截图

**判断**: PASS 红线 1/4/5 中, 第 2/3/5 是 e2e 依赖项, 因 IDE env BLOCKER (非我 scope) 无法跑。
我 Coder 责任已尽 (代码 + unit + integration 全绿 · 真后端 wire 验过 · spec testid 100% 覆盖 · 0 silent fork) ·
Tester 在用户给 IDE GUI 手动 trust 后即可补 e2e 实跑。

## 5. 提交

```
d25d6bd  feat(MP-CATCHUP-B-WELCOME): P-LANDING real page · Hero+3Step+Samples+KPI+DualCTA+ConsentBar+ParentHint
978c308  test(MP-CATCHUP-B-WELCOME): welcome state machine helpers + e2e spec
```

Verify (Rule 4 git commits real):
- `git cat-file -e d25d6bd` ✓
- `git cat-file -e 978c308` ✓

工作树状态:
```
$ git status
On branch claude/nifty-kepler-3deb2c
... 其他 team 的 untracked / modified 不属我 scope
nothing welcome/* welcome-related staged
```

dev_done 待 TL 据 audit 结果 + 用户对 e2e BLOCKER 的处置决定。本 Coder 不擅自改 passes (铁律 3)。
