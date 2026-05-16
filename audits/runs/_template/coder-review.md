# Coder Review · TestDesigner 提交的用例

reviewer: Coder agent <name>
date: <YYYY-MM-DD>
test_cases.md ref: audits/runs/<task>/<team>/attempt-<N>/test-cases.md (Round <N>)

## 视角
是否**可实现** · API 是否真存在 · 是否漏前提条件 · 用例 Then 列是否清晰可断言

## 逐用例 review

- **用例 1**: <可实现 ✓ / 不可实现 ❌ / 需调整 ⚠> — <一句话理由>
  - 例: 可实现 ✓ — getHomeTodayCount API 已存在 (src/api/home.ts)
- **用例 2**: ...
- **用例 3**: ...
- **用例 N**: ...

## 反馈给 TestDesigner

<!-- 必填 · 没反馈视为审查不充分 -->

- 修复建议: <例: 用例 3 后端无 502 mock 开关 · 建议改成 docker stop 离线测>
- 漏覆盖: <例: 缺 wx.navigateBack 返回栈测>
- 其他: <例: API 触点表里没列 GET /api/review/today · spec 需补>

## verdict

<!-- REJECT 或 APPROVE · 必有 1 个 -->
<!-- 红线: review 链条全程 ≥ 1 轮 REJECT (你和 Tester 加起来) · audit dim_test_cases_alignment.review_has_ge_1_reject_round 卡 -->

verdict: <REJECT | APPROVE>
