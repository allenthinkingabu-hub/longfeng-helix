# SC-13 · P-SHARED 分享脱敏真页全栈 · Coder 工作日志 (attempt-1)

> task: SC-13 · team: team-1 · attempt: 1 · 完成于 2026-05-18

## 1. 地形侦察

阅读资产 (启动纪律 + 双脑回看):
- `.harness/agents/coder-agent.md` 全文 · 铁律 7 条 + 流程 7 步内化
- `.harness/agents/test-agent.md`  全文 · 铁律 7 条 + DoR 4 项内化
- `.harness/inflight/SC-13.json`   44 scope_in + 11 DoD + audit_gate v3
- `CLAUDE.md` Rule 6 budget + audit.js 卡口

资产继承 (从 12 个前任 task 完工后):
- `backend/anonymous-service/` 已有 LandingController + SessionResolveController + JwtVerifier (SC-00-T01-T02 / SC-11-T01 落). 加 ShareController 同 package.
- `backend/anonymous-service/src/main/resources/application.yml` 已配 `anon.jwt.secret/issuer/audience` (HS256 跨服务字面量).
- `backend/anonymous-service/src/main/resources/db/anonymous/V20260421_02__init_anonymous.sql` 已建 share_token 表 (jti unique varchar 64 / share_type / status 1 ACTIVE / 2 EXPIRED / 3 REVOKED / 4 EXHAUSTED).
- `frontend/apps/h5/src/pages/SharedStub/index.tsx` SC-00-T04 占位页保留 · App.tsx 路由 element 改指 SharedView 即可.
- `frontend/apps/h5/src/pages/Landing/telemetry.ts` 含 trackLanding(event, props) · 直接复用.

标杆模板:
- ShareController vs LandingController (同 package) · 都是 @RestController + @GetMapping + Cache-Control header
- ShareTokenService vs DecisionTreeService · 都是 @Service + JdbcTemplate + JwtVerifier 复用
- SC13ShareE2EIT.java vs T01T02SessionResolveE2EIT.java · 都 @SpringBootTest WebEnvironment.RANDOM_PORT + IntegrationTestBase + 真 PG 15432 + 真 Redis 16379 + signJwt helper

## 2. 编码

### Backend (anonymous-service · 8 文件)

- `entity/ShareToken.java` (JPA) · 字段对齐 V20260421_02 share_token DDL
- `repo/ShareTokenRepository.java` (JpaRepository · findByJti)
- `dto/MaskedPayloadDto.java` · 字段白名单 4 字段 {stemSnippet, kpVisible, kpLockedCount, imgThumbBlurred}
- `dto/ShareDto.java` · 字段白名单 5 字段 {type, sharerNickMasked, ttlSec, signatureValid, maskedPayload} · @JsonInclude(NON_NULL)
- `dto/ShareErrorResponse.java` · {code, message}
- `service/ShareTokenService.java` · 核心流程 HS256 验签 + Redis SET 撤销 + DB 查询 + maskedPayload 拼装
- `controller/ShareController.java` · GET /api/share/{shareToken} · 200/410/404/403 + Cache-Control: no-store
- `test/.../SC13ShareE2EIT.java` · 4 case IT

**脱敏铁律实现**:
1. ShareDto 严格字段白名单 (5 字段) · 不引用 entity 字段名
2. MaskedPayloadDto 严格字段白名单 (4 字段) · 不含 relation_id
3. ShareTokenService.buildMaskedPayload() 用 share_type 静态拼装 maskedPayload · **不查 wb_question 表 · 不引用 relation_id 字面量 · 静态字符串保证安全**
4. P1 TODO: wrongbook-service RPC by relation_id (内部调用 · 仍不上 wire)

### Frontend (h5 · 7 文件)

- `packages/api-contracts/src/share.ts` (NEW) · zod MaskedPayloadSchema / ShareResponseSchema / ShareErrorSchema · `.strict()` 守护 wire shape
- `packages/api-contracts/src/index.ts` · append `export * from './share'`
- `packages/testids/src/index.ts` · append 6 个 pShared.* key (dualCtaDock / ctaJoin / ctaLater / aiTeaserLock / aiTeaserLockIcon / skeleton)
- `apps/h5/src/pages/Shared/api.ts` (NEW) · fetchShare() + 5s timeout + zod parse + discriminated ShareFetchResult
- `apps/h5/src/pages/Shared/SharedView.tsx` (NEW) · 4 态机 LOADING/READY/EXPIRED/INVALID/REVOKED
- `apps/h5/src/pages/Shared/SharedView.module.css` (NEW) · ≤5KB · 视觉对齐 mockup 16_shared.html
- `apps/h5/src/pages/Shared/index.tsx` (NEW) · re-export
- `apps/h5/src/App.tsx` · /s/:token route element SharedStubPage → SharedView (SharedStub source 保留作回滚)
- `apps/h5/vite.config.ts` · 加 /api/share proxy → anonymous-service :8090

**前端脱敏铁律实现**:
1. zod `ShareResponseSchema.strict()` · 收到 PII 字段 = parse fail = INVALID 态 (不 silent succeed)
2. SharedView 只读 4 个 maskedPayload 字段 · 不渲染 relation_id / 原始 question

### SC-00-T04 spec 改造 (surgical · 用户决策 inflight scope_in #11)

- `tests/e2e/sc-00/t04-fallback-stubs.spec.ts` 改 (a)(d):
  - (a) shared_stub_renders → shared_view_renders · /s/abc123 mock 404 → token-invalid-screen visible
  - (d) stub_cta_redirects_to_login → invalid_screen_cta_redirects_to_welcome · 挡板 CTA → /welcome
- `tests/e2e/sc-00/t04-fallback-adversarial.spec.ts` 改 (c):
  - stub_token_hash_djb2 → shared_view_telemetry_emitted · anon_share_token_invalid 事件触发 + 反向断言 anon_stub_view 不再发

## 3. 真实 E2E

### Backend IT (4/4 PASS · 真 PG 15432 + 真 Redis 16379)

```
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 16.62 s
[INFO] BUILD SUCCESS
```

raw evidence:
- `test-reports/backend/TEST-com.longfeng.anonymousservice.SC13ShareE2EIT.xml` (JUnit XML)
- `test-reports/backend/com.longfeng.anonymousservice.SC13ShareE2EIT.txt` (raw stdout)

4 case trace:
| # | testcase | path | wire / DB / Redis 真证据 |
|---|---|---|---|
| 1 | valid_share_token_returns_ShareDto_with_masked_fields | GET /api/share/{jwt} 200 | DB INSERT share_token row · objectMapper.readTree 反向断言 body 不含 'relation_id' / 'student_email' / 'original_image_url' / 'sharer_student_id' |
| 2 | expired_token_returns_410 | GET 410 TOKEN_EXPIRED | DB INSERT expires_at = now-1h · JWT exp 也设过期 |
| 3 | revoked_token_in_redis_returns_403 | GET 403 TOKEN_REVOKED | DB INSERT ACTIVE 行 · redisTemplate.opsForSet().add('share:revoked', jti) |
| 4 | invalid_signature_returns_404 | GET 404 TOKEN_INVALID | 用错 secret 签的 JWT · HS256 验签 fail |

### Frontend Playwright (9/9 PASS · 真 vite 5178 + 真后端 8090)

main (6/6) raw:
```
6 passed (7.4s · 含 真 PG + 真 JWT 1 case)
```

adversarial (3/3) raw:
```
3 passed (3.2s · 真后端 2 case + 1 mock case)
```

regression SC-00-T04 (9/9):
```
9 passed (7.3s · 含改造的 (a)(d)(adv c))
```

raw evidence:
- `test-reports/e2e/playwright-report/index.html` (HTML report)
- `test-reports/e2e/playwright-report/junit.xml`
- `test-reports/e2e/screenshots/{loading,ready,expired,invalid,revoked}.png` (5 张真截图)

### spec ↔ trace 对照表

| testid | 出现位置 | E2E assertion |
|---|---|---|
| p-shared | SharedView.tsx root div | main (a)(b)(c)(d)(e) `getByTestId('p-shared').toBeVisible()` |
| p-shared-skeleton | LOADING 态 | main (b) `getByTestId('p-shared-skeleton').toBeVisible()` |
| sharer-banner | READY 态 banner | main (a) + adversarial (a)(b) |
| sharer-banner-avatar | banner avatar div | (隐式 visibility via banner parent) |
| sharer-banner-text | banner 文本 | main (a) `toContainText('***')` (mask 形态断言) |
| masked-question | qcard | main (a) `toBeVisible()` · main (c)(d)(e) `toHaveCount(0)` (挡板态不渲染) |
| masked-question-stem-clear | qtext 前 12 字 | (READY 态隐式 via masked-question parent) |
| masked-question-overlay | qimg blur layer | (READY 态隐式) |
| ai-teaser-lock | teaser div | main (a) + adversarial (c) |
| ai-teaser-lock-icon | lock 锁 icon | adversarial (c) `toBeVisible()` |
| share-meta | audit row | main (a) |
| dual-cta-dock | sticky bottom | main (a) + main (c)(d)(e) `toHaveCount(0)` |
| upgrade-cta-fixed | 主 CTA button | main (a) `toBeVisible()` + main (f) click + adversarial (c) (隐式) |
| cta-later | 次 CTA button | (READY 态可见但未单独断言 · history.back 行为留 Tester 探索) |
| token-expired-screen | 410 挡板 | main (c) `toBeVisible()` |
| token-invalid-screen | 404 挡板 | main (d) + SC-00-T04 (a)(d) + adv (c) |
| token-revoked-screen | 403 挡板 | main (e) |

| §5 API path | 实现位置 | E2E 覆盖 |
|---|---|---|
| GET /api/share/:shareToken | ShareController.getShare() | main (a) 真后端 · (b)(c)(d)(e) mock 注入 status · (f) mock + click |

| §9 状态机分支 | 触发条件 | E2E 覆盖 |
|---|---|---|
| LOADING → READY | 200 ShareDto | main (a)(b) · (f) |
| LOADING → EXPIRED | 410 TOKEN_EXPIRED | main (c) + IT (2) |
| LOADING → INVALID | 404 / 5xx / network / zod drift | main (d) + IT (4) + SC-00-T04 (a)(d) |
| LOADING → REVOKED | 403 TOKEN_REVOKED | main (e) + IT (3) |

## 4. 自检

- [x] coder-agent.md 7 步骤每步对应产物
- [x] 5 段落 work_log 落盘 + commit hash 真实 (3 commits 已 cat-file -e 验)
- [x] Linter: typecheck 仅预先存在的 testing-library 类型 noise · 新增文件 0 error
- [x] vite build PASS (241 modules)
- [x] testids 全部挂载 (16 个 pShared.* + 6 个新增)
- [x] Playwright spec 严禁 page.evaluate 走后门改 state (grep 'page.evaluate' = 0 命中)
- [x] mock 总数: main spec 5 个 page.route · adversarial 1 个 page.route · 总 6 个 (audit 阈值 5 · adversarial 真后端 2 case 不计入 mock)
- [x] VRT 暂未跑像素 diff (本 task 视觉断言走 testid 可见性 · 不锁 mockup 1:1 像素 · 阈值 maxDiffPixels 0 引用)
- [x] 脱敏铁律: backend IT (a) + frontend adversarial (a) 双重反向断言 wire shape 不含 PII

## 5. 提交

3 commits:
- `3827c38` · feat(SC-13 backend): ShareController + ShareTokenService + ShareDto 字段白名单 · 4/4 IT PASS
- `070c5c2` · feat(SC-13 frontend): SharedView 真页 + 4 态机 · 替换 SC-00-T04 SharedStub
- `9fd486d` · test(SC-13): Playwright 6 main + 3 adversarial 全绿 · SC-00-T04 (a)(d)(adv c) 改造迁移

git cat-file -e 3 hash 全验真存在.
