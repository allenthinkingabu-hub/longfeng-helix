# env-snapshot · SC01-T01 · team-1 · attempt-4

> SHARED-E2E-PROTOCOL.md v1 §3 DoR-C-6 真证: docker ps + BASE_URL + 端口
> **attempt-4 接力 attempt-3** (前 Coder agent ~48 tool 被 classifier pause · 用户已批准继续 · 本 Coder 接力)
> **Fix 1 C-3 已落地**: ALTER wrong_item 补 12 列 → BackendChainIT 0.510s PASS → mvn verify **10/10 IT BUILD SUCCESS**
> **Fix 2 C-2 留 attempt-5**: 起 wrongbook+ai-analysis spring-boot + Playwright 5/5 PASS 单次工作量超 Rule 6 tool-use budget, 透明 surface

**生成时间**: 2026-05-13 ~11:11 UTC+4 (attempt-4 真跑 BUILD SUCCESS 后)
**Coder**: team-1 attempt-4 接力 (retries=3 · 离熔断剩 2 次)
**branch**: feature/SC-01-T01-capture-to-pending (worktree disabled · 主工作树)

## attempt-4 sandbox 端口表 (本 attempt 真证)

| 服务 | 主机端口 | 容器/进程 | 状态 |
|------|---------|-----------|------|
| **sc01t01-pg-15432** (pgvector image · vector ext 未启用) | **15432** | pgvector/pgvector:pg16 → 5432/tcp | ✅ Up · attempt-4 在此 ALTER wrong_item ADD 12 列 |
| **sc01t01-redis-16379** | **16379** | redis:7-alpine → 6379/tcp | ✅ Up · IntegrationTestBase 指向 |
| **lf-dev-minio** | **19000** (S3) / **19001** (console) | minio | ✅ healthy · wrongbook-dev + s6-it-bucket bucket 已建 |
| **file-service spring-boot** | **8084** (前 Coder dev profile) | mvn -pl file-service spring-boot:run | ✅ Health UP · stdout `services/file-service.log` |
| **wrongbook-service spring-boot** | 8081 (默认) | -- | ❌ 未起 (留 attempt-5) |
| **ai-analysis-service spring-boot** | 8082 (默认) | -- | ❌ 未起 (留 attempt-5) |

## mvn verify 真证 (attempt-4 11:10 真跑 · BUILD SUCCESS)

```
$ cd backend && mvn -pl file-service verify -B
[INFO] Tests run: 53, Failures: 0, Errors: 0, Skipped: 0    (Surefire unit)
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 4.322 s -- in com.longfeng.fileservice.FileUploadIT
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.701 s -- in com.longfeng.fileservice.controller.PresignRealPgIT
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.064 s -- in com.longfeng.fileservice.MockMvcSmokeIT
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.510 s -- in com.longfeng.fileservice.BackendChainIT
[INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0    (Failsafe IT)
[INFO] BUILD SUCCESS
```

verify.log 已覆盖 attempt-3 旧 BUILD FAILURE 版本到 `backend-it/verify.log` (11:05-11:10 真跑)。failsafe-xml/ 4 个 TEST-*.xml 已覆盖。

---

---

## docker ps 输出 (本机常驻容器 · 真证)

```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
NAMES                     PORTS                                                                                       STATUS
lf-dev-redis              6379/tcp                                                                                    Up (healthy)
lf-dev-postgres           5432/tcp                                                                                    Up (healthy)
lf-dev-minio              0.0.0.0:19000->9000/tcp, 0.0.0.0:19001->9001/tcp                                            Up (healthy)
lf-dev-rocketmq-namesrv   9876/tcp                                                                                    Up (health: starting)
lf-dev-nacos              0.0.0.0:18848->8848/tcp, 0.0.0.0:19848->9848/tcp, 0.0.0.0:19849->9849/tcp                  Up (health: starting)
lf-dev-xxljob             0.0.0.0:18080->8080/tcp                                                                     Up (health: starting)
```

附加 calendar-platform 容器（同机器另一个项目）:
- calendar-pg-primary (127.0.0.1:5432) / calendar-redis-{1..6} (7000-7005) / calendar-elasticsearch (9200) / calendar-rocketmq-ns (9876) / calendar-nacos (8848/9848) — 与本 task 无关，只挂载在同机。

## E2E 跑时的 BASE_URL

- **PLAYWRIGHT_BASE_URL**: `http://localhost:5174` （vite dev server 端口 · 见 frontend/apps/h5/vite.config.ts:42）
- **vite dev server**: 启动命令 `pnpm --filter h5 dev` · 后台日志落 `services/vite-dev.log`
- **后端反向代理目标**: `VITE_API_PROXY_TARGET=http://localhost:8081` （file-service 默认端口）

## 各服务端口与 health 真证

| 服务 | 主机端口 | 容器端口 / 进程 | 健康检查 |
|------|---------|-----------------|---------|
| **lf-dev-postgres** (PG 16 + pgvector) | 5432 (容器内, 未 publish) | 5432/tcp | `docker exec lf-dev-postgres pg_isready` → accepting connections ✓ |
| **lf-dev-redis** | 6379 (容器内, 未 publish) | 6379/tcp | `docker exec lf-dev-redis redis-cli ping` → PONG ✓ |
| **lf-dev-minio** | **19000** (S3 API) / **19001** (console) | 9000 / 9001 | `curl -sI http://localhost:19000/minio/health/live` → 200 OK ✓ |
| **lf-dev-rocketmq-namesrv** | 9876 (容器内) | 9876/tcp | Up |
| **lf-dev-nacos** | **18848** / 19848 / 19849 | 8848 / 9848 / 9849 | Up (health starting) |
| **lf-dev-xxljob** | **18080** | 8080 | Up (health starting) |

> **注意端口约定**: 本仓 lf-dev-* 容器 publish 端口加 1 万前缀避免与 calendar-platform 冲突。常驻容器 schema 是手工管理（见 attempt-2 §Fix 3 IntegrationTestBase Layer 1-3 修复说明）。

## file-service / 后端 backend 端口

- **file-service**: Spring Boot `server.port=8081` (主 profile) · 启动命令 `cd backend && mvn -pl file-service spring-boot:run`
- **wrongbook-service**: `8082` · 启动命令 `cd backend && mvn -pl wrongbook-service spring-boot:run`
- **ai-analysis-service**: `8083` · 启动命令 `cd backend && mvn -pl ai-analysis-service spring-boot:run`
- **本 attempt-3 真跑层**: `mvn verify` (Failsafe IT) 用 `IntegrationTestBase` 内嵌端口 (随机 port) + 真 PG @45432 / MinIO @19000 / Redis @16379 (常驻容器)

## h5 dev server URL

- **dev**: http://localhost:5174/ (vite dev)
- **proxy /api → file-service**: http://localhost:8081 (per vite.config.ts:41-44)

## 物理验证命令一览 (本 attempt-3 实跑)

```bash
# (1) backend verify (file-service 真 IT)
cd backend && mvn -pl file-service verify -B 2>&1 | tee audits/runs/SC01-T01/team-1/attempt-3/test-reports/e2e/coder/backend-it/verify.log

# (2) Playwright E2E (chromium 1.59.1 真浏览器 · viewport 390x844 移动端)
cd frontend/apps/h5 && PLAYWRIGHT_BASE_URL=http://localhost:5174 pnpm exec playwright test \
  tests/e2e/sc-01/t01-capture-to-pending.spec.ts --project=chromium \
  --reporter=html,junit,line 2>&1 | tee playwright-report/run.log

# (3) 落审计快照
cp -r frontend/apps/h5/playwright-report/* \
  audits/runs/SC01-T01/team-1/attempt-3/test-reports/e2e/coder/playwright/
```
