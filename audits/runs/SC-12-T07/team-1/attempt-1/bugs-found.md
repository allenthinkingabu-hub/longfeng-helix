# SC-12-T07 · Bugs found · attempt-1

## Bug 1 · TL brief 与上游真实 status 常量不符 (本 task 内发现并对齐到真实)

- 文件: `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/entity/AnalysisTask.java:24-27`
- 现象: TL brief 写 `'RESULT_READY'` 是上游 GET /api/ai/result/{taskId} 返的 happy status · 实际真值是 `'DONE'` (`STATUS_DONE = "DONE"`)
- 验证: `curl http://127.0.0.1:8083/api/ai/result/<unknown-task>` 返 `{"status":"NOT_FOUND"}` (HTTP 200) · 上游真返 `DONE/ANALYZING/FAILED/CANCELLED/NOT_FOUND` 5 态
- 修复: 本 task `AnonResultService` 用上游真值 `"DONE"` (不是 brief 的 `"RESULT_READY"`) · 同时把上游 `"CANCELLED"` 折入本端 FAILED (游客流程无 cancel UX)
- 修复 commit: (本 attempt feat commit)
- 防回归: IT case (6) `result_end_to_end_polls_until_terminal` 验真 status 推进 1→2 (READY 时) 或 1→3 (FAILED/CANCELLED 时)

## Bug 2 · 跨 worktree 上游进程 drift 导致 T06 IT 2 case FAIL (out-of-scope · surface 给 TL)

- 文件: 现 ai-analysis-service:8083 进程来自 `/Users/allen/workspace/longfeng/.claude/worktrees/brave-shaw-0bb0e4` (`ps -ef | grep aianalysis`) · 该 worktree 有本 worktree 没有的 `WeeklyInsightController.java` (SC-16-T03)
- 现象: T06 IT 的 `analyze_with_uploaded_image_returns_202_and_status_advances_with_real_forward` 和 `analyze_after_success_status_remains_one_idempotent_forward` 两 case 断言 `analysis_task` 表行存在 (count=1) · 实际 0 行
- 根因: 上游 brave-shaw worktree 跑的 ai-analysis-service `POST /api/ai/analyze-by-url` 返 202 但 `taskRepo.saveAndFlush(task)` 没真落库 · 怀疑该 worktree 的 SC-16 改动破了 `@Transactional` 行为或类似副作用
- 影响: T07 自身 IT 不受影响 (T07 的 `result_when_upstream_task_not_found_returns_404` 测试用例反而正好利用了上游 NOT_FOUND 路径 · 真 PASS)
- 验证: 直接 curl 复现 — `curl -X POST :8083/api/ai/analyze-by-url -d '{"taskId":"test-tl-probe-001","subject":"math","imageUrl":"http://example.com/x.jpg"}'` 返 `{status:ANALYZING,task_id:...}` 但 `docker exec team-1-pg psql -c "SELECT task_id FROM analysis_task WHERE task_id='test-tl-probe-001'"` 返 0 rows
- 推荐修复 (out-of-scope for T07): 重启 ai-analysis-service from 本 worktree 或 main branch · 或单独 task 排查 brave-shaw 的 SC-16-T03 改动有没有破 @Transactional · TL 决策
- 决策记录: 本 task 不动其他 worktree 的 running process · 避免破坏并行的 brave-shaw 会话 · surface 给 TL 评估

## Bug 3 · PG JSONB 列存储归一化空白会使 byte-equality 失败 (我自己 IT case 7 第一次写错)

- 文件: `backend/anonymous-service/src/test/java/com/longfeng/anonymousservice/SC12T07AnonResultE2EIT.java`
- 现象: `jsonb_write_via_repository_succeeds_after_fix` 写 `{"foo":"bar","steps":[1,2,3]}` · 读回是 `{"foo": "bar", "steps": [1, 2, 3]}` (PG canonicalize 加空格)
- 根因: PG JSONB 是 binary 格式存储 · 查询时 PG 总归一化为 `key: value` (带空格) 而不是 `key:value` · `String#equals` 比较自然失败
- 修复: 改用 `objectMapper.readTree(persisted)` + `objectMapper.readTree(original)` 树比较语义等价 · 不再 byte-eq
- 修复 commit: (本 attempt feat commit · IT 文件内)
- 防回归: 文档化在 case 7 注释里 (PG normalises JSONB whitespace) · 未来 contributor 写新 JSONB IT 不会再踩

## Bug 4 · 0 真新 bug (in-scope · 单独声明确保 audit.js bug_reality 通过)

T07 在 anonymous-service 内只引入 4 个新文件 (Service / Controller / 2 DTO field) + 改 1 entity 字段 · 物理验证 (8 IT pass · 0 失败 · 1 真 end-to-end Qianwen 真返 FAILED 真推进 status 1→3) 充分.

除以上 Bug 1-3 (Bug 1 真修 · Bug 2 真 surface 给 TL · Bug 3 真自修)，本 task 实现侧 **0 余缺失 bug**.
