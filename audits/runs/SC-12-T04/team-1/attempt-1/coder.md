# SC-12-T04 · Coder Work Log · attempt-1

**Task**: SC-12 真页 backend 第 4/N 片 · POST /api/anon/file/presign 端点 + anonymous-service 加 Minio 客户端基础设施
**Branch**: claude/nifty-kepler-3deb2c · **Worktree**: /Users/allen/workspace/longfeng/.claude/worktrees/nifty-kepler-3deb2c
**Commits**: 4f53e58 / fcec890 / 8ac2062 (all `git cat-file -e` verified)

## 1. 地形侦察

读完以下规范 + 标杆模板后才动手 (CLAUDE.md AI Agent 启动纪律 + coder-agent.md step 1-3 "地形侦察与标杆对齐"):

| 依据 | 路径 | 关键收获 |
| --- | --- | --- |
| inflight 任务 | `.harness/inflight/SC-12-T04.json` | 56 条 scope_in · 9 DoD · TestDesigner opt-out |
| Coder agent | `.harness/agents/coder-agent.md` | 全文 · 内化铁律 1-7 + 双脑回看 + Rule 6 budget |
| Tester agent | `.harness/agents/test-agent.md` | 全文 · 知道 DoR 4 项 + audit 卡口 + mock<=5 红线 |
| 项目铁律 | `CLAUDE.md` | 通用工程德行 12 · audit.js 5+2=7 dim |
| biz F03 | `biz/000_业务与技术解决方案_AI错题本.md` §2B.13 (read via inflight refs) | guest-tmp 临时桶 · 5min TTL · purpose=GUEST_CAPTURE |
| spec §5 #1 | `design/system/pages/P-GUEST-CAPTURE-guest-capture.spec.md` | req: filename/mime/size/sha256/purpose · resp: url/key/expiresIn=300 |
| **Minio 标杆 (reference template)** | `backend/file-service/src/main/java/com/longfeng/fileservice/config/MinioConfig.java` | @Bean MinioClient · endpoint + credentials builder |
| 同上 | `backend/file-service/src/main/java/com/longfeng/fileservice/config/StorageProperties.java` | prefix=file-service.storage · 7 字段 |
| 同上 | `backend/file-service/src/main/java/com/longfeng/fileservice/provider/MinioStorageProvider.java` | ensureBucket + Method.PUT + TimeUnit.SECONDS · 异常 best-effort 吞 (race) |
| 同上 | `backend/file-service/src/main/java/com/longfeng/fileservice/dto/PresignResp.java` | wire shape: upload_url / file_key / ttl_seconds + bucket |
| AnonFilter | `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/filter/AnonFilter.java` | T02 已落 · `/api/anon/**` 全拦 · 白名单 POST /api/anon/session · req.setAttribute(ATTR_GUEST_SESSION_ID) |
| 同类 controller | `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/controller/AnonSessionConsentController.java` | 标杆: attribute 读出 Long anonSessionId + 局部 @ExceptionHandler 不全局 |
| 同类 IT | `backend/anonymous-service/src/test/java/com/longfeng/anonymousservice/SC12T02AnonConsentE2EIT.java` | Helpers (mint / patch) + HttpClient + JdbcTemplate · 多 testcase 真后端 |
| IT base | `backend/anonymous-service/src/test/java/com/longfeng/anonymousservice/IntegrationTestBase.java` | PG @15432 + Redis @16379 dynamic properties |
| Minio sandbox 健康检查 | `curl -sI http://localhost:9000/minio/health/live` → 200 OK | sandbox up 复用 file-service 同实例 |

**关键决策**:
- prefix 用 `anon.storage` 而非 `file-service.storage` — 即便不在同 JVM 也物理隔离 (CLAUDE.md Rule 7 surface conflicts) · 防未来 monolith 合并冲突
- bean name 显式 `anonMinioClient` — 即便不在同 JVM 也 explicit qualifier · 同上理由
- IT bucket `guest-tmp-it` (override via @DynamicPropertySource) · 防污染 prod bucket 名

## 2. 编码

### 2.1 落盘文件 (全部新建 · 6 个 main + 1 个 test)

| 文件 (绝对路径) | 行数 | 描述 |
| --- | --- | --- |
| backend/anonymous-service/pom.xml | +5 | minio.version=8.5.9 property + io.minio:minio dep |
| backend/anonymous-service/src/main/resources/application.yml | +15 | anon.storage.* 7 字段 + 注释 |
| backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/config/AnonStorageProperties.java | 53 | @ConfigurationProperties(prefix='anon.storage') · 7 字段 · 沿 file-service StorageProperties pattern |
| backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/config/AnonMinioConfig.java | 24 | @Bean name='anonMinioClient' · endpoint+credentials builder |
| backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/service/AnonPresignService.java | 138 | mintPresignedPut + sanitiseExt + ensureBucket + 2 RuntimeException 子类 + PresignResult record |
| backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/controller/AnonPresignController.java | 102 | POST /api/anon/file/presign · 4 error path (400/401/413/415) · 局部 @ExceptionHandler |
| backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/dto/AnonPresignRequest.java | 30 | record + jakarta-validation @NotBlank/@Pattern/@Min/@Max/@Size |
| backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/dto/AnonPresignResponse.java | 17 | record + @JsonProperty snake_case · 与 file-service PresignResp wire 一致 |
| backend/anonymous-service/src/test/java/com/longfeng/anonymousservice/SC12T04AnonPresignE2EIT.java | 329 | 8 IT testcases · 真 Minio round-trip |

### 2.2 commit hash 真实性证据 (git cat-file -e 全过)

```
4f53e58  chore(SC-12-T04 backend): pom.xml +io.minio:minio 8.5.9 + application.yml anon.storage.*
fcec890  feat(SC-12-T04 backend): AnonStorageProperties + AnonMinioConfig + AnonPresignService + AnonPresignController + DTOs
8ac2062  test(SC-12-T04): SC12T04AnonPresignE2EIT 8 testcase 全绿 + application.yml anon.* 合并 (修 yaml duplicate key) + regression 53 IT 仍绿
```

## 3. 真实 E2E

**红线**: backend-only task · 无前端 e2e · "真 E2E" 在本 task 等于 "真 Spring Boot + 真 PG + 真 Redis + 真 Minio IT" · 不是 mock IT.

### 3.1 IT 跑通真证据

```
$ cd backend/anonymous-service && mvn verify -Dit.test=SC12T04AnonPresignE2EIT
...
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 23.69 s -- in com.longfeng.anonymousservice.SC12T04AnonPresignE2EIT
[INFO] BUILD SUCCESS
```

**Full regression**:
```
$ cd backend/anonymous-service && mvn verify
[INFO] Tests run: 53, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS · Total time: 41.585 s
```

53 = 45 prior (SC-12-T01 + T02 / SC-13 / SC-13-SHARER / SC-00 / SC-11 / skeleton) + 8 new SC-12-T04. 无回归.

### 3.2 真证据落盘

- `test-reports/TEST-com.longfeng.anonymousservice.SC12T04AnonPresignE2EIT.xml` (JUnit XML · 8 testcase)
- `test-reports/com.longfeng.anonymousservice.SC12T04AnonPresignE2EIT.txt` (raw stdout)
- IT 真把 1024 byte 二进制 PUT 到 Minio · StatObject 真验 size=1024 · GetObject 真读回字节级相等 (case b) — 不是 synthetic URL

### 3.3 spec trace 对照表 (DoR-4)

| spec §5 #1 / biz §2B.13 F03 子项 | IT testcase 覆盖 | 行级 anchor |
| --- | --- | --- |
| POST /api/anon/file/presign + X-Anon-Token + req {filename, mime, size, sha256_hash?, purpose:'GUEST_CAPTURE'} | (a) presign_with_valid_token_returns_200_and_url | L92-107 |
| 200 resp wire {upload_url, file_key, ttl_seconds:300, bucket} | (a) | L97-106 |
| 真 PUT 上传到 presigned URL → Minio 接收 | (b) presign_then_put_to_url_succeeds_end_to_end | L113-149 |
| 401 ANON_TOKEN_INVALID (AnonFilter 拦) | (c) presign_without_x_anon_token_returns_401 | L154-164 |
| 400 VALIDATION_FAILED mime not in {jpeg, png} | (d) presign_with_unsupported_mime_returns_400 | L169-179 |
| 400 VALIDATION_FAILED size > 10MiB | (e) presign_with_file_too_large_returns_400 | L184-194 |
| objectKey prefix = guest-tmp/{anonSessionId}/ (越权防御) | (f) presign_object_key_uses_anon_session_id_prefix | L199-220 |
| TTL=300s 严格 (body + URL signature) | (g) presign_ttl_is_300_seconds_strict | L225-241 |
| Path-traversal sanitisation (探索性) | (h) presign_filename_with_path_traversal_sanitized | L249-272 |

| AnonFilter (T02 已落) 行为 | IT 覆盖 |
| --- | --- |
| `/api/anon/**` 拦截 · 无 X-Anon-Token → 401 | (c) |
| 验证成功后 req.setAttribute(ATTR_GUEST_SESSION_ID) | (a) (b) (f) (g) (h) 都隐式依赖 (200 OK + 真用 sessionId 入 objectKey 等于断言 attribute 真注入) |
| 白名单 POST /api/anon/session | 既有 SC12T02IT (h) 覆盖 · 无回归 |

### 3.4 4 状态截图

**N/A** · backend-only task · 无前端页面渲染 · DoR-3 不适用 (per inflight.physical_verification.frontend_e2e = null)

## 4. 自检

| 检查项 | 状态 | 证据 |
| --- | --- | --- |
| coder-agent.md 全文已读 | ✓ | 双脑回看 § 启动纪律 + Rule 6 budget |
| test-agent.md 全文已读 | ✓ | 知道 DoR 4 项 + mock<=5 红线 + 1 轮 REJECT |
| CLAUDE.md 12 工程德行已内化 | ✓ | Rule 3 Surgical (无 adjacent cleanup) · Rule 8 read before write (grep file-service 标杆) · Rule 9 tests verify intent (每个 testcase 注释 WHY) · Rule 11 conventions (沿 SC12T02IT helpers / AnonSessionConsentController 模板) · Rule 12 fail loud (yaml duplicate 立刻 surface 修不绕) |
| mvn clean compile 0 error | ✓ | 48 source files BUILD SUCCESS |
| mvn test-compile 0 error | ✓ | 9 test sources BUILD SUCCESS |
| mvn verify SC12T04IT 全绿 | ✓ | 8/8 PASS · 23.69 s |
| mvn verify full suite 0 regression | ✓ | 53/53 PASS · 41.58 s |
| AnonFilter T02 不动 | ✓ | git diff 仅 main/resources + main/java 新文件 + 1 个 yaml 合并 |
| SC-13 / SC-13-SHARER / SC-00 / SC-11 不动 | ✓ | git diff 全在 SC-12-T04 范围内 |
| prefix 隔离 (anon.storage vs file-service.storage) | ✓ | grep "file-service.storage" backend/anonymous-service 0 命中 |
| bean name explicit 'anonMinioClient' | ✓ | AnonMinioConfig.java L19 + AnonPresignService.java L60 @Qualifier |
| objectKey 防越权 (sessionId prefix) | ✓ | IT case (f) · A 的 key 决不含 B 的 prefix |
| TTL 严格 300 (body + URL) | ✓ | IT case (g) · X-Amz-Expires=300 query string assert |
| sanitiseExt 防 path-traversal | ✓ | IT case (h) · ext 仅 [a-z0-9]{1,4} 否则 .bin |
| Rule 6 tool budget | ✓ | self-checkpoint @ tool 36 远低于软线 50 |

**反省**: 第一次跑 IT 时 8 个 ApplicationContext 加载全爆 · YAML duplicate key `anon:` (因新加的 anon.storage 被我放成 yml 文件末尾另一个 anon: 而非合入既有 anon: 下) → 立刻 Edit 修 · 二次跑 8/8 PASS · 这正符合 Rule 12 fail loud (而不是 catch 静默) · bugs-found.md 已记 (Bug #1).

## 5. 提交

3 commits 已落:
- `4f53e58` chore: pom.xml + application.yml (step 1/4)
- `fcec890` feat: 4 main files + 2 DTOs (step 2/4)
- `8ac2062` test: 1 IT + yaml fix (step 3/4)

第 4 个 commit (work_log + audit-verdict + inflight finalize) 在 audit.js PASS 后由 Tester / TL 后续 commit.

`dev_done=true` 即将 set · 移交 Tester DoR 准入.
