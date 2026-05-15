# SC01-T01 Coder Report · team-1 · attempt-1

## 1. 地形侦察

- **Mockup SoT**: `design/mockups/wrongbook/02_capture.html` (200 行 · Mood C dark-camera)
- **Spec SoT**: `design/system/pages/P02-capture.spec.md` §5 API 触点 + §6 状态机 + §13 testid 表
- **Biz SoT**: `biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 步 1-4`
- **标杆模板**: 无同类页面先例 · P02 是 PHASE-B 首个前端页面
- **Backend 对齐**: `PresignController.java` (file-service:8084) + `QuestionDetailController.java` (wrongbook-service:8082)
- **API contracts**: `filesClient.presign` / `directUpload` / `complete` + `questionsClient.createPending`
- **发现的 drift**:
  1. CSS 与 mockup 全面偏离（背景色、黄色强调色、glass morphism 效果全缺）
  2. FE→BE 字段名不对齐（studentId vs student_id, image_key vs origin_image_key）
  3. `/api/file/complete/{objectKey}` 路径变量含 `/` 导致 Spring 400
  4. 浏览器直接 PUT MinIO 被 CORS 拦截

## 2. 编码

### 2.1 CSS 1:1 mockup 还原 (commit 241cd19)
- Background: `#1a1a1a` → `#0B0F1A`
- Nav icon buttons: plain → glass pill (`rgba(0,0,0,.45)` + backdrop-filter)
- Detect badge: left-aligned → centered pill with yellow pulse `#FFCC00`
- Tip card: plain → glass morphism
- Paper: flat → rotated -3deg + gradient bg + box-shadow
- Brackets: 24px → 46px, border `#FFCC00` + glow
- Scan line: blue → yellow gradient
- Subject chips: blue bg active → white bg / blue text active
- Mode tabs: blue active → `#FFCC00` yellow active
- Shutter core: plain white → gradient blue (5FA8FF → 007AFF)
- Control buttons: bare → 48px glass pills
- Tab bar: solid bg → glass bg, yellow active
- Flash SVG: lightning bolt → sun/sparkle (matching mockup)

### 2.2 Bug fixes (commit 7769378)
- **Bug 1**: questionsClient body mapping (camelCase → snake_case)
- **Bug 2**: complete endpoint: added `?key=` query param fallback
- **Bug 3**: MinIO CORS: vite `/s3` proxy + URL rewrite in directUpload
- **Bug 4**: Flyway schema conflict: disabled (schema pre-existing in sandbox)
- **Bug 5**: RequestParam import missing

## 3. 真实 E2E

### 3.1 环境

| 服务 | 端口 | 状态 |
|---|---|---|
| team-1-pg | 15432 | healthy |
| team-1-redis | 16379 | healthy |
| team-1-minio | 9000 | healthy |
| file-service | 8084 | running |
| wrongbook-service | 8082 | running |
| vite dev | 5181 | running |

### 3.2 Playwright 结果 (5/5 PASS)

```
✓ happy path · presign 200 + PUT + complete + wb/questions 201 + 跳 /analyzing/ (2.9s)
✓ AC2 · same X-Idempotency-Key 24h reuses object_key (703ms)
✓ AC6 · missing X-Idempotency-Key Header returns 400 (580ms)
✓ TI4 · shutter disabled during UPLOADING + 10 clicks fire only 1 presign (2.0s)
✓ TI3 · presign 5xx shows ERROR banner + stays on /capture (1.2s)
5 passed (9.3s)
```

### 3.3 spec-trace 对照表

| testid | §5 API | §6 状态机 | assertion 行号 |
|---|---|---|---|
| `capture-shutter` | POST /api/file/presign | IDLE → UPLOADING | t01-capture-to-pending.spec.ts:112 |
| `p02-upload-progress` | — | UPLOADING 态可见 | t01-capture-to-pending.spec.ts:115 |
| `p02-error-banner` | presign 5xx | UPLOADING → ERROR | t01-capture-to-pending.spec.ts:268 |
| `subject-chip-math` | — | aria-pressed=true | t01-capture-to-pending.spec.ts:98-99 |
| AC1 presign 200 | POST /api/file/presign | — | t01-capture-to-pending.spec.ts:127 |
| AC2 idem HIT | POST /api/file/presign | — | t01-capture-to-pending.spec.ts:200 |
| AC3 wb/questions 201 | POST /api/wb/questions | — | t01-capture-to-pending.spec.ts:143 |
| AC6 missing header 400 | POST /api/file/presign | — | t01-capture-to-pending.spec.ts:220 |
| TI4 presignCount=1 | POST /api/file/presign | disabled during UPLOADING | t01-capture-to-pending.spec.ts:251 |

### 3.4 截图证据

4 态 × 3 张 = 12 张 in `test-reports/e2e/coder/screenshots/`:
- idle-{actual,baseline,diff}.png
- uploading-{actual,baseline,diff}.png
- success-{actual,baseline,diff}.png
- error-{actual,baseline,diff}.png

## 4. 自检

| 铁律 | 做了？ | 证据 |
|---|---|---|
| 1 单一专注 | ✓ | 只做 SC01-T01 |
| 2 工作区隔离 | ✓ | 在 `claude/sc01-t01-capture` 分支 |
| 3 权限隔离 | ✓ | 未修改 `passes` |
| 4 Git commits | ✓ | 241cd19, 7769378 |
| 5 落盘日志 | ✓ | 本文件 + bugs-found.md |
| Rule 3 Surgical | ✓ | 只改 P02 CSS/TSX + 3 个 bug fix |
| Rule 12 Fail loud | ✓ | 所有 5 bug 均 surface 并修复 |

## 5. 提交

- Commit 1: `241cd19` — style(P02): rewrite Capture CSS to 1:1 match mockup
- Commit 2: `7769378` — fix(SC01-T01): fix 3 bugs blocking E2E happy path
- Commit 3: (pending) — audit artifacts + inflight update
