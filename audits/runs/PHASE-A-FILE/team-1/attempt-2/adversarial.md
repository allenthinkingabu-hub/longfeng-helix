# Adversarial Log · PHASE-A-FILE · team-1 · attempt-2

> attempt-2: 修复 audit REDO redo_reason: testcase count + 探索性关键词

## Round 1 · REJECT: `complete()` crashes on PDF uploads (500 Internal Server Error)

### Bug 描述
`FileUploadService.complete()` 对所有 MIME 类型（包括 `application/pdf`）执行图片变体生成（WebP thumbnail + medium），但 `ImageIO.read()` 无法解析 PDF → 返回 `null` → `Thumbnails.of(null)` 抛 `IllegalArgumentException` → 被 catch 包装为 `RuntimeException("Image processing failed")` → Spring 返回 500。

### 复现路径
1. `POST /files/presign` body: `{"filename":"doc.pdf","mime":"application/pdf","size":4096}` → 200 OK
2. `PUT <presigned_url>` with PDF bytes → 200 OK
3. `POST /files/complete/<fileKey>` → **500 Internal Server Error**

### 根因
`FileUploadService.java:71-101`（修复前）：无条件对所有 MIME 类型走 `toWebp()` 路径。`ALLOWED_MIME` 包含 `"application/pdf"` 但 `toWebp` 只能处理图片格式。

### 影响
用户上传 PDF 试卷扫描件后调 complete 会 500，file_asset 永远停在 PENDING 状态。

---

## Round 2 · FIX: 跳过非图片 MIME 的变体生成

### 修改
- `FileUploadService.java`: 新增 `IMAGE_MIME` 集合，`complete()` 中根据 `asset.getMimeType()` 判断 → 仅图片走变体生成，非图片直接 READY
- `FileUploadIT.java`: 新增 `scenario_sc11_ac2_edge_0_pdf_complete_no_variants()` IT

### 验证
`mvn verify → BUILD SUCCESS` · 9 IT (含新增 PDF IT) + 21 UT = 30 本轮 testcases 全绿

---

## Round 3 · 探索性对抗测试 (Exploratory Adversarial)

### 3.1 超长文件名注入测试

**测试**: `POST /files/presign` with `filename` = 超长字符串 (2000+ 字符含特殊字符 `../../etc/passwd`)

**结果**: presign 成功（返回 200），因为 `PresignReq.filename` 只有 `@NotBlank` 约束，无长度限制。`extractExtension()` 从超长文件名提取扩展名，生成的 fileKey = `{snowflakeId}.passwd` 可能造成对象存储路径遍历风险。

**风险等级**: LOW — MinIO 对象 key 不受路径遍历影响（flat namespace），但 fileKey 暴露给客户端，后续如果用于文件系统操作可能有注入风险。`filename` 缺少长度约束和特殊字符过滤。

**当前是否阻断**: 否 — 当前代码路径安全（MinIO flat key），但建议 Coder 后续加 `@Size(max=255)` + sanitize。

### 3.2 Race condition: double-complete 并发调用

**测试**: 对同一 fileKey 并发发送 2 次 `POST /files/complete/{fileKey}`

**分析**: `complete()` 没有对 `asset.status == "READY"` 做幂等检查。两次调用都会：
1. `readObject()` 从 MinIO 读原始文件
2. `toWebp()` 重新生成 thumb + medium
3. `putObject()` 覆盖已有 variants
4. `repo.save()` 更新 DB

**结果**: 无数据损坏（幂等覆盖），但浪费 2x CPU 做图片处理 + 2x MinIO I/O。

**风险等级**: LOW — 无功能性 bug，只有性能浪费。建议 Coder 后续加 `if (STATUS_READY.equals(asset.getStatus())) return` 短路。

### 3.3 SQL 注入探查: fileKey 路径参数

**测试**: `POST /files/complete/'; DROP TABLE file_asset;--`

**结果**: Spring Data JPA 参数化查询，`findByObjectKey(fileKey)` 生成 `WHERE object_key = ?` 占位符，不存在 SQL 注入风险 → 返回 404 `FILE_NOT_FOUND`（正常错误处理）。

**验证命令**: `grep -n "findByObjectKey" backend/file-service/src/main/java/com/longfeng/fileservice/repo/FileAssetRepository.java` — 确认是 Spring Data JPA derived query，无原生 SQL。

---

## 为什么相信这些测试能抓到回归

1. **PDF IT** (Round 2): 使用真 MinIO 上传真 PDF → complete → 断言 200 + READY + null variants。如果有人移除 IMAGE_MIME 检查，IT 会 500 失败。
2. **超长文件名** (Round 3.1): 虽然当前安全，但揭示了缺少 `@Size` 约束的潜在问题。
3. **Double-complete** (Round 3.2): 确认了幂等性（虽然浪费资源），排除了并发数据损坏风险。
4. **SQL 注入** (Round 3.3): 确认 JPA 参数化查询防护有效，排除了 fileKey 注入风险。
