// P08 复习执行 · 1:1 mirror of design/mockups/wrongbook/08_review_exec.html
// trace: design/mockups/wrongbook/08_review_exec.html · @longfeng/testids p08
// 状态机: READING → ANSWERING → REVEALED → GRADED (mirrors H5 ReviewExec)
// API: src/api/review.ts · getNode + revealNode + gradeNode · 真 API · 0 mock
//
// SC20-T04 (M-AI-ANSWER-JUDGE satellite · 方案 A 辅助式) 加第 4 input tab 'photo':
// - 标杆模板: frontend/apps/mp/pages/capture/index.ts handleCapture()
//   复用 master §10.1 presign + wx.request PUT 二进制 OSS 直传
//   (不能用 wx.uploadFile · 会包 multipart 破签名)
// - mockup: design/mockups/wrongbook/20_review_exec_ai_judge.html L243-L302
// - spec: design/system/pages/P08-review-exec-ai-judge.spec.md §3 + §4.1 + §5
// - testid: @longfeng/testids TEST_IDS.p08AiJudge.* 4 必加 (T05 团队加另外 6)
// - 现有 3 mode tab (handwrite/keyboard/formula) 100% 保留 (KI2)
// - OSS 失败时 (TC-20.03 边界) toast '上传失败 · 请重试' + 自动切回 handwrite + 0 副作用 (AC5)
// - userAnswerImageKey 写 page state · 切回 handwrite/keyboard/formula 时不清 (TI1)

import { TEST_IDS, p08Ids } from '@longfeng/testids';
import { getNode, revealNode, gradeNode, judgeNode } from '../../src/api/review';
import { getQuestionById } from '../../src/api/wrongbook';
import { presign } from '../../src/api/file';
import { track } from '@longfeng/telemetry';
// SC20-T05: ui-kit pure-TS view-model helpers (banner + flag + chip + ribbon + grade preselected)
import {
  computeFinalGradeSource,
  deriveAiJudgeBannerViewModel,
  shouldShowAiFlag,
  deriveAiMetaChip,
  deriveAiHintRibbon,
  deriveGradeButtonsViewModel,
  type AiJudgeVerdict,
  type AiJudgeStatus,
} from '@longfeng/ui-kit';
import { translate } from '@longfeng/i18n';
import zhLocale from '@longfeng/i18n/locales/zh.json';

// BE wrong_item.subject 是 enum 小写串 (math/physics/...) · 渲染要中文标签
const SUBJECT_LABEL_MAP: Record<string, string> = {
  math: '数学', physics: '物理', chemistry: '化学', english: '英语', chinese: '语文',
};

// ─── Types ──────────────────────────────────────────────────────
type ExecState = 'READING' | 'ANSWERING' | 'REVEALED' | 'GRADED';
type GradeValue = 'FORGOT' | 'PARTIAL' | 'MASTERED';
// SC20-T04: AnswerMode 加第 4 值 'photo' (satellite §0.2 + spec §4.1)
type AnswerMode = 'handwrite' | 'keyboard' | 'formula' | 'photo';
// SC20-T04: photo tab 上传子状态 (capture → uploading → uploaded · 失败回退 IDLE)
type PhotoState = 'IDLE' | 'UPLOADING' | 'UPLOADED' | 'FAILED';

// SC20-T04: photo tab i18n (zh / en · 用户当前 locale 后续接 i18n 包再切 · 此处先 zh)
const I18N_PHOTO_TAB_ZH = '拍照';
// (en 'Photo' 字面留作单测 · 不在 UI 里直接渲染 zh+en)

// SC20-T05 · AI judge events (telemetry · satellite §2A.4 + spec §12 satellite 8 行 8 个新事件)
const TRACK_EVENTS = {
  aiDone:    'wb_judge_ai_done',     // banner 渲染时 (resp 200 + status==DONE)
  userAccept: 'wb_judge_user_accept', // tap accept CTA 或 与 AI 同的自评按钮
  userOverride: 'wb_judge_user_override', // tap 与 AI 不同的按钮 (含中间值 PARTIAL)
  aiTimeout: 'wb_judge_ai_timeout',   // 双模型超时 18s
  aiLowConf: 'wb_judge_ai_low_confidence', // confidence<0.5
} as const;

// spec §3 答题区 3 mode tab · 公式面板常用符号集 (高中数学覆盖度优先)
const FORMULA_SYMBOLS = [
  'x²', 'x³', '√', '÷', '×', '±',
  '≤', '≥', '≠', 'π', '°', '∞',
];

interface QuestionData {
  qid: string;
  stem: string;
  subject: string;
  kpName: string;
  difficulty: number;
  answer: string;
  steps: string[];
}

interface NodeData {
  nid: string;
  nodeIndex: number;
  tLevel: string;
  easeFactor: number;
}

// ─── Mock data (前端 dev 兜底 · ≤5 mock) ──────────────────────
const MOCK_QUESTION: QuestionData = {
  qid: 'mock-qid-001',
  stem: '已知函数 f(x) = x² − 4x + 3，请将其化为顶点式，并写出顶点坐标与对称轴方程。',
  subject: '数学',
  kpName: '二次函数',
  difficulty: 3,
  answer: 'f(x) = (x − 2)² − 1　　顶点 (2, −1)　对称轴 x = 2',
  steps: [
    '提取 x 的二次项与一次项，进行配方：x² − 4x = (x − 2)² − 4。',
    '将常数项合并：(x − 2)² − 4 + 3 = (x − 2)² − 1。',
    '由顶点式可得顶点坐标 (2, −1)，对称轴方程为 x = 2。',
  ],
};

const MOCK_NODE: NodeData = {
  nid: '0',
  nodeIndex: 1,
  tLevel: 'T2',
  easeFactor: 2.5,
};

const DIFFICULTY_MAP: Record<number, string> = {
  1: '简单',
  2: '较易',
  3: '中等',
  4: '较难',
  5: '困难',
};

const STARS_MAP: Record<number, string> = {
  1: '★☆☆☆☆',
  2: '★★☆☆☆',
  3: '★★★☆☆',
  4: '★★★★☆',
  5: '★★★★★',
};

// ─── Page ──────────────────────────────────────────────────────
Page({
  _openedAt: 0 as number,
  _sid: '' as string,        // P07 createSession 透传 · 用于 P09 onGradeTap 真 sid
  _nid: '' as string,        // 单题深链 / 推送进入时直接给 nid
  data: {
    // test ids
    testIds: TEST_IDS.p08,
    // SC20-T04: 第 4 input tab + UploadedAnswerThumb 子组件 testid (4 必加)
    aiJudgeIds: TEST_IDS.p08AiJudge,
    p08Ids: null as unknown,
    // SC20-T04 i18n key 兜底 (zh) · 渲染 photo tab 文案 · TI2 'exec.answer.photo'
    photoTabLabel: I18N_PHOTO_TAB_ZH,

    // state machine
    execState: 'READING' as ExecState,
    isRevealing: false,
    isGrading: false,
    showExitSheet: false,

    // spec §4.1 answerDraft · SC20-T04 加第 4 mode 'photo'
    answerMode: 'handwrite' as AnswerMode,
    userAnswer: '',                          // keyboard / formula 累积输入
    formulaSymbols: FORMULA_SYMBOLS,

    // SC20-T04 photo 路径专属 page state (TI1 切回 handwrite 不清)
    // null 时显示 placeholder + 「拍照」按钮 · 非 null 时显示 UploadedAnswerThumb
    userAnswerImageKey: '' as string,         // OSS object key · empty = 未上传
    photoState: 'IDLE' as PhotoState,
    photoSizeBytes: 0 as number,              // UploadedAnswerThumb props
    photoCapturedAt: '' as string,            // ISO time string · 渲染 "9:41:23"
    photoSizeLabel: '' as string,             // 渲染 "487 KB" (人类友好)
    photoUploadPct: 0 as number,              // 进度 0..100 (TI4 uploading 50% 态)
    // AC4: judge resp 落 page state · 详细 banner UI 由 T05 团队 + 其他 task 渲染
    // SC20-T05 (完整 aiJudge object · spec §4.1 satellite state 字段 7 个 + status)
    aiJudgeStatus: 'IDLE' as AiJudgeStatus,
    aiJudgeVerdict: null as AiJudgeVerdict | null,
    aiJudgeConfidence: 0,
    aiJudgeReason: '',
    aiJudgeMatchedSteps: [] as string[],
    aiJudgeMissedSteps: [] as string[],
    aiJudgeModelUsed: '',
    aiJudgeLatencyMs: 0,

    // SC20-T05 banner / flag / chip / hint / preselected view models (派生 · 用 ui-kit helpers)
    // 渲染端读 banner.showMain / showFallback / verdictI18nText 等 · 0 复杂 wxml logic
    bannerVm: { showMain: false, showFallback: false, fallbackText: '', confidencePct: 0, modelSubtitle: '', verdictText: '' },
    aiFlagVisible: false,
    metaChipVm: { visible: false, pct: 0 },
    hintRibbonVm: { visible: false, verdictText: '' },
    // SC20-T05 derived: 3 grade button vm (cls + ariaLabel + showMark + disabled)
    gradeBtnsVm: [] as Array<{ grade: string; cls: string; ariaLabel: string; showMark: boolean; disabled: boolean }>,
    // 直接给 wxml 文案 (i18n.t 算好)
    acceptCtaText: '采纳建议',
    overrideCtaText: '我有不同看法',
    thinkingText: 'AI 正在判题...',

    // SC20-T05: AI judge final_grade_source (派生 · onGradeTap 算 + 写 grade body)
    finalGradeSource: null as 'self' | 'ai_accepted' | 'ai_overridden' | null,

    // derived
    isRevealed: false,
    isAnswering: false,

    // question + node
    question: MOCK_QUESTION,
    node: MOCK_NODE,
    cursor: 2,
    total: 8,
    progressPct: 25,
    difficultyLabel: DIFFICULTY_MAP[MOCK_QUESTION.difficulty] || '中等',
    starsLabel: STARS_MAP[MOCK_QUESTION.difficulty] || '★★★☆☆',

    // node timeline dots (7 nodes for SM-2 schedule)
    nodeDots: [] as Array<{ idx: number; cls: string; tLevel: string; hasLine: boolean; lineGreen: boolean }>,
    nodeLabel: `${MOCK_NODE.tLevel} · 1 天后`,

    // steps for reveal
    steps: MOCK_QUESTION.steps.map((text, i) => ({
      text,
      num: i + 1,
      testId: '',
    })),
  },

  onLoad(options: Record<string, string | undefined>) {
    this._openedAt = Date.now();
    // P07 全部开始 (createSession) 透传 sid · P09 onGradeTap 要用
    this._sid = options.sid ?? '';
    // 单题深链 (P07 item tap 或 P02 推送) 直传 nid · 跳过 first nid 探测
    this._nid = options.nid ?? '';

    // Build step testIds (兜底 mock 渲染下 · 真数据回来时 _fetchNodeAndQuestion 再 rebuild)
    const steps = this.data.steps.map((s, i) => ({
      ...s,
      testId: p08Ids.revealStep(i + 1),
    }));
    this.setData({ steps, nodeDots: this._buildNodeDots(this.data.node.nodeIndex) });

    // 真 nid 透传 → 拉 BE 数据 (节点 + 题目). 没 nid (直接打开 P08 dev 路径) 保留 mock.
    // 用户反馈: 点 P07 任意题进 P08, 都显示 "二次函数 f(x)=x²−4x+3" mock · 跟实际拍的题无关.
    // spec §4.1 要求 question.stem/subject/kpName/difficulty/answer/steps 全来自 BE.
    if (this._nid) {
      this._fetchNodeAndQuestion(this._nid);
    }

    // SC20-T05: init derived view-models (preselected vm 需要 ai-flag/banner/chip/hint/buttons 全有初值)
    this._recomputeAiViewModels();
  },

  // SC20-T05 AC4 override CTA: 学生 dismiss banner 建议但还没 tap 自评按钮
  //  → 不 grade · 也不改 state · 仅静默 dismiss (preselected 仍在 · 学生可继续选)
  // 设计决策 (spec §6.2 行 5): override CTA 不直接 grade · 等学生 tap 任一自评按钮才 grade
  // (与 mockup L376 href="20_review_exec_ai_judge.html" 自指 = "停留原页" 语义一致)
  onOverrideCtaTap() {
    if (!this.data.isRevealed) return;
    // 仅震动反馈 · 不修 aiJudge state (state 仍 DONE) · 不发埋点 (等真 grade 时算 ai_overridden)
    try { wx.vibrateShort({ type: 'light' }); } catch { /* noop */ }
  },

  _buildNodeDots(currentNodeIndex: number) {
    return Array.from({ length: 7 }, (_, idx) => {
      const isPast = idx < currentNodeIndex;
      const isCurrent = idx === currentNodeIndex;
      let cls = 'node-dot';
      if (isPast) cls += ' node-dot-done';
      if (isCurrent) cls += ' node-dot-now';
      return {
        idx,
        cls,
        tLevel: `T${idx}`,
        hasLine: idx < 6,
        lineGreen: isPast,
      };
    });
  },

  // 拉真 node + question · 替换 MOCK_QUESTION/MOCK_NODE.
  // 失败时保留 mock (UI 不崩) · console.error · spec §9 降级.
  async _fetchNodeAndQuestion(nid: string) {
    try {
      const node = await getNode(nid);
      const qid = String(node.wrongItemId);
      const resp = await getQuestionById(qid);
      const q = resp.question;

      // BE knowledgePoints[] → 拼 1-3 个 KP 名作为 kpName 字符串
      const kpName = q.knowledgePoints && q.knowledgePoints.length > 0
        ? q.knowledgePoints.slice(0, 3).map((k) => k.name).join(' · ')
        : '';
      const subjectKey = (q.subject ?? '').toLowerCase();
      const subjectLabel = SUBJECT_LABEL_MAP[subjectKey] || (q.subject || '数学');
      const difficulty = typeof q.difficulty === 'number' && q.difficulty > 0 ? q.difficulty : 3;

      // BE analysis_result.steps jsonb shape: [{stepNo, text}, ...] · 兼容老 shape (explain/title)
      const stepTexts: string[] = (q.steps ?? []).map((s) => {
        const obj = s as unknown as { text?: string; explain?: string; title?: string };
        return obj.text || obj.explain || obj.title || '';
      }).filter((t) => t.length > 0);

      const newQuestion: QuestionData = {
        qid,
        stem: q.stem || '题干暂未识别 · 等 AI OCR 完成后重新进入',
        subject: subjectLabel,
        kpName,
        difficulty,
        answer: q.correctAnswer || 'AI 暂未给出答案 · 见下方解答步骤',
        steps: stepTexts.length > 0 ? stepTexts : ['AI 暂未生成解答步骤'],
      };
      const newNode: NodeData = {
        nid: String(node.id),
        nodeIndex: node.nodeIndex ?? 0,
        tLevel: `T${node.nodeIndex ?? 0}`,
        easeFactor: typeof node.easeFactor === 'number' ? node.easeFactor : 2.5,
      };

      const steps = newQuestion.steps.map((text, i) => ({
        text, num: i + 1, testId: p08Ids.revealStep(i + 1),
      }));
      this.setData({
        question: newQuestion,
        node: newNode,
        difficultyLabel: DIFFICULTY_MAP[difficulty] || '中等',
        starsLabel: STARS_MAP[difficulty] || '★★★☆☆',
        steps,
        nodeDots: this._buildNodeDots(newNode.nodeIndex),
        nodeLabel: `${newNode.tLevel} · 复习节点`,
      });
    } catch (err) {
      console.error('[P08] _fetchNodeAndQuestion failed · 保留 mock 兜底:', err);
    }
  },

  // ── State transitions ──────────────────────────────────────
  onCanvasTouch() {
    if (this.data.execState === 'READING') {
      this.setData({
        execState: 'ANSWERING' as ExecState,
        isAnswering: true,
      });
    }
  },

  // ── Answer mode tabs (spec §3 AnswerArea 4-mode · SC20-T04 加 photo) ──
  // 切换答题输入方式 · 切回 handwrite/keyboard/formula 时 userAnswerImageKey 不清 (TI1)
  // 切到 'photo' 且没已上传图: 自动唤起 wx.chooseMedia (用户可在 sheet 取消 · 不进 ANSWERING)
  onToolTap(e: WechatMiniprogram.TouchEvent) {
    const mode = e.currentTarget.dataset.mode as AnswerMode;
    if (!mode || mode === this.data.answerMode) return;
    try { wx.vibrateShort({ type: 'light' }); } catch { /* noop */ }
    this.setData({ answerMode: mode });
    // SC20-T04: 切到 photo 且未上传过 → 唤相册/相机 sheet (capture/index.ts 同 pattern)
    // 已上传过 (userAnswerImageKey 非空) → 不重唤 · 显示现有缩略图 (TI1 真值不丢)
    if (mode === 'photo' && !this.data.userAnswerImageKey && this.data.photoState !== 'UPLOADING') {
      this._openPhotoSheet();
    }
  },

  // ── SC20-T04 · 拍照作答 ───────────────────────────────────────
  // 标杆: pages/capture/index.ts onShutterTap() · wx.chooseMedia 二合一 (拍照 / 相册)
  _openPhotoSheet() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'], // 真用户优先拍 · album 兜底 (e.g. 之前拍过的草稿)
      sizeType: ['compressed'],         // 微信自动压 ≈ 500KB · 满足 §11 P95 ≤ 2s
      camera: 'back',
      success: (res) => {
        const file = res.tempFiles?.[0];
        if (file && file.tempFilePath) {
          this._handlePhotoUpload(file.tempFilePath, file.size);
        }
      },
      fail: (err) => {
        // 用户主动取消 · 不报错 · 静默切回 handwrite (UX 友好)
        console.warn('[P08] wx.chooseMedia cancel / fail:', err?.errMsg);
        this.setData({ answerMode: 'handwrite' as AnswerMode });
      },
    });
  },

  // OSS upload (presign + PUT 二进制 · 不能 wx.uploadFile · 会包 multipart 破签名)
  // 标杆: pages/capture/index.ts handleCapture() L107-194 · 复用 master §10.1 通道
  async _handlePhotoUpload(tempFilePath: string, size: number) {
    // 边界: > 10MB 拒上传 (与 capture.ts 一致 · 防 OSS 大对象拖慢 5G 网络)
    const MAX_BYTES = 10 * 1024 * 1024;
    if (size > MAX_BYTES) {
      wx.showToast({ title: '图片过大（最大 10MB）', icon: 'none' });
      this.setData({ answerMode: 'handwrite' as AnswerMode });
      return;
    }

    this.setData({
      photoState: 'UPLOADING' as PhotoState,
      photoUploadPct: 0,
      // 不立刻 set userAnswerImageKey · 等 PUT 成功才落值 (失败时不污染 page state · AC5 0 副作用)
    });

    const idempotencyKey = `judge-${this.data.node.nid}-${Date.now()}`;

    try {
      // Step 1: presign (master §10.1 现役接口 · 复用 capture.ts pattern)
      const presignResp = await presign({
        mime: 'image/jpeg',
        size,
        filename: `answer-${this.data.node.nid}-${Date.now()}.jpg`,
        idempotencyKey,
      });
      this.setData({ photoUploadPct: 20 });

      // Step 2: 读 tempFile → ArrayBuffer · PUT 原始字节
      const fileBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        wx.getFileSystemManager().readFile({
          filePath: tempFilePath,
          success: (res) => resolve(res.data as ArrayBuffer),
          fail: (err) => reject(new Error(`readFile failed: ${err.errMsg}`)),
        });
      });

      this.setData({ photoUploadPct: 50 }); // TI4 uploading 50% 态 (VRT 截图点)

      await new Promise<void>((resolve, reject) => {
        wx.request({
          url: presignResp.upload_url,
          method: 'PUT',
          data: fileBuffer,
          header: { 'Content-Type': 'image/jpeg' },
          success: (res: WechatMiniprogram.RequestSuccessCallbackResult) => {
            if (res.statusCode >= 200 && res.statusCode < 400) {
              resolve();
            } else {
              reject(new Error(`PUT failed: ${res.statusCode}`));
            }
          },
          fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
            reject(new Error(err.errMsg));
          },
        });
      });

      // PUT 成功 · 落 userAnswerImageKey 到 page state (TI1 切回 handwrite 仍保留)
      const sizeKb = Math.round(size / 1024);
      const sizeLabel = sizeKb >= 1024
        ? `${(sizeKb / 1024).toFixed(1)} MB`
        : `${sizeKb} KB`;
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const capturedAtLabel = `${hh}:${mm}:${ss}`;

      this.setData({
        photoState: 'UPLOADED' as PhotoState,
        photoUploadPct: 100,
        userAnswerImageKey: presignResp.file_key,
        photoSizeBytes: size,
        photoSizeLabel: sizeLabel,
        photoCapturedAt: capturedAtLabel,
        // 进入 ANSWERING 状态 (满足"先做再揭"的 state machine · spec §6)
        execState: 'ANSWERING' as ExecState,
        isAnswering: true,
      });

      // Step 3 (AC4): 自动调 POST :judge (T02 接口已实装)
      // 注: 本 task scope 仅 fire-and-forget 落 aiJudge.status · 详细 banner 渲染由 T05 加
      this._triggerJudge(this.data.node.nid, presignResp.file_key, idempotencyKey);
    } catch (err) {
      // AC5 / TC-20.03: OSS 失败 → toast + 自动切回 handwrite + 0 wb_review_node 字段被改
      console.error('[P08 SC20-T04] photo upload failed:', err);
      wx.showToast({ title: '上传失败 · 请重试', icon: 'none', duration: 2000 });
      this.setData({
        photoState: 'FAILED' as PhotoState,
        photoUploadPct: 0,
        userAnswerImageKey: '',          // 不落键 · 防后续 :judge 拿空 key 调坏
        photoSizeBytes: 0,
        photoSizeLabel: '',
        photoCapturedAt: '',
        answerMode: 'handwrite' as AnswerMode,  // 自动切回 (AC5 字面)
      });
    }
  },

  // AC4: photo 上传成功后自动调 POST /api/review/nodes/{nid}/judge
  // SC20-T04 (T04 落地 status only) · SC20-T05 扩展: 落完整 verdict / confidence / reason /
  //   matchedSteps / missedSteps / modelUsed / latencyMs · 算 banner view-model + 埋点 wb_judge_ai_done
  async _triggerJudge(nid: string, imageKey: string, idempotencyKey: string) {
    const judgeStartedAt = Date.now();
    this.setData({ aiJudgeStatus: 'PENDING' as AiJudgeStatus });
    this._recomputeAiViewModels();

    try {
      const resp = await judgeNode(nid, { user_answer_image_key: imageKey }, idempotencyKey);
      const latencyMs = Date.now() - judgeStartedAt;
      // SC20-T05 · 完整字段落 page state (spec §4.1 aiJudge 7 字段 + status)
      const status = (resp.status || 'DONE') as AiJudgeStatus;
      this.setData({
        aiJudgeStatus: status,
        aiJudgeVerdict: (status === 'DONE' ? (resp.verdict as AiJudgeVerdict) : null),
        aiJudgeConfidence: typeof resp.confidence === 'number' ? resp.confidence : 0,
        aiJudgeReason: resp.reason || '',
        aiJudgeMatchedSteps: Array.isArray(resp.matched_steps) ? resp.matched_steps : [],
        aiJudgeMissedSteps: Array.isArray(resp.missed_steps) ? resp.missed_steps : [],
        aiJudgeModelUsed: 'claude-3.5-sonnet', // 默认主模型 · 后端 fallback 后续可 propagate
        aiJudgeLatencyMs: latencyMs,
      });
      this._recomputeAiViewModels();

      // AC6 · 埋点 wb_judge_ai_done (banner 渲染时 · status='DONE' 或退化 status 都发 · 用 status 字段区分)
      track(TRACK_EVENTS.aiDone, {
        nid,
        verdict: resp.verdict || null,
        confidence: typeof resp.confidence === 'number' ? resp.confidence : 0,
        ms: latencyMs,
        model_used: 'claude-3.5-sonnet',
        status,
      });

      // §9 异常路径 · LOW_CONFIDENCE 额外埋点
      if (status === 'LOW_CONFIDENCE') {
        track(TRACK_EVENTS.aiLowConf, { nid, confidence: resp.confidence });
      }
      // §9 异常路径 · TIMEOUT 额外埋点
      if (status === 'TIMEOUT') {
        track(TRACK_EVENTS.aiTimeout, { nid, ms: latencyMs });
      }
    } catch (err) {
      // SC-22 降级: AI 503 / 超时 → status SERVICE_UNAVAILABLE · 不阻塞学生自评 (A.3 优雅降级)
      console.warn('[P08 SC20-T05] judge call failed (banner will show fallback):', err);
      this.setData({
        aiJudgeStatus: 'SERVICE_UNAVAILABLE' as AiJudgeStatus,
        aiJudgeVerdict: null,
        aiJudgeConfidence: 0,
      });
      this._recomputeAiViewModels();
      // 注: 不 reset photoState · 已上传图仍在 OSS · 学生可继续自评
    }
  },

  // SC20-T05: 把 aiJudge state + revealed 翻成 derived view-models · wxml 直接绑 ·
  //   0 复杂 wxml logic · 所有 i18n 字符串在这里 translate() 算好后塞进 page data.
  _recomputeAiViewModels() {
    const d = this.data;
    const bannerProps = {
      verdict: d.aiJudgeVerdict,
      confidence: d.aiJudgeConfidence,
      reason: d.aiJudgeReason,
      matchedSteps: d.aiJudgeMatchedSteps,
      missedSteps: d.aiJudgeMissedSteps,
      status: d.aiJudgeStatus,
      modelUsed: d.aiJudgeModelUsed,
      latencyMs: d.aiJudgeLatencyMs,
    };
    const bannerRaw = deriveAiJudgeBannerViewModel(bannerProps);

    const bannerVm = {
      showMain: bannerRaw.showMain,
      showFallback: bannerRaw.showFallback,
      fallbackText: bannerRaw.fallbackI18nKey
        ? translate(zhLocale, bannerRaw.fallbackI18nKey)
        : '',
      confidencePct: bannerRaw.confidencePct,
      modelSubtitle: bannerRaw.modelSubtitle,
      verdictText: bannerRaw.verdictI18nKey
        ? translate(zhLocale, bannerRaw.verdictI18nKey)
        : '',
    };

    const aiFlagVisible = shouldShowAiFlag({ status: d.aiJudgeStatus });
    const metaChipRaw = deriveAiMetaChip({ status: d.aiJudgeStatus, confidence: d.aiJudgeConfidence });
    const metaChipVm = { visible: metaChipRaw.visible, pct: metaChipRaw.pct };

    const hintRaw = deriveAiHintRibbon({ aiVerdict: d.aiJudgeVerdict, status: d.aiJudgeStatus });
    const hintRibbonVm = {
      visible: hintRaw.visible,
      verdictText: hintRaw.verdictI18nKey
        ? translate(zhLocale, hintRaw.verdictI18nKey)
        : '',
    };

    // grade buttons preselected (只 DONE 时预选 · 退化态不预选 = A.3 + spec §6.2 字面)
    const preselected: AiJudgeVerdict | null =
      d.aiJudgeStatus === 'DONE' && d.aiJudgeVerdict ? d.aiJudgeVerdict : null;
    const gradeBtnsRaw = deriveGradeButtonsViewModel({
      revealed: d.isRevealed,
      preselected,
      masteredEnabled: true,
      isGrading: d.isGrading,
    });
    const gradeBtnsVm = gradeBtnsRaw.map((b) => ({
      grade: b.grade,
      cls: b.cls,
      ariaLabel: b.ariaLabel,
      showMark: b.showMark,
      disabled: b.disabled,
    }));

    this.setData({
      bannerVm,
      aiFlagVisible,
      metaChipVm,
      hintRibbonVm,
      gradeBtnsVm,
      acceptCtaText: translate(zhLocale, 'exec.judge.cta.accept'),
      overrideCtaText: translate(zhLocale, 'exec.judge.cta.override'),
      thinkingText: translate(zhLocale, 'exec.judge.thinking'),
    });
  },

  // keyboard mode · <textarea> input
  onKeyboardInput(e: WechatMiniprogram.Input) {
    const v = (e.detail.value ?? '') as string;
    const patch: Record<string, unknown> = { userAnswer: v };
    if (this.data.execState === 'READING' && v.length > 0) {
      patch.execState = 'ANSWERING' as ExecState;
      patch.isAnswering = true;
    }
    this.setData(patch);
  },

  // formula mode · 点符号插入 userAnswer
  onFormulaInsert(e: WechatMiniprogram.TouchEvent) {
    const sym = e.currentTarget.dataset.sym as string;
    if (!sym) return;
    try { wx.vibrateShort({ type: 'light' }); } catch { /* noop */ }
    const next = (this.data.userAnswer ?? '') + sym;
    const patch: Record<string, unknown> = { userAnswer: next };
    if (this.data.execState === 'READING') {
      patch.execState = 'ANSWERING' as ExecState;
      patch.isAnswering = true;
    }
    this.setData(patch);
  },

  // formula mode · 退格
  onFormulaBackspace() {
    const cur = this.data.userAnswer ?? '';
    if (cur.length === 0) return;
    try { wx.vibrateShort({ type: 'light' }); } catch { /* noop */ }
    // 注意 · 部分符号 (x² 等) 是 2 char · Array.from 按字素切
    const arr = Array.from(cur);
    arr.pop();
    this.setData({ userAnswer: arr.join('') });
  },

  // formula mode · 清空
  onFormulaClear() {
    if ((this.data.userAnswer ?? '').length === 0) return;
    try { wx.vibrateShort({ type: 'light' }); } catch { /* noop */ }
    this.setData({ userAnswer: '' });
  },

  async onRevealTap() {
    if (this.data.execState !== 'ANSWERING' || this.data.isRevealing) return;

    this.setData({ isRevealing: true });

    // AC1: 触觉 light
    wx.vibrateShort({ type: 'light' });

    try {
      // AC2: POST /api/review/nodes/{nid}/reveal → 200 (真 API)
      await revealNode(this.data.node.nid);
    } catch {
      // spec §9: 502 失败 UI 仍展开答案 (eventually consistent)
    }

    this.setData({
      execState: 'REVEALED' as ExecState,
      isRevealing: false,
      isRevealed: true,
      isAnswering: false,
    });

    // SC20-T05: revealed 翻成 grade buttons preselected ring 可见 · recompute vm
    this._recomputeAiViewModels();

    // Update node dots with pulse on current
    const nodeDots = this.data.nodeDots.map((dot) => {
      if (dot.idx === this.data.node.nodeIndex) {
        return { ...dot, cls: 'node-dot node-dot-now node-dot-pulse' };
      }
      return dot;
    });
    this.setData({ nodeDots });
  },

  // SC20-T05 AC4: tap accept CTA = tap 对应 (aiVerdict 同名) 的自评按钮
  //   body 字面 diff = 0 · 满足 TI1
  // Synthesize touch event-like object · 直走 onGradeTap 不重复 grade logic
  async onAcceptCtaTap() {
    if (!this.data.isRevealed || this.data.isGrading) return;
    const aiV = this.data.aiJudgeVerdict;
    if (!aiV || this.data.aiJudgeStatus !== 'DONE') return;
    // 等价于 tap 对应自评按钮 · 走 onGradeTap (单一入口 · body 字面对齐 · A.2 双信源溯源)
    await this.onGradeTap({
      currentTarget: { dataset: { grade: aiV } },
    } as unknown as WechatMiniprogram.TouchEvent);
  },

  async onGradeTap(e: WechatMiniprogram.TouchEvent) {
    const grade = e.currentTarget.dataset.grade as GradeValue;
    if (!this.data.isRevealed || this.data.isGrading) return;

    this.setData({ isGrading: true });

    // AC1: 触觉 success
    wx.vibrateShort({ type: 'heavy' });

    const timeSpentMs = Date.now() - (this._openedAt || Date.now());

    // SC20-T05 AC4: 算 final_grade_source · 满足 §6.3 三态规则 (A.2 双信源溯源)
    const aiJudgeSnap = this.data.aiJudgeStatus === 'IDLE'
      ? null
      : { status: this.data.aiJudgeStatus, verdict: this.data.aiJudgeVerdict };
    const finalGradeSource = computeFinalGradeSource(grade as AiJudgeVerdict, aiJudgeSnap);
    this.setData({ finalGradeSource });

    // SC20-T05 AC4: idempotency key (tap CTA / tap 按钮 反复都用同 key · TI1 idempotent 用 nid)
    const idempotencyKey = `grade-${this.data.node.nid}`;

    try {
      // AC2 + SC20-T05 AC4: POST /grade body 携 final_grade_source (后端 SC20-T03 已落地)
      await gradeNode(
        this.data.node.nid,
        { grade, timeSpentMs, final_grade_source: finalGradeSource },
        idempotencyKey,
      );
      wx.showToast({ title: `已评: ${grade}`, icon: 'none' });
    } catch {
      // spec §9: 失败 toast 提示
      wx.showToast({ title: '评分提交失败', icon: 'none' });
    }

    // SC20-T05 AC6 埋点 · 按 final_grade_source 区分 accept / override
    // (self 不发 · master 现有埋点 wb_exec_grade 已覆盖纯自评)
    if (finalGradeSource === 'ai_accepted') {
      track(TRACK_EVENTS.userAccept, {
        nid: this.data.node.nid,
        ai_verdict: this.data.aiJudgeVerdict,
      });
    } else if (finalGradeSource === 'ai_overridden') {
      track(TRACK_EVENTS.userOverride, {
        nid: this.data.node.nid,
        ai_verdict: this.data.aiJudgeVerdict,
        user_verdict: grade,
      });
    }

    this.setData({
      execState: 'GRADED' as ExecState,
      isGrading: false,
      isRevealed: false, // 连点防护: GRADED 后禁止重复评分
    });

    // T12: GRADED → P09 transition (mirrors H5 ReviewExec handleGrade)
    // sid 优先来自 P07 onLoad 透传 · 没有时 fallback mock 以兼容直接打开 P08 的 dev 路径
    const sid = this._sid || 'mock-sid-001';
    const nid = this._nid || this.data.node.nid;
    wx.navigateTo({
      url: `/pages/review-done/index?sid=${encodeURIComponent(sid)}&grade=${grade}&nodeId=${encodeURIComponent(nid)}`,
    });
  },

  // ── Exit confirm sheet ──────────────────────────────────────
  onCloseTap() {
    this.setData({ showExitSheet: true });
  },

  onExitCancel() {
    this.setData({ showExitSheet: false });
  },

  onExitConfirm() {
    this.setData({ showExitSheet: false });
    wx.navigateBack();
  },

  onBackTap() {
    wx.navigateBack();
  },
});
