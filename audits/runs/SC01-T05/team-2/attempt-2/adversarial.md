# Adversarial Log · SC01-T05 · P04 Save to Wrongbook · attempt-2

## Audit REDO 修复 (from attempt-1)

- **redo_reason**: `[test_validity.tester_md_testcase_count_matches_xml] claimed=4 ≠ xml<testcase>=12`
- **根因**: attempt-1 tester.md 只计 Backend IT 的 4 个 testcase, 未计 Playwright XML (4) + Tester re-run XML (4)
- **修复**: attempt-2 tester.md 声明 **12 testcases** = 3 XML 各 4 个

## Round 1 · REJECT

### Finding 1: tester.md testcase 计数错误 (audit REDO 根因 · Critical)

- **严重度**: Critical (直接导致 audit.js test_validity FAIL)
- **文件**: `audits/runs/SC01-T05/team-2/attempt-1/tester.md` §2.1
- **现象**: tester.md 声明 "4 testcases (matching XML `<testcase>` count = 4)"
- **实际**: `test-reports/` 下 3 个 XML 共 12 个 `<testcase>`:
  1. `test-reports/tester/TEST-com.longfeng.wrongbook.T05ResultSaveE2EIT.xml` → 4
  2. `test-reports/e2e/coder/backend-it/failsafe-xml/TEST-com.longfeng.wrongbook.T05ResultSaveE2EIT.xml` → 4
  3. `test-reports/e2e/coder/playwright/results.xml` → 4
- **复现**: `find test-reports -name '*.xml' -exec grep -c '<testcase' {} \;` → 4+4+4 = 12

### Finding 2: E2E AC4 测试名义幂等但实际测试防抖 (debounce)

- **严重度**: Low (不 block · 后端 IT 已正确覆盖真幂等)
- **文件**: `frontend/apps/h5/tests/e2e/sc-01/t05-result-save.spec.ts` L233-271
- **现象**: 测试名 "AC4: idempotent save" 但实际只验证 `saveCallCount===1`（按钮 disabled 防双击）
- **真幂等验证**: 后端 IT `T05ResultSaveE2EIT#save_idempotent_noDuplicateOutbox` (Order 3) 直连 PG 验证 2nd POST → 200 + outbox count still 1
- **结论**: FE debounce + Backend IT 真幂等 = AC4 联合覆盖充分, 不 block

### Finding 3: MOCK_SAVE_RESP 缺少 planId/nodes (spec §5 行 3 drift)

- **严重度**: Low (已知 spec drift, attempt-1 已 surface)
- **文件**: `frontend/apps/h5/tests/e2e/sc-01/t05-result-save.spec.ts` L90-97
- **现象**: mock 返回 `{code:0, data:{qid, status:3, message}}` 缺少 `planId` 和 `nodes: SavedReviewNode[7]`
- **根因**: spec §15.1 已标注 — 当前 backend 实际返回 `{data:{qid, status}}`, FE save 成功后直接 navigate 不使用 planId/nodes
- **结论**: mock 与当前后端实际行为一致, 不 block

## Round 1 · FIX

### Fix for Finding 1 (Critical): testcase count 校正

- attempt-2 tester.md 正确声明 **12 testcases** (3 XML × 4 each)
- 验证: `find test-reports -name '*.xml' -exec grep -c '<testcase' {} \;` → 4+4+4 = 12
- tester.md §2.1 明确列出 3 个 XML 及各自 testcase 数, 总计与 audit.js 计算方式对齐

### Fix for Finding 2+3: 已知 drift, 不需代码修改

- Finding 2: FE 防抖 + Backend IT 真幂等 = AC4 联合覆盖充分
- Finding 3: spec drift 已在 attempt-1 surface, 待 review-plan-svc 完成后更新

## Round 2 · RE-VERIFY → PASS

### Tester 独立验证结果

1. **Backend IT re-run (Tester attempt-2 自行执行)**:
   ```
   cd backend/wrongbook-service
   mvn verify -pl . -Dit.test=T05ResultSaveE2EIT -Dfailsafe.rerunFailingTestsCount=0 \
     -DskipTests=false -Dskip.surefire.tests=true

   Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 13.95 s
   BUILD SUCCESS (23.023 s)
   ```
   - 真 PG: localhost:15433/wrongbook (sandbox healthy)
   - Flyway 迁移: enabled · hibernate ddl-auto=validate
   - 非 mock · 直连真 PG + outbox 写入验证

2. **XML testcase 总计验证**:
   - `test-reports/tester/*.xml` → 4 `<testcase>` (Tester 独立 re-run)
   - `test-reports/e2e/coder/backend-it/failsafe-xml/*.xml` → 4 `<testcase>` (Coder IT)
   - `test-reports/e2e/coder/playwright/results.xml` → 4 `<testcase>` (Coder E2E)
   - **总计: 12 testcases** (与 tester.md §2.1 声明一致)

3. **CSS fix (42d3604) code review**:
   - `.chip` max-width 移除 ✓
   - `.chipOutline` base styling 补全 (display, padding, border-radius, font-size) ✓

4. **Testid 存在性**:
   - `p04-save-cta`, `result-save-loading`, `result-save-toast`, `result-confirm-modal`, `result-confirm-yes-btn`, `result-confirm-no-btn`, `result-lowconf-banner` — 全部 grep 命中源码 ✓

5. **Save flow code review**:
   - POST `/api/wb/questions/{qid}/save` + strategyCode + X-Request-Id ✓ (AC2)
   - onSuccess → track `wb_result_save` → navigate `/wrongbook` ✓ (AC1)
   - onError → toast "保存中…稍后自动重试" 3s ✓ (AC5)

6. **状态机完整性**:
   - DRAFT → SAVING → SAVED → nav ✓
   - SAVING → 5xx → DRAFT + toast ✓
   - LOW_CONF → tap save → confirmOpen → yes → SAVING ✓
   - LOW_CONF → tap save → confirmOpen → no → LOW_CONF ✓

**结论**: REDO 根因 (testcase count claimed=4 ≠ xml=12) 已修复 → tester.md 声明 12。代码质量、AC/TI 覆盖、Backend IT 4/4 PASS、E2E 4/4 PASS 均无退化。**PASS**。
