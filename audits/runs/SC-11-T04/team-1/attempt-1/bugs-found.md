# SC-11-T04 Attempt-1 · Bugs Found

## Bug #1 · regression · evidence-capture spec 0 [error] 红线被破

**症状**: 实现 sendBeacon POST /api/landing/track 后 · 跑 SC-11 全 regression · 发现 SC-11 T01/T02/T03 三个 evidence-capture spec 全部 FAIL · 报错:

```
expect(received).toHaveLength(expected)
Expected length: 0
Received length: 2
Received array: [
  "[error] Failed to load resource: the server responded with a status of 404 (Not Found)",
  "[error] Failed to load resource: the server responded with a status of 404 (Not Found)"
]
```

**根因**: 后端 anonymous-service:8090 P0 阶段没有 `/api/landing/track` endpoint (inflight scope_out 明示 "P1 接 GrowthBook/Sentry")。sendBeacon 是 fire-and-forget · 但浏览器仍会把 404 response 当 [error] resource event 推到 console · 命中 evidence-capture spec 的 `happyLog.filter(l => l.startsWith('[error]'))` 红线断言。

**修复**: `frontend/apps/h5/vite.config.ts` 的 `e2eFallbackPlugin` middleware 加一条:
```ts
if (method === 'POST' && url.startsWith('/api/landing/track')) {
  res.statusCode = 204;
  res.end();
  return;
}
```
与现有 `/api/v1/wrongbook/items 403` middleware 同款 pattern · 最小侵入。stub 204 absorb beacon · 浏览器不再报 [error] resource 404。

**修复 commit**: `e58e308`

**验证**:
- `curl -X POST /api/landing/track → 204` (vite auto-reload 生效)
- SC-11 全套 38 testcase 全绿 (T01 11 + T02 6 + T03 9 + T04 12)
- evidence-capture spec ide-console.txt 0 [error]

**复盘**: 早期决策提醒 — 对 P0 stub 路径而言 · 静默 catch 不够 · 必须从入口断网络层 error event · 否则会污染下游 IDE-clean audit 红线。CLAUDE.md Rule 12 Fail loud: 凡 silent fail 都会反弹到 audit 维度 · 这次是 audit 维度反弹回我自己。

---

总计本 attempt 发现 **1 bug** (regression · 已修)。
