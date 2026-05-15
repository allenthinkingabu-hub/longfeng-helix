# coder.md · SC01-T07 · P04→P05 自动跳转 + P05 错题本列表

## 1. 地形侦察

- 完整读 `.harness/agents/coder-agent.md` 铁律 5 条 + 补充 6/7 + 执行流程 7 步
- 完整读 `.harness/inflight/SC01-T07.json` AC1-AC4 + TI1-TI4
- 完整读 `.harness/agents/SHARED-E2E-PROTOCOL.md` DoR C-1..C-6
- 完整读 `design/system/pages/P04-result.spec.md` §5/§6/§7 跳转规则
- 完整读 `design/system/pages/P05-wrongbook-list.spec.md` §2-§15 全文
- 完整读 `design/mockups/wrongbook/05_wrongbook_list.html` 全文 250 行 1:1 视觉真相
- 标杆对齐: `frontend/apps/h5/src/pages/Result/index.tsx` + `Result.module.css` (P04 同 Mood B 风格)
- 标杆对齐: `frontend/apps/h5/tests/e2e/sc-01/t05-result-save.spec.ts` (E2E 模式参考)
- 标杆对齐: `frontend/packages/api-contracts/src/clients/questions.ts` (API client 模式)

## 2. 编码

### 新增文件:
1. `frontend/apps/h5/src/pages/WrongbookList/index.tsx` — P05 页面组件
   - 状态机: LOADING → EMPTY | LIST | ERROR → HIGHLIGHTED → LIST
   - React Query + `questionsClient.list()` 拉列表
   - `?highlight={qid}` 参数 → 第 1 卡绿色 border 3s → fade-out
   - 1:1 对齐 mockup: nav + search + subject chips + mastery filter + sort hint + card list + FAB + tabbar
   - `data-testid` 全量挂载 (对齐 testids/index.ts wrongbookList.*)
   - `data-highlighted` + `data-qid` 辅助测试属性

2. `frontend/apps/h5/src/pages/WrongbookList/WrongbookList.module.css` — CSS Modules
   - Mood B pure-warm 色盘 (与 P04 一致)
   - iOS 风格 nav glass blur + subject chips + mastery cards + card list
   - `.cardHighlighted` green border 2px + `.cardHighlightFading` transition

3. `frontend/apps/h5/tests/e2e/sc-01/t07-list-highlight-newest.spec.ts` — E2E 测试
   - 6 tests: AC1+AC2+AC3 (P04→P05 transition), AC4 (card elements), TI1 (fallback), 3x VRT
   - `toHaveScreenshot` 5 baselines: highlighted, list, idle, empty, error
   - mock ≤ 3 (list, detail, save)

### 修改文件:
4. `frontend/apps/h5/src/App.tsx` — 路由
   - 添加 `/wrongbook` → `<WrongbookListPage />`
   - 修复 `/question/:qid/result` → `<ResultPage />` (原为 stub div)
   - 移除 WrongbookStub

5. `frontend/packages/api-contracts/src/types.ts` — DTO 类型
   - 新增 `QuestionListItem`, `QuestionListResp`, `QuestionListParams` 接口

6. `frontend/packages/api-contracts/src/clients/questions.ts` — API client
   - 新增 `questionsClient.list(params)` 方法
   - 支持 subject/mastery/kp/q/qMode/page/size/sort/highlight query params
   - snake_case → camelCase camelize 处理

## 3. 真实 E2E

### E2E 结果 (6/6 PASS):
```
✓ AC1+AC2+AC3: P04 save → P05 with highlight → green border 3s fade (4.2s)
✓ AC4: highlighted card renders all required elements (404ms)
✓ TI1: highlight={qid} not in list → fallback no highlight (259ms)
✓ 4-state VRT: loading state (758ms)
✓ 4-state VRT: empty state (256ms)
✓ 4-state VRT: error state (2.2s)
6 passed (8.9s)
```

### VRT 截图 baseline (5 态):
- `p05-highlighted-chromium-darwin.png` — 绿色 border 高亮态
- `p05-list-chromium-darwin.png` — 正常列表态
- `p05-idle-chromium-darwin.png` — 初始加载态
- `p05-empty-chromium-darwin.png` — 空态
- `p05-error-chromium-darwin.png` — 错误态

### spec-trace 对照表:
见 `test-reports/e2e/coder/spec-trace.md`

## 4. 自检

- [x] AC1: save 200 → P04 淡出 + P05 淡入 ≤ 500ms · scrollY=0 ✓
- [x] AC2: GET /api/wb/questions?highlight={qid} → 200 · 第 1 项 qid 匹配 ✓
- [x] AC3: 绿色 border 2px solid green 3s 后 fade-out ✓
- [x] AC4: 左色条 + 学科 chip + KP chips + 难度 ★ + 6 段 stage bar + 下次到期 全部渲染 ✓
- [x] TI1: highlight={qid} 不在 list → fallback 不高亮 ✓
- [x] TI2: fade-out 后 data-highlighted 消失 (不残留) ✓
- [x] TI4: 4 态 VRT screenshot ✓
- [x] testid 全挂载 (wrongbook.list.root, item-card, page-header, etc.)
- [x] mock ≤ 3 (within ≤ 5 audit limit)
- [x] Vite build passes (101 modules · 742ms)

## 5. 提交

- commit hash: e306dc8
- 分支: `claude/sc01-t07-result-to-home`
