# Tester Work Log · PHASE-A-WRONGBOOK · team-2 · attempt-1

## 1. Physical Verification

### Command
```
cd backend && mvn verify -pl wrongbook-service -am
```

### Result
```
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0 -- in com.longfeng.wrongbook.ApplicationTests (surefire)
[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0 -- in com.longfeng.wrongbook.WrongbookServiceIT (failsafe)
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0 -- in com.longfeng.wrongbook.WrongbookAdversarialIT (failsafe)
[INFO] BUILD SUCCESS
Total time: 21.967 s
```

### Testcase count: 12
| Suite | Class | Tests |
|-------|-------|------:|
| surefire | ApplicationTests | 1 |
| failsafe | WrongbookServiceIT | 7 |
| failsafe | WrongbookAdversarialIT | 4 |
| **Total** | | **12** |

## 2. Test Coverage Summary

### Coder IT (WrongbookServiceIT · 7 tests)
| # | Test | Endpoint | Assertion |
|---|------|----------|-----------|
| 1 | createQuestion | POST /api/wb/questions | HTTP 201 + qid + DB row count |
| 2 | getDetail | GET /api/wb/questions/{qid} | plain JSON question.qid + subject + status=0 |
| 3 | patchQuestion | PATCH /api/wb/questions/{qid} | stem_text contains x^2 + difficulty=2 |
| 4 | saveQuestion | POST /api/wb/questions/{qid}/save | status=3 CONFIRMED + DB verify |
| 5 | listQuestions | GET /api/wb/questions | total≥1 + items array |
| 6 | archiveQuestion | POST /api/wb/questions/{qid}/archive | status=8 ARCHIVED + idempotent 2nd call + DB verify |
| 7 | healthProbes | GET /ready + /live | HTTP 200 |

### Tester adversarial IT (WrongbookAdversarialIT · 4 tests)
| # | Test | Endpoint | Assertion |
|---|------|----------|-----------|
| ADV-1 | createWithoutIdempotencyKey | POST /api/wb/questions (no idem key) | non-2xx error |
| ADV-2 | getDetailInvalidQid | GET /api/wb/questions/abc | non-2xx error |
| ADV-3 | getDetailNonExistent | GET /api/wb/questions/99999999999 | non-2xx error |
| ADV-4 | createIdempotencyReplay | POST /api/wb/questions (same key x2) | same qid + 1 DB row |

## 3. Spec Alignment Verification

### A02 §2 SC-01 6 endpoints
| # | Spec endpoint | Controller method | IT coverage |
|---|--------------|-------------------|-------------|
| 1 | POST /api/wb/questions | QuestionDetailController.create() | WrongbookServiceIT#1 + AdversarialIT#1,#4 |
| 2 | GET /api/wb/questions/{qid} | QuestionDetailController.get() | WrongbookServiceIT#2 + AdversarialIT#2,#3 |
| 3 | PATCH /api/wb/questions/{qid} | QuestionDetailController.patch() | WrongbookServiceIT#3 |
| 4 | POST /api/wb/questions/{qid}/save | QuestionDetailController.save() | WrongbookServiceIT#4 |
| 5 | GET /api/wb/questions | QuestionDetailController.list() | WrongbookServiceIT#5 |
| 6 | POST /api/wb/questions/{qid}/archive | QuestionDetailController.archive() | WrongbookServiceIT#6 |

### Sandbox verification
- PG: jdbc:postgresql://127.0.0.1:15433/wrongbook (PostgreSQL 15.17)
- Flyway: V1.0.001 wrongbook_service_tables applied
- No H2/embedded/mock — real PG via DynamicPropertySource

## 4. Test Reports Archived
- `test-reports/failsafe-xml/TEST-com.longfeng.wrongbook.WrongbookServiceIT.xml` (7 testcase)
- `test-reports/failsafe-xml/TEST-com.longfeng.wrongbook.WrongbookAdversarialIT.xml` (4 testcase)
- `test-reports/failsafe-xml/failsafe-summary.xml`
- `test-reports/surefire-xml/TEST-com.longfeng.wrongbook.ApplicationTests.xml` (1 testcase)

## 5. Verdict

PASS — 12 testcases (7 happy-path + 4 adversarial + 1 UT) all green against sandbox PG:15433. BUILD SUCCESS. 1 adversarial REJECT round (missing error-path coverage) → fixed by adding WrongbookAdversarialIT.
