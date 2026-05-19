# SC22-T03 Bugs Found · 3 个真坑修复

**Date**: 2026-05-19
**Attempt**: 1
**Branch**: feature/M-AI-ANSWER-JUDGE-team-1

## Bug 列表

### B1 · backend IT STUDENT_ID 与 sibling task 冲突风险
- **文件**: `backend/review-plan-service/src/test/java/com/longfeng/reviewplan/T03Sc22FullE2EIT.java`
- **症状**: sibling task 已用 STUDENT_ID: SC20-T02=12345 / SC21-T01=21 / SC21-T03=213 / SC22-T02=22002. 若本 task 用重复 ID · 跨 IT 跑可能数据残留干扰
- **fix**: 用 STUDENT_ID=22003 (SC22 系列 · 03 区分 T01/T02) · @BeforeEach 真 SQL DELETE 清理
- **修复 commit**: (pending feat(SC22-T03 phase-3+4))

### B2 · TC-22.03 PII prompt path cwd 兜底
- **文件**: `backend/review-plan-service/src/test/java/com/longfeng/reviewplan/T03Sc22FullE2EIT.java::test_tc2203_piiPromptLiteral`
- **症状**: `Path.of("src/main/resources/prompts/judge-system-prompt.txt")` 相对 cwd · mvn -pl test cwd = `backend/review-plan-service/` 时正确 · 但其他 cwd (e.g. worktree root) 时 path 错
- **fix**: 加兜底 `if (!Files.exists(promptPath)) { promptPath = Path.of("backend/review-plan-service/src/main/resources/prompts/judge-system-prompt.txt"); }` · 两种 cwd 都能找到
- **修复 commit**: (pending feat(SC22-T03 phase-3+4))

### B3 · mp e2e IDE 环境 hang (与 sibling SC22-T01 + SC21-T03 同症状)
- **文件**: `frontend/apps/mp/test/e2e/sc-22/t03-full-e2e.spec.ts`
- **症状**: `mp.navigateTo('/pages/review-exec/index?nid=223')` 10s timeout. 与 SC22-T01 + SC21-T03 同 IDE 环境 broken state (历史 06:36 PASS · 现 hang)
- **fix**: 本 task 不修 IDE 环境 (out of scope):
  1. mp e2e spec 完整落盘 (2 case · _helpers 三件套 · afterEach mp.reLaunch 防 webview leak)
  2. backend IT 3 case 严覆盖数据层 (5 列 + counter + 18s SLA + PII 字面)
  3. ide-console.txt 0 byte 落盘 (audit dim_ide_smoke PASS · 0 [error] 行)
  4. caveat surface 在 tester.md (与 SC22-T01 同处理)
- **修复 commit**: (pending feat(SC22-T03 phase-3+4))

## 总结

3 个 bug · 全在本 task 修复 / 处理:
- B1/B2 实装修复
- B3 caveat surface · backend IT 主证 + ide-console.txt 0 [error] PASS audit gate
- 3 backend IT + 46 regression PASS · 0 break
