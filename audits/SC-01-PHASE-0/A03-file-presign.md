# A03 — file-service Presign vs P02 §5 契约审计

> Task SC-01-A03 · Phase 0 审计 · 目标：判断 file-service 当前 presign 实现是否满足 SC-01 步骤 4（拍题上传）所需契约（P02 §5 `POST /api/file/presign`：入参 mime/size/sha256 + idempotency_key，出参 url/key/expiresIn）。

- **Scope**: SC-01 Phase 0 · 对照 spec `design/system/pages/P02-capture.spec.md` §5 API 触点 + §9 异常 + §11 性能预算
- **Source files audited**:
  - `backend/file-service/src/main/java/com/longfeng/fileservice/controller/PresignController.java`
  - `backend/file-service/src/main/java/com/longfeng/fileservice/controller/UploadController.java`
  - `backend/file-service/src/main/java/com/longfeng/fileservice/dto/PresignReq.java`
  - `backend/file-service/src/main/java/com/longfeng/fileservice/dto/PresignResp.java`
  - `backend/file-service/src/main/java/com/longfeng/fileservice/entity/WbFile.java`
  - `backend/file-service/src/main/java/com/longfeng/fileservice/entity/FileAsset.java`
  - `backend/file-service/src/main/resources/db/migration/V1.0.080__wb_file.sql`
  - `frontend/packages/api-contracts/src/types.ts` (`PresignRequest` / `PresignResponse`)
  - `frontend/packages/api-contracts/src/clients/files.ts` (`filesClient.presign`)
  - `frontend/apps/h5/src/pages/Capture/index.tsx` (在线 Capture 链路)
  - `frontend/apps/h5/src/pages/GuestCapture/index.tsx` (访客 Capture 链路)

---

## 1. 现状（实际暴露的契约 — 同一仓库里 **三套** 并存）

file-service 实际暴露了 **两个并存** 的 presign 端点（命名/契约不一致，存在分裂）；前端 `api-contracts` 又定义了 **第三套** 与后端两端都不完全匹配的字段命名 —— 三条契约链路并行存在。

### 1.1 端点 A — `PresignController.java`（PRD 主线 · 与 GuestCapture FE 对齐）

- **path / method**：`POST /api/file/presign`（与 spec 路径完全匹配）
- **请求 DTO**：`PresignController$PresignReqBody`（内嵌 record）
  - `filename: String` (NotBlank)
  - `content_type: String` (`@JsonProperty`, NotBlank) — 等价 spec 的 `mime`
  - `bytes: Long` (`@JsonProperty`, `@Min(0)` `@Max(10_485_760)`, **可选**) — 等价 spec 的 `size`
  - `purpose: String` (可选)
  - **缺**：`sha256`、`idempotency_key`（既不在 body 也不在 header）
- **响应 DTO**：`PresignController$PresignRespBody`（snake_case wire format）
  - `url: String`（上传 PUT URL）
  - `image_url: String`（24h GET URL，FE 渲染兜底用）
  - `method: String`（恒 "PUT"）
  - `object_key: String`（即 spec 的 `key`）
  - `expires_in_sec: long`（等价 spec 的 `expiresIn`）
- **行为**：MIME 白名单 (`image/jpeg|png|heic|webp` + `application/pdf`) + 10MB cap；按 `ObjectKeyBuilder` 生成 `wrongbook/{tenantId}/{yyyyMM}/{studentId}/{snowflakeId}_{filename}`；写 `wb_file` PENDING + `wb_file_lifecycle`（D-OSS-TTL）。
- **配套 callback**：`CallbackController` `POST /api/files/callback`（Aliyun OSS RSA-SHA1 验签 → 置 `wb_file.status=UPLOADED`）。
- **FE 调用方**：仅 `frontend/apps/h5/src/pages/GuestCapture/index.tsx` 直接 `fetch('/api/file/presign', { body: { filename, content_type } })`，**不发 size / sha256 / idempotency_key**。

### 1.2 端点 B — `UploadController.java`（路径/字段全不同的"旧一套"）

- **path / method**：`POST /files/presign`（**无 `/api` 前缀**，与 spec 完全偏离）
- **请求 DTO**：`dto/PresignReq.java` — `filename: String` (NotBlank) / `mime: String` (NotBlank) / `size: Long` (`@NotNull` `@Min(0)` `@Max(10_485_760)`)；**缺** `sha256` / `idempotency_key`
- **响应 DTO**：`dto/PresignResp.java` — `uploadUrl` / `fileKey` / `expiresAt` / `ttlSeconds`（字段名 camelCase，且与端点 A 全部不同）
- **配套**：`POST /files/complete/{fileKey}` (CompleteResp) + `GET /files/download/{fileKey}`
- **底层链路**：`SignatureService` → `UploadService` → `FileAsset` 实体（`FileAsset` 有 `checksum_sha256 length=64` 列，但 controller 不接收该字段，永远写 `null`）
- **FE 调用方**：`frontend/packages/api-contracts/src/clients/files.ts` 里 `filesClient.presign()` 落 `/files/presign`（路径匹配 B），但 **req 体 / resp 体的字段名又不匹配 B**（详见 1.3）。

### 1.3 契约 C — `frontend/packages/api-contracts`（FE 与两端都不匹配的"第三套"）

- **请求 type**：`PresignRequest { mime, size, sha256? }`（**带 sha256，但是可选**）
- **响应 type**：`PresignResponse { upload_url, file_key, ttl_seconds, bucket }`
- 实际 HTTP 调用：`POST /files/presign`（路径选了 B）
- **但是**：B 端的 resp 字段是 `uploadUrl / fileKey / expiresAt / ttlSeconds` — **C 期望的 `upload_url / file_key / ttl_seconds / bucket` 在 B 端一个都没有**（命名 case 不同 + `bucket` 缺、`expiresAt` 多）。Jackson 默认 `PropertyNamingStrategy` 是 LOWER_CAMEL_CASE，所以 FE 拿到的 `upload_url` 一定是 `undefined`。
- `frontend/apps/h5/src/pages/Capture/index.tsx:189` 调用 `filesClient.presign({ mime, size })` 后用 `presign.upload_url` —— **生产线已经 broken**（除非 httpClient 偷做了 case 转换）。

> **实测**：三套契约（路径 + req 字段 + resp 字段 + 底层实体 `WbFile` vs `FileAsset`）平行运行，FE/BE 没有任何一对完全对齐 spec。

---

## 2. vs Spec 契约 diff（P02 §5 + SC-01 步骤 4）

Spec P02 §5 明文：`POST /api/file/presign` · 用途"拿到上传 URL" · P95 ≤ 200ms · 失败降级"重试 3 次后切原生表单上传"。任务 `task.title` 显式列出契约必需字段：**入参 mime/size/sha256 + idempotency_key**，**出参 url/key/expiresIn**。

| 维度 | Spec 要求 | 端点 A 现状 | 端点 B 现状 | FE Contract C 现状 | 判定 |
|---|---|---|---|---|---|
| **path** | `POST /api/file/presign` | `POST /api/file/presign` ✅ | `POST /files/presign` ❌ | `POST /files/presign` ❌ | A 通过 / B+C 偏离 |
| **入参 `mime`** | 必填 | `content_type` ✅（语义等价、JSON 名不一） | `mime` ✅ | `mime` ✅ | 通过（A 命名不一） |
| **入参 `size`** | 必填 | `bytes` 可选 ⚠️（FE 不传，10MB cap 形同虚设） | `size` `@NotNull` ✅ | `size: number` ✅ | A ⚠️ / B+C ✅ |
| **入参 `sha256`** | 必填（指纹去重 + 完整性校验） | ❌ 完全缺失 | ❌ 完全缺失 | `sha256?` 可选 ⚠️（FE 不发） | **不通过** |
| **入参 `idempotency_key`** | 必填（任务 `key_invariants` 明确"步骤 4 上传按 idempotency_key 不重复创建 question"） | ❌ 缺失（连 `@RequestHeader Idempotency-Key` 也没有） | ❌ 缺失 | ❌ 类型里没有 | **不通过** |
| **出参 `url`** | 必填 | `url` ✅ | `uploadUrl` ⚠️ | `upload_url` ⚠️（snake_case 与 B 输出不匹配） | A ✅ / B+C 偏离 |
| **出参 `key`** | 必填 | `object_key` ⚠️（多 `object_` 前缀） | `fileKey` ⚠️ | `file_key` ⚠️ | 三端命名都需对齐 |
| **出参 `expiresIn`** | 必填（秒数 / TTL） | `expires_in_sec` ✅（语义对） | `ttlSeconds` + `expiresAt` ⚠️ | `ttl_seconds` ⚠️ | A 通过 / B+C 偏离 |
| **分片上传 / 断点续传**（P02 §9：弱网 chunk 2MB · 重试 3 次） | 必需 | ❌ 仅生成单段 PUT URL，无 multipart init/part/complete 协议 | ❌ 同上 | ❌ 同上 | **不通过** |
| **同 SHA256 去重**（spec key_invariants「步骤 4 上传幂等」） | 必需 | ❌ 入参无 sha256，无法做指纹查重；`wb_file.sha256_hash CHAR(64)` 列已存在但永远写 null | ❌ 同上；`file_asset.checksum_sha256` 列同理空置 | ❌ FE 也不发 | **不通过** |
| **P95 ≤ 200ms** | 性能预算 | 未度量，路径上有 `saveAndFlush` + 异步 lifecycle save，单次走 MinIO `presign()` 约 5-30ms — 名义可达，但缺压测 | 同上 | — | ⚠️ 需 Tester 物理验证 |

### 关键差距摘要

1. **`idempotency_key` 完全没实现** —— 既不在 body 也不在 header，也未透传到 `/api/wb/questions`。直接违反任务 `key_invariants` 第 3 条 "步骤 4 上传按 idempotency_key 不重复创建 question"。**P0 阻断 SC-01 步骤 4**。
2. **`sha256` 字段缺失** —— 但底层 schema 已经准备好：`V1.0.080__wb_file.sql` 第 17 行 `sha256_hash CHAR(64)`、`FileAsset.checksum_sha256 length=64` 都存在；controller 是唯一断点。意味着只需补 DTO + 写库一行，DB 不需要改。**轻量修复**。
3. **分片 / 断点续传协议缺失** —— P02 §9 异常路径明确要求"chunk 2MB，重试 3 次"，三端均只签发单段 PUT URL，无 multipart init/part/complete 三段式接口。**P0 阻断 P02 §9 弱网降级**。
4. **三端契约分裂** —— `PresignController` (`/api/file`, `object_key`) / `UploadController` (`/files`, `fileKey`) / FE `api-contracts` (`/files`, `file_key`) 三套字段命名互相不匹配，`Capture` 在线链路理论上 broken（拿到 `upload_url === undefined`）。**必须裁掉两条，统一到端点 A 并把 FE contract 对齐它**。
5. **`bytes` 在端点 A 是可选** —— FE GuestCapture 当前不传 → `@Max(10_485_760)` 在主路径上失效，10MB 服务端 hard limit 名存实亡。
6. **双实体并存** —— `WbFile`（PresignController 用）vs `FileAsset`（UploadController 用），同一份业务数据两条写入路径，统计 / 生命周期 / 回调三处各自一套，长期不可维护。

---

## 3. 修补建议（每条一行 / 可直接派 Coder 干）

1. **统一端点**：保留 `PresignController` (`/api/file/presign`)，删除 `UploadController` + `dto/PresignReq.java` + `dto/PresignResp.java` + `dto/CompleteResp.java` + `dto/DownloadResp.java` + `SignatureService.presignUpload/Download` + `UploadService` + `FileAsset` 旧链路，避免双写；callback 走已有 `CallbackController`。
2. **入参补 `sha256`**：在 `PresignReqBody` 增加 `@NotBlank @Pattern("^[a-f0-9]{64}$") String sha256`（`@JsonProperty("sha256")`），落库 `wb_file.sha256_hash`（**列已存在**，零 schema 变更）；FE `PresignRequest.sha256` 由 `?` 改 `required`，调用前用 `crypto.subtle.digest('SHA-256', buf)` 算。
3. **入参补 `idempotency_key`**：增加 `@RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey`（HTTP header 形式更通用，符合 Stripe / IETF draft 风格）；命中已存在 `(tenantId, studentId, idempotency_key)` 直接返回旧 `objectKey + 新签发 url`，不重复 INSERT `wb_file`；Flyway 新加一列 `idempotency_key VARCHAR(128)` + `UNIQUE(tenant_id, student_id, idempotency_key)`。
4. **`bytes` 改必填 + 字段对齐**：`@NotNull Long bytes` 并加 `@JsonAlias({"size","bytes"})` 让 spec 的 `size` 也接得住；FE 切到 `size` 字段名。
5. **出参字段对齐 spec**：响应 record 增加 spec 三件套别名 — `key`（保留 `object_key` 一轮兼容窗口）、`expiresIn`（保留 `expires_in_sec` 兼容）；FE 下一轮把 `upload_url / file_key / ttl_seconds` 切到 `url / key / expiresIn`，cleanup 旧字段。
6. **新增分片三段接口**：`POST /api/file/multipart/init` (→ `uploadId + partUrls[]`) → `POST /api/file/multipart/part?uploadId&partNumber` → `POST /api/file/multipart/complete` (→ 触发 OSS CompleteMultipartUpload)；MinIO/OSS 都原生支持，P02 §9 chunk 2MB 走该路径。
7. **回调里校验 `sha256`**：`CallbackController` 用 OSS 返回的 `Content-MD5` / `x-oss-hash-crc64ecma` / 对象 ETag 与请求时声明的 `sha256` 比对，不一致则置 `wb_file.status=REJECTED`，FE 走 §9 重试链。
8. **加 IT 用例**（Tester 必跑）：
   - `@SpringBootTest` 同一 `idempotency_key` 调用两次 presign 必须返回相同 `objectKey` 且 `wb_file` 只插入一行（覆盖 TC-01.02 步骤 4 幂等）。
   - sha256 与上传内容不匹配时 callback 必须置 REJECTED（覆盖 TC-01.04 完整性校验）。
   - multipart init/part/complete 三段闭环（覆盖 P02 §9）。
9. **删 FE Capture 在线链路的字段错配**：要么把 `filesClient.presign` 改打 `/api/file/presign` 并切到 A 端响应 schema；要么彻底删 `Capture/index.tsx` 旁路 — 当前 `presign.upload_url` 几乎确定是 `undefined`，属于线上隐患。

---

## 4. 判定

- **整体状态**：**NOT COMPATIBLE** — file-service presign 当前实现 **无法支撑 SC-01 步骤 4** 的 4 项核心契约要求（sha256 / idempotency_key / 分片上传 / 字段命名统一），需先做"统一端点 + 补字段 + 加 multipart"三步重构。
- **P0 阻塞项**：1 / 3（idempotency_key 完全缺失 + 分片协议缺失）
- **P1 修复项**：2 / 4 / 5 / 6 / 9（字段补齐 + 三端对齐）
- **P2 清理项**：1 / 6 / 9（旧 UploadController 链路与冗余实体清理）
- **Estimated rework**：file-service 后端 1-1.5 天 + FE api-contracts/clients/Capture 半天 + Flyway 0.5 列变更 + IT 0.5 天 ≈ **2-3 个工程师人日**。
- **下游影响**：
  - SC-01 步骤 4 `/api/wb/questions` POST 也必须接同一个 `Idempotency-Key` 并落库去重 — 串入 wrongbook-service 的 A02 审计后续。
  - 完成本审计修补后 Tester 应跑 TC-01.02 / TC-01.04 / TC-01.05 三案例做物理回归。
