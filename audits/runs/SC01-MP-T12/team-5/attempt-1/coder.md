# Coder 工作日志 · SC01-MP-T12 · P08→P09 transition

## 1. 地形侦察

- 完整读 `coder-agent.md` 全文 (铁律 1-7 + 执行流程 7 步)
- 完整读 `SHARED-E2E-PROTOCOL.md` (三轴隔离 + DoR C-1..C-6)
- 完整读 `SC01-MP-T12.json` (inflight · attempt-1 · dev_done=false)
- 完整读 `CLAUDE.md` (Rule 3 Surgical + Rule 6 budget + Rule 12 Fail loud)
- 完整读设计 mockup: `08_review_exec.html` + `09_review_done.html`
- 完整读 wave-1 实现: `pages/review-exec/index.ts` + `pages/review-done/index.ts`
- 完整读 H5 sibling: `frontend/apps/h5/src/pages/ReviewExec/index.tsx` (transition pattern at L163-164)
- 完整读 `src/api/review.ts` (只有 completeSession · 缺 getNode/revealNode/gradeNode)
- 完整读 `src/api/_http.ts` (dual runtime adapter: wx.request / fetch)
- 完整读已有 integration tests: `test/api/review-exec.integration.spec.ts` + `test/api/review-done.integration.spec.ts`
- 标杆模板: H5 sibling `ReviewExec/index.tsx` L163 `nav('/review/done?nodeId=...')` 为 transition 参考

## 2. 编码

### 2.1 补齐 API 函数 (`src/api/review.ts`)

review-exec/index.ts 导入 `getNode`, `revealNode`, `gradeNode` 但 review.ts 只导出 `completeSession`。按 H5 sibling `reviewClient` 接口签名补齐:
- `getNode(sid, nid)` → GET `/api/review/sessions/{sid}/nodes/{nid}`
- `revealNode(nid)` → POST `/api/review/nodes/{nid}/reveal`
- `gradeNode(nid, { grade, timeSpentMs })` → POST `/api/review/nodes/{nid}/grade`

文件: `frontend/apps/mp/src/api/review.ts` (+50 行)

### 2.2 添加 P08→P09 transition (`pages/review-exec/index.ts`)

在 `onGradeTap` 方法末尾，GRADED 状态设定后，添加:
```ts
wx.navigateTo({
  url: `/pages/review-done/index?sid=${sid}&grade=${grade}&nodeId=${this.data.node.nid}`,
});
```
对齐 H5 sibling query params: `sid`, `grade`, `nodeId`。

文件: `frontend/apps/mp/pages/review-exec/index.ts` L200-203 (+5 行)

### 2.3 创建 vitest 过渡测试 (`test/transitions/exec-to-done.spec.ts`)

7 个测试用例:
1. MASTERED grade → navigateTo with correct URL params
2. FORGOT grade → grade=FORGOT in URL
3. PARTIAL grade → grade=PARTIAL in URL
4. double-tap guard (isGrading=true blocks)
5. not-revealed guard (isRevealed=false blocks)
6. vibration feedback fires before navigation
7. URL query params properly encoded

Mock 范围: 只 mock wx runtime API (wx.navigateTo, wx.vibrateShort, wx.showToast, wx.request) — 禁 mock backend。

## 3. 自检

### Typecheck
```
pnpm -F mp run typecheck
```
- review-exec/index.ts 和 review-done/index.ts: 0 type errors ✓
- 残留 errors: `analyzing/index.ts` (startAnalyze) + `capture/index.ts` (createQuestion) — 均为 pre-existing wave-1 issues, 不在 T12 scope

### Vitest
```
pnpm -F mp run test:e2e
```
- `test/transitions/exec-to-done.spec.ts`: 7/7 PASS ✓
- 其他 integration tests 因 backend 服务不在线而失败 — pre-existing, 不在 T12 scope

### spec-trace 对照

| 设计元素 | §mockup | 代码位置 | assertion |
|---|---|---|---|
| GRADED state | 08 mockup rating bar | review-exec/index.ts:197 | exec-to-done.spec.ts:93 |
| wx.navigateTo | P08→P09 transition | review-exec/index.ts:203 | exec-to-done.spec.ts:97-100 |
| sid param | session context | review-exec/index.ts:201 | exec-to-done.spec.ts:99 |
| grade param | FORGOT/PARTIAL/MASTERED | review-exec/index.ts:203 | exec-to-done.spec.ts:100,108,116 |
| nodeId param | node.nid | review-exec/index.ts:203 | exec-to-done.spec.ts:101 |
| double-tap guard | isGrading flag | review-exec/index.ts:179 | exec-to-done.spec.ts:120-126 |
| vibration | wx.vibrateShort | review-exec/index.ts:184 | exec-to-done.spec.ts:134-140 |

## 4. 自检

- [x] 地形侦察: 完整读 agent.md + inflight + 设计 + sibling + API
- [x] 编码: API 函数补齐 + transition 添加 + vitest 测试
- [x] typecheck: review-exec + review-done 0 error
- [x] vitest: 7/7 PASS
- [x] Rule 3 Surgical: 只改了必要的 3 个文件
- [x] Rule 6 budget: ≈25 tool use, 未触线
- [x] 0 backend mock in tests

## 5. 提交

- Commit hash: 0dc277d (feat), 9f0c335 (advance)
- 文件变更:
  - `frontend/apps/mp/src/api/review.ts` (+50 行: getNode, revealNode, gradeNode)
  - `frontend/apps/mp/pages/review-exec/index.ts` (+5 行: wx.navigateTo transition)
  - `frontend/apps/mp/test/transitions/exec-to-done.spec.ts` (新建 · 7 tests)
  - `audits/runs/SC01-MP-T12/team-5/attempt-1/coder.md` (本文件)
  - `audits/runs/SC01-MP-T12/team-5/attempt-1/bugs-found.md`
  - `audits/runs/SC01-MP-T12/team-5/attempt-1/spec-trace.md`
