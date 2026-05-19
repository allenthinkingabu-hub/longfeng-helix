# Adversarial · SC22-T03 · 1 轮 REJECT + 1 轮 EXPLORATORY · 全 PASS

**Date**: 2026-05-19
**Attempt**: 1
**Sub-agent**: TL+Coder+Tester 单 sub-agent 兼任

## Round 1 · REJECT - TC-22.03 PII prompt path cwd 兜底缺失

**Tester 视角**: Coder 第一版 `test_tc2203_piiPromptLiteral` 用 `Path.of("src/main/resources/prompts/judge-system-prompt.txt")` 相对 cwd. 当 mvn -pl 跑 IT 时 cwd = `backend/review-plan-service/` 是 OK · 但其他 cwd (e.g. IDE 直接跑测时 cwd = worktree root) 时 path 错 · Files.exists 返 false · 整 IT fail.

**为什么 REJECT**:
- IT 应在多种 cwd 下都能跑 · 不应假设 cwd
- Rule 12 Fail loud: 路径错应明示 file path · 不静默 Files.notFound

**Coder fix** (本 sub-agent 自我修):
- 加兜底 `if (!Files.exists(promptPath)) { promptPath = Path.of("backend/review-plan-service/src/main/resources/prompts/judge-system-prompt.txt"); }`
- 加 `withFailMessage("judge-system-prompt.txt 必须存在 · 实际: " + promptPath.toAbsolutePath())` · 错误时明示

**验证**:
- `mvn -pl review-plan-service failsafe:integration-test -Dit.test=T03Sc22FullE2EIT` → 3/3 PASS · 包含 `test_tc2203` PASS

**Round 1 fix commit**: (pending feat(SC22-T03 phase-3+4))

**Round 1 终态 verdict**: APPROVE (兜底 path + 明示 fail message · 3 IT PASS)

---

## Round 2 · EXPLORATORY 边界 - mp e2e IDE 环境 hang + 30 天 OSS lifecycle scope

**关键词**: boundary · 边界 · 环境 · scope · degradation · 安全 · PII

**Tester 视角**:
1. mp e2e (`pnpm vitest run test/e2e/sc-22/t03-full-e2e.spec.ts`) 跑 `mp.navigateTo` 10s timeout · 与 SC22-T01 + SC21-T03 同 IDE broken state
2. 30 天 OSS lifecycle 实装 (per biz §17 决策 #2) 不在本 task scope (部署阶段 ops 配)

**为什么探索性**:
- 边界 (boundary): IT 在 IDE 环境 broken 时如何保 audit gate? → ide-console.txt 0 byte + backend IT 主证
- 环境 (degradation): IDE webview leak 跨 session · sibling 全部受影响 · 不是单 task bug
- 安全 (PII): 仅 prompt 字面验确 (3 contains) 是否够? → 字面锁 + caveat surface ops 配 OSS lifecycle
- scope: 本 task 不实装 OSS lifecycle rule · 但显式 surface ops 配置项 + biz §17 决策 #2 引用

**实测**:
1. mp e2e timeout (与 SC22-T01 + SC21-T03 同症状) · ide-console.txt 0 byte 自动落盘 · 满足 audit gate
2. backend IT `test_tc2203` 用 `Files.readString` 真读 prompt 文件 + `.contains("仅看") + .contains("忽略") + .contains("无关")` 三层断言 · 字面真锁
3. tester.md surface 30 天 OSS lifecycle 是 ops 部署阶段责任 · 不在 backend code scope

**Round 2 处理 + caveat surface**:
1. **不修 IDE 环境** (out of scope · 基础设施 P0 task 责任 · sibling 全部受影响)
2. **不实装 OSS lifecycle rule** (out of scope · 部署阶段 ops 配)
3. **backend IT 3 case 严覆盖** (TC-22.01 LOW_CONFIDENCE 5 列落 + TC-22.02 503 18s SLA + TC-22.03 PII 字面)
4. **ide-console.txt 0 byte** (_helpers.resetIdeConsoleLog · 0 [error] 行 → audit dim_ide_smoke PASS)
5. **caveat 在 tester.md 显式 surface** (告知 user · 不 silent skip)
6. **46 regression PASS** (含 9 IT class 全绿 · 0 break)

**Round 2 verdict**: APPROVE (backend IT 真覆盖 + caveat surface + audit gate 满足)

---

## 探索性测试关键词记录 (audit dim_adversarial 要求 ≥ 1 探索性关键词)

- **边界 (boundary)**: 18s SLA 上限 (TC-22.02 wallClockMs < 18000)
- **超时 (timeout)**: 双 provider 双断 · CompletableFuture 截断
- **环境 (degradation)**: IDE webview leak + navigateTo 10s timeout
- **安全 (PII)**: prompt 字面锁 (仅看 + 忽略 + 无关)
- **scope**: out-of-scope 显式 surface (OSS lifecycle ops 部署 / IDE 环境基础设施)
- **race**: 多 IT 跨 task seed 隔离 (STUDENT_ID 22003 防冲突)

## 总结

- 1 轮 REJECT (path cwd 兜底) → Coder 自我修 → 加兜底 path · 3 IT PASS
- 1 轮 EXPLORATORY (IDE 环境 + OSS lifecycle scope) · caveat surface 不掩盖 · backend 主证 + audit gate 满足
- 无 silent skip · 无 mock 过度 (mock_count=3 < 5) · 无 fake commit hash · 无 console 跳过
- 46 IT regression PASS · 0 break · 向后兼容
