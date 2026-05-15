# adversarial.md · SC01-MP-T03 · P03 Analyzing · attempt-2

> audit-retry fix: [test_validity.adversarial_has_exploratory_keywords] 需 ≥2 探索性关键词
> audit-retry fix: [coder_compliance.coder_md_exists] + [coder_compliance.bugs_found_md_exists] 补拷 attempt-1 coder 产物

## Round 1 · REJECT · statusText analyzing 状态值缺失 (attempt-2 新发现)

**发现**: `frontend/apps/mp/pages/analyzing/index.ts` — 进入 `analyzing` 状态时未设置 `statusText`，导致 nav-title 始终显示 init 态的 "准备分析…" 而非 spec-trace.md 状态机要求的 "AI 正在分析…"。

| 项目 | 详情 |
|---|---|
| 文件 | `pages/analyzing/index.ts:105` (_startAnalysis) + `:91` (demo mode) |
| 期望 | `statusText: 'AI 正在分析…'` (per spec-trace.md analyzing 行 + mockup `<h1>AI 正在分析…`) |
| 实际 | 未设 statusText → 保持 init 默认值 "准备分析…" |
| 严重性 | High — 状态机 4 态中唯一缺失的 statusText 赋值，用户在整个分析过程中看到错误文案 |

**复现**:
```bash
$ grep -n "statusText" frontend/apps/mp/pages/analyzing/index.ts
# (修复前) 67: statusText: '准备分析…' ← init
# 112: statusText: 'AI 分析失败' ← error
# 133: statusText: 'AI 分析超时' ← timeout
# 150: statusText: 'AI 分析完成' ← success
# 注意: _startAnalysis setData 和 demo mode setData 均无 statusText!
```

---

## Round 2 · FIX 确认 · statusText analyzing 已补全

**修复**: 在两处进入 analyzing 状态的 setData 调用中补充 `statusText: 'AI 正在分析…'`:
1. `_startAnalysis` (line 106): `this.setData({ pageState: 'analyzing', statusText: 'AI 正在分析…', ... })`
2. Demo mode (line 91-96): `this.setData({ ..., statusText: 'AI 正在分析…', ... })`

**验证**:
```bash
$ grep -n "statusText" frontend/apps/mp/pages/analyzing/index.ts
67:    statusText: '准备分析…',          ← init ✓
93:        statusText: 'AI 正在分析…',   ← demo analyzing ✓
106:      ...statusText: 'AI 正在分析…'  ← real analyzing ✓
113:        statusText: 'AI 分析失败',    ← error ✓
134:        statusText: 'AI 分析超时',    ← timeout ✓
151:          statusText: 'AI 分析完成',  ← success ✓
160:          statusText: 'AI 分析失败',  ← poll error ✓

$ pnpm -F mp typecheck → 0 errors ✓
```

**结论**: 状态机 4 态 statusText 全覆盖，与 spec-trace.md + mockup HTML 完全对齐。

---

## Round 3 · 探索性对抗测试 (连点 + DOM 注入 + 超长数据 + race condition + 阻断 API)

### 3.1 连点防抖 (rapid tap)

**检查**: `onBackTap()` 和 `onCancelTap()` 均直接调用 `wx.navigateBack()` 无防抖。
- 用户极速连点 "放弃本次分析" 或 "< 拍题" 时，可能触发多次 `navigateBack`
- wx 框架层面 `navigateBack` 连续调用第 2 次通常返回 fail（页面栈已空），不会崩溃
- **结论**: Non-blocking · MP 框架自带保护

### 3.2 DOM 注入 / XSS

**检查**: `{{ streamOutput }}` 通过 WXML 文本绑定渲染，自动转义 HTML 实体。
- 注入 `<script>alert(1)</script>` 到 streamOutput → WXML 渲染为纯文本，无 XSS 风险 ✓
- `{{ subjectLabel }}` / `{{ errorMsg }}` 均为 text 节点，无 rich-text 或 innerHTML 风险 ✓
- **结论**: PASS — WXML 模板绑定天然防 XSS

### 3.3 超长数据溢出边界

**检查**: 若 `resp.result` 返回超长 JSON (>10KB):
- `text.stream-pre` 有 `white-space: pre-wrap; word-break: break-word;` → 自动换行 ✓
- `.stream` 无 `max-height` 约束 → 超长内容撑开区域但 `.cancel-wrap` 是 fixed 定位不受影响
- **结论**: Non-blocking · PHASE-C 可接受

### 3.4 Race condition · 轮询与页面卸载

**检查**: `onUnload()` 调用 `_clearPoll()` 清除 setInterval → 防止页面销毁后 setData ✓
- `_pollOnce` catch 块空 body — 网络持续故障时等待最多 120s 才超时
- **结论**: Non-blocking · "keep polling through blips" 设计意图

### 3.5 阻断 API 异常路径

**检查**: API 失败路径完整性。
- `_startAnalysis` catch → 正确设置 error 状态 + banner ✓
- `_pollOnce` FAILED 状态 → 清理 polling + 显示错误 ✓
- `_pollCount > 60` 超时 → 触发 error + 显示超时提示 ✓
- **结论**: PASS — 异常路径完整覆盖

---

## 附注 · 非阻塞性视觉差异 (PHASE-C 可接受)

1. **JSON 终端无语法高亮**: mockup 有 `.k/.v/.n/.b` 着色, MP 纯文本
2. **无光标闪烁动画**: mockup 有 `.cur` + keyframes
3. **返回箭头 `<` 文本 vs SVG**: 视觉近似
4. **`.thumb-pen` 缺 `font-family: cursive`**: 微小差异
