import { http, HttpResponse } from 'msw';

const FAKE_FILE_KEY = 'mock-file-key-001';

// SC-01 异常 · 测试通过 localStorage flag 让 presign 返回 500 · MSW handler 在 service worker 内
// 跑，能读取 self.localStorage（注：SW 不能直接读 main thread localStorage · 必须通过 client message
// 注入；这里改为读取 cookie · 但 SW 也不能写 cookie · 最终采用 query param marker · 也不行）
// → 真实可行：MSW handler 通过 fetch back 到 main thread 的 /__lf_e2e_flag 路径取状态 · 重 IO
// → 折中：让 main thread 把 flag 写到 cookie (document.cookie) · SW 内 self.cookies 不可读
// → 最终方案：spec 直接改用 worker.use() runtime override，handler 这里只判 cookie/header 兜底
function shouldFailPresign(request: Request): boolean {
  // 1) header 标记（spec.evaluate 里 fetch 注入 · page.setExtraHTTPHeaders 也可）
  if (request.headers.get('x-e2e-fail-presign') === '1') return true;
  // 2) cookie 标记（document.cookie 写入后 fetch 自动带）
  const cookie = request.headers.get('cookie') ?? '';
  if (/(?:^|;\s*)lf_e2e_presign_fail=1/.test(cookie)) return true;
  return false;
}

export const captureHandlers = [
  http.post('/api/v1/files/presign', ({ request }) => {
    if (shouldFailPresign(request)) {
      return new HttpResponse(JSON.stringify({ error: 'presign_failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return HttpResponse.json({
      file_key: FAKE_FILE_KEY,
      upload_url: 'https://mock-oss.example.com/upload',
    });
  }),

  // Mock OSS direct-upload · SC-01 directUpload step
  http.put('https://mock-oss.example.com/upload', () => new HttpResponse(null, { status: 200 })),

  http.post(`/api/v1/files/complete/${FAKE_FILE_KEY}`, () => {
    return HttpResponse.json({ file_key: FAKE_FILE_KEY, status: 'READY' });
  }),

  // SC-01-E02b · POST /api/wb/questions · returns { qid } (raw, NOT ApiResult-wrapped).
  // Backend: QuestionDetailController.create() (see wrongbook-service).
  // Idempotency: replays of same X-Idempotency-Key MUST return identical qid.
  http.post('/api/wb/questions', ({ request }) => {
    const idemKey =
      request.headers.get('x-idempotency-key') ??
      request.headers.get('X-Idempotency-Key') ??
      `nokey-${Date.now()}`;
    // Stable qid derived from idem key so retries get the same value.
    const qid = `qid-${idemKey.slice(0, 12)}`;
    return HttpResponse.json({ qid }, { status: 201 });
  }),

  http.post('/api/v1/wrongbook/items', () => {
    // SC-01: 同时 push 到共享 WRONGBOOK_LIST · 让 GET /items list +1
    const newItem = {
      id: `mock-item-created-${Date.now()}`,
      subject: 'math',
      stem_text: '（MSW mock）已知函数 f(x) = x² + 2x，求 f(1) 的值。',
      tags: [] as string[],
      status: 'analyzing',
      mastery: 0,
      image_url: null,
      created_at: new Date().toISOString(),
      version: 1,
    };
    // 动态 import 避免循环依赖
    void import('./wrongbook').then(({ pushWrongbookItem }) => {
      pushWrongbookItem(newItem);
    });
    return HttpResponse.json(newItem, { status: 201 });
  }),
];
