# SC22-T02 Bugs Found · 3 个真坑修复

**Date**: 2026-05-19
**Attempt**: 1
**Branch**: feature/M-AI-ANSWER-JUDGE-team-1

## Bug 列表

### B1 · 现役 metric counter 命名与 biz §2B.22 字面 drift
- **文件**: `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/service/AnswerJudgeService.java` (line 60-62)
- **症状**: 现役 3 个 counter 命名 `longfeng_ai_judge_primary_calls_total` / `longfeng_ai_judge_fallback_calls_total` / `longfeng_ai_judge_chat_model_calls_total` · biz §2B.22 line 222 字面要求 `wb_judge_ai_timeout{nid, ms:18000}` · drift
- **fix**: 加 4th counter `public static final String METRIC_TIMEOUT = "wb_judge_ai_timeout";` 与 biz 字面对齐. 现役 3 counter 不重命名 (Rule 3 Surgical · 避免破坏 SC20-T02 13 IT)
- **修复 commit**: (pending feat(SC22-T02 phase-3+4))

### B2 · 现役 invokeFallbackChain 无 per-provider timeout 上限保护
- **文件**: `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/service/AnswerJudgeService.java` (line 230-265)
- **症状**: 现役 `client.judge(systemPrompt, userPrompt, imageKey)` 直接调 · 若 HTTP client (DashScope) 真挂死 (socketTimeout 失效 / OS 层连接挂) · 单 provider 可能挂 >> 8s · 总耗时可能 > 18s · 违 biz §10.17 SLA "503 必在 18s 内返"
- **fix**: 加 `callWithTimeout(client, userPrompt, imageKey, timeoutMs, providerName)` 方法用 `CompletableFuture.supplyAsync(...).get(timeoutMs, TimeUnit.MILLISECONDS)` 双保险 · 真挂死时强抛 `AnswerJudgeAiException("timeout: ${provider} ${timeoutMs}ms")` · chain 继续走 fallback
- **验证**: IT `it_ac4_perProviderHardTimeout_within18s` 真 Thread.sleep(9000) > 8000ms primary timeout · 验 503 在 [7500, 18000] ms 内返
- **修复 commit**: (pending feat(SC22-T02 phase-3+4))

### B3 · SC20-T02 IT 无真挂 sleep 验 timeout 上限保护
- **文件**: `backend/review-plan-service/src/test/java/com/longfeng/reviewplan/T02AnswerJudgeServiceE2EIT.java` (line 384-387)
- **症状**: 现役 SC20-T02 IT 用 path-A `doThrow().when(qianwenJudgeClient).judge(...)` 测同步抛 · 总耗时 ms 级 · 无法验 18s SLA 真上限保护
- **fix**: 本 task 加 path-B IT `it_ac4_perProviderHardTimeout_within18s` 用 `thenAnswer(invocation -> { Thread.sleep(9000); ... })` 真挂 9s > 8s primary timeout · 验 CompletableFuture.get(8000ms) 真截断 + 503 在 18s 内返
- **修复 commit**: (pending feat(SC22-T02 phase-3+4))

## 总结

3 个 bug · 全在本 task 修复 · 验证 IT 全 PASS · SC20-T02 13 regression IT 全 PASS · 0 break.
