/**
 * MSW handlers · P03 Analyzing + SSE mock
 * C-14 caveat: ai-analysis 后端编译 fail · 用 MSW 模拟 SSE 4-step 响应
 *
 * SSE 格式: data: {"type":"STEP_START","step":1}\n\n
 */
import { http, HttpResponse } from 'msw';

const MOCK_TASK_ID = 'mock-task-id';
const MOCK_QID = 'mock-qid-001';

/** SC-07: fallback task → 主 provider 已降级（前端预设 banner）· 备用继续完成全部 4 步 */
const FALLBACK_SSE_EVENTS = [
  { type: 'STEP_START', step: 1 },
  { type: 'STEP_DONE',  step: 1, durationMs: 240 },
  { type: 'STEP_START', step: 2 },
  { type: 'STEP_DONE',  step: 2, durationMs: 1100 },
  { type: 'STEP_START', step: 3 },
  { type: 'STEP_DONE',  step: 3, durationMs: 950 },
  { type: 'STEP_START', step: 4 },
  { type: 'STEP_DONE',  step: 4, durationMs: 1200 },
  { type: 'DONE' },
];

// SSE stream helper
function makeSseResponse(events: object[]): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      // MSW Service Worker 不支持真流式 (会 buffer 整 stream 直到 close)
      // 改为同步全 enqueue · 行为对外仍是 SSE 帧分隔 · 客户端按 \n\n 解析
      for (const e of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      }
      controller.close();
    },
  });
}

const SSE_EVENTS = [
  { type: 'STEP_START', step: 1 },
  { type: 'STEP_DONE',  step: 1, durationMs: 240 },
  { type: 'STEP_START', step: 2 },
  { type: 'PARTIAL_JSON', partialJson: '{"stem":"已知函数 f(x)=x²-4x+3...' },
  { type: 'STEP_DONE',  step: 2, durationMs: 1200 },
  { type: 'STEP_START', step: 3 },
  { type: 'PARTIAL_JSON', partialJson: ',"kp":["二次函数","求根公式"]' },
  { type: 'STEP_DONE',  step: 3, durationMs: 980 },
  { type: 'STEP_START', step: 4 },
  { type: 'PARTIAL_JSON', partialJson: ',"steps":[{"i":1,"t":"移项变形"}]}' },
  { type: 'STEP_DONE',  step: 4, durationMs: 1100 },
  { type: 'DONE' },
];

export const analyzingHandlers = [
  // SSE stream
  http.get('/api/ai/stream/:taskId', ({ params }) => {
    // SC-07: mock-task-id-fallback → 模拟主 provider 不可用 · 触发 fallback banner
    const isFallback = params.taskId === 'mock-task-id-fallback';
    const stream = makeSseResponse(isFallback ? FALLBACK_SSE_EVENTS : SSE_EVENTS);
    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }),

  // Cancel
  http.post('/api/ai/cancel/:taskId', () => {
    return HttpResponse.json({ status: 'CANCELLED' });
  }),

  // SC-01-E03c · Fallback (跳手填降级) · 后端 C04 已实现 · spec P03 §5
  http.post('/api/ai/fallback/:taskId', () => {
    return HttpResponse.json({ status: 'FALLBACK_MANUAL' });
  }),

  // P04: GET question detail
  http.get('/api/wb/questions/:qid', ({ params }) => {
    // SC-07: mock-low-conf-qid → confidence < 0.6 → 触发 P04 LOW_CONF state + low-conf banner
    const isLowConf = params.qid === 'mock-low-conf-qid';
    return HttpResponse.json({
      question: {
        id: params.qid ?? MOCK_QID,
        subject: 'math',
        stem: '已知函数 f(x) = x² − 4x + 3，求其顶点坐标与对称轴方程。',
        formula: 'f(x) = (x − 2)² − 1',
        myAnswer: 'B. (2, −1)',
        correctAnswer: 'A. (2, −1)',
        reasonMarkdown: '你把顶点式中 h 与 k 读反了。',
        steps: [
          { idx: 1, title: '对 f(x) 配方：', formula: 'f(x) = (x² − 4x + 4) + 3 − 4' },
          { idx: 2, title: '整理为顶点式：', formula: 'f(x) = (x − 2)² − 1' },
          { idx: 3, title: '读出顶点 (2, −1)，对称轴 x = 2。' },
        ],
        knowledgePoints: [
          { id: 'kp-1', name: '二次函数 顶点式', weight: 0.8 },
          { id: 'kp-2', name: '配方法', weight: 0.6 },
          { id: 'kp-3', name: '对称轴', weight: 0.4 },
        ],
        difficulty: 3,
        confidence: isLowConf ? 0.35 : 0.87,
        modelInfo: { name: 'qwen-vl-max', version: '2.0' },
        thumbnailUrl: null,
      },
      plannedNodes: [
        { tLevel: 'T1', dueAt: new Date().toISOString(), status: 'preview' },
        { tLevel: 'T2', dueAt: new Date(Date.now() + 86400000).toISOString(), status: 'preview' },
        { tLevel: 'T3', dueAt: new Date(Date.now() + 4 * 86400000).toISOString(), status: 'preview' },
        { tLevel: 'T4', dueAt: new Date(Date.now() + 8 * 86400000).toISOString(), status: 'preview' },
        { tLevel: 'T5', dueAt: new Date(Date.now() + 16 * 86400000).toISOString(), status: 'preview' },
        { tLevel: 'T6', dueAt: new Date(Date.now() + 35 * 86400000).toISOString(), status: 'preview' },
      ],
    });
  }),

  // P04: save
  http.post('/api/wb/questions/:qid/save', ({ params }) => {
    return HttpResponse.json({
      qid: params.qid,
      planId: 'mock-plan-id-001',
      nodes: [
        { nid: 'n1', tLevel: 'T1', dueAt: new Date().toISOString() },
        { nid: 'n2', tLevel: 'T2', dueAt: new Date(Date.now() + 86400000).toISOString() },
        { nid: 'n3', tLevel: 'T3', dueAt: new Date(Date.now() + 4 * 86400000).toISOString() },
        { nid: 'n4', tLevel: 'T4', dueAt: new Date(Date.now() + 8 * 86400000).toISOString() },
        { nid: 'n5', tLevel: 'T5', dueAt: new Date(Date.now() + 16 * 86400000).toISOString() },
        { nid: 'n6', tLevel: 'T6', dueAt: new Date(Date.now() + 35 * 86400000).toISOString() },
      ],
    }, { status: 201 });
  }),
];
