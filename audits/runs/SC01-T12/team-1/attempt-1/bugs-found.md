# SC-01-T12 · bugs-found · team-1 attempt-1

## Bug 1: P08 handleGrade 是 stub，不发 POST /grade
- **文件**: `frontend/apps/h5/src/pages/ReviewExec/index.tsx:122-126`
- **描述**: T11 留下的 stub 只发埋点 + 直接 nav，不调用后端 grade API
- **修复**: 实现真实 async handleGrade: POST /grade → loading 防重点 → 触觉反馈 → 导航
- **Commit**: (见 git log)

## Bug 2: reviewClient 是空对象，缺 gradeNode 方法
- **文件**: `frontend/packages/api-contracts/src/clients/review.ts:3`
- **描述**: `export const reviewClient = {}` — 所有 review API 方法未实现
- **修复**: 实现 6 个方法 (openNode, revealNode, gradeNode, getNodeResult, nextInSession, subscribeCalendar) + 新增 GradeReq/GradeResp 类型
- **Commit**: (见 git log)

## Bug 3: App.tsx 缺 P08/P09 路由
- **文件**: `frontend/apps/h5/src/App.tsx`
- **描述**: Routes 只有 `/`, `/capture`, `/analyzing/:taskId` — 无 `/review/exec/:nid` 和 `/review/done`
- **修复**: 新增两条 Route
- **Commit**: (见 git log)

## Bug 4: P08→P09 导航路径不一致
- **文件**: `frontend/apps/h5/src/pages/ReviewExec/index.tsx:125`
- **描述**: P08 nav 到 `/review/done/${nid}` (path param) 但 P09 用 `useSearchParams().get('nodeId')` (query param)
- **修复**: 改为 `nav(/review/done?nodeId=${nid}&sid=...&grade=${grade})`
- **Commit**: (见 git log)
