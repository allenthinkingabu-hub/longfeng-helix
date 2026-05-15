# env-snapshot · attempt-1

## docker ps 输出
```
NAMES              PORTS                                            STATUS
team-1-redis       0.0.0.0:16379->6379/tcp                          Up 10 hours (healthy)
team-1-pg          0.0.0.0:15432->5432/tcp                          Up 10 hours (healthy)
team-1-minio       0.0.0.0:9000-9001->9000-9001/tcp                 Up 10 hours (healthy)
team-4-redis       0.0.0.0:16382->6379/tcp                          Up 10 hours (healthy)
team-4-pg          0.0.0.0:15435->5432/tcp                          Up 10 hours (healthy)
team-4-minio       0.0.0.0:9006->9000/tcp, 0.0.0.0:9007->9001/tcp   Up 10 hours (healthy)
team-3-minio       0.0.0.0:9004->9000/tcp, 0.0.0.0:9005->9001/tcp   Up 10 hours (healthy)
team-3-redis       0.0.0.0:16381->6379/tcp                          Up 10 hours (healthy)
team-3-pg          0.0.0.0:15434->5432/tcp                          Up 10 hours (healthy)
team-5-minio       0.0.0.0:9008->9000/tcp, 0.0.0.0:9009->9001/tcp   Up 10 hours (healthy)
team-5-pg          0.0.0.0:15436->5432/tcp                          Up 10 hours (healthy)
team-5-redis       0.0.0.0:16383->6379/tcp                          Up 10 hours (healthy)
team-2-minio       0.0.0.0:9002->9000/tcp, 0.0.0.0:9003->9001/tcp   Up 10 hours (healthy)
team-2-pg          0.0.0.0:15433->5432/tcp                          Up 10 hours (healthy)
team-2-redis       0.0.0.0:16380->6379/tcp                          Up 10 hours (healthy)
nacos-standalone   0.0.0.0:8848->8848/tcp                           Up 12 hours
```

## E2E 跑时的 BASE_URL
- PLAYWRIGHT_BASE_URL: http://localhost:5181
- file-service: http://localhost:8084
- wrongbook-service: http://localhost:8082

## DB / MinIO 端口真证
- PG: 15432 (`docker exec team-1-pg pg_isready` → accepting connections)
- MinIO: 9000 (`curl -sI http://localhost:9000/minio/health/live` → 200 OK)
- Redis: 16379 (`docker exec team-1-redis redis-cli ping` → PONG)
