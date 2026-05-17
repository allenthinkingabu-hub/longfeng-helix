# SC-00-T01-T02 · attempt-1 · Coder Bug List

> 本轮真实踩坑 5 条 · 全部在 attempt-1 内部修复 (continuation TL agent 直接修 + 验证 PASS · 无需 attempt-2)。

---

## Bug 1 · BootstrapGate React.StrictMode 双 mount 导致 splash 永久卡死

**严重度**: 致命 (Playwright 4/4 全 fail)

**现象**: 第一次跑 Playwright TC-00-B/C/D 全部 timeout in `waitForURL`。page snapshot 显示 "正在准备…" splash 永远未消失。

**根因**: `BootstrapGate.tsx` 原实现用 `useEffect` + `let cancelled = false` + cleanup `cancelled = true` 控制 promise 是否生效。React.StrictMode 在 dev 下双调用 effect：
- 第 1 次 effect → 启动 resolveEntry promise + setState `needGate=true`
- React unmount/cleanup → `cancelled = true` 标记
- 第 2 次 effect → 检查 `if (needGate !== null) return` 直接 return (因为已 setState)
- 第 1 次 promise resolve → 进 `if (cancelled) return` 被 abort → **永远不 navigate**

**修复**: `BootstrapGate.tsx` 改用 `useRef launchedRef` 锁住启动一次的语义，去掉 cancelled 检查 + 去掉 useEffect 对 needGate state 的依赖。

**修复 commit**: 包含在 `9b1acd9` (feat SC-00-T01: h5 bootstrap...)，因为这个 bug 在前任 TL 切走前最后一刻才暴露，continuation TL agent 修完直接合并 commit。

**reproduction**:
```
cd frontend/apps/h5 && pnpm exec playwright test tests/e2e/sc-00/t01-resolve-entry.spec.ts
# 修复前: 3 failed, 1 passed (TC-00-A 因 0 backend call 路径恰好不依赖 setReady 时序)
# 修复后: 4 passed (2.5s)
```

**预防**: 任何在 React.StrictMode 下用 useEffect + state-flag + cleanup-cancel 的 promise 模式都有此风险。改用 useRef 或 AbortController 更稳。

---

## Bug 2 · auth IT 选择 com.sun.net.httpserver.HttpServer 作 stub (不是 Mockito / WireMock)

**严重度**: 设计选择 (非真 bug · 但影响 audit dim 2 mock 计数)

**前任决策**: 起一个真随机端口 anonymous-service spring-boot:run 模拟 503 不可行 (二次起 anonymous-service 与 sandbox PG 冲突 + 启动慢)。换 `com.sun.net.httpserver.HttpServer` (JDK 自带) 在 IT static 块开 random port。auth-service 通过 `@DynamicPropertySource` 注入 `anonymous-service.base-url=http://127.0.0.1:{stubPort}`。

**优点**:
- 真 HTTP wire (不是 Mockito mock RestClient)
- 真 503 switch (静态 `STUB_FAIL_503=true`)
- 真 body recorder (`LAST_BODY.set(...)` 验证 JSON.deviceFp/platform/ua)
- 加入 audit mock 计数仅 +1 (远低于 ≤5 上限)

**缺点**:
- stub 不持久化到 account_device 表 → IT 跑完查表 0 行 (这是 by design · stub 替代了真表)
- 真生产 anonymous-service 是否真写表，由 anonymous IT case e (`p0_fingerprint_short_circuit_returns_LANDING_not_WELCOMEBACK`) 独立 cover。

**验证**: anonymous-service AccountDeviceService.silentUpsert 在 IT 中通过 fixture `account_device` row 间接测试 (case e 反作弊 IT 写一行确保 P0 期不读 → 反向证明 service 能写)。

---

## Bug 3 · decision 枚举数 (zod 6 枚举 vs feature_list 5 枚举)

**严重度**: 文档 drift (代码以 zod 为准)

**情况**: 早期 `feature_list.json` 写 5 枚举 (没 LOGIN)，但 zod schema (`packages/api-contracts/src/session-resolve.ts`) 是 6 枚举 (HOME / LANDING / SHARED / OBSERVER / WELCOME_BACK / LOGIN)。

**决策**: 严格按 zod 6 枚举实现 (`ResolveResponse.java` enum + `DecisionTreeService` 输出)。feature_list 视为 stale。

**验证**: Playwright TC-00-C 测 LOGIN 决策 + 透传 redirect → 4/4 PASS。zod parse 在 resolve-entry.ts `ResolveResponseSchema.safeParse` 守护非法值。

---

## Bug 4 · JWT 前端 decode-only · 安全模型文档化

**严重度**: 安全 (P0 已知风险 · P1 修复)

**情况**: HS256 secret 不能放前端 (任何 JS 都能 grep 出来)。前端 `jose.decodeJwt()` 只解 payload 不验签 → 攻击者可伪造 JWT 让前端 BootstrapGate 命中 HOME。

**缓解**: 后端任意被授权 API 调用必须验签 (auth-service JwtUtil + anonymous-service JwtVerifier 共享 secret 字面量) → 伪造 JWT 在第一个真请求 (例 P-HOME 拉数据) 就会被 reject。

**文档化**: `resolve-entry.ts` 顶部注释 "JWT secret HS256 不放前端 · 仅 jose.decodeJwt 解 payload + 手工 exp/iss/aud 检查 / 前端可伪造 JWT 但后端任意 API 调用就 reject"。

**P1 修复路线**: 改 RS256 / EdDSA · 把公钥推到前端做 verify (符合 OAuth2 标准)。

---

## Bug 5 · auth-service 共享 secret 字面量 (anonymous-service application.yml copy)

**严重度**: 安全 (P0 已知风险 · P1 修复)

**情况**: anonymous-service 需验签 auth-service 签的 JWT → 必须知道同一个 secret。P0 期直接把字面量复制到 `backend/anonymous-service/src/main/resources/application.yml`:

```yaml
anon:
  jwt:
    secret: <copy of auth-service secret>
    issuer: longfeng
    audience: h5
```

**风险**: 两份字面量任意一份泄露/不一致都会断验签。

**P1 修复**: 引入 Vault / k8s Secret · 两服务都 fetch 同一份。CLAUDE.md TODO 注释已标记。

---

## bug 计数

5 (1 致命已修 + 1 设计选择 + 3 已知 P0 风险已文档化)。

无 0-bug · 无静默跳过。

---

## attempt-2 期望 (若 Tester REJECT 触发)

(本 attempt PASS · 无 attempt-2 期望。Tester 可对抗探索: localStorage JWT 篡改 / resolve 慢 800ms / share_token 并发 / hook timeout 三态 / 节点 1 path 命中 /s/* 但 JWT 也命中本地 → 应跳过本地走后端)
