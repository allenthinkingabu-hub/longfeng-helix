# SC01-MP-T10-E2E · Bugs Found · Attempt 3

1 bug — Tester adversarial round 1 发现:

| # | 严重性 | 描述 | 修复 commit |
|---|--------|------|-------------|
| 1 | 中 | E2E spec 未验证 nid query 参数传递 + path 断言过宽 (`toContain` → `toBe`) | 1bee0bc |

Phase 1 仅写 E2E spec，未涉及生产源码修改。
