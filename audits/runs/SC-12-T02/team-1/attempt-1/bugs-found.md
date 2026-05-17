# SC-12-T02 · Bugs Found · attempt-1

**0 bugs** 修复.

T02 是 SC-12 真页 backend 第 2/N 片 net-new 功能 (AnonFilter + verifyAnonToken + PATCH consent). 本 attempt 实现期间未在 T01 已落代码中发现 bug · 也未在新代码内部捕获 bug. T01 surfaced 的 spec drift (status enum 无 CONSENTED 状态) 不是 bug · 已按 inflight scope_in §0 决策处理 (本 task 不动 status · 留 T03 推进). 

## Pre-existing drift (非 bug · 设计决策)

| # | 描述 | 处理 |
|---|------|------|
| 1 | guest_session.status enum (`0 CREATED / 1 ANALYZING / 2 RESULT_READY / 3 FAILED / 4 CLAIMED / 9 EXPIRED`) 无 CONSENTED 中间态 | T02 决策: PATCH consent 只写 consent_at + consent_type, 不动 status. 业务语义 (前端 Consent Card gate Shutter) 仅依赖 consent_at 非空, status 字段不需要 CONSENTED. T03 presign 时由 status 0→1 推进. IT (a) 显式断言 status=0 不变, 锁定该决策防回归. |
| 2 | application.yml `anon.jwt.secret` 与 auth-service / SC-13 共享同一 HS256 secret (biz §10.9 single-secret parity 设计) | 因此 student JWT (auth-service mint) 用相同 secret 签发会通过 HS256 验签. AnonFilter 用 sub 必 startsWith "anon:" 作硬判别. IT (d) `consent_with_student_jwt_returns_401_wrong_prefix` 显式验证此防线生效. 这是已知设计 (T01 AnonTokenService SUB_PREFIX 常量注释), 非 bug. |
| 3 | 1234 个 pre-existing checkstyle violations 跨整个 anonymous-service 模块 (T01 + SC-13 + SC-00 + SC-11 等全部) | 本 task 新代码沿用同款 convention (CLAUDE.md Rule 11 "Match the codebase's conventions"). 强行在 T02 新文件搞 80-char + final-everywhere 会 silent fork. `.husky/pre-commit` 钩已被用户 2026-05-16 全局停用 (文件 head 注释). 非 bug · 是 codebase-wide style debt 不在 T02 surgical scope. |
