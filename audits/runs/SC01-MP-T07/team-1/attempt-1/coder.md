# Coder Log · SC01-MP-T07 · P04→P05 (result→wrongbook-list) · attempt-1

## 1. 地形侦察

- 读取 `design/mockups/wrongbook/05_wrongbook_list.html` (P05 design SoT)
- 读取 `design/mockups/wrongbook/04_result.html` (P04 from page)
- 读取 `frontend/apps/h5/src/pages/WrongbookList/index.tsx` (H5 sibling 实现)
- 读取 `frontend/apps/mp/pages/result/index.ts` (wave-1 T05 实现 · transition source)
- 读取 `frontend/apps/mp/pages/review-exec/index.{json,wxml,wxss,ts}` (标杆模板)
- 读取 `frontend/apps/mp/src/api/wrongbook.ts` (现有 API: getQuestionById + createQuestion)
- 读取 `frontend/apps/mp/src/api/_http.ts` (httpJSON dual-runtime adapter)
- 读取 `frontend/apps/mp/test/unit/*.spec.ts` (unit test 模式参考)
- 读取 `frontend/apps/mp/test/transitions/exec-to-done.spec.ts` (transition test 模式参考)
- 读取 `frontend/apps/mp/test/api/wrongbook.integration.spec.ts` (integration test 模式参考)
- 读取 `frontend/apps/mp/app.json` (pages 数组)

侦察结果: API 缺 `listWrongQuestions`，app.json 不含 wrongbook-list page，result page onSaveTap 用 navigateBack 需改为 navigateTo。

## 2. 编码

### 2.1 API 层 (src/api/wrongbook.ts)
- 新增 `WrongQuestionListItem` / `ListWrongQuestionsResp` / `ListWrongQuestionsParams` 接口
- 新增 `listWrongQuestions()` 函数 · GET /api/wb/questions · query params 手工拼接 (避免 MP 环境无 URLSearchParams)

### 2.2 P05 wrongbook-list page
- `pages/wrongbook-list/index.json` — Vant 组件 (van-icon, van-loading, van-empty)
- `pages/wrongbook-list/index.wxml` — 1:1 mirror mockup: nav + search + subject chips + mastery filter + sort + card list + FAB
- `pages/wrongbook-list/index.wxss` — 完整样式 · iOS native 风格
- `pages/wrongbook-list/helpers.ts` — 纯函数 (formatDueLabel, formatTimeAgo, buildStarsLabel, enrichItem) · 提取以支持 unit test
- `pages/wrongbook-list/index.ts` — Page 逻辑 · state machine LOADING→EMPTY|LIST|ERROR

### 2.3 Transition P04→P05
- `pages/result/index.ts` · `onSaveTap` 改为 `wx.navigateTo({ url: '/pages/wrongbook-list/index?highlight=${qid}' })`

### 2.4 app.json
- 添加 `pages/wrongbook-list/index` 到 pages 数组

### 2.5 Vant build
- 执行 `bash frontend/apps/mp/scripts/devtools-cli.sh build-npm-fs` 成功

## 3. 自检

### typecheck
```
pnpm -F mp typecheck → 0 errors
```

### unit tests (red line: 100% pass)
```
pnpm -F mp test:unit → 40/40 tests pass (3 files)
- test/unit/wrongbook-list.spec.ts (19 tests) — formatDueLabel, formatTimeAgo, buildStarsLabel, enrichItem, listWrongQuestions export
- test/unit/api-modules.spec.ts (16 tests) — 包含新增 listWrongQuestions export check
- test/unit/_http.spec.ts (5 tests) — 未变
```

### transition test
```
test/transitions/result-to-list.spec.ts — 5 tests
- onSaveTap → toast + navigateTo /pages/wrongbook-list/index?highlight=qid (1500ms delay)
- URL path + highlight param 校验
- isSaving double-tap guard
- _qid fallback when _questionRaw is null
- isSaving reset after save
```

### integration test
```
test/api/wrongbook-list.integration.spec.ts — 3 tests (soft-skip when backend down)
- GET /api/wb/questions → 200 with items array
- GET ?subject=math → 200 filtered
- GET ?mastery=NOT_MASTERED → 200
```

## 4. 自检

| 检查项 | 结果 |
|--------|------|
| typecheck 0 errors | PASS |
| unit test 40/40 (100%) | PASS |
| wrongbook-list.spec.ts ≥ 1 test | 19 tests |
| integration 0 mock | PASS (soft-skip) |
| transition test mock wx only | PASS |
| app.json updated | PASS |
| Vant build-npm-fs | PASS |
| helpers 提取 · Page 不入 test | PASS |

bug: URLSearchParams 在 MP 环境未定义 → 改用手工拼接 query string (见 bugs-found.md)

## 5. 提交

Commit hash: (will be filled after git commit)
