# SC01-T10 · Adversarial Log · attempt-2

## Round 1 — REJECT · E2E 测试在错误环境下全部失败 (9/9 FAIL)

### Findings

**Finding 1: Vite dev server 指向错误 worktree (9/9 E2E FAIL)**
- 端口 5174 上运行的 vite 实际来自 `sc01-t08-home-to-wrongbook` worktree
- 该版本的 App.tsx 没有 P07/P08 路由 → `/review-today` 落入 catch-all `<Navigate to="/" />`
- 截图证据: 页面显示 "首页" 而非 P07 ReviewToday
- 严重性: **高** — 所有 9 个测试全部因找不到 `p07-root` / `p08-root` testid 超时失败

```bash
# 复现: 使用错误端口
PLAYWRIGHT_BASE_URL=http://localhost:5174 npx playwright test tests/e2e/sc-01/t10-target-to-exec.spec.ts --reporter=list
# 输出: 9 failed — locator('[data-testid="p07-root"]') not found

# 定位根因
ps aux | grep vite
# 发现 5174 = sc01-t08-home-to-wrongbook worktree, 不是 sc01-t10-target-to-exec
```

---

## Round 2 — FIX · 启动正确 worktree 的 dev server → 9/9 PASS

### 修复动作
1. 在 sc01-t10-target-to-exec worktree 的 `frontend/apps/h5` 下启动 vite dev server, 端口 5210
2. 使用 `PLAYWRIGHT_BASE_URL=http://localhost:5210` 重跑 E2E
3. 连续 3 次运行均 9/9 PASS, 无 flaky

### 修复结果

```bash
# 启动正确 worktree 的 dev server
cd frontend/apps/h5
npx vite --port 5210 &

# 重跑 E2E
PLAYWRIGHT_BASE_URL=http://localhost:5210 npx playwright test tests/e2e/sc-01/t10-target-to-exec.spec.ts --reporter=list
# 输出: 9 passed (3.6s)

# 稳定性确认 (连续 3 次)
# Run 1: 9 passed (3.6s)
# Run 2: 9 passed (3.4s)
# Run 3: 9 passed (3.6s)
```

### 判定
- Finding 1: **已修复** — 使用正确 worktree 的 dev server (port 5210), 路由正确, 9/9 PASS

---

## Round 3 — 探索性测试 (Exploratory Testing)

### 连点防抖验证 (rapid tap / debounce · 连点)
- P07 `handleItemTap` (L129-149): `if (loadingNid) return;` 阻止并发 tap
- P07 `handleStartAll` (L152-166): 同理 `if (loadingNid) return;` 阻止连点 CTA
- P08 `handleReveal` (L110-135): `if (execState !== 'ANSWERING' || isRevealing) return;` 双重锁
- P08 `handleGrade` (L139-166): `if (isGrading) return;` 防止重复评分
- **结论**: 所有交互入口均有 state guard, 连点安全 ✅

### DOM 篡改验证 (DOM manipulation)
- P08 exit confirm sheet: React 条件渲染 `{showExitSheet && ...}` (L415)
  - sheet 不在 DOM 中直到 `showExitSheet=true` → 无法通过 DOM 注入绕过
- P08 reveal content: `aria-hidden={!isRevealed}` (L316) + CSS `revealHidden` class (L314)
  - 答案区由 React state 控制, CSS `.revealHidden { display: none }` 只是视觉层
  - 即使用 DevTools 移除 `display:none`, 点击 grade 按钮仍被 `disabled={!isRevealed}` (L382) 阻止
- **结论**: 状态机完整性由 React state 而非 DOM 属性保证 ✅

### 超长/脏数据注入验证 (注入 · input injection)
- P07 无用户输入字段 — 数据来自 MOCK_TODAY 硬编码 (L21-97)
- P08 nid 来自 URL params `useParams<{ nid: string }>()` (L81)
  - 超长 nid (如 `/review/exec/a{1000}`) → React 正常渲染, `useMemo` 正常工作
  - 恶意 nid (如 `<script>alert(1)</script>`) → React JSX 自动转义, 无 XSS 风险
  - P08 canvas 区域是 `<div>` 而非 `<input>` — 无直接用户文本输入面
- **结论**: 无 XSS / 注入风险 ✅

### Race condition 验证 (race)
- P07 `handleItemTap`: `await reviewClient.openNode(nid)` + `nav()` 顺序执行 (L139-147)
  - 如果 openNode 网络慢, `try/catch` 会 catch 并继续 nav — 乐观更新 (spec §5 #1: 502 仍允许进 READING)
  - `setLoadingNid(null)` 在 `nav()` 后执行, 但由于组件已 unmount, setState 为 no-op
- P08 `handleReveal`: `isRevealing` 锁 (L87, L111-112) 防止并发 reveal
- P08 `handleGrade`: `isGrading` 锁 (L138, L140) 防止并发 grade
- **结论**: 异步操作均有锁保护, 无 race condition ✅

### E2E 脚本合规审查
- `page.route` 使用: 1 处 (POST /open stub, L143) — TL 已通过 `dor_c1_to_c6_required: false` 接受
- `page.evaluate` 使用: 0 处 ✅ (无 JS 注入绕过)
- `dispatchEvent('mousedown')` (L240): Playwright 合成事件, 用于触发 `onMouseDown` handler — 不等同于 `page.evaluate` 走后门
- `maxDiffPixels`: 所有 4 处 = 500 (上限) ✅
- `toHaveScreenshot`: 4 态 VRT 断言 (p07-idle, p08-reading, p08-answering, p08-exit-confirm) ✅

### 阻断测试 (网络 API 失败场景)
- P07 `handleItemTap` (L142-144): `try { await reviewClient.openNode(nid) } catch {}` — API 失败时静默 catch, 仍 nav 到 P08
  - 符合 spec §5 #1: "502 仍允许进 READING (前端乐观更新)"
- P08 `handleReveal` (L119-126): API 失败时 `setRevealedAt(new Date().toISOString())` — 前端兜底
  - 符合 spec §9: "502 失败 UI 仍展开答案 (eventually consistent)"
- **结论**: API 降级策略符合 spec 设计 ✅

---

**最终宣判: PASS** — 功能实现完整 (AC1-AC5 全覆盖) · 状态机正确 (READING→ANSWERING) · Exit confirm sheet 正确 · 9/9 E2E 连续 3 次稳定通过 · 连点/DOM/注入/race/阻断 探索性测试全通过
