# Test Cases · <SC-X-T-Y> · <P-Page name>

trace: biz/<file>.md §<X.Y> · design/specs/<page>.spec.md §<5,9 等> · ui_specs §5 API 触点

> **格式约定 (audit.js dim_test_cases_alignment 卡口)**
>
> - 表头严格 6 列：`# | Given | When | Then | Console | View ≥ | API`
> - 用例行 ≥ 3 · ≤ 6 (1 task token budget · 多了拆 task)
> - 第 1 用例必是 happy path · 第 2-3 必含 edge (字段缺 / 网络异常)
> - Then 列只写"用户观察到什么" · 不写"调什么 API 内部怎么走"
> - Console 列必填: `0 [error]` 或 `不限制 (原因)`
> - View ≥ 列必填: 最小渲染元素数 (page.$$('view') 数) · 或 `n/a`
> - API 列必填: `<METHOD> /api/x → <status>` 或 `n/a`

| # | Given | When | Then | Console | View ≥ | API |
|---|-------|------|------|---------|--------|-----|
| 1 | <happy path 前置 · 例: 后端 review:8085 健康> | <用户操作 · 例: reLaunch /pages/home/index> | <用户观察 · 例: path === pages/home/index · 9 sections 全 mount> | 0 [error] | 15 | GET /api/review/today → 200 |
| 2 | <edge: 字段缺失 · 例: 后端返 data.done=null> | <同 1> | <例: data.todayDone === 0 (?? 兜底) · 不报 undefined warning> | 0 [error] | 15 | 200 · body.data.done=null |
| 3 | <edge: 网络异常 · 例: 后端 review 502> | <同 1> | <例: pageState=ERROR · 不白屏 · fallback MVP 数据> | 不限制 (网络 error 是 expected) | ≥ 8 | 502 |
| 4 | <interaction 前置 · 例: pageState=READY> | <例: tap [data-test-id=start-all-btn]> | <例: nav to pages/review-exec/index> | 0 [error] | n/a | n/a |

## Changelog (TestDesigner 每轮 review 后追加)

<!-- 每轮 review 后追加 ## Round N · 改了什么 -->

## Round 1 · 初版
- TestDesigner agent <name> 起草 · 4 用例
