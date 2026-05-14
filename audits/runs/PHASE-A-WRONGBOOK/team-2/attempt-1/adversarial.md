# Adversarial Log · PHASE-A-WRONGBOOK · team-2 · attempt-1

## Round 1 · REJECT · Missing error-path + idempotency replay IT coverage

### Issue
Coder's `WrongbookServiceIT` covers only the happy path (7 tests: create → detail → patch → save → list → archive → health). Zero error-path or edge-case tests exist:

1. **No test for missing idempotency key**: Controller explicitly throws `BusinessException(ErrCode.VALIDATION_FAILED)` when all three sources (header `X-Idempotency-Key`, `X-Request-Id`, body `idempotency_key`) are null/blank — but this code path is never exercised in IT.
2. **No test for invalid qid format**: `QuestionAggregateService.parseId()` throws `BusinessException` for non-numeric qid strings — never tested.
3. **No test for non-existent qid**: `WrongItemService.getById()` throws `BusinessException(RESOURCE_NOT_FOUND)` — never tested in IT.
4. **No idempotency replay test**: A02 spec §2 row 1 documents "幂等键三级优先" as a core contract. IT test #1 creates with a unique key each time but never verifies that replaying the same key returns the same qid without creating a duplicate DB row.

### Impact
These gaps mean the error handling and idempotency contract — both critical for production reliability — have zero IT validation. A regression in `parseId()`, `BusinessException` mapping, or `IdempotencyService.peek()` would ship undetected.

### Evidence
```
grep -rn "BusinessException" WrongbookServiceIT.java → 0 hits
grep -rn "idempotent" WrongbookServiceIT.java → found only in @DisplayName comment for archive, not a true idempotency key replay test
```

### Required Fix
Add adversarial IT tests covering:
- ADV-1: POST without any idempotency key → non-2xx response
- ADV-2: GET with non-numeric qid "abc" → non-2xx response
- ADV-3: GET with non-existent numeric qid → non-2xx response
- ADV-4: POST twice with same idempotency key → same qid, single DB row

---

## Round 2 · FIX · Tester writes WrongbookAdversarialIT.java

### Action
Created `backend/wrongbook-service/src/test/java/com/longfeng/wrongbook/WrongbookAdversarialIT.java` with 4 test methods covering all 4 gaps identified in Round 1.

### Re-run result
```
mvn verify -pl wrongbook-service -am
Tests run: 11 (failsafe), Failures: 0, Errors: 0, Skipped: 0
Tests run: 1 (surefire), Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

All 4 adversarial tests PASS — error paths return non-2xx as expected, idempotency replay returns same qid with single DB row.

### Why I believe these tests catch regressions
- ADV-1 will fail if someone removes the idempotency key validation guard in `QuestionDetailController.create()` L43-46
- ADV-2 will fail if `parseId()` silently swallows `NumberFormatException` instead of throwing `BusinessException`
- ADV-3 will fail if `WrongItemService.getById()` returns a default object instead of throwing `RESOURCE_NOT_FOUND`
- ADV-4 will fail if `IdempotencyService.peek()` or `tryClaim()` logic is broken, causing duplicate creates
