# env-snapshot · attempt-1

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
NAMES              PORTS                                            STATUS
team-5-pg          0.0.0.0:15436->5432/tcp                          Up 13 hours (healthy)
team-5-redis       0.0.0.0:16383->6379/tcp                          Up 13 hours (healthy)
team-5-minio       0.0.0.0:9008->9000/tcp, 0.0.0.0:9009->9001/tcp   Up 13 hours (healthy)
nacos-standalone   0.0.0.0:8848->8848/tcp                           Up 15 hours
```

## E2E 跑时的 BASE_URL
- PLAYWRIGHT_BASE_URL: http://localhost:5174
- Vite dev server: port 5174 (worktree sc01-t14-done-to-home)

## DB / MinIO 端口真证
- PG: 15436 (team-5 sandbox · healthy)
- Redis: 16383 (team-5 sandbox · healthy)
- MinIO: 9008 (team-5 sandbox · healthy)

## 备注
- T14 是纯前端 transition task (P09→P-HOME)
- 不需要真后端 API (Playwright route mock 覆盖 GET /api/home/today)
- sandbox 容器用于后续 Tester 对抗测试
