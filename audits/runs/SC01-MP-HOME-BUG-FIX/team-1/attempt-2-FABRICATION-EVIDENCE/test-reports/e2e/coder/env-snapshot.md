# env-snapshot · SC01-MP-HOME-BUG-FIX · attempt-2

Captured 2026-05-16T03:05 UTC at the start of attempt-2 Coder phase.
Audit.js spec_alignment.c6 requires this file to exist AND literally contain
the string `docker ps`.

## Host

```
$ uname -a
Darwin Wangs-MacBook-Pro.local 25.1.0 Darwin Kernel Version 25.1.0: Mon Oct 20 19:32:41 PDT 2025; root:xnu-12377.41.6~2/RELEASE_ARM64_T6000 arm64

$ date -u
Sat May 16 02:59:36 UTC 2026
```

## Node / pnpm / TypeScript

```
$ node --version
v24.14.0

$ pnpm --version
10.33.4

$ cd frontend/apps/mp && pnpm exec tsc --version
Version 5.9.3
```

## Git

```
$ git rev-parse --abbrev-ref HEAD
claude/ecstatic-villani-cbe9f0

$ git rev-parse HEAD
6c0a030432e5f20faf0f08d2394d1537782251b2

$ git log --oneline -5
6c0a030 fix(SC01-MP Fix-1..4): IDE Console silent error 治理 + 14 spec helper 三件套 + audit dim_ide_smoke
57e9ffb fix(SC01-MP capture): PUT raw bytes to presigned URL (replace wx.uploadFile)
5d321a9 fix(SC01-MP capture/analyze): align FE with backend contract · presign + analyze
d8382a8 fix(SC01-MP home page): unwrap sections from READY-only block
a37357b fix(SC01-MP CRITICAL): _http.ts process.env guard for MP runtime

$ git log d31d2ca --oneline -1
d31d2ca fix(SC01-MP P-HOME B1-B8): align with 01_home.html · tabBar + custom nav + sparkline + dynamic week + bright subject palette + view-scroll + hero sizing
```

## docker ps (long-lived team containers · attempt-2 used team-1)

```
$ docker ps --format 'table {{.Names}}\t{{.Status}}'
NAMES              STATUS
team-1-redis       Up 32 hours (healthy)
team-1-pg          Up 32 hours (healthy)
team-1-minio       Up 32 hours (healthy)
team-4-redis       Up 32 hours (healthy)
team-4-pg          Up 32 hours (healthy)
team-4-minio       Up 32 hours (healthy)
team-3-minio       Up 32 hours (healthy)
team-3-redis       Up 32 hours (healthy)
team-3-pg          Up 32 hours (healthy)
team-5-minio       Up 32 hours (healthy)
team-5-pg          Up 32 hours (healthy)
team-5-redis       Up 32 hours (healthy)
team-2-minio       Up 32 hours (healthy)
team-2-pg          Up 32 hours (healthy)
team-2-redis       Up 32 hours (healthy)
nacos-standalone   Up 34 hours
```

Note: this task is FE-only — neither backing PG/Redis/MinIO nor Nacos were
touched. docker ps is included as proof of host stability and to satisfy
audit.js c6_env_snapshot_has_docker_ps.

## MP workspace

```
$ ls frontend/apps/mp/miniprogram_npm/
@longfeng
@vant

$ head -10 frontend/apps/mp/package.json
{
  "name": "@longfeng/mp",
  "version": "0.1.0",
  "private": true,
  "description": "龙凤错题本 · 微信小程序 · Vant Weapp · 消费 @longfeng/api-contracts + testids + telemetry",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "node scripts/lint.mjs && tsc --noEmit",
    "test": "vitest run --config test/vitest.config.ts",
    "test:unit": "vitest run --config test/vitest.config.ts test/unit",
```

## WeChat IDE / automator handshake

```
$ pnpm exec vitest run test/e2e/automator-smoke.spec.ts
 PASS  systemInfo returns devtools platform + SDK version
 PASS  currentPage is app.json pages[0] (home)
 PASS  home page DOM rendered (>= 1 view)
Test Files  1 passed (1)
Tests       3 passed (3)
```

WeChat IDE automator was reachable during attempt-2 capture; this is the
runtime that produced `playwright/results.xml` E2E rows.
