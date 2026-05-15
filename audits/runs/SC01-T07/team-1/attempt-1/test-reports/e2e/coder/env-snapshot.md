# env-snapshot · attempt-1

## docker ps 输出
```
$ docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
(E2E tests use Playwright page.route() mocks for API endpoints)
(No backend services required — frontend-only E2E with mocked API)
```

## E2E 跑时的 BASE_URL
- PLAYWRIGHT_BASE_URL: http://localhost:5174
- Vite dev server: http://localhost:5174 (pnpm exec vite --port 5174)

## DB / MinIO 端口真证
- API: Mocked via Playwright page.route() (GET /api/wb/questions?*, GET /api/wb/questions/{qid}, POST /api/wb/questions/{qid}/save)
- Total mocks: 3 (within ≤ 5 audit limit)
