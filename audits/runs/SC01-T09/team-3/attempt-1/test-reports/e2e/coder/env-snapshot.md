# env-snapshot · attempt-1

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
NAMES              PORTS                                            STATUS
team-3-pg          0.0.0.0:15434->5432/tcp                          Up 13 hours (healthy)
team-3-redis       0.0.0.0:16381->6379/tcp                          Up 13 hours (healthy)
team-3-minio       0.0.0.0:9004->9000/tcp, 0.0.0.0:9005->9001/tcp   Up 13 hours (healthy)
nacos-standalone   0.0.0.0:8848->8848/tcp                           Up 14 hours
```

## E2E 跑时的 BASE_URL
- PLAYWRIGHT_BASE_URL: http://localhost:5190
- Vite dev server: port 5190 (worktree-local instance)
- review-plan-service: not started (API mocked via page.route())

## DB / MinIO 端口真证
- PG: 15434 (team-3-pg · healthy)
- Redis: 16381 (team-3-redis · healthy)
- MinIO: 9004 (team-3-minio · healthy)

## 说明
E2E 测试使用 Playwright `page.route()` 拦截 API 请求并返回 mock 数据，
确保测试确定性（不依赖后端状态）。后端 endpoint 存在性已通过代码审查确认
（ReviewPlanController.java L166 POST /sessions, L190 GET /today）。
