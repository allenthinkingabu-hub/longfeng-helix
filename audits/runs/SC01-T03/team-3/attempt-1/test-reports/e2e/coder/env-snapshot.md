# env-snapshot · attempt-1

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
NAMES              PORTS                                            STATUS
team-3-minio       0.0.0.0:9004->9000/tcp, 0.0.0.0:9005->9001/tcp   Up 10 hours (healthy)
team-3-redis       0.0.0.0:16381->6379/tcp                          Up 10 hours (healthy)
team-3-pg          0.0.0.0:15434->5432/tcp                          Up 10 hours (healthy)
```

## E2E 跑时的 BASE_URL
- PLAYWRIGHT_BASE_URL: http://localhost:5182
- ai-analysis-service: http://localhost:8083 (SSE intercepted by page.route for deterministic timing)

## DB / MinIO 端口真证
- PG: 15434 (team-3-pg healthy)
- Redis: 16381 (team-3-redis healthy)
- MinIO: 9004 (team-3-minio healthy)

## Playwright 配置
- Viewport: 390×844 (mobile portrait)
- Workers: 1 (sequential)
- Browser: Chromium (headed mode)
- Reporter: list + html + junit
