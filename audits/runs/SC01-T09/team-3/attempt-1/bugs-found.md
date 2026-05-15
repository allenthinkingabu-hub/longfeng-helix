# SC01-T09 Bugs Found · team-3 · attempt-1

## Bug 列表

0 bug. 本轮编码未发现 bug。

### 说明
- P-HOME 和 P07 均为新建页面（greenfield），无预存 bug
- API 层 `createSession` / `getTodayReview` 为新增方法，后端 endpoint 已在 PHASE-B 前落地
- VRT baseline 首次建立，无 regression 可比
- P07 countdown 计时器因 `Date.now()` 导致 VRT 像素微差，通过 `maxDiffPixels: 2000 + threshold: 0.3` 补偿动态内容
