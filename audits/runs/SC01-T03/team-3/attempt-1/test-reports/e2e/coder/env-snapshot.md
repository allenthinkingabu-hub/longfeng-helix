# env-snapshot · attempt-1

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
NAMES              PORTS                                            STATUS
team-3-minio       0.0.0.0:9004->9000/tcp, 0.0.0.0:9005->9001/tcp   Up 10 hours (healthy)
team-3-redis       0.0.0.0:16381->6379/tcp                          Up 10 hours (healthy)
team-3-pg          0.0.0.0:15434->5432/tcp                          Up 10 hours (healthy)
nacos-standalone   0.0.0.0:8848->8848/tcp                           Up 11 hours
```

## E2E 跑时的 BASE_URL
- PLAYWRIGHT_BASE_URL: http://localhost:5175 (port 5174 was in use, Vite auto-incremented)
- ai-analysis-service: proxied via vite /api/ai → http://localhost:8083 (configured in vite.config.ts)

## DB / MinIO 端口真证
- PG: 15434 (team-3-pg, healthy)
- MinIO: 9004 (team-3-minio, healthy)
- Redis: 16381 (team-3-redis, healthy)

## 说明
本次 E2E 使用 Playwright route 拦截 SSE 端点以实现确定性测试时序。
Cancel API (POST /api/ai/cancel) 通过 Playwright route 拦截返回 200 {"status":"CANCELLED"}。
Backend 端点为 PHASE-A 已合并代码，本 task 仅涉及前端 SSE hook + 页面 CSS + E2E 测试。
