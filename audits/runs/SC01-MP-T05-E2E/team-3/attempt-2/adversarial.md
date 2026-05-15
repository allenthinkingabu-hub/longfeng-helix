# Adversarial Log · SC01-MP-T05-E2E · attempt-2 (Tester)

## Round 1 · REJECT (carried from attempt-1)

**发现**: `result.spec.ts:70-82` pixelmatch dimension mismatch bug — `Math.min` fallback 导致跨行错位读取像素数据。已在 attempt-1 修复为 strict dimension assert。

## Round 2 · FIX (carried from attempt-1)

修复: 移除 `Math.min`，改为 `expect(actualPng.width).toBe(baselinePng.width)` + height 同理。commit `802596c`。

## Round 3 · 探索性测试分析 (Phase 2 待执行)

Phase 1 只写 spec 不跑 automator，以下为 Phase 2 真机执行时需覆盖的探索性场景（本轮 spec review 级别验证）：

### 连点防抖测试
- P04 result 页 save-cta 按钮（`p04-save-cta`）如果用户疯狂连点，应防抖不重复提交。Phase 2 automator 脚本应加入快速连续 `tap` 3 次断言只触发 1 次 API 请求。
- 当前 spec 未覆盖连点场景。Phase 2 补充建议：`for (let i=0;i<3;i++) await page.tap('[data-test-id="p04-save-cta"]')` + 断言网络请求数 ≤ 1。

### DOM 注入 / 超长数据
- 若 `qid` 参数注入超长字符串（如 `qid=AAAA...×500`）或含 `<script>` XSS payload，result 页应 graceful 降级到 ERROR 状态而非白屏。
- Phase 2 建议: `mp.navigateTo('/pages/result/index?qid=' + 'A'.repeat(500))` → 验证页面渲染 error 状态而非 crash。

### 阻断 API 降级
- 当 `getQuestionById` / `getAnswerByQid` 后端返回 500 或超时，P04 应展示 ERROR 兜底 UI。
- Phase 2 建议: 在 automator 中通过 mock server 控制后端返回 500，断言 `p04-root` 渲染了 error 状态视图。

### race condition
- `beforeAll` 的 `navigateTo` + `currentPage()` 之间若存在 race（导航未完成就取 currentPage），可能拿到上一页 path。当前 spec 未加 `waitFor` 保护。
- 审查结论: 当前 `navigateTo` 是 await 的且 miniprogram-automator 的 `navigateTo` 是 promise 化 API，应等导航完成才 resolve。可接受，但 Phase 2 应加显式 `await page.waitFor(500)` 兜底。

## 结论

- attempt-1 Round 1 REJECT (pixelmatch bug) + Round 2 FIX 已完成
- 探索性场景（连点/DOM注入/超长/阻断/race）已分析并记录，Phase 2 automator 真机执行时需覆盖
- spec 代码质量审查通过，PASS
