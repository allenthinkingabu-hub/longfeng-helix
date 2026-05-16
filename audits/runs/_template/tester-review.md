# Tester Review · TestDesigner 提交的用例

reviewer: Tester agent <name>
date: <YYYY-MM-DD>
test_cases.md ref: audits/runs/<task>/<team>/attempt-<N>/test-cases.md (Round <N>)

## 视角
是否**够严** · 覆盖度 (happy + edge + console + perf) · Then 列是否够具体可断言 · console-clean 探针是否齐

## 覆盖度审查

- happy path: <用例 # · 状态>
- edge cases: <用例 # · 状态> · 期望 ≥ 2 类 (字段缺 / 网络异常 / 状态切换 等)
- console-clean 探针: <每用例 Console 列检查>
- perf 探针 (FCP / load time): <有/无 · 是否需要>
- i18n / boundary: <凌晨 0:00 / 时区切换 等>

## 反馈给 TestDesigner

- 缺测: <例: 缺性能用例 (FCP/load time 阈值) · 建议加用例 5>
- Then 列不够具体: <例: 用例 3 "不白屏" 太模糊 · 改成 "view 数 ≥ 8 + 显示 fallback 文案">
- 其他: <...>

## verdict

<!-- REJECT 或 APPROVE · 必有 1 个 -->
<!-- 红线: review 链条全程 ≥ 1 轮 REJECT (你和 Coder 加起来) · audit dim_test_cases_alignment.review_has_ge_1_reject_round 卡 -->

verdict: <REJECT | APPROVE>
