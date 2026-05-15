# env-snapshot · attempt-1

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
NAMES              PORTS                                            STATUS
team-5-minio       0.0.0.0:9008->9000/tcp, 0.0.0.0:9009->9001/tcp   Up 10 hours (healthy)
team-5-pg          0.0.0.0:15436->5432/tcp                          Up 10 hours (healthy)
team-5-redis       0.0.0.0:16383->6379/tcp                          Up 10 hours (healthy)
nacos-standalone   0.0.0.0:8848->8848/tcp                           Up 12 hours
```

## E2E 跑时的 BASE_URL
- PLAYWRIGHT_BASE_URL: http://localhost:5175
- review-plan-service proxy: http://localhost:8082 (vite proxy /api/review)
- calendar-core proxy: http://localhost:8085 (vite proxy /api/calendar)

## 前端 E2E 说明
- Playwright E2E 使用 `page.route()` 拦截 API 请求 (browser-level mock)
- 不依赖真后端运行，API 响应在测试脚本中 mock
- Vite dev server 提供前端静态服务 + SPA fallback
- 真 Chromium headed 模式运行

## sandbox 端口对齐
- PG: 15436 (team-5-pg · `docker exec team-5-pg pg_isready` → accepting connections)
- Redis: 16383 (team-5-redis · healthy)
- MinIO: 9008 (team-5-minio · healthy)
