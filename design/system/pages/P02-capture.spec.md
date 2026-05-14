# P02 · 拍题相机 (Capture)

**Status**: Active
**Owner**: design + frontend + backend
**Last-updated**: 2026-05-14
**Mockup**: design/mockups/wrongbook/02_capture.html
**Biz refs**: biz/业务与技术解决方案_AI错题本_基于日历系统.md §2A.4 (P02 规格卡 L469-483) + §2B.2 SC-01 步 1-5
**Related tasks**: feature_list.json SC-01-T01 (capture-to-pending) · 串联 SC-01-T02 (pending-to-analyzing)

---

## §1 页面目的

把"一道错题"用学生最少的动作 (1-2 tap) 变成一份后端可识别的上传产物 (object_key + qid PENDING)，是 SC-01 黄金路径的入口帧。给学生的价值：3-5 秒钟完成拍摄并自动跳走 → 视觉路径无感；给业务的价值：是错题数据库的唯一可信源 (所有 wb_question 都从这里产生)；给系统的价值：把高熵的图像数据收敛为带 sha256 指纹 + 幂等键的标准请求，让后端可去重、可追踪、可断点续传。来源：biz §2A.4 P02 "页面目的"。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区 (zone 划分)

```
┌─────────────────────────────────────┐  顶部安全区 (status bar 54px)
├─────────────────────────────────────┤  透明导航 (back / 标题"拍下错题" / 闪光)
├─ 自动识别 badge ────────────────────┤  "已识别页面边界 · 自动矫正中"
├─ Tip card ──────────────────────────┤  "对准题目并保持稳定..."
├─────────────────────────────────────┤
│                                     │
│        Camera Viewfinder            │  取景器 (黄色 corner brackets · scan line)
│         (paper preview)             │
│                                     │
├─ Upload progress overlay ───────────┤  仅 UPLOADING 态显示 (蓝色环 + %)
├─ Error banner ──────────────────────┤  仅 ERROR 态显示 (红色三角图标)
├─ Subject chips ─────────────────────┤  数学 / 物理 / 化学 / 英语 / 语文 (5 chip)
├─ Mode tabs ─────────────────────────┤  拍题 / 多题 / 文件
├─ Controls dock ─────────────────────┤  [相册] [快门 78px] [文件]
└─ Tab bar (5 tabs) ──────────────────┘  首页 / 错题本 / 拍题(active) / 复习 / 我的
```

来源：biz §2A.4 "布局分区" + design/mockups/wrongbook/02_capture.html。

### 2.2 关键视觉锚 (mockup HTML + 代码真 selector)

| Zone | DOM selector / className | 用途 |
|---|---|---|
| Nav | `.nav` / `header[role="banner"]` | 透明顶栏 (back / 标题 / 闪光) |
| Auto-detect badge | `.detect` | 黄色 pulse + 文案 (`aria-live="polite"`) |
| Tip card | `.tip` | 拍摄稳定性引导 |
| Viewfinder | `.view` / `role="img"` | 取景器，深色背景 + paper preview |
| Subject chips | `.subjects` / `role="group"` | 5 学科水平横排，单选 |
| Mode tabs | `.modes` / `role="tablist"` | 3 模式 tab (photo/multi/file) |
| Controls | `.controls` / `role="main"` | 三按钮 dock (gallery / shutter / file) |
| Shutter | `.shutter` (78px) | 主快门按钮 |
| Tab bar | `.tabbar` / `role="navigation"` | 全局 5 tab，第 3 项 active |

来源：02_capture.html L31-99 + frontend/apps/h5/src/pages/Capture/index.tsx L244-470。

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| Nav (header) | `Capture/index.tsx` 内联 | `{onBack, flashOn, onToggleFlash}` | 透明栏 + back + 闪光开关 |
| Detect badge | `Capture/index.tsx` 内联 | — | 黄色 pulse + a11y live region |
| Tip card | `Capture/index.tsx` 内联 | — | 拍摄稳定性 hint |
| Viewfinder | `Capture/index.tsx` 内联 | `{paperPreview, brackets, scan}` | 取景器 (含 4 corner brackets + scan line) |
| Paper preview | `Capture/index.tsx` 内联 | — | 仅 mockup 态 fake 题面 (mood C) |
| Upload overlay | `Capture/index.tsx` 内联 | `{pct}` | 仅 UPLOADING 态 · 蓝色环形进度 + 数字 |
| Error banner | `Capture/index.tsx` 内联 | `{message}` · `role="alert"` | 仅 ERROR 态 |
| Subject chips | `Capture/index.tsx` 内联 | `{value, onChange, options=SUBJECTS[5]}` | aria-pressed 表态 |
| Mode tabs | `Capture/index.tsx` 内联 | `{value, onChange}` · `role="tablist"` | photo/multi/file |
| Shutter (78px) | `Capture/index.tsx` 内联 | `{disabled, onTap}` | 主按钮 · UPLOADING 时 `disabled=true` |
| Gallery btn / File btn | `Capture/index.tsx` 内联 | `{onTap}` | 复用同一个 hidden `<input type=file>` |
| Hidden file input | `Capture/index.tsx` 内联 | `accept="image/*"` · `capture="environment"` (拍照态) | 真正的图片来源 |
| Tab bar | `Capture/index.tsx` 内联 | — | 全局 5 tab，第 3 项 active |

来源：biz §2A.4 "核心组件" + frontend/apps/h5/src/pages/Capture/index.tsx (整个 component 内联 · 未抽 ui-kit) + mockup HTML DOM。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level State 绑定

```typescript
// frontend/apps/h5/src/pages/Capture/index.tsx L74, L121-126
type CaptureState = 'IDLE' | 'UPLOADING' | 'UPLOADED' | 'ERROR';
type Subject = 'math' | 'physics' | 'chemistry' | 'english' | 'chinese';
type Mode = 'photo' | 'multi' | 'file';

{
  subject: Subject,        // 默认 'math' · 从 localStorage Draft 恢复
  mode: Mode,              // 默认 'photo'
  state: CaptureState,     // IDLE → UPLOADING → UPLOADED → (nav P03) / ERROR
  uploadPct: number,       // 0..100 · UPLOADING 进度
  errorMsg: string | null,
  flashOn: boolean,
}
```

> **代码 vs biz spec drift**：biz §2A.4 "状态集" 列了 6 态 `IDLE / FOCUSING / CAPTURED(preview) / UPLOADING / UPLOADED / ERROR` (含 preview 帧)；代码只实现 4 态 (无 FOCUSING / CAPTURED preview · 直接 IDLE→UPLOADING)。**以代码为准** (mockup 也没有 preview 帧 DOM) → §6 状态机按代码 4 态画。

### 4.2 涉及的后端 Entity

- `wb_file` (file-service · `sha256_hash CHAR(64)` / `object_key` / `lifecycle` / `idempotency_key`) — 见 V1.0.080__wb_file.sql
- `wb_question` (wrongbook-service · `status=PENDING` · `qid` · `idempotency_key`) — A02 audit §1.1 创建端点

### 4.3 涉及的 FE 契约

- `frontend/packages/api-contracts/src/types.ts`: `PresignRequest` / `PresignResponse` / `CreateQuestionReq` / `CreateQuestionResp`
- `frontend/packages/api-contracts/src/clients/files.ts`: `filesClient.presign` / `directUpload` / `complete`
- `frontend/packages/api-contracts/src/clients/questions.ts`: `questionsClient.createPending`

来源：biz §2A.4 "数据绑定" + 代码 grep + A03 audit §1.3。

---

## §5 API 触点

> 字符级精准 path + method · 与 audits/SC-01-PHASE-0/A03-file-presign.md + A02-wrongbook-api.md 字面一致。

| # | Method | Path | Headers (req) | Body (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/api/file/presign` | `X-Idempotency-Key` (必填 · A03 §3 修补 3) | `{filename, content_type, bytes, sha256, purpose?}` | `200 {url, image_url, method, object_key, expires_in_sec}` | ≤ 200ms | 重试 3 次 → 切原生表单上传 (biz §2A.4) |
| 2 | PUT | `{presignedUrl}` (OSS direct) | OSS 签名 (Date / Authorization) | binary 整段 (MVP) | `200 OK` | ≤ 2s (依网速) | 弱网 chunk 2MB · 重试 3 次 (biz §2A.7 · A03 §3 修补 6 计划三段接口) |
| 3 | POST | `/api/wb/questions` | `X-Idempotency-Key`, `X-Request-Id`, `X-Student-Id` | `CreateQuestionReq {studentId, subject, image_key, mime, source_type}` | `201 {qid}` (CreateQuestionResp · plain JSON 不裹 ApiResult) | ≤ 300ms | 三级幂等优先 (header > requestId > body) · A02 §3.3 |

> **A03 audit 标记的 P0 现状缺陷** (会影响 T01 实施)：
> - 入参 `sha256` / `X-Idempotency-Key` 在 `PresignController` 当前**均缺失** (A03 §2 表)，T01 必须先补
> - 多片上传协议三段接口尚未落地 (A03 §3.6)，弱网降级目前走"重试 3 次"
> - FE `api-contracts` 字段命名与后端不完全对齐 (A03 §1.3) · `Capture/index.tsx` 当前用 `presign.upload_url` (而 A 端实际是 `url`) · 是 T01 必须 unblock 的对齐

来源：biz §2A.4 "API 触点" + A03 audit §1.1 + §3 + A02 audit §1.1 + §3.3 + feature_list.json SC-01-T01 primary_apis。

---

## §6 状态机

```
       ┌─────┐ user tap shutter / gallery     ┌──────────┐
       │IDLE │───────────────────────────────►│UPLOADING │
       └─────┘  file picked (size ≤ 10MB)     └────┬─────┘
          ▲                                        │
          │                                        │ presign + PUT + complete + createPending OK
          │                                        ▼
          │                                   ┌──────────┐  setTimeout 300ms
          │  (无显式 retry · ERROR 后 user    │UPLOADED  │──────────► nav /analyzing/{qid}?qid={qid}
          │   重新 tap shutter 直接进 UPLOADING)└──────────┘
          │
          │  presign / PUT / complete / createPending 任一抛错
          │                                        │
          │                                        ▼
          │                                   ┌──────────┐
          └───────────────────────────────────│ERROR     │  顶部 error banner + 留 P02
                                              └──────────┘
```

### 6.1 状态转移规则 (与代码 setState 一一对应)

| From | To | Trigger | Side effect | Code 锚 |
|---|---|---|---|---|
| IDLE | UPLOADING | shutter tap / gallery 选图 / file btn 选图 → handleFile() | `setUploadPct(0)` · `setErrorMsg(null)` · track `wb_capture_upload_start` | index.tsx L175 |
| UPLOADING | UPLOADED | presign + PUT + complete + createPending 全 OK | `setUploadPct(100)` · track `wb_capture_upload_success` · clearIdempotencyKey | index.tsx L201 |
| UPLOADED | (route push) | setTimeout(300ms) | `nav('/analyzing/{qid}?qid={qid}')` | index.tsx L206 |
| UPLOADING | ERROR | catch (presign / PUT / complete / createPending 任一 throw) | `setErrorMsg('上传失败，请重试')` · banner `role="alert"` | index.tsx L207-209 |
| ERROR | UPLOADING | shutter 再次 tap (隐式 · 无显式 retry button) | 同 IDLE→UPLOADING | index.tsx L170 |

来源：biz §2A.4 "状态集" + biz §2A.5 Question 状态机 (`PENDING → ANALYZING`) + 代码 setState grep。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| 全局 Tab 3 「拍题」 | tab bar 第 3 项 (`.tab.active`) | 学生 tap "拍题" tab (任意页) |
| FAB | P05 错题列表右下 | 学生 tap 列表 FAB (`p05-fab-capture`) |
| 直链 `/capture` | URL / 推送 | 深链路由 |

| 出口 | 目标 | 触发条件 |
|---|---|---|
| 路由 push | P03 `/analyzing/{qid}?qid={qid}` | UPLOADED 后 setTimeout 300ms · index.tsx L206 |
| 路由 back | 上一页 | tap 左上 back 按钮 (nav(-1) · index.tsx L248) |

来源：biz §2A.4 "跳转" + biz §2A.3 IA 路由表 + 代码 nav() 调用。

---

## §8 Wire format (SSE / WebSocket 事件)

**本页无 SSE / WebSocket 通道**，事件通讯走 §5 HTTP 触点。

SSE 订阅在下游 P03 (Analyzing) 才发起 (`GET /api/ai/stream/{taskId}`)，wire format 定义见 `design/system/pages/P03-analyzing.spec.md §8` (`STEP_START / STEP_DONE / PARTIAL_JSON / DONE / FAIL / CANCELLED / FALLBACK_MODEL`)。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| 相机权限拒绝 | 用户拒了系统弹窗 | 引导卡片 "去设置" | 降级到文件选择 (file btn 复用同 input · 无 capture 属性) | — |
| 弱网 / 上传中断 | PUT 进度卡死 | 进度条停留 + 重传按钮 + 已上传 % | chunk 2MB 分片 · 重试 3 次 (按 idempotency_key 去重) | TC-01.02 |
| 大文件 (>10MB) | 拍照超过 10MB | 直接 `setErrorMsg('图片过大（最大 10MB）')` · 不发起 presign | 本地短路 (biz "降级到压缩到 <4MB" 暂未实现 · spec drift) | — |
| presign 5xx / PUT 5xx / createPending 5xx | 后端任一 5xx | 顶部 error banner "上传失败，请重试" (`role="alert"`) | state → ERROR · 留 P02 · 不跳 P03 | T01 TI3 |
| 缺 `X-Idempotency-Key` | 客户端实现 bug | 400 `ERR_IDEMPOTENCY_KEY_REQUIRED` | 后端守门返 400 (非 500) | T01 AC6 |
| 同 `X-Idempotency-Key` 重放 | 客户端 retry / 双 tap | 复用首次 file_key + qid (不创新行) | wb_file / wb_question 各仅 1 行 | TC-01.02 (内嵌) · T01 AC2 / TI1 |
| Shutter UPLOADING 态连点 | 用户狂点快门 | `disabled={isUploading}` (index.tsx L431) | 10 次连点只触发 1 次 presign | T01 AC5 / TI4 |

来源：biz §2A.4 "异常 & 降级" + biz §2A.7 异常路径降级矩阵 + feature_list.json SC-01-T01 AC/TI + 代码 catch 块。

---

## §10 验收点 (TC → AC 映射)

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-01.01 | 正常 | 学生新登录 · 网络稳定 · 相机权限已授予 · 后端各服务健康 | 按 SC-01 步 1-4 拍题 + 自动上传 + 自动跳 P03 | wb_file 1 行 + wb_question 1 行 PENDING + qid 返回 + FE nav P03 · 全部关键埋点上报 | T01 AC1 / AC3 / AC4 |
| TC-01.02 | 异常 | 同 TC-01.01 · 步 4 上传中途断网 | 网络在 10 秒内恢复 | 断点续传自动继续 · 最终到步 5 · 不重复创建 question (按 `X-Idempotency-Key` 去重) | T01 AC2 / TI1 |
| TC-01.06 | 边界 | 同 TC-01.01 · 但学生 SC-01 步 18 tap "未掌握" | 完成前 17 步 P02 流程 | P02 部分仍 1 question + 1 file (与 18 步无关) · grade=FORGOT 影响 P08 不影响 P02 | — (本页范围外) |

> **§10 与 T01 AC 反向校验**：
> - AC1 (presign 字符级) → TC-01.01 GIVEN/WHEN 正常路径 ✓
> - AC2 (24h 内 idempotency_key 复用) → TC-01.02 断网续传 ✓
> - AC3 (createPending + 三级幂等) → TC-01.01 (qid 返回) ✓
> - AC4 (analyze-by-url 202 + router.push) → TC-01.01 步 5 跳 P03 (注：当前代码 `nav('/analyzing/{qid}')` 用 qid 代 taskId · feature_list 标记 E02c 替换 · spec drift surface)
> - AC5 (shutter UPLOADING aria-disabled / 10 连点 1 presign) → 无显式 biz TC · TI4 自治
> - AC6 (缺 header 返 400) → 无显式 biz TC · 后端守门契约 · 留 §9 表

来源：biz §2B.2 SC-01 QA 用例表 (L812-819) + feature_list.json SC-01-T01.acceptance_criteria。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| Tap shutter → file picker open | ≤ 100ms (即时) | biz §2B.2 步 3 "耗时预算 300ms"(含动画) |
| 学科 chip 切换 | ≤ 50ms (UI-only) | biz §2B.2 步 2 "800ms"(含取景 settle) |
| presign 返回 | ≤ 200ms | spec §5 + A03 §2 P95 预算 |
| PUT 完成 (5MB / 4G) | ≤ 2s | biz §2B.2 步 4 "≤ 2s" |
| createPending 返回 | ≤ 300ms | spec §5 |
| UPLOADED → nav P03 | ≤ 500ms (含 300ms setTimeout) | biz §2B.2 步 5 "≤ 500ms" · index.tsx L206 |

来源：biz §2B.2 "耗时预算" 列 + spec §5 行级 budget + A03 audit §2。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `wb_capture_open` | P02 mount | `{entry: 'tab' / 'fab' / 'deeplink'}` | biz §2A.4 + biz §2A.8 |
| `wb_capture_subject_switch` | 学科 chip 切换 | `{from, to}` (代码实际字段) | biz §2B.2 步 2 + index.tsx L365 |
| `wb_capture_shutter` | 快门 tap | `{subject, mode}` (代码实际字段) | biz §2A.4 + index.tsx L426 |
| `wb_capture_upload_start` | handleFile 进 UPLOADING | `{bytes, subject}` | biz §2A.4 + index.tsx L180 |
| `wb_capture_upload_success` | createPending 200 后 | `{ms, bytes, subject, qid}` | biz §2A.4 + biz §2A.8 + index.tsx L203 |

> 注：biz §2A.4 "埋点事件" 里列了 `wb_capture_upload_success{ms, bytes}` · 代码补了 `subject` + `qid`，spec drift 偏差较小，以代码为准。

来源：biz §2A.4 "埋点事件" + biz §2A.8 埋点字典 + frontend/apps/h5/src/pages/Capture/index.tsx grep `track\(`.

---

## §13 testid 表

| testid | 用途 | 来源 (testids 包路径) | E2E 引用 |
|---|---|---|---|
| `p02-root` | P02 页面根 | `TEST_IDS.p02.root` | t01-capture-to-pending.spec.ts mount |
| `p02-topbar` | 顶部 nav | `TEST_IDS.p02.topbar` | — |
| `p02-topbar-back` | 返回按钮 | `TEST_IDS.p02.topbarBack` | back/导航测试 |
| `p02-topbar-flash-btn` | 闪光开关 | `TEST_IDS.p02.topbarFlash` | — |
| `p02-detect-badge` | 自动识别 badge | `TEST_IDS.p02.detectBadge` | a11y live region |
| `p02-tip-card` | 拍摄稳定性 tip | `TEST_IDS.p02.tipCard` | — |
| `p02-viewfinder` | 取景器 | `TEST_IDS.p02.viewfinder` | — |
| `p02-paper` | mockup 题面 (mood C) | `TEST_IDS.p02.paper` | — |
| `p02-subjects` | 学科 chip group | `TEST_IDS.p02.subjects` | — |
| `subject-chip-math` | 数学 chip | `TEST_IDS.p02.subjectMath` (canonical · 跨页复用) | t01 学科切换 |
| `subject-chip-physics` | 物理 chip | `TEST_IDS.p02.subjectPhysics` | — |
| `subject-chip-chemistry` | 化学 chip | `TEST_IDS.p02.subjectChemistry` | — |
| `subject-chip-english` | 英语 chip | `TEST_IDS.p02.subjectEnglish` | — |
| `subject-chip-chinese` | 语文 chip | `TEST_IDS.p02.subjectChinese` | — |
| `p02-mode-tabs` | 模式 tab 容器 | `TEST_IDS.p02.modes` | — |
| `p02-mode-tabs-tab-1` | 拍题模式 | `TEST_IDS.p02.modePhoto` | — |
| `p02-mode-tabs-tab-2` | 多题模式 | `TEST_IDS.p02.modeMulti` | — |
| `p02-mode-tabs-tab-3` | 文件模式 | `TEST_IDS.p02.modeFile` | — |
| `capture-shutter` | 78px 快门 (canonical) | `TEST_IDS.p02.shutter` | t01 TI4 防抖 / AC5 连点 |
| `p02-gallery-btn` | 相册按钮 | `TEST_IDS.p02.gallery` | — |
| `p02-upload-progress` | 上传进度环 (仅 UPLOADING) | `TEST_IDS.p02.uploadProgress` | t01 UPLOADING 态断言 |
| `p02-error-banner` | 错误顶部条 (ERROR / errorMsg) | `TEST_IDS.p02.errorBanner` | t01 TI3 ERROR 态 |
| `p02-file-input` | 隐藏 file input | (代码字面量 · 未入 testids 包) | t01 注入 fixture |
| `p02-file-btn` | 文件按钮 | (代码字面量 · 未入 testids 包) | — |

来源：frontend/packages/testids/src/index.ts L8-33 (`TEST_IDS.p02.*`) + frontend/apps/h5/src/pages/Capture/index.tsx grep `data-testid=`.

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `capture.title` | 拍下错题 | Capture wrong question | 顶部标题 (mockup `.nav .title`) |
| `capture.subject.math` | 数学 | Math | 学科 chip 1 |
| `capture.subject.physics` | 物理 | Physics | 学科 chip 2 |
| `capture.subject.chemistry` | 化学 | Chemistry | 学科 chip 3 |
| `capture.subject.english` | 英语 | English | 学科 chip 4 |
| `capture.subject.chinese` | 语文 | Chinese | 学科 chip 5 |
| `capture.tip.lowLight` | 光线太暗，请打开闪光 | Low light, turn on flash | 取景器 hint (低光) |
| `capture.tip.stable` | 对准题目并保持稳定，AI 将自动裁剪并去除手写涂鸦 | Align and hold steady — AI will auto-crop | 取景器 hint (默认) · mockup L130 |
| `capture.error.permission` | 相机权限被拒，去系统设置开启 | Camera permission denied | 权限错误引导 |
| `capture.error.fileTooLarge` | 图片过大（最大 10MB） | Image too large (max 10MB) | 大文件错误 · index.tsx L172 |
| `capture.error.uploadFailed` | 上传失败，请重试 | Upload failed, please retry | 通用上传失败 · index.tsx L209 |

来源：biz §2A.4 "i18n Key" (4 key 列举) + 代码字面量 grep (补 fileTooLarge / uploadFailed / stable)。

---

## §15 关联与影响

- **上游 spec**: P-HOME (Tab 3 入口) / P05 (FAB `p05-fab-capture` 入口)
- **下游 spec**: P03 (Analyzing · UPLOADED 后 setTimeout 300ms 跳转)
- **关联 task**: feature_list.json SC-01-T01 (`capture-to-pending`) · 下游接 SC-01-T02 (`pending-to-analyzing`)
- **关联 audit**: audits/SC-01-PHASE-0/A03-file-presign.md (presign 字符级 ground truth) · audits/SC-01-PHASE-0/A02-wrongbook-api.md (`/api/wb/questions` 字符级 + 三级幂等)
- **关联 mockup**: design/mockups/wrongbook/02_capture.html (mood C dark camera)
- **关联代码**: frontend/apps/h5/src/pages/Capture/index.tsx · frontend/packages/api-contracts/src/clients/files.ts + clients/questions.ts · frontend/packages/testids/src/index.ts L8-33
- **关联 E2E**: frontend/apps/h5/tests/e2e/sc-01/t01-capture-to-pending.spec.ts · backend/file-service/src/test/java/.../T01CaptureToPendingE2EIT.java
- **已知 spec drift surface 给 TL**：
  1. biz "状态集 6 态" vs 代码 4 态 (无 FOCUSING / CAPTURED preview) · 本 spec 以代码为准
  2. biz "大文件 >10MB 本地压缩到 <4MB" vs 代码"直接 setErrorMsg 短路" · 本 spec §9 以代码为准
  3. biz "FE nav `/analyzing/{taskId}`" vs 代码"`nav('/analyzing/{qid}?qid={qid}')`" · feature_list E02c 阶段替换
  4. A03 audit P0 缺陷 (presign 入参 `sha256` / `X-Idempotency-Key` 当前缺) · §5 已按 spec 应有契约写 · T01 修补
  5. FE `api-contracts` 字段 (`upload_url` / `file_key`) 与后端端点 A 字段 (`url` / `object_key`) 不对齐 · A03 §3.5 计划对齐
