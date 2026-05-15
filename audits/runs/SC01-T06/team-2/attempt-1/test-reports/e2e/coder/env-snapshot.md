# env-snapshot · attempt-1

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" | grep team-2
team-2-minio       0.0.0.0:9002->9000/tcp, 0.0.0.0:9003->9001/tcp   Up 11 hours (healthy)
team-2-pg          0.0.0.0:15433->5432/tcp                          Up 11 hours (healthy)
team-2-redis       0.0.0.0:16380->6379/tcp                          Up 11 hours (healthy)
```

## E2E 跑时的 BASE_URL
- review-plan-service IT: Spring Boot embedded (RANDOM_PORT)
- PG: jdbc:postgresql://127.0.0.1:15433/wrongbook (longfeng/longfeng_dev)

## DB 端口真证
- PG: 15433 (docker exec team-2-pg pg_isready → accepting connections)
- Redis: 16380 (team-2 sandbox)
- MinIO: 9002 (team-2 sandbox)
