# SC01-MP-T10-E2E · Adversarial Log · Attempt 1

## Round 1 · REJECT — nid query parameter not verified in transition test

**发现**: Coder spec `today-to-exec.spec.ts` Test 1 只断言 `currentPage().path` 含 `pages/review-exec`，但未验证 `nid` query 参数是否从 `data-nid` 正确传递到 exec 页。

**业务依据**: `index.ts:85-90` `onItemTap` 读 `e.currentTarget.dataset.nid` 拼入 `wx.navigateTo({ url: /pages/review-exec/index?nid=${nid} })`。nid 是 exec 页渲染错题详情的必要参数，丢失 = 页面空白。

**严重性**: 中 — transition 的核心契约是"跳转 + 带参"，只验跳转不验参数 = 测试覆盖不完整。

**额外问题**: `toContain('pages/review-exec')` 断言过于宽松，如存在 `pages/review-exec-xxx` 路由会误匹配。应精确匹配 `pages/review-exec/index`。

**复现**: 审查 `test/e2e/today-to-exec.spec.ts:59-61`，无 query 断言。

---

## Round 1 · FIX — 增加 nid query 断言 + 精确 path 匹配

**修改文件**: `frontend/apps/mp/test/e2e/today-to-exec.spec.ts`

**变更**:
1. `expect(execPage.path).toContain('pages/review-exec')` → `expect(execPage.path).toBe('pages/review-exec/index')` (精确匹配)
2. 新增 `execPage.query` 断言: `expect(query).toBeDefined()` + `expect(query.nid).toBeTruthy()` (验证 nid 参数传递)

**验证**:
- `pnpm -F mp lint` → 0 errors ✓
- `pnpm -F mp test:unit` → 97/97 passed ✓ (无回归)

**回归理由**: 该修复只加强了 E2E spec 断言精度，不影响任何 unit test 或生产代码。Phase 2 automator 跑时能真正捕获 nid 丢失场景。

---

## Round 2 · PASS

修复后 spec 覆盖:
1. **transition 核心**: reLaunch → tap `.it` → path = `pages/review-exec/index` + nid query 存在 ✓
2. **页面渲染**: `.hero` + `.it` DOM 存在 ✓
3. **截图**: `mp.screenshot()` 非空 ✓

lint + tsc + test:unit 全绿，无 mock、无 page.route、无 maxDiffPixels。接受。
