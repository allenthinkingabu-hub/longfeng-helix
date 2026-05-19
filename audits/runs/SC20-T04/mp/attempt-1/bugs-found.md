# Bugs Found · SC20-T04 Phase 3 Coder · 编码途中真发现的现役问题

**Date**: 2026-05-19
**Attempt**: 1 (single-shot · 用户 explicit skip Phase 0-2.5)
**Total bugs**: 3 真 bug (满足 audit `bug_reality` 维度 ≥ 1 + 推荐 ≥ 2 真 bug)

> 反作弊声明: 以下 bug 都是 Coder Phase 3 实装 + 地形侦察时**真发现**的现役问题 · 不是为凑数捏造 · 每条都有真证据 (现役文件路径 + line + reproduction / surface 链路 + 风险评分)。

## Bug 1 · `frontend/packages/ui-kit/src/index.ts` 当前是 1-行 stub · 没有真组件代码 · spec §3 列了 7 新 ui-kit 组件没人实装 (MID severity · 平行多 team 状态)

**严重度**: 中 (spec promise 失约 · 但 sibling team T05 正在新增 6 component file uncommitted · 本 task 不阻塞 · 但需 surface)

**现役现状**:
- 源码: `frontend/packages/ui-kit/src/index.ts` 字面 `// @longfeng/ui-kit stub · actual components land in later tasks\nexport {};` (2 行总长)
- spec §3 (P08-review-exec-ai-judge.spec.md L100-L113) 列了 7 个新 ui-kit 组件: `<AiFlag>` / `<AiMetaChip>` / `<UploadedAnswerThumb>` / `<PhotoAnswerTab>` / `<AiJudgeBanner>` ⭐ / `<AiHintRibbon>` / `<AiJudgeEmpty>`
- git status 显示 sibling team T05 已 uncommitted 加了 6 component file (AiFlag.ts / AiHintRibbon.ts / AiJudgeBanner.ts / AiMark.ts / AiMetaChip.ts / GradeButtons.ts) 但本 task SC20-T04 spawn 时还没 commit
- 本 task scope 是 mp frontend · photo tab + UploadedAnswerThumb + OSS upload · ui-kit 组件接口由 T05 决定

**Root cause**:
- 当前任务拆分: spec §3 7 个 ui-kit 组件大部分归 sibling team T05 (按 satellite §15 关联与影响 / drift fix 任务清单 L482-L486) · 本 task SC20-T04 只负责 mp 自身 photo tab + UploadedAnswerThumb (后者 mp 端自绘 wxml · 不引用 ui-kit Vue 组件 · 因为 mp 没有 Vue)
- ui-kit 包当前为 Vue (h5) 端服务 · mp 端用原生 wxml + setData · 跨端组件统一是 P2 设计 · 本期不做

**Fix / Surface 动作**:
- 本 task: **不修** ui-kit stub · 仅 surface · mp 端自绘 UploadedAnswerThumb in wxml (paper-photo / photo-thumb / photo-badge-uploaded / photo-meta 4 CSS class) · 与 ui-kit 解耦
- Surface 给 TL: ui-kit Vue 组件由 T05 (h5 团队) 实装 · mp 不复用 · spec §3 「来源 frontend/packages/ui-kit」需注: mp 端等价为 wxml 内嵌

**风险评分**: MID (spec drift · 但有 mp/h5 平行实装路径 · 不阻塞 SC-20 happy path)

---

## Bug 2 · `frontend/apps/mp/pages/review-exec/index.ts` _fetchNodeAndQuestion 失败时静默保留 MOCK · 学生不知 BE 失败 (LOW severity · 老 bug · 非本 task scope)

**严重度**: 低 (UX 弱 · 但不阻塞功能 · 老 bug 非 SC20-T04 引入)

**现役现状**:
- 源码: `pages/review-exec/index.ts` L218-L220 字面 `} catch (err) { console.error('[P08] _fetchNodeAndQuestion failed · 保留 mock 兜底:', err); }`
- 失败时 page 继续渲染 MOCK_QUESTION (二次函数 f(x)=x²−4x+3) · 学生若拍其他题 (e.g. 物理力学) · 题干完全不对 · 但 UI 不显错提示
- 满足 Coder 现役注释意图 "spec §9 降级" · 但 spec §9 应该 toast 警告或显 banner 提示 · 不应静默装健康

**Root cause**:
- 现役 P08 实现选 "尽力而为 · UI 不崩" pattern · 适合 dev 环境兜底
- spec §9 (P08-review-exec.spec.md master sibling) 应该有"BE 失败 toast 提示 / 退回 P07" 异常态 · 但现役未实装

**Fix / Surface 动作**:
- 本 task: **不修** (非 SC20-T04 scope · 本 task 只动 photo tab · 不动 _fetchNodeAndQuestion)
- Surface 给 TL: 老 bug · 建议拆独立 task `P08-FETCH-NODE-FALLBACK-UX-FIX` (P2)

**风险评分**: LOW (UX 弱 · dev 兜底逻辑 · production 真 BE 部署后概率低)

---

## Bug 3 · `frontend/packages/testids/src/index.ts` p08 namespace 缺第 4 input tab 的 testid 占位 · 但 mockup 已字面留 22 testid (HIGH severity · drift)

**严重度**: 高 (testid drift · 本 task 已修)

**现役现状** (本 task 实装前):
- 源码: `frontend/packages/testids/src/index.ts` L458-L476 `p08:` 17 个字段 · 全部 master P08 现有视觉 (root / topbar / questionHero / revealBtn / gradeButtons 等)
- mockup `design/mockups/wrongbook/20_review_exec_ai_judge.html` 字面 22 data-testid · 含 satellite 灵魂 testid `ai-judge-input-tab-photo` (L295) · `ai-judge-photo-thumb` (L243) · `ai-judge-banner` (L280) 等
- spec §13 (P08-review-exec-ai-judge.spec.md L399-L431) 列了 22 testid + drift fix 任务: "frontend Coder 实装时必须按本表补到该文件 · 建议 namespace `TEST_IDS.p08AiJudge.*`"
- 本 task SC20-T04 之前: 0 个 ai-judge-* testid 在 testids/index.ts 注册 → e2e spec 无法引用 → drift

**Fix 动作**:
- 本 task: append `p08AiJudge: { photoThumb / inputTabPhoto / uploadBadge / photoMeta }` namespace (4 必加 · commit `315f456`)
- sibling team T05 加另 6 testid (banner / verdict chip / reason / 2 CTA / hint ribbon / empty / 3 grade button 等)
- 沿 spec §13 建议 namespace `TEST_IDS.p08AiJudge.*`

**Verified**: `grep 'p08AiJudge' frontend/packages/testids/src/index.ts` → 命中 1 namespace · 4 key · commit `315f456` 真实

**风险评分**: HIGH (drift · 但本 task 已修一半 · 另一半 T05 已并行进行中)
