# Spec-Trace · SC01-T03 · P03 AI 分析中

## testid → E2E assertion 对照表

| testid (spec.md)                      | E2E spec line(s) | Assertion                                      |
|---------------------------------------|-------------------|-------------------------------------------------|
| p03-root                              | L165, L214        | toBeVisible after page.goto                     |
| p03-thumb-card                        | (渲染验证)         | Component renders via setupP03                  |
| analyzing-pipeline-model-badge        | L254-255          | toContainText('gpt-4o-mini') after FALLBACK     |
| analyzing-pipeline                    | L412-414          | aria-live="polite", aria-label="AI 分析进度"      |
| analyzing-pipeline-step-1             | L223-225, L273    | data-state=wait→done lifecycle                  |
| analyzing-pipeline-step-2             | L223-225          | data-state=wait→done lifecycle                  |
| analyzing-pipeline-step-3             | L223-225          | data-state=wait→done lifecycle                  |
| analyzing-pipeline-step-4             | L223-225          | data-state=wait→done lifecycle                  |
| analyzing-pipeline-json-stream        | (渲染验证)         | PARTIAL_JSON chunk appends to pre               |
| analyzing-pipeline-cancel-btn         | L277-291          | toBeEnabled + click → POST /cancel → 200        |
| p03-fallback-banner                   | L249-251          | toBeVisible + toContainText('切换备用模型中')     |

## API path → E2E assertion 对照表

| API (spec §5)                         | E2E spec line(s) | Assertion                                      |
|---------------------------------------|-------------------|-------------------------------------------------|
| GET /api/ai/stream/{taskId} (SSE)     | L126, L189        | page.route intercept + sseBody fulfill          |
| POST /api/ai/cancel/{taskId}          | L153, L280-291    | waitForResponse 200 + JSON status=CANCELLED     |

## 状态机分支 → E2E assertion 对照表

| State transition (spec §6)            | Test name               | E2E assertion                              |
|---------------------------------------|-------------------------|--------------------------------------------|
| QUEUED → STEP_1..4 → DONE → P04      | AC1-4 happy path        | waitForURL /question/.*/result (L232)      |
| FALLBACK_MODEL → 黄条 + model switch   | AC5 TC-01.03            | banner visible + badge text (L249-255)     |
| Cancel → CANCELLED → P-HOME          | AC6 cancel              | POST /cancel 200 + waitForURL / (L295)     |
| 2× FAIL → /manual-entry              | FAIL events             | waitForURL /manual-entry (L396)            |
| STEP_START → aria-busy=true           | a11y test               | toHaveAttribute aria-busy true (L419)      |

## Screenshot coverage (4 态 DoR C-4)

| State      | Screenshot                          | Captured at         |
|------------|-------------------------------------|---------------------|
| IDLE       | t03-idle.png                        | AC1-4 test L217-220 |
| UPLOADING  | t03-uploading.png                   | a11y test L421-425  |
| SUCCESS    | t03-success.png                     | AC1-4 test L236-239 |
| ERROR      | t03-error.png                       | AC6 test L297-300   |
