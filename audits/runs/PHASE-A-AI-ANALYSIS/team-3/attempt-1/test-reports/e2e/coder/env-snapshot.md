# env-snapshot · attempt-1

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
NAMES              PORTS                                            STATUS
team-3-pg          0.0.0.0:15434->5432/tcp                          Up 36 minutes (healthy)
team-3-redis       0.0.0.0:16381->6379/tcp                          Up 36 minutes (healthy)
team-3-minio       0.0.0.0:9004->9000/tcp, 0.0.0.0:9005->9001/tcp  Up 36 minutes (healthy)
```

## IT 跑时连接配置
- PG: jdbc:postgresql://127.0.0.1:15434/wrongbook (longfeng/longfeng_dev)
- Redis: 127.0.0.1:16381
- MinIO: http://127.0.0.1:9004 (not used by ai-analysis-service)

## DB / Redis 端口真证
- PG: 15434 (docker exec team-3-pg pg_isready → accepting connections)
- Redis: 16381 (docker exec team-3-redis redis-cli ping → PONG)
