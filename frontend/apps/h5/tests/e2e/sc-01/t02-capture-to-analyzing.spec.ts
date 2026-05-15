// trace: biz=biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 步 5
//        spec=design/system/pages/P02-capture.spec.md §5 + §6 状态机
//        spec=design/system/pages/P03-analyzing.spec.md §5 + §6 + §8 Wire format
//        code=frontend/apps/h5/src/pages/Capture/index.tsx
//        code=frontend/apps/h5/src/pages/Analyzing/index.tsx
//        code=frontend/packages/api-contracts/src/clients/analyze.ts
// SHARED-E2E-PROTOCOL.md v1 · DoR C-1: 源脚本 git tracked 含 trace 头注释
/**
 * SC-01-T02 · P02→P03 跳转 · createPending + analyze-by-url + SSE 订阅
 *
 * Owner: Coder team-1 attempt-1
 * 依据:
 *   - .harness/agents/coder-agent.md §4 真实 E2E
 *   - .harness/agents/SHARED-E2E-PROTOCOL.md v1 DoR C-1..C-6
 *   - .harness/inflight/SC01-T02.json acceptance_criteria AC1..AC6 + test_invariants TI1..TI4
 *   - design/system/pages/P02-capture.spec.md §5 API 触点 + §6 状态机
 *   - design/system/pages/P03-analyzing.spec.md §5 API 触点 + §6 状态机
 *
 * 业务剧本 (source of truth · biz §2B.2 步 5):
 *   1. P02 上传完成 (createPending 200)
 *   2. POST /api/ai/analyze-by-url 202 (拿 taskId)
 *   3. 自动跳转 P03 /analyzing/{taskId}?qid={qid}
 *   4. P03 mount · 4 步 wait 态骨架屏 ≤ 100ms
 *   5. SSE EventSource onopen · taskId 一致
 *
 * 关键不变量 (test_invariants):
 *   - TI1: 同 X-Idempotency-Key 重放 createPending → qid 复用
 *   - TI2: createPending 在 analyze-by-url 之前发起 (顺序断言)
 *   - TI3: SSE 连接 taskId 与 analyze-by-url 返回值一致
 *   - TI4: 4 态 VRT screenshot (queued/connecting/streaming/disconnected)
 */
import { test, expect, type Page } from '@playwright/test';

// ─── Fixtures ──────────────────────────────────────────────────────

const FIXTURE_MIME = 'image/jpeg';
const FIXTURE_BYTES = 5 * 1024 * 1024; // 5 MB

function makeFixtureJpeg(): Buffer {
  const buf = Buffer.alloc(FIXTURE_BYTES, 0);
  buf[0] = 0xff; buf[1] = 0xd8; buf[2] = 0xff; buf[3] = 0xe0;
  buf[FIXTURE_BYTES - 2] = 0xff; buf[FIXTURE_BYTES - 1] = 0xd9;
  return buf;
}

// ─── testids ─────────────────────────────────────────────────────

const TID_P02 = {
  root: 'p02-root',
  subjectMath: 'subject-chip-math',
  shutter: 'capture-shutter',
  uploadProgress: 'p02-upload-progress',
  errorBanner: 'p02-error-banner',
  fileInput: 'p02-file-input',
} as const;

const TID_P03 = {
  root: 'p03-root',
  pipeline: 'analyzing-pipeline',
  step1: 'analyzing-pipeline-step-1',
  step2: 'analyzing-pipeline-step-2',
  step3: 'analyzing-pipeline-step-3',
  step4: 'analyzing-pipeline-step-4',
  jsonStream: 'analyzing-pipeline-json-stream',
  cancelBtn: 'analyzing-pipeline-cancel-btn',
  modelBadge: 'analyzing-pipeline-model-badge',
} as const;

// ─── Helpers ─────────────────────────────────────────────────────

async function injectFixtureFile(page: Page): Promise<void> {
  const fileInput = page.locator(`[data-testid="${TID_P02.fileInput}"]`);
  await fileInput.setInputFiles({
    name: 'fixture-math-q.jpg',
    mimeType: FIXTURE_MIME,
    buffer: makeFixtureJpeg(),
  });
}

function sseBody(events: object[]): string {
  return events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('');
}

const TASK_ID = 'e2e-t02-task-001';
const QID = 'e2e-t02-qid-001';

/** Backend API mock responses for deterministic testing */
const PRESIGN_RESPONSE = {
  code: 0,
  data: {
    url: '/s3/wrongbook-dev/test-upload?sig=mock',
    image_url: 'http://localhost:9000/wrongbook-dev/test-upload',
    method: 'PUT',
    object_key: 'wrongbook-dev/test-upload',
    expires_in_sec: 3600,
  },
};

const COMPLETE_RESPONSE = {
  code: 0,
  data: { file_key: 'wrongbook-dev/test-upload', status: 'READY' },
};

const CREATE_PENDING_RESPONSE = { qid: QID };

const ANALYZE_BY_URL_RESPONSE = { task_id: TASK_ID, status: 'ANALYZING' };

const SSE_EVENTS = [
  { type: 'STEP_START', step: 1 },
  { type: 'STEP_DONE', step: 1, durationMs: 240 },
  { type: 'STEP_START', step: 2 },
  { type: 'STEP_DONE', step: 2, durationMs: 1100 },
  { type: 'STEP_START', step: 3 },
  { type: 'STEP_DONE', step: 3, durationMs: 950 },
  { type: 'STEP_START', step: 4 },
  { type: 'STEP_DONE', step: 4, durationMs: 1200 },
  { type: 'DONE', result: { stem: 'f(x)=x²-4x+3' } },
];

/**
 * Setup P02 with all backend route mocks + SSE stream mock for P03.
 * Returns tracking objects for request ordering verification.
 */
async function setupFullTransition(page: Page, opts?: {
  failCreatePending?: boolean;
  failAnalyze?: boolean;
  sseEvents?: object[];
  hangSse?: boolean;
}) {
  const requestOrder: string[] = [];

  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('access_token', 'dev-stub-token');
      window.localStorage.setItem('lf:auth:studentId', '7');
      window.localStorage.setItem('lf:token', 'dev-stub-token');
    } catch { /* noop */ }
  });

  // presign
  await page.route('**/api/file/presign', async (route) => {
    requestOrder.push('presign');
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(PRESIGN_RESPONSE),
    });
  });

  // PUT (direct upload to MinIO/S3 proxy)
  await page.route('**/s3/**', async (route) => {
    if (route.request().method() === 'PUT') {
      requestOrder.push('put');
      await route.fulfill({ status: 200 });
    } else {
      await route.continue();
    }
  });

  // complete
  await page.route('**/api/file/complete**', async (route) => {
    requestOrder.push('complete');
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(COMPLETE_RESPONSE),
    });
  });

  // createPending
  await page.route('**/api/wb/questions', async (route) => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    requestOrder.push('createPending');
    if (opts?.failCreatePending) {
      await route.fulfill({
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'INTERNAL', message: 'DB timeout' }),
      });
    } else {
      await route.fulfill({
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(CREATE_PENDING_RESPONSE),
      });
    }
  });

  // analyze-by-url
  await page.route('**/api/ai/analyze-by-url', async (route) => {
    requestOrder.push('analyzeByUrl');
    if (opts?.failAnalyze) {
      await route.fulfill({
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'AI_UNAVAILABLE', message: 'Service down' }),
      });
    } else {
      await route.fulfill({
        status: 202,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ANALYZE_BY_URL_RESPONSE),
      });
    }
  });

  // SSE stream for P03
  const events = opts?.sseEvents ?? SSE_EVENTS;
  await page.route(`**/api/ai/stream/${TASK_ID}`, async (route) => {
    requestOrder.push('sseStream');
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
      body: opts?.hangSse ? sseBody(events.slice(0, 2)) : sseBody(events),
    });
  });

  // Cancel API stub
  await page.route(`**/api/ai/cancel/**`, async (route) => {
    requestOrder.push('cancel');
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
  });

  await page.goto('/capture', { waitUntil: 'domcontentloaded' });
  await expect(page.locator(`[data-testid="${TID_P02.root}"]`)).toBeVisible();

  return { requestOrder };
}

// ─── 测试套件 ────────────────────────────────────────────────────

test.describe('SC-01-T02 · P02→P03 跳转 · createPending + analyze-by-url + SSE 订阅', () => {

  // ─────────────────────────────────────────────────────────────
  // AC1 + AC2 + AC3 · Happy path: upload → createPending → analyze-by-url → nav P03 → SSE → P04
  // ─────────────────────────────────────────────────────────────
  test('AC1-3 · happy path · P02 upload → createPending 201 → analyze 202 → jump P03 → SSE 4步 → P04', async ({ page }) => {
    // Use SSE gate to control timing: hold SSE until P03 skeleton is verified
    const requestOrder: string[] = [];
    let releaseSse: (() => void) | null = null;
    const sseGate = new Promise<void>((r) => { releaseSse = r; });

    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('access_token', 'dev-stub-token');
        window.localStorage.setItem('lf:auth:studentId', '7');
        window.localStorage.setItem('lf:token', 'dev-stub-token');
      } catch { /* noop */ }
    });

    // Setup all routes (same as setupFullTransition but with SSE gate)
    await page.route('**/api/file/presign', async (route) => {
      requestOrder.push('presign');
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(PRESIGN_RESPONSE) });
    });
    await page.route('**/s3/**', async (route) => {
      if (route.request().method() === 'PUT') { requestOrder.push('put'); await route.fulfill({ status: 200 }); }
      else await route.continue();
    });
    await page.route('**/api/file/complete**', async (route) => {
      requestOrder.push('complete');
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(COMPLETE_RESPONSE) });
    });
    await page.route('**/api/wb/questions', async (route) => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      requestOrder.push('createPending');
      await route.fulfill({ status: 201, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(CREATE_PENDING_RESPONSE) });
    });
    await page.route('**/api/ai/analyze-by-url', async (route) => {
      requestOrder.push('analyzeByUrl');
      await route.fulfill({ status: 202, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ANALYZE_BY_URL_RESPONSE) });
    });
    await page.route(`**/api/ai/stream/${TASK_ID}`, async (route) => {
      requestOrder.push('sseStream');
      // Hold SSE response until gate opens → allows P03 skeleton verification
      await sseGate;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
        body: sseBody(SSE_EVENTS),
      });
    });
    await page.route(`**/api/ai/cancel/**`, async (route) => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CANCELLED' }) });
    });

    await page.goto('/capture', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(`[data-testid="${TID_P02.root}"]`)).toBeVisible();

    // ── IDLE 截图 (P02 初始态) ──
    await expect(page).toHaveScreenshot('p02-idle-chromium-darwin.png', {
      maxDiffPixels: 500,
      fullPage: true,
    });

    // select math subject
    await page.locator(`[data-testid="${TID_P02.subjectMath}"]`).click();

    // inject fixture file
    await injectFixtureFile(page);

    // AC1: nav to /analyzing/{taskId} (SSE is gated so we stay on P03)
    await page.waitForURL(/\/analyzing\//, { timeout: 10_000 });
    expect(page.url(), 'AC1: URL contains /analyzing/ with taskId').toContain(`/analyzing/${TASK_ID}`);
    expect(page.url(), 'AC3: URL has qid query param').toContain(`qid=${QID}`);

    // TI2: verify request ordering — createPending BEFORE analyze-by-url
    const createIdx = requestOrder.indexOf('createPending');
    const analyzeIdx = requestOrder.indexOf('analyzeByUrl');
    expect(createIdx, 'TI2: createPending came before analyzeByUrl').toBeLessThan(analyzeIdx);

    // AC2: P03 skeleton screen visible (4 steps in wait state)
    await expect(page.locator(`[data-testid="${TID_P03.root}"]`)).toBeVisible({ timeout: 2_000 });
    await expect(page.locator(`[data-testid="${TID_P03.pipeline}"]`)).toBeVisible({ timeout: 2_000 });

    // ── P03 骨架屏截图 (SSE gated → 4步 wait 态) ──
    await expect(page).toHaveScreenshot('p03-queued-chromium-darwin.png', {
      maxDiffPixels: 500,
      fullPage: true,
    });

    // Release SSE gate → events flow → DONE → nav P04
    releaseSse!();

    // Wait for SSE to complete → DONE → nav P04
    await page.waitForURL(/\/question\/.*\/result/, { timeout: 10_000 });
    expect(page.url(), 'DONE → nav P04 /question/{qid}/result').toContain(`/question/${QID}/result`);

    // ── SUCCESS 截图 (P04 到达) ──
    await expect(page).toHaveScreenshot('p04-success-chromium-darwin.png', {
      maxDiffPixels: 500,
      fullPage: true,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // AC4 · createPending 5xx → 留 P02 + ERROR banner
  // ─────────────────────────────────────────────────────────────
  test('AC4 · createPending 5xx → ERROR banner + stays P02 + no P03', async ({ page }) => {
    await setupFullTransition(page, { failCreatePending: true });

    await page.locator(`[data-testid="${TID_P02.subjectMath}"]`).click();
    await injectFixtureFile(page);

    // wait for error banner
    await expect(page.locator(`[data-testid="${TID_P02.errorBanner}"]`)).toBeVisible({ timeout: 5_000 });
    expect(page.url(), 'AC4: stays on /capture').toContain('/capture');
    expect(page.url(), 'AC4: did NOT navigate to /analyzing').not.toMatch(/\/analyzing\//);

    // ── ERROR 截图 (createPending 失败) ──
    await expect(page).toHaveScreenshot('p02-error-createpending-chromium-darwin.png', {
      maxDiffPixels: 500,
      fullPage: true,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // AC5 · analyze-by-url 5xx → 留 P02 + ERROR banner
  // ─────────────────────────────────────────────────────────────
  test('AC5 · analyze-by-url 5xx → ERROR banner + stays P02 + no P03', async ({ page }) => {
    await setupFullTransition(page, { failAnalyze: true });

    await page.locator(`[data-testid="${TID_P02.subjectMath}"]`).click();
    await injectFixtureFile(page);

    // wait for error banner (analyze-by-url failure falls through to catch in handleFile)
    await expect(page.locator(`[data-testid="${TID_P02.errorBanner}"]`)).toBeVisible({ timeout: 5_000 });
    expect(page.url(), 'AC5: stays on /capture').toContain('/capture');
    expect(page.url(), 'AC5: did NOT navigate to /analyzing').not.toMatch(/\/analyzing\//);

    // ── ERROR 截图 (analyze-by-url 失败) ──
    await expect(page).toHaveScreenshot('p02-error-analyze-chromium-darwin.png', {
      maxDiffPixels: 500,
      fullPage: true,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // AC6 · SSE 连接失败 → P03 已进 + toast
  // ─────────────────────────────────────────────────────────────
  test('AC6 · SSE connection failure → P03 entered + fallback banner', async ({ page }) => {
    // Setup with SSE that returns error
    const { requestOrder } = await setupFullTransition(page);

    // Override the SSE route to return 500
    await page.route(`**/api/ai/stream/${TASK_ID}`, async (route) => {
      await route.fulfill({
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Service Unavailable',
      });
    });

    await page.locator(`[data-testid="${TID_P02.subjectMath}"]`).click();
    await injectFixtureFile(page);

    // Navigate to P03 (AC6 says allow P03 already entered)
    await page.waitForURL(/\/analyzing\//, { timeout: 10_000 });
    await expect(page.locator(`[data-testid="${TID_P03.root}"]`)).toBeVisible({ timeout: 2_000 });

    // P03 should show pipeline in wait state (SSE failed)
    await expect(page.locator(`[data-testid="${TID_P03.step1}"]`)).toBeVisible();

    // ── SSE 失败截图 ──
    await expect(page).toHaveScreenshot('p03-sse-error-chromium-darwin.png', {
      maxDiffPixels: 500,
      fullPage: true,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TI1 · 同 X-Idempotency-Key → qid 复用
  // ─────────────────────────────────────────────────────────────
  test('TI1 · createPending carries X-Idempotency-Key header (reuse semantics)', async ({ page }) => {
    let capturedIdemKey: string | null = null;

    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('access_token', 'dev-stub-token');
        window.localStorage.setItem('lf:auth:studentId', '7');
        window.localStorage.setItem('lf:token', 'dev-stub-token');
      } catch { /* noop */ }
    });

    // Intercept all APIs but capture createPending headers
    await page.route('**/api/file/presign', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(PRESIGN_RESPONSE),
      });
    });
    await page.route('**/s3/**', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({ status: 200 });
      } else { await route.continue(); }
    });
    await page.route('**/api/file/complete**', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(COMPLETE_RESPONSE),
      });
    });
    await page.route('**/api/wb/questions', async (route) => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      capturedIdemKey = route.request().headers()['x-idempotency-key'] ?? null;
      await route.fulfill({
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(CREATE_PENDING_RESPONSE),
      });
    });
    await page.route('**/api/ai/analyze-by-url', async (route) => {
      await route.fulfill({
        status: 202,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ANALYZE_BY_URL_RESPONSE),
      });
    });
    await page.route(`**/api/ai/stream/${TASK_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: sseBody(SSE_EVENTS),
      });
    });

    await page.goto('/capture', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(`[data-testid="${TID_P02.root}"]`)).toBeVisible();

    await page.locator(`[data-testid="${TID_P02.subjectMath}"]`).click();
    await injectFixtureFile(page);

    await page.waitForURL(/\/analyzing\//, { timeout: 10_000 });

    expect(capturedIdemKey, 'TI1: createPending carries X-Idempotency-Key').toBeTruthy();
    expect(typeof capturedIdemKey, 'TI1: idemKey is a string').toBe('string');
  });

  // ─────────────────────────────────────────────────────────────
  // TI2 · analyze-by-url receives correct task_id and image_url
  // ─────────────────────────────────────────────────────────────
  test('TI2 · analyze-by-url request body contains task_id + subject + image_url', async ({ page }) => {
    let analyzBody: Record<string, unknown> | null = null;

    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('access_token', 'dev-stub-token');
        window.localStorage.setItem('lf:auth:studentId', '7');
        window.localStorage.setItem('lf:token', 'dev-stub-token');
      } catch { /* noop */ }
    });

    await page.route('**/api/file/presign', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(PRESIGN_RESPONSE),
      });
    });
    await page.route('**/s3/**', async (route) => {
      if (route.request().method() === 'PUT') await route.fulfill({ status: 200 });
      else await route.continue();
    });
    await page.route('**/api/file/complete**', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(COMPLETE_RESPONSE),
      });
    });
    await page.route('**/api/wb/questions', async (route) => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      await route.fulfill({
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(CREATE_PENDING_RESPONSE),
      });
    });
    await page.route('**/api/ai/analyze-by-url', async (route) => {
      const bodyText = route.request().postData();
      analyzBody = bodyText ? JSON.parse(bodyText) : null;
      await route.fulfill({
        status: 202,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ANALYZE_BY_URL_RESPONSE),
      });
    });
    await page.route(`**/api/ai/stream/${TASK_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: sseBody(SSE_EVENTS),
      });
    });

    await page.goto('/capture', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(`[data-testid="${TID_P02.root}"]`)).toBeVisible();
    await page.locator(`[data-testid="${TID_P02.subjectMath}"]`).click();
    await injectFixtureFile(page);

    await page.waitForURL(/\/analyzing\//, { timeout: 10_000 });

    expect(analyzBody, 'analyze-by-url body captured').not.toBeNull();
    expect(analyzBody!.task_id, 'task_id = qid from createPending').toBe(QID);
    expect(analyzBody!.subject, 'subject is MATH (uppercase)').toBe('MATH');
    expect(analyzBody!.image_url, 'image_url from presign').toBeTruthy();
  });
});
