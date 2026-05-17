# SC-13-SHARER · bugs-found (attempt-1)

> task: SC-13-SHARER · team: team-1 · attempt: 1
> Phase 3 Coder · 自检/读源码 + IT 死循环修复中发现的 bug · 即使是 P1 也显式列出 (audit.js bug_reality 卡口要求 ≥ 0 显式声明)

## Bug 1 · DB row id 生成策略潜在并发碰撞 (P1 · 已 mitigation · 留 TODO)

**root cause**: SC-13 既有 `SC13ShareE2EIT.insertShareToken` 用 `SELECT COALESCE(MAX(id),0)+1` 生成 `share_token.id` · 单写测试 OK · 但生产并发 issue 会 race (TOCTOU). 我新写的 `ShareTokenService.issue()` 不能照搬这模式.

**mitigation (本轮已落)**: 改用 `nanoTime() ^ ThreadLocalRandom.nextLong(0, 1_000_000)` mix · 加 3 次 `DataIntegrityViolationException` retry · 失败 throw `IllegalStateException` (Rule 12 Fail loud · 不 silent swallow).

**留 P1 TODO**: 长期方案改为 PG `BIGSERIAL` 或 Snowflake id (其他服务已有 snowflake util · 看 `backend/common/`). 本 task 不在 scope.

**文件**: `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/service/ShareTokenService.java` (新增 `generateRowId()` + 3 retry loop in `issue()`)
**修复 commit**: 见 Commit 1 (feat) hash

## Bug 2 · Redis 短时不可用时 revoke 应保留 DB 写 (P2 · 已正确实现)

**root cause** (潜在 regression): `revoke()` 内若先 SADD 后 save · Redis fail 又 raise · 会让 DB 跟 Redis 漂移. 正确顺序是 **先 DB save 再 Redis SADD** + Redis 失败仅 WARN 不抛.

**mitigation (本轮已落)**: 实现里强制顺序 DB save → Redis SADD · Redis catch (Exception) 仅 `LOG.warn` · DB row.status=3 是 durable source of truth · lookup() 自带 DB-fallback (见 SC-13 已有逻辑).

**文件**: `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/service/ShareTokenService.java` · revoke() 方法
**修复 commit**: 见 Commit 1 (feat) hash

## Bug 3 · NOT_FOUND vs NOT_OWNER 暴露 jti 枚举攻击面 (P1 · 已 surface 不修)

**root cause**: 区分返 404 (NOT_FOUND) 与 403 (NOT_OWNER) 让攻击者能枚举 "某 jti 是否存在" — 因为 NOT_OWNER 蕴含 jti 真实存在.

**当前选择**: 按 biz §10.9 / inflight scope_in #2(c) 明确要求保留区分. 不在本 task 修. 若 P1 决策改为 "owner 校验失败也返 404" · 改 controller 一行即可.

**文件**: `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/controller/ShareRevokeController.java` · revoke() switch
**status**: P1 留 TODO · 等用户 / TL 决策 · 本 task 不动

## Bug 4 · jakarta validation @Pattern 跨字段不验枚举语义 (P3 · 已 mitigation)

**root cause**: `@Pattern(regexp="EXAM_DAY|QUESTION|REVIEW_NODE")` 接受未 trim 的 " QUESTION " — Java regex 在不 anchor 时 partial match 已被 jakarta `@Pattern` 默认 fullMatch 保护 · OK. 但小写 "question" 不匹配 — 这是 biz 预期 (大小写敏感 enum).

**mitigation (本轮已落)**: testcase (c) `issue_invalid_share_type_returns_400` 用 `'FOO'` 覆盖一般无效值. 未来若 biz 改大小写不敏感 · 加 `(?i)` flag 即可.

**文件**: `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/dto/ShareIssueRequest.java`
**修复 commit**: 已在 Commit 1 (feat) 落
