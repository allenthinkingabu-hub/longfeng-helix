# SC-11-T03 · Coder Attempt-1 · 工作日志

> P-LANDING 样例 Chips (数学/英语/物理) + P-SAMPLE 浮层 · 错因/正解/变式 3 卡片
> · 纯前端 task · 严禁触发 /api/ai/* + /api/guest/* (biz §2B.12 关键断言点)

## 1. 地形侦察

**继承基线**:
- SC-11-T01 落 `frontend/apps/h5/src/pages/Landing/LandingPage.tsx` · 含 `fetchSamples(bucket)` + 4 态机 (LOADING/READY/DEGRADED-samples/DEGRADED-kpi/DEGRADED-both)。复用 samples state → SampleChips props。
- SC-11-T02 落 HeroDemo + ThreeStepComic · 嵌入 LandingPage READY 态。
- Backend `anonymous-service:8090` /api/landing/samples 真返 3 学科样本 (数学/英语/物理) · 由 PHASE-A-ANON 落地 · `curl 8090/api/landing/samples` 验证返 `[{"subject":"数学",...}, {"subject":"英语",...}, {"subject":"物理",...}]` 三条记录与 chip mapping 完全对齐。
- `LandingSampleSchema` (frontend/packages/api-contracts/src/landing.ts L19-26) 字段: subject / stemText / knowledgePoints / errorReason / correction · **无 variant 字段** → SampleOverlay variant 卡片必须走 fallback 'AI 即将生成变式题' (符合 biz 关键断言点)。
- Playwright baseline: tests/e2e/sc-11/t02-landing-hero-three-step.spec.ts · 抄它的 `test.describe` 结构 + page.goto('/welcome') + getByTestId 套路 (testid 严格匹配 spec)。
- testids 包 `frontend/packages/testids/src/index.ts` 已有 sc11t01/sc11t02 节 · 本 task append sc11t03 节。
- 标杆模板 (Reference): SC-11-T02 HeroDemo (props 接入 + onError fallback) + SC-11-T01 4 态机 (`showSamples = state === 'READY' || state === 'DEGRADED-kpi'`)。

**审查 inflight scope_in 1-10**: 10 项 · 全部 in scope · 无 scope drift。

## 2. 编码

### 2.1 testids append (commit 81be0ef)

`frontend/packages/testids/src/index.ts` 加 `sc11t03` 节 · 8 个 testid:
- chipMath / chipEnglish / chipPhysics
- overlayRoot / overlayClose
- errorCard / correctionCard / variantCard

### 2.2 SampleChips 组件 (commit 81be0ef)

`frontend/apps/h5/src/pages/Landing/SampleChips/{index.tsx, index.module.css}` (新建)
- props 接 `samples: LandingSample[] + onChipClick(sample) → void` · **不内部 fetch** (复用 SC-11-T01 state)。
- SUBJECT_META 字典: { 数学 → 📐 + chipMath testid, 英语 → 📚 + chipEnglish testid, 物理 → ⚛️ + chipPhysics testid }。
- 渲染 `samples.slice(0, 3)` · 防越界。
- chip 视觉: pill-shape (border-radius 999px) + bg #eef2ff + active 态 transform scale(0.97)。

### 2.3 SampleOverlay 组件 (commit 81be0ef)

`frontend/apps/h5/src/pages/Landing/SampleOverlay/{index.tsx, index.module.css}` (新建)
- **React Portal**: `createPortal(<>...</>, document.body)` · 防被 LandingPage 滚动容器裁切 + z-index 干净。
- **3 close 触发器**:
  1. × button (右上角 sticky · backdrop-filter blur)
  2. mask tap (mask 外层 onClick=close · sheet onClick stopPropagation)
  3. Android 系统返回键: useEffect mount 时 `history.pushState({__overlay:true}, '')` 推虚拟 state → 监听 `popstate` 事件触发 onClose · close 主动 `history.back()` 弹掉虚拟 state (保持 URL 干净不出现 stuck stack)
- **body overflow lock**: open 时 `document.body.style.overflow='hidden'` · close 时 restore 原值 (avoid pollution if other code set inline overflow before)。
- **closedRef + closeOnceRef**: useRef 防 close 重入 (popstate listener + × button 同时触发同步竞态)。
- **3 卡片**:
  - errorCard (cardError 红色 #fef2f2) - sample.errorReason
  - correctionCard (cardCorrection 绿色 #ecfdf5) - sample.correction
  - variantCard (cardVariant 蓝色 #eff6ff) - sample.variant || 'AI 即将生成变式题 · 敬请期待。' (fallback 必走 · schema 无 variant 字段 · biz 关键断言点)
- 动效: mask fadeIn 240ms · sheet slideUp 280ms (cubic-bezier(0.16, 1, 0.3, 1) · 总 ≤ 300ms ✓)。
- ARIA: role="dialog" + aria-modal="true" + aria-label="样例分析详情"。

### 2.4 LandingPage.tsx 改造 (commit 81be0ef)

- 加 `const [openSample, setOpenSample] = useState<LandingSample | null>(null)` · 控制 overlay 显隐。
- READY 态 (`showSamples && samples`) 加 `<SampleChips samples={samples} onChipClick={(s) => setOpenSample(s)} />` 挂在 samplesSection 标题下。
- 文件末尾加 `{openSample && <SampleOverlay sample={openSample} onClose={() => setOpenSample(null)} />}` (跨越 LandingPage 根 div · 但 Portal 自己挂到 body 不受影响)。
- DEGRADED-samples 态 → `showSamples=false` → SampleChips + SampleOverlay 都不挂载 ✓ (符合 inflight scope_in 3(e))。

### 2.5 CSS 预算

- SampleChips/index.module.css: 800 字节 (≤ 1.5KB ✓)
- SampleOverlay/index.module.css: 2.3KB (≤ 2.5KB ✓)
- 总 ~ 3.1KB · 符合 inflight scope_in #4 (≤ 4KB) ✓

## 3. 真实 E2E

### 3.1 Playwright spec (commit f940c82)

**主 spec** `frontend/apps/h5/tests/e2e/sc-11/t03-landing-sample-chips-overlay.spec.ts` · 5 testcase 全绿:

| # | testcase | 关键断言 | 真测结果 |
| - | -------- | ------- | ------- |
| (a) chips_render_3_subjects | 3 chip visible · 文字 数学/英语/物理 | PASS (356ms) |
| (b) chip_tap_opens_overlay | 浮层 + 3 卡片 visible · body overflow=hidden · variant 含 "AI 即将生成" | PASS (428ms) |
| (c) overlay_close_via_x_button | × close · overlay hidden · body overflow 恢复 | PASS (707ms) |
| (d) overlay_close_via_mask_tap | mask tap · overlay hidden · 坐标避开 sheet | PASS (422ms) |
| (e) **no_ai_calls_during_overlay** | 完整开合 3 次 · /api/ai/* + /api/guest/* 累计 0 (**biz 关键断言点**) | PASS (1.4s) |

**对抗 spec** `t03-landing-sample-chips-adversarial.spec.ts` · 4 testcase (超额 · 红线 ≥ 2):

| # | testcase | 关键断言 | 真测结果 |
| - | -------- | ------- | ------- |
| (a) android_back_closes_overlay | popstate → overlay close · URL 仍 /welcome · chip 仍可再 open | PASS (430ms) |
| (b) 3_chip_cycle_open_close | 3 chip 循环开合 · 同时只 1 浮层 · stem 互不相同 | PASS (1.4s) |
| (c) sheet_click_does_not_close | 点 3 卡片内部不关闭 (stopPropagation 验证) | PASS (1.2s) |
| (d) chip_double_tap_no_double_overlay | 同 task 内连发 2 click event · 浮层 DOM 数恰 1 (REJECT round 1 后修复 · 见 bugs-found.md #1) | PASS (969ms) |

### 3.2 真后端真接口 (无 mock 业务 API)

- `/api/landing/samples` · vite proxy → anonymous-service:8090 · curl 验证真返 3 学科 (`数学`/`英语`/`物理`)
- `/api/ai/**` + `/api/guest/**` · page.route 仅作 spy + route.abort (audit dim 允许 · 测试基础设施 · 非业务 mock)
- 整轮测试 mock 总数 = 2 · 远 ≤ 5 红线

### 3.3 spec → testid → 状态机 trace 对照表

| spec.md §6 sample_overlay | testid | spec 行为 | t03 主 spec assertion |
| ------------------------- | ------ | --------- | --------------------- |
| close_x | overlayClose | × button → close | (c) `getByTestId('p-sample-overlay-close').click()` → `toHaveCount(0)` |
| close_mask | overlayRoot mask 区 | mask tap → close | (d) `page.mouse.click(box.x+8, box.y+8)` → `toHaveCount(0)` |
| close_android_back | popstate listener | back gesture → close | adv (a) `page.goBack()` → `toHaveCount(0)` |
| body_overflow_lock | body.style.overflow | open=hidden · close=restored | (b) `expect(...).toBe('hidden')` · (c) `expect(...).toBe(overflowBefore)` |
| variant_fallback | variantCard 卡片 | sample.variant 不存在 → fallback | (b) `toContainText('AI 即将生成')` |
| no_ai_call | /api/ai/* spy | 浮层期间不调 AI | (e) `aiCallCount === 0` |

### 3.4 evidence 落盘

`audits/runs/SC-11-T03/team-1/attempt-1/test-reports/`
- ide-console.txt (0 [error] · 仅 [debug] vite 连接 + [info] React DevTools + [warning] React Router future flag)
- screenshots/{01_chips_visible, 02_overlay_math_open, 03_overlay_english_open, 04_closed_back_to_landing}.png (4 张)
- playwright-list.log (raw stdout · 9/9 PASS)
- playwright-report/index.html (HTML 报告)

## 4. 自检

| 自检项 | 状态 | 证据 |
| ----- | ---- | ---- |
| 8 testid 新增 (sc11t03) | ✓ | `grep -n "sc11t03" frontend/packages/testids/src/index.ts` 命中 L530-539 · 8 行 |
| 3 close 触发器全实现 | ✓ | SampleOverlay/index.tsx L73-105 · onClick handleMaskClick · handleCloseBtnClick · popstate listener · history.pushState/back |
| body overflow lock + cleanup | ✓ | useEffect L73-114 mount/unmount 对称 · cleanup `document.body.style.overflow = originalOverflow` |
| Portal mount document.body | ✓ | createPortal(...) L130 · ReactDOM Portal · 不被 LandingPage 容器裁 |
| variant 字段 fallback | ✓ | `(sample as SampleWithVariant).variant ?? 'AI 即将生成变式题...'` L122 |
| 关键断言点 no AI call | ✓ | (e) testcase · aiCallCount=0 + guestCallCount=0 |
| 5 主 spec + 2+ adversarial | ✓ | 5 主 + 4 对抗 = 9 testcase · 全绿 |
| Regression 不破 | ✓ | SC-11 全套 25 testcase 全绿 (T01 11 + T02 6 + T03 9) |
| stem text 互不相同 | ✓ | adv (b) `uniqueStems.size === 3` · 真后端返 3 学科 stem 不同 |
| stopPropagation 防误关 | ✓ | adv (c) 3 卡片 click 不触发 close · 浮层仍 visible |
| tsc · Landing 文件零 error | ✓ | `pnpm exec tsc --noEmit` grep Landing 文件 → 0 行 (pre-existing errors 在 Analyzing/Capture/Result · 不在 scope_in) |
| Rule 6 tool budget | ✓ | 当前 tool use ≈ 35 · 远未到软线 50 |
| commit hash 真实 | ✓ | `git cat-file -e 81be0ef^{commit}` + `git cat-file -e f940c82^{commit}` 都过 |

## 5. 提交

| commit | hash | 内容 |
| ------ | ---- | ---- |
| 1 | `81be0ef` | feat(SC-11-T03): SampleChips + SampleOverlay 组件落地 · 8 testid 新增 · LandingPage READY 态接入 chips + overlay state · Portal + 3 close 触发器 · body overflow lock · variant 字段 fallback · 复用 SC-11-T01 samples state |
| 2 | `f940c82` | test(SC-11-T03): Playwright 5 main + 4 adversarial e2e · 关键断言点 /api/ai/* + /api/guest/* 累计 0 · android_back/3_chip_cycle/sheet_no_close/double_tap 探索性 · 9/9 PASS |

后续 (commit 3): evidence-capture spec + ide-console.txt + work_log 5 件套落盘。

## DoD 8 项

1. ✓ SampleChips + SampleOverlay 组件新建 · 嵌入 LandingPage.tsx READY 态
2. ✓ 3 close 触发器 (×/mask/Android back) 全实现 + body overflow lock
3. ✓ testids append 8 个 (sc11t03 节)
4. ✓ Playwright t03 主 spec 5 case + adversarial 2+ case 全绿 (9/9)
5. ✓ 关键断言点 · 浮层期间 /api/ai/* + /api/guest/* fetch === 0
6. ✓ Regression 既有 e2e 全绿 (SC-11 全套 25 testcase pass)
7. ✓ work_log 5 件齐 (本文件 + bugs-found.md + tester.md + adversarial.md + test-reports/)
8. ⏳ audit.js v3 PASS (tester 改 passes 后由 harness 调 · 本文件即为 audit 输入)
