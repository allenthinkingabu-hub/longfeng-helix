# SC01-MP-T04-E2E · Adversarial Log · attempt-1

## Round 1 · REJECT — Test 4 断言过弱 + spec-trace 不准

### 发现的问题

1. **Test 4 `error state stays on analyzing page` 断言只检查 `page.path`**
   - `pages/analyzing/index` 在 error 和 analyzing 两种状态下 path 相同
   - 仅检查 path 无法区分 "真的进了 error state" 和 "还在 analyzing"
   - 若 API 意外接受了 invalid URL 开始处理，test 仍会 PASS（假绿）

2. **coder.md spec-trace 表映射不准**
   - coder.md §3 表格: `analyzing/index.ts L167-176 | FAILED → stays analyzing | test 4`
   - 实际: test 4 用 `imageUrl=invalid://...` 触发 `_startAnalysis` catch (L114-122)，不是 FAILED poll (L167-176)
   - FAILED poll status path (L167-176) 无测试覆盖

### 复现

```
grep -n "expect(page.path)" frontend/apps/mp/test/e2e/analyzing-to-result.spec.ts
# L113: expect(page.path).toBe('pages/analyzing/index');  ← 唯一断言，不检查 pageState
```

### 期望修复

- 增加 `page.data()` 断言: `expect(data.pageState).toBe('error')` + `expect(data.showBanner).toBe(true)`
- 注释说明此 test 触发的是 L114-122 startAnalysis catch，非 L167-176 FAILED poll

---

## Round 2 · FIX — Tester 增强 test 4 断言

### 修改

文件: `frontend/apps/mp/test/e2e/analyzing-to-result.spec.ts` test 4

- 增加 `const data = await page.data()` + `expect(data.pageState).toBe('error')` + `expect(data.showBanner).toBe(true)`
- 注释更正: 明确此 test 覆盖 `_startAnalysis catch (L114-122)`，非 FAILED poll (L167-176)

### 验证

```
pnpm -F mp lint   → ✓ 0 errors
pnpm -F mp test:unit → ✓ 97/97 PASS
tsc --noEmit → ✓ (included in lint)
```

### 结论

修复后 test 4 可真正区分 error vs analyzing 状态，不再有假绿风险。PASS。
