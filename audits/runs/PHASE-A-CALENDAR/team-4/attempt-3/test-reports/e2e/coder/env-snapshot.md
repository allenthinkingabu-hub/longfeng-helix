# Environment Snapshot · PHASE-A-CALENDAR · attempt-3

## docker ps

```
NAMES              PORTS                                            STATUS
team-4-redis       0.0.0.0:16382->6379/tcp                          Up (healthy)
team-4-pg          0.0.0.0:15435->5432/tcp                          Up (healthy)
team-4-minio       0.0.0.0:9006->9000/tcp, 0.0.0.0:9007->9001/tcp   Up (healthy)
nacos-standalone   0.0.0.0:8848->8848/tcp                           Up
```

## Java

- JDK: OpenJDK 17.0.13
- Maven: 3.x (mvn verify -f backend/calendar-core/pom.xml)
- Spring Boot: 3.2.5
- Hibernate: 6.4.4.Final

## Database Connection (Sandbox)

- PG JDBC: jdbc:postgresql://localhost:15435/wrongbook
- User: longfeng / longfeng_dev
- Table: calendar_event (created via @BeforeEach DDL in IT, Flyway V1.0.067 for production)

## Playwright

- Playwright: 1.60.0
- Browser: Chromium Headless Shell 148.0.7778.96
- App: Spring Boot started on port 18080 with sandbox PG overlay

## Test Execution

- `mvn verify`: BUILD SUCCESS · Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
- Playwright: 6 passed (1.9s)
