# env-snapshot · attempt-1

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
team-2-minio       0.0.0.0:9002->9000/tcp, 0.0.0.0:9003->9001/tcp   Up 10 hours (healthy)
team-2-pg          0.0.0.0:15433->5432/tcp                          Up 10 hours (healthy)
team-2-redis       0.0.0.0:16380->6379/tcp                          Up 10 hours (healthy)
nacos-standalone   0.0.0.0:8848->8848/tcp                           Up 12 hours
```

## E2E 跑时的 BASE_URL
- PLAYWRIGHT_BASE_URL: http://localhost:5174
- wrongbook-service: http://localhost:8082

## DB / MinIO 端口真证
- PG: 15433 (team-2-pg, `docker exec team-2-pg pg_isready` → accepting connections)
- Redis: 16380 (team-2-redis, healthy)
- MinIO: 9002 (team-2-minio, healthy)
