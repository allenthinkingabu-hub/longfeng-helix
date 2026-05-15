# coder.md · SC01-MP-T03 · P03 Analyzing · attempt-3

> Carried forward from attempt-1 (commit 84c5db6) + attempt-2 statusText fix (commit 9be5534)

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

### 新增文件 (attempt-1 · commit 84c5db6)
| 文件 | 行数 | 说明 |
|---|---|---|
| `src/api/ai.ts` | 46 | startAnalyze(POST) + pollAnalyzeStatus(GET) |
| `pages/analyzing/index.ts` | 155 | Page 逻辑: state machine + polling + cancel |
| `pages/analyzing/index.wxml` | 131 | 1:1 mirror mockup DOM 结构 |
| `pages/analyzing/index.wxss` | 350+ | 1:1 mirror mockup CSS → rpx 转换 |
| `test/api/ai.integration.spec.ts` | 65 | 真 fetch → localhost:8083 (health-check gated) |

### 修改文件
| 文件 | 变更 | 说明 |
|---|---|---|
| `app.json` | +1 行 | pages 数组加 `pages/analyzing/index` |
| `src/api/_http.ts` | 2 行 | 修复 block comment 被 `*/` 提前截断 |
| `typings/index.d.ts` | +25 行 | 添加 Node 全局类型声明 |

### attempt-2 修复 (commit 9be5534)
| 文件 | 变更 | 说明 |
|---|---|---|
| `pages/analyzing/index.ts:67` | 1 行 | statusText 初始值 'AI 正在分析…' → '准备分析…' (per spec-trace state machine) |

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

## 4. 自检

| 检查项 | 结果 | 证据 |
|---|---|---|
| tsc --noEmit PASS | ✅ | `pnpm -F mp typecheck` 无错误 |
| app.json pages 更新 | ✅ | 含 `pages/analyzing/index` |
| 4 screenshots 落盘 | ✅ | `ls design/system/screenshots/mp-baseline/p03-*.png` = 4 文件 |
| spec-trace.md | ✅ | `audits/runs/SC01-MP-T03/team-2/attempt-1/spec-trace.md` |
| bugs-found.md | ✅ | 3 bugs (comment 截断 + typings 缺失 + statusText init) |
| statusText fix | ✅ | `grep "准备分析" pages/analyzing/index.ts` 命中 |

## 5. 提交

- **Commit 1**: `84c5db6` — `feat(SC01-MP-T03): P03 analyzing page 1:1 mirror mockup + real API client`
- **Commit 2**: `9be5534` — `test(SC01-MP-T03): tester PASS · fix statusText init bug`
- **Branch**: `claude/sc01-mp-t03-analyzing`
- **验真**: `git cat-file -e 84c5db6 && git cat-file -e 9be5534` → OK
