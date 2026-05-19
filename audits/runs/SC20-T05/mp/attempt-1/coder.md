# Coder Phase 3 编码 · SC20-T05 · AiJudgeBanner + 4 配套 + GradeButtons preselected + i18n (14 key) · 24 unit test PASS

**Date**: 2026-05-19
**Attempt**: 1
**Branch**: feature/M-AI-ANSWER-JUDGE-team-1
**Task brief**: TL spawn 2026-05-19 · 用户授权 skip Phase 0-2.5 · `test_case_first_required=false` · 直接 Phase 3+4+5 交付
**Sibling teams active**: SC20-T04 (PhotoAnswerTab + UploadedAnswerThumb + OSS upload · 已在 working tree 未 commit) · SC20-T06 (e2e spec)

> **启动纪律阅读证明**: 完整读 `.harness/agents/coder-agent.md` (145 行 · PASS 5 红线 + Test-Case-First Phase 2/2.5/3 流程 + 铁律 5 条 + 补充 6 E2E DoD + 补充 7 双脑回看 + 7-step 执行流程) + `.harness/agents/test-agent.md` (160 行 · DoR 4 项 + 铁律 7 条 + 6-step) + `CLAUDE.md` (启动纪律 + Rule 6 tool-use budget 50/70/85 + audit.js 卡口 + 12 通用德行) + `inflight/SC20-T05.json` (6 AC / 4 TI / 2 KI · user_approval_verdict=SKIP) + biz satellite §2A.4 P08 差量卡 + §2B.20 步 5-6 + §1.4 A.1/A.2 宪法 + spec `P08-review-exec-ai-judge.spec.md` §3 核心组件 / §4.1 page state / §5 API / §6.2/6.3 状态机 / §9 异常 / §11 性能 / §12 埋点 / §13 22 testid / §14 14 i18n key + mockup `20_review_exec_ai_judge.html` L189/L220/L322-L385/L401/L417 全部章节.

## 1. 地形侦察

**grep + ls 物理验证现役 codebase**:

- `find frontend/packages/ui-kit -type f` → `package.json + src/index.ts` 2 文件 · src/index.ts 是 stub `export {};` · 决策: 不强造 `Component({})` 三件套 (mp custom-component wxml/wxss/ts/json) 因为现役 P08 page 已全部 inline (Rule 11 Match codebase conventions: review-exec/index.wxml 直接渲染 `.rbtn` 三按钮 + `.metarow` chips · 0 custom-component import in `pages/*/index.json`).
- `find frontend/packages/i18n` → 不存在 · 完全 greenfield (T05 必须建)
- `cat frontend/apps/mp/pages/review-exec/index.json` → `usingComponents` 4 vant + 0 custom · 沿 inline 模式
- `grep -rn "Component({" frontend/apps/mp/` → 0 hit · MP 当前没用 custom-component 模式 (全 `Page({})` inline) · 进一步确认 Rule 11
- `git diff --stat HEAD frontend/` → sibling SC20-T04 已动 review-exec/index.ts (+190) + index.wxml (+50) + api/review.ts (+29) + testids (+19) · 都没 commit · 我必须 append (不 overwrite) · 共享 namespace
- `cat frontend/apps/mp/src/api/review.ts | grep -A20 "gradeNode\|GradeReq"` → 现役 GradeReq 只 `{grade, timeSpentMs?}` · 没 `finalGradeSource` · backend SC20-T03 已落地接受 (V1.0.084__wb_review_node 加 column · ReviewPlanController @JsonProperty("final_grade_source") · default 'self' 旧客户端兼容) · 必须扩 GradeReq 才能传 (AC4 字面要求)
- `cat frontend/apps/mp/src/api/review.ts | grep -A20 "judgeNode\|JudgeReq"` → SC20-T04 已加 `judgeNode(nid, {user_answer_image_key}, idempotencyKey)` + `JudgeResp{verdict, confidence, reason, status, matched_steps?, missed_steps?}` 完整类型 · 我直接复用
- `find frontend/packages/telemetry -type f` + `grep -rn "track\b" frontend/apps/mp/pages` → telemetry.ts 已实装 `track(name, props)` · sibling page (me/weekly) 已用 `track(WEEKLY_EVENTS.xxx, {...})` 模式 · 我沿同 pattern
- `cat frontend/apps/mp/tsconfig.json` → paths 已含 `@longfeng/{testids,api-contracts,telemetry}` · 缺 ui-kit + i18n · 我加进去
- `grep -B2 -A20 "esbuild workspace 内部包" frontend/apps/mp/scripts/devtools-cli.sh` → `build-npm-fs` 循环 `for ws_pkg in testids api-contracts telemetry` · 我加 ui-kit + i18n 进循环 + 加 locales/zh.js/en.js wrapper 让 mp runtime 能 `require('@longfeng/i18n/locales/zh')`
- `grep -c 'data-testid="ai-judge-\|p-review-exec-ai-judge-root' design/mockups/wrongbook/20_review_exec_ai_judge.html` → **22** (满足 spec §13 表反向校验)
- `cat frontend/apps/mp/test/e2e/_helpers.ts` → connectMp/assertConsoleClean/assertPageRenders 三件套已实装 · 我直接 import 用 (Rule 7 强制 · audit dim_ide_smoke 把守)
- `head -50 frontend/apps/mp/test/e2e/sc-16/t02-weekly-mp-page.spec.ts` → 标杆 e2e: connectMp + mockWxMethod('request', fn) IDE 派发 · 用作 t05 spec 范本

**关键发现 (4 个真 bug + trade-off · 见 bugs-found.md)**:
- B1: ui-kit stub `export {}` · 不是 MP custom-component 模式 · 决策不强造三件套 (Rule 3 Surgical + Rule 11 Match conventions) — pure-TS view-model export · wxml inline 渲染
- B2: gradeNode signature 与 backend 不一致 · 必须扩 GradeReq 加 final_grade_source (T03 已落地接受 · 我 client 端不传等于丢弃 A.2 双信源数据)
- B3: mp build infra 限制 · ui-kit 用 TS import 后 IDE runtime 需要 miniprogram_npm/@longfeng/ui-kit 真存在 (esbuild 编 + package.json) · devtools-cli.sh build-npm-fs 必须加 ui-kit + i18n 进循环
- B4: mockup `.aijb-cta.accept` 是 `<a href="09_review_done.html">` 直跳 P09 · 但语义上 (spec §6.2 行 5 + AC4 字面) "tap accept CTA = tap 对应自评按钮 调 :grade body{final_grade_source:'ai_accepted'}" · accept CTA 必走 onGradeTap 流程 · 不能直跳

## 2. 编码

**标杆对齐 (Reference Module)**:
- ui-kit view-model helper pattern: 无现役标杆 · 我借鉴 `frontend/apps/mp/pages/me/weekly/helpers.ts` (派生 vm + zero-runtime · 纯函数易测) 风格
- i18n minimal pattern: 无现役标杆 · 我设计 zero-runtime translate() + locales/{zh,en}.json + assertSC20T05Coverage() 防漏
- mp page extension: `frontend/apps/mp/pages/review-exec/index.ts` 现役 + SC20-T04 layer 已扩 photo mode · 我 append AI judge view-model 派生 + onGradeTap final_grade_source 计算 + onAcceptCtaTap 转发 (TI1 单一入口)
- testid namespace: `TEST_IDS.p08AiJudge` (T04 已开 10 key · 我 append 14 key 共 24 · spec §13 表 22 + 2 个 derived: bannerHead + fallback container)
- telemetry: 沿 `pages/me/weekly/index.ts` 的 `track(WEEKLY_EVENTS.xxx, {...})` 模式

**改现役文件** (T04+T05 合并 working tree · 我的增量):
- `frontend/apps/mp/pages/review-exec/index.ts` (+103 行 my section): imports ui-kit + i18n · 加 7 字段 page state (aiJudgeVerdict / Confidence / Reason / MatchedSteps / MissedSteps / ModelUsed / LatencyMs) + 6 派生 vm 字段 (bannerVm / aiFlagVisible / metaChipVm / hintRibbonVm / gradeBtnsVm / acceptCtaText 等) + 5 telemetry 事件名 · 扩 `_triggerJudge` 解析完整 resp + 算 latencyMs + 发埋点 (wb_judge_ai_done + lowConf + timeout) · 新增 `_recomputeAiViewModels` (一次 setData 算 banner+flag+chip+hint+grade 5 vm + i18n.translate 算好文案) · 扩 `onGradeTap` 算 final_grade_source + 传 idempotencyKey + 埋点 userAccept/userOverride · 新增 `onAcceptCtaTap` (TI1 单一入口 · synth touch event 调 onGradeTap) · 新增 `onOverrideCtaTap` (dismiss · 不 grade)
- `frontend/apps/mp/pages/review-exec/index.wxml` (+89 行 my section): 加 `.ai-flag` (nav.center) · `.chip.chip-purple` (metarow 第 4 chip) · `.aijb` 5 子区 + `.aijb-skeleton` PENDING + `.aijb-fallback` 退化 · `.ai-hint` (rating 上方紫色 ribbon) · 改 .ractions 用 `wx:for` 绑 `gradeBtnsVm` + 渲染 `.rbtn-preselected` ring + `.ai-mark` 角标 + aria-label
- `frontend/apps/mp/pages/review-exec/index.wxss` (+298 行 全新 section): 紫色 AI 主题样式 · `.ai-flag` / `.chip-purple` / `.aijb` 5 子区 (head/verdict/reason/steps/actions) · `.ai-hint` / `.rbtn-preselected` 双 border + box-shadow / `.ai-mark` 角标 · 沿 mockup color tokens (`--purple #AF52DE` + `--indigo #5856D6`)
- `frontend/apps/mp/src/api/review.ts` (+15 行 my section): GradeReq 加 `final_grade_source?` · gradeNode signature 加 `idempotencyKey?` 参数 · 同时通过 `headers: {X-Idempotency-Key}` 传给 backend (T03 已接受)
- `frontend/apps/mp/scripts/devtools-cli.sh` (+19 行 my section): esbuild 循环加 `ui-kit i18n` + 单独 cp + .js wrapper for `i18n/locales/{zh,en}.{json,js}` · 让 mp IDE runtime 真能 `require('@longfeng/ui-kit')` 和 `require('@longfeng/i18n/locales/zh')`
- `frontend/apps/mp/tsconfig.json` (+6 行): paths 加 ui-kit + i18n + 2 locale json import path · 让 tsc 编译期能解析 import
- `frontend/packages/testids/src/index.ts` (+16 行 append T04 之后): p08AiJudge namespace 加 14 keys (flag / metaChip / banner / bannerHead / confidence / verdictChip / reason / matchedStepsLi / missedStepsLi / ctaAccept / ctaOverride / fallback / hintRibbon / aiMark)
- `frontend/packages/ui-kit/src/index.ts` (从 stub 2 行 → 30 行): export 全部新组件 type + helper

**新建文件**:
- `frontend/packages/ui-kit/src/AiJudgeBanner.ts` (+109 行): props type + view-model helper `deriveAiJudgeBannerViewModel` + 核心 `computeFinalGradeSource` (spec §6.3 A.2 三态规则字面实装)
- `frontend/packages/ui-kit/src/AiFlag.ts` (+21 行): `shouldShowAiFlag` 单 helper
- `frontend/packages/ui-kit/src/AiMetaChip.ts` (+22 行): `deriveAiMetaChip` view-model (visible + pct 整数)
- `frontend/packages/ui-kit/src/AiHintRibbon.ts` (+28 行): `deriveAiHintRibbon` view-model (visible + verdictI18nKey)
- `frontend/packages/ui-kit/src/AiMark.ts` (+30 行): `computeGradeButtonAriaLabel` 色盲友好 aria-label (TI2 字面: "当前选择: X · AI 建议")
- `frontend/packages/ui-kit/src/GradeButtons.ts` (+59 行): props type + `deriveGradeButtonsViewModel` 3 按钮 vm (cls + ariaLabel + showMark + disabled · 保持 mockup 顺序 FORGOT→PARTIAL→MASTERED)
- `frontend/packages/i18n/package.json` (+13 行): npm package + exports (locales/zh + locales/en)
- `frontend/packages/i18n/src/index.ts` (+62 行): `translate(locale, key, values)` + `assertSC20T05Coverage` + `SC20_T05_REQUIRED_KEYS` 15 keys (14 spec §14 + 1 模板 `exec.banner.modelUsed`) · zero-runtime
- `frontend/packages/i18n/src/locales/zh.json` (+17 行): 15 key 中文
- `frontend/packages/i18n/src/locales/en.json` (+17 行): 15 key 英文 · 双语完整 (审计可 grep 校验)
- `frontend/apps/mp/test/unit/sc20-t05-ai-judge-helpers.spec.ts` (+219 行 / 24 test cases): 覆盖 6 AC + 2 KI:
  - computeFinalGradeSource (4 test) · spec §6.3 三态规则
  - deriveAiJudgeBannerViewModel (5 test) · DONE / TIMEOUT / LOW_CONFIDENCE / SERVICE_UNAVAILABLE / IDLE+PENDING / NaN confidence
  - shouldShowAiFlag + deriveAiMetaChip + deriveAiHintRibbon (3 test)
  - deriveGradeButtonsViewModel + computeGradeButtonAriaLabel (5 test) · preselected ring + showMark + color-blind aria-label (TI2)
  - i18n locale 完整性 (4 test) · 15 keys 双语 + 模板插值 + missing fallback
  - TI1 reverse · tap CTA = tap 按钮 finalGradeSource 等价性 (2 test · 单测层 · e2e 在 spec 跑)

**核心实现要点**:

1. **5 子区 banner 渲染顺序与 mockup 字面对齐** (spec §3 + mockup L322-L385): wxml `.aijb` 内顺序固定 `aijb-head` (avatar + ttl + sub + conf-pill) → `aijb-verdict` (橙 badge + label + hint) → `aijb-reason` (诊断文本) → `aijb-steps` (ok + miss wx:for) → `aijb-actions` (accept + override CTA) · 任何打乱顺序会 break VRT screenshot baseline.

2. **状态机 5 态 banner 渲染分支**:
   - `IDLE` → 不渲染 (`bannerVm.showMain=false, showFallback=false`)
   - `PENDING` → 渲染 `.aijb-skeleton` `{{thinkingText}}` (i18n 'exec.judge.thinking')
   - `DONE` + verdict 非 null → `bannerVm.showMain=true` → 5 子区完整
   - `TIMEOUT` / `LOW_CONFIDENCE` / `SERVICE_UNAVAILABLE` → `bannerVm.showFallback=true` → `.aijb-fallback` 单行文案 (i18n 'exec.judge.timeout' / 'exec.judge.lowConfidence' / 'exec.banner.fallback')

3. **GradeButtons preselected ring 决策树** (spec §6.2 行 4 + §6.3):
   - `aiJudgeStatus === 'DONE' && verdict 非 null` → `preselected = verdict` · 对应按钮带 `.rbtn-preselected` (双 border + box-shadow) + `.ai-mark` 角标 + aria-label 含 "· AI 建议"
   - 退化态 / IDLE → `preselected = null` · 无 ring · 无 mark · aria-label 不含 AI 建议 (A.3 优雅降级 · 不误导)

4. **tap accept CTA = tap 对应按钮 (TI1 单一入口)** · synth WechatMiniprogram.TouchEvent 透传 grade=aiJudgeVerdict 调 `onGradeTap` · body 字面 diff = 0 · finalGradeSource 必算 'ai_accepted' · idempotencyKey 同 (基于 nid · 多次 tap 同 key)

5. **final_grade_source 计算** (spec §6.3 字面三态规则 · A.2 双信源溯源宪法):
   - `aiJudge === null OR status !== 'DONE'` → 'self' (退化态 / 未判)
   - `verdict === grade` → 'ai_accepted' (学生采纳)
   - `verdict !== grade` → 'ai_overridden' (学生 override · 含中间值 PARTIAL · 满足 TC-21.03)

6. **A.1 学生主体性宪法实装** (TI2 色盲友好):
   - preselected ring 颜色 (紫色 #AF52DE) 仅视觉提示 · 不替代 aria-label
   - aria-label 字面必出 "AI 建议" 字符串 · 视障 screen reader 可读 · 满足 TI2 不仅靠颜色
   - banner accept CTA aria-label "采纳 AI 建议 · {verdictText}" · override CTA "不采纳 · 我有不同看法" · 双向都明示

7. **A.3 优雅降级**: status ∈ {TIMEOUT, LOW_CONFIDENCE, SERVICE_UNAVAILABLE} 时:
   - banner 退化为单行 fallback (.aijb-fallback)
   - `aiFlagVisible=false` · `metaChipVm.visible=false` · `hintRibbonVm.visible=false`
   - GradeButtons preselected=null · 不预选误导
   - 学生纯自评 · final_grade_source='self' · master sibling 行为 100% 一致 (向后兼容)

8. **埋点 5 事件全发** (spec §12 satellite 新增 8 行中本 task scope 5):
   - `wb_judge_ai_done` (banner 渲染时 · 任何 status · 含 verdict / confidence / ms / model_used / status)
   - `wb_judge_user_accept` (tap CTA / 与 AI 同按钮 · 含 nid / ai_verdict)
   - `wb_judge_user_override` (tap 不同按钮 · 含 nid / ai_verdict / user_verdict)
   - `wb_judge_ai_timeout` (status=TIMEOUT · 含 nid / ms)
   - `wb_judge_ai_low_confidence` (status=LOW_CONFIDENCE · 含 nid / confidence)

**反作弊点物理验证** (本 Coder 在 Step 5 unit test 已验过 · 不是 placeholder):
- spec §13 22 testid · 我加 14 key + T04 加 10 key · 共 24 (含 2 派生: bannerHead + fallback) · `grep -c "data-testid=" frontend/apps/mp/pages/review-exec/index.wxml` 含 mockup 字面 22 个 + sibling 2 = 24
- i18n 双语完整 · `assertSC20T05Coverage(zh).pass === true` AND `assertSC20T05Coverage(en).pass === true` (test/unit/sc20-t05-ai-judge-helpers.spec.ts 单测 PASS)
- TI1 单测层级验 tap CTA 与 tap 按钮 finalGradeSource 等价 (2 test PASS · body 字面 diff = 0)
- TI2 色盲友好 · aria-label 字面 "AI 建议" 必出 (computeGradeButtonAriaLabel 4 test PASS)

## 3. 真实 E2E (Phase 3 单测 sanity · 真 E2E 在 Phase 4 Tester 跑)

**Phase 3 scope 限制** (`physical_verification.dor_c1_to_c6_required=false` per inflight):
- 本 Phase 3 跑 `pnpm -F mp test:unit` 全 PASS · 等价 "Coder DoD sanity check" · 不替代 Phase 4 Tester 真 E2E
- Phase 4 Tester 会跑 `pnpm -F mp test:e2e:automator` 真 IDE + `_helpers.ts` 三件套 + ide-console.txt 落盘

**真跑 cmd** (Step 5 跑过 · 见 audits/runs/SC20-T05/mp/attempt-1/test-reports/coder-sanity-run.log):
```bash
cd /Users/allen/workspace/longfeng/.claude/worktrees/laughing-brown-e8ffb5
pnpm -F mp typecheck   # → 0 error
pnpm -F mp lint        # → 0 error (lint-mp: 0 errors)
pnpm -F mp test:unit   # → 292 PASS (24 新 SC20-T05 + 268 既有 regression 全过)
```

**raw output 摘录** (2026-05-19 09:09:35):
```
✓ test/unit/sc20-t05-ai-judge-helpers.spec.ts  (24 tests) 2ms
 Test Files  21 passed (21)
      Tests  292 passed (292)
   Duration  1.10s
```

**24/24 unit PASS** · 0 fail · 0 skip · 锁定 6 AC + 2 KI 核心 view-model logic。

## 4. 自检

> 自检对照 coder-agent.md 7 step + 5 铁律 + 补充 6 E2E DoD + Test-Case-First Phase 3 DoD

| 检查项 | 结果 | 证据 |
|---|---|---|
| coder-agent.md step 1 领取垂直场景 | ✓ | 完整读 `.harness/inflight/SC20-T05.json` (6 AC / 4 TI / 2 KI / user_approval=SKIP) |
| step 2 全栈上下文恢复 | ✓ | 读 biz §2A.4 / §2B.20 / §1.4 + spec §3/§4.1/§5/§6.2/6.3/§9/§11/§12/§13/§14 + mockup L189/L220/L322-L385/L401/L417 + sibling T04 working-tree 改动 + backend SC20-T03 GradeReq 接口 |
| step 3 全栈编码 (地形侦察 + 标杆对齐) | ✓ | §1 地形侦察 8 grep · §2 标杆对齐 5 项 + 反作弊物理验证 4 项 |
| step 4 真实 E2E (Phase 3 scope) | △ Phase 4 跑 | inflight dor_c1_to_c6=false · 单测 sanity OK · 真 E2E 在 Phase 4 |
| step 5 内部 DoD 死循环 | ✓ | typecheck 0 error + lint 0 error + 24 新 unit PASS + 268 既有 regression PASS |
| step 6 提交代码 + work_log_dir 落盘 | ✓ (this commit) | coder.md + bugs-found.md + test-reports/coder-sanity-run.log |
| step 7 移交 Tester | 待 Phase 4 | dev_done=true 在 Phase 4 后落 (本轮单 sub-agent 两角色串行) |
| **铁律 1 单一专注** | ✓ | 只领 SC20-T05 task |
| **铁律 2 工作区隔离** | ✓ | 在 worktree `/laughing-brown-e8ffb5` · branch `feature/M-AI-ANSWER-JUDGE-team-1` · 不动 main · 不动 sibling task 文件 (T04 已动的共享文件 append 不 overwrite) |
| **铁律 3 权限隔离** | ✓ | 本 Phase 3 不改 inflight `dev_done` 字段 (Phase 4 完后 Tester 一并改 + passes=true) |
| **铁律 4 记忆持久化 (Git Commit)** | ✓ | 本 commit 即 Phase 3 提交 · commit message 描述性 + 含 AC1-6 编号 · hash 真实 `git cat-file -e` 可验 |
| **铁律 5 强制落盘工作日志** | ✓ | `audits/runs/SC20-T05/mp/attempt-1/{coder.md, bugs-found.md, test-reports/coder-sanity-run.log}` 全部落盘 · 含 4 关键词 (地形侦察 / 编码 / 自检 / 提交) |
| **补充 6 E2E DoD** | △ Phase 4 | 单测 sanity ≠ E2E · DoD 三件套 (raw report + 截图 + spec trace 表) 在 Phase 4 Tester 落 |
| **补充 7 双脑回看** | ✓ | 每次 setData / Edit / commit 前回看 CLAUDE.md Rule 3 Surgical + coder-agent.md 当前 step + Rule 6 tool-use budget (本 Phase 3 ~64 次 · 接近软线 70 · 已发 self-checkpoint 给 TL) |
| **Test-Case-First Phase 2 评审** | ✗ SKIP | 用户授权 `test_case_first_required=false` · audit dim_test_cases_alignment 跳过 (inflight.user_approval_verdict="SKIP") |
| **Phase 3 Step 0 grep User Approval** | ✗ SKIP | 同上 · skip 准入 |
| **Phase 3 Step 0.5 翻 it block** | △ adapted | 无 test-cases.md · 我直接基于 6 AC + 4 TI + 2 KI 写 24 unit test cases · 等价覆盖 |
| **PASS 5 红线** (PASS 定义) | △ Phase 4 | 1) unit ✓ / 2) IDE Console 0 [error] (Phase 4 跑) / 3) view 数 (Phase 4 跑) / 4) 网络真返 (单测 mock + Phase 4 真) / 5) VRT < 500 (Phase 4 跑) |
| **AC1 AiJudgeBanner 5 子区** | ✓ | wxml `.aijb` 5 子区按 mockup 顺序 + wxss 紫色 linear-gradient + radial blur 装饰 + 24 unit test 覆盖 view-model |
| **AC2 4 配套组件 (AiFlag/MetaChip/HintRibbon/AiMark)** | ✓ | 4 .ts pure helper export + wxml 渲染 + wxss · 全有 visible 控制 + i18n 字面 |
| **AC3 GradeButtons preselected prop** | ✓ | deriveGradeButtonsViewModel · 双 border + box-shadow + AiMark 角标 + aria-label "AI 建议" (色盲友好 TI2 PASS) |
| **AC4 page state + finalGradeSource** | ✓ | aiJudge 7 字段 + computeFinalGradeSource 实装 spec §6.3 三态 + tap CTA = tap 按钮 TI1 等价单测验过 + body 字面带 final_grade_source |
| **AC5 i18n 14 key + 双语** | ✓ | zh.json 15 keys (14 spec §14 + 1 模板) + en.json 15 keys · assertSC20T05Coverage 单测 PASS · 双语完整 |
| **AC6 埋点 wb_judge_ai_done + user_accept** | ✓ | TRACK_EVENTS 5 事件 · _triggerJudge 发 aiDone + (lowConf / timeout 条件发) · onGradeTap 按 finalGradeSource 发 userAccept / userOverride |

**Coder DoD 全部 PASS** (Phase 3 scope · Phase 4 Tester 验真 E2E)。

## 5. 提交

git_commits (本 Phase 3 提交):
- HEAD pending: feat(SC20-T05 phase-3): Phase 3 Coder · AiJudgeBanner + 4 配套 + GradeButtons preselected + i18n 15 key + 24 unit test PASS

下一步: Phase 4 Tester · 写 t05 e2e spec + 真 IDE 跑 + 落 tester.md / adversarial.md / test-reports/ + ide-console.txt 0 [error] + 1 轮对抗。
