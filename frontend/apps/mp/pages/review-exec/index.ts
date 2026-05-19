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
    aiJudgeStatus: 'IDLE' as string,

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
  // 本 task scope 仅落 aiJudge.status · banner 渲染 / verdict 展示由 sibling team T05 完成
  async _triggerJudge(nid: string, imageKey: string, idempotencyKey: string) {
    this.setData({ aiJudgeStatus: 'PENDING' });
    try {
      const resp = await judgeNode(nid, { user_answer_image_key: imageKey }, idempotencyKey);
      // 本 task 不解析 verdict / confidence (留给 T05 banner) · 仅落 status
      this.setData({ aiJudgeStatus: resp.status || 'DONE' });
    } catch (err) {
      // SC-22 降级: AI 503 / 超时 → status SERVICE_UNAVAILABLE · 不阻塞学生自评 (A.3 优雅降级)
      console.warn('[P08 SC20-T04] judge call failed (banner will show fallback):', err);
      this.setData({ aiJudgeStatus: 'SERVICE_UNAVAILABLE' });
      // 注: 不 reset photoState · 已上传图仍在 OSS · 学生可继续自评
    }
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

    // Update node dots with pulse on current
    const nodeDots = this.data.nodeDots.map((dot) => {
      if (dot.idx === this.data.node.nodeIndex) {
        return { ...dot, cls: 'node-dot node-dot-now node-dot-pulse' };
      }
      return dot;
    });
    this.setData({ nodeDots });
  },

  async onGradeTap(e: WechatMiniprogram.TouchEvent) {
    const grade = e.currentTarget.dataset.grade as GradeValue;
    if (!this.data.isRevealed || this.data.isGrading) return;

    this.setData({ isGrading: true });

    // AC1: 触觉 success
    wx.vibrateShort({ type: 'heavy' });

    const timeSpentMs = Date.now() - (this._openedAt || Date.now());

    try {
      // AC2: POST /api/review/nodes/{nid}/grade (真 API)
      await gradeNode(this.data.node.nid, { grade, timeSpentMs });
      wx.showToast({ title: `已评: ${grade}`, icon: 'none' });
    } catch {
      // spec §9: 失败 toast 提示
      wx.showToast({ title: '评分提交失败', icon: 'none' });
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
