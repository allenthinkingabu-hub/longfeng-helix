# Tester Work Log · PHASE-A-FILE · team-1 · attempt-1

## 1. 验证环境

- **Sandbox containers**: team-1-pg (15432), team-1-minio (9000), team-1-redis (16379) — all healthy
- **命令**: `cd backend/file-service && mvn verify -Dmaven.test.failure.ignore=false`
- **JDK**: OpenJDK 17.0.13
- **验证时间**: 2026-05-14T23:47+04:00

## 2. 测试结果

### Failsafe IT (integration-test + verify)

| 测试类 | testcase 数 | 结果 |
|---|---|---|
| FileUploadIT | 7 | PASS |
| PresignRealPgIT | 1 | PASS |
| BackendChainIT | 1 | PASS |
| **合计** | **9** | **ALL PASS** |

### Surefire UT (unit tests)

| 测试类 | testcase 数 | 结果 |
|---|---|---|
| PresignControllerTest | 13 | PASS |
| PresignControllerWebMvcTest | 8 | PASS |
| **合计** | **21** | **ALL PASS** |

**总计: 30 testcases passed (9 IT + 21 UT), 0 failures, 0 errors, 0 skipped**

`BUILD SUCCESS` — 见 `test-reports/tester/verify.log`

### testcase 数对照

- failsafe XML `<testcase>` 实际数: BackendChainIT=1 + FileUploadIT=7 + PresignRealPgIT=1 = **9**
- surefire XML `<testcase>` 实际数: PresignControllerTest=13 + PresignControllerWebMvcTest=8 = **21**
- 本文声称: **9 IT + 21 UT = 30** (一致)

## 3. 代码审查要点

### Sandbox 合规 (audit dim5)
- IntegrationTestBase: PG `jdbc:postgresql://127.0.0.1:15432/wrongbook` user=longfeng ✓
- MinIO `http://127.0.0.1:9000` user=minioadmin ✓
- Redis `127.0.0.1:16379` ✓
- 无 H2 / embedded DB / mock 后端 ✓
- `pom.xml` 无 H2 dependency ✓

### Mock 计数 (audit dim2 · ≤5)
- IT 测试文件中无 `vi.mock` / `page.route` / `jest.mock` / `wx.request.mock`
- UT 中 Mockito 用于 PresignControllerTest + WebMvcTest (这是单元测试，不是 IT，合规)
- IT mock 总计: **0** (≤5 阈值 ✓)

### Failsafe 配置
- `maven-failsafe-plugin` 配置 integration-test + verify goals ✓
- `maven-compiler-plugin` testExcludes `combine.self="override"` 允许 IT 编译 ✓
- Surefire 只跑 `*Test.java` / `*Tests.java` / `*UT.java`，IT 由 failsafe 跑 ✓

## 4. 对抗测试摘要

见 `adversarial.md` — 1 轮 REJECT (PDF complete 500 crash) + 1 轮 fix (跳过非图片 MIME 的变体生成)

## 5. 测试报告归档

```
test-reports/
├── tester/
│   ├── verify.log                              (完整 mvn verify 输出)
│   ├── failsafe-xml/
│   │   ├── TEST-com.longfeng.fileservice.BackendChainIT.xml
│   │   ├── TEST-com.longfeng.fileservice.FileUploadIT.xml
│   │   ├── TEST-com.longfeng.fileservice.controller.PresignRealPgIT.xml
│   │   └── failsafe-summary.xml
│   └── surefire-xml/
│       ├── TEST-com.longfeng.fileservice.controller.PresignControllerTest.xml
│       └── TEST-com.longfeng.fileservice.controller.PresignControllerWebMvcTest.xml
└── e2e/coder/backend-it/                       (Coder 原始报告)
    ├── verify.log
    └── failsafe-xml/
        ├── TEST-com.longfeng.fileservice.BackendChainIT.xml
        ├── TEST-com.longfeng.fileservice.FileUploadIT.xml
        └── TEST-com.longfeng.fileservice.controller.PresignRealPgIT.xml
```
