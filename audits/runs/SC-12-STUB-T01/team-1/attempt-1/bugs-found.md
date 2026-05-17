# SC-12-STUB-T01 Bugs Found · attempt-1

**0 bug** · 本 task 是最小 stub 活 (1 stub 页 + 1 Route + 1 testid 段 + 4+4 testcase) · 严格按 inflight scope_in 1-11 顺序落地 · 复用已有 stub-card.module.css + trackLanding 两大基建 · 一次过 attempt-1。

无 bug 触发, 无 fix commit。

## 探索性发现 (非 bug · 仅记录)

1. **App.tsx 通配 fallback (`<Route path="*" element={<Navigate to="/" replace />} />`)** 会吞所有未注册路由 · 若忘记加 `/guest/capture` Route · `page.goto('/guest/capture')` 不会 404 而是被重定向到 `/` · 难以肉眼发现。**防回归**: TC-12-STUB-T01 (d) `deeplink_direct_works` 显式断言 `new URL(page.url()).pathname === '/guest/capture'` · 防 path 静默被通配重定向。

2. **trackLanding util 的副作用**: 该 util 调用 `/api/landing/track` 上报埋点 · 这是 SC-11-T04 落的 endpoint · vite dev middleware 已 stub (204) · 不影响本 task `/api/guest/* + /api/ai/* + /api/file/*` 0 calls 的红线 (这三个范围与 /api/landing 不重叠)。`ide-console.txt` 真证据显示 `anon_stub_view` 日志正常输出 + 无 network error。

3. **匿名 Shell 内联 vs 抽组件**: 本 task scope_in 5d 说「如果 SC-11 系列没落统一 AnonShell 组件 · 本 task 在 stub 页内联实现」· 实测 SC-11 系列**未落**统一组件 (ObserverStub / WelcomeBack 都没有 Shell nav) · 故本 task 走内联路径。未来 P-GUEST-CAPTURE 真页 (SC-12) 落地时建议抽 `<AnonShell>` 公共组件 · 把这里 + Observer + WelcomeBack 三处复用。**这是优化机会 · 不是当前 bug**。
