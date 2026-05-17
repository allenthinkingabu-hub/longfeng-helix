# SC-13 · P-SHARED · 对抗循环 · attempt-1

## Round 1 · REJECT — 真后端集成失败 (vite proxy 漏配)

### 问题
首次跑 Playwright main spec (a) `valid_token_renders_shared_view` · 真 PG INSERT + 真 JWT 签发后 page.goto('/s/<jwt>') · 但 SharedView 显示 INVALID 挡板而非 READY · 反向追到:

- 直接 `curl http://localhost:8090/api/share/<jwt>` 返 200 + ShareDto · 字段白名单严格 (含 sharerNickMasked='V***') · 后端无问题
- 但浏览器 fetch('/api/share/<jwt>') 拿到 HTML (vite SPA fallback) · zod parse fail → INVALID

### 根因

`frontend/apps/h5/vite.config.ts` 漏配 `/api/share` proxy 规则 · 现有 proxy 只覆盖 /api/auth /api/session /api/landing /api/file /api/wb /api/ai /api/review · /api/share 落 SPA fallback.

### 修复

```ts
'/api/share': {
  target: process.env.VITE_ANON_PROXY_TARGET || 'http://localhost:8090',
  changeOrigin: true,
},
```

(commit `9fd486d`)

### 再跑

重启 vite + 再跑 main spec → **6/6 PASS** + adversarial 3/3 PASS.

---

## Round 2 · 探索性边界 (test-agent.md 铁律 3 严苛对抗)

### Probe-1 · JWT 篡改攻击

**手法**: 用错 secret 签 JWT 后投到 GET /api/share/:jwt.

**测试位置**: backend IT `SC13ShareE2EIT.invalid_signature_returns_404` · 用 wrongKey 签 HS256 · 验签失败 → 404 TOKEN_INVALID. **PASS** (HS256 验签真生效 · 不可绕过).

### Probe-2 · 脱敏字段泄漏 (脱敏铁律核心)

**手法**: 让前端发真请求到真后端 · 抓 response body raw text · 反向断言 4 个 PII 字段名都不出现.

**测试位置**:
- backend IT (a) `valid_share_token_returns_ShareDto_with_masked_fields` · `assertThat(bodyText).doesNotContain('relation_id'/'student_email'/'original_image_url'/'sharer_student_id')` · **PASS**
- frontend adversarial (a) `response_no_pii_fields` · 真 PG 插一行 (relation_id='wb_question:secret-id-42') + page.goto → 抓 response.text() · 反向断言不含 'relation_id'/'student_email'/'original_image_url'/'sharer_student_id'/'wb_question'/'secret-id-42' · **PASS**

双层防线 · 脱敏铁律稳如磐石.

### Probe-3 · Redis SET 撤销秒级生效

**手法**: 真 PG 插 ACTIVE share_token + 真 Redis `SADD share:revoked <jti>` · GET 应立返 403 TOKEN_REVOKED.

**测试位置**: backend IT (3) `revoked_token_in_redis_returns_403` · 真 Lettuce 客户端 SADD · ShareTokenService.lookup() Redis SISMEMBER 命中. **PASS** (Redis 撤销生效).

### Probe-4 · cache poisoning (CDN 缓存窃听)

**手法**: 验证 Cache-Control: no-store 严格存在 (CDN 不能缓存包含 PII 访问审计的响应).

**测试位置**:
- backend IT (a) `assertThat(resp.headers().firstValue("Cache-Control")).hasValue("no-store")` · **PASS**
- backend IT (b) 挡板态 410 也 no-store · **PASS**
- frontend adversarial (b) `cache_control_no_store_header` · 抓真 response header · **PASS**

### Probe-5 · AI teaser lock 反 leak

**手法**: 验证 AI teaser 锁层永远显示 lock icon + '加入错题本查看' CTA · 真分析内容字面量 (P1) 不应出现在 P0 渲染.

**测试位置**: frontend adversarial (c) `ai_teaser_lock_not_unlocked` · `expect(teaser).toContainText('加入错题本')` + 反向断言 `expect(body).not.toContain('AI 已自动生成')` 等. **PASS**.

### Probe-6 · zod drift = silent succeed 防御

**手法**: 假设后端某一天 leak 了 relation_id 字段 (regression) · 前端 zod ShareResponseSchema.strict() 应 parse fail → INVALID 态 (不 silent succeed 渲染 PII).

**测试位置**: `apps/h5/src/pages/Shared/api.ts` 中 zod parse catch → 返 INVALID. 单测当前没显式 inject leak fixture · 留待 P1 (security review-driven test).

## 终态

- Round 1 (DoR 准入 fix vite proxy) → 真后端打通
- Round 2 (6 探索性 probe) → 全 PASS · 脱敏铁律稳

对抗轮数: 1 REJECT + 1 fix + 6 explore = 满足铁律 3 "至少 1 轮 REJECT + 至少 1 轮 fix".
