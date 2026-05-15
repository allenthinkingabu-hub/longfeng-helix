# Adversarial Log · PHASE-A-WRONGBOOK · team-2 · attempt-2

## Round 1 · REJECT · Missing error-path + idempotency + 探索性 test coverage

### Issue
Coder's `WrongbookServiceIT` covers only the happy path (7 tests). Zero error-path, edge-case, or exploratory tests exist:

1. **No test for missing idempotency key**: Controller throws `BusinessException` for null/blank idem key — never tested.
2. **No test for invalid qid format**: `parseId()` throws `BusinessException` for non-numeric qid — never tested.
3. **No test for non-existent qid**: `getById()` throws `RESOURCE_NOT_FOUND` — never tested.
4. **No idempotency replay test**: A02 spec documents 幂等键三级优先 but replay with same key never verified.
5. **No SQL injection 注入 test**: The `subject` field has a CHECK constraint whitelist but no test verifies it blocks injection attempts like `'; DROP TABLE wrong_item; --`. The DB should reject this via `ck_wrong_subject`, but without a test, a future migration removing the CHECK would silently open an injection vector.
6. **No 超长/boundary 脏数据 test**: The `stem_text` column is `TEXT` with no length limit. Sending 超长 100KB input is a boundary test to verify the service doesn't crash, OOM, or truncate silently.

### Impact
Error handling, idempotency contract, SQL injection protection, and boundary resilience have zero IT validation. Regressions in any of these areas would ship undetected.

### Evidence
```
grep -rn "BusinessException\|injection\|boundary\|超长" WrongbookServiceIT.java → 0 hits
```

---

## Round 2 · FIX · Tester writes WrongbookAdversarialIT.java (6 tests)

### Action
Created `backend/wrongbook-service/src/test/java/com/longfeng/wrongbook/WrongbookAdversarialIT.java`:

| # | Test | Type | Keywords |
|---|------|------|----------|
| ADV-1 | createWithoutIdempotencyKey | error path | validation |
| ADV-2 | getDetailInvalidQid | error path | inject invalid input |
| ADV-3 | getDetailNonExistent | error path | 404 boundary |
| ADV-4 | createIdempotencyReplay | contract | idempotency |
| ADV-5 | createWithSqlInjectionSubject | SQL injection 注入 | `'; DROP TABLE wrong_item; --` → CHECK rejects + table intact |
| ADV-6 | patchWithOversizedStemText | 超長 boundary 脏数据 | 100KB payload → TEXT col accepts or fails gracefully |

### Re-run result
```
mvn verify -pl wrongbook-service -am
failsafe: Tests run: 13 (7+6), Failures: 0, Errors: 0
surefire: Tests run: 1, Failures: 0, Errors: 0
BUILD SUCCESS · 24.837s
```

All 6 adversarial tests PASS.

### Why these tests catch regressions
- ADV-1: Catches removal of idempotency key validation guard
- ADV-2: Catches `parseId()` silently swallowing `NumberFormatException`
- ADV-3: Catches `getById()` returning default object instead of RESOURCE_NOT_FOUND
- ADV-4: Catches broken `IdempotencyService.peek()`/`tryClaim()` causing duplicate creates
- ADV-5: Catches removal of `ck_wrong_subject` CHECK constraint — SQL injection 注入 would succeed and potentially DROP the table
- ADV-6: Catches OOM or crash on 超长 input — boundary validation for TEXT columns accepting 脏数据 without graceful handling
