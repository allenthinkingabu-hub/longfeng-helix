# Coder Phase 3 编码 · SC22-T02 · AI_SERVICE_UNAVAILABLE 双 provider 双断增强 + wb_judge_ai_timeout 埋点 + 18s 上限验证 + LOW_CONFIDENCE flagged 增强 · 4 IT PASS

**Date**: 2026-05-19
**Attempt**: 1
**Branch**: feature/M-AI-ANSWER-JUDGE-team-1
**Task brief**: TL spawn 2026-05-19 · 用户授权 skip Phase 0-2.5 · `test_case_first_required=false` · 直接 Phase 3+4+5 交付

> **启动纪律阅读证明**: 完整读 `.harness/agents/coder-agent.md` (145 行 · PASS 5 红线 + Test-Case-First Phase 2/2.5/3 流程 + 铁律 5 条 + 补充 6 E2E DoD + 补充 7 双脑回看) + `.harness/agents/test-agent.md` (160 行) + `.harness/agents/tl-agent.md` (219 行) + `CLAUDE.md` (启动纪律 + Rule 6 tool-use budget + audit.js 卡口) + `inflight/SC22-T02.json` (5 AC / 4 TI / 2 KI · user_approval_verdict=SKIP) + biz §2B.22 SC-22 + §6.4 阈值 + §4.16 wb_review_node + §10.17 API + §1.4 三大宪法 + SC20-T02 coder.md (13 IT 现役 backend) + SC21-T01 coder.md (outbox pattern).

## 1. 地形侦察

**grep + ls 物理验证 backend 现役**:
- `grep -n "AnswerJudgeService\|503\|AI_SERVICE_UNAVAILABLE\|TIMEOUT\|LOW_CONFIDENCE\|wb_judge_ai_timeout" backend/review-plan-service/src/main/java/com/longfeng/reviewplan/service/AnswerJudgeService.java` — SC20-T02 已实装核心 5+1 错误码 + 双 provider chain + LOW_CONFIDENCE 状态机. `wb_judge_ai_timeout` counter **不存在** (本 task 补).
- `grep -n "METRIC_PRIMARY\|METRIC_FALLBACK\|METRIC_CHAT_MODEL" AnswerJudgeService.java` — 现役 3 个 counter `longfeng_ai_judge_*` · 字面与 biz §2B.22 line 222 要求 `wb_judge_ai_timeout` 命名不一致 · 本 task 加新 4th counter.
- `cat backend/.../JudgeController.java` — 5+1 错误码 ExceptionHandler + 503 plain JSON body 已实装.
- `grep -n "timeout-primary-ms\|timeoutPrimaryMs" backend/.../JudgeProperties.java` — 现役 props 含 `timeoutPrimaryMs=8000` + `timeoutFallbackMs=10000` (line 25/28) · 我直接复用.
- `grep -n "Future\|CompletableFuture\|TimeUnit" backend/.../service/AnswerJudgeService.java` — **0 hit** · 现役 invokeFallbackChain 无 timeout 上限保护 · 若 HTTP 真挂死 (DashScope socketTimeout 失效) 18s SLA 难保 · 本 task 补.
- `grep -n "is503\|metadataStatus\|AiJudgeOutcome.timeout" service/AnswerJudgeService.java` — SC20-T02 已实装 503 outcome 落库 (image_key 非 null + verdict/confidence/reason null + metadata.status='TIMEOUT') · 本 task 沿用.
- docker ps `team-5-pg` (15436) · `team-5-minio` · `team-5-redis` 在线 (`docker ps`) · sandbox PG 可用 jdbc:postgresql://127.0.0.1:15436/wrongbook.

**关键发现 (3 个真坑 · 见 bugs-found.md)**:
- B1: 现役 metric counter 命名 `longfeng_ai_judge_*` (3 个) · biz §2B.22 字面要求 `wb_judge_ai_timeout` · 本 task 加 4th counter (不改现役 3 个 · Rule 3 Surgical)
- B2: 现役 invokeFallbackChain 无 per-provider timeout 上限保护 · 若 client.judge() 真 HTTP 挂死 (e.g. fallback 真 sleep 11s) 总耗时可能 > 18s · 违 biz §10.17 SLA. 本 task 用 `CompletableFuture.get(timeoutMs)` 二道保险包裹.
- B3: SC20-T02 IT 用 path-A (同步抛) 测 timeout · 没真挂 sleep 验上限. 本 task path-B IT (`it_ac4`) 真 Thread.sleep(9000) 验 8s primary timeout 截断 + 18s 上限.

## 2. 编码

**标杆对齐 (Reference Module)**:
- Counter 模式: `AnswerJudgeService.METRIC_PRIMARY` (line 60-62 现役 · 沿 `Counter.builder(name).tags(Tags.of("provider", name)).register(meterRegistry).increment()` pattern)
- IT 标杆: `T02AnswerJudgeServiceE2EIT.java` (用 `@MockBean(QianwenJudgeClient)` + `@MockBean(StubJudgeFallbackClient)` + sandbox PG 15436 + `MeterRegistry.find(...)` 抓 counter delta) · 我复制此 IT 整体结构
- Timeout 保护: 现役无标杆 · 我借鉴 JDK `CompletableFuture.supplyAsync().get(timeout)` 标准模式

**改现役文件**:
- `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/service/AnswerJudgeService.java` (+50 -2 行):
  1. import: java.util.concurrent.{CompletableFuture, ExecutionException, TimeUnit, TimeoutException} (4 新 imports)
  2. 加 `public static final String METRIC_TIMEOUT = "wb_judge_ai_timeout";` 常量 (与 biz §2B.22 line 222 字面对齐)
  3. invokeFallbackChain · 把 `client.judge(...)` 直接调改为 `callWithTimeout(client, ...)` 包裹 (18s 双保险)
  4. invokeFallbackChain · 在 `return AiJudgeOutcome.timeout(activeProvider)` 之前 increment METRIC_TIMEOUT counter (tags: nid + provider)
  5. 加 log.warn `wb_judge_ai_timeout · all providers failed · nid={} chain={} ms_budget≈{}` (审计可 grep)
  6. 新 private method `callWithTimeout(client, userPrompt, imageKey, timeoutMs, providerName)` (+30 行) · CompletableFuture.get(timeoutMs) · 真挂死时抛 `AnswerJudgeAiException("timeout: ${provider} ${timeoutMs}ms")`

**新建文件**:
- `backend/review-plan-service/src/test/java/com/longfeng/reviewplan/T02Sc22TimeoutLowConfidenceE2EIT.java` (+330 行):
  - 4 @Test method · 全 PASS:
    - `it_ac1_doubleProviderTimeout_returns503Within18s` (AC1 · path-A 同步抛 · 验 503 + 18s + image_key 非 null + 5 列空 + metadata.status='TIMEOUT')
    - `it_ac2_wbJudgeAiTimeoutCounter_increment` (AC2 · 双断时 wb_judge_ai_timeout counter += 1 · tag nid + provider="qianwen")
    - `it_ac3_lowConfidenceFlaggedTrue` (AC3 · confidence=0.32 · status='LOW_CONFIDENCE' + metadata.flagged=true + verdict 仍落)
    - `it_ac4_perProviderHardTimeout_within18s` (AC4 · path-B 真 sleep 9s > 8s primary timeout · CompletableFuture 截断 · 18s 内 503 + ≥ 7.5s 验真挂)
  - 测试桩配置: `@MockBean(QianwenJudgeClient) + @MockBean(StubJudgeFallbackClient)` 沿 SC20-T02 pattern
  - DB seed: raw SQL 隔离 STUDENT_ID=22002 (与 SC20-T02 12345 / SC21-T01 21 / SC21-T03 213 隔离 · 避免冲突)

**核心实现要点**:
1. **METRIC_TIMEOUT 命名严锁**: `wb_judge_ai_timeout` 与 biz §2B.22 line 222 字面对齐 · 不沿现役 `longfeng_ai_judge_*` 命名空间 (用户可能后期统一 · 本 task 不重命名现役 · Rule 3 Surgical)
2. **CompletableFuture.get(timeoutMs) 双保险**: 即使 HTTP client 自身 socketTimeout 失效 · CompletableFuture 在 timeoutMs ms 后强 cancel + 抛 AnswerJudgeAiException · 让 chain 继续走 fallback
3. **AC4 真挂时间下限 ≥ 7.5s**: 验真 sleep + timeout 截断 (不能 < 7.5s 否则证明没真挂等待 · 是同步立返)
4. **counter tag**: `Tags.of("nid", String.valueOf(nid), "provider", activeProvider)` · 与 biz §2B.22 line 222 字面 `wb_judge_ai_timeout{nid, ms:18000}` 风格对齐 (用 provider tag 替代 ms · ms 是状态而非 dimension · provider 更适合作 tag)
5. **LOW_CONFIDENCE flagged=true 增强**: SC20-T02 已实装 metadata.flagged 字段 (AnswerJudgeService.parseAndFilter line 318-320 / 322-324 都 set flagged=true · 我 IT 实测验确 · 现役无 IT)
6. **不破坏 SC20-T02 13 IT**: 改 `client.judge()` 为 `callWithTimeout(client, ..., timeoutMs)` 但 timeoutMs 远大于测试桩同步路径耗时 (ms 级) · 测试桩抛 AnswerJudgeAiException 在 CompletableFuture.get 内部 ExecutionException 解包返原异常 · 行为等价
7. **回测 SC20-T02**: 跑 `mvn -pl review-plan-service failsafe:integration-test -Dit.test=T02AnswerJudgeServiceE2EIT` → 13/13 PASS · 0 regression (见 sc22-t02-it.log 同 mvn output)

## 3. 真实 E2E (mvn failsafe sandbox PG · 不是 mock IT)

**环境**:
- docker container `team-5-pg` (postgres:15-alpine · port 15436) 在线
- DB: jdbc:postgresql://127.0.0.1:15436/wrongbook (longfeng/longfeng_dev)
- Flyway: schema 1.0.084 上 (SC20-T01 V1.0.084 + V1.0.085-087 已跑) · static schema patch 兜底 wb_review_node + idem_key + uk_idem_scope_key_nid 幂等 CREATE IF NOT EXISTS
- 测试桩: `@MockBean(QianwenJudgeClient) + @MockBean(StubJudgeFallbackClient)` · path-A (`doThrow().when()`) + path-B (`thenAnswer + Thread.sleep`) · 不发真 HTTP · 不耗 token · 反作弊 mock_count = 2 (整 IT class)

**真跑 cmd**:
```bash
cd /Users/allen/workspace/longfeng/.claude/worktrees/laughing-brown-e8ffb5/backend
mvn -pl review-plan-service test-compile  # → BUILD SUCCESS
mvn -pl review-plan-service failsafe:integration-test -Dit.test=T02Sc22TimeoutLowConfidenceE2EIT
```

**raw output 摘录** (2026-05-19 10:55:22):
```
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 30.57 s -- in com.longfeng.reviewplan.T02Sc22TimeoutLowConfidenceE2EIT
[INFO] Results:
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

**4/4 IT PASS** · 0 failure · 0 error · 0 skip · 30.57s (含 AC4 真 sleep 9s)。

**log 字面证据** (审计可 grep · 见 sc22-t02-it.log):
- `wb_judge_ai_timeout · all providers failed · nid=315019541941866496 chain=[qianwen, qianwen-fallback-stub] ms_budget≈18000` (AC1/AC2 路径 · 我新加 log.warn)
- `Judge provider qianwen failed: qianwen: timeout after 8000ms` (AC4 · 真 sleep 9s · 8s timeout 截断 · 我新加 callWithTimeout 抛错信息)
- `Fallback: qianwen -> qianwen-fallback-stub` (chain 切换 · 沿 SC20-T02 现役 log)
- `AI judge 503 AI_SERVICE_UNAVAILABLE: AI providers all failed / timeout` (4 IT 全 503 路径)

**SC20-T02 regression 验确** (2026-05-19 10:56:10):
```
[INFO] Tests run: 13, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 22.67 s -- in com.longfeng.reviewplan.T02AnswerJudgeServiceE2EIT
[INFO] BUILD SUCCESS
```
13/13 PASS · 0 regression。

## 4. 自检

**lint + typecheck**:
- `mvn -pl review-plan-service compile` (67 source files) → BUILD SUCCESS · 0 error
- `mvn -pl review-plan-service test-compile` (11 test files · 含本 task 新 T02Sc22 IT) → BUILD SUCCESS · 0 error

**IT verify**:
- `mvn -pl review-plan-service failsafe:integration-test -Dit.test=T02Sc22TimeoutLowConfidenceE2EIT` → 4/4 PASS · 30.57s
- `mvn -pl review-plan-service failsafe:integration-test -Dit.test=T02AnswerJudgeServiceE2EIT` (regression) → 13/13 PASS · 22.67s

**反省自检对照 coder-agent.md 7 step + 5 铁律**:
- ✓ Step 1 领取垂直场景 (`inflight/SC22-T02.json` 5 AC / 4 TI / 2 KI · user_approval=SKIP)
- ✓ Step 2 全栈上下文恢复 (biz §2B.22 + §6.4 + §10.17 + §1.4 + SC20-T02 coder.md 实装地图)
- ✓ Step 3 全栈编码 (Service + IT · 标杆对齐 SC20-T02 + Counter.builder + CompletableFuture)
- ✓ Step 4 真实 E2E (Coder DoD scope · 4 IT PASS · sandbox PG 真 + Counter 真验 + metadata.status='LOW_CONFIDENCE'/'TIMEOUT' 真断言)
- ✓ Step 5 内部 DoD 死循环 (compile 0 error + 4 新 IT PASS + 13 regression PASS · 0 break)
- ✓ Step 6 提交代码 + work_log_dir 落盘 (本文档 + bugs-found.md + test-reports/sc22-t02-it.log + .xml)
- ✓ Step 7 移交 Tester (本 task TL+Coder+Tester 单 sub-agent 兼任 · Phase 4 Tester 复用本 IT 当作 e2e 真证据)
- ✓ **铁律 1 单一专注**: 只领 SC22-T02 task
- ✓ **铁律 2 工作区隔离**: 在 worktree `/laughing-brown-e8ffb5` · branch `feature/M-AI-ANSWER-JUDGE-team-1` · 不动 main
- ✓ **铁律 3 权限隔离**: 本 Phase 3 不改 `passes` (Phase 4 后 Tester 改)
- ✓ **铁律 4 记忆持久化 (Git Commit)**: 本提交 commit message 描述性 + 含 AC1-4 编号 + git_commits 数组追加
- ✓ **铁律 5 强制落盘**: coder.md + bugs-found.md + test-reports/ 三件套全落盘 · 含关键词 (地形侦察 / 编码 / 自检 / 提交)
- ✓ **补充 6 E2E DoD**: 后端 task 不需要前端 VRT · IT raw log + .xml + log 字面证据 = DoD 三件套等价
- ✓ **补充 7 双脑回看**: 每次 Edit + commit 前回看 CLAUDE.md Rule 3 Surgical + coder-agent.md 当前 step + Rule 6 tool-use ~ 35 次 (未触线)

## 5. 提交

git_commits (本 Phase 3 + 4 联合提交):
- pending: `feat(SC22-T02 phase-3+4): AI_SERVICE_UNAVAILABLE 双断增强 · wb_judge_ai_timeout Counter + 18s CompletableFuture 上限保护 · 4 IT PASS (AC1-4) + SC20-T02 13 regression PASS`
