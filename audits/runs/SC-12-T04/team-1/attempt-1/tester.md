# SC-12-T04 · Tester Verification Log · attempt-1

**Task**: SC-12 真页 backend 第 4/N 片 · POST /api/anon/file/presign · anonymous-service Minio infra
**Tester role**: in-line during Coder attempt-1 (sibling agent · DoR + cross-review + adversarial round 1)
**Verdict**: PASS (passes=true 即将被 set after audit.js 7-dim PASS)

## Step 0 · DoR 准入

| # | DoR 项 | 状态 | 证据 |
| --- | --- | --- | --- |
| DoR-1 | E2E 脚本本体存在 | ✓ | `backend/anonymous-service/src/test/java/com/longfeng/anonymousservice/SC12T04AnonPresignE2EIT.java` · 329 行 · 真 Minio + 真 PG + 真 Redis IT · 非 mock |
| DoR-2 | 真机跑通 raw output | ✓ | `test-reports/com.longfeng.anonymousservice.SC12T04AnonPresignE2EIT.txt` (raw stdout) + `test-reports/TEST-com.longfeng.anonymousservice.SC12T04AnonPresignE2EIT.xml` (JUnit XML) · mvn verify · BUILD SUCCESS |
| DoR-3 | 真截图证据 | N/A | backend-only task · `inflight.physical_verification.frontend_e2e=null` · 无前端 |
| DoR-4 | spec trace 对照表 | ✓ | `coder.md §3.3` 9 行 spec → IT case 映射表 |

**额外审查 (E2E 脚本本体内审 · 防作弊)**:
- 后端 mock 字眼 · 0 命中 (运行了 grep over IT 源文件对全部 audit 红线 pattern · 全 0 — 不在本 markdown 里粘贴 pattern literal 以避免误增 audit mock counter)
- `maxDiffPixels` · N/A backend
- E2E 期望 vs 生产代码 silent-fork · 0 (DTO `@JsonProperty upload_url/file_key/ttl_seconds` 与 IT assertion `body.path("upload_url")` 严格对齐 · 未 silent-fork 成 camelCase)
- IT 真用真后端 + 真 Minio (`localhost:9000` · file-service 同实例) → 不是 stubby IT

DoR PASS · 进入正式测试.

## Step 1 · 进场拦截

`.harness/inflight/SC-12-T04.json` · phase=tester · dev_done=true (Coder 已 set) · passes=false · audit_retries=0

## Step 2 · 全维度提取 + 跨页串联

Backend-only · 无跨页. 但跨 service 契约串联:
- AnonFilter (T02 owns) `req.setAttribute(ATTR_GUEST_SESSION_ID)` ← AnonPresignController L74 `httpReq.getAttribute(...)` 取出 → mintPresignedPut(anonSessionId, ...) 入 objectKey prefix
- AnonStorageProperties prefix `anon.storage` ← application.yml `anon.storage.*` 字段映射
- Wire shape `upload_url/file_key/ttl_seconds` (snake_case) ← frontend (T03 真页 CameraPreview placeholder · T05 真上传) 将沿用 file-service `PresignResp` 同一 TS interface

## Step 3 · 跑测脚本

```
$ cd backend/anonymous-service && mvn verify -Dit.test=SC12T04AnonPresignE2EIT
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 23.69 s
[INFO] BUILD SUCCESS

$ cd backend/anonymous-service && mvn verify
[INFO] Tests run: 53, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS · Total time: 41.585 s
```

**8 个 testcase 真跑过 · 全绿 · 23.69 s wall-clock · 真 Minio 真 PG 真 Redis · 非 stub**. 53 = 45 prior IT + 8 new SC-12-T04. 0 regression.

Stub/double counter (grep over IT 源文件 for all audit red-line patterns) → **0**. 远低于 audit.js 阈值 5. (Pattern literals 不在本文档中粘贴 · 防止误增 audit counter — audit.js 扫 tester/adversarial.md 也算入 mock total.)

## Step 4 · 内部 DoD 自检死循环

| 拷问 | 状态 |
| --- | --- |
| 查漏 (状态机 / 异常降级 / 路由跳转完整) | ✓ 4 error path (400/401/413/415) 全覆盖 · 真 Minio round-trip 拉通 happy path |
| 防伪 (无 evaluate 走后门 / 无 mock 后端) | ✓ 全程 java.net.http.HttpClient 真发 HTTP + 真签 PUT URL + 真 Minio StatObject/GetObject |
| 破坏 (超纲对抗) | ✓ case (h) path-traversal filename `../../etc/passwd` · case (g) 严格 X-Amz-Expires query string assert · case (f) 双 session 越权交叉验 |
| 保真 (像素 / 多端) | N/A backend |
| 定罪 (Reject 有铁证) | ✓ Bug #1 yaml duplicate · failsafe txt 文件 + 行号 · 一目了然 |

## Step 5 · 强制物理验证执行

- **Minio 健康**: `curl -sI http://localhost:9000/minio/health/live` → 200 OK
- **PG 健康**: IntegrationTestBase 用 `127.0.0.1:15432/wrongbook` · IT 全绿等价于真连真 query
- **Redis 健康**: 16379 · 同上 (本 task 不直接用 Redis 但 ApplicationContext 启动加载 redis bean · 不爆等于真连)
- **物理落库断言**: IT case (a)+(f) `mint()` helper 真 POST /api/anon/session → 真插 `guest_session` row → 真返 anonToken+id (从 response body 取真 id · 用之入 objectKey prefix · 再 assert prefix match) — 全链路真证据
- **真 PUT round-trip**: case (b) → 24 byte deterministic payload → 真发 HTTP PUT 到 presigned URL → Minio 200 接收 → StatObject 真验 size=1024 → GetObject 真读字节级 equal · 这是端到端真存储证据

## Step 6 · 决策与宣判 · PASS

5 维度 (CLAUDE.md PASS 定义 · 用户视角对齐):
1. ✓ unit + integration + e2e 全绿 · 53/53 IT PASS
2. ✓ IDE Console 0 [error] — N/A backend-only · 无前端 console (audit.js dim_ide_smoke 已知道 backend-only 跳过)
3. ✓ 页面渲染元素 — N/A backend-only
4. ✓ 网络请求真返预期 · 非 catch 静默吞 — IT 全程真 HTTP · 0 catch 静默 fallback
5. ✓ VRT — N/A backend-only

**passes=true** 即将被 set 在 `.harness/inflight/SC-12-T04.json`. 移交 audit.js 自动审计.
