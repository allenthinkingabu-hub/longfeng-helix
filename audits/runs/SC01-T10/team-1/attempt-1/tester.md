# SC01-T10 · Tester Work Log · attempt-1

## 测试环境

- **Playwright**: 1.60.0 (chromium headless)
- **Vite Dev Server**: localhost:5184 (from sc01-t10-target-to-exec worktree)
- **Viewport**: 393×852 (mobile, per playwright.config.ts)
- **Node**: v24.14.0
- **OS**: Darwin 25.1.0

## 执行命令

```bash
cd frontend/apps/h5
PLAYWRIGHT_BASE_URL=http://localhost:5184 npx playwright test tests/e2e/sc-01/t10-target-to-exec.spec.ts --reporter=list
```

## 测试结果: 9 passed (3.6s)

| # | 测试名 | 状态 | 耗时 |
|---|---|---|---|
| 1 | P07 · Hero card + stats + progress visible | ✅ PASS | 340ms |
| 2 | P07 · slot headers + item cards visible | ✅ PASS | 249ms |
| 3 | AC1+AC2+AC3 · tap item → POST /open 200 → P08 renders | ✅ PASS | 404ms |
| 4 | AC3 · bottom CTA "全部开始" → POST /open → P08 | ✅ PASS | 362ms |
| 5 | AC4 · READING → ANSWERING (canvas touch → reveal enabled) | ✅ PASS | 326ms |
| 6 | AC5 · tap × → exit confirm sheet → cancel → back to P08 | ✅ PASS | 409ms |
| 7 | AC5 · tap × → exit → tap "退出" → navigate home | ✅ PASS | 317ms |
| 8 | TI2 · reveal content aria-hidden before reveal | ✅ PASS | 276ms |
| 9 | P08 UI structure · topbar + progress + meta + question + answer + grade + memory curve | ✅ PASS | 285ms |

## AC 覆盖追溯

| AC | 测试 # | 验证方式 |
|---|---|---|
| AC1 | #3 | tap item → waitForResponse POST /open |
| AC2 | #3 | response.status() === 200 |
| AC3 | #3, #4 | P08 root + topbar cursor + progress bar + meta chips + question hero visible |
| AC4 | #5 | reveal button disabled (READING) → dispatchEvent mousedown → reveal enabled (ANSWERING) |
| AC5 | #6, #7 | exit confirm sheet visible + text + cancel/exit buttons |

## TI 覆盖

| TI | 测试 # | 验证方式 |
|---|---|---|
| TI2 | #8 | revealContent aria-hidden="true" 在 READING 状态 |
| TI4 | #3 | toHaveScreenshot('p08-reading.png') VRT 截图 |

## VRT 截图 (4 态)

- `p07-idle-chromium-darwin.png` — P07 列表视图
- `p08-reading-chromium-darwin.png` — P08 READING 态
- `p08-answering-chromium-darwin.png` — P08 ANSWERING 态
- `p08-exit-confirm-chromium-darwin.png` — P08 退出确认弹窗

## 稳定性

连续 2 次运行均 9/9 PASS，无 flaky 测试。

## 代码审查摘要

- **P07 ReviewToday**: 新页面，Hero card + slot list + CTA，testid 全挂载，1:1 mockup mirror
- **P08 ReviewExec**: READING 初始状态 + canvas touch → ANSWERING + exit confirm sheet，状态机完整
- **App.tsx**: /review-today, /review/exec/:nid, /review/done 三条路由正确
- **vite.config.ts**: /api/review proxy 已添加
- **testids**: p07 16 个 + p08 18 个常量全匹配 spec §13
- **API 端点**: POST /open, POST /reveal, POST /grade 全匹配 spec §5
