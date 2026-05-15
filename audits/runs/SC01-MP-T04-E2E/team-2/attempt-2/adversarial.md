# SC01-MP-T04-E2E · Adversarial Log · attempt-2

> 承接 attempt-1 对抗记录，修复 audit REDO 的 2 项 test_validity 失败。

## Round 1 · REJECT — Test 4 断言过弱 (attempt-1 发现)

### 发现的问题

1. **Test 4 `error state stays on analyzing page` 断言只检查 `page.path`**
   - `pages/analyzing/index` 在 error 和 analyzing 两种状态下 path 相同
   - 仅检查 path 无法区分 "真的进了 error state" 和 "还在 analyzing"
   - 若 API 意外接受了 invalid URL 开始处理，test 仍会 PASS（假绿）

2. **coder.md spec-trace 映射不准**: test 4 实际触发 L114-122 (`_startAnalysis` catch)，非 L167-176 (FAILED poll)

### 复现

```bash
grep -n "expect(page.path)" frontend/apps/mp/test/e2e/analyzing-to-result.spec.ts
# 原始版本: L113 仅有 path 断言
```

---

## Round 2 · FIX — 增强 test 4 断言 (attempt-1 commit 49990aa)

### 修改

文件: `frontend/apps/mp/test/e2e/analyzing-to-result.spec.ts` test 4

- 增加 `const data = await page.data()`
- 新增断言: `expect(data.pageState).toBe('error')` + `expect(data.showBanner).toBe(true)`
- 注释更正: 明确覆盖 `_startAnalysis catch (L114-122)`

### 验证

```
pnpm -F mp lint   → ✓ 0 errors
pnpm -F mp test:unit → ✓ 97/97 PASS
```

---

## Round 3 · 探索性测试设计（Phase 2 补充执行）

Phase 1 只写 spec 不跑 automator，以下探索性场景记录待 Phase 2 真机执行时补充到 spec:

### 3a · 连点防抖 (rapid tap)

- **场景**: 在 analyzing 页面的「取消」按钮上极速连点 10+ 次
- **预期**: `onCancelTap` → `wx.navigateBack()` 仅触发一次导航，不会 stack overflow 或多次 back
- **验证方式**: `for (let i = 0; i < 10; i++) await page.callMethod('onCancelTap')` → 检查页面栈长度

### 3b · DOM 注入 + 超长数据 (injection + overflow)

- **场景**: 通过 URL 参数注入超长 subject 字符串 (2000+ 字符) 和 XSS payload `<script>alert(1)</script>`
- **预期**: UI 不破版、不执行脚本、subjectLabel 安全渲染
- **验证方式**: `mp.reLaunch({ url: '/pages/analyzing/index?subject=' + 'A'.repeat(2000) })` → 检查页面不崩溃 + DOM 不含 `<script>`

### 3c · 网络阻断 race condition

- **场景**: 在轮询进行中 (analyzing state) 突然断网 → 恢复 → 再断网
- **预期**: catch 块吞掉网络异常继续轮询 (L183-185)，不会意外跳转或 crash
- **验证方式**: Phase 2 用真 IDE + 模拟网络切换验证状态机稳定性

### 结论

Round 1 REJECT + Round 2 FIX 已完成。Round 3 探索性测试为 Phase 2 规划，不影响 Phase 1 PASS 判定。
