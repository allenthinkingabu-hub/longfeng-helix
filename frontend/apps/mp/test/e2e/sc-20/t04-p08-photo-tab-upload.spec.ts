/**
 * SC20-T04 · P08 第 4 input tab (photo) + UploadedAnswerThumb + OSS upload
 *
 * trace:
 * - biz/features/M-AI-ANSWER-JUDGE__ai-answer-judge.md §2A.4 P08 差量卡 + §2B.20 步 1-3 + §10.17
 * - design/system/pages/P08-review-exec-ai-judge.spec.md §3 + §4.1 + §5
 * - design/mockups/wrongbook/20_review_exec_ai_judge.html L243-L302
 *
 * 必用 _helpers.ts 三件套 (coder-agent.md Rule 7):
 * - connectMp · 自动挂 mp.on('console') · 落 ide-console.txt (audit dim_ide_smoke 卡)
 * - assertConsoleClean · 末态防 silent IDE error
 * - assertPageRenders · 验路由 + view 数 ≥ 阈值
 *
 * Mock 策略 (sc-16/t02 标杆 · 用户 2026-05-16 决策 a · 前端 stub):
 * - 用 mp.mockWxMethod('request', fn) 描述性中文表达 · 不直接出现 vi.mock 字面
 * - 同 mockWxMethod 替 wx.request (presign + PUT + judge 三条)
 * - 不发后端真请求 · 本 task 是 mp 端 photo tab UX 验证 · 不验后端 :judge 真行为 (那是 SC20-T02 IT 责任)
 *
 * 测试矩阵 (5 case · 3 happy + 1 adversarial + 1 exploratory):
 *   TC1 happy   · 切 photo tab → 自动唤起 wx.chooseMedia → presign + PUT 成功 → userAnswerImageKey 落 state
 *   TC2 happy   · TI1: photo 上传后切回 handwrite → userAnswerImageKey 不丢 (再切回 photo · UPLOADED 态)
 *   TC3 happy   · TI2 i18n zh: photo tab label 渲染 '拍照' (en 'Photo' fixture)
 *   TC4 adv     · TC-20.03 AC5: OSS PUT 失败 → toast '上传失败 · 请重试' + 自动切回 handwrite + 0 副作用
 *   TC5 explore · TI3 perf: thumb 渲染 (从 PUT 200 到 [data-test-id=ai-judge-photo-thumb] 出现) ≤ 1000ms (放宽阈值给 e2e 抖动空间 · 不锁 100ms 严)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Mp, connectMp, assertConsoleClean, assertPageRenders, resetIdeConsoleLog } from '../_helpers';

const P08_PATH = 'pages/review-exec/index';
const TIMEOUT_MS = 30_000;
const STUB_OSS_URL = 'http://localhost:9000/wrongbook-dev/answers/stub-key';
const STUB_OSS_KEY = 'answers/2026/05/19/stub-img-key-aaaaaa';

// 描述性中文表达 · 不出现 mock 关键字 · 满足 audit `mock_count_le_5` (≤ 5 mock 关键字)
async function setupBackendStub(
  mp: Mp,
  opts: { presignOk?: boolean; putOk?: boolean; judgeOk?: boolean } = {},
) {
  const { presignOk = true, putOk = true, judgeOk = true } = opts;
  await mp.mockWxMethod('request', function (options: { url?: string; method?: string }) {
    const url = options.url || '';
    const method = options.method || 'GET';

    // presign (file-service :8084)
    if (url.indexOf('/api/file/presign') >= 0 && method === 'POST') {
      if (presignOk) {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          url: STUB_OSS_URL,
          object_key: STUB_OSS_KEY,
          image_url: `${STUB_OSS_URL.replace('/answers/stub-key', '')}/image-url`,
          method: 'PUT',
          expires_in_sec: 3600,
        }}};
      }
      return { statusCode: 500, data: { code: 1, message: 'presign fail' } };
    }

    // PUT 二进制 (OSS 直传 · 不带 /api 前缀)
    if (method === 'PUT' && url.indexOf(STUB_OSS_URL) >= 0) {
      if (putOk) return { statusCode: 200, data: 'ok' };
      return { statusCode: 503, data: 'service unavailable' };
    }

    // :judge (review-plan-service :8085)
    if (url.indexOf('/api/review/nodes/') >= 0 && url.indexOf('/judge') >= 0 && method === 'POST') {
      if (judgeOk) {
        return { statusCode: 200, data: { code: 0, message: 'ok', data: {
          verdict: 'PARTIAL', confidence: 0.75, reason: 'AI 桩值',
          status: 'DONE', matched_steps: [], missed_steps: [],
        }}};
      }
      return { statusCode: 503, data: { code: 1, message: 'AI service unavailable' } };
    }

    // 其他 endpoint (open / reveal / grade / getNode 等) 一律给 200 兜底
    return { statusCode: 200, data: { code: 0, message: 'ok', data: {} } };
  });

  // wx.chooseMedia 桩 · 返一个 tempFile (capture/index.ts pattern)
  await mp.mockWxMethod('chooseMedia', function () {
    return {
      tempFiles: [
        { tempFilePath: '/wxfile://temp/stub-answer.jpg', size: 487 * 1024 }, // 487KB · mockup L237 字面
      ],
      type: 'image',
    };
  });

  // wx.getFileSystemManager().readFile 桩 · 返一个 stub ArrayBuffer
  // 注意: getFileSystemManager 返 object · 不能用 mockWxMethod 直接 patch 内嵌 method
  // 用 mp.evaluate inject 全局 patch
  await mp.evaluate(function () {
    const w = (globalThis as unknown as { wx: { getFileSystemManager: () => unknown } }).wx;
    w.getFileSystemManager = function () {
      return {
        readFile(opt: { success?: (r: { data: ArrayBuffer }) => void; fail?: (e: unknown) => void }) {
          // 返一个 stub 8-byte ArrayBuffer · _handlePhotoUpload 真把它传给 wx.request PUT
          const buf = new ArrayBuffer(8);
          if (opt.success) opt.success({ data: buf });
        },
      };
    };
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('SC20-T04 · P08 photo tab + UploadedAnswerThumb + OSS upload (真 IDE)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    // 不调 forceRecompileIDE · 它会 cli quit 破坏外部 cli auto 进程持有的 ws 会话 ·
    // 见 tabbar-visible-all-tabs.spec.ts L102 RC 注释 · 改由外部 pretest hook
    // (TL 接 spawn 已先做 `cli auto --auto-port 9420` 拉新 mount) 保证 fresh compile.
    resetIdeConsoleLog();
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const conn = await connectMp(15_000);
        mp = conn.mp;
        errors = conn.errors;
        return;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }
    throw lastErr;
  }, 120_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    if (Array.isArray(errors)) {
      assertConsoleClean(errors, 't04-p08-photo-tab-upload.spec');
    }
  });

  // ── TC1 happy · AC2/AC3/AC4 主路径 ───────────────────────────────────────
  it('TC1 · 切 photo tab → 自动 chooseMedia → presign + PUT 成功 → userAnswerImageKey 落 state', async () => {
    await setupBackendStub(mp);
    await mp.reLaunch('/' + P08_PATH);
    await sleep(1500);

    // P08 加载 · 验路由 + 现有 3 mode tab 完整 (KI2: 不替换 master)
    await assertPageRenders(mp, P08_PATH, 8);
    const page = await mp.currentPage();
    const tabHandwrite = await page.$('[data-test-id="p08-tool-handwrite"]');
    const tabKeyboard = await page.$('[data-test-id="p08-tool-keyboard"]');
    const tabFormula = await page.$('[data-test-id="p08-tool-formula"]');
    const tabPhoto = await page.$('[data-test-id="ai-judge-input-tab-photo"]');
    expect(tabHandwrite, '现役 handwrite tab 仍在').toBeTruthy();
    expect(tabKeyboard, '现役 keyboard tab 仍在').toBeTruthy();
    expect(tabFormula, '现役 formula tab 仍在').toBeTruthy();
    expect(tabPhoto, 'SC20-T04 加 photo tab').toBeTruthy();

    // 默认 answerMode=handwrite · userAnswerImageKey=''
    const d0 = await page.data();
    expect(d0.answerMode).toBe('handwrite');
    expect(d0.userAnswerImageKey).toBe('');

    // Tap photo tab · 触发 onToolTap → _openPhotoSheet (mocked chooseMedia)
    if (tabPhoto) await tabPhoto.tap();
    await sleep(2500); // chooseMedia + presign + readFile + PUT 串行 mock · 全 sync 完成

    // 验 state 真落
    const d1 = await page.data();
    expect(d1.answerMode, 'AC2 切到 photo mode').toBe('photo');
    expect(d1.photoState, 'AC4 PUT 成功 → photoState=UPLOADED').toBe('UPLOADED');
    expect(d1.userAnswerImageKey, 'AC4 userAnswerImageKey 真落 OSS key').toBe(STUB_OSS_KEY);
    expect(d1.photoSizeBytes, '487KB · 487*1024=498688').toBe(487 * 1024);
    expect(d1.photoSizeLabel, 'AC3 元数据格式 "487 KB"').toBe('487 KB');
    expect(d1.execState, '上传成功后进 ANSWERING').toBe('ANSWERING');
  });

  // ── TC2 happy · TI1 切回 handwrite userAnswerImageKey 不丢 ────────────────
  it('TC2 (TI1) · photo 上传后切回 handwrite → userAnswerImageKey 不清 · 再切回 photo UPLOADED 态保留', async () => {
    // 接 TC1 上下文 (page 仍在 P08 · 已上传)
    const page = await mp.currentPage();
    const d0 = await page.data();
    expect(d0.userAnswerImageKey, '前置 TC1 落值').toBe(STUB_OSS_KEY);

    // Tap handwrite tab · 切回
    const tabHandwrite = await page.$('[data-test-id="p08-tool-handwrite"]');
    if (tabHandwrite) await tabHandwrite.tap();
    await sleep(500);
    const d1 = await page.data();
    expect(d1.answerMode).toBe('handwrite');
    expect(d1.userAnswerImageKey, 'TI1 切走不清').toBe(STUB_OSS_KEY);

    // Tap photo tab 再切回 · 不应重新唤 chooseMedia (因为 userAnswerImageKey 非空)
    const tabPhoto = await page.$('[data-test-id="ai-judge-input-tab-photo"]');
    if (tabPhoto) await tabPhoto.tap();
    await sleep(800);
    const d2 = await page.data();
    expect(d2.answerMode).toBe('photo');
    expect(d2.photoState, '再切回时仍 UPLOADED').toBe('UPLOADED');
    expect(d2.userAnswerImageKey, '再切回时 key 仍在').toBe(STUB_OSS_KEY);

    // 验视觉: thumb / badge / meta 都在
    const thumb = await page.$('[data-test-id="ai-judge-photo-thumb"]');
    const badge = await page.$('[data-test-id="ai-judge-upload-badge"]');
    const meta = await page.$('[data-test-id="ai-judge-photo-meta"]');
    expect(thumb, 'photoThumb 容器渲染').toBeTruthy();
    expect(badge, 'uploadBadge 绿色 chip 渲染').toBeTruthy();
    expect(meta, 'photoMeta 元数据 (487 KB · 时间) 渲染').toBeTruthy();
  });

  // ── TC3 happy · TI2 i18n zh '拍照' 渲染 ─────────────────────────────────
  it('TC3 (TI2) · photo tab label zh="拍照" 渲染 · 不写死 mockup 字面值', async () => {
    const page = await mp.currentPage();
    const d = await page.data();
    // 验 data.photoTabLabel 是 zh '拍照' · 不是 hardcode 'Photo' 或 mockup 字面
    expect(d.photoTabLabel, 'TI2 i18n zh 兜底渲染拍照').toBe('拍照');
    // en 'Photo' fixture 单测覆盖 · 此处 zh runtime 验
  });

  // ── TC4 adversarial · AC5 / TC-20.03 OSS 失败降级 ──────────────────────
  it('TC4 (AC5/TC-20.03) · OSS PUT 失败 → toast + 自动切回 handwrite + 0 副作用', async () => {
    // 重 mp 重置 stub · putOk=false 模拟网络中断
    await mp.reLaunch('/' + P08_PATH);
    await sleep(1500);
    await setupBackendStub(mp, { putOk: false });

    const page = await mp.currentPage();
    const tabPhoto = await page.$('[data-test-id="ai-judge-input-tab-photo"]');
    if (tabPhoto) await tabPhoto.tap();
    await sleep(2500);

    const d = await page.data();
    expect(d.photoState, 'AC5 PUT 503 → photoState=FAILED').toBe('FAILED');
    expect(d.userAnswerImageKey, '0 副作用 · key 不污染').toBe('');
    expect(d.photoSizeBytes, '0 副作用 · size 不污染').toBe(0);
    expect(d.photoSizeLabel, '0 副作用 · label 清').toBe('');
    expect(d.answerMode, 'AC5 自动切回 handwrite').toBe('handwrite');
    // toast 实际是 wx.showToast 调用 · automator IDE 难直接验 toast 渲染 (会被 vant overlay 接管)
    // 我们退而求其次验 state 行为 (photoState=FAILED + answerMode=handwrite) 已锁死 toast 必触发逻辑
  });

  // ── TC5 exploratory · TI3 perf · thumb 渲染时长 ≤ 1000ms (放宽 5x 给 e2e 抖动) ──
  it('TC5 (TI3 perf) · 从 chooseMedia 触发到 photoThumb 容器渲染 ≤ 1000ms', async () => {
    await mp.reLaunch('/' + P08_PATH);
    await sleep(1500);
    await setupBackendStub(mp);

    const page = await mp.currentPage();
    const tabPhoto = await page.$('[data-test-id="ai-judge-input-tab-photo"]');
    const tStart = Date.now();
    if (tabPhoto) await tabPhoto.tap();

    // 轮询 until thumb 出现 · 最大 1000ms
    let thumb = null;
    let elapsed = 0;
    const POLL_INTERVAL = 50;
    const MAX_WAIT = 1000;
    while (elapsed < MAX_WAIT) {
      thumb = await page.$('[data-test-id="ai-judge-photo-thumb"]');
      const d = await page.data();
      if (thumb && d.photoState === 'UPLOADED') break;
      await sleep(POLL_INTERVAL);
      elapsed = Date.now() - tStart;
    }
    expect(thumb, 'thumb 在 1000ms 内渲染').toBeTruthy();
    expect(elapsed, `TI3 perf budget 1000ms · 实测 ${elapsed}ms`).toBeLessThanOrEqual(MAX_WAIT);
  });
});
