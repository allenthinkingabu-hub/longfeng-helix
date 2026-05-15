# Spec Trace · SC01-MP-T07 · P04→P05

## Mockup → Code trace

| Mockup 元素 | Code 位置 | 测试覆盖 |
|---|---|---|
| 05_wrongbook_list.html · nav h1 "错题本" | wxml `.nav-h1` | visual |
| 05_wrongbook_list.html · search bar + AI语义 badge | wxml `.search` + `.ai-badge` | visual |
| 05_wrongbook_list.html · subject chips (全部/数学/物理/化学/英语/语文) | wxml `.chips-row .sc` | onSubjectTap unit |
| 05_wrongbook_list.html · mastery filter (未掌握/部分掌握/已掌握) | wxml `.mr .mf` | enrichItem unit |
| 05_wrongbook_list.html · sort hint "按下次复习时间·升序" | wxml `.sort` | visual |
| 05_wrongbook_list.html · card (left-bar + thumb + body + right) | wxml `.card` | enrichItem unit |
| 05_wrongbook_list.html · stage-bar (T1-T6 dots) | wxml `.stage-bar .sb` | enrichItem stageDots unit |
| 05_wrongbook_list.html · FAB camera | wxml `.fab` | visual |
| 04_result.html · "保存并开启复习" button | result/index.ts `onSaveTap` | transition test |

## API → Code trace

| API 端点 | Code 位置 | 测试覆盖 |
|---|---|---|
| GET /api/wb/questions | src/api/wrongbook.ts `listWrongQuestions()` | api-modules unit + integration |
| GET /api/wb/questions/:qid | src/api/wrongbook.ts `getQuestionById()` | existing |

## Transition trace

| From → To | Trigger | Code 位置 | 测试 |
|---|---|---|---|
| P04 result → P05 wrongbook-list | onSaveTap (1500ms delay) | result/index.ts:178 | result-to-list.spec.ts |
