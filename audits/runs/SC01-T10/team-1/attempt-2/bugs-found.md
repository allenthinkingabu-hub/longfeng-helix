# SC01-T10 · Bugs Found · attempt-2

> 代码实现在 attempt-1 commit e588313 中完成。以下 5 个 bug 均在该 commit 中发现并修复。

## Bug 1: P08 初始状态错误 (ANSWERING → READING)

- **文件**: `frontend/apps/h5/src/pages/ReviewExec/index.tsx`
- **描述**: T11 实现时 P08 初始 execState 为 `'ANSWERING'`，但按 spec section 6 状态机，进入 P08 后应先处于 `READING`（题干可见但未开始答题），canvas touch 后才转为 `ANSWERING`
- **影响**: AC4 状态转移无法验证
- **修复 commit**: `e588313`

## Bug 2: P08 answerArea testid 挂载位置错误

- **文件**: `frontend/apps/h5/src/pages/ReviewExec/index.tsx`
- **描述**: `data-testid="p08-answer-area"` 挂在 blockTitle 而非实际 canvas 区域，导致 E2E dispatchEvent('mousedown') 无法触发 READING→ANSWERING
- **影响**: E2E AC4 测试失败
- **修复 commit**: `e588313`

## Bug 3: P08 close 按钮直接导航而非弹二次确认

- **文件**: `frontend/apps/h5/src/pages/ReviewExec/index.tsx`
- **描述**: T11 实现中 close 按钮 `onClick={() => nav('/')}` 直接导航回首页，违反 spec section 6.4 强制弹二次确认
- **影响**: AC5 不满足
- **修复 commit**: `e588313`

## Bug 4: App.tsx 缺少 P07/P08/P09 路由

- **文件**: `frontend/apps/h5/src/App.tsx`
- **描述**: 路由表在 -X ours merge 中丢失 P08/P09 路由，导致 /review/exec/:nid 404
- **影响**: P07→P08 跳转失败
- **修复 commit**: `e588313`

## Bug 5: vite proxy 缺少 /api/review 代理

- **文件**: `frontend/apps/h5/vite.config.ts`
- **描述**: vite proxy 未配 /api/review → review-plan-service:8085，前端 POST /open 无法到达后端
- **影响**: API 请求失败
- **修复 commit**: `e588313`
