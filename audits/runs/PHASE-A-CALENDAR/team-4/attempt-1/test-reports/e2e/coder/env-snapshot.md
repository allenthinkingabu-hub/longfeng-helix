# env-snapshot · attempt-1

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
NAMES              PORTS                                            STATUS
team-4-redis       0.0.0.0:16382->6379/tcp                          Up 40 minutes (healthy)
team-4-pg          0.0.0.0:15435->5432/tcp                          Up 40 minutes (healthy)
team-4-minio       0.0.0.0:9006->9000/tcp, 0.0.0.0:9007->9001/tcp   Up 40 minutes (healthy)
nacos-standalone   0.0.0.0:8848->8848/tcp                           Up 2 hours
```

## IT 跑时的端口配置
- calendar-core: port 18080 (application.yml)
- IT SpringBootTest: RANDOM_PORT (MockMvc)
- PG sandbox: jdbc:postgresql://127.0.0.1:15435/wrongbook (user: longfeng / longfeng_dev)

## DB 端口真证
- PG: 15435 (team-4-pg container → internal 5432, healthy)
- Redis: 16382 (team-4-redis container → internal 6379, healthy)
- MinIO: 9006 (team-4-minio container → internal 9000, healthy)
