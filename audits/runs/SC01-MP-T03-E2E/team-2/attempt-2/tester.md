# Tester Work Log · SC01-MP-T03-E2E · attempt-2 (REDO fix)

## 任务概要

- **Task**: SC01-MP-T03-E2E · P03 analyzing page E2E + VRT spec (Phase 1)
- **Phase**: 1 (spec only — 不跑 automator)
- **audit_gate**: lint + tsc + test:unit PASS + 强制 git commit
- **REDO from**: attempt-1 audit verdict (3 failures)

## Audit REDO 修复对照

| # | audit 失败项 | 根因 | 修复 |
|---|-------------|------|------|
| 1 | `maxDiffPixels_le_500` max=5000/500 OVER | tester.md 提及 5000 被 audit 扫描判超标 | 添加 VRT 阈值合理性说明（见下文） |
| 2 | `tester_md_testcase_count_matches_xml` no `<testcase>` in XML | test-reports/ 只有 .log 没有 JUnit XML | 用 `--reporter=junit` 重跑 vitest 输出 XML |
| 3 | `adversarial_has_exploratory_keywords` 1/2 minimum | adversarial.md 缺探索性关键词 | 补充 DOM 竞态 + 注入超长数据 + 截图阻断 3 个维度 |

## VRT 阈值合理性说明 (maxDiffPixels 5000)

本任务 inflight context 明确指定 `"scenario": "PHASE-C MP 真 E2E + VRT (阈值 5000 pixel) · page-vrt"`。5000 pixel 阈值源于：

1. **baseline 来源差异**: baseline PNG 由 Chromium 渲染 HTML mockup 生成，actual 由微信开发者工具 IDE 模拟器截图。两端渲染引擎不同（Chromium vs Skyline/WebView），字体渲染、抗锯齿、亚像素位移必然产生系统性 diff。
2. **test-agent.md 铁律 6**: "如确需放宽，必须在 tester.md 给出合理性说明"。本段即合理性说明。
3. **inflight 授权**: TL spawn 时已在 scope_in 中写明 `diff < 5000 pixel 判 PASS`。
4. **spec 实际值**: `expect(diffPixels).toBeLessThan(5000)` — 与 inflight 一致，未额外放宽。

## 物理验证

实际跑过的命令和结果：

```bash
# lint + tsc
pnpm -F mp run lint
# ✓ lint-mp: 0 errors (含 tsc --noEmit)

# test:unit with JUnit XML reporter
npx vitest run --config test/vitest.config.ts test/unit --reporter=junit > test-reports/vitest-unit.xml
# 97 <testcase> elements · 0 failures
```

**测试通过数**: 97 个 testcase passed (对应 JUnit XML 中 97 个 `<testcase>` 元素)

## 宣判

**PASS** — 3 项 audit REDO 原因全部修复：VRT 阈值有合理性说明、JUnit XML 97 testcase 与声明一致、探索性测试 3 个维度已补充。
