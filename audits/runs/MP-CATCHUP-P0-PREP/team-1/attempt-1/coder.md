# MP-CATCHUP-P0-PREP · team-1 · attempt-1 · coder.md

## Phase
Phase 0 prep · 顺序单 agent · 为后续 4 个并行 team (A login · B welcome · C guest-capture · D shared) 立脚手架. Not a feature task — 不跑 audit.js · 只产 coder.md (轻量).

## What changed

### Modified (2 files)
- `frontend/apps/mp/src/api/_http.ts` (+5/-2) — PORT_MAP 加 `anon: 8090` + `auth: 8091` · `apiBase()` TS union 扩展为 `'file' | 'wb' | 'ai' | 'review' | 'anon' | 'auth'` · 顶部注释端口列表同步.
- `frontend/apps/mp/app.json` (+4/-0) — `pages` 数组末尾追加 4 项: `pages/login/index`, `pages/welcome/index`, `pages/guest/capture/index`, `pages/shared/index`. 原 10 项 + tabBar + window + sitemapLocation 全保留未动.

### New (16 files)
Placeholder pages (4 × 4 = 16 files):
- `frontend/apps/mp/pages/login/{index.json,index.wxml,index.wxss,index.ts}` · title "登录" · team A
- `frontend/apps/mp/pages/welcome/{index.json,index.wxml,index.wxss,index.ts}` · title "AI 错题本" · team B
- `frontend/apps/mp/pages/guest/capture/{index.json,index.wxml,index.wxss,index.ts}` · title "游客试用" · team C
- `frontend/apps/mp/pages/shared/{index.json,index.wxml,index.wxss,index.ts}` · title "分享内容" · team D

每个 .ts 仅 `Page({ onLoad() { console.log('placeholder: <page>') } })` · .wxml 仅 1 行 placeholder view · .wxss 共享 `.placeholder` 样式块.

API wrappers (4 files):
- `frontend/apps/mp/src/api/auth.ts` — `login` / `wechatLogin` · 2 stubs · 全 `throw NOT_IMPLEMENTED · team A`
- `frontend/apps/mp/src/api/anon.ts` — `mint` / `consent` / `presign` / `postQuestion` / `analyzeByUrl` / `getResult` / `claim` · 7 stubs · 全 `throw NOT_IMPLEMENTED · team C`
- `frontend/apps/mp/src/api/landing.ts` — `getSamples` / `getKpi` · 2 stubs · `throw NOT_IMPLEMENTED · team B`
- `frontend/apps/mp/src/api/share.ts` — `getShare` · 1 stub · `throw NOT_IMPLEMENTED · team D`

所有 stub 都已写好 TS interface (request / response shape · 与 backend 落地端点对齐) · 仅 function body 是 `throw new Error('NOT_IMPLEMENTED · team X')`. JSDoc 头注释含 SC 号 + spec.md 路径 + backend 端口 + (where relevant) header 约定.

## Verification
- `npx tsc --noEmit` PASS (无 error · 无 warning) — 命令在 `frontend/apps/mp/` 下跑.
- `git status` — 工作树仅 14 个 new files + 2 个 modified files · 无意外改动 · 与计划严格一致.

## 后续 team 注意事项

1. **PORT_MAP 用法**: 直接 `apiBase('anon')` → `http://localhost:8090`. landing / share / session / anon-flow 全在 8090 · 不需要单独 prefix · 都用 `'anon'`. auth 是 `'auth'` → 8091.
2. **unwrapApiResult 已在 httpJSON 内自动调用**: backend 返 `{code,message,data}` 包裹时 · `httpJSON<T>(...)` 直接拿到 `T` (即 data). 团队**不要**再自己解包. 见 `_http.ts` line 40-51 + `file.ts` line 48-55 (反例参考).
3. **dual-runtime _http**: `httpJSON` MP 用 `wx.request` · Node test 用 `fetch`. 已自动判断. 不要写 raw `wx.request`.
4. **header**: 
   - file-service 不要 user header.
   - wrongbook (8082): `X-Student-Id`
   - review (8085): `X-User-Id`
   - anon (8090): `X-Anon-Token` (mint 后所有 anon 请求都要带 · 详见 design/system/pages/P-GUEST-CAPTURE-guest-capture.spec.md §5)
   - auth (8091): 无 (登录前). 登录后 `Authorization: Bearer <token>`.
   - POST mutators 加 `X-Idempotency-Key` (mirror file.ts presign 模式)
5. **不破现有 9 个 MP 页 + backend 全 freeze**: P0 prep 只新增 + 给 _http/app.json 两个 surgical edit · 任何 team 进入 P1 时必须保持这条约束.
6. **stub 的 `void httpJSON; void apiBase;`** 只是为了避免未来 strict unused-import 启用时编译报错 · team 真实现时直接删 `void` 行 + 调用 `httpJSON(...)`.

## Commit
单个 commit · message 见 git log. work_log_dir clean · 仅本 coder.md.
