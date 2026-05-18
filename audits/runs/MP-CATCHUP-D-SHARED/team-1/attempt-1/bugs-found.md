# MP-CATCHUP-D-SHARED · Bugs Found · attempt-1

## Bug 1 · Spec drift: Phase 0 stub ShareResponse 字段名与真后端不一致

- **File**: `frontend/apps/mp/src/api/share.ts` (Phase 0 stub commit 0857c9e)
- **症状**: Phase 0 stub 中 `ShareResponse.maskedPayload` 类型字段 `{stemSnippet, tags, difficulty, aiPreview}` · 真后端 `MaskedPayloadDto.java` 实际下发 `{stemSnippet, kpVisible, kpLockedCount, imgThumbBlurred}` · `sharerNick` 实际叫 `sharerNickMasked`
- **影响**: 如果不修 · 前端按 stub 字段渲染 · 真生产 BE 返的 JSON 不会匹配 · UI 显示空 (production drift)
- **Fix**: 在本 attempt 重写 ShareResponse + MaskedPayload 接口 · 严格对齐 `backend/anonymous-service/.../dto/ShareDto.java` + `MaskedPayloadDto.java` 真字段名 (`backend/anonymous-service/src/main/java/.../dto/ShareDto.java` JSON 序列化字段名)
- **Surface 理由** (CLAUDE.md Rule 7 Surface conflicts): Phase 0 prep 阶段 stub 类型是猜测 · 真后端 SC-13 已落 · 必须取真 wire shape 为 canonical · 不混用两套互斥定义
- **Fix commit**: 本 attempt commit (待 hash)

## Bug 2 · `_http.ts httpJSON` 不暴露 statusCode · 阻塞 4 错误码 mapping

- **File**: `frontend/apps/mp/src/api/_http.ts:86-93` (`httpJSON` wx.request 分支)
- **症状**: `httpJSON` 把非 2xx/3xx 直接 throw `new Error(HTTP ${res.statusCode})` · 调用方拿不到原始 statusCode 做 410/404/403 分支 mapping
- **影响**: 如果硬用 httpJSON · share.ts 需要 try/catch 后正则解析 error.message 提 statusCode · 脆弱不可读
- **Fix**: share.ts 不复用 httpJSON · 内置 wx.request + fetch 双 runtime adapter · 自己读 res.statusCode → ShareError code mapping
- **决策依据** (CLAUDE.md Rule 3 Surgical Changes): 不改 _http.ts (避免 cascade 影响其它 9 个 api 模块) · 在 share.ts 内自闭一个 adapter · 是更小的改动面
- **后续**: P1 可以考虑加 `httpJSONWithStatus` 通用 helper · 但本 task 范围内不动 (Rule 3)

## Bug 3 · Phase 0 stub `src/api/share.ts` 用 `void httpJSON; void apiBase;` 是反 pattern

- **File**: `frontend/apps/mp/src/api/share.ts` (Phase 0 stub commit 0857c9e:27-28)
- **症状**: Phase 0 stub 用 `void httpJSON; void apiBase;` 然后 throw NOT_IMPLEMENTED · 这是为了让 TypeScript 不报 "unused import" · 但读起来误导 (好像在用 httpJSON)
- **影响**: 误导后续 Coder 以为应该用 httpJSON · 实际上 share.ts 不需要 (见 Bug 2)
- **Fix**: 本 attempt 真实现替换 stub · 把 import 改为只 `import { apiBase } from './_http'` (httpJSON 不再 import) · 删除 `void` 语句
- **Fix commit**: 本 attempt commit

## 总结

- 3 bugs found in Phase 0 prep work
- All 3 surface'd 真实 spec drift + 架构 mismatch · 不是凭空发现
- All 3 fixed in this attempt (无 carry-over)
- 无新 bug 待 carry-over
