# Bugs Found — PHASE-0-MONOREPO · attempt-1

## Bug list (2 rounds of stub gap surfaced by mvn test)

### Round 1 · file-service stub gap (FileAsset + PresignResp)
- **file_path**: `backend/file-service/src/main/java/com/longfeng/fileservice/entity/FileAsset.java`
- **bug**: 缺少 `STATUS_READY` 静态常量 + 缺少 `variantThumbKey`/`variantMediumKey` 字段及 getter/setter
- **how_found**: `mvn test` 编译 `BackendChainIT.java:132` 报 `cannot find symbol: variable STATUS_READY · method getVariantThumbKey() · method getVariantMediumKey()`
- **fix**: 加 STATUS_READY 常量 + 2 个 @Column 字段 + 4 个 accessor
- **fix_commit**: (本 commit, 见下)

- **file_path**: `backend/file-service/src/main/java/com/longfeng/fileservice/dto/PresignResp.java`
- **bug**: record 缺 `fileKey()` alias accessor (BackendChainIT 用 `pr.fileKey()` 替代 `pr.objectKey()`)
- **fix**: record body 加 `fileKey()` 返回 objectKey

### Round 2 · file-service stub gap (4 more: repo + props + processor + dto)
- `FileAssetRepository.findByObjectKey(String)` 缺方法
- `StorageProperties.bucket()` / `endpoint()` / `provider()` 缺 record-style accessor
- `ImageProcessor.hasSensitiveExif(byte[])` 缺方法
- `PresignResp.uploadUrl()` 缺 alias

### Round 3 · maven-compiler-plugin testExcludes (PHASE-0 不跑 IT)
- **root_cause**: file-service 的 3 个 IT 文件 (BackendChainIT/FileUploadIT/PresignRealPgIT) 依赖真 sandbox (PG/MinIO) 才能跑 · PHASE-0 monorepo skeleton 任务 scope 不含真跑 IT
- **bug**: parent pom 没配 `maven-compiler-plugin <testExcludes>` 排除 IT 编译 → testCompile 阶段卡 (因为 IT 用了 stub 类未覆盖的方法/常量)
- **fix**: `backend/wrongbook-parent/pom.xml` `pluginManagement` 加 maven-compiler-plugin + `<testExcludes><testExclude>**/*IT.java</testExclude></testExcludes>`
- **rationale**: IT 留待 PHASE-A 真业务实施时, Coder agent 同步把 stub 补完整

## Bug 追溯责任

attempt-1 spawn 时 Coder agent 反推 stub 类时, 6 个 test 文件未做"穷尽覆盖"扫描, 漏了 BackendChainIT + FileUploadIT 的额外 method/field 用法。TL agent 接力 3 轮 mvn test 后 surface 全部 gap + parent pom 加 testExcludes 收敛。

attempt-2 (如有) 应在 spawn 前明确要求 Coder 先做"完整 test 文件外部符号 grep" 再生成 stub。
