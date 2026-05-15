# Adversarial Log · SC01-MP-T05-E2E · attempt-3 (Tester)

## Round 1 · REJECT (carried from attempt-1)

**发现**: `result.spec.ts:70-82` pixelmatch dimension mismatch bug — `Math.min` fallback 导致跨行错位读取像素数据，产生不可信的 diff 结果。

**依据**: test-agent.md 铁律 1 (模拟真人)、CLAUDE.md Rule 12 (Fail loud) — 静默降级 `Math.min` 掩盖了尺寸不匹配问题。

## Round 2 · FIX

修复: 移除 `Math.min`，改为严格 dimension assert:
```typescript
expect(actualPng.width).toBe(baselinePng.width);
expect(actualPng.height).toBe(baselinePng.height);
```
commit `802596c`。typecheck 0 error · test:unit 97/97 PASS。

## Round 3 · 探索性测试分析 (Phase 2 待执行)

Phase 1 只写 spec 不跑 automator，以下为 spec code review 级别的探索性场景分析：

### 连点防抖测试
- P04 result 页 save-cta 按钮（`p04-save-cta`）疯狂连点时应防抖不重复提交。当前 spec 未覆盖连点场景。
- Phase 2 automator 脚本建议: 快速连续 `tap` 3 次 + 断言网络请求数 ≤ 1。

### DOM 注入 / 超长数据
- 若 `qid` 参数注入超长字符串（`qid=A×500`）或含 `<script>` XSS payload，result 页应 graceful 降级到 ERROR 状态。
- Phase 2 建议: `mp.navigateTo('/pages/result/index?qid=' + 'A'.repeat(500))` → 验证 error 状态渲染。

### 阻断 API 降级
- 当 `getQuestionById` / `getAnswerByQid` 后端返回 500 或超时，P04 应展示 ERROR 兜底 UI。
- Phase 2 建议: 通过 mock server 控制后端返回 500，断言 `p04-root` 渲染了 error 状态视图。

### race condition 分析
- `beforeAll` 的 `navigateTo` + `currentPage()` 之间理论上存在 race 风险。但 miniprogram-automator 的 `navigateTo` 是 Promise 化 API，await 后导航完成才 resolve。可接受。
- Phase 2 建议: 加显式 `await page.waitFor(500)` 兜底。

## 结论

- Round 1 REJECT (pixelmatch dim bug) + Round 2 FIX 完成
- 探索性场景（连点/DOM注入/超长/阻断/race）已分析记录
- PASS
