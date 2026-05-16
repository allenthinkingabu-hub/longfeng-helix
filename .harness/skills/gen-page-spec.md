# Skill: gen-page-spec

> **用途**：把一个页面 P0X 的"散落在 biz / mockup / testids / audits / 代码 里的真相碎片"凝结成 `design/system/pages/P0X-<slug>.spec.md` (page-level 单页 spec sheet · 14 节)
> **触发**：用户说「生成 P02 spec」/「为 P0X 写 spec.md」/「恢复 spec 文件 P0X」
> **owner**：user · 首版于 2026-05-14 与 gen-feature-list 同次会话产出
> **配套**：[gen-feature-list.md](gen-feature-list.md) (上游 · 把 biz SC 拆成 task) · 本 skill (下游 · 把 page 拆成 spec)

---

## 0 · 调用参数

| 参数 | 必填 | 示例 | 默认 |
|---|---|---|---|
| `PAGE_ID` | ✓ | `P02` / `P-HOME` / `P-LANDING` | — |
| `PAGE_SLUG` | — | `capture` / `home` / `landing` | 从 biz §2A.4 卡名抽取 |
| `BIZ_DOC` | — | `biz/业务与技术解决方案_AI错题本_基于日历系统.md` (master) 或 `biz/features/<FEATURE_ID>__<slug>.md` (satellite · 由 gen-biz-doc 产) | 默认 master · 若 PAGE_ID 在 master §2A.3 路由表中不存在 → 自动 fallback 到对应 satellite (`grep -rn "${PAGE_ID}" biz/features/`) |
| `MOCKUP_PATH` | — | `design/mockups/wrongbook/02_capture.html` | 按 PAGE_ID 自动匹配（02_*=P02 等） |
| `OUTPUT_PATH` | — | `design/system/pages/P02-capture.spec.md` | `design/system/pages/${PAGE_ID}-${PAGE_SLUG}.spec.md` |
| `FORCE` | — | `--force` | 不传则已存在时先 Read + 询问 |

---

## 1 · 方法论（6 步 · 严格按序）

### Step 1 · 定位 biz §2A.4 卡 (master 优先 · satellite fallback)

先在 master biz 找：`grep -n "#### ${PAGE_ID} ·" biz/业务与技术解决方案_*.md`

**找不到 → fallback 到 satellite**: `grep -rn "## §2A\\.4\\|#### ${PAGE_ID}" biz/features/` (gen-biz-doc 产的 satellite biz 也用 `#### ${PAGE_ID} ·` schema)

确认 hit 后 Read 完整卡（15 维度表：页面目的 / 布局分区 / 核心组件 / 数据绑定 / API 触点 / 状态集 / 跳转 / 异常态 / i18n Key / 埋点事件 / 可访问性 / 性能预算 / 优先级 / 首屏目标 / 核心组件 - 实际字段以源卡为准）。

**判定 source 是 master 还是 satellite**：本 skill 后续 §15 关联与影响 / §10 验收点 / §5 API 锚必须显式标注来源（不允许混用）。satellite 派生的 spec.md 末尾 metadata 必须含 `Biz refs: [satellite path] (主源) + [master path] (cross-ref 锚)`，不允许只写 master。

### Step 2 · 找 mockup HTML 视觉源

按 PAGE_ID 自动匹配 `design/mockups/wrongbook/<NN>_*.html`（编号映射：00→P00, 02→P02, ..., 09→P09, 10→P10 ..., 18→P18；P-HOME→01_home_v2.html 或 01_home.html 取最新版；P-LANDING→14_landing.html 等）。Read 整份 HTML：
- §2 wireframe 章节抽取关键 selector + 视觉布局 (header / body / footer / modal 等)
- §3 核心组件章节对照 biz §2A.4 的「核心组件」补 HTML 真实 DOM 名称
- §13 testid 章节 grep `data-testid="..."` 抽出该页全部 testid

### Step 3 · 找 testid 真相源

`grep -A 30 "^ *p02:\|^ *${PAGE_ID_LOWER}:" frontend/packages/testids/src/index.ts`（P02 在 testids 包下命名空间 `TEST_IDS.p02.*` · P-HOME 一般是 `TEST_IDS.home.*`）。把全部 testid 抽成表填 §13。

### Step 4 · 找跨服务契约源 (API + wire format)

对每个 spec §5 API 触点：
- 优先用 biz §2A.4 「API 触点」字段（高层）
- 再到 `audits/SC-${N}-PHASE-0/A0X-*.md` 找字符级精准 path / method / req / resp 字段 (audit md 经过 grep 控制器代码核对 · 是 ground truth)
- 兜底 grep `backend/<svc>/src/main/java/.../*Controller.java` 真实代码

SSE / WebSocket 流式页 (目前已知 P03)：
- §8 wire format 从 `audits/SC-01-PHASE-0/A04-ai-analysis.md` §2.3 表 + ai-analysis controller 代码抽 type union
- 其他非流式页 §8 留空段 + 一句注 "本页无 SSE/WS 通道,事件通讯走 §5 HTTP 触点"

### Step 5 · 找 TC 验收用例源

`grep -A 8 "^| TC-${N}\\.[0-9]" biz/xx.md` 在 §2B.X SC 卡的 QA 用例表里捞 TC-XX.0Y 行，逐条映射到本页对应行为：
- 哪些 TC GIVEN 涉及本页 → §10 验收点表
- 用 feature_list.json 的 task.acceptance_criteria 反向校验 (一个 task AC 应能在 spec §10 表里找到对应 TC 行)

### Step 6 · 凝结输出 + Surface 给用户

按 §2 §3 列出的 14 节模板（见下）逐节生成 markdown。**生成完不要直接落盘** —— 先把 14 节的概览表（每节字段数 / 数据来源 / 行数估计）摆给用户对，用户 OK 才写文件。

---

## 2 · spec.md 14 节模板 (严格按序 · 节号匹配 audit citation `spec.md §X`)

````markdown
# ${PAGE_ID} · ${页面中文名} (${PAGE_SLUG_PASCAL})

**Status**: Active
**Owner**: design + frontend + backend
**Last-updated**: ${YYYY-MM-DD}
**Mockup**: design/mockups/wrongbook/${NN}_${slug}.html
**Biz refs**: biz/xx.md §2A.4 (${PAGE_ID} 规格卡) + biz §2B.X (涉及的 SC 流水线)
**Related tasks**: feature_list.json SC-${N} 涉及本页的 T${MM} list

---

## §1 页面目的

(一段话 · 从 biz §2A.4 「页面目的」抄过来扩展 · 说明本页存在的 why · 给学生 / 给业务 / 给系统的价值。3-5 句)

---

## §2 布局分区 + Wireframe

### 2.1 布局分区 (zone 划分)

ASCII / 表格描述。例：
```
┌─────────────────────────────┐  顶部安全区
├─────────────────────────────┤  取景器 70%
├─────────────────────────────┤  学科 Chips
├─────────────────────────────┤  模式 Tabs
├─────────────────────────────┤  快门区 (78px shutter)
└─────────────────────────────┘  辅助操作
```
来源：biz §2A.4 「布局分区」+ mockup HTML 视觉。

### 2.2 关键视觉锚 (mockup HTML 真 selector)

| Zone | DOM selector / class | 用途 |
|---|---|---|
| Header | `.p02-header` | 安全区 + 返回按钮 |
| Viewfinder | `.viewfinder-frame` | 边缘检测取景 |
| Shutter | `[data-testid="capture-shutter"]` | 78px 主快门 |
| ... | ... | ... |

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<Viewfinder>` | frontend/packages/ui-kit | `{aspectRatio, onCapture}` | 取景器 |
| `<SubjectChips>` | frontend/packages/ui-kit | `{value, onChange, options}` | 学科切换 |
| `<Shutter>` | frontend/packages/ui-kit | `{disabled, onTap}` | 78px 快门按钮 |
| ... | ... | ... | ... |

来源：biz §2A.4 「核心组件」+ frontend/packages/ui-kit + mockup HTML 真组件名。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level State 绑定

```typescript
{
  student: { id, defaultSubject, lastSubject },
  config:  { maxFileMB, allowedMimes },
  device:  { permissions: { camera, photo } },
  capture: {
    state: 'IDLE' | 'FOCUSING' | 'CAPTURED' | 'UPLOADING' | 'UPLOADED' | 'ERROR',
    subject: SubjectCode,
    upload: { progressPct, bytesUploaded, totalBytes },
    error: ErrorCode | null
  }
}
```

### 4.2 涉及的后端 Entity

- `wb_file` (file-service · sha256_hash / object_key / lifecycle)
- `wb_question` (wrongbook-service · status=PENDING)

来源：biz §2A.4 「数据绑定」+ frontend/packages/api-contracts/src/types.ts + 后端 entity Java class。

---

## §5 API 触点

> 字符级精准 path + method · 必须与 audits/SC-${N}-PHASE-0/A0X-*.md 字面一致。

| # | Method | Path | Headers (req) | Body (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/api/file/presign` | `X-Idempotency-Key` (必填), `X-Request-Id` | `{filename, mime, size, sha256_hash, purpose}` | `200 {url, key, expiresIn}` | ≤ 200ms | 重试 3 次 → 切原生表单上传 |
| 2 | PUT  | `{presignedUrl}` (OSS direct) | OSS-签名 | binary | `200 OK` | ≤ 2s (依网速) | 弱网 chunk 2MB · 重试 3 次 (TC-01.02) |
| 3 | POST | `/api/wb/questions` | `X-Idempotency-Key`, `X-Request-Id` | `CreateQuestionReq` | `201 {qid}` | ≤ 300ms | 幂等键三级优先 (header > requestId > body) |

来源：biz §2A.4 「API 触点」(高层) + audits/SC-${N}-PHASE-0/A0X-*.md (字符级 path / 字段) + 控制器代码。

---

## §6 状态机

```
       ┌─────┐ camera.ready  ┌─────────┐ shutter.tap  ┌──────────┐
       │IDLE │──────────────→│FOCUSING │─────────────→│CAPTURED  │
       └─────┘               └─────────┘              └──────────┘
                                                            │
                                          presign 200 +     │
                                          PUT in flight     │
                                                            ▼
       ┌──────┐ navigate     ┌──────────┐ PUT 100%   ┌──────────┐
       │ERROR │←────presign  │UPLOADED  │←───────────│UPLOADING │
       └──────┘   5xx        └──────────┘            └──────────┘
                                  │
                                  ▼
                              (路由到 P03)
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| IDLE | FOCUSING | camera.ready | 取景器边缘检测启动 |
| FOCUSING | CAPTURED | shutter.tap | 触觉 medium + 缩略图飞入 |
| CAPTURED | UPLOADING | presign 200 | 进度条 0% |
| UPLOADING | UPLOADED | PUT 100% | 进度条 100% + 自动跳 P03 |
| UPLOADING | ERROR | PUT 5xx (3 retries 后) | 顶部 toast + 留 P02 |
| ERROR | IDLE | retry button | 状态重置 |

来源：biz §2A.4 「状态集」+ biz §2A.5 关键状态机 + biz §2B.X 「前端状态」列。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| 全局 Tab 3 | tab bar | 学生 tap 拍题 tab |
| FAB | P05 右下 | 学生在错题列表 tap + |
| P05 右下 + | P05 列表 | 学生 tap "新增" FAB |

| 出口 | 目标 | 触发条件 |
|---|---|---|
| 路由 push | P03 (`/analyzing/{taskId}`) | UPLOADED · presign+PUT+wb-questions 全成功 |
| 路由 back | 上一页 | 学生 tap 左上 < / 系统返回键 |

来源：biz §2A.4 「跳转」。

---

## §8 Wire format (SSE / WebSocket 事件)

(非流式页留段说明：「本页无 SSE/WS 通道,事件通讯走 §5 HTTP 触点。」)

(流式页例 P03)：

| Event type | Payload | 用途 | 来源 |
|---|---|---|---|
| `STEP_START` | `{step: 1..4, model: string}` | 流水线节点进入 'now' | A04 audit §2.3 |
| `STEP_DONE` | `{step: 1..4, durMs: number}` | 流水线节点进入 'done' | A04 audit §2.3 |
| `PARTIAL_JSON` | `{chunk: string}` | JSON 流式打字机 append | A04 audit §2.3 + spec drift fix |
| `DONE` | `{totalMs, tokens}` | 4 步全部完成 · FE 跳 P04 | A04 audit |
| `FAIL` | `{code, message}` | 分析失败 | A04 audit |
| `CANCELLED` | `{}` | 学生主动取消 · BE 先发本帧再 complete sink | A04 audit |
| `FALLBACK_MODEL` | `{chunk: "from→to"}` | 模型切换 (SC-01-C04 扩展 · spec drift) | A04 audit + TC-01.03 |

来源：audits/SC-01-PHASE-0/A04-ai-analysis.md (字符级 type union) + ai-analysis-service controller + biz §2B.X TC-01.03。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| 相机权限拒绝 | 用户拒了系统弹窗 | 引导卡 "去系统设置授权" | 跳系统设置 deep link | — |
| 弱网 / 上传中断 | PUT 进度卡 > 10s | 进度条变橙 + "断点续传中" | chunk 2MB · 重试 3 次 (idem) | TC-01.02 |
| 大文件 (>10MB) | 拍照超过 10MB | 自动压缩到 <4MB 后再 presign | 本地 canvas 压缩 | — |
| presign 5xx | 后端 file-service down | 顶部错误 banner + retry button | 留 P02 · 不跳 P03 | — |
| 缺 X-Idempotency-Key | 客户端实现 bug | 400 ERR_IDEMPOTENCY_KEY_REQUIRED | 后端守门返 400 (非 500) | T01 AC6 |

来源：biz §2A.4 「异常 & 降级」+ biz §2A.7 异常路径降级矩阵 + biz §2B.X TC 异常用例 + feature_list.json task AC。

---

## §10 验收点 (TC → AC 映射)

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-01.01 | 正常 | 学生新登录 · 网络稳定 · 相机权限授予 | SC-01 步 1-4 | 上传成功 + qid PENDING + 跳 P03 | T01 AC1/AC3/AC4 |
| TC-01.02 | 异常 | 同上 · 步 4 上传中途断网 | 网络 10s 内恢复 | 断点续传 · 不重复创建 question (idem) | T01 AC2 (内嵌) |

来源：biz §2B.X QA 用例表 (TC-XX.0Y) + feature_list.json SC-${N} task acceptance_criteria。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| Tap shutter → CAPTURED 视觉反馈 | ≤ 100ms | biz §2B.2 步 3 「耗时预算」 |
| presign 返回 | ≤ 200ms | spec §5 P95 budget |
| PUT 完成 (5MB 文件 / 4G) | ≤ 2s | biz §2B.2 步 4 |
| P02 → P03 跳转 | ≤ 500ms | biz §2B.2 步 5 |

来源：biz §2B.X 「耗时预算」列。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `wb_capture_open` | P02 mount | `{entry: 'tab'/'fab'/'p05-fab'}` | biz §2A.4 + biz §2A.8 |
| `wb_capture_subject_switch` | 学科 chip 切换 | `{subject: 'math'/'physics'/...}` | biz §2A.4 |
| `wb_capture_shutter` | 快门触发 | `{subject}` | biz §2A.4 + biz §2B.2 步 3 |
| `wb_capture_upload_start` | presign 200 后 | `{taskId, bytes}` | biz §2A.4 |
| `wb_capture_upload_success` | PUT 100% | `{ms, bytes}` | biz §2A.4 |

来源：biz §2A.4 「埋点事件」+ biz §2A.8 埋点字典。

---

## §13 testid 表

| testid | 用途 | 出现位置 (mockup) | E2E 引用 |
|---|---|---|---|
| `p02-root` | P02 页面根 | `<div data-testid="p02-root">` | t01-spec.ts:87 beforeEach mount |
| `subject-chip-math` | 数学 chip | mockup §subject-chips | t01-spec.ts:117 |
| `capture-shutter` | 78px 快门 | mockup §shutter | t01-spec.ts:279 (TI4 防抖) |
| `p02-upload-progress` | 上传进度条 | mockup §progress | t01-spec.ts:125, 275 |
| `p02-error-banner` | 错误顶部条 | mockup §error | t01-spec.ts:306 (TI3 ERROR 态) |
| `p02-file-input` | 隐藏文件 input | hidden | t01-spec.ts:64 (injectFixtureFile) |

来源：frontend/packages/testids/src/index.ts `TEST_IDS.p02.*` + mockup HTML `data-testid="..."` grep + t01-capture-to-pending.spec.ts。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `capture.title` | 拍题 | Capture | 顶部标题 |
| `capture.subject.math` | 数学 | Math | 学科 chip |
| `capture.tip.lowLight` | 光线太暗,请打开闪光 | Low light, turn on flash | 取景器 hint |
| `capture.error.permission` | 相机权限被拒,去系统设置开启 | Camera permission denied | 权限错误引导 |

来源：biz §2A.4 「i18n Key」+ frontend/packages/i18n/。

---

## §15 关联与影响

- **上游 spec**: P-HOME (Tab 3 入口) / P05 (FAB 入口)
- **下游 spec**: P03 (analyzing · 上传成功后跳转)
- **关联 task**: feature_list.json SC-01 T01 (capture-to-pending)
- **关联 audit**: audits/SC-01-PHASE-0/A03-file-presign.md
- **关联 mockup**: design/mockups/wrongbook/02_capture.html
````

---

## 3 · 每节的素材源映射 (权威来源 + 兜底来源)

| 节 | 主源 (必读) | 辅源 (验证用) |
|---|---|---|
| §1 页面目的 | biz §2A.4 「页面目的」(master 或 satellite) | mockup HTML 视觉 |
| §2 布局分区 + wireframe | biz §2A.4 「布局分区」 + mockup HTML | — |
| §3 核心组件 | biz §2A.4 「核心组件」 + frontend/packages/ui-kit | mockup HTML DOM |
| §4 数据绑定 | biz §2A.4 「数据绑定」 + frontend/packages/api-contracts | 后端 entity Java class |
| §5 API 触点 | biz §2A.4 「API 触点」+ audits/SC-${N}-PHASE-0/A0X (字符级 · master 派生 spec 用) **或** satellite §10.X (字符级 · satellite 派生 spec 用 · greenfield 没 audit md) | 控制器代码 (若已存在) |
| §6 状态机 | biz §2A.4 「状态集」 + biz §2A.5 关键状态机 + biz §2B.X 「前端状态」列 | — |
| §7 跳转 | biz §2A.4 「跳转」 | biz §2A.3 IA 路由表 |
| §8 Wire format | audits/SC-${N}-PHASE-0/A0X (流式页只 P03) | 后端流控制器代码 |
| §9 异常 & 降级 | biz §2A.4 「异常 & 降级」 + biz §2A.7 异常路径降级矩阵 + biz §2B.X TC 异常用例 | feature_list.json task AC |
| §10 验收点 | biz §2B.X QA 用例表 + feature_list.json task AC | — |
| §11 性能预算 | biz §2B.X 「耗时预算」列 | spec §5 行级 budget |
| §12 埋点事件 | biz §2A.4 「埋点事件」 + biz §2A.8 埋点字典 | — |
| §13 testid 表 | frontend/packages/testids/src/index.ts | mockup HTML data-testid grep + e2e spec.ts |
| §14 i18n key | biz §2A.4 「i18n Key」 | frontend/packages/i18n |
| §15 关联与影响 | feature_list.json + biz §2B.X 上下游 SC 流水 | audits/SC-${N}-PHASE-0/ |

---

## 4 · 反作弊红线 (CLAUDE.md Rule 1/3/9/12 项目化)

1. **§5 API 触点必须字符级一致**：path / method / header / req body / response shape 跟 audit md + 控制器代码 100% 对齐。**不**允许"四舍五入"成口语化（例如把 `/api/wb/questions` 写成 `/wb/questions`）。Audit md 是 ground truth · 与之冲突时以 audit 为准。
2. **§13 testid 必须真存在**：每行 testid 在 `frontend/packages/testids/src/index.ts` 或 mockup HTML `data-testid` 至少一处可见。**不**允许 fabricate "建议加这个 testid" —— 那是 spec drift。
3. **§10 验收点 TC 必须真存在**：每行 TC 必须能在 biz §2B.X QA 用例表里 grep 到该 TC ID + 同 GIVEN/WHEN/THEN 文字。**不**允许编造新 TC 番号。
4. **§9 异常**必须挂 TC**：异常表里关联 TC 列要么是 biz §2B.X 真 TC 编号、要么留空 (`—`) · **不**允许造一个新 TC-XX.0Y 来"装饰" §9。
5. **§6 状态机必须可执行**：ASCII / 表格的所有 from/to/trigger 都要在代码里能 grep 到对应的 setState / dispatch / handler · **不**允许"理论上的状态" 偷偷加进去。
6. **§11 性能预算必须有来源**：不允许凭空写"≤ 200ms" · 必须能溯源到 biz §2B.X 某步 「耗时预算」、或 spec §5 行注、或 SLA 文档。
7. **mockup HTML 视觉是 §2 §3 §13 兜底真相**：如果 biz §2A.4 与 mockup HTML 不一致，**以 mockup HTML 为准**（视觉是用户真见到的）· biz 文档 surface 给用户决定是否要回改。
8. **Last-updated 字段不可随意填**：必须用今天的真实日期（YYYY-MM-DD · 不要预测未来 / 不要写"近期"）。

---

## 5 · 与其他工具的边界

- 本 skill **只生成 page-level spec.md**（每页一份）· 不生成 architecture-level decision (`design/arch/*.md`)、不生成 system-level guideline (`design/system/components.md`)。
- 本 skill **不写代码**。spec.md 是 contract · 代码是 spec.md 的 implementation。spec ≠ source code · spec 是 prescriptive (规定 what should be) · code 是 descriptive (实际是 what is)。
- 与 [gen-feature-list.md](gen-feature-list.md) 的关系：上游 (feature_list) 把 SC 拆 task · 本 skill 把 page 拆 spec。一个 task 通常涉及 2-3 个 spec.md (例 SC-01 T01 涉及 P02 + P03 · T04 涉及 P03 + P04)。生成顺序：先 feature_list (定义 task)，后 spec.md (定义 page contract)。spec.md 反过来又给 task AC 提供锚 (§10 验收点)。
- 与 audits/SC-${N}-PHASE-0/A0X-*.md 的关系：audit md 是**反向**审计 (verify 后端 vs spec 是否对齐 · 发现 drift)。本 skill 是**正向**定义 (spec is canonical)。两者必须保持一致 · 一旦发现 drift · audit md 标记 fix point · 本 skill 重生时 spec.md 也跟着改。

---

## 6 · 用法示例

```
用户: 为 P02 写 spec.md
```

执行步骤：
1. `grep -n "#### P02 ·" biz/xx.md` → 锁定 `#### P02 · 拍题相机（Capture）` 章节锚 (大约 L469)
2. Read biz §2A.4 P02 卡 (~30 行 · 12 维度表)
3. Read `design/mockups/wrongbook/02_capture.html` (视觉源 + DOM + testid)
4. `grep -A 30 "p02:" frontend/packages/testids/src/index.ts` (testid 真相)
5. Read `audits/SC-01-PHASE-0/A03-file-presign.md` (P02 §5 API 字符级)
6. Read `biz §2B.2 SC-01` 步 1-4 (P02 涉及的步) + TC-01.01..06 (涉及 P02 的)
7. Read `feature_list.json` T01 节点 (P02 关联 task AC)
8. 按 §2 14 节模板逐节生成
9. **生成 14 节概览表给用户对** → 用户 OK 后写 `design/system/pages/P02-capture.spec.md`

---

## 7 · Skill 自检 checklist (生成后必跑)

- [ ] 14 节齐全 (即使 §8 非流式页留空段也算)
- [ ] §5 每个 API path 在 audit md 或控制器代码字符级可 grep 到
- [ ] §13 每个 testid 在 frontend/packages/testids 或 mockup HTML 真存在
- [ ] §10 每个 TC ID 在 biz §2B.X 真存在
- [ ] §6 每个状态在 frontend/src/pages/${page}/ 代码里能 grep 到
- [ ] §11 每个 budget 有 biz / audit / SLA 引用
- [ ] §0 元数据头 Last-updated 是今天日期
- [ ] markdown 合法 (无悬挂代码块 · 表格列数对齐)
- [ ] 与 feature_list.json 该页关联 task 的 AC 一致 (反向校验)

打钩全过 → 报告输出路径 + 14 节摘要。

---

**修订表**

| 版本 | 日期 | owner | 摘要 |
|---|---|---|---|
| v1 | 2026-05-14 | user | 首版 · 与 gen-feature-list 同次会话产出 · 待 SC-01 8 页生成时实战验证 |
| v1.1 | 2026-05-16 | user (gen-page-spec 首次跑 satellite biz doc 派生 spec) | 支持 satellite biz doc 作为主源 (§0 BIZ_DOC fallback · §1 Step 1 加 satellite 分支 · §3 §1/§5 源映射加 satellite 选项) · P-WEEKLY-REVIEW-weekly-review.spec.md 首次实战验证 |
