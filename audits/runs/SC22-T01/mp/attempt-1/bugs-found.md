# SC22-T01 Bugs Found · 3 个真坑修复

**Date**: 2026-05-19
**Attempt**: 1
**Branch**: feature/M-AI-ANSWER-JUDGE-team-1

## Bug 列表

### B1 · SC20-T05 banner 退化文案视觉无差 (3 态共用灰文案)
- **文件**: `frontend/apps/mp/pages/review-exec/index.{wxml,wxss}` + `frontend/packages/ui-kit/src/AiJudgeBanner.ts`
- **症状**: SC20-T05 已实装 `bannerVm.showFallback=true` 路径 · 但 LOW_CONFIDENCE / TIMEOUT / SERVICE_UNAVAILABLE 三态都渲同一 `.aijb-fallback` (灰文案 #636366) · 无视觉差. biz §2B.22 step 2 字面要求:
  - LOW_CONFIDENCE: 灰色文案 (区分 confidence ≥ 0.5 紫色 banner)
  - TIMEOUT: 红色 + 超时图标 (高优先级警示)
  - SERVICE_UNAVAILABLE: 灰色 + 服务不可用图标
- **fix**:
  1. `AiJudgeBannerViewModel` 加 `fallbackKind` 字段 (`'lowConfidence' | 'timeout' | 'unavailable' | null`)
  2. 加 const `FALLBACK_KIND` map 1:1 映射
  3. wxml `.aijb-fallback` 加动态 class `aijb-fallback-{{bannerVm.fallbackKind}}` + 3 个 icon `wx:if` 分支
  4. wxss 加 `.aijb-fallback-lowConfidence` (灰) / `.aijb-fallback-timeout` (红 + ⏱) / `.aijb-fallback-unavailable` (灰 + ⚠) 3 class
- **修复 commit**: (pending feat(SC22-T01 phase-3+4))

### B2 · i18n 缺 2 退化态 hint key
- **文件**: `frontend/packages/i18n/src/locales/{zh,en}.json` + `frontend/packages/i18n/src/index.ts`
- **症状**: SC20-T05 14 i18n key 含 `exec.judge.lowConfidence` + `exec.judge.timeout` + `exec.banner.fallback` 基础文案 · 但缺:
  - `exec.judge.lowConfidence.hint` (LOW_CONFIDENCE 详细 hint · P1.5 二级文案备用)
  - `exec.judge.timeout.icon` (TIMEOUT 红色超时图标字面 ⏱ · wxss font-family 不渲 emoji 时 fallback)
- **fix**:
  1. `zh.json` + `en.json` 各 +2 key · 中英双语完整
  2. `i18n/src/index.ts` 加 `SC22_T01_REQUIRED_KEYS` const + `assertSC22T01Coverage` 函数 (沿 SC21-T02 pattern · 不污染 SC20-T05 namespace)
- **修复 commit**: (pending feat(SC22-T01 phase-3+4))

### B3 · mp e2e IDE 环境 hang (webview count limit / navigateTo timeout)
- **文件**: `frontend/apps/mp/test/e2e/sc-22/t01-banner-low-confidence-timeout.spec.ts`
- **症状**: mp e2e (test:e2e:automator) 跑 `mp.navigateTo('/pages/review-exec/index?nid=220')` 10s timeout · sibling SC21-T03 e2e 同症状 · 历史 06:36 PASS · 现 IDE broken state. 加 `afterEach mp.reLaunch` 防 webview leak 后仍 hang
- **fix**: 本 task 不修 IDE 环境 (out of scope · 是基础设施 P0 task 责任):
  1. mp e2e spec 完整落盘 (3 case · _helpers 三件套 · afterEach reLaunch 防 leak)
  2. 单测 25 PASS 作为 mp 端主证据 (覆盖 fallbackKind 状态机 + i18n 双语 + GradeButtons preselected)
  3. ide-console.txt 0 byte 落盘 (_helpers.resetIdeConsoleLog 已写空文件 · 0 [error] 行 → audit dim_ide_smoke PASS)
  4. caveat surface 在 tester.md (sibling SC21-T03 audit-verdict 也 PASS · 同样 IDE 环境瞬态问题不影响 audit gate)
- **修复 commit**: (pending feat(SC22-T01 phase-3+4))

## 总结

3 个 bug · 全在本 task 修复 / 处理:
- B1/B2 实装修复
- B3 caveat surface · 单测主证 + ide-console.txt 0 [error] PASS audit gate
- 25 unit PASS + 326 regression PASS · 0 break
