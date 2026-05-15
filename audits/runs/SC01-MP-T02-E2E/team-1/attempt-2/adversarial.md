# Adversarial Log · SC01-MP-T02-E2E · attempt-2

## Round 1 · REJECT — missing imageUrl query assertion (carried from attempt-1)

**发现**: `capture-to-analyzing.spec.ts` test 3 只断言 `subject` 和 `qid`，遗漏了 `imageUrl` 参数验证。

**影响**: 真实代码 `pages/capture/index.ts:150-153` 传递三个 query 参数 (`imageUrl`, `subject`, `qid`)。若 `imageUrl` 在转场 URL 中被意外丢弃，该测试仍会通过 — 无法捕获回归。

**复现**:
```bash
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

## Round 2 · 探索性测试分析 — DOM 注入 / 超长参数 / race condition

Phase 1 只写 spec 不跑 automator，但作为 Tester 仍需对 spec 做探索性边界分析：

### DOM 注入风险评估
- **场景**: `imageUrl` 参数经 `encodeURIComponent` 编码后拼入 URL，如果恶意注入 `<script>` 或 `javascript:` 协议到 imageUrl
- **spec 覆盖**: 当前 spec 使用 `https://example.com/test.jpg` 作为 mock URL，已经测试了 encodeURIComponent 的编码行为
- **结论**: Phase 1 spec 层面 OK，Phase 2 真 automator 执行时应增加 XSS payload 测试

### 超长数据边界
- **场景**: `subject` 参数如果传入超长字符串（如 2000 字符），`wx.navigateTo` URL 可能被截断导致 query 丢失
- **spec 覆盖**: 当前 spec 使用 `math`（4 字符），未覆盖超长边界
- **建议**: Phase 2 增加超长 subject 边界 test case

### race condition 分析
- **场景**: 真实代码 `pages/capture/index.ts:151` 使用 `setTimeout(300ms)` delay 后 navigateTo，如果用户在 300ms 内连点快门
- **spec 覆盖**: 当前 spec 直接调用 `mp.navigateTo` 绕过 setTimeout，不模拟连点
- **建议**: Phase 2 增加连点防抖验证 (快速连续 tap 快门 → 只应触发一次 navigateTo)

## Round 3 · 全面复审 PASS

修复后 + 探索性分析后复审 spec 全文:
1. beforeAll connect + 8s timeout + afterAll disconnect — 符合标杆模板 ✓
2. reLaunch 到 capture 页 + assert path — 正确 ✓
3. navigateTo analyzing 带完整 query — 正确 ✓
4. assert 全部 3 个 query 参数 (imageUrl + subject + qid) — 已补齐 ✓
5. 无 page.route mock / 无 vi.mock / 无 evaluate 后门 ✓
6. Phase 1 scope 合规: 只写 spec，不跑 automator ✓
7. 探索性风险已识别，Phase 2 可追踪 ✓

**结论**: PASS — spec 完整覆盖 capture→analyzing 转场契约，探索性边界已分析记录。
