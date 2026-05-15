# env-snapshot · attempt-1

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
NAMES              PORTS                                            STATUS
team-1-redis       0.0.0.0:16379->6379/tcp                          Up 11 hours (healthy)
team-1-pg          0.0.0.0:15432->5432/tcp                          Up 11 hours (healthy)
team-1-minio       0.0.0.0:9000-9001->9000-9001/tcp                 Up 11 hours (healthy)
```

## E2E 跑时的 BASE_URL
- PLAYWRIGHT_BASE_URL: http://localhost:5174
- vite dev server: http://localhost:5174 (frontend/apps/h5)
- file-service proxy: /api/file → localhost:8084
- wrongbook-service proxy: /api/wb → localhost:8082
- ai-analysis-service proxy: /api/ai → localhost:8083
- MinIO proxy: /s3 → localhost:9000

## DB / MinIO 端口真证
- PG: 15432 (team-1-pg · healthy)
- MinIO: 9000 (team-1-minio · healthy)
- Redis: 16379 (team-1-redis · healthy)

## 说明
本任务 SC01-T02 为前端 transition task (P02→P03)。E2E 使用 Playwright page.route() 拦截
所有后端 API 请求，返回确定性 mock 响应。SSE 流也通过 route 注入控制。
这是前端-only 的跨页 E2E 验证，不需要真后端服务运行。
Docker 容器（PG/MinIO/Redis）已在线但本 E2E 不直接连接。
