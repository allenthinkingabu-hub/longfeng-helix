# env-snapshot · attempt-1

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" | grep team-2
team-2-minio       0.0.0.0:9002->9000/tcp, 0.0.0.0:9003->9001/tcp   Up 13 hours (healthy)
team-2-pg          0.0.0.0:15433->5432/tcp                          Up 13 hours (healthy)
team-2-redis       0.0.0.0:16380->6379/tcp                          Up 13 hours (healthy)
```

## E2E 跑时的 BASE_URL
- PLAYWRIGHT_BASE_URL: http://localhost:5182
- frontend dev server: Vite v5.4.21 on port 5182

## DB / MinIO 端口真证
- PG: 15433 (team-2-pg · healthy)
- MinIO: 9002 (team-2-minio · healthy)
- Redis: 16380 (team-2-redis · healthy)

## 说明
本 task (SC01-T08) 是前端页面构建 + Playwright E2E。E2E 测试通过 `page.route()` 拦截 API 调用（非后端 mock/H2），前端代码调用真实 `homeClient.getToday()` 发起 fetch 请求，Playwright 在浏览器网络层拦截并 fulfill 模拟响应。后端容器 (PG/MinIO/Redis) 在线供其他需要后端的 task 使用。
