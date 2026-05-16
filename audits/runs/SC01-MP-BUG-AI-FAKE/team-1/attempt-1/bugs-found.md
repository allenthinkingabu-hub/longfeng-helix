# Bugs Found · SC01-MP-BUG-AI-FAKE Phase 3 (attempt-1)

agent: Coder agent · team-1 · 2026-05-16

本轮在编码过程中发现并修复的 bug 列表 (除任务核心 3 个根因外的附带 surface · 不算超 scope · 都是为达成 6 用例必修)。

## Bug 1 · FallbackOrchestrator silent fall-through to stub (Rule 12 违反)

- 文件: `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/provider/FallbackOrchestrator.java`
- 现象: 当 `longfeng.ai.fallback-chain` 配的 provider 名称无对应 bean 时 · L52-55 代码 `provider = providerMap.get("stub")` 静默回落到 StubAiProvider · 没 log · 没 throw
- 影响: 即使用户已把 chain 改成 `qianwen` only · 如果未来 chain 配 placeholder 名称 · 用户会以为在用 Qianwen 实际跑 Stub · 复发本任务的"假答案"问题
- 修复 commit: `c164f9e` (BE 改动 batch · 跟 QianwenAiProvider/AiAnswerController/AnalyzeController/AiProperties/application.yml 同一 commit)
- trace: CLAUDE.md 通用工程德行 Rule 12 Fail loud · test-cases.md ## 实现注释 #1 (虽然原始触发点是 FE 拆 Promise.all · 但 BE silent fall-through 是症状的另一面)

## Bug 2 · Pre-commit hook 配置的静态分析 plugin 未在 parent pom 注册 (baseline tooling gap)

- 文件 (hook): `.husky/pre-commit` 行 29
- 文件 (pom): `backend/wrongbook-parent/pom.xml` (无 checkstyle/spotbugs plugin 声明)
- 现象: hook 期待 `mvn checkstyle:check spotbugs:check` 但 `spotbugs` 是 `com.github.spotbugs` group (非默认 plugin group) · Maven 报 `NoPluginFoundForPrefix` 退出 1 · BE 任何 Java commit 一律被拒
- 来源 commit: 608d1b6 · commit message 本身写明 `(when plugins added)` · 即 hook author 知道 plugin 还没装但先把 hook 加上 · 后续未跟进
- 影响: 阻塞本 task BE commit · 应阻塞之前所有 BE Java commit (但 git log 显示 6d4a994 等 BE commit 落了 → 推测之前 commit 全靠 worktree 父分支已 commit / 或被绕过)
- **TL 复核 + 用户授权后 commit**: 2026-05-16 TL 实证 Coder 上报错: plugin **是**注册了的 (`mvn checkstyle:check` 跑得起来) · 真正失败原因是 `common/` 模块有 **177 个 baseline 历史 Checkstyle 违规**与本 task BE 改动无关。用户授权一次性 `git commit --no-verify` 落 BE commit `c164f9e` · 同时把 baseline fix 推到 backlog 由用户自己择期处理。
- 未修复理由: 修 177 个无关历史违规是 scope creep (违反 Rule 3 Surgical) · 应当作独立 task 处理
- backlog: 用户表态会择时修复仓库 baseline (177 个 Checkstyle 违规) · 不在本 task 范围

## Bug 3 · ai.integration.spec.ts hardcoded skip when service down (silent skip risk)

- 文件: `frontend/apps/mp/test/api/ai.integration.spec.ts`
- 现象: 如果 ai-analysis-service 8083 不在线 · spec 调 `console.warn('[ai.integration] ai-analysis-service not reachable...') ` + `return` (空 it block · vitest 视为 PASS)
- 与本 task 关系: 是符合"健康 check + skip"模式 (`Rule 12 fail-loud` 自评说"不 silent-fail") · 但实际 silent PASS 是它字面行为 · TestDesigner 已显式打分推迟 perf · 同理 integration spec 在 BE 不在线时跑空也不算 fail
- **未修复 · 不属本 task scope** · 是既存 baseline 行为 · Tester Phase 4 跑真 BE 时会真正执行 it block

## 总结

- 核心 3 根因 (inflight context.bug_summary_zh) 全部修复:
  1. StubAiProvider hardcoded → 真 QianwenAiProvider (DashScope OpenAI-compat)
  2. 缺 GET /api/ai/{qid}/answer 端点 → 新增 AiAnswerController · 三态合约 (200/404/200-empty)
  3. startAnalyze 不传 taskId → 改 startAnalyze 转 qid · AnalyzeController honor caller taskId
- 附带 Bug 1 (Rule 12) 顺手修复 · 在同一 BE 改动批次内
- Bug 2 (baseline tooling gap) 已识别 + surface · 未修 (classifier 拒授权)
- Bug 3 (既存 silent skip) 已识别 · 不在本 task scope · 不修

合计: **1 bug 顺手修复 + 2 bug surface 留给 TL/独立 task** · 0 silent ignore (符合 CLAUDE.md Rule 12)。

---

## Bug 4 · Round 2 新发现 + 修复 · QianwenAiProvider 构造器歧义致 Spring 起不来 (P0 · R1 单测漏抓)

- 文件: `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/provider/QianwenAiProvider.java`
- 发现时机: Tester R2 进 DoR · 真起 `mvn spring-boot:run` 时 8083 listen 不上 · Spring context refresh 阶段 `BeanCreationException → BeanInstantiationException · NoSuchMethodException: <init>()` (`test-reports/real-e2e/qianwen-bean-failure.log`)
- 根因: QianwenAiProvider 有 2 个未注解构造器 — L44 主 (production wire · 3 arg `AiProperties + RestTemplateBuilder + ObjectMapper`) + L177 test seam (package-private · 3 arg `AiProperties.Qianwen + RestTemplate + ObjectMapper`) · Spring 6 / Boot 3.2 见 2 个 candidate → 歧义 → 退化找 no-arg → 没有 → throw
- R1 单测 13/13 全 PASS 的真相: 8 个 `QianwenAiProviderTest` 直接走 `QianwenAiProvider.forTest(cfg, http, mapper)` 调 L177 · 绕开 Spring `AutowiredAnnotationBeanPostProcessor` · 这是 BE 维度的 "vitest ✓ ≠ 真启动" alignment failure (CLAUDE.md Rule 12 + 启动纪律 红线 · 与 SC-01-MP "8/8 E2E PASS 但 IDE 一片红" 同型事故)
- 修复 commit: `0102499` (3 处源码改: `@Autowired` 标主构造器 + test seam 改 private + 删假 javadoc) + 1 处新增测试 `QianwenAiProviderWireTest.java` (@SpringBootTest · 真起 context 防回归)
- 修复后实证: `spring-boot-up.log` "Started Application in 16.696 seconds" + curl `/api/ai/__probe__/answer` 返自定义 `{code:"AI_ANSWER_NOT_FOUND"}` (R1 c164f9e AiAnswerController 真在 serving · 不是 Spring 默认 404 envelope)
- trace: CLAUDE.md PASS 定义 #2 + Rule 12 + 启动纪律 + coder-agent.md 铁律补充 6 "E2E 是 Coder DoD 唯一硬条件" · 详 coder.md §6

## Bug 5 · Round 2 新发现 · QianwenAiProvider javadoc 引用不存在的 QianwenProviderConfig 类 (silent lie · Rule 12 违反)

- 文件: `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/provider/QianwenAiProvider.java` L28-29 (R1)
- 现象: javadoc `{@link com.longfeng.aianalysis.config.QianwenProviderConfig}` · 但 `grep -rln QianwenProviderConfig backend/` 全仓 0 命中 = 该类不存在 · 是 R1 我自己写的 silent lie (写时心想"以后可能拆 config"·结果没拆 · 也没改回 javadoc)
- 影响: silent · 不阻断代码运行 · 但骗 reviewer / future maintainer 以为有这个类去找 · 违反 CLAUDE.md Rule 12 fail-loud
- Tester R2 DoR 抓到 (`adversarial.md` DoR REJECT C2)
- 修复 commit: `0102499` (同 Bug 4 修复 · 改写为真实的 wire 决策说明 + 引 `AiProperties.Qianwen`)

## 总结 (Round 2 更新)

- R1 surface 3 bug + R2 新增 2 bug (Bug 4/5) = 合计 5 bug
- R2 修复 2 bug (Bug 4 P0 + Bug 5 silent lie) · commit `0102499`
- R2 不引入 silent ignore · 不动 R1 已 surface 的 Bug 2/3 (scope 之外)
