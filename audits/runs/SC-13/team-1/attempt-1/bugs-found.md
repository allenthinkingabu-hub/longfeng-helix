# SC-13 · attempt-1 · Coder 发现并修复的 bug 列表

本 attempt 共发现并修复 **2 个 bug** (内循环自检捕获 · 不计 Tester 对抗):

## Bug 1 · vite proxy 漏配 /api/share 路径

- **现象**: SC-13 Playwright main (a) 真后端 + 真 JWT 路径走 `page.goto('/s/<jwt>')` → SharedView 发 fetch('/api/share/<jwt>') · vite dev 把请求当 SPA 路由处理 · 返 index.html · zod parse fail → INVALID 态 · 测试断言 `sharer-banner.toBeVisible()` fail.
- **文件**: `frontend/apps/h5/vite.config.ts`
- **修复**: append `'/api/share': { target: 'http://localhost:8090', changeOrigin: true }` 同 /api/landing 和 /api/session 模式
- **commit**: `9fd486d` (与 spec 同 commit · surgical 补 1 行 proxy)

## Bug 2 · pg npm dep 缺失 → Playwright spec 直接 pg 模块 import fail

- **现象**: 初稿 t01-shared-view.spec.ts 用 `import { Client as PgClient } from 'pg'` · pnpm 报 `Cannot find package 'pg' imported from ...` · spec 没法 load.
- **决策**: 不引入新 npm dep (避免 worktree pollute) · 改用 `child_process.execSync` + `docker exec -i team-1-pg psql` · 同样能真 INSERT DELETE share_token · 走 docker exec 已是项目 sandbox 既定容器.
- **文件**: `frontend/apps/h5/tests/e2e/sc-13/t01-shared-view.spec.ts` + `t01-shared-view-adversarial.spec.ts`
- **修复**: 替换 `pg` Client 为 `execSync` + `docker exec psql` 调用
- **commit**: `9fd486d`

---

发现并已修复 = 2 bug · 0 outstanding · 0 deferred.
