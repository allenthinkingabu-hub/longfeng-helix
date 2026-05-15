# Spec Trace · SC01-MP-T10 · P07→P08 transition

## Mockup → Code mapping

| Mockup element | Code location | Test coverage |
|---|---|---|
| P07 item card tap → P08 | `pages/review-today/index.ts:onItemTap` | `test/transitions/today-to-exec.spec.ts:item tap` |
| P07 "全部开始" CTA → P08 | `pages/review-today/index.ts:onStartAllTap` | `test/transitions/today-to-exec.spec.ts:CTA start-all` |
| nid from dataset.nid | `pages/review-today/helpers.ts:extractNidFromTap` | `test/unit/review-today-tap.spec.ts` (7 cases) |
| URL: /pages/review-exec/index?sid=X&nid=Y | `pages/review-today/helpers.ts:buildExecUrl` | `test/unit/review-today-tap.spec.ts` (4 cases) |
| createSession API | `src/api/review.ts:createSession` | existing `test/unit/api-modules.spec.ts` |
| vibration feedback (light) | `pages/review-today/index.ts:onItemTap` | `test/transitions/today-to-exec.spec.ts:vibration` |

## H5 sibling alignment

| H5 (ReviewToday/index.tsx) | MP (review-today/index.ts) | Aligned? |
|---|---|---|
| `reviewClient.createSession({tz})` → `nav('/review/exec/0?sid=${sid}')` | `createSession({node_ids, tz})` → `wx.navigateTo(buildExecUrl(sid, nid))` | YES — MP passes nid explicitly |
| navigator.vibrate(15) | wx.vibrateShort({type:'light'}) | YES — platform equivalent |
| double-nav guard via isStarting state | _isNavigating flag | YES |
