# Env Snapshot · SC01-T03 attempt-3

## Docker Containers (sandbox)
| Name         | Status                | Port         |
|--------------|-----------------------|--------------|
| team-3-pg    | Up 10h (healthy)      | 15434→5432   |
| team-3-redis | Up 10h (healthy)      | 16381→6379   |
| team-3-minio | Up 10h (healthy)      | 9004→9000    |

## Frontend Dev Server
- vite v5.4.21 on http://localhost:5178
- cwd: /Users/allen/workspace/longfeng/.claude/worktrees/sc01-t03-analyzing/frontend/apps/h5

## Node / Tooling
- Playwright 1.59.1
- pnpm workspace (corepack)

## Playwright Config
- baseURL: http://localhost:5178 (env PLAYWRIGHT_BASE_URL)
- viewport: 390×844 (mobile H5)
- workers: 1 / fullyParallel: false
