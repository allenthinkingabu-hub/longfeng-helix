# coder.md · SC01-MP-T03 · P03 Analyzing · attempt-3

> attempt-3 REDO 原因: attempt-2 审计发现 `coder.md` + `bugs-found.md` 未在 attempt-2 work_log_dir 下落盘。本轮在 attempt-3 目录下补齐。

## 1. 地形侦察

**标杆模板**: `frontend/apps/mp/pages/capture/` (P02 拍题页骨架)
- 读 `index.ts` → Page({}) 模式 + data/methods 组织
- 读 `index.wxml` → Vant 组件用法 (`van-button`, `van-icon`)
- 读 `index.wxss` → rpx 单位 + flex 布局 + iOS 风格
- 读 `index.json` → usingComponents 声明 Vant 组件

**设计真相 (SoT)**: `design/mockups/wrongbook/03_analyzing.html`
- 4-step pipeline: OCR 识别题干 → 学科/知识点判断 → 错因分析 → 生成解答步骤
- SSE streaming JSON 终端 (深色背景 #0F1422, monospace 字体)
- "放弃本次分析" cancel 按钮 (sticky, 红色文字)
- iOS 风格 tab bar (5 tabs: 首页/错题本/拍题/复习/我的)
- Model badge (green dot + qwen-vl-max / gpt-4o-mini)
- Preview card (题目缩略图 + 元信息 chips)

**H5 sibling**: `frontend/apps/h5/src/pages/Analyzing/index.tsx`
- state machine: useEventSource hook → SSE 实时流
- MP 无 EventSource → 改为 setInterval polling + pollAnalyzeStatus API

**HTTP client**: `frontend/apps/mp/src/api/_http.ts`
- httpJSON<T> dual adapter: wx.request (MP runtime) / fetch (vitest)
- apiBase('ai') → localhost:8083

## 2. 编码

### 新增文件 (commit 84c5db6)
| 文件 | 行数 | 说明 |
|---|---|---|
| `frontend/apps/mp/src/api/ai.ts` | 46 | startAnalyze(POST) + pollAnalyzeStatus(GET) |
| `frontend/apps/mp/pages/analyzing/index.ts` | 192 | Page 逻辑: init→analyzing→success\|error 状态机 + polling + cancel |
| `frontend/apps/mp/pages/analyzing/index.wxml` | 131 | 1:1 mirror mockup: nav/preview/model/banner/stages/stream/cancel/tabbar |
| `frontend/apps/mp/pages/analyzing/index.wxss` | 478 | 全量 CSS → rpx, iOS light theme, radial-gradient bg |
| `frontend/apps/mp/pages/analyzing/index.json` | 6 | usingComponents: van-icon |
| `frontend/apps/mp/test/api/ai.integration.spec.ts` | 65 | 真 fetch → localhost:8083 (health-check gated) |

### 修改文件
| 文件 | 变更 | 说明 |
|---|---|---|
| `frontend/apps/mp/app.json` | +1 行 | pages 数组加 `pages/analyzing/index` |
| `frontend/apps/mp/src/api/_http.ts` | 2 行 | 修复 block comment 被 `*/` 提前截断 (Bug 1) |
| `frontend/apps/mp/typings/index.d.ts` | +25 行 | 添加 Node 全局类型声明 (Bug 2) |

### Vant Weapp 组件替换
| H5 (Konsta UI) | MP (Vant Weapp) | 用途 |
|---|---|---|
| Konsta Icon | `van-icon` | pipeline 步骤图标 (success/cross) + tab bar 图标 |

## 3. 真实 E2E

**PHASE-C 人工视觉路线** — miniprogram-automator E2E 跳过 (inflight `audit_gate` 明确 NO automator E2E)

### tsc PASS
```
$ pnpm -F mp typecheck
> tsc --noEmit
(0 errors)
```

### 4-state mockup baseline 截图
| 状态 | 路径 | 说明 |
|---|---|---|
| init | `design/system/screenshots/mp-baseline/p03-init.png` | 初始态: 所有步骤 wait |
| analyzing | `design/system/screenshots/mp-baseline/p03-analyzing.png` | 分析中: step 3 active + shimmer |
| success | `design/system/screenshots/mp-baseline/p03-success.png` | 成功: 全部 done |
| error | `design/system/screenshots/mp-baseline/p03-error.png` | 错误: 当前步骤 fail + banner |

截图通过 Playwright chromium 加载 `design/mockups/wrongbook/03_analyzing.html` → DOM 修改模拟 4 态 → clip 截图生成。

### spec-trace 对照表

| mockup DOM 元素 | WXML 映射 | data-test-id |
|---|---|---|
| `.preview` | `view.preview` | `p03-thumb-card` |
| `.preview .thumb` | `view.thumb` | `p03-thumb-card-image` |
| `.preview .meta h3` | `text.meta-title` | `p03-thumb-card-title` |
| `.model` | `view.model-badge` | `analyzing-pipeline-model-badge` |
| `.stages` | `view.stages` | `analyzing-pipeline` |
| `.stages .step[N]` | `view.step` (wx:for) | `analyzing-pipeline-step-{N}` |
| `.stream` | `view.stream` | `analyzing-pipeline-json-stream` |
| `.cancel` | `view.cancel-wrap` | `analyzing-pipeline-cancel-btn` |
| fallback banner | `view.banner` | `p03-fallback-banner` |

### 状态机
| 状态 | statusText | showBanner | steps |
|---|---|---|---|
| init | 准备分析… | false | 全 wait |
| analyzing | 准备分析… | false | 1..currentStep-1=done, currentStep=now, rest=wait |
| success | AI 分析完成 | false | 全 done |
| error | AI 分析失败 | true | currentStep=fail, before=done, after=wait |

## 4. 自检

| 检查项 | 结果 | 证据 |
|---|---|---|
| tsc --noEmit PASS | ✅ | `pnpm -F mp typecheck` 0 errors |
| app.json pages 更新 | ✅ | `app.json:4` 含 `pages/analyzing/index` |
| 4 screenshots 落盘 | ✅ | `ls design/system/screenshots/mp-baseline/p03-*.png` = 4 文件 |
| spec-trace 映射表 | ✅ | 见 §3 spec-trace 对照表 |
| bugs-found.md | ✅ | 2 bugs (comment 截断 + typings 缺失), 0 new in attempt-3 |
| API client 用 httpJSON | ✅ | `src/api/ai.ts` import from `./_http` |
| Vant 组件 van-icon | ✅ | `index.json` usingComponents + WXML 条件渲染 |
| git commits 验真 | ✅ | `git cat-file -e 84c5db6` OK, `git cat-file -e 70606f8` OK |
| coder.md 5 段落关键词 | ✅ | 地形侦察 / 编码 / 真实 E2E / 自检 / 提交 |
| previous_audit_verdict 修复 | ✅ | coder.md + bugs-found.md 已落盘 attempt-3 目录 |

## 5. 提交

- **Code Commit**: `84c5db6` — `feat(SC01-MP-T03): P03 analyzing page 1:1 mirror mockup + real API client`
- **Work Log Commit**: `70606f8` — `docs(SC01-MP-T03): coder.md + bugs-found.md audit work_log · attempt-1`
- **Branch**: `claude/sc01-mp-t03-analyzing`
- **验真**: `git cat-file -e 84c5db6` → OK, `git cat-file -e 70606f8` → OK
- **REDO 修复**: attempt-2 缺 coder.md/bugs-found.md → attempt-3 已在正确 work_log_dir 下落盘
