# spec-trace.md · SC01-MP-T06 · review-plan API transparency

## Backend ReviewPlanController SC-01-C05 全部端点 → MP api/review.ts 函数对照表

| # | Backend Endpoint | HTTP | Controller Method | MP api/review.ts 函数 | Test assertion 行号 |
|---|---|---|---|---|---|
| 1 | POST /api/review/sessions | POST | createSession() | `createSession()` | review-plan-transparency.spec.ts:48 |
| 2 | GET /api/review/today?tz= | GET | today() | `getToday()` | review-plan-transparency.spec.ts:63 |
| 3 | GET /api/review/nodes/{nid} | GET | getNode() | `getNode()` | review-plan-transparency.spec.ts:78 |
| 4 | POST /api/review/nodes/{nid}/open | POST | openNode() | `openNode()` | review-plan-transparency.spec.ts:92 |
| 5 | POST /api/review/nodes/{nid}/reveal | POST | revealNode() | `revealNode()` | review-plan-transparency.spec.ts:105 |
| 6 | POST /api/review/nodes/{nid}/grade | POST | gradeNode() | `gradeNode()` | review-plan-transparency.spec.ts:118 |
| 7 | POST /api/review/sessions/{sid}/next | POST | nextInSession() | `nextInSession()` | review-plan-transparency.spec.ts:133 |
| 8 | GET /api/review/nodes/{nid}/result | GET | nodeResult() | `nodeResult()` | review-plan-transparency.spec.ts:147 |

## 补充: 非 SC-01-C05 端点 (BE-13 legacy · 不在 MP scope)

| Backend Endpoint | HTTP | 说明 |
|---|---|---|
| GET /review-plans?date=&subject= | GET | BE-13 日视图 |
| GET /review-plans/list | GET | BE-13 游标翻页 |
| GET /review-plans/{id} | GET | BE-13 单 plan 详情 |
| POST /review-plans/{id}/complete | POST | SC-08 复习完成 |
| POST /review-plans/batch-reset | POST | admin 学期初清空 |
| POST /review-plans/batch-reset-by-ids | POST | admin 按 id 批量软删 |
| GET /review-stats | GET | SC-09 学情聚合 |

## ApiResult 信封契约

```json
{ "code": 0, "message": "ok", "data": <T> }       // 成功
{ "code": 40401, "message": "...", "data": null }   // PlanNotFound → 404
{ "code": 40901, "message": "...", "data": null }   // PlanMastered → 409
```

## 覆盖总结

- 8/8 SC-01-C05 端点在 MP `src/api/review.ts` 全部有对应函数
- `test/api/review-plan-transparency.spec.ts` 10 个 test case 覆盖全部 8 端点 + 404 边界 + 模块导出完整性
- 0 mock · 真 fetch → localhost:8085
