# Adversarial Log · SC01-MP-T02-E2E · attempt-1

## Round 1 · REJECT — missing imageUrl query assertion

**发现**: `capture-to-analyzing.spec.ts` test 3 只断言 `subject` 和 `qid`，遗漏了 `imageUrl` 参数验证。

**影响**: 真实代码 `pages/capture/index.ts:150-153` 传递三个 query 参数 (`imageUrl`, `subject`, `qid`)。若 `imageUrl` 在转场 URL 中被意外丢弃，该测试仍会通过 — 无法捕获回归。

**复现**:
```
grep -n 'imageUrl' frontend/apps/mp/test/e2e/capture-to-analyzing.spec.ts
# 修复前: imageUrl 仅在 navigateTo URL 中出现，test 3 assert 段无 imageUrl
```

**依据**: CLAUDE.md Rule 9 (Tests verify intent, not just behavior) + test-agent.md 铁律 3 (严苛对抗)

## Round 1 · FIX — 补全 imageUrl assertion

**修复**: 在 test 3 新增两行 assertion:
```ts
expect(query).toHaveProperty('imageUrl');
expect(query.imageUrl).toBeTruthy(); // imageUrl 不能为空
```

**验证**: 修复后重跑 `pnpm -F mp lint` → 0 errors · `pnpm -F mp test:unit` → 97 passed

## Round 2 · 全面复审 PASS

修复后复审 spec 全文:
1. beforeAll connect + 8s timeout + afterAll disconnect — 符合标杆模板 ✓
2. reLaunch 到 capture 页 + assert path — 正确 ✓
3. navigateTo analyzing 带完整 query — 正确 ✓
4. assert 全部 3 个 query 参数 (imageUrl + subject + qid) — 已补齐 ✓
5. 无 page.route mock / 无 vi.mock / 无 evaluate 后门 ✓
6. maxDiffPixels 无 (transition spec 不含 VRT) ✓
7. Phase 1 scope 合规: 只写 spec，不跑 automator ✓

**结论**: PASS — spec 完整覆盖 capture→analyzing 转场契约。
