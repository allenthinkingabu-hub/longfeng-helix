# env-snapshot · attempt-1

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
NAMES              PORTS                                            STATUS
team-1-redis       0.0.0.0:16379->6379/tcp                          Up 11 hours (healthy)
team-1-pg          0.0.0.0:15432->5432/tcp                          Up 11 hours (healthy)
team-1-minio       0.0.0.0:9000-9001->9000-9001/tcp                 Up 11 hours (healthy)
team-3-minio       0.0.0.0:9004->9000/tcp, 0.0.0.0:9005->9001/tcp   Up 11 hours (healthy)
team-3-redis       0.0.0.0:16381->6379/tcp                          Up 11 hours (healthy)
team-3-pg          0.0.0.0:15434->5432/tcp                          Up 11 hours (healthy)
nacos-standalone   0.0.0.0:8848->8848/tcp                           Up 13 hours
```

## E2E 跑时的 BASE_URL
- PLAYWRIGHT_BASE_URL: http://localhost:5175
- Vite dev server CWD: /Users/allen/workspace/longfeng/.claude/worktrees/sc01-t04-analyzing-to-result/frontend/apps/h5

## Sandbox 端口 (inflight 配置)
- PG: 15434 (team-3-pg)
- Redis: 16381 (team-3-redis)
- MinIO: 9004 (team-3-minio)

## 注意
本任务 T04 是前端 transition task (P03→P04)，E2E 使用 Playwright route interception 控制 SSE 和 API 响应时序，不直接连接后端服务。sandbox 容器作为 inflight 配置存在但本测试不直接使用。
