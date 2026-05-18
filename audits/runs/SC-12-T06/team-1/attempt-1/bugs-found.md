# SC-12-T06 · Bugs Found · attempt-1

**Task**: SC-12-T06 · `POST /api/anon/analyze-by-url` 真转发 ai-analysis-service:8083 · NO MOCK

---

## Summary · 本 attempt 修复的 bug / 边界缺口

总计: **2 个 fix** (1 个 wire-shape 纠偏 · 1 个 IT 基础设施熔断修复) + **1 个 Tester REJECT Round 1 强化** (case (a) 跨 service DB 锁 subject 列).

### Bug 1 · inflight scope_in #4(b) wire 形 snake_case 与上游不符

**症状**: inflight scope_in 第 4(b) 行示例 `body = Map.of('task_id', taskId, 'subject', subject, 'image_url', imageUrl)` snake_case. 直接照抄会让上游 ai-analysis-service:8083 POST /api/ai/analyze-by-url 返 400 (上游 `AnalyzeByUrlReq` record 用 Jackson 默认 camelCase).

**Root cause**: inflight 文档作者按"对外 API 形" snake_case 习惯写示例 · 没现场探过上游 wire 形.

**Reproduction (现场 curl 验证)**:
```bash
$ curl -X POST http://localhost:8083/api/ai/analyze-by-url \
    -H "Content-Type: application/json" \
    -d '{"task_id":"x","subject":"math","image_url":"http://e.x/x.jpg"}'
→ HTTP 400 (snake_case rejected)

$ curl ... -d '{"taskId":"x","subject":"math","imageUrl":"http://e.x/x.jpg"}'
→ HTTP 202 + {"task_id":"x","status":"ANALYZING"}
```

**Fix**: `AnonAnalyzeService` 转发 body 用 camelCase keys (taskId / subject / imageUrl). 注释 + commit message 显式记录"snake_case→400, camelCase→202" 现场验证. Rule 7 Surface conflicts 适用.

**Impact**: 如未发现此 wire 形 mismatch · IT case (a) 会全失败 + 生产真请求一律 502 (实际是上游 400 但服务层 catch RestClientException 统一映 502) · 用户感知为 "AI 永远 down" 的严重 alignment failure.

**Detection-time**: 编码 Step 1 地形侦察 · curl 现场验证 (Rule 9 Tests verify intent: 现场探 wire 形而非信任 inflight 示意).

---

### Bug 2 · IT 套件 HikariCP 池超 team-1-pg max_connections

**症状**: 加 SC12T06AnonAnalyzeE2EIT + SC12T06AnonAnalyzeDownE2EIT 两个 `@SpringBootTest` context 后 · `mvn verify` 跑到 T04/T06 报 `FATAL: sorry, too many clients already` (PG 53300 SQLState).

**Root cause**: Spring TestContext cache 保留 ~11 个 ApplicationContext 长存 · HikariCP 默认 10 连接/池 · ~110 总连接 > team-1-pg `max_connections=100`.

**Reproduction**: 
```bash
$ mvn verify -DskipUTs  # T04 + T06 报 ApplicationContext failure threshold exceeded
$ docker exec team-1-pg psql -U longfeng -d postgres -c "SELECT count(*) FROM pg_stat_activity;"
 count
-------
   86
```

**Fix**: `IntegrationTestBase.@DynamicPropertySource` 加:
```java
r.add("spring.datasource.hikari.maximum-pool-size", () -> "4");
r.add("spring.datasource.hikari.minimum-idle", () -> "1");
```
IT 套件 PG 总用量 ~44 (11 ctx × 4) << 100 limit. 仅作用 test classpath · 生产 application.yml HikariCP 默认池不动.

**Impact**: 若不修 · audit.js bug_reality 维度报 regression failure (63 prior IT 倒大半因 PG client exhaust); 真正 bug 信号 (T06 自己代码) 被掩盖.

**Detection-time**: Phase 4 Tester `mvn verify` 全量 regression run · 实测 14 个 ERROR · failsafe-reports 一一比对发现是 PG connection 问题不是代码问题.

---

### Tester REJECT Round 1 强化 · case (a) 跨 service DB 锁 subject 列

详见 adversarial.md.

**症状**: case (a) 原仅断言 `SELECT COUNT(*) FROM analysis_task WHERE task_id = ?` == 1 · 没锁 subject 列. 一个未来 regression: AnonAnalyzeService body map 拼错 (`map.put("subjct", ...)` 漏写 'e') 仍会让上游创建 task 行 (subject 列变 null) · 此 case 还能 PASS.

**Fix**: case (a) 末尾再加:
```java
String upstreamSubject = jdbc.queryForObject(
    "SELECT subject FROM analysis_task WHERE task_id = ?",
    String.class, taskId);
assertThat(upstreamSubject).as("...proves camelCase body actually crossed the wire...").isEqualTo("math");
```

**Impact**: Bug 1 类问题 (wire 形跑偏 · subject 不传) 可被 Tester 自动捕获 · 不需再依赖现场 curl.

---

## Tester 关注的潜在边界 (T07+ 任务 · 本 task 不实现)

- **WebClient timeout 边界**: RestTemplate readTimeout=5000ms · 但上游 Qianwen API 可能 slow · 实际超时不报错而 enqueue 后立即返 202 (上游分离 enqueue + execute) · 这是上游设计意图 · 不是本 task bug
- **taskId collision**: taskId = `anon-{anonSessionId}` · anonSessionId 是 BIGINT (snowflake-like) · collision rate 极低 · 但重新分析同一 session 会复用同一 taskId · 上游 `analysis_task @Id task_id unique=true` 会拒绝重复 INSERT → 上游可能返 500 而非 202 (T07 测了再说 · 本 task IT case (f) 实测上游 PUT-like 行为 · 行计数仍 1)
- **Minio GET URL TTL = 600s**: 如果 Qianwen 排队超过 10min · 第一次 fetch 会 403 · 这是 trade-off · 留 T07 result polling 时 surface
- **DASHSCOPE_API_KEY 未配**: 上游 ai-analysis-service 真调 Qianwen 时如 API KEY 缺 · 任务会 FAILED 但不影响本 task 转发链路 (本 task 只关心上游接到 202 · 后续状态由 T07 polling 反映)

---

## Coder 自检 · 本 task 0 bug 漏出?

- ✓ 编译: `mvn -q compile` exit=0
- ✓ IT: 7/7 + regression 63/63 全绿 (70 total tests · 0 fail · 0 error · 0 skip)
- ✓ NO MOCK: grep `vi.mock|MockMvc|WireMock|MockWebServer|@MockBean` 在 backend/anonymous-service 命中 0 处 (Tester 复核)
- ✓ Surgical: 仅新建 6 source + 2 IT + 扩 AnonPresignService 1 方法 + IntegrationTestBase 2 行 hikari property · 无 silent drift

**结论**: Bug 1 + Bug 2 修复后 · 0 bug 残留漏出. 本 task 干净交付.
