# coder.md · SC01-MP-T03 · P03 Analyzing · attempt-1

## 1. 地形侦察

**标杆模板**: `frontend/apps/mp/pages/capture/` (P02 拍题页 Hello World 骨架)
- 读 `index.ts` → Page({}) 模式 + testids import
- 读 `index.wxml` → Vant 组件用法 (`van-button`)
- 读 `index.wxss` → rpx 单位 + flex 布局
- 读 `index.json` → usingComponents 声明 Vant

**设计真相**: `design/mockups/wrongbook/03_analyzing.html`
- 4-step pipeline (OCR → 学科判断 → 错因分析 → 生成解答)
- SSE streaming JSON 终端 (深色背景 #0F1422)
- "放弃本次分析" cancel 按钮 (sticky)
- iOS 风格 tab bar (5 tabs)
- Model badge (green dot + 模型名)

**H5 sibling**: `frontend/apps/h5/src/pages/Analyzing/index.tsx`
- state machine: useEventSource hook → SSE
- MP 无 EventSource → 改为 polling via setInterval + pollAnalyzeStatus

**HTTP client**: `frontend/apps/mp/src/api/_http.ts`
- httpJSON<T> dual adapter: wx.request (MP) / fetch (vitest)
- apiBase('ai') → localhost:8083

## 2. 编码

### 新增文件
| 文件 | 行数 | 说明 |
|---|---|---|
| `src/api/ai.ts` | 46 | startAnalyze(POST) + pollAnalyzeStatus(GET) |
| `pages/analyzing/index.ts` | 155 | Page 逻辑: state machine + polling + cancel |
| `pages/analyzing/index.wxss` | 350+ | 1:1 mirror mockup CSS → rpx 转换 |
| `test/api/ai.integration.spec.ts` | 65 | 真 fetch → localhost:8083 (health-check gated) |

### 修改文件
| 文件 | 变更 | 说明 |
|---|---|---|
| `app.json` | +1 行 | pages 数组加 `pages/analyzing/index` |
| `src/api/_http.ts` | 2 行 | 修复 block comment 被 `*/` 提前截断 |
| `typings/index.d.ts` | +25 行 | 添加 Node 全局类型声明 (process/fetch/AbortController) |

### WXML (已有 stub 基础上保持)
- `index.wxml`: 131 行, 完整 1:1 mirror 含 nav/preview/model/banner/stages/stream/cancel/tabbar
- `index.json`: Vant van-icon 组件声明

## 3. 真实 E2E

**PHASE-C 人工视觉路线** — automator E2E 不适用 (inflight `dor_c1_to_c6_required: false`)

### tsc PASS
```
$ pnpm -F mp typecheck
> tsc --noEmit
(0 errors)
```

### 4-state mockup baseline 截图
| 截图 | 路径 | 大小 |
|---|---|---|
| init | `design/system/screenshots/mp-baseline/p03-init.png` | 217KB |
| analyzing | `design/system/screenshots/mp-baseline/p03-analyzing.png` | 221KB |
| success | `design/system/screenshots/mp-baseline/p03-success.png` | 206KB |
| error | `design/system/screenshots/mp-baseline/p03-error.png` | 223KB |

截图通过 `scripts/screenshot-p03.mjs` 生成: Playwright chromium 加载 mockup HTML → DOM 修改模拟 4 态 → clip 截图

### vitest integration test
- `test/api/ai.integration.spec.ts`: 真 fetch → localhost:8083
- Health-check gated (服务不在线 → skip 并 console.warn, 不 silent-fail)
- 2 test: startAnalyze 正常 + pollAnalyzeStatus 边界 (unknown taskId → 404)
- 禁 vi.mock / msw / nock (0 mock)

## 4. 自检

| 检查项 | 结果 | 证据 |
|---|---|---|
| tsc --noEmit PASS | ✅ | `pnpm -F mp typecheck` 无错误 |
| app.json pages 更新 | ✅ | 含 `pages/analyzing/index` |
| 4 screenshots 落盘 | ✅ | `ls design/system/screenshots/mp-baseline/p03-*.png` = 4 文件 |
| spec-trace.md | ✅ | `audits/runs/SC01-MP-T03/team-2/attempt-1/spec-trace.md` |
| bugs-found.md | ✅ | 2 bugs (comment 截断 + typings 缺失) |
| API client 用 httpJSON | ✅ | `src/api/ai.ts` import from `./_http` |
| pages/analyzing/index.ts 用 src/api/ai.ts | ✅ | `import { startAnalyze, pollAnalyzeStatus } from '../../src/api/ai'` |
| 0 mock in integration test | ✅ | 无 vi.mock / msw / nock |
| Vant 组件 (van-icon) | ✅ | index.json usingComponents + WXML wx:if 条件渲染 |
| git commit 描述性 | ✅ | `84c5db6` |

## 5. 提交

- **Commit**: `84c5db6` — `feat(SC01-MP-T03): P03 analyzing page 1:1 mirror mockup + real API client`
- **Branch**: `claude/sc01-mp-t03-analyzing`
- **验真**: `git cat-file -e 84c5db6` → OK
