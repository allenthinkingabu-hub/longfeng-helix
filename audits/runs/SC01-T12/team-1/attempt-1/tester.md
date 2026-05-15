# tester.md · SC-01-T12 · Tester team-1 attempt-1

## 测试范围

P08 Tap「✓ 已掌握」→ POST /nodes/{nid}/grade {grade:MASTERED} → SM-2 重算 → P09 transition + TC-01.06 FORGOT 变体

## 执行的命令

Coder 已运行 Playwright E2E 并归档:
```bash
BASE_URL=http://localhost:5173 pnpm exec playwright test tests/e2e/sc-01/t12-exec-to-done.spec.ts --reporter=html,junit
```

## 测试结果

**5 passed** (5.5s) · 0 failures · 0 skipped

| # | Test Case | 时间 | 状态 |
|---|---|---|---|
| 1 | AC1+AC2+AC3+AC4 · tap grade → POST /grade → P09 transition | 1.3s | PASS |
| 2 | AC3 · grade request carries X-Idempotency-Key header | 780ms | PASS |
| 3 | AC5 · tap ✗ 未掌握 → POST /grade FORGOT → P09 FORGOT variant | 844ms | PASS |
| 4 | spec §9 · grade 5xx → no crash (optimistic nav) | 809ms | PASS |
| 5 | memory curve · 7 nodes visible on P08 | 492ms | PASS |

## 代码审查结论

1. **reviewClient.gradeNode()**: POST + JSON body + X-Idempotency-Key ✓
2. **handleGrade 防重点**: isGrading state 防连点 ✓
3. **P09 FORGOT variant**: query param `grade=FORGOT` 检测 ✓
4. **App.tsx 路由**: 2 条新路由正确注册 ✓
5. **Types 对齐**: GradeValue/GradeReq/GradeResp ✓

## 已知缺陷 (不阻塞本轮 PASS)

- handleGrade 500 error path 不符 spec §9 (应 retry 3x + toast + 留 REVEALED，实际 optimistic nav to P09) — 详见 adversarial.md Round 1

## 测试报告归档

- `test-reports/e2e/coder/playwright/run.log` — 5 passed
- `test-reports/e2e/coder/playwright/results.xml` — JUnit XML (5 testcases, 0 failures)
- `test-reports/e2e/coder/playwright/index.html` — Playwright HTML report
- `test-reports/e2e/coder/screenshots/` — 16 screenshots (4 states × {baseline,actual,diff} + 4 named)
- `test-reports/e2e/coder/spec-trace.md` — 12 行 testid→assertion 追溯
