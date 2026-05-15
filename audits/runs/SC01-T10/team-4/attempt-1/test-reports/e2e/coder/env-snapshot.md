# env-snapshot · attempt-1

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
NAMES              PORTS                                            STATUS
team-4-redis       0.0.0.0:16382->6379/tcp                          Up 13 hours (healthy)
team-4-pg          0.0.0.0:15435->5432/tcp                          Up 13 hours (healthy)
team-4-minio       0.0.0.0:9006->9000/tcp, 0.0.0.0:9007->9001/tcp   Up 13 hours (healthy)
nacos-standalone   0.0.0.0:8848->8848/tcp                           Up 15 hours
```

## E2E 跑时的 BASE_URL
- PLAYWRIGHT_BASE_URL: http://localhost:5174
- review-plan-service: http://localhost:8085 (proxied via vite /api/review → 8085)

## DB / MinIO 端口真证
- PG: 15435 (team-4-pg healthy)
- Redis: 16382 (team-4-redis healthy)
- MinIO: 9006 (team-4-minio healthy)

## 说明
本任务 T10 的 E2E 主要测试前端 P07→P08 页面跳转 + UI 渲染。
POST /nodes/{nid}/open 在 Playwright 中通过 page.route stub 返回 200 mock response。
后端 endpoint 已在 ReviewPlanController.java 实现 (T09 前序任务已落地)。
真后端联调在 Tester 阶段执行。
