// trace: biz=biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 步骤 1-4
//        spec=design/system/pages/P02-capture.spec.md §5 API 触点 + §6 状态机
//        code=backend/file-service/src/main/java/com/longfeng/fileservice/controller/PresignController.java
//        code=backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/controller/QuestionDetailController.java
//        code=frontend/apps/h5/src/pages/Capture/index.tsx
// SHARED-E2E-PROTOCOL.md v1 · DoR C-1: 源脚本 git tracked 含 trace 头注释
/**
 * SC-01-T01 · P02 拍题 → presign + OSS PUT + wrongbook PENDING question + 跳 P03
 * (TC-01.01 黄金路径起点 · 内嵌 TC-01.02 断点续传 + idempotency)
 *
 * Owner: Coder team-1 attempt-1
 * 依据:
 *   - .harness/agents/coder-agent.md §4 真实 E2E + 铁律补充 6 E2E = DoD 唯一硬条件
 *   - .harness/agents/SHARED-E2E-PROTOCOL.md v1 DoR C-1..C-6
 *   - .harness/inflight/SC01-T01.json acceptance_criteria AC1-AC6
 *   - design/system/pages/P02-capture.spec.md §5 API 触点 + §6 状态机
 *
 * 业务剧本 (source of truth · biz §2B.2 步骤 1-4):
 *   1. 学生进 /capture
 *   2. tap subject-chip-math · aria-pressed=true
 *   3. tap capture-shutter → 文件选择器选图
 *   4. POST /api/file/presign (Header X-Idempotency-Key + body{filename,content_type,bytes}) → 200
 *   5. PUT {presignedUrl} → 200
 *   6. POST /api/file/complete/{objectKey} → 200
 *   7. POST /api/wb/questions (Header X-Idempotency-Key) → 201 {qid}
 *   8. router.push('/analyzing/{qid}')
 *
 * 关键不变量 (test_invariants):
 *   - TI1: 同 X-Idempotency-Key 24h 内 wb_file 仅 1 行
 *   - TI2: 缺 X-Idempotency-Key Header 必返 400 (非 500)
 *   - TI3: presign / PUT / wb/questions 任一失败前端不跳 P03
 *   - TI4: shutter UPLOADING 期间防抖 (10 click 后端仍 1 次 presign)
 *   - TI5: VRT IDLE / UPLOADING / SUCCESS / ERROR 4 态截图
 */
import { test, expect, type Page } from '@playwright/test';

// ─── Fixtures ──────────────────────────────────────────────────────

const FIXTURE_SHA256 = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
const FIXTURE_MIME = 'image/jpeg';
const FIXTURE_BYTES = 5 * 1024 * 1024; // 5 MB

function makeFixtureJpeg(): Buffer {
  const buf = Buffer.alloc(FIXTURE_BYTES, 0);
  buf[0] = 0xff; buf[1] = 0xd8; buf[2] = 0xff; buf[3] = 0xe0;
  buf[FIXTURE_BYTES - 2] = 0xff; buf[FIXTURE_BYTES - 1] = 0xd9;
  return buf;
}

// ─── testids (per frontend/packages/testids/src/index.ts §p02) ──

const TID = {
  root: 'p02-root',
  subjectMath: 'subject-chip-math',
  shutter: 'capture-shutter',
  uploadProgress: 'p02-upload-progress',
  errorBanner: 'p02-error-banner',
  fileInput: 'p02-file-input',
} as const;

// ─── Helper: inject fixture file into hidden input ─────────────

async function injectFixtureFile(page: Page): Promise<void> {
  const fileInput = page.locator(`[data-testid="${TID.fileInput}"]`);
  await fileInput.setInputFiles({
    name: 'fixture-math-q.jpg',
    mimeType: FIXTURE_MIME,
    buffer: makeFixtureJpeg(),
  });
}

// ─── 测试套件 ────────────────────────────────────────────────────

test.describe('SC-01-T01 · P02 拍题 → presign → PUT MinIO → wb/questions → 跳 P03', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('access_token', 'dev-stub-token');
        window.localStorage.setItem('lf:auth:studentId', '7');
      } catch { /* noop */ }
    });
    await page.goto('/capture', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(`[data-testid="${TID.root}"]`)).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────
  // AC1 + AC3 黄金路径 (TC-01.01 步骤 1-8) + 4 态截图
  // ─────────────────────────────────────────────────────────────
  test('happy path · presign 200 + PUT + complete + wb/questions 201 + 跳 /analyzing/', async ({ page }) => {
    // IDLE 态截图 (DoR C-4 第 1 张)
    await page.screenshot({
      path: 'test-results/screenshots/idle-actual.png',
      fullPage: true,
    });

    // select MATH subject
    const mathChip = page.locator(`[data-testid="${TID.subjectMath}"]`);
    await mathChip.click();
    await expect(mathChip).toHaveAttribute('aria-pressed', 'true');

    // 监听 presign + wb/questions 网络事件
    const presignPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/file/presign') && resp.request().method() === 'POST',
      { timeout: 15_000 },
    );
    const wbQuestionsPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/wb/questions') && resp.request().method() === 'POST',
      { timeout: 15_000 },
    );

    // 注入 5MB fixture file
    await injectFixtureFile(page);

    // 等 UPLOADING 态
    await expect(page.locator(`[data-testid="${TID.uploadProgress}"]`)).toBeVisible({
      timeout: 5_000,
    });

    // UPLOADING 态截图 (DoR C-4 第 2 张)
    await page.screenshot({
      path: 'test-results/screenshots/uploading-actual.png',
      fullPage: true,
    });

    // 断言 presign 200 (AC1)
    const presignResp = await presignPromise;
    expect(presignResp.status(), 'AC1 presign 200').toBe(200);
    const presignJson = await presignResp.json();
    // Backend returns ApiResult: { code: 0, data: { url, object_key, ... } }
    const presignData = presignJson?.data ?? presignJson;
    expect(presignData.url || presignData.upload_url, 'presign returns url').toBeTruthy();
    expect(presignData.object_key || presignData.file_key, 'presign returns object_key').toBeTruthy();

    // 断言 presign request 含 X-Idempotency-Key Header (AC1 + AC6)
    const presignReqHeaders = presignResp.request().headers();
    expect(
      presignReqHeaders['x-idempotency-key'],
      'AC6: presign req carries X-Idempotency-Key Header',
    ).toBeTruthy();

    // 断言 POST /api/wb/questions 201 + qid (AC3)
    const wbResp = await wbQuestionsPromise;
    expect(wbResp.status(), 'AC3 wb/questions 201').toBe(201);
    const wbJson = await wbResp.json();
    const wbData = wbJson?.data ?? wbJson;
    expect(wbData.qid ?? wbData.id, 'AC3 returns qid').toBeTruthy();

    // 断言路由切到 /analyzing/ (AC4 路由门禁 · TI3)
    await page.waitForURL(/\/analyzing\//, { timeout: 5_000 });
    expect(page.url(), 'URL contains /analyzing/').toMatch(/\/analyzing\/[^/?]+/);

    // SUCCESS 态截图 (DoR C-4 第 3 张 — 实际上是 UPLOADED 后立即跳走,
    // 所以用 /analyzing/ 页作为成功态证据)
    await page.screenshot({
      path: 'test-results/screenshots/success-actual.png',
      fullPage: true,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // AC2 + TI1 · 同 X-Idempotency-Key 24h → 同 object_key
  // ─────────────────────────────────────────────────────────────
  test('AC2 · same X-Idempotency-Key 24h reuses object_key (no double wb_file row)', async ({
    request,
  }) => {
    const idemKey = `e2e-idem-${Date.now()}`;
    const body = {
      filename: 'fixture-math-q.jpg',
      content_type: FIXTURE_MIME,
      bytes: FIXTURE_BYTES,
      sha256_hash: FIXTURE_SHA256,
    };

    const first = await request.post('/api/file/presign', {
      headers: {
        'X-Idempotency-Key': idemKey,
        'X-Tenant-Id': '0',
        'X-User-Id': '7',
        'Content-Type': 'application/json',
      },
      data: body,
    });
    expect(first.status(), 'AC1 first presign 200').toBe(200);
    const firstJson = await first.json();
    const firstKey = (firstJson?.data ?? firstJson).object_key;
    expect(firstKey, 'first call returns object_key').toBeTruthy();

    const second = await request.post('/api/file/presign', {
      headers: {
        'X-Idempotency-Key': idemKey,
        'X-Tenant-Id': '0',
        'X-User-Id': '7',
        'Content-Type': 'application/json',
      },
      data: body,
    });
    expect(second.status(), 'AC2 second presign 200 (HIT)').toBe(200);
    const secondJson = await second.json();
    const secondKey = (secondJson?.data ?? secondJson).object_key;
    expect(secondKey, 'AC2: same idem-key → same object_key').toBe(firstKey);
  });

  // ─────────────────────────────────────────────────────────────
  // AC6 · 缺 X-Idempotency-Key Header → 400
  // ─────────────────────────────────────────────────────────────
  test('AC6 · missing X-Idempotency-Key Header returns 400 (not 500)', async ({ request }) => {
    const resp = await request.post('/api/file/presign', {
      headers: {
        'X-Tenant-Id': '0',
        'X-User-Id': '7',
        'Content-Type': 'application/json',
      },
      data: {
        filename: 'q.jpg',
        content_type: FIXTURE_MIME,
        bytes: FIXTURE_BYTES,
        sha256_hash: FIXTURE_SHA256,
      },
    });
    expect(resp.status(), 'TI2: missing header → 400 (not 500)').toBe(400);
    expect(resp.status(), 'returns 4xx not 5xx').toBeLessThan(500);
  });

  // ─────────────────────────────────────────────────────────────
  // AC5 + TI4 · UPLOADING 防抖
  // ─────────────────────────────────────────────────────────────
  test('TI4 · shutter disabled during UPLOADING + 10 clicks fire only 1 presign', async ({
    page,
  }) => {
    let presignCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/file/presign') && req.method() === 'POST') {
        presignCount++;
      }
    });

    await page.locator(`[data-testid="${TID.subjectMath}"]`).click();
    await injectFixtureFile(page);

    await expect(page.locator(`[data-testid="${TID.uploadProgress}"]`)).toBeVisible({
      timeout: 5_000,
    });

    const shutter = page.locator(`[data-testid="${TID.shutter}"]`);
    await expect(shutter).toBeDisabled();

    for (let i = 0; i < 10; i++) {
      await shutter.click({ force: true, noWaitAfter: true }).catch(() => {});
    }
    await page.waitForTimeout(800);
    expect(presignCount, 'TI4: only 1 presign request despite 10 clicks').toBe(1);
  });

  // ─────────────────────────────────────────────────────────────
  // TI3 · presign 5xx → ERROR banner, no nav to /analyzing/
  // ─────────────────────────────────────────────────────────────
  test('TI3 · presign 5xx shows ERROR banner + stays on /capture', async ({
    page,
  }) => {
    // 注入 presign 失败 (spec §9 允许 page.route 注入故障)
    await page.route('**/api/file/presign', (route) =>
      route.fulfill({ status: 500, body: '{}' }),
    );

    await page.locator(`[data-testid="${TID.subjectMath}"]`).click();
    await injectFixtureFile(page);

    await expect(page.locator(`[data-testid="${TID.errorBanner}"]`)).toBeVisible({
      timeout: 5_000,
    });

    // ERROR 态截图 (DoR C-4 第 4 张)
    await page.screenshot({
      path: 'test-results/screenshots/error-actual.png',
      fullPage: true,
    });

    expect(page.url(), 'TI3: stays on /capture').toContain('/capture');
    expect(page.url(), 'TI3: did NOT navigate').not.toMatch(/\/analyzing\//);
  });
});
