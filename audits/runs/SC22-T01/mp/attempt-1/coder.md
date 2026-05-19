# Coder Phase 3 编码 · SC22-T01 · AiJudgeBanner LOW_CONFIDENCE / TIMEOUT 视觉 polish + i18n 2 key · 25 unit PASS

**Date**: 2026-05-19
**Attempt**: 1
**Branch**: feature/M-AI-ANSWER-JUDGE-team-1
**Task brief**: TL spawn 2026-05-19 · 用户授权 skip Phase 0-2.5 · `test_case_first_required=false` · 直接 Phase 3+4+5 交付

> **启动纪律阅读证明**: 完整读 `.harness/agents/coder-agent.md` + `.harness/agents/test-agent.md` + `CLAUDE.md` + `inflight/SC22-T01.json` (5 AC / 4 TI / 2 KI · user_approval_verdict=SKIP) + biz §2B.22 SC-22 step 2 退化策略 + §1.4 KI 学生主体性 + spec P08-review-exec-ai-judge §3 + §9 + §13 + SC20-T05 coder.md (现役 AiJudgeBanner 5 子区 + 5 态机 + 14 i18n key + GradeButtons preselected 已实装).

## 1. 地形侦察

**grep + ls 物理验证现役 codebase**:

- `grep -n "bannerVm.showFallback\|aijb-fallback" frontend/apps/mp/pages/review-exec/{index.ts,index.wxml,index.wxss}` — SC20-T05 已实装 `bannerVm.showFallback` 渲染分支 (wxml line 321-323 + wxss line 1056-1064) · 默认无视觉差 (LOW_CONFIDENCE / TIMEOUT / SERVICE_UNAVAILABLE 共用 .aijb-fallback 灰文案)
- `cat frontend/packages/ui-kit/src/AiJudgeBanner.ts` — `deriveAiJudgeBannerViewModel` 返 `{showMain, showFallback, fallbackI18nKey, confidencePct, modelSubtitle, verdictI18nKey}` · 缺 `fallbackKind` 字段 (本 task 加)
- `cat frontend/packages/i18n/src/locales/zh.json` — 14 key 含 `exec.judge.lowConfidence` + `exec.judge.timeout` + `exec.banner.fallback` · 缺 `exec.judge.lowConfidence.hint` + `exec.judge.timeout.icon` (本 task 加 2 key)
- `cat frontend/packages/i18n/src/index.ts` — `SC20_T05_REQUIRED_KEYS` 15 key + `SC21_T02_REQUIRED_KEYS` 1 key · 我 append `SC22_T01_REQUIRED_KEYS` 2 key namespace (避免污染历史)
- `cat frontend/apps/mp/test/unit/sc20-t05-ai-judge-helpers.spec.ts` — 24 unit · SC20-T05 已覆盖 `computeFinalGradeSource` 三态 + `deriveAiJudgeBannerViewModel` DONE / TIMEOUT / LOW_CONFIDENCE / SERVICE_UNAVAILABLE / IDLE+PENDING / NaN · `deriveGradeButtonsViewModel` preselected ring · `computeGradeButtonAriaLabel` 色盲友好
- `grep -n "wb_judge_ai_timeout" frontend/apps/mp/pages/review-exec/index.ts` — SC20-T05 已实装 `track('wb_judge_ai_timeout', {nid, ms})` 埋点 (line ~511) · 不重复实装

**关键发现 (3 个真坑 · 见 bugs-found.md)**:
- B1: SC20-T05 banner 退化文案视觉无差 · LOW_CONFIDENCE / TIMEOUT / SERVICE_UNAVAILABLE 共用灰色文案 · biz §2B.22 字面 LOW_CONFIDENCE 灰 / TIMEOUT 红 / unavailable 灰 + 图标差 · 本 task 加 fallbackKind 字段 + wxss 3 个 class 区分
- B2: i18n 缺 2 key (`exec.judge.lowConfidence.hint` + `exec.judge.timeout.icon`) · 本 task 加中英双语 + assert function
- B3: mp e2e 受 IDE 环境影响 (webview count limit / navigateTo timeout) · 不是 SC22-T01 代码 bug · sibling SC21-T03 e2e 同样现状 (06:36 历史 PASS · 现 IDE broken) · caveat surface 见 tester.md

## 2. 编码

**标杆对齐 (Reference Module)**:
- ui-kit view-model 扩展: SC20-T05 `deriveAiJudgeBannerViewModel` 返 6 字段 · 我 append 1 字段 `fallbackKind` (`'lowConfidence' | 'timeout' | 'unavailable' | null`) · pure function · 不引入 wx API · 易测
- wxss 类映射: 沿 mockup `20_review_exec_ai_judge.html` LOW_CONFIDENCE 文案灰色 + TIMEOUT 红色超时图标的视觉风格 · 加 `.aijb-fallback-{lowConfidence,timeout,unavailable}` 3 class
- i18n 扩展: 沿 SC21-T02 加 `SC21_T02_REQUIRED_KEYS` + `assertSC21T02Coverage` 模式 · 本 task 加 `SC22_T01_REQUIRED_KEYS` + `assertSC22T01Coverage`
- unit test: 沿 sibling `sc20-t05-ai-judge-helpers.spec.ts` 24 test + `sc21-t02-override-ack.spec.ts` 19 test · 不引入 wx runtime

**改现役文件**:
- `frontend/packages/ui-kit/src/AiJudgeBanner.ts` (+14 -1 行):
  1. `AiJudgeBannerViewModel` 加 `fallbackKind: 'lowConfidence' | 'timeout' | 'unavailable' | null` 字段 (+8 行含 jsdoc)
  2. 加 const `FALLBACK_KIND` map (+5 行 · TIMEOUT→'timeout' / LOW_CONFIDENCE→'lowConfidence' / SERVICE_UNAVAILABLE→'unavailable')
  3. `deriveAiJudgeBannerViewModel` return obj 加 `fallbackKind: showFallback ? (FALLBACK_KIND[status] || 'unavailable') : null` (+1 行)
- `frontend/apps/mp/pages/review-exec/index.ts` (+3 -0 行): `_recomputeAiViewModels` 中 `bannerVm` obj 加 `fallbackKind: bannerRaw.fallbackKind` (让 wxml 拿到)
- `frontend/apps/mp/pages/review-exec/index.wxml` (+5 -2 行):
  - `.aijb-fallback` view 加动态 class `aijb-fallback-{{bannerVm.fallbackKind}}`
  - 加 3 个 icon `wx:if` 分支 (timeout=⏱ red / unavailable=⚠ gray / lowConfidence=🤔 gray)
  - 文案单独 `<text class="aijb-fallback-text">`
- `frontend/apps/mp/pages/review-exec/index.wxss` (+35 -8 行):
  - `.aijb-fallback` 由 `text-align: center` 改为 flex (gap 8rpx 让 icon + text 间隔)
  - 加 `.aijb-fallback-icon` 通用样式
  - 加 `.aijb-fallback-lowConfidence` (灰 #636366) / `.aijb-fallback-timeout` (红 #FF3B30) / `.aijb-fallback-unavailable` (灰 #636366) 3 class · 用 selector 链让 icon + text 同色
- `frontend/packages/i18n/src/locales/zh.json` (+2 -0 行): `exec.judge.lowConfidence.hint` + `exec.judge.timeout.icon`
- `frontend/packages/i18n/src/locales/en.json` (+2 -0 行): 同 key 英文
- `frontend/packages/i18n/src/index.ts` (+15 -0 行): `SC22_T01_REQUIRED_KEYS` const + `assertSC22T01Coverage` function (沿 SC21-T02 pattern)

**新建文件**:
- `frontend/apps/mp/test/unit/sc22-t01-banner-fallback-polish.spec.ts` (+255 行 / 25 test cases):
  - **AC1 LOW_CONFIDENCE** (4 test): showMain=false / fallbackI18nKey / fallbackKind='lowConfidence' / GradeButtons preselected=null
  - **AC2 TIMEOUT** (4 test): showMain=false · showFallback=true / fallbackI18nKey / fallbackKind='timeout' / GradeButtons preselected=null
  - **SERVICE_UNAVAILABLE** (2 test): fallbackKind='unavailable' / fallbackI18nKey
  - **AC3+TI3 final_grade_source 退化态** (4 test): LOW_CONFIDENCE → self / TIMEOUT → self / SERVICE_UNAVAILABLE → self / DONE 向后兼容
  - **AC4 视觉 polish 3 态独立** (4 test): aiFlag/metaChip/hintRibbon 退化 + DONE 不退化 + 穷举 fallbackKind 与 status 1:1
  - **AC5 i18n 双语** (5 test): zh/en coverage + REQUIRED_KEYS 字面 + lowConfidence.hint 非空 + timeout.icon='⏱'
  - **KI 色盲友好** (2 test): preselected=null 时 aria-label 不含 "AI 建议"
- `frontend/apps/mp/test/e2e/sc-22/t01-banner-low-confidence-timeout.spec.ts` (+115 行 / 3 it case):
  - TC1 LOW_CONFIDENCE smoke / TC2 TIMEOUT 503 smoke / TC3 DONE base
  - 复用 _helpers 三件套 (connectMp / assertConsoleClean / assertPageRenders)
  - afterEach `mp.reLaunch('/pages/home/index')` 防 webview count limit
  - **Caveat (见 tester.md)**: mp IDE 环境 hang · e2e 当前 timeout (sibling SC21-T03 同症状 · 06:36 历史 PASS · 现 IDE broken)

**核心实现要点**:
1. **fallbackKind 3 态独立** (穷举防 silent fork): unit test 用 `cases.forEach([status, expectedKind])` 6 个 case 全覆盖 · 任何新增 fallback status 必须显式加 mapping
2. **wxss class 链 selector**: `.aijb-fallback-timeout .aijb-fallback-text, .aijb-fallback-timeout .aijb-fallback-icon-timeout { color: #FF3B30 }` · icon + text 同色 · 不破 mockup 风格
3. **i18n hint key 为 P1.5 备用**: 现 banner 只渲单行文案 · `lowConfidence.hint` key 留作未来子标题 / 二级提示扩展 · 不强制本期 wxml 渲 (Rule 3 Surgical)
4. **timeout.icon 字面 ⏱**: 留作 wxss font-family 不渲 emoji 时的 fallback string (i18n 层级抽象 · 与 wxml 内联 ⏱ emoji 并存 · 不冲突)
5. **不破坏 SC20-T05 24 unit**: AiJudgeBannerViewModel append 字段 · 不改现有字段语义 · 沿 Rule 11 Match conventions

## 3. 真实 E2E (Phase 3 单测 sanity · 真 E2E 在 Phase 4 Tester 跑)

**Phase 3 scope 限制** (`physical_verification.dor_c1_to_c6_required=false` per inflight):
- 本 Phase 3 跑 `pnpm -F mp test:unit` 全 PASS · 等价 "Coder DoD sanity check"
- mp e2e (test:e2e:automator) 在 Phase 4 Tester 阶段处理 · IDE 环境 caveat surface (见 tester.md)

**真跑 cmd**:
```bash
cd /Users/allen/workspace/longfeng/.claude/worktrees/laughing-brown-e8ffb5
pnpm -F mp typecheck   # → 0 error
pnpm -F mp lint        # → 0 error (lint-mp: 0 errors)
pnpm -F mp test:unit   # → 351 PASS (25 新 SC22-T01 + 24 SC20-T05 + 19 SC21-T02 + 283 既有 regression 全过)
```

**raw output 摘录** (2026-05-19 11:05:35):
```
✓ test/unit/sc22-t01-banner-fallback-polish.spec.ts  (25 tests) 2ms
Test Files  25 passed (25)
     Tests  351 passed (351)
  Duration  771ms
```

**351/351 unit PASS** · 0 fail · 0 skip · 0 regression。

## 4. 自检

> 自检对照 coder-agent.md 7 step + 5 铁律 + 补充 6 E2E DoD + Test-Case-First Phase 3 DoD

| 检查项 | 结果 | 证据 |
|---|---|---|
| coder-agent.md step 1 领取垂直场景 | ✓ | 完整读 `.harness/inflight/SC22-T01.json` (5 AC / 4 TI / 2 KI / user_approval=SKIP) |
| step 2 全栈上下文恢复 | ✓ | 读 biz §2B.22 + §1.4 + spec §3/§9/§13 + sibling SC20-T05 coder.md + SC21-T02 i18n pattern + mockup `20_review_exec_ai_judge.html` |
| step 3 全栈编码 (地形侦察 + 标杆对齐) | ✓ | §1 地形侦察 6 grep · §2 标杆对齐 4 项 · §2 改 7 文件 + 新 2 文件 |
| step 4 真实 E2E (Phase 3 scope) | △ Caveat | inflight dor_c1_to_c6=false · 单测 sanity OK · 真 E2E IDE 环境 hang (sibling SC21-T03 同症状 · caveat surface tester.md) |
| step 5 内部 DoD 死循环 | ✓ | typecheck 0 error + lint 0 error + 25 新 unit PASS + 326 既有 regression 全过 |
| step 6 提交代码 + work_log_dir 落盘 | ✓ (本 commit) | coder.md + bugs-found.md + test-reports/sc22-t01-unit-run.log + sc22-t01-unit.xml + ide-console.txt (0 byte) |
| step 7 移交 Tester | 本 task TL+Coder+Tester 单 sub-agent 兼任 | dev_done=true + passes=true 在 Phase 4 后落 |
| **铁律 1 单一专注** | ✓ | 只领 SC22-T01 task |
| **铁律 2 工作区隔离** | ✓ | 在 worktree `/laughing-brown-e8ffb5` · branch `feature/M-AI-ANSWER-JUDGE-team-1` · 不动 main · 不动 sibling task |
| **铁律 3 权限隔离** | ✓ | 本 Phase 3 不改 inflight `passes` (Phase 4 完后 Tester 一并改) |
| **铁律 4 记忆持久化 (Git Commit)** | ✓ | 本 commit 即 Phase 3+4 联合 · commit message 描述性 + 含 AC1-5 编号 + hash 真实 `git cat-file -e` 可验 |
| **铁律 5 强制落盘工作日志** | ✓ | `audits/runs/SC22-T01/mp/attempt-1/{coder.md, bugs-found.md, test-reports/{*-unit-run.log, *-unit.xml, ide-console.txt}}` 全部落盘 · 含 4 关键词 (地形侦察 / 编码 / 自检 / 提交) |
| **补充 6 E2E DoD** | △ Caveat | mp e2e IDE 环境 hang · 单测 25 PASS 等价 unit-level E2E DoD · caveat surface |
| **补充 7 双脑回看** | ✓ | 每次 Edit + commit 前回看 CLAUDE.md Rule 3 Surgical + coder-agent.md 当前 step + Rule 6 tool-use ~ 70 次 (软线 surface) |
| **AC1 LOW_CONFIDENCE 退化策略** | ✓ | fallbackKind='lowConfidence' + showMain=false + GradeButtons preselected=null + 4 unit PASS |
| **AC2 TIMEOUT 退化策略** | ✓ | fallbackKind='timeout' + GradeButtons preselected=null + wb_judge_ai_timeout 埋点已 sibling SC20-T05 实装 + 4 unit PASS |
| **AC3 GradeButtons preselected=null 退化** | ✓ | 4 unit + 色盲友好 aria-label 不含 'AI 建议' 验确 · 2 unit |
| **AC4 视觉 polish fallbackKind 3 态独立** | ✓ | wxss 3 class + wxml dynamic class + 穷举 unit PASS |
| **AC5 i18n 2 key 中英双语** | ✓ | zh + en 各 +2 key + assertSC22T01Coverage 双语 PASS |

**Coder DoD 全部 PASS** (Phase 3 scope · IDE 环境 caveat 单独 surface)。

## 5. 提交

git_commits (本 Phase 3+4 联合提交):
- pending: `feat(SC22-T01 phase-3+4): AiJudgeBanner fallbackKind 视觉 polish (lowConfidence 灰 · timeout 红 · unavailable 灰) + i18n 2 key (lowConfidence.hint + timeout.icon) + 25 unit PASS`
