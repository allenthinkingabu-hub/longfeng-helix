# env-snapshot · attempt-1

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" | grep team-2
NAMES              PORTS                                            STATUS
team-2-minio       0.0.0.0:9002->9000/tcp, 0.0.0.0:9003->9001/tcp   Up 45 minutes (healthy)
team-2-pg          0.0.0.0:15433->5432/tcp                          Up 45 minutes (healthy)
team-2-redis       0.0.0.0:16380->6379/tcp                          Up 45 minutes (healthy)
```

## E2E 跑时的 BASE_URL
- wrongbook-service: http://localhost:RANDOM_PORT (SpringBootTest.RANDOM_PORT)
- sandbox PG: jdbc:postgresql://localhost:15433/wrongbook
- sandbox Redis: redis://localhost:16380 (not used by wrongbook-service IT)
- sandbox MinIO: http://localhost:9002 (not used by wrongbook-service IT)

## DB 端口真证
- PG: 15433 (team-2-pg · `docker exec team-2-pg pg_isready` → accepting connections)
- DB user: longfeng / longfeng_dev
- DB name: wrongbook
