# P-GUEST-CAPTURE · 游客拍题 (Guest Capture · Try Before Signup)

**Status**: Active
**Owner**: design + frontend + backend (anonymous-service)
**Last-updated**: 2026-05-14
**Mockup**: design/mockups/wrongbook/15_guest_capture.html
**Biz refs**: biz/业务与技术解决方案_AI错题本_基于日历系统.md §2A.3.1 (登录态决策树 L251-298) · §2A.3.2 P-GUEST-CAPTURE 规格卡 (L388-402) · §2B.13 SC-12 (L1200-1238) · §4.10 guest_session DDL (L1608-1632)
**Related tasks**: feature_list.json SC-12-T01..T06 (创会话 / consent / 临时上传 / 游客分析 / 结果轮询 / claim) · 上游 SC-11 P-LANDING · 下游 P03 游客态 + P04 游客态 + P00 注册 + claim 后 P-HOME

---

## §1 页面目的

让"犹豫期访客"在不交手机号 / 不创建账号的前提下，**用 1 次完整拍题 + AI 分析**亲眼看到产品价值，再决定是否注册。这是 MVP 核心增长动作 (Try Before Signup) 的入口帧。给学生 / 访客的价值：零门槛体验、视觉与 P02 完全一致 (差异仅顶部游客横幅 + Consent Bar)；给业务的价值：把"冷注册漏斗"翻转为"拍题 → 看结果 → 注册"，并保留 `anon_qid` 24 h 等用户回头一键 claim 回正式账号；给系统的价值：在匿名维度限流 (设备指纹 1/日 + IP 10/日)、不落生产 OSS、不写 wrongbook / review-plan-service、不生成 T0/T1 节点，与登录态主链路完全隔离。来源：biz §2A.3.2 P-GUEST-CAPTURE "首屏目标" + biz §2B.13 SC-12 场景目的。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区 (zone 划分)

```
┌─────────────────────────────────────┐  status bar 54px (深色相机背景下白字)
├─ Anon Nav (back / brand / 登录) ────┤  匿名 Shell · 无 Tab Bar (§2A.3.1 硬性规则 1)
├─ Quota Banner ──────────────────────┤  "今日还剩 1 次 · 结果保留 24h 可 claim"
│                                     │
│        Camera Viewfinder            │  取景器 (黄色 corner brackets · paper preview)
│         (与 P02 视觉一致)           │
│                                     │
├─ Subject Chips ─────────────────────┤  数学/物理/化学/英语/生物/语文 (6 chip)
├─ Consent Card ──────────────────────┤  ☑ 未成年人保护条款 + 合规 badge 3 枚
├─ Controls Dock ─────────────────────┤  [相册] [相机] [文件]
├─ Shutter Row ───────────────────────┤  [设置] [Shutter 74px · "● Analyze"] [刷新]
└─ Home indicator ────────────────────┘  iOS home bar
```

来源：biz §2A.3.2 "布局分区" + design/mockups/wrongbook/15_guest_capture.html L113-217。

### 2.2 关键视觉锚 (mockup HTML 真 selector)

| Zone | DOM selector / className | 用途 |
|---|---|---|
| Anonymous Shell root | `.phone` (mockup) / `data-testid="anon-shell"` (testids §anonShell.root) | 匿名 Shell 容器 · 无 Tab Bar |
| Anon Nav | `.anon-nav` | 返回 + brand 胶囊 "游客试用 · Guest" + 登录 CTA |
| Brand badge | `.brand .dot + .nm` | 黄色脉冲点 + 大写 "GUEST" 标识 |
| Sign-in CTA | `.signin` | 右上角胶囊 "登录" → P00 (带 `anonToken` query) |
| Quota banner | `.quota` | 时钟图 + "今日还剩 N 次 · 结果保留 24h" |
| Viewport | `.viewport` | 深色相机背景 + radial gradient |
| Edge detect frame | `.edges` + 4 `.corner` | 黄色边角检测框 (与 P02 视觉一致) |
| Subject chips | `.subjects` + `.sub` (`.sub.active`) | 6 学科水平 chip · 单选 |
| Consent card | `.consent` | ConsentBar (勾选后才解锁 Shutter) |
| Consent checkbox | `.consent .check` | 22px 蓝紫渐变 ☑ |
| Compliance badges | `.bg.green / .bg.blue / .bg.orange` | 端到端加密 / 设备指纹 / IP 限流 3 枚 badge |
| Controls dock | `.controls .sources` | 相册 / 相机 / 文件 3 入口 |
| Shutter (74px) | `.shutter` + `.rec` REC 角标 | 主快门 · REC 角标显 "● Analyze" |
| Side buttons | `.sidebtn` × 2 | 设置 / 刷新 |

来源：mockup 15_guest_capture.html L52-217 + frontend/packages/testids/src/index.ts L321-327 (anonShell.*)。

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<AnonymousShell>` | frontend/packages/shells (P-LANDING / P-SHARED 共用) | `{children, showLoginCta}` | 匿名 Shell · 无 Tab Bar · 顶栏 Logo + 登录 |
| `<GuestBanner>` | frontend/packages/ui-kit (新增 · SC-12 引入) | `{remainingQuota, ttlHours, onLoginTap}` | 顶部 quota 横幅 |
| `<CameraPreview>` | frontend/packages/ui-kit (与 P02 共用) | `{aspectRatio, onCapture, brackets}` | 取景器 · 边缘检测 |
| `<SubjectQuickSwitcher>` | frontend/packages/ui-kit (与 P02 共用) | `{value, onChange, options=SUBJECTS[6]}` | aria-pressed 表态 |
| `<ConsentBar>` | frontend/packages/ui-kit (新增) | `{checked, onChange, consentType}` | 未成年人合规勾选 · 勾选前 Shutter `disabled=true` |
| `<Shutter>` | frontend/packages/ui-kit (与 P02 共用 · 74px) | `{disabled, onTap, label="● Analyze"}` | 主快门 · UPLOADING/ANALYZING 时 disabled |
| `<GuestQuotaHint>` | frontend/packages/ui-kit (新增) | `{remaining, resetAt}` | quota banner 内文 |
| `<ComplianceBadgeRow>` | frontend/packages/ui-kit (新增) | `{badges:['encrypt','fingerprint','rate-limit']}` | 3 枚 badge |

来源：biz §2A.3.2 "核心组件" (GuestBanner · CameraPreview · SubjectQuickSwitcher · Shutter · GuestQuotaHint) + mockup HTML DOM + frontend/packages/testids/src/index.ts §anonShell。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level State 绑定

```typescript
// 任务 brief §3 page state 规定
{
  guest: {
    anonToken: string,             // POST /api/anon/file/presign 之前由 bootstrap 申请 · 24h TTL
    deviceFingerprint: string,     // IndexedDB + Canvas + UA 组合 · 与后端 device_fp 一致
    consent: {
      checked: boolean,
      consentType: 'ADULT' | 'MINOR_WITH_GUARDIAN' | 'MINOR_NO_GUARDIAN',
      consentAt: string | null     // ISO timestamp · 勾选后写入
    },
    capture: {
      state: 'IDLE' | 'CONSENT_PENDING' | 'UPLOADING' | 'UPLOADED'
           | 'ANALYZING' | 'ANALYZED' | 'ANALYZED_NO_SAVE'
           | 'QUOTA_EXHAUSTED' | 'ERROR',
      subject: 'math' | 'physics' | 'chemistry' | 'english' | 'biology' | 'chinese',
      uploadPct: number,
      errorCode: 'QUOTA_EXHAUSTED' | 'ANON_TOKEN_EXPIRED' | 'AI_FAIL' | 'NETWORK' | null
    },
    currentAnonQid: string | null, // POST /api/anon/questions 返回 · 用于轮询 + claim
    claimWindow: {
      expiresAt: string,           // anon_qid 生成时 + 24h
      remainingMs: number          // 客户端倒计时显示
    },
    quota: {
      todayRemaining: number,      // 0 / 1 · IDLE 态展示
      resetAt: string              // Asia/Shanghai 00:00
    }
  }
}
```

### 4.2 涉及的后端 Entity

- `guest_session` (anonymous-service · biz §4.10 L1608-1632) — `device_fp / ip_hash / image_tmp_url / analysis_result_json / consent_at / status (0..9) / expires_at = created_at+24h / claimed_by_student_id / claimed_question_id`
- `guest_rate_bucket` (anonymous-service · biz §4.10 L1634) — `(device_fp, ip_hash, date)` 联合唯一 · `count` 上限 1/day · Redis 失败降级写库
- 注意：游客态**不**写 `wb_question` / `wb_review_node` / `calendar_event` — 仅在 claim 后 (POST `/api/auth/anonymous-claim`) 才由后端把 `guest_session.analysis_result_json` 物化为 `wb_question` + EbbinghausEngine 排 T0/T1。

来源：biz §2A.3.2 P-GUEST-CAPTURE "API 触点" + biz §4.10 guest_session DDL + biz §2B.13 SC-12 F08 关键断言点。

---

## §5 API 触点

> 字符级精准 path + method。**注**：biz §2B.13 旧版 path 为 `/api/guest/session` / `/api/guest/analyze` / `/api/guest/claim` (SSE 流)；本 spec 采用任务 brief 给定的 **`/api/anon/*` 新规格** (无 SSE · 轮询)，属 SC-12 attempt-N 规格迭代。冲突点 surface 到 §15 等 biz 同步修订 (Rule 7)。

| # | Method | Path | Headers (req) | Body (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/api/anon/file/presign` | `X-Anon-Token` (必填) · `X-Device-Fp` · `X-Request-Id` | `{filename, mime, size, sha256_hash, purpose:'GUEST_CAPTURE'}` | `200 {url, key, expiresIn:300}` (5 min 临时 bucket) | ≤ 200 ms | 429 QUOTA_EXHAUSTED → 整页挡板 (无 retry) · 5xx → 重试 3 次后 ERROR |
| 2 | PUT | `{presignedUrl}` (临时 OSS direct) | OSS 签名 | binary (jpeg/png) | `200 OK` | ≤ 2 s (5MB / 4G) | 弱网 chunk 2 MB · 重试 3 次 (idem `key`) · >10MB 本地压缩到 <4MB |
| 3 | POST | `/api/anon/questions` | `X-Anon-Token` · `X-Idempotency-Key` · `X-Device-Fp` | `{objectKey, sha256_hash, subject, consentAt}` | `201 {anonQid, claimWindow:{expiresAt}}` | ≤ 300 ms | 缺 `X-Idempotency-Key` → 400 ERR_IDEMPOTENCY_KEY_REQUIRED |
| 4 | POST | `/api/anon/analyze-by-url` | `X-Anon-Token` · `X-Request-Id` | `{anonQid, imageUrl}` | `202 {taskId, pollEvery:1000}` | ≤ 300 ms | AI 失败**不扣额度** · status=FAILED 供后续 claim 重分析 (biz §2A.7 L660) |
| 5 | GET | `/api/anon/result/{anonQid}` | `X-Anon-Token` | — | `200 {status: 'ANALYZING'\|'READY'\|'FAILED', result?: AnalysisResult, errorCode?}` | ≤ 200 ms / 次 | 轮询 1 Hz · 30 s 仍 ANALYZING → 顶部红条 + 建议重试 |
| 6 | POST | `/api/auth/anonymous-claim` | `X-Anon-Token` · `Authorization: Bearer <newJWT>` (注册成功后) | `{anonToken, registerForm:{...}}` | `200 {qid, student_id, claimedQuestionId}` | ≤ 600 ms | 不同 `device_fp` → 403 DEVICE_MISMATCH (biz TC-12.04) · 重复 claim 返回同 qid (幂等) |

来源：任务 brief §5 端点 + biz §2A.3.2 P-GUEST-CAPTURE "API 触点" + biz §2B.13 SC-12 F01-F08 + biz §4.10 guest_session DDL。**注**：任务 brief 未指明 `POST /api/anon/session` 单独入口 · 推断 anon_token 由前端 bootstrap (`resolve-entry.ts`) 在 P-LANDING 进入时一次申请 (与 §2A.3.1 决策树节点 3 同生命周期)。

---

## §6 状态机

```
                      consent.check
        ┌─────────┐   + camera ready    ┌──────────────────┐
        │  IDLE   │────────────────────▶│ CONSENT_PENDING  │
        └─────────┘                     └──────────────────┘
            │                                    │
            │ quota=0                            │ ☑ consent + shutter.tap
            ▼                                    ▼
   ┌──────────────────┐               ┌──────────────────────┐
   │ QUOTA_EXHAUSTED  │               │     UPLOADING        │
   │ (整页挡板 → P00) │               └──────────────────────┘
   └──────────────────┘                          │ PUT 100%
                                                 ▼
                                       ┌──────────────────────┐
                                       │     UPLOADED         │
                                       └──────────────────────┘
                                                 │ /api/anon/analyze-by-url 202
                                                 ▼
                                       ┌──────────────────────┐
                                       │    ANALYZING         │◀── poll GET /result
                                       │ (跳 P03 游客态)      │
                                       └──────────────────────┘
                                                 │ result.status=READY
                                                 ▼
                                       ┌──────────────────────┐
                                       │     ANALYZED         │
                                       │ (跳 P04 游客态)      │
                                       └──────────────────────┘
                                                 │ 学生未点保存 / 离开
                                                 ▼
                                       ┌──────────────────────┐
                                       │ ANALYZED_NO_SAVE     │  ← 终态
                                       │ (toast: 24h 内可     │     anon_qid 仍存活
                                       │  注册后 claim)       │     24h 内回头可 claim
                                       └──────────────────────┘
                                                 │ 任意环节 5xx / AI 2x 失败
                                                 ▼
                                       ┌──────────────────────┐
                                       │       ERROR          │
                                       │ (retry · 不扣额度)    │
                                       └──────────────────────┘
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| IDLE | CONSENT_PENDING | 取景器 ready + quota>0 | Shutter `disabled=true` 等 consent |
| IDLE | QUOTA_EXHAUSTED | 进入页时 quota=0 (24h 内已用过) | 整页挡板 + CTA 到 P00 |
| CONSENT_PENDING | UPLOADING | ☑ consent + shutter.tap | POST `/api/anon/file/presign` → PUT presigned · `consentAt` 写入 |
| UPLOADING | UPLOADED | PUT 100% | 进度环 100% |
| UPLOADED | ANALYZING | POST `/api/anon/questions` 201 + POST `/api/anon/analyze-by-url` 202 | 拿到 `anonQid` + `claimWindow.expiresAt` · push 路由 P03 游客态 |
| ANALYZING | ANALYZED | GET `/api/anon/result/{anonQid}` status=READY | push 路由 P04 游客态 · 顶部黄条 "24h 内可 claim" |
| ANALYZED | ANALYZED_NO_SAVE | 用户离开 P04 / 主动 back / 关 App | **anon_qid 不回滚** · 24h 内仍可 claim (biz §2B.13 TC-12.02) |
| ANY | ERROR | 5xx · AI 2x 失败 · 网络中断 | 顶部红条 + retry · **不扣额度** (biz §2A.7 L660) |
| ANALYZING | ERROR | 30 s 仍 status=ANALYZING | 建议重试 (但额度已用 · 重试走同 anonQid) |
| ANALYZED | (route P00 + claim) | 用户 Tap "保存到错题本" → 注册成功 | POST `/api/auth/anonymous-claim {anonToken, registerForm}` → 跳 P-HOME |

来源：biz §2A.3.2 "状态集" (IDLE → UPLOADING → ANALYZING → RESULT → QUOTA_EXHAUSTED) + biz §2A.5 GuestSession 状态机 L610-618 + 任务 brief §6 终态 ANALYZED_NO_SAVE。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| P-LANDING「试试看」CTA | biz §2A.3.1 决策树节点 3 未命中 → P-LANDING → F07A | 访客 tap "试试看" |
| 深链 `wb://guest/capture` | bootstrap/resolve-entry.ts | URL 含 `/guest/capture` 且无合法 JWT |

| 出口 | 目标 | 触发条件 |
|---|---|---|
| 路由 push | P03 游客态 (`/analyzing/{anonQid}?guest=1`) | UPLOADED + analyze 202 ok |
| 路由 push (P03→P04 自动) | P04 游客态 (`/result/{anonQid}?guest=1`) | result.status=READY |
| 路由 push | P00 注册 (`/login?anonToken={token}&returnTo=/home`) | P04 tap "保存到我的错题本" 主 CTA |
| 路由 push | P-HOME | POST `/api/auth/anonymous-claim` 200 · `claimedQuestionId` 已绑 |
| 路由 back | P-LANDING | 用户 tap 左上 < · 状态机 = IDLE/CONSENT_PENDING |
| 路由 push (强制) | P00 | quota=0 状态进入页 → 直接跳 P00 (biz §2A.3.1 硬规 5 game-flow) |
| 登录 CTA | P00 (`/login?anonToken={token}`) | 右上 "登录" 按钮 · 不丢 anon_qid |

来源：biz §2A.3.2 P-GUEST-CAPTURE "跳转" + biz §2B.13 SC-12 F01-F09 + 任务 brief §15 关联 + biz §2A.3.1 L283 决策树。

---

## §8 Wire format (SSE / WebSocket 事件)

**本页无 SSE/WS 通道**，事件通讯走 §5 HTTP 触点 + GET 轮询 (`/api/anon/result/{anonQid}` 1 Hz)。这是与登录态 P03 主链路 (SSE `GET /api/ai/stream/{taskId}`) 的**关键架构差异**：

| 差异点 | 登录态 P03 (主链路) | 游客态 P-GUEST-CAPTURE → P03 游客态 |
|---|---|---|
| 实时通道 | SSE / WebSocket | **轮询** GET `/api/anon/result/{anonQid}` |
| 4 步流水线 | STEP_1..4 流式打字机 | 单端点 status: ANALYZING → READY |
| 取消 | POST `/api/ai/cancel/{taskId}` | **无取消** (24h 内 anon_qid 仍可复用) |

来源：任务 brief §5 ("无 SSE") + biz §2A.3.2 (轮询非 SSE 由 anon-claim 24h 机制决定) + biz §2A.7 异常路径 (游客态不引入流连接以降低 anonymous-service 负载)。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| 同设备 24h 内重复试用 | 进入页时 quota=0 (`guest_rate_bucket.count>=1`) · 后端 `429 QUOTA_EXHAUSTED` | 整页挡板 "你今天的免费额度已用完，注册后不限次" + CTA 到 P00 | 若 24h 内有未 claim 的 `anon_qid` · 挡板再加 "上次分析结果 24h 内仍可保存" + CTA "登录领回结果" (返 cached 上次结果) | TC-12.05 |
| 伪造 device_fp 刷额度 | 同 IP 连续多次不同 fp | 触发 IP bucket → 429 | `rate:guest:ip:{ip}` 10/day 命中 → 挡板页 + 风控埋点 | TC-12.06 |
| anon_token 过期 (>24h) | 任意 API 返 401 `ANON_TOKEN_EXPIRED` | Toast "游客身份已过期，请重新进入" → 跳 P-LANDING | bootstrap 重新申请 anon_token + 清 page state | — |
| Consent 未勾选企图拍照 | shutter.tap 时 `consent.checked=false` | Shutter 抖动 + Toast "请先勾选未成年人保护条款" | Shutter `disabled=true` 阻断 | — |
| AI 首次 504 超时 | analyze 期间 status=FAILED | P03 游客态顶部红条 "AI 暂时繁忙 · 建议重试" + retry 按钮 | **不扣额度** · `guest_session.status=FAILED` 保留供后续 claim (biz §2A.7 L660) | TC-12.03 |
| AI 连续 2 次失败 | 第 2 次仍 FAILED | "建议注册后重试" 引导 CTA + 顶部红条 | 状态进 ERROR · 用户可选择跳 P00 或离开 | TC-12.03 |
| 弱网 / 上传中断 | PUT 进度卡 > 10 s | 进度环变橙 + "断点续传中" | chunk 2MB · 重试 3 次 (idem `key`) | (复用 P02 TC-01.02 弱网用例) |
| 大文件 (>10MB) | 拍照超过 10MB | 自动压缩到 <4MB 后再 presign | 本地 canvas 压缩 | — |
| 注册失败 anon_qid 不回滚 | F07 注册接口 5xx | Toast "注册失败 · 你的分析结果 24h 内仍可保存" | `anon_qid` 不撤销 · 24h TTL 内再次进入 P-LANDING 仍能 claim (biz TC-12.02) | TC-12.02 |
| 设备指纹换了再 claim | F08 不同 `device_fp` 试图 claim | Toast "设备已变更，无法保存此结果" | 服务端 403 `DEVICE_MISMATCH` · 前端不重试 | TC-12.04 |
| 未成年人未勾监护 | consent_type=MINOR_NO_GUARDIAN | 强制挡板 "请取得家长同意后再继续" | 不允许进入 UPLOADING (biz §2A.3.2 合规要求) | — |

来源：biz §2A.3.2 "异常态" + biz §2A.7 异常路径降级矩阵 L658-660 + biz §2B.13 SC-12 QA 用例 TC-12.03..06 + biz §4.10 guest_rate_bucket 限流 + 任务 brief §9。

---

## §10 验收点 (TC → AC 映射)

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-12.01 | 正常 | 新设备首次 · `device_fp` 当日未用 guest 额度 · `anon_qid=null` | 完整走 F01-F10 (P-LANDING → 本页 → P03 → P04 → 注册 → claim) | session 创建 · 分析成功 · claim 成功 · P-HOME 显示新题 · 埋点链完整 | SC-12-T01..T06 全 AC |
| TC-12.02 | 正常 | 已分析完但未注册 · 关闭 App 20h 后重开 (`ANALYZED_NO_SAVE` 终态) | 再次打开 → 决策树 → P-LANDING → CTA 仍能 claim | `anon_qid` 在 24h TTL 内活 · `POST /api/auth/anonymous-claim` 成功 | SC-12-T06 AC2 (24h claim 窗口) |
| TC-12.03 | 异常 | 同上 · F04 期间 AI 504 超时 | 触发 1 次 failed | **不扣额度** · `status=FAILED` · 顶部红条 · retry · 重试成功后继续 F05 | SC-12-T04 AC3 (AI 失败不扣额度) |
| TC-12.04 | 异常 | 用户注册后用了不同设备指纹 | F08 Claim | 服务端 403 `DEVICE_MISMATCH` · 前端 Toast · 保留结果到 24h 外 TTL 失效 | SC-12-T06 AC4 (device_fp 校验) |
| TC-12.05 | 边界 | 同设备 1 天内尝试第 2 次 | 点 Shutter | 429 `QUOTA_EXHAUSTED` · 整页挡板 · CTA 到 P00 | SC-12-T01 AC5 (限流挡板) |
| TC-12.06 | 安全 | 伪造 device_fp 企图刷额度 | 连续多次不同 fp 同 IP | IP bucket `rate:guest:ip:{ip}` 10/day → 429 | SC-12-T01 AC6 (IP 限流) |

来源：biz §2B.13 SC-12 QA 用例表 L1230-1238 + 任务 brief §10 + feature_list.json SC-12 task acceptance_criteria (待 feature_list 生成后反向校验)。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| 进入页 → quota banner 可见 | ≤ 200 ms | biz §2B.13 F01 时延预算 |
| POST `/api/anon/file/presign` 返回 | ≤ 200 ms | spec §5 line 1 + 任务 brief |
| PUT 完成 (5MB 文件 / 4G) | ≤ 1 s | biz §2B.13 F03 时延预算 |
| POST `/api/anon/questions` 返回 | ≤ 300 ms | spec §5 line 3 |
| POST `/api/anon/analyze-by-url` 202 返回 | ≤ 300 ms | spec §5 line 4 |
| GET `/api/anon/result/{anonQid}` 单次轮询 | ≤ 200 ms | spec §5 line 5 |
| 全链路 P-GUEST-CAPTURE → P03 → P04 (含 AI) | ≤ 12 s | biz §2A.6 US-01 类比 (匿名链路与登录链路同 ai-analysis-service) |
| POST `/api/auth/anonymous-claim` 完成 | ≤ 600 ms | biz §2B.13 F08 时延预算 |

来源：biz §2B.13 SC-12 各 F 步 "时延预算" 列 + spec §5 行级 P95 + biz §2A.6 US-01 全链路。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `anon_guest_capture_view` | 本页 mount | `{device_fp, entry_source: 'landing'\|'deep_link', experiment_bucket}` | biz §2A.3.2 + §2B.13 F01 |
| `anon_guest_consent` | ☑ Consent | `{device_fp, consent_type}` | biz §2B.13 F02 |
| `anon_guest_capture_shoot` | Shutter tap | `{device_fp, subject, source: 'camera'\|'gallery'\|'file'}` | biz §2A.3.2 + §2B.13 F03 |
| `anon_guest_analyze_start` | analyze-by-url 202 | `{device_fp, anon_qid, subject}` | biz §2A.3.2 + §2B.13 F04 |
| `anon_guest_analyze_done` | result READY | `{device_fp, anon_qid, latency_ms, subject, success: true}` | biz §2A.3.2 + §2A.8 埋点字典 |
| `anon_guest_analyze_fail` | result FAILED (任一次) | `{device_fp, anon_qid, error_code, attempt: 1\|2}` | biz §2A.7 L660 (不扣额度) |
| `anon_guest_quota_exhausted` | 429 挡板 | `{device_fp, ip_hash}` | biz §2A.3.2 + §2A.7 L659 |
| `anon_guest_cta_save` | P04 tap "保存到错题本" | `{device_fp, anon_qid}` | biz §2B.13 F06 |
| `anon_guest_token_expired` | 401 ANON_TOKEN_EXPIRED | `{device_fp}` | 任务 brief §9 |
| `anon_guest_login_cta_tap` | 右上 "登录" tap | `{device_fp, current_state}` | mockup `.signin` |

来源：biz §2A.3.2 "埋点事件" 列 + biz §2A.8 埋点字典 L676-679 + biz §2B.13 SC-12 F01-F10 埋点列。**统一约束**：所有 `anon_*` 事件必须携带 `device_fp` 且禁止携带原始 PII (biz §2A.8 L686)。

---

## §13 testid 表

> **注**：截至 Last-updated 日期，`frontend/packages/testids/src/index.ts` 尚**未**为 P-GUEST-CAPTURE 创建独立命名空间 `TEST_IDS.pGuestCapture.*`。下表是 **prescriptive 提案**：本 spec 在 SC-12 任务实施时由 FE 落库新增。**已存在**的复用 testid 用 ✓ 标注。

| testid | 用途 | 出现位置 (mockup) | 状态 |
|---|---|---|---|
| `anon-shell` | 匿名 Shell 根 | testids §anonShell.root | ✓ 已存在 (testids L322) |
| `anon-shell-nav` | 顶部 nav 容器 | mockup `.anon-nav` | ✓ 已存在 (testids L323) |
| `anon-shell-login-btn` | 右上 "登录" CTA | mockup `.signin` | ✓ 已存在 (testids L325) |
| `p-guest-capture-root` | 本页根 | `<div data-testid="p-guest-capture-root">` | 待加 (SC-12) |
| `guest-quota-banner` | 顶部 quota 横幅 | mockup `.quota` | 待加 (SC-12) |
| `guest-quota-remaining` | "今日还剩 N 次" 数字 | mockup `.quota .t em` | 待加 (SC-12) |
| `guest-quota-ttl` | "保留 24h" 文案 | mockup `.quota .d em` | 待加 (SC-12) |
| `guest-consent-card` | Consent 卡片 | mockup `.consent` | 待加 (SC-12) |
| `guest-consent-checkbox` | Consent ☑ | mockup `.consent .check` | 待加 (SC-12) |
| `guest-compliance-badge-encrypt` | "图片端到端加密" | mockup `.bg.green` | 待加 (SC-12) |
| `guest-compliance-badge-fingerprint` | "设备指纹" | mockup `.bg.blue` | 待加 (SC-12) |
| `guest-compliance-badge-ratelimit` | "IP 限流" | mockup `.bg.orange` | 待加 (SC-12) |
| `subject-chip-math` | 数学 chip (与 P02 共用) | mockup `.subjects .sub.active` | ✓ 已存在 (testids L18 canonical) |
| `subject-chip-physics` 等 | 其他 5 学科 | mockup `.subjects .sub` | ✓ 已存在 |
| `capture-shutter` | 74px 主快门 (与 P02 共用 canonical) | mockup `.shutter` | ✓ 已存在 (testids L24) |
| `guest-shutter-rec-badge` | Shutter "● Analyze" 角标 | mockup `.shutter .rec` | 待加 (SC-12) |
| `guest-source-gallery` | 相册入口 | mockup `.sources .src:nth(1)` | 待加 (SC-12) |
| `guest-source-camera` | 相机入口 | mockup `.sources .src:nth(2)` | 待加 (SC-12) |
| `guest-source-file` | 文件入口 | mockup `.sources .src:nth(3)` | 待加 (SC-12) |
| `guest-upload-progress` | 上传进度 (复用 P02 视觉) | UPLOADING 态注入 | 待加 (SC-12) |
| `guest-error-banner` | 错误顶部条 | ERROR 态注入 · `role="alert"` | 待加 (SC-12) |
| `guest-quota-blocker` | QUOTA_EXHAUSTED 整页挡板 | 挡板态注入 | 待加 (SC-12) |
| `guest-quota-blocker-cta` | 挡板 "立即注册" CTA → P00 | 挡板态 | 待加 (SC-12) |

来源：frontend/packages/testids/src/index.ts L321-327 (anonShell 已存在) + L7-24 (subject-chip / capture-shutter canonical) + mockup 15_guest_capture.html `data-testid` (mockup 当前未注入 testid 属性 · 视觉锚见 §2.2) + 任务 brief §13。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `guestCapture.title` | 游客试用 · Guest | Guest Trial · Guest | brand 胶囊 |
| `guestCapture.quota.remaining` | 今日还剩 {n} 次 免费分析 | {n} free trial left today | quota banner 主文案 |
| `guestCapture.quota.ttl` | 结果保留 24 小时 · 注册后可一键 claim 到正式账号 | Result kept for 24h · sign up to claim | quota banner 副文案 |
| `guestCapture.consent.title` | 我已阅读并同意 | I have read and agree to | Consent card 主文案 |
| `guestCapture.consent.minorTip` | 上传的图片仅用于本次 AI 分析，24 小时后自动清理；如您为未成年人，须取得家长同意 | Uploaded images are only used for this AI analysis and auto-cleaned in 24h; minors require guardian consent | Consent 详文 |
| `guestCapture.consent.linkMinor` | 《未成年人保护条款》 | Minor Protection Terms | Consent 链接 |
| `guestCapture.consent.linkGuest` | 《游客试用协议》 | Guest Trial Agreement | Consent 链接 |
| `guestCapture.shutter.analyze` | ● Analyze | ● Analyze | Shutter REC 角标 |
| `guestCapture.signin` | 登录 | Sign In | 右上 CTA |
| `guestCapture.error.quotaExhausted` | 你今天的免费额度已用完，注册后不限次 | Free trial used up · sign up for unlimited | 429 挡板 |
| `guestCapture.error.anonTokenExpired` | 游客身份已过期，请重新进入 | Guest session expired, please re-enter | 401 toast |
| `guestCapture.error.deviceMismatch` | 设备已变更，无法保存此结果 | Device changed, cannot claim this result | 403 toast |
| `guestCapture.error.consentRequired` | 请先勾选未成年人保护条款 | Please check the consent first | shutter 抖动 toast |
| `guestCapture.error.aiFail` | AI 暂时繁忙，建议重试 | AI temporarily busy, please retry | P03 游客态红条 |
| `guestCapture.error.aiFailFinal` | 建议注册后重试 | Suggest signup before retry | 连续 2 次失败 |
| `guestCapture.cta.savetoMyWrongbook` | 保存到我的错题本 | Save to my wrongbook | P04 主 CTA → P00 |

来源：biz §2A.3.2 P-GUEST-CAPTURE "i18n" 隐含 + mockup HTML 真文案 (L142, L152-153, L173-174, L209) + biz §2A.7 异常文案 + 任务 brief §9 异常态文案。

---

## §15 关联与影响

- **上游 spec**: P-LANDING ("试试看" CTA · SC-11 F07A 入口 · biz §2B.12) · `bootstrap/resolve-entry.ts` (登录态决策树节点 3 未命中 → P-LANDING → 本页)
- **下游 spec**:
  - P03 游客态 (`/analyzing/{anonQid}?guest=1` · 轮询非 SSE · 顶部保留游客横幅)
  - P04 游客态 (`/result/{anonQid}?guest=1` · 黄条 "本次结果 24h 内可保存到错题本" · 主 CTA → P00)
  - P00 注册 (`?anonToken={token}&returnTo=/home` · 注册成功后自动 POST `/api/auth/anonymous-claim`)
  - P-HOME (claim 成功后落位 · 今日复习大卡 "1 题新入库" 徽章)
- **关联 task**: feature_list.json SC-12 T01..T06 (创会话 / consent / 临时上传 / 游客分析 / 结果轮询 / claim)
- **关联 audit**: 待 `audits/SC-12-PHASE-0/A0X-anonymous-service-*.md` 在 SC-12 启动时生成
- **关联 mockup**: design/mockups/wrongbook/15_guest_capture.html (本页) · 14_landing.html (上游) · 03_analyzing.html (下游 P03 游客态) · 04_result.html (下游 P04 游客态)
- **关联 entity**: `guest_session` (biz §4.10 L1608-1632) · `guest_rate_bucket` (biz §4.10 L1634) · `account_device` (claim 时校验 device_fp)
- **微服务**: `anonymous-service` (本页所有 `/api/anon/*` 端点) · `ai-analysis-service` (analyze-by-url 内部转发 · 与登录态共链路) · `auth-service` (anonymous-claim 端点)
- **网关过滤器**: `AnonFilter` (校验 `X-Anon-Token` · 注入 `device_fp` upstream) · `GatewayAuthFilter` (拦匿名写请求 · biz §2B.14 F04 写操作 403)

**Spec drift surface (Rule 7)**:
1. 任务 brief 给定 `/api/anon/*` 路径与无 SSE 轮询机制，与 biz §2B.13 SC-12 旧版 `/api/guest/*` + SSE 流不一致。本 spec **以任务 brief 为准** (newer)，已在 §5 注栏说明。biz 文档需在 SC-12 PR 同步修订。
2. 任务 brief §6 新增终态 `ANALYZED_NO_SAVE`，在 biz §2A.5 GuestSession 状态机 (L610-618) 中未显式标注 (隐含在 `RESULT_READY` 长存 24h)。本 spec 显式落盘为终态，让客户端 UI 状态可枚举 (Rule 9 tests verify intent)。
3. `frontend/packages/testids/src/index.ts` 尚无 `pGuestCapture` 命名空间，已在 §13 标 prescriptive · SC-12 实施时由 FE 落库新增。

**24h claim 机制说明** (关键不变量)：
- `anon_qid` 由 `POST /api/anon/questions` 返回时绑定 `claimWindow.expiresAt = now + 24h` (服务端 `guest_session.expires_at`)。
- 24h 内任何渠道 (重开 App / 不同入口) 拿到原 `anon_qid` 都可发 `POST /api/auth/anonymous-claim {anonToken, registerForm}` 完成绑定。
- claim 服务端**幂等**：相同 `guest_session_id` 重复 claim 返回同一个 `qid` (biz §2B.13 关键断言 L1223)。
- claim 校验双因子：`device_fp` 一致 + `ip_range` 一致 (biz TC-12.04)；任一不符返 403 `DEVICE_MISMATCH`。
- claim 后副作用：① 新建 `wb_question` ② 触发 `EbbinghausEngine` 排 T0/T1 ③ 发 `question.created` MQ ④ `guest_session.status=CLAIMED` + `claimed_by_student_id` + `claimed_question_id` 回填。
- 注册失败不回滚 `anon_qid` (`ANALYZED_NO_SAVE` 状态保留) — 让用户 24h 内有第二次机会，是 Try Before Signup 漏斗的核心容错设计。
