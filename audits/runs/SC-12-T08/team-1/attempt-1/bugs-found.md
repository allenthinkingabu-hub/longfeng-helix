# Bugs Found · SC-12-T08 · attempt-1

## Bug 1 · IT first run 把跨 service 校验写到 `wb_question` 表 → 2 case FAIL

- **现象**: 第一次 `mvn verify` (commit 还没落) · IT 案 (a) 在 cross-service
  assert 步骤拿到 `EmptyResultDataAccessException: Incorrect result size:
  expected 1, actual 0` · 案 (c) baseline 断言 `wb_question count == 1` 失败
  得到 0.
- **复现**:
  ```
  cd backend/anonymous-service
  mvn -q verify -Dit.test='SC12T08AnonClaimE2EIT' -Dsurefire.skip=true
  ```
- **根因 (Coder 侧 IT bug · 非生产代码 bug)**: 我先按 inflight `api_contracts_in_scope`
  注释里"wb_question 表"字面假设了表名 + 列名 (owner_id / subject_code). 实地
  探 wrongbook 后发现 wrongbook-service 实际写到 `wrong_item` 表 (该表的列名
  是 student_id / subject / source_type / origin_image_key / idempotency_key).
  `wb_question` 是 sibling DDL 表存在但 wrongbook 不写入. 这是 wrongbook-side
  历史命名 drift (API 概念 = wb_question/qid · 持久化 = wrong_item).
- **修复**: 修 IT (SC12T08AnonClaimE2EIT + SC12T08AnonClaimDownE2EIT) 的
  cleanup + cross-service assert 全部改 `wrong_item` + `student_id` + `subject`.
  - 增 `DELETE FROM idem_key WHERE scope='wb:create' AND idem_key LIKE 'anon-claim-%'`
    清 idempotency 痕 · 防 re-run 拿到 cached qid.
  - 增 case (a) 拿 wrong_item.source_type/origin_image_key/subject 全列断言 ·
    proof body 跨 wire (Tester 探索性思路 · pre-empt 一波抓 subject silent-drop
    回归).
- **修复 commit**: 嵌入 commit `08dd301` (修复在跑 mvn 前就已经在文件里 ·
  attempt-1 commit 1 即为修复后的版本 · 不单独一个 fix commit).
- **物理验证**:
  ```
  Tests run: 7, Failures: 0, Errors: 0, Skipped: 0
   -- in com.longfeng.anonymousservice.SC12T08AnonClaimE2EIT
  Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
   -- in com.longfeng.anonymousservice.SC12T08AnonClaimDownE2EIT
  ```
- **影响范围**: 仅 IT 测试代码 · 生产 AnonClaimService / Controller / DTO 不动 ·
  不影响其它 task.

## Bug 2 · 上游 wrongbook qid 是 numeric String 需 parseLong (设计预期 · 已守)

- **现象**: 不是 bug · 是设计预期. wrongbook 上游 CreateQuestionResp.qid 是
  String 字段 (snowflake-generated BIGINT 序列化为 JSON 字符串 · 防 JS Number
  精度损失). anonymous-service 的 GuestSession.claimedQuestionId 是 Long PK.
- **守护**: AnonClaimService.claim 用 `Long.parseLong(qid)` 强转, 失败 →
  log.error + 502 WRONGBOOK_SERVICE_FAILURE (Rule 12 Fail loud · 不静默吞).
- **未来风险 P1**: 若 wrongbook 真把 qid 改成 UUID/非 numeric · anonymous-service
  必须改 GuestSession.claimedQuestionId 为 String + 改 DDL (大改). 本 task P0
  假定 qid 仍 numeric (实地探测 = 18 位数字 snowflake).

## Bug 3 · `0 bug` 部分 (本 task 生产代码本身)

生产代码 (新建 AnonClaimService + Controller + DTO + Properties + yml) 本身 ·
**0 bug**. 7 IT 全绿 · 跨 service 真转发实测 · 502 路径实测 · 幂等实测 ·
冲突实测.
