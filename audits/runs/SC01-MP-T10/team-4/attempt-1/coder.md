# Coder Log · SC01-MP-T10 · P07→P08 transition · attempt-1

## 1. 地形侦察

- 完整读 `design/mockups/wrongbook/07_review_today.html` (P07 今日待复习) + `08_review_exec.html` (P08 复习执行)
- 完整读 H5 sibling `frontend/apps/h5/src/pages/ReviewToday/index.tsx` — 关键逻辑: tap item → createSession → `nav('/review/exec/0?sid=${sid}')`; "全部开始" CTA 同逻辑
- 完整读 `frontend/apps/mp/pages/review-exec/index.ts` (wave-1 T11 已建) — 确认 P08 页面接收 sid+nid 参数
- 完整读 `frontend/apps/mp/src/api/review.ts` — createSession + getToday + getNode 已就绪
- 标杆模板: `test/transitions/exec-to-done.spec.ts` (T12 同类 transition test · mock wx runtime only)
- T09 review-today page 未 merge → 需创建 minimal stub

## 2. 编码

### 新建文件
- `pages/review-today/index.json` — page config with van-icon
- `pages/review-today/index.wxml` — P07 UI stub (hero card + item list + CTA)
- `pages/review-today/index.wxss` — styles mirroring mockup 07
- `pages/review-today/index.ts` — Page 逻辑: onItemTap → extractNidFromTap → createSession → wx.navigateTo; onStartAllTap → createSession → first nid
- `pages/review-today/helpers.ts` — pure functions extracted for testability (extractNidFromTap, buildExecUrl)
- `app.json` — 添加 `pages/review-today/index`

### 测试
- `test/unit/review-today-tap.spec.ts` — 11 unit tests: nid extraction (7 cases) + URL building (4 cases)
- `test/transitions/today-to-exec.spec.ts` — 5 transition tests: item tap, CTA start-all, vibration order, empty nid guard, URL params

## 3. 真实 E2E

本任务为 transition only (wave-3) · 按 inflight `physical_verification.dor_c1_to_c6_required: false` · 不要求真 E2E。

Unit test + transition test 100% pass 即满足 DoD:
```
pnpm -F mp test:unit → 3 files, 31 tests passed
npx vitest run test/transitions/today-to-exec.spec.ts → 1 file, 5 tests passed
pnpm -F mp typecheck → PASS (0 errors)
```

## 4. 自检

| 检查项 | 状态 | 证据 |
|--------|------|------|
| extractNidFromTap null safety | PASS | 7 unit tests cover null/undefined/empty/missing |
| buildExecUrl encoding | PASS | 4 unit tests cover special chars + URLSearchParams |
| transition item tap | PASS | navigateTo called with /pages/review-exec/index?sid=X&nid=Y |
| transition start-all | PASS | createSession → first nid → navigateTo |
| double-tap guard | PASS | _isNavigating flag in page |
| vibration before nav | PASS | invocationCallOrder assertion |
| tsc --noEmit | PASS | 0 errors |
| app.json updated | PASS | review-today/index added |

## 5. 提交

Commit hash: 29cfa90
