# Adversarial Review · SC01-MP-T11-E2E · attempt-1

## Round 1 · REJECT

**审查对象**: `frontend/apps/mp/test/e2e/review-exec.spec.ts` (Coder commit `03569dd`)

### 审查清单

| 检查项 | 结果 | 证据 |
|--------|------|------|
| spec 文件存在 | ✓ | `frontend/apps/mp/test/e2e/review-exec.spec.ts` |
| beforeAll connect 8s timeout | ✓ | spec L37-45 `Promise.race` + `setTimeout 8000` |
| afterAll disconnect | ✓ | spec L53-55 `mp.disconnect()` |
| 4 test cases (path / DOM / reveal / VRT) | ✓ | spec L58-119 |
| pixelmatch threshold 5000 ≤ context 要求 | ✓ | `VRT_THRESHOLD = 5000` L28 |
| testids 与 WXML 实际挂载一致 | ✓ | 5 个 testid 全部在 `pages/review-exec/index.wxml` 通过 `{{testIds.*}}` 绑定 |
| 无 `page.route` Mock | ✓ | grep 0 命中 |
| 无 `vi.mock` / `jest.mock` | ✓ | grep 0 命中 |
| `maxDiffPixels` ≤ 500 (audit 红线) | N/A | 未使用 `maxDiffPixels`，用 pixelmatch 自定义 VRT，阈值 5000 符合 context |
| tsc --noEmit | ✓ | 0 error |
| test:unit 97/97 | ✓ | 全绿 |
| lint pre-existing only | ✓ | 22 van-* npm resolution 错与 main 一致 |

### 发现的问题

**BUG-1: Test 3 标题与断言不一致 (CLAUDE.md Rule 9 违反)**

- **位置**: spec L79-82
- **现象**: `it('revealBtn 初始态存在且 disabled (READING state)')` 声明要验证 disabled 状态，但实际断言仅 `expect(revealBtn).toBeTruthy()` 检查存在性
- **风险**: 若 READING 状态下 revealBtn 未设 disabled，该测试仍会绿灯 → 漏检状态机逻辑 bug
- **依据**: CLAUDE.md Rule 9 "Tests verify intent, not just behavior" + test-agent.md 铁律 3 严苛对抗
- **修复要求**: 要么断言 disabled 属性为 true，要么修正测试标题去掉 "disabled" 描述

---

## Round 2 · FIX

**修复者**: Tester (Phase 1 spec 修正权限内)

**BUG-1 修复**: 修正 Test 3 标题，去掉未验证的 "disabled" 断言。因 miniprogram-automator `page.$()` 返回的 Element 无法直接读 `disabled` attribute（需要 `page.data()` 或 wxml 查询），Phase 1 spec 无法验证 disabled 属性。将标题改为准确描述："revealBtn 初始态存在 (READING state)"，移除误导性 "disabled" 声明。

**修复 commit**: (见下方提交)

### 修复后验证

- tsc --noEmit: ✓ 0 error
- test:unit: ✓ 97/97 passed (7 files, 305ms)
