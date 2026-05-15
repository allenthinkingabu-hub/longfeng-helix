# coder.md · SC01-MP-T01 · attempt-3

## 1. 地形侦察

- 完整读 `design/mockups/wrongbook/02_capture.html` (200 行 mockup HTML · 设计真相 SoT)
- 完整读 `frontend/apps/h5/src/pages/Capture/index.tsx` (H5 同名页 · 取 state machine: IDLE→UPLOADING→UPLOADED→ERROR + API chain: presign + createQuestion)
- 完整读 `frontend/apps/mp/src/api/_http.ts` (TL 已写 httpJSON adapter · apiBase 端口映射 · file=8084 wb=8082)
- 完整读 `frontend/apps/h5/vite.config.ts` (backend port 对齐确认)
- 完整读 existing skeleton: `pages/capture/index.{json,wxml,wxss,ts}` (Hello World 骨架 · 需全量替换)
- 读 `frontend/packages/testids/src/index.ts` p02 section (testid 清单对齐)
- 读 `frontend/apps/mp/tsconfig.json` (target ES2017 · types: miniprogram-api-typings)

标杆模板: H5 Capture page (state machine + API contract) + mockup HTML (visual SoT)

## 2. 编码

### API clients (真 API · 0 mock)
- `frontend/apps/mp/src/api/file.ts`: presign() → POST /api/file/presign via httpJSON
- `frontend/apps/mp/src/api/wrongbook.ts`: createQuestion() → POST /api/wb/questions via httpJSON

### Page 全量实现
- `pages/capture/index.json`: custom nav + Vant components (van-icon, van-loading, van-toast)
- `pages/capture/index.wxml`: 1:1 mirror mockup DOM 结构 (nav + detect badge + tip + viewfinder + paper + brackets + scan + subjects + modes + dock + controls + tabbar + upload overlay + error banner)
- `pages/capture/index.wxss`: Mood C dark-camera 样式 · rpx 单位 · 全部 mockup CSS 映射
- `pages/capture/index.ts`: 完整 state machine (IDLE/UPLOADING/UPLOADED/ERROR) + 真 API 调用 (presign → wx.uploadFile → createQuestion → nav analyzing)

### 类型修复
- `typings/index.d.ts`: 增加 Node runtime 类型声明 (process, fetch, AbortController, Response) 解决 _http.ts 在 ES2017 target 下的类型错误
- `src/api/_http.ts`: 修复 block comment 中 `pages/*/index.ts` 含 `*/` 导致注释提前关闭的 bug

### Vitest 集成测试 (红线 0 mock)
- `test/api/file.integration.spec.ts`: 2 tests (200 正常 presign + 4xx missing body)
- `test/api/wrongbook.integration.spec.ts`: 2 tests (200 正常 createQuestion + 4xx invalid body)
- 真 fetch → localhost:8084 / localhost:8082 · health check 前置 · backend 未起时 surface fail (Rule 12)

### build-npm-fs
- `bash scripts/devtools-cli.sh build-npm-fs` 成功 · Vant Weapp 组件可用

## 3. 真实 E2E

PHASE-C 人工视觉路线 · automator E2E 不适用 · 改 tsc PASS + 4 截图 + spec-trace.md

- `pnpm -F mp typecheck` PASS (0 errors)
- 4 mockup baseline 截图 (chromium headless via playwright-core):
  - `design/system/screenshots/mp-baseline/p02-idle.png` (207KB)
  - `design/system/screenshots/mp-baseline/p02-focusing.png` (207KB)
  - `design/system/screenshots/mp-baseline/p02-captured.png` (205KB)
  - `design/system/screenshots/mp-baseline/p02-uploading.png` (171KB)
- `audits/runs/SC01-MP-T01/team-1/attempt-1/spec-trace.md` 落盘 (mockup DOM→WXML 映射表 + state machine + Vant 替换 + API 触点)

## 4. 自检

| 检查项 | 结果 |
|---|---|
| index.wxml 1:1 mirror mockup DOM | ✓ 全部元素映射 |
| index.wxss Mood C 暗色相机风格 | ✓ |
| index.ts state machine IDLE→UPLOADING→UPLOADED/ERROR | ✓ |
| index.ts 调 src/api/file.ts + wrongbook.ts (真 API · 0 mock) | ✓ |
| app.json pages 数组含 pages/capture | ✓ (已存在) |
| testid 全挂载 (p02-root/topbar/shutter/subjects 等) | ✓ |
| tsc --noEmit PASS | ✓ |
| 4 baseline 截图落盘 | ✓ |
| spec-trace.md 落盘 | ✓ |
| 0 vi.mock / msw / nock | ✓ |

## 5. 提交

- commit (feat): df8188e
- commit (2 bugs fixed: flash icon no-op ternary + tab4 icon mockup drift): dfb88c8
- commit (adversarial 探索性测试补齐): d936f7a
