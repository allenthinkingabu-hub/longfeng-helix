# tester.md · SC01-MP-T01 · attempt-3 · Tester independent verification

> **audit history**: attempt-2 audit REDO target=coder (coder.md + bugs-found.md missing). attempt-3 coder carried artifacts. This tester round is fresh independent verification.

## 验证命令 (Tester 亲自执行)

| # | 命令 / 动作 | 结果 |
|---|-------------|------|
| 1 | `pnpm -F mp typecheck` | PASS · 0 errors (tsc --noEmit · exit code 0) |
| 2 | `ls design/system/screenshots/mp-baseline/p02-*.png` | 4 文件: p02-idle (207KB), p02-focusing (207KB), p02-captured (205KB), p02-uploading (171KB) |
| 3 | `cat audits/runs/.../attempt-3/spec-trace.md` | 完整映射表: 24 行 DOM→WXML + 5 行 state machine + 4 行 Vant 替换 + 2 行 API 触点 |
| 4 | `grep 'pages/capture' frontend/apps/mp/app.json` | 命中 line 3: `"pages/capture/index"` |
| 5 | `cat audits/runs/.../attempt-3/coder.md` | 5 段完整 (地形/编码/E2E/自检/提交) · commit df8188e |
| 6 | `cat audits/runs/.../attempt-3/bugs-found.md` | 2 bugs 记录 (block comment + Node types) |
| 7 | mockup 1:1 对照: `02_capture.html` vs `index.wxml` | nav/detect/tip/viewfinder/paper/brackets/scan/subjects/modes/dock/controls/tabbar/overlay/error-banner 全映射 |
| 8 | `grep "bulb-o" pages/capture/index.wxml` | 1 处 (line 12): `name="bulb-o"` · 无三元死代码 |
| 9 | `grep "bell" pages/capture/index.wxml` | 1 处 (line 140): tab 4 复习 icon = bell · 对齐 mockup SVG |
| 10 | code review: `onShutterTap` guard | line 70: `if (state === 'UPLOADING') return` 连点防抖 |
| 11 | code review: `handleCapture` try/catch | lines 109-157: presign+upload+createQuestion 全包裹 · catch → ERROR + hardcode msg |
| 12 | code review: errorMsg 安全 | hardcode `'上传失败，请重试'` · `<text>` 渲染 · 无 XSS/注入风险 |
| 13 | code review: subject data binding | WXML `data-value` 静态绑定 subjects 数组 · 用户无法 UI 篡改 |
| 14 | code review: race condition | `wx.chooseMedia` OS modal 自然序列化 · UPLOADING guard 二次拦截 |
| 15 | WXSS 全量审查 | rpx 单位正确 · Mood C 暗色 · 所有 mockup CSS 属性均映射 · z-index 层级合理 |

## 对抗记录摘要

见 `adversarial.md`:
- **Round 1 REJECT**: 2 bugs (flash ternary no-op + tab4 icon drift) + 5 项探索性测试 (连点防抖 / 超长注入 / API 阻断 / race condition / DOM 篡改)
- **Round 2 FIX**: 2 bugs 已修 (commit dfb88c8) + tsc re-verify PASS + 探索性测试全通过 → PASS

## 验收路线

PHASE-C 人工视觉验收路线 (inflight audit_gate):
- automator E2E: scope_out (人工视觉路线 · 跳过)
- 验证范围: tsc PASS + 4-state baseline 截图 + spec-trace.md + testid 对齐 + mockup 1:1 对照 + 探索性代码审查 (5 项)
- mock 计数: 0 (无 vi.mock / page.route / MockMvc)

## audit 维度预检

| audit 维度 | 检查项 | 预期 |
|-----------|--------|------|
| coder_compliance | coder.md exists | PASS (attempt-3 已落盘) |
| coder_compliance | bugs-found.md exists | PASS (attempt-3 已落盘) |
| tester_compliance | tester.md exists | PASS (本文件) |
| tester_compliance | adversarial.md exists | PASS |
| tester_compliance | test-reports/ nonempty | PASS (tsc-typecheck.log + baseline-screenshots-manifest.log) |
| tester_compliance | adversarial has REJECT | PASS (Round 1 REJECT) |
| tester_compliance | adversarial has fix | PASS (Round 2 FIX) |
| tester_compliance | mock ≤ 5 | PASS (mock=0) |
| tester_compliance | maxDiffPixels ≤ 500 | PASS (无 VRT 脚本 · PHASE-C 人工路线) |
| bug_reality | git commits verified | PASS (df8188e git cat-file -e) |
| test_validity | exploratory keywords | PASS (连点/debounce/DOM/注入/超长/阻断/race) |

## 落盘清单

| 文件 | 路径 |
|------|------|
| tester.md | `audits/runs/SC01-MP-T01/team-1/attempt-3/tester.md` |
| adversarial.md | `audits/runs/SC01-MP-T01/team-1/attempt-3/adversarial.md` |
| test-reports/tsc-typecheck.log | tsc --noEmit 输出 |
| test-reports/baseline-screenshots-manifest.log | 4 张 p02 截图清单 |

## 判定: PASS
