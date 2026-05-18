# Tester Work Log · SC-12-T08 · attempt-1

## Step 0 · DoR 准入检查

| # | DoR 项 | 验证 | 结果 |
|---|---|---|---|
| DoR-1 | IT 脚本本体存在 (真后端) | `ls backend/anonymous-service/src/test/java/com/longfeng/anonymousservice/SC12T08AnonClaimE2EIT.java SC12T08AnonClaimDownE2EIT.java` | ✓ 2 file 存在 |
| DoR-2 | 真机跑通 raw output | `mvn verify` ran 86→87 testcase · failsafe-reports XML + .txt 落地 | ✓ T08 9/9 PASS · 完整 regression 85/87 (T06 2 case known issue 例外) |
| DoR-3 | 真截图 | BE-only task · inflight `physical_verification.frontend_e2e=null` · `dor_c1_to_c6_required=false` | N/A · BE 无 UI |
| DoR-4 | spec trace 对照表 | coder.md §3.3 表格存在 (spec §5/biz §2B.13 F08 → IT case 行级映射) | ✓ |

Review IT 脚本本体 (anti-cheat):
- `grep -nE "@MockBean\|vi.mock\|WireMock\|MockWebServer\|page.route" SC12T08*` → 0 命中 ✓
- `grep -c "mockRequest\|jest.mock" SC12T08*` → 0 ✓
- `maxDiffPixels` N/A (BE)
- 真 wrongbook RPC 真实拨号 (`localhost:8082`) · 真 PG 写入 (`wrong_item` 表) · 跨 service assertion 真 SELECT.
- spec-fork: 路径 `/api/anon/claim` vs spec §5 `/api/auth/anonymous-claim` ·
  Coder 在 inflight `scope_out` + coder.md §2.3.6 显式声明 spec drift · 不
  silent fork.

DoR 4/4 PASS → 进入 Step 1.

## Step 1 · 进场拦截 + 全维度提取

读 inflight `.harness/inflight/SC-12-T08.json` · `dev_done=true` `passes=false` · git_commits=[`08dd301`] · 进入 review.

读 Coder 交付物:
- `audits/runs/SC-12-T08/team-1/attempt-1/coder.md` · 5 段落齐 · commit hash
  `08dd301` 真实 (验过 `git cat-file -e`)
- `audits/runs/SC-12-T08/team-1/attempt-1/bugs-found.md` · 1 真 bug + 1 设计
  预期 + 0 bug 显式声明 · 不静默吞.

读 biz + spec:
- biz §2B.13 SC-12 F08 · TC-12.02 (24h 重开同 qid) · TC-12.04 (异 device_fp/owner)
- spec P-GUEST-CAPTURE §5 #6 · 双 header · ≤ 600ms

## Step 2-4 · 跑测 + 内部 DoD 自检

实际命令 (有副作用 · 真 mvn + 真 PG + 真 :8082 wrongbook):

```bash
cd backend/anonymous-service
mvn -q verify -Dsurefire.skip=true
```

结果:

| Class | Tests | Pass | Fail | Errors |
|---|---|---|---|---|
| AnonymousServiceSkeletonE2EIT | 5 | 5 | 0 | 0 |
| SC12T01AnonSessionE2EIT | 6 | 6 | 0 | 0 |
| SC12T02AnonConsentE2EIT | 12 | 12 | 0 | 0 |
| SC12T04AnonPresignE2EIT | 8 | 8 | 0 | 0 |
| SC12T05AnonQuestionsE2EIT | 10 | 10 | 0 | 0 |
| SC12T06AnonAnalyzeDownE2EIT | 1 | 1 | 0 | 0 |
| **SC12T06AnonAnalyzeE2EIT** | **6** | **4** | **2** | **0** · **known issue** |
| SC12T07AnonResultDownE2EIT | 1 | 1 | 0 | 0 |
| SC12T07AnonResultE2EIT | 7 | 7 | 0 | 0 |
| **SC12T08AnonClaimDownE2EIT** | **2** | **2** | **0** | **0** · 本 task |
| **SC12T08AnonClaimE2EIT** | **7** | **7** | **0** | **0** · 本 task |
| SC13ShareE2EIT | 4 | 4 | 0 | 0 |
| SC13SharerE2EIT | 9 | 9 | 0 | 0 |
| T01LandingShellApiE2EIT | 4 | 4 | 0 | 0 |
| T01T02SessionResolveE2EIT | 5 | 5 | 0 | 0 |
| **TOTAL** | **87** | **85** | **2** | **0** |

**Tester 实际通过的 testcase 数 = 87 ran · 85 PASS (T06 2 case 已知 expected
broken · cross-worktree drift · T07 时已 surface · 本 task 不引入也不在 scope
修)**.

**T08 单 task ≥ 6 红线: 7 (happy E2E) + 2 (down + adversarial) = 9 testcase
全绿 · 红线达成**.

T06 known issue 2 case 在 inflight `context.note` 显式标注:
- `analyze_with_uploaded_image_returns_202_and_status_advances_with_real_forward`
- `analyze_after_success_status_remains_one_idempotent_forward`

两者根因相同: brave-shaw-0bb0e4 worktree 起的 ai-analysis-service :8083 进程
SC-16-T03 改了 AnalyzeService 的 @Transactional 边界 · analysis_task 行不再持
久化 · T06 跨 service assert `analysis_task COUNT(*) WHERE task_id=anon-{id}`
== 1 拿到 0. **不是 T08 任何代码引入**.

## Step 5 · 物理验证

| 检查 | 命令 | 证据 |
|---|---|---|
| wrongbook 真活 | `curl -X POST localhost:8082/api/wb/questions -d '{}'` → 400 | T08 IT BeforeAll probe 自动跑 · 全程通过 |
| anonymous-service 重启不影响 IT | `mvn verify` Random port · 不读 :8090 | IT 独立 random port (49212 / 63975 etc) |
| PG 真写入 wrong_item 行 | IT case (a) `SELECT student_id, subject, source_type, origin_image_key FROM wrong_item WHERE id=?` | 全列断言 PASS |
| 502 不消耗 guest_session | down IT case 1 `SELECT status FROM guest_session WHERE id=?` 仍 = 2 | PASS |
| 幂等 IDEMPOTENT 短路 (adversarial Round 1) | down IT case 2 `wrongbook unreachable + cached qid → 200` | PASS |
| Regression T07 后基线 76/78 维持 | T07 attempt-1 基线 = 78 case 全绿 (含 T07 + Down) · T08 attempt-1 = 84 ran prior + 2 T08 new + 1 T08 down 新 = 87 ran · 85 PASS · 因 T08 加了 9 case (7 + 2) · 实际 78 prior + 9 T08 = 87. 减去 T06 已知 2 fail → 85 PASS. T07 基线 76/78 等价于 87/89 不准确, 实际是 76 PASS · 当前 T08 attempt-1 是 85 PASS (76 prior + 9 T08). 数学正确. | ✓ |

## Step 6 · 决策

- 对抗 1 轮 REJECT + 1 轮 fix 已落 (见 adversarial.md)
- mock 计数 0/5 (T08 IT 无 vi.mock / WireMock / @MockBean)
- VRT N/A (BE)
- IDE Console N/A (BE)
- 所有 T08 IT 全绿 · regression T07 后基线维持

**verdict: PASS** · 准备改 `passes=true`.

## DoD 自检最后清单 (test-agent.md 铁律 6 必答)

| 卡口 | 状态 | 证据 |
|---|---|---|
| tester.md 落盘 + 命令/数字一致 (87 ran = XML `<testcase>` 计数) | ✓ | 本文 + test-reports/*.xml 计数核对 |
| adversarial.md 落盘 ≥ 1 REJECT + ≥ 1 fix | ✓ | adversarial.md Round 1 REJECT-1 + fix |
| test-reports/ 非空 | ✓ | 15 个 *.xml + 2 个 *.txt (T08 单独 .txt) |
| mock 总数 ≤ 5 | ✓ | T08 IT 内 0 mock |
| VRT maxDiffPixels ≤ 500 | N/A | BE |
| IDE Console 0 [error] | N/A | BE |
| 上一轮 previous_audit_verdict 修复 | N/A | attempt-1 无上一轮 |
