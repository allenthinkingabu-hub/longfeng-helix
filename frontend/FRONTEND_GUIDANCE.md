# Frontend Guidance

> **Status**: Active · 前端工程规范入口
> **Last-updated**: 2026-05-14
> **Owner**: frontend
> **Purpose**: 给新贡献者 / AI agent (Coder/Tester) 一个 5 分钟读完的导航 · Coder 7 步流程 step 2「全栈上下文恢复」**必读**

---

## 1 · 项目使命 + 设计哲学

**北极星**：跨端共享业务契约 · 三栈并存 (H5 + 微信小程序 + Flutter Phase 2) · 设计系统消费一致 · E2E 真启动浏览器证明业务流。

**核心原则**（按优先级 · 与 CLAUDE.md 12 条工程德行对齐）：
1. **Contract-first** — 任何后端 API 调用 **必须** 通过 `@longfeng/api-contracts` zod schema · 不允许散落在组件里写 `fetch`/`axios` 直调
2. **Token-first** — 任何颜色 / 间距 / 字体 / 圆角 / 投影 / 动效 **不允许硬编码** · 必须通过 `--tkn-*` CSS 自定义属性消费 (`design/system/tokens/`)
3. **TestID-first** — 任何可交互元素 **必须** 注入 `data-testid` · 从 `@longfeng/testids` 包消费 · **禁止**散落字符串
4. **Spec-first** — 任何 page 落地前 **必须** 在 `design/system/pages/P0X-*.spec.md` 有对应 spec · §3 核心组件 + §5 API + §13 testid 三段是落地契约
5. **State-boundary-clear** — 服务端状态走 `@tanstack/react-query` · 本地 UI 状态走 `zustand` · 二者**不允许混用** (例 react-query cache 不放 UI 临时态)

---

## 2 · 项目结构 (pnpm workspace)

```
frontend/
├── pnpm-lock.yaml
├── apps/
│   └── h5/                          ← S7 · React 18 + Vite 5 + Konsta UI (H5/PWA · 移动浏览器入口)
│       ├── package.json
│       ├── vite.config.ts             ← /api 多前缀分流到 file-service / wrongbook-service / ai-analysis
│       ├── playwright.config.ts       ← E2E 配置 · baseURL=localhost:5174
│       ├── src/
│       │   ├── pages/                   ← P02 Capture / P03 Analyzing / P04 Result / ... 各页面入口
│       │   ├── __mocks__/               ← vitest mock
│       │   ├── hooks/                   ← useEventSource (SSE) · useIdempotencyKey · ...
│       │   ├── api/                     ← (薄壳 · 包装 @longfeng/api-contracts clients)
│       │   ├── stores/                  ← zustand stores (UI 临时态)
│       │   └── i18n/                    ← react-i18next 入口 + locale 切换
│       └── tests/
│           └── e2e/sc-${N}/<task>.spec.ts  ← Playwright E2E (与 SHARED-E2E-PROTOCOL.md §1 三轴隔离)
└── packages/
    ├── api-contracts/               ← S7 · 后端契约单源 (zod schema + 自动生成 TS types)
    │   ├── src/types.ts                ← Request/Response zod 定义
    │   ├── src/clients/                ← fetch wrappers (files.ts / questions.ts / analyze.ts / review.ts)
    │   └── src/index.ts
    ├── testids/                     ← S7 · testid 常量包 · 跨端同名
    │   └── src/index.ts                ← TEST_IDS.<page>.<element> 命名树
    └── telemetry/                   ← S7 · 埋点 SDK (业务事件 + 错误监控)
        └── src/index.ts

待新增 (规划中 · 见 design/arch/frontend-stack-decision.md):
- apps/miniapp/                    ← 微信小程序 WXML/WXSS/JS 原生 (Phase 1 并行)
- apps/mobile/                     ← Flutter iOS+Android (Phase 2 · SC-01 全 PASS 后启动)
- packages/ui-kit/                 ← 共享组件库 (Button / Card / Modal / ...)
- packages/shared-logic/           ← 共享业务逻辑 (跨 H5/miniapp · 不跨 Flutter)
- packages/i18n/                   ← i18n key + locale json 单源
```

**workspace 包引用**：`"@longfeng/api-contracts": "workspace:*"` (pnpm 自动 resolve · 不要 npm publish 这些 package)

---

## 3 · 技术栈 (锁定 · 不擅自换)

| 层 | 栈 | 真证 (`apps/h5/package.json`) |
|---|---|---|
| 构建 | **Vite 5** | `vite ^5.x` + `@vitejs/plugin-react ^4.3.1` |
| 框架 | **React 18** | `react ^18.3.1` + `react-dom ^18.3.1` |
| 类型 | **TypeScript** | `typescript` + `@types/react ^18.3.5` |
| UI 库 | **Konsta UI** (移动 iOS 风) | (在 dependencies 内) |
| 路由 | **react-router-dom v6** | `react-router-dom ^6.26.2` |
| 服务端状态 | **TanStack Query (react-query v5)** | `@tanstack/react-query ^5.56.0` |
| 本地状态 | **Zustand** | `zustand ^4.5.0` |
| 表单 | **react-hook-form** + **zod** resolver | `react-hook-form ^7.53.0` + `zod ^3.23.0` |
| i18n | **i18next** + **react-i18next** | `i18next ^23.15.0` + `react-i18next ^14.1.3` |
| UT | **Vitest** + **Testing Library** | `vitest` + `@testing-library/react ^16.0.0` |
| E2E | **Playwright** | `@playwright/test ^1.59.1` |
| Lint | **ESLint** + **eslint-plugin-local** (项目自定义规则) | `eslint ^8` + `@typescript-eslint/parser ^7` |

**不要引入**:
- ❌ Redux / MobX / Recoil (用 zustand)
- ❌ SWR (用 react-query)
- ❌ axios (用 fetch via api-contracts clients)
- ❌ Formik / Final Form (用 react-hook-form)
- ❌ moment.js (用原生 Intl.DateTimeFormat 或 dayjs · 与 backend OffsetDateTime 对齐)
- ❌ lodash (大部分需求 ES2020+ 原生足够 · 真要用挑单函数 `lodash.<fn>`)

---

## 4 · packages 消费规则

### 4.1 `@longfeng/api-contracts` (后端契约单源)

**所有**后端 API 调用走这里 · 组件不允许直接 `fetch`/`axios`：

```typescript
// ✅ 正确
import { createQuestion, type CreateQuestionReq } from '@longfeng/api-contracts/clients/questions';

const { mutate } = useMutation({
  mutationFn: (req: CreateQuestionReq) => createQuestion(req, { idempotencyKey: idemKey }),
  onSuccess: (data) => navigate(`/analyzing/${data.qid}`)
});

// ❌ 错误
import axios from 'axios';
axios.post('/api/wb/questions', { ... });  // 违反 Contract-first
```

**zod schema 双向用**:
- 出参用 `z.infer<typeof CreateQuestionRespSchema>` 拿 TS 类型
- 入参用 `CreateQuestionReqSchema.parse(input)` 运行时校验 (防恶意 input)

### 4.2 `@longfeng/testids` (testid 常量树)

**所有** `data-testid` 必须从这里消费 · 不允许散落字符串：

```tsx
// ✅ 正确
import { TEST_IDS } from '@longfeng/testids';

<button data-testid={TEST_IDS.p02.shutter} aria-disabled={isUploading}>
  拍照
</button>

// ❌ 错误
<button data-testid="capture-shutter">  // 散落字符串 · 重命名时漏改
```

testid 命名约定: `<page>-<region>-<element>[-{variant}]` 三段 kebab-case · 双端同名 (H5 `data-testid` / miniapp `data-test-id`)

### 4.3 `@longfeng/telemetry` (埋点 SDK)

业务事件埋点统一走 telemetry SDK · 不要散落 `gtag(...)` / `posthog.capture(...)`：

```typescript
import { track } from '@longfeng/telemetry';

track('wb_capture_shutter', { subject: 'math' });
track('wb_result_save', { subject, kpCount: 2 });
```

埋点名 + 字段必须能在 biz §2A.8 埋点字典 查到。

### 4.4 `@longfeng/ui-kit` (待建)

未来共享组件库 · 现阶段 (Phase 1) 直接用 Konsta UI + 在 page 内 inline 自定义。Phase 1 末期把高频组件抽包。

---

## 5 · TestID 强制注入

### 5.1 哪些元素必须有 testid

| 元素类型 | 必须 testid? | 理由 |
|---|---|---|
| 可点击按钮 (button / a[onClick]) | ✓ 强制 | E2E 第一交互锚 |
| 输入框 (input / textarea / select) | ✓ 强制 | E2E 填表 + form-error 断言 |
| 状态 banner (error / success / warning / loading) | ✓ 强制 | E2E 断言状态 |
| 列表卡片 (cards in list) | ✓ 动态 testid | 例 `item-card-${qid}` |
| 模态/Sheet/Toast | ✓ 强制 | E2E 弹窗触发断言 |
| 装饰性元素 (icon / divider / spacer) | ✗ 不必 | E2E 不关心 |
| Layout container (div wrapper) | ✗ 不必 (除非是 page 根) | page 根用 `${page}-root` |

### 5.2 跟 spec.md §13 testid 表对齐

每个 page 的 `design/system/pages/P0X-*.spec.md §13 testid 表` 是**该 page 的 testid 唯一权威清单**。新增 testid:
1. 先在 §13 表加一行
2. 再在 `frontend/packages/testids/src/index.ts` 加 export
3. 最后在组件用 `TEST_IDS.<page>.<element>`

**禁止** 反向 (先组件后包后 spec) · 那是 silent drift。

---

## 6 · 状态管理 · 严格边界

### 6.1 边界判定

```
┌─────────────────────────────────────────────────────────────┐
│ 数据来源                          │ 工具                       │
├─────────────────────────────────────────────────────────────┤
│ 后端 API 返回 (question / list)   │ @tanstack/react-query     │
│ 本地 UI 临时态 (toggle / sheet)   │ zustand                    │
│ 表单字段值                         │ react-hook-form           │
│ URL 路由参数 (qid / sessionId)    │ react-router-dom useParams│
│ 全局用户上下文 (token / locale)   │ zustand (一次性 hydrate)   │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 react-query 用法

```typescript
// 查询
const { data, isLoading } = useQuery({
  queryKey: ['question', qid],
  queryFn: () => getQuestion(qid),
  staleTime: 30_000,  // 30s 内不重新拉
});

// 修改 + invalidate
const queryClient = useQueryClient();
const { mutate } = useMutation({
  mutationFn: (req) => archiveQuestion(qid),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['question', qid] }),
});
```

**禁止**:
- ❌ 把临时 UI 态 (`isSheetOpen`) 塞进 react-query cache
- ❌ 用 `useEffect` 手动 sync `data` 到 zustand store
- ❌ 在组件里直接调 `queryClient.setQueryData` 模拟服务端数据 (那是测试 mock 才做的)

### 6.3 zustand 用法

```typescript
// stores/captureStore.ts
import { create } from 'zustand';

interface CaptureState {
  selectedSubject: 'math' | 'physics' | ...;
  setSubject: (s: string) => void;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  selectedSubject: 'math',
  setSubject: (s) => set({ selectedSubject: s }),
}));
```

**禁止**:
- ❌ zustand store 调 fetch (那是 react-query 的事)
- ❌ store 跨 page 共享 (除非是真全局态 · 例用户 token / theme)

---

## 7 · 表单 + 校验

### 7.1 react-hook-form + zod 双联

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('msgkey:auth.error.email_invalid'),
  password: z.string().min(8, 'msgkey:auth.error.password_too_short'),
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
});
```

### 7.2 错误显示 i18n

错误 message 写 `msgkey:` 前缀 · 真翻译在 i18n 表查 · 与后端错误码同协议：

```tsx
{errors.email && <p data-testid="auth-email-error">{t(errors.email.message)}</p>}
```

---

## 8 · 路由 + i18n

### 8.1 路由约定

```typescript
// react-router-dom v6
<Routes>
  <Route path="/" element={<PHome />} />
  <Route path="/capture" element={<P02Capture />} />
  <Route path="/analyzing/:taskId" element={<P03Analyzing />} />
  <Route path="/wrongbook/:qid" element={<P06Detail />} />
  <Route path="/review/exec/:nid" element={<P08ReviewExec />} />
  <Route path="/calendar/month" element={<P10CalendarMonth />} />
  <Route path="/event/:eid" element={<P11EventDetail />} />
  // ...
</Routes>
```

路径必须与 `design/system/pages/P0X-*.spec.md §7 跳转` 段对齐。

### 8.2 i18n 用法

```typescript
import { useTranslation } from 'react-i18next';

const { t, i18n } = useTranslation();
// key 与 spec.md §14 i18n key 表一致
<button>{t('capture.shutter.label')}</button>
```

不允许在 JSX 写硬编码中文/英文 · 全走 `t(<key>)`。

---

## 9 · 测试金字塔

| 层 | 工具 | 数量比例 | 位置 | 跑命令 |
|---|---|---|---|---|
| **UT** (Unit) | Vitest + Testing Library | 70% | `<Component>.test.tsx` 同目录 | `pnpm --filter h5 test` |
| **Integration** (页面级 · 含 react-query / store) | Vitest + MSW (mock 后端) | 20% | `<Page>.test.tsx` | 同上 |
| **E2E** (真启动浏览器 · 真后端) | Playwright | 10% | `tests/e2e/sc-${N}/<task>.spec.ts` | `pnpm --filter h5 exec playwright test` |

### 9.1 E2E 走 SHARED-E2E-PROTOCOL.md

E2E 脚本严格按 `.harness/agents/SHARED-E2E-PROTOCOL.md` v1 DoR C-1..C-6 落地：
- C-1 源脚本 git tracked + `// trace:` 头注释 (引 biz § + spec.md §)
- C-2 Playwright 产物拷进 audit 快照
- C-3 后端 IT verify.log 全绿
- C-4 4 态 (idle/uploading/success/error) VRT screenshot × 3 = 12 张
- C-5 spec-trace.md (行级 spec ↔ E2E assertion 对照)
- C-6 env-snapshot.md (docker ps 真证 + 端口表)

### 9.2 VRT (Visual Regression Test)

每个状态截图 3 张：`baseline` (git tracked) + `actual` (本次跑) + `diff` (差异图)。差异 > 0.1% 阈值即失败。

---

## 10 · 反模式 (不要这么做)

- ❌ **硬编码颜色/间距/字号** (违反 Token-first · 走 `--tkn-*`)
- ❌ **散落 `data-testid` 字符串** (违反 TestID-first · 从 `@longfeng/testids` 消费)
- ❌ **组件内直接 `fetch`/`axios`** (违反 Contract-first · 走 `@longfeng/api-contracts`)
- ❌ **零开始造组件不查 ui-kit / Konsta** (违反 Spec-first 第 3 节核心组件 · 先 grep 找 reference)
- ❌ **临时 UI 态塞 react-query cache** (违反 State-boundary-clear)
- ❌ **服务端数据手动 sync 到 zustand** (违反 State-boundary-clear · react-query 自动管)
- ❌ **错误 message 写中文** (违反 i18n · 用 `msgkey:` 前缀)
- ❌ **跳过 spec.md 先写代码** (违反 Spec-first · 走 `.harness/skills/gen-page-spec.md`)
- ❌ **直接 `npm install`** (违反 monorepo · 用 `pnpm add` + workspace 协议)
- ❌ **E2E 用 `page.evaluate` 走后门** (违反 SHARED-E2E-PROTOCOL · Tester DoR 会驳)
- ❌ **新组件不加 testid** (违反 TestID-first · E2E 没法定位)

---

## 11 · 与其他文档的关系

| 文档 | 作用 | 与本文关系 |
|---|---|---|
| [../CLAUDE.md](../CLAUDE.md) | 项目铁律 (12 工程德行 + AI Agent 启动纪律 + audit.js 卡口) | 本文是前端落地 · CLAUDE.md 是元规范 |
| [../.harness/agents/coder-agent.md](../.harness/agents/coder-agent.md) | Coder Agent 7 步骤 + 5 铁律 | Coder 步骤 2 "全栈上下文恢复" 必读本文 |
| [../.harness/agents/SHARED-E2E-PROTOCOL.md](../.harness/agents/SHARED-E2E-PROTOCOL.md) | E2E 测试协议 DoR C-1..C-6 | §9 测试金字塔 E2E 层走这个协议 |
| [../design/system/GUIDANCE.md](../design/system/GUIDANCE.md) | 设计系统入口 (token / components / pages) | 前端消费设计系统的入口 |
| [../design/system/pages/](../design/system/pages/) | 19 张 page spec.md | 每页前端落地的 §3 组件 + §5 API + §13 testid 契约源 |
| [../design/arch/frontend-stack-decision.md](../design/arch/frontend-stack-decision.md) | 三栈 ADR (H5+miniapp+Flutter) | 本文是 H5 的落地 · 小程序/Flutter 在 Phase 1/2 各自加 GUIDANCE |
| [../backend/BACKEND_GUIDANCE.md](../backend/BACKEND_GUIDANCE.md) | 后端工程规范 | API 契约对端 · `@longfeng/api-contracts` 是双端共享层 |
| [../.harness/feature_list.json](../.harness/feature_list.json) | SC-01 14 task 拆解 | 前端 task 的入口表 |

---

## 12 · 修订表

| 版本 | 日期 | owner | 摘要 |
|---|---|---|---|
| v1 | 2026-05-14 | user | 首版 · 与 backend/BACKEND_GUIDANCE.md 同次会话恢复产出 · 替代历史丢失版本 (`.harness/agents/coder-agent.md` L27 引用) |
