# SC01-T02 Bugs Found · team-1 · attempt-1

## Bug 列表

### Bug 1: PresignResponse 缺少 image_url 字段
- **文件**: `frontend/packages/api-contracts/src/types.ts` + `clients/files.ts`
- **描述**: 后端 presign 返回的 `image_url` 字段未在 FE PresignResponse 类型和 client 映射中暴露, 导致 analyze-by-url 无法获取图片 URL
- **修复**: 新增 `image_url: string` 到 PresignResponse, files client presign() 映射 `data.image_url`
- **commit**: `053420e`

### Bug 2: App.tsx 路由指向 AnalyzingStub 而非真实 AnalyzingPage
- **文件**: `frontend/apps/h5/src/App.tsx`
- **描述**: `/analyzing/:taskId` 路由指向内联 AnalyzingStub (仅显示 "分析中..."), 未使用 T03 已 merge 的真实 AnalyzingPage 组件 (含 SSE 流水线 / 4 步 pipeline / cancel / fallback)
- **修复**: import 真实 AnalyzingPage, 替换 Stub; 补充 `/question/:qid/result` 和 `/manual-entry` 路由 stub 供下游 nav 使用
- **commit**: `053420e`

### Bug 3: Capture handleFile 缺少 analyze-by-url 调用
- **文件**: `frontend/apps/h5/src/pages/Capture/index.tsx` L195-211
- **描述**: E02c 占位注释 "will replace taskId=qid with real analyze taskId" 但未实际调用 `POST /api/ai/analyze-by-url`, 直接用 qid 作为 taskId 跳转 P03. 导致 P03 SSE 订阅的 taskId 与后端 ANALYZING task 不关联
- **修复**: createPending 后新增 analyzeMut.mutateAsync(), 用返回的 task_id 作为 nav URL 的 taskId 参数
- **commit**: `053420e`
