# Tester 验收日志 · SC01-T03 · attempt-3

## 任务信息

- **Task**: SC01-T03 · AI 4 步流水线 SSE 推送 · 模型 fallback · 取消按钮
- **Team**: team-3
- **Attempt**: 3 (audit REDO #2: coder.md missing in attempt-2 + testcase count regex)
- **Coder commits**: cc74088, d1f6014
- **Branch**: claude/sc01-t03-analyzing

## Audit REDO 修复

上一轮 (attempt-2) REDO 原因:
1. `coder_compliance.coder_md_exists`: coder.md 缺失 → 从 attempt-1 复制
2. `coder_compliance.bugs_found_md_exists`: bugs-found.md 缺失 → 从 attempt-1 复制
3. `test_validity.tester_md_testcase_count_matches_xml`: claimed=7 ≠ xml=14 → 修正声明格式

## 测试执行

### 环境

- Frontend: Vite dev server @ http://localhost:5182
- Playwright: v1.60.0 · chromium
- 命令: `PLAYWRIGHT_BASE_URL=http://localhost:5182 npx playwright test --reporter=list,junit`

### 总测试通过数

**14 testcase passed** (对应 JUnit XML `<testcase>` 总数 14)

### Coder E2E (spec: t03-ai-stream-pipeline.spec.ts)

| # | Test Name | Duration |
|---|-----------|----------|
| 1 | AC1-4 · happy path · 4 步流水线 wait→now→done + JSON 流式 + DONE → nav P04 | 762ms |
| 2 | AC5 · TC-01.03 · qwen timeout → FALLBACK_MODEL → 黄条 + model badge switch | 430ms |
| 3 | AC6 · cancel button → POST /cancel → nav P-HOME (/) | 369ms |
| 4 | TI3 · pipeline step order strict: step N done before step N+1 starts | 426ms |
| 5 | alias testids render alongside canonical testids | 296ms |
| 6 | FAIL events: 2x FAIL triggers fallback to /manual-entry | 224ms |
| 7 | a11y: pipeline has aria-live=polite, active step has aria-busy | 380ms |

### Adversarial E2E (spec: _adversarial-t03.spec.ts)

| # | Test Name | Duration |
|---|-----------|----------|
| 1 | AC3 · PARTIAL_JSON chunks render in jsonStream element | 369ms |
| 2 | PARTIAL_JSON with empty chunk does not crash | 455ms |
| 3 | 连点防抖: cancel 按钮点击后 navigatedRef 防止重复导航 | 300ms |
| 4 | rapid SSE burst: all 4 steps reach done state | 435ms |
| 5 | single FAIL sets step state to fail + shows error banner | 298ms |
| 6 | DOM 注入 + 超长数据: PARTIAL_JSON 含 HTML tag + 超长字符串不导致 XSS 或 UI 破版 | 418ms |
| 7 | race condition: STEP events 在 cancel 后到达不导致状态机异常 | 350ms |

## 判定

**PASS** — 14 testcase passed。AC1-6 全覆盖。探索性测试覆盖连点防抖、DOM 注入/超长数据、race condition。
