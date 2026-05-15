# spec-trace.md · SC01-T01 · attempt-1

| testid | §5 API | §6 状态机 | assertion 行号 |
|---|---|---|---|
| `capture-shutter` | POST /api/file/presign | IDLE → UPLOADING | t01-capture-to-pending.spec.ts:112 (injectFixtureFile triggers presign) |
| `p02-upload-progress` | — | UPLOADING 态可见 | t01-capture-to-pending.spec.ts:115-117 |
| `p02-error-banner` | presign 5xx route mock | UPLOADING → ERROR | t01-capture-to-pending.spec.ts:268-270 |
| `subject-chip-math` | — | aria-pressed=true after click | t01-capture-to-pending.spec.ts:97-99 |
| AC1 presign 200 | POST /api/file/presign | — | t01-capture-to-pending.spec.ts:127 |
| AC2 idem reuse | POST /api/file/presign (×2 same key) | — | t01-capture-to-pending.spec.ts:183-200 |
| AC3 wb/questions 201 | POST /api/wb/questions | — | t01-capture-to-pending.spec.ts:143 |
| AC4 nav /analyzing/ | — | UPLOADED → route push | t01-capture-to-pending.spec.ts:149-150 |
| AC5 shutter disabled | — | UPLOADING + disabled | t01-capture-to-pending.spec.ts:245 |
| AC6 missing header 400 | POST /api/file/presign (no X-Idempotency-Key) | — | t01-capture-to-pending.spec.ts:220 |
| TI3 no nav on 5xx | presign 5xx → stays /capture | ERROR 态留 P02 | t01-capture-to-pending.spec.ts:278-279 |
| TI4 presignCount=1 | POST /api/file/presign (10 clicks) | UPLOADING + disabled | t01-capture-to-pending.spec.ts:251 |
