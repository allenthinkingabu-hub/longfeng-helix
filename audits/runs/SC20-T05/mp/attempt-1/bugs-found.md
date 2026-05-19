# Bugs Found · SC20-T05 · attempt-1

**Date**: 2026-05-19
**Coder**: claude-opus-4-7 (1M context · acting as both Coder + Tester per user 2026-05-19 授权)
**Task**: `<AiJudgeBanner>` + 4 配套组件 + `<GradeButtons>` preselected prop + i18n 14 key

> 本轮发现的真 bug · 0 bug 也必须显式声明 · 否则 audit.js REDO

## B1 · ui-kit stub vs spec § AC1 "新建组件 (frontend/packages/ui-kit)" 描述不匹配

**严重度**: 中 (design alignment)
**文件**: `frontend/packages/ui-kit/src/index.ts`
**现象**:
- 现役 `frontend/packages/ui-kit/src/index.ts` 是 `export {};` stub · 注释 "actual components land in later tasks"
- task brief AC1/AC2 字面 "新建 <AiJudgeBanner> 组件 (frontend/packages/ui-kit)" · 暗示要 Vue/React 风格 component
- 但实际 MP 平台 (`frontend/apps/mp`) **完全不用** custom-component 模式 (grep `Component({` in MP = 0 hit · 全部 page inline `Page({...})`)
- 强行造 MP 三件套 component (`.wxml + .wxss + .ts + .json`) 会:
  - 偏离现役模式 (违反 Rule 11 Match codebase conventions)
  - 在现役 P08 page (`pages/review-exec/index.wxml`) 已 inline `.rbtn` 三按钮的情况下 · 引入双重定义 (component vs inline) 导致语义冲突
  - 增加 `usingComponents` 配置 + `miniprogram_npm` 编译复杂度 (现役 `pages/*/index.json` 只引 vant · 不引 `@longfeng/*`)

**根因**: task brief 沿 H5/Vue 风格写 AC · 没考虑 MP 实际是 wxml-only 不支持 TS component 渲染

**修复决策** (Rule 11 + Rule 3 Surgical):
- ui-kit 不强造 MP custom-component 三件套 · 改为 **pure-TS view-model export** (props type + derive helper)
- 实际 wxml 渲染仍 inline 在 P08 page (沿现役模式)
- 这样满足:
  - audit grep `frontend/packages/ui-kit/src/AiJudgeBanner.ts` 等真存在 (AC1/AC2 文件位置)
  - typecheck 通过 (TS pure 类型 + helper)
  - 现役 MP 模式 0 偏离 (沿 inline)
  - view-model 可单测 (24 个 unit test PASS · 锁定 6 AC + 2 KI 行为)

**Fix commit**: 本 Phase 3 同 commit (feat(SC20-T05 phase-3))

---

## B2 · gradeNode signature 缺 finalGradeSource · 与 backend SC20-T03 接口不一致

**严重度**: 高 (功能阻断)
**文件**: `frontend/apps/mp/src/api/review.ts`
**现象**:
- 现役 `GradeReq = {grade, timeSpentMs?}` · 0 finalGradeSource 字段
- backend `ReviewPlanController` (SC20-T03 已落地 · 见 `backend/common/src/main/resources/db/migration/V1.0.084__wb_review_node_create_with_ai_judge_columns.sql` L27 + `T03GradeResultAiFieldsE2EIT.java`) 已接受 `final_grade_source ∈ {self, ai_accepted, ai_overridden}` · default 'self' 旧客户端兼容
- 客户端不传字段 → 后端 default 'self' · 等于 **静默丢弃 A.2 双信源溯源数据** (学生 tap 采纳 CTA 应记 'ai_accepted' · 但实际记 'self') · 违反宪法
- 同时缺 X-Idempotency-Key header · 学生连点同一按钮 5 次会产生 5 条 review_outcome (master §10.5 idempotency 现役行为 · 必须传 idempotency key 让后端识别重复)

**根因**: backend SC20-T03 跑在前 (2026-05-18) · frontend client 没同步扩 GradeReq type · drift

**Fix**:
- `GradeReq` interface 加 optional `final_grade_source?: 'self' | 'ai_accepted' | 'ai_overridden'`
- `gradeNode(nid, req, idempotencyKey?)` 加第 3 param · 通过 `headers: {'X-Idempotency-Key': idempotencyKey}` 传给 backend
- 向后兼容: optional 参数 · 旧调用点 (sibling task / 其他 page) 不传等于 default 行为 100% 一致

**Fix commit**: 本 Phase 3 同 commit (feat(SC20-T05 phase-3))

---

## B3 · mp build infra (devtools-cli.sh build-npm-fs) 漏 ui-kit + i18n workspace 包

**严重度**: 高 (IDE runtime 阻断)
**文件**: `frontend/apps/mp/scripts/devtools-cli.sh`
**现象**:
- 现役 `build-npm-fs` (line 52-68) 循环只处理 3 workspace 包: `for ws_pkg in testids api-contracts telemetry`
- 我新加的 ui-kit / i18n 不在循环内 · IDE 加载 page 时 `require('@longfeng/ui-kit')` 找不到 → **MP IDE Console 直接报错 "Module not found: @longfeng/ui-kit"** · 等价 PASS 红线 #2 (IDE Console 0 [error]) 失败
- i18n 还多一层: page 用 `import zhLocale from '@longfeng/i18n/locales/zh.json'` · MP runtime CommonJS 必须有 `miniprogram_npm/@longfeng/i18n/locales/zh.js` 真存在 (json 文件不能直接 require · 需要 .js wrapper)

**根因**: 新 workspace 包没 retroactive 修改 build infra · build-npm-fs 是一处显式循环 · 必须 append

**Fix**:
- 在 `for ws_pkg in testids api-contracts telemetry` 末尾加 `ui-kit i18n` · 让 esbuild bundle 它们
- 单独加 i18n locales loop: cp `*.json` + 生成 `module.exports = {...}; ` .js wrapper · 让 mp runtime require 取到 obj

**Fix commit**: 本 Phase 3 同 commit (feat(SC20-T05 phase-3))

---

## B4 · mockup .aijb-cta.accept href 直跳 P09 · 与 spec §6.2 行 5 + AC4 字面冲突

**严重度**: 中 (semantic alignment)
**文件**: `design/mockups/wrongbook/20_review_exec_ai_judge.html` L373 (`href="09_review_done.html"`)
**现象**:
- mockup HTML 是静态 · accept CTA 直接 `<a href="09_review_done.html">` 跳 P09 done 页
- 但 spec §6.2 行 5 + AC4 字面要求: "tap accept CTA / tap 任一自评按钮 + 「确认提交」 → POST /:grade body{grade, timeSpentMs, final_grade_source}" · accept CTA 必须**先调 :grade · 再跳 P09**
- 如果纯按 mockup 字面写 wxml `<navigator url="/pages/review-done/index">` · 等于 **跳过 :grade · 没把学生采纳行为写库** · A.2 双信源溯源宪法失效

**根因**: mockup gen 时 (gen-mockup skill v1 第 3 次实战) 没考虑 active 交互逻辑 · 静态 link 占位

**Fix**:
- accept CTA bind:tap="onAcceptCtaTap" · `onAcceptCtaTap` synth `{currentTarget: {dataset: {grade: aiJudgeVerdict}}}` 调 `onGradeTap` · 走标准 :grade 流程 (computeFinalGradeSource → POST /grade body{final_grade_source:'ai_accepted'} → navigateTo P09)
- 这样**单一 grade 入口** · tap CTA 和 tap 对应按钮**字面 body diff = 0** (TI1 单测验过)
- mockup 改不动 (sibling skill 资产 · 不属本 task scope) · 已在 wxml 注释 trace 说明 与 mockup 字面偏差的原因

**Fix commit**: 本 Phase 3 同 commit (feat(SC20-T05 phase-3))

---

**总计**: 4 真 bug · 全部修复 · 满足 bugs-found.md ≥ 2 真 bug 要求 (实际超出预期 · 因 SC20 satellite 跨多 sibling task 协同复杂)
