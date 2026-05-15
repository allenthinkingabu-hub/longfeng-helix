# SC01-T10 · Bugs Found · attempt-1

## Bug 1: P08 初始状态错误 (ANSWERING → READING)

- **文件**: `frontend/apps/h5/src/pages/ReviewExec/index.tsx:81`
- **描述**: P08 页面 T11 实现时初始 execState 为 `'ANSWERING'`，但按 spec §6 状态机，进入 P08 后应先处于 `READING` 状态（题干可见但还没开始答题），canvas touch 后才转为 `ANSWERING`。
- **影响**: AC4 "READING → ANSWERING" 状态转移无法验证 · 揭示按钮在 READING 态也可点
- **修复**: 改初始状态为 `'READING'`，添加 `onTouchStart`/`onMouseDown` handler，reveal button 在 READING 态 disabled

## Bug 2: P08 answerArea testid 挂载位置错误

- **文件**: `frontend/apps/h5/src/pages/ReviewExec/index.tsx:216`
- **描述**: `data-testid="p08-answer-area"` 挂在 `.blockTitle` 标签上 ("你的解答 · 手写")，而不是实际的 `.work` canvas 区域。导致 E2E 中 `dispatchEvent('mousedown')` 无法触发 READING→ANSWERING 转换。
- **影响**: E2E AC4 测试失败
- **修复**: 将 testid 从 blockTitle 移到 work div

## Bug 3: P08 close 按钮直接导航而非弹二次确认

- **文件**: `frontend/apps/h5/src/pages/ReviewExec/index.tsx:178`
- **描述**: T11 实现中 close 按钮 `onClick={() => nav('/')}` 直接导航回首页，违反 spec §6.4 "强制关闭弹二次确认"铁律
- **影响**: AC5 不满足 · 学生看完题不打分可以直接退出
- **修复**: 添加 exit confirm sheet 组件 + showExitSheet 状态 + CSS

## Bug 4: App.tsx 缺少 P07/P08/P09 路由

- **文件**: `frontend/apps/h5/src/App.tsx`
- **描述**: 路由表只有 Capture 和 Analyzing，P08/P09 路由在 -X ours merge 中丢失
- **影响**: /review/exec/:nid 和 /review-today 路由 404 → 重定向回首页
- **修复**: 添加 /review-today, /review/exec/:nid, /review/done 三条路由

## Bug 5: vite proxy 缺少 /api/review 代理

- **文件**: `frontend/apps/h5/vite.config.ts`
- **描述**: vite proxy 只配了 file/wb/ai/s3 四个前缀，缺少 /api/review → review-plan-service:8085
- **影响**: 前端 POST /api/review/nodes/{nid}/open 请求在 dev 模式下无法到达后端
- **修复**: 添加 /api/review proxy 配置
