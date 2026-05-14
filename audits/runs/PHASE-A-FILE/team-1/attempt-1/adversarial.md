# Adversarial Log · PHASE-A-FILE · team-1 · attempt-1

## Round 1 · REJECT: `complete()` crashes on PDF uploads (500 Internal Server Error)

### Bug 描述
`FileUploadService.complete()` 对所有 MIME 类型（包括 `application/pdf`）执行图片变体生成（WebP thumbnail + medium），但 `ImageIO.read()` 无法解析 PDF → 返回 `null` → `Thumbnails.of(null)` 抛 `IllegalArgumentException` → 被 catch 包装为 `RuntimeException("Image processing failed")` → Spring 返回 500。

### 复现路径
1. `POST /files/presign` body: `{"filename":"doc.pdf","mime":"application/pdf","size":4096}` → 200 OK（presign 成功）
2. `PUT <presigned_url>` with PDF bytes → 200 OK（上传成功）
3. `POST /files/complete/<fileKey>` → **500 Internal Server Error**

### 根因
`FileUploadService.java:71-101`（修复前）：
```java
public CompleteResp complete(String fileKey) {
    // ... 无论 MIME 是什么，都走 readObject → toWebp 路径
    byte[] original;
    try (InputStream is = storage.readObject(...)) { original = is.readAllBytes(); }
    try {
        byte[] thumbBytes = toWebp(original, 150, 150);  // ← PDF 在此 NPE
        ...
    }
}
```

`ALLOWED_MIME` 包含 `"application/pdf"`（line 32），presign 允许 PDF，但 complete 无条件做图片处理。

### 影响
- 用户上传 PDF 后调 complete 会 500，file_asset 永远停在 PENDING 状态
- 符合业务场景：错题本系统允许上传 PDF 试卷扫描件

### 期望
非图片 MIME（如 `application/pdf`）的 complete 应跳过变体生成，直接标记 READY。

---

## Round 2 · FIX: 跳过非图片 MIME 的变体生成

### 修改文件
`backend/file-service/src/main/java/com/longfeng/fileservice/service/FileUploadService.java`

### 修改内容
1. 新增 `IMAGE_MIME` 集合：`Set.of("image/jpeg", "image/png", "image/heic", "image/webp")`
2. `complete()` 中根据 `asset.getMimeType()` 判断是否为图片
3. 仅图片走 readObject → toWebp → putObject 变体生成
4. 非图片直接 `setStatus(READY)` + `save()`，variant keys 为 null

### 新增 IT 测试
`FileUploadIT.scenario_sc11_ac2_edge_0_pdf_complete_no_variants()`
- presign PDF → PUT to MinIO → complete → assert 200 OK, status=READY, variants=null
- 验证 DB: `file_asset.status = READY`, `variant_thumb_key = null`, `variant_medium_key = null`

### 验证结果
```
mvn verify → BUILD SUCCESS
Tests run: 9, Failures: 0, Errors: 0, Skipped: 0  (IT)
Tests run: 21, Failures: 0, Errors: 0, Skipped: 0 (UT)
```

新增 PDF IT 通过 ✓，原有 8 IT 全绿 ✓，21 UT 全绿 ✓

### 为什么相信这个测试能抓到回归
该 IT 使用真 MinIO（sandbox:9000）上传真实 PDF 字节，调用真 `/files/complete` 端点。如果未来有人移除了 IMAGE_MIME 检查或改了 complete 逻辑让非图片走 toWebp，这个 IT 会因 500 响应码失败。测试编码了 "PDF complete 不应崩溃" 的业务意图，而非仅验证当前实现。
