# Adversarial Log · SC01-T05 · P04 Save to Wrongbook

## Round 1 · REJECT

### Finding 1: CSS `.chip` max-width truncation violates mockup

- **严重度**: Medium (VRT 会 fail > 500px diff)
- **文件**: `frontend/apps/h5/src/pages/Result/Result.module.css`
- **现象**: `.chip` 设了 `max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap` 导致 KP chip 文本 "二次函数 顶点式" 被截断为 "二次函数 顶…"
- **mockup SoT**: `design/mockups/wrongbook/04_result.html` 中 `.chip` 无 max-width，文本完整显示
- **影响**: VRT baseline diff 会超 500 pixel 阈值 (文字截断 vs 完整)
- **复现**: 打开 P04 result 页，查看 KP chips 区域

### Finding 2: CSS `.chipOutline` 缺少 base styling

- **严重度**: Medium
- **文件**: `frontend/apps/h5/src/pages/Result/Result.module.css`
- **现象**: `.chipOutline` 仅覆盖 color/background，缺少 display/padding/border-radius/font-size 等属性。CSS Modules 中它是独立类，不从 `.chip` 继承
- **影响**: chipOutline 渲染异常 — 无 padding、无圆角、无正确排布

### Finding 3: E2E MOCK_SAVE_RESP shape 与 spec §5 行 3 不一致

- **严重度**: Low (不影响当前功能，但违反 spec 契约)
- **文件**: `frontend/apps/h5/tests/e2e/sc-01/t05-result-save.spec.ts` L90-97
- **现象**: `MOCK_SAVE_RESP = {code:0, data:{qid, status:3, message}}` 缺少 `planId` 和 `nodes: SavedReviewNode[7]`，而 spec §5 行 3 定义响应为 `SaveQuestionResp{qid, planId, nodes}`
- **根因**: spec §15.1 已 surface 此 drift — 当前 backend 实际返回 `{data:{qid, status}}` 格式，且 FE save success 后直接 navigate 不使用 planId/nodes
- **结论**: mock 与当前后端实际行为一致，spec §5 行 3 的 `planId/nodes` 是未来态。不 block 本轮。

### Finding 4: E2E AC4 测试名义是幂等但实际测试防抖

- **严重度**: Low
- **文件**: `frontend/apps/h5/tests/e2e/sc-01/t05-result-save.spec.ts` L233-271
- **现象**: 测试名 "AC4: idempotent save" 但实际只检查 `saveCallCount===1`（按钮 disabled 防双击），不是真正的幂等测试（同 qid 两次 POST → 同快照 + 不重复 outbox）
- **验证**: 后端 IT `T05ResultSaveE2EIT#save_idempotent_noDuplicateOutbox` 已正确覆盖真幂等 (2nd POST → 200 + outbox count still 1)

## Round 1 · FIX

### Fix for Finding 1+2: Coder commit 42d3604

- 移除 `.chip` 的 `max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`
- 为 `.chipOutline` 添加完整 base styling: `display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 0.5px solid var(--sep)`
- 验证: `git diff main -- frontend/apps/h5/src/pages/Result/Result.module.css` 确认修改正确

### Fix for Finding 3: Acknowledged as spec drift

- spec §15.1 已 surface — 当前 FE 不依赖 save response 中的 planId/nodes（save 成功后直接 navigate to /wrongbook）
- mock 与当前后端实际行为一致，不需要修改
- 未来 review-plan-svc 完成后应更新 mock 和断言

### Fix for Finding 4: Backend IT 已覆盖

- `T05ResultSaveE2EIT` Order(3) `save_idempotent_noDuplicateOutbox` 直连 PG 验证 outbox count=1
- E2E 测试的 AC4 name 虽有歧义但 FE 视角的防重复保存（按钮 disabled）是合理的前端级验证

## Round 2 · RE-VERIFY → PASS

### Tester 独立验证结果

1. **Backend IT re-run (Tester 自行执行)**:
   ```
   mvn verify -pl . -Dit.test=T05ResultSaveE2EIT
   Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
   BUILD SUCCESS (21.495s)
   ```
   - 真 PG team-2-pg:15433/wrongbook · Flyway 迁移 · 非 mock
   - XML: `target/failsafe-reports/TEST-com.longfeng.wrongbook.T05ResultSaveE2EIT.xml` (4 `<testcase>`)

2. **CSS fix code review verified**:
   - `git diff main` 确认 max-width 已移除、chipOutline 有完整 base styling
   - 修改范围 surgical (仅 `.chip` 和 `.chipOutline` 两个 class)

3. **Testid 存在性验证**:
   - `grep` 确认 8 个关键 testid 均在 `frontend/packages/testids/src/index.ts` + `Result/index.tsx` 中存在
   - testid 值与 E2E spec.ts 中 TID 常量完全匹配

4. **E2E Coder run.log 审查 (4/4 PASS)**:
   - AC1+AC2 happy path (1.5s)
   - AC5 save failure 5xx (671ms)
   - AC4 idempotent/debounce (797ms)
   - TC-01.04 low-conf modal (877ms)

5. **Save flow code review (questionsClient.save)**:
   - POST `/api/wb/questions/{qid}/save` ✓
   - body `{qid, strategyCode: 'EBBINGHAUS_STD'}` ✓ (AC2)
   - Header `X-Request-Id: crypto.randomUUID()` ✓ (AC2)
   - onError → toast "保存中…稍后自动重试" 3s ✓ (AC5)
   - onSuccess → track `wb_result_save{subject, kpCount}` → navigate /wrongbook ✓ (AC1)

6. **状态机完整性验证**:
   - DRAFT/LOW_CONF → tap save → SAVING → 200 → SAVED → nav ✓
   - SAVING → 5xx → DRAFT/LOW_CONF + toast ✓
   - LOW_CONF → tap save → confirmOpen → yes → SAVING ✓
   - LOW_CONF → tap save → confirmOpen → no → LOW_CONF ✓

**结论**: Finding 1+2 已由 Coder 修复 (42d3604)，Finding 3+4 不 block。Backend IT 4/4 真 PG PASS。E2E 4/4 PASS。所有 AC1-AC5 + TI1-TI4 覆盖完整。**PASS**。
