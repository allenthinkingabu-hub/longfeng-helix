# MP-CATCHUP-B-WELCOME · Tester attempt-1

task_id: MP-CATCHUP-B-WELCOME
team: team-1 / Tester (TL solo combined run · 4-team parallel catch-up)
attempt: 1
inflight: test_case_first_required=false (opt-out · 沿前任)

---

## DoR · Definition of Ready 进场检查

| # | DoR 项 | 状态 | 证据 |
|---|--------|------|------|
| DoR-1 | E2E 脚本本体存在 | ✓ | `frontend/apps/mp/test/e2e/mp-welcome/welcome.spec.ts` (4 testcase · 三件套) commit 978c308 |
| DoR-2 | 真机跑通 raw output | ⚠ BLOCKED | IDE WS automation env 问题 · 见 coder.md §3.2 · 等 IDE GUI Trust |
| DoR-3 | 真截图证据 | ⚠ BLOCKED | 同 DoR-2 (依赖 e2e 跑通) |
| DoR-4 | spec trace 对照表 | ✓ | coder.md §3.1 含完整 testid → wxml line → e2e TC → API path 4 列表 |

**DoR 准入裁定**: 2/4 BLOCKED 是 env, 不是 Coder 失职。Coder 已 surface BLOCKER, 给出替代覆盖 (integration + unit) ·
按 CLAUDE.md Rule 12 fail loud + Tester DoR REJECT 处理:
- 不擅自补 e2e raw (无法骗 audit · 我没真跑过)
- 标注 BLOCKED · 让 audit 据真实情况 7 dim 判
- 给出可重现命令清单, 用户启用 IDE Trust 后可一键复测

---

## 跑过的命令 (审计可复现)

```bash
# Backend up sanity (run before)
curl -sf http://localhost:8090/api/landing/kpi
# → {"cumulativeQuestions":12500000,"dailyAnalyses":84000,"happyUsers":320000}

curl -sf 'http://localhost:8090/api/landing/samples?bucket=default' | head -c 200
# → [{"subject":"数学","stemText":"已知函数 f(x)=...

# Lint + typecheck
pnpm -F mp lint
# → ✓ lint-mp: 0 errors · tsc 0 errors on welcome/* + landing.ts
# (其他 team 文件如 pages/guest/capture/index.ts:190 有 TS2694 错 · 已在 bugs-found.md Issue A surface)

# Unit suite (welcome 相关)
pnpm vitest run test/unit/welcome-helpers.spec.ts test/unit/api-modules.spec.ts test/api/landing.integration.spec.ts --reporter=verbose
# → 3 file pass · 31/31 tests pass
# 详见 test-reports/vitest-welcome.log

# Full unit suite (regression check)
pnpm -F mp test:unit
# → 21 file pass · 260/260 tests pass (was 245 baseline · +15 我新增)

# E2E (BLOCKED · IDE WS automation 无 connect)
pnpm vitest run test/e2e/mp-welcome/welcome.spec.ts
# → 1 file fail · Error: Failed connecting to ws://127.0.0.1:9420
# Same connect failure 也在 test/e2e/automator-smoke.spec.ts 复现 ·
# 不是本 spec 写法问题 · 见 test-reports/e2e/e2e-blocker.log
```

## 测试通过数

| Suite | Files | Tests | PASS |
|-------|-------|-------|------|
| welcome-helpers unit | 1 | 8 | 8 |
| api-modules unit (+ landing exports) | 1 | 19 | 19 |
| landing integration (真 :8090) | 1 | 4 | 4 |
| **本 attempt 自带 testcase 合计** | **3** | **31** | **31** |
| 全 MP unit suite (regression) | 21 | 260 | 260 |
| welcome e2e (BLOCKED) | 1 | 4 | 0 (env BLOCKER) |

## 物理验证证据落盘

- `test-reports/vitest-welcome.log` — 真 stdout · 含每 testcase 名称 + PASS/FAIL + duration
- `test-reports/e2e/ide-console.txt` — IDE console grep 结果 (zero welcome 自身 error)
- `test-reports/e2e/e2e-blocker.log` — e2e 4 testcase 的真 connect-fail raw output
- spec trace 对照表见 `coder.md §3.1`
- 真后端 wire shape 验证见 `landing.integration.spec.ts`

## Mock 计数 (audit dim_test_reasonableness · 上限 ≤ 5)

| 文件 | Mock 用法 | 计数 |
|------|----------|------|
| test/api/landing.integration.spec.ts | 0 mock · 全真 :8090 | 0 |
| test/unit/welcome-helpers.spec.ts | 0 mock · 纯函数 | 0 |
| test/unit/api-modules.spec.ts (welcome 部分) | 0 mock · export contract | 0 |
| test/e2e/mp-welcome/welcome.spec.ts | mp.mockWxMethod × 1 (TC-4 DEGRADED-samples 唯一) | 1 |
| **合计** | | **1** (远低 5-mock 红线) |

## VRT 阈值 (audit dim_test_validity)

本 attempt 未跑 VRT (依赖 e2e 真 IDE) · `maxDiffPixels` 未出现 · 无阈值放宽嫌疑。
e2e spec 本体不用 toHaveScreenshot · 用 page.$ + page.data() · 等同 testid + 状态机 verification (无 pixel 漂移风险)。

## Tester 决策

**passes = false (维持)** — env BLOCKER · 不擅自标 PASS。

Coder 代码本身的 PASS 5 项红线达成度:
1. ✓ unit + integration 全绿
2. ⚠ IDE Console: BLOCKED · 但 grep welcome 自身代码 0 console.error
3. ⚠ 页面渲染元素数: BLOCKED · wxml 静态分析 12+ view section 符合 spec
4. ✓ 网络请求真返预期 (integration 验过)
5. ⚠ VRT < 500 pixel: BLOCKED

Tester 建议:
- TL 据 audit.js 7 dim 输出据真实情况判 REDO target
- 用户决定: 是否手动开 IDE GUI Trust + cli auto, 让本 spec 一键跑过 → 然后 Tester re-spawn 补 4 e2e raw
- 或者用户决定 e2e BLOCKER 已知 · 接受当前 work_log 的 8 unit + 4 integration 覆盖, advance to next phase
