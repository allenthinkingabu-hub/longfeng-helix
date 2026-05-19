# Coder Phase 3 编码 · SC21-T02 · Override flow polish · 19 unit + 3 e2e PASS

**Date**: 2026-05-19
**Attempt**: 1
**Branch**: feature/M-AI-ANSWER-JUDGE-team-1
**Task brief**: TL+Coder+Tester 同 sub-agent · 用户授权 skip Phase 0-2.5 · test_case_first_required=false

> **启动纪律阅读证明**: 完整读 `.harness/agents/coder-agent.md` (145 行 · PASS 5 红线 + 铁律 5 + 补充 6 E2E DoD + 补充 7 双脑回看 + 7-step) + `.harness/agents/test-agent.md` (160 行) + `CLAUDE.md` (Rule 6 tool-use budget + audit.js 卡口) + `inflight/SC21-T02.json` (5 AC / 2 TI / 2 KI · SKIP Phase 0-2.5) + biz §2B.21 SC-21 步 2 ack CTA + SC20-T05 coder.md (sibling pattern) + 4 探勘点 (review-exec/index.ts SC20-T05 wired · testids/i18n/telemetry/ui-kit 现役 export).

## 1. 地形侦察

**grep + ls 物理验证现役**:

- `grep 'wb_judge_user_override\|wb_judge_user_accept' frontend/apps/mp/pages/review-exec/index.ts` → SC20-T05 已 wired track() · 我 append confidence prop 补全 (SC21-T02 AC3 增量)
- `grep 'overrideCta\|overrideAck' frontend/packages/testids/src/index.ts` → SC20-T05 已加 12 key 含 ctaOverride · 缺 overrideAckCta · 我加 1 个 (SC21-T02 AC5)
- `grep 'exec.judge.cta' frontend/packages/i18n/src/locales/zh.json` → SC20-T05 已加 14 i18n key 含 exec.judge.cta.{accept,override} · 缺 exec.judge.cta.overrideAck · 我加 1 (zh + en 双语)
- `grep 'onGradeTap' frontend/apps/mp/pages/review-exec/index.ts` → SC20-T05 已实装 computeFinalGradeSource (verdict != grade → ai_overridden) · isGrading debounce 防抖 + grade body 含 final_grade_source · AC1+AC3+AC4 都已实装 · 本 task 仅 AC2 (ack vm) + AC5 (testid+i18n) 是真增量
- `ls frontend/packages/ui-kit/src/` → AiJudgeBanner.ts / AiFlag.ts / AiMetaChip.ts / AiHintRibbon.ts / AiMark.ts / GradeButtons.ts 6 个 SC20-T05 落地 · 缺 OverrideAck.ts · 本 task 新增 1
- `ls frontend/apps/mp/test/unit/sc20-t05*` → SC20-T05 24 unit · 锁 helper logic · 我加 1 spec sc21-t02 (19 unit · AC1-5 严覆盖)
- `find frontend/apps/mp/test/e2e/sc-21/` → 不存在 · 新建目录 + 1 e2e spec

**关键发现 (0 bug · 1 trade-off)**:
- T1: SC21-T02 大部分 AC 是 SC20-T05 sibling 已 wired 的复用 + 验回归 · 真新增逻辑仅 1 helper (OverrideAck) + 1 testid + 1 i18n key + 5 行 onGradeTap setData · 严格遵循 Rule 3 Surgical Changes / Rule 2 Simplicity First

## 2. 编码

**标杆对齐 (Reference Module)**:
- ui-kit helper 标杆: `OverrideAck.ts` 沿 `AiHintRibbon.ts` 风格 (pure 函数 + props/vm interface · 0 wx runtime · 易单测)
- testid namespace: TEST_IDS.p08AiJudge 现役 12 key + 我加 1 (overrideAckCta)
- i18n 模板插值: 现役 `exec.banner.modelUsed` 用 {model} {latency} · 我新 `exec.judge.cta.overrideAck` 用 {grade}
- unit spec 标杆: `sc20-t05-ai-judge-helpers.spec.ts` (vitest describe/it + helper pure fn + locale i18n) · 我沿用结构
- e2e spec 标杆: `sc-20/t05-ai-judge-banner-components.spec.ts` (connectMp 三件套 + setupAiJudgeStub · 描述性中文 fixture) · 我精简到 3 TC

**改现役文件** (3 个 surgical):
- `frontend/packages/testids/src/index.ts` (+2 行 net · p08AiJudge namespace 末加 overrideAckCta · 沿 ai-judge-* prefix)
- `frontend/packages/i18n/src/locales/zh.json` (+1 key · `exec.judge.cta.overrideAck`)
- `frontend/packages/i18n/src/locales/en.json` (+1 key · 双语完整)
- `frontend/packages/i18n/src/index.ts` (+14 行 · SC21_T02_REQUIRED_KEYS + assertSC21T02Coverage · 不污染 SC20 数组)
- `frontend/packages/ui-kit/src/index.ts` (+4 行 · export OverrideAck)
- `frontend/apps/mp/pages/review-exec/index.ts` (+25 行 · import deriveOverrideAckViewModel + data.overrideAckVm 初值 + onGradeTap 计算 ack 文案 + telemetry confidence 字段)
- `frontend/apps/mp/pages/review-exec/index.wxml` (+8 行 · wx:if overrideAckVm.visible 渲染 ack 行)
- `frontend/apps/mp/pages/review-exec/index.wxss` (+13 行 · .aijb-override-ack 紫色 8% 背景 + 4rpx 左边框)

**新建文件** (3 个):
- `frontend/packages/ui-kit/src/OverrideAck.ts` (+58 行 · deriveOverrideAckViewModel pure 函数 · 3 件触发条件 visible · grade 字面 + i18n key 返)
- `frontend/apps/mp/test/unit/sc21-t02-override-flow.spec.ts` (+155 行 · 19 unit test · 5 描述区块: AC1 回归 + AC2 ack vm 5 case + AC5 i18n 5 case + AC3 telemetry 2 case + AC4 视觉回归 2 case)
- `frontend/apps/mp/test/e2e/sc-21/t02-override-flow.spec.ts` (+76 行 · 3 e2e TC · connectMp 三件套 + describe-性中文 fixture · IDE Console 0 [error] 兜底)

**核心实现要点**:

1. **AC2 ack vm 派生** (OverrideAck.ts): 3 件触发条件 同时满足 → visible=true (finalGradeSource='ai_overridden' AND aiStatus='DONE' AND aiVerdict!==null) · 防御性 2 件防御 (任何不一致 → visible=false silent fallback · Rule 12 fail loud)

2. **AC2 i18n 模板插值**: `translate(zh, 'exec.judge.cta.overrideAck', { grade: '未掌握' })` → "你选择了 未掌握 · 与 AI 不同 (这有助于我们改进 AI)" · 调用端先 translate grade key 拿 verdict label · 再 translate ack key 用 label 插值

3. **AC3 telemetry confidence 字段补全**: SC20-T05 已发 `wb_judge_user_override{nid, ai_verdict, user_verdict}` · 本 task 加 `confidence` 字段 (从 `this.data.aiJudgeConfidence` 拿) · 单元化由 sc21-t02 unit AC3 case 2 锁定

4. **AC4 视觉回归 (零变更 · 仅验回归)**: SC20-T05 deriveGradeButtonsViewModel preselected ring 切换由 24 unit case 严覆盖 · 本 task 加 2 case 验 `isGrading=true → 所有 btn disabled` + `revealed=false (GRADED 后) → 所有 btn disabled` 边界

5. **AC5 testid + i18n 完整性**: testids 加 1 key (字面 `ai-judge-override-ack-cta`) · i18n 加 1 key (双语 · zh "你选择了 X · 与 AI 不同" / en "You chose X · differs from AI") · SC21_T02_REQUIRED_KEYS const · assertSC21T02Coverage 单元化校验

6. **TI2 防抖**: SC20-T05 `onGradeTap` 第一行 `if (this.data.isGrading) return` 已实装防抖 · 重复 tap 不重复 track · 本 task 不改 · 单元化由 sc21-t02 unit TI2 case 1 锁定 (telemetry buffer 仅 1 条)

**反作弊点物理验证**:
- 19 unit test PASS · vitest 真跑 · 326/326 全 regression PASS (含 SC20-T05 24 + SC20-T04 6 + home 35 + weekly 36 + ...)
- 3 e2e test PASS · IDE Console 0 [error] 行 (ide-console.txt 0 byte · 真 IDE WS 9420 连接 · 真渲染 P08 page)
- i18n 双语完整: assertSC21T02Coverage(zh).pass===true && assertSC21T02Coverage(en).pass===true (sc21-t02 unit case AC5)
- mock_total: SC21-T02 unit 0 mock (pure fn helper · 0 vi.mock) · e2e 1 mockWxMethod (描述性中文表达 setupOverrideStub) · 总 1 ≤ 5 红线

## 3. 真实 E2E

**环境**:
- 真 IDE WS @ 9420 端口 (sandbox multi-worktree 兼容 · 单独跑本 spec 不与 sibling 冲突)
- vitest + miniprogram-automator 真 IDE 连接 · 不裸 vi.mock 跨进程
- _helpers.ts 三件套 (connectMp + assertConsoleClean + assertPageRenders) 全用

**真跑 cmd**:
```bash
cd frontend/apps/mp
pnpm test:unit  # 326/326 PASS · 含 SC21-T02 19 unit + 全 regression
pnpm exec vitest run --config test/vitest.config.ts test/e2e/sc-21/t02-override-flow.spec.ts  # 3 e2e PASS · 15.61s
```

**raw output 摘录** (test-reports/coder-sanity-run.log):
```
✓ test/unit/sc21-t02-override-flow.spec.ts  (19 tests) 1ms
 Test Files  24 passed (24)
      Tests  326 passed (326)
   Duration  756ms
```

e2e 摘录:
```
✓ test/e2e/sc-21/t02-override-flow.spec.ts  (3 tests) 15096ms
 Test Files  1 passed (1)
      Tests  3 passed (3)
   Duration  15.61s
```

**spec trace 对照表**:

| AC/TI | 单元化 (unit) | 描述性 e2e (vitest + automator) | 反作弊证据 |
|---|---|---|---|
| AC1 回归 ai_overridden | sc21-t02 unit AC1 5 case | t02-override-flow TC1 渲染 + console | computeFinalGradeSource pure fn · 0 mock |
| AC2 ack vm visible | sc21-t02 unit AC2 5 case | t02-override-flow TC1 实装在 wxml | deriveOverrideAckViewModel pure fn · 描述性中文 fixture |
| AC3 telemetry confidence | sc21-t02 unit AC3 2 case | (实装由 onGradeTap setData) | track() 真发 · __getBuffer() 真验 |
| AC4 视觉回归 preselected | sc21-t02 unit AC4 2 case + SC20-T05 24 unit | t02-override-flow TC2 smoke | gradeBtnsVm pure fn 派生 |
| AC5 testid + i18n | sc21-t02 unit AC5 5 case | (testid 真挂 wxml · run-time render 验) | assertSC21T02Coverage pure fn |
| TI1 单一入口 (tap CTA = tap btn) | SC20-T05 sibling unit | (SC20-T05 sibling) | onAcceptCtaTap synth event 调 onGradeTap |
| TI2 防抖 | sc21-t02 unit TI2 1 case | (实装 SC20-T05 已 wired) | isGrading guard 第一行 return |

## 4. 自检

**lint + typecheck**:
- `pnpm -F mp typecheck` → 0 error (2026-05-19 10:17)
- `pnpm -F mp lint` → 0 error (lint-mp clean)
- `pnpm -F mp test:unit` → 326/326 PASS (含 SC21-T02 19 + regression 307)
- e2e: 3/3 PASS · 15.61s · IDE Console 0 [error]

**反省自检** (coder-agent.md 7 step + 5 铁律 · 逐条):

- ✓ Step 1-3 地形 + 标杆 + 编码 (8 file 改 + 3 file 新 + grep 物理验)
- ✓ Step 4 真实 E2E (3 spec PASS · IDE Console 干净 · _helpers 三件套)
- ✓ Step 5 内部 DoD 死循环 (typecheck 0 + lint 0 + unit 326/326 + e2e 3/3)
- ✓ Step 6 提交 (本文档 + bugs-found.md 落 work_log_dir)
- ✓ Step 7 改 inflight + commit · 单 commit 含 phase-3 + phase-4

**5 铁律自查**:
- ✓ 铁律 1 单一专注 (SC21-T02 唯一)
- ✓ 铁律 2 工作区隔离 (feature/M-AI-ANSWER-JUDGE-team-1 · worktree laughing-brown-e8ffb5)
- ✓ 铁律 3 权限隔离 (Coder 阶段不改 passes=true · Tester 阶段改)
- ✓ 铁律 4 Git Commit 描述性 (feat(SC21-T02 phase-3+4) 前缀)
- ✓ 铁律 5 强制落盘 (coder.md + bugs-found.md + tester.md + adversarial.md + test-reports/ 4 件 全)
- ✓ 铁律 7 E2E spec 用 _helpers 三件套 (connectMp + assertConsoleClean + assertPageRenders 全用)

**PASS 5 红线**:
1. ✓ unit + integration + e2e 全绿 (19 + 3 = 22 PASS · 326/326 regression)
2. ✓ 真 IDE Console 0 [error] (ide-console.txt 0 byte · audit dim_ide_smoke 严)
3. ✓ 页面渲染元素数 ≥ 阈值 (assertPageRenders P08 ≥ 5 view · TC1/2/3 PASS)
4. ✓ 网络请求真返预期 (mockWxMethod 描述性中文 fixture · onGradeBody capture body 字面验)
5. ☐ VRT < 500 pixel (本 task 无 VRT baseline · 仅渲染 smoke · audit maxDiffPixels n/a)

## 5. 提交

git_commits (本阶段单 commit · Coder + Tester 同 sub-agent):
1. `feat(SC21-T02 phase-3+4): override ack CTA + telemetry confidence + i18n exec.judge.cta.overrideAck · 19 unit + 3 e2e PASS`

**Coder DoD 达成证据**:
- 326/326 unit PASS · raw log audit/runs/.../test-reports/coder-sanity-run.log
- 3/3 e2e PASS · ide-console.txt 0 [error]
- typecheck + lint 0 error
- 反作弊 mock_total=1 (描述性中文 fixture) · ≤ 5 红线
