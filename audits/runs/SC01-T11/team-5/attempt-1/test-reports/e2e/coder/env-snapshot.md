# env-snapshot · attempt-1

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
NAMES              PORTS                                            STATUS
team-5-pg          0.0.0.0:15436->5432/tcp                          Up 10 hours (healthy)
team-5-redis       0.0.0.0:16383->6379/tcp                          Up 10 hours (healthy)
team-5-minio       0.0.0.0:9008->9000/tcp, 0.0.0.0:9009->9001/tcp   Up 10 hours (healthy)
nacos-standalone   0.0.0.0:8848->8848/tcp                           Up 12 hours
```

## E2E 跑时的 BASE_URL
- PLAYWRIGHT_BASE_URL: http://localhost:5174
- review-plan-service: http://localhost:8085

## DB / MinIO 端口真证
- PG: 15436 (team-5-pg healthy · `docker exec team-5-pg pg_isready` → accepting connections)
- Redis: 16383 (team-5-redis healthy)
- MinIO: 9008 (team-5-minio healthy)

## Vite proxy 配置
- `/api/review` → `http://localhost:8085` (review-plan-service · VITE_REVIEW_PROXY_TARGET)

## Backend spring-boot:run 参数
```
mvn spring-boot:run -Dspring-boot.run.arguments="
  --spring.datasource.url=jdbc:postgresql://localhost:15436/wrongbook
  --spring.datasource.username=longfeng
  --spring.datasource.password=longfeng_dev
  --spring.data.redis.host=localhost
  --spring.data.redis.port=16383
  --server.port=8085"
```

## 验真
```
$ curl -s -X POST http://localhost:8085/api/review/nodes/1/reveal -H "X-User-Id: 7"
{"code":0,"message":"ok","data":{"revealedAt":"2026-05-15T04:45:15.778491Z","nid":1}}
```
