# env-snapshot · attempt-1

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
NAMES              PORTS                                            STATUS
team-1-redis       0.0.0.0:16379->6379/tcp                          Up 11 hours (healthy)
team-1-pg          0.0.0.0:15432->5432/tcp                          Up 11 hours (healthy)
team-1-minio       0.0.0.0:9000-9001->9000-9001/tcp                 Up 11 hours (healthy)
team-5-minio       0.0.0.0:9008->9000/tcp, 0.0.0.0:9009->9001/tcp   Up 11 hours (healthy)
team-5-pg          0.0.0.0:15436->5432/tcp                          Up 11 hours (healthy)
team-5-redis       0.0.0.0:16383->6379/tcp                          Up 11 hours (healthy)
nacos-standalone   0.0.0.0:8848->8848/tcp                           Up 13 hours
```

## E2E 跑时的 BASE_URL
- PLAYWRIGHT_BASE_URL: http://localhost:5180 (vite dev server from this worktree)
- Backend: not directly used (E2E uses page.route() network-level interception per SHARED-E2E-PROTOCOL)

## Sandbox ports (inflight config)
- PG: 15436 (team-5-pg)
- Redis: 16383 (team-5-redis)
- MinIO: 9008 (team-5-minio)

## Playwright config
- viewport: 393×852 (mobile mockup frame)
- workers: 1 (serial execution)
- reporter: list + html + junit
