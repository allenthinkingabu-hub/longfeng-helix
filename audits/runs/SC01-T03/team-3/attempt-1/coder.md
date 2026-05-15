# Coder 工作日志 · SC01-T03 · team-3 · attempt-1

## 1. 地形侦察

**读取文件清单：**
- `.harness/agents/coder-agent.md` — 铁律 5 条 + 补充 6/7 + 执行流程 7 步
- `.harness/inflight/SC01-T03.json` — task 定义 (AC1-6 + TI1-5 + sandbox 配置)
- `.harness/agents/SHARED-E2E-PROTOCOL.md` — DoR C-1..C-6 + 三轴隔离
- `design/system/pages/P03-analyzing.spec.md` — §4 数据绑定 + §5 API 触点 + §6 状态机 + §8 Wire format (7 SSE type) + §13 testid 表
- `biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 步 6` — 4-8s AI 推理等待
- `biz TC-01.03` — qwen 超时 → fallback → gpt-4o-mini
- `frontend/apps/h5/src/pages/Analyzing/index.tsx` (358 行) — P03 page 组件已存在
- `frontend/apps/h5/src/pages/Analyzing/Analyzing.test.tsx` (425 行) — Vitest UT 含 useEventSource 集成测试
- `frontend/packages/testids/src/index.ts` — P03 testid 15 个 canonical + 6 alias
- `frontend/packages/api-contracts/src/clients/analyze.ts` — analyzeClient (cancel/fallback/analyzeByUrl)
- `frontend/packages/telemetry/src/index.ts` — track() SDK
- `backend/ai-analysis-service/.../AnalyzeController.java` — SSE GET /api/ai/stream/{taskId}
- `backend/ai-analysis-service/.../AiCancelController.java` — POST /api/ai/cancel/{taskId}
- `backend/ai-analysis-service/.../AnalysisStreamHub.java` — SSE/WS 单源 hub
- `backend/common/.../dto/AnalysisChunk.java` — 7 Type enum + factory 方法

**关键发现：**
- P03 page 组件已完整实现 (E03a/b/c)，但 `useEventSource` hook **不存在**
- `Analyzing.module.css` **不存在**
- App bootstrap (index.html, main.tsx, App.tsx with routes) **不存在** — 无法跑 Playwright
- Backend 已完整 (PHASE-A merged) — 5 个 service 均有代码
- pnpm workspace 配置 **不存在** (无 pnpm-workspace.yaml / root package.json)

## 2. 编码

**创建文件：**
| 文件 | 行数 | 作用 |
|---|---|---|
| `frontend/apps/h5/src/hooks/useEventSource.ts` | 220 | SSE 4 步流水线 hook · fetch-based stream reader · 7 event type · retry ≤ 3 · slow detection · cancel() |
| `frontend/apps/h5/src/pages/Analyzing/Analyzing.module.css` | 223 | Mood C dark theme · pipeline step 4 态 · SSE pulse 动画 · JSON 打字机 · cancel 按钮 · banner |
| `frontend/apps/h5/index.html` | 15 | Vite 入口 HTML |
| `frontend/apps/h5/src/main.tsx` | 10 | React 18 createRoot + BrowserRouter |
| `frontend/apps/h5/src/App.tsx` | 22 | Routes: /capture, /analyzing/:taskId, /question/:qid/result + stub nav 目标 |
| `frontend/apps/h5/tsconfig.json` | 16 | TypeScript 配置 (ES2020 + react-jsx) |
| `frontend/pnpm-workspace.yaml` | 3 | pnpm workspace 配置 |
| `frontend/package.json` | 5 | workspace root |
| `frontend/packages/*/package.json` | 4 each | workspace package 清单 (testids, api-contracts, telemetry, ui-kit, eslint-plugin-local) |
| `frontend/packages/api-contracts/src/clients/*.ts` | 2 each | stub clients (wrongbook, files, analysis, home, review) |
| `frontend/packages/ui-kit/src/index.ts` | 2 | stub export |

**Commit**: `95b7a83` — feat(SC01-T03): useEventSource SSE hook + P03 CSS + app bootstrap + E2E spec

## 3. 真实 E2E

**E2E 脚本**: `frontend/apps/h5/tests/e2e/sc-01/t03-ai-stream-pipeline.spec.ts` (7 test cases)

**真机环境**:
- Vite dev server: http://localhost:5175 (port 5174 occupied)
- Sandbox: team-3 PG:15434 · Redis:16381 · MinIO:9004 (all healthy)
- Playwright chromium headed mode

**测试结果**: 7/7 PASS (9.6s)

| Test | Status | 覆盖 AC/TI |
|---|---|---|
| AC1-4 happy path (4步 + JSON + DONE → P04) | PASS | AC1, AC2, AC3, AC4 |
| AC5 TC-01.03 fallback (黄条 + model badge) | PASS | AC5 |
| AC6 cancel (POST /cancel + nav P-HOME) | PASS | AC6 |
| TI3 step order strict | PASS | TI3 |
| alias testids | PASS | spec §13 |
| FAIL 2x → /manual-entry | PASS | §9 异常降级 |
| a11y (aria-live + aria-busy) | PASS | spec §3 a11y |

**截图证据** (4 态 × 3 类 = 12 张):
- `idle-{baseline,actual,diff}.png` — 4 步全 wait + dark theme
- `uploading-{baseline,actual,diff}.png` — step 1 in 'now' state + pulse
- `success-{baseline,actual,diff}.png` — DONE 后跳 P04 确认
- `error-{baseline,actual,diff}.png` — cancel 后跳 P-HOME 确认

**spec-trace 对照表**: `audits/runs/SC01-T03/team-3/attempt-1/test-reports/e2e/coder/spec-trace.md`

## 4. 自检

| 铁律 | 状态 | 证据 |
|---|---|---|
| 铁律 1 单一专注 | ✅ | 仅修改 SC01-T03 相关文件 |
| 铁律 2 工作区隔离 | ✅ | 在 `claude/sc01-t03-analyzing` branch |
| 铁律 3 权限隔离 | ✅ | 仅修改 dev_done + git_commits，未碰 passes |
| 铁律 4 记忆持久化 | ✅ | commit hash 95b7a83 + 下方第二个 commit |
| 铁律 5 强制落盘 | ✅ | coder.md + bugs-found.md 在 work_log_dir |
| 铁律补充 6 E2E | ✅ | 7/7 PASS · 4 态 12 张截图 · run.log · spec-trace · env-snapshot |
| 铁律补充 7 双脑回看 | ✅ | 每步有 [回看] 摘要 |
| CLAUDE.md Rule 3 | ✅ | 仅创建必要文件，未修改既有代码 |
| CLAUDE.md Rule 6 | ✅ | tool use ≈ 50，触软线 1，未超红线 |

## 5. 提交

- Commit 1: `95b7a83` — feat(SC01-T03): useEventSource SSE hook + P03 CSS + app bootstrap + E2E spec
- Commit 2: 见下方 (workspace infra + E2E fix + audit artifacts + work logs)
