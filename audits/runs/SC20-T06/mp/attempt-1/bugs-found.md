# SC20-T06 Bugs Found · attempt-1

Coder 角色在 E2E 编排/真跑过程中发现并修复的 bug 列表. **0 bug 也必须显式声明** (audit.js 卡口).

---

## Bug 1 · image_key fixture 格式不符合 ObjectKeyBuilder 约束 → 422 IMAGE_KEY_INVALID

**严重度**: Blocker (本 attempt 后端 IT 第一轮 3 test 中 2 个 fail · `Status expected:<200> but was:<422>`)

**现场**:
- 文件: `backend/review-plan-service/src/test/java/com/longfeng/reviewplan/T06Sc20E2EHappyPathE2EIT.java`
- 原 fixture: `IMAGE_KEY_HAPPY = "wrongbook/answers/u500/img-sc20t06-001.jpg"` (4 段 · "u500" 含字母)
- Backend 报错 body: `{"error_code":"IMAGE_KEY_INVALID","message":"image_key path malformed (expected ObjectKeyBuilder pattern)"}`

**根因**:
- `AnswerJudgeService.java#L145-L156` Step 2 image_key 校验:
  ```
  String[] segments = imageKey.split("/");
  if (segments.length < 5) throw new ImageKeyInvalid("image_key path malformed (expected ObjectKeyBuilder pattern)");
  String studentSegment = segments[3];
  if (!studentSegment.equals(String.valueOf(userId))) throw new ImageKeyInvalid("image_key studentId mismatch ...");
  ```
- `ObjectKeyBuilder.java` pattern: `wrongbook/{tenantId}/{yyyyMM}/{studentId}/{snowflakeId}_{sanitizedFilename}` (5 段)
- 我的 fixture 4 段 + 第 4 段非数字 studentId · 双错

**修复**:
- 改 fixture 为 `wrongbook/T01/202605/500/snowflake1_sc20t06.jpg` (5 段 · segments[3]='500' == STUDENT_ID=500)
- 加 IMAGE_KEY_RETRY 常量 `wrongbook/T01/202605/500/snowflake2_retry.jpg` 用于 TC-20.03 retry 路径
- 在常量上方加注释说明 pattern 来源
- 同时把 TC-20.03 retry 中 hardcoded image_key 字符串改用 IMAGE_KEY_RETRY 常量

**修复 commit**: (本 attempt commit 中 · 见 coder.md §5)

**Rule 12 Fail loud 现场**: 真错时不绕开 (不调高 5xx 阈值 / 不 skip test) · 而是查源码 ObjectKeyBuilder 规约 + 改 fixture 对齐生产代码真相. (E2E assertion 与生产代码 silent-fork 是 DoR 拒绝项)

---

## Bug 2 · inflight `tests/e2e/` 复数路径与仓库实际单数 `test/e2e/` 不一致 (typo · 不动 inflight · 文档对齐)

**严重度**: Low (typo · 仅影响文档可追溯性 · 不破坏功能)

**现场**:
- inflight `.harness/inflight/SC20-T06.json` line 69: `"frontend_e2e": "frontend/apps/mp/tests/e2e/sc-20/t06-e2e-happy-path.spec.ts"` (复数 `tests/`)
- 实际仓库结构: `frontend/apps/mp/test/e2e/` (单数 · 与 _helpers.ts / automator-smoke.spec.ts 等所有现役 sibling 一致)

**根因**:
- TL 写 inflight 时 typo · 不影响代码运行 · 但 audit.js 若按 inflight `physical_verification.frontend_e2e` 路径 grep 会 miss

**修复决策** (Rule 7 surface conflict · Rule 11 match codebase convention):
- **不改 inflight** (Coder 边界 · 只能改 dev_done · 不能改 physical_verification path)
- spec 文件落地用 **真实仓库结构** `frontend/apps/mp/test/e2e/sc-20/t06-e2e-happy-path.spec.ts` (单数 · 与 _helpers.ts 同级)
- 在 coder.md §1.2 #1 + bugs-found.md (本条) 显式 surface 此 typo · 留 TL 后续 update inflight 时修正 (如需要的话 · audit.js 直接 grep 文件存在性应不依赖 inflight path)

**Rule 11 现场**: codebase 已统一 `test/` (单数 · 14 个 sibling spec) · 服从既有约定 > 跟 inflight typo.

---

## Bug 3 · T05 半 commit · review-exec/index.ts uncommitted state (不是我的 bug · surface 告知)

**严重度**: Info (T05 sub-agent 平行运行中的中间态 · 不在我 T06 边界内 · 仅 surface)

**现场**:
- `git status frontend/apps/mp/pages/review-exec/index.ts` 显示 modified · uncommitted draft 包含 T05 ui-kit imports (`computeFinalGradeSource` / `deriveAiJudgeBannerViewModel` / `deriveGradeButtonsViewModel` 等 7 个 pure-TS helpers + `@longfeng/i18n` + `@longfeng/telemetry`)
- 这些 imports 已 typecheck PASS 0 error (T05 ui-kit + i18n + telemetry packages 已实装 export · 测试不破)

**根因**:
- T05 sub-agent 当前在 phase=coder · `dev_done=false` · 修改文件未 commit
- 因 T04+T05 与 T06 平行 spawn · T05 sub-agent 还在工作 · review-exec/index.ts 处于 unstable state

**修复 (本 task 不做 · 边界外)**:
- **我不动 T05 半 commit · 等 T05 sub-agent 完成自己 commit 后 Tester 阶段再真跑前端 E2E**
- 我的前端 spec 写完落盘 · T04 commit 已存在 · 前端 spec navigateTo + assertPageRenders 真断言写完 · banner/tap 真断言留 placeholder
- coder.md §3.2 已 surface 前端真跑等 T05 完整 commit 后 Tester 决策

**Rule 3 Surgical 现场**: 严格不 cleanup adjacent T04/T05 代码 · 即便 T05 处于 unstable state · 我的 task 边界仅 E2E spec/IT 编写.

---

## 总结

| # | Bug | 严重度 | 状态 |
|---|---|---|---|
| 1 | image_key fixture 格式错 → 422 | Blocker | ✓ 修复 + 第二次跑 3/3 PASS |
| 2 | inflight `tests/` typo vs 仓库 `test/` 单数 | Low | ✓ surface · 不动 inflight · spec 文件按真实结构落 |
| 3 | T05 review-exec/index.ts 半 commit (边界外) | Info | surface · T06 不处理 · 等 T05 sub-agent 完成 |
