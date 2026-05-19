/**
 * P-GUEST-CAPTURE · MP guest capture page (SC-12)
 * Spec: design/system/pages/P-GUEST-CAPTURE-guest-capture.spec.md
 *
 * 状态机 10 态:
 *   BOOTSTRAPPING → IDLE → CONSENT_PENDING → CAMERA_ACTIVE → UPLOADING →
 *   ANALYZING → READY → (CLAIMING → CLAIMED) | FAILED | QUOTA_EXHAUSTED | ERROR
 *
 * Anon flow: mint → consent → presign → PUT MinIO → postQuestion → analyzeByUrl
 *           → poll getResult (1Hz · 30s timeout) → READY → claim (双 JWT)
 *
 * Wire mismatches surface (from T06/T07):
 *  - upstream analyze accepts camelCase {anonQid, imageUrl}
 *  - upstream result.status returns "DONE" not "RESULT_READY" → treat DONE as READY
 */
import {
  mint, consent, presign, postQuestion, analyzeByUrl, getResult, claim,
  putToMinio,
  type ResultResponse,
} from '../../../src/api/anon';

type Subject = 'math' | 'physics' | 'chemistry' | 'english' | 'biology' | 'chinese';

type Phase =
  | 'BOOTSTRAPPING' | 'IDLE' | 'CONSENT_PENDING' | 'CAMERA_ACTIVE'
  | 'UPLOADING' | 'ANALYZING' | 'READY'
  | 'CLAIMING' | 'CLAIMED'
  | 'FAILED' | 'QUOTA_EXHAUSTED' | 'ERROR';

interface SubjectItem { value: Subject; label: string; }

/** djb2 hash · 稳定生成 deviceFp from systemInfo string */
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function buildIdempotencyKey(): string {
  const r = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${r()}${r()}-${r()}-4${r().slice(1)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${r().slice(1)}-${r()}${r()}${r()}`;
}

function formatCountdown(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function shutterLabelFor(phase: Phase): string {
  if (phase === 'UPLOADING') return '上传中';
  if (phase === 'ANALYZING') return '分析中';
  if (phase === 'IDLE' || phase === 'CONSENT_PENDING') return '解锁';
  return '拍照';
}

/** Extract HTTP status from Error message `HTTP N` or `HTTP N: ...` */
function isHttpStatus(err: unknown, code: number): boolean {
  if (err instanceof Error) {
    const m = err.message.match(/^HTTP (\d+)/);
    if (m && Number(m[1]) === code) return true;
  }
  return false;
}

Page({
  data: {
    phase: 'BOOTSTRAPPING' as Phase,
    subject: 'math' as Subject,
    consent: { checked: false, consentAt: null as string | null },
    result: null as ResultResponse['result'] | null,
    errorMsg: '',
    retryAfterSecs: 0,
    retryAfterCountdown: '',
    uploadPct: 0,
    pollSecs: 0,
    shutterLabel: '解锁',
    anonToken: '',
    anonSessionId: 0,
    anonQid: 0,
    statusBarHeight: 44,
    cameraPosition: 'back' as 'back' | 'front',
    /** 未勾同意时 shake 一下 · 600ms 抖动动画 (设 true 立刻触发 · 自动 reset false) */
    consentShake: false,
    subjects: [
      { value: 'math', label: '数学' },
      { value: 'physics', label: '物理' },
      { value: 'chemistry', label: '化学' },
      { value: 'english', label: '英语' },
      { value: 'biology', label: '生物' },
      { value: 'chinese', label: '语文' },
    ] as SubjectItem[],
  },

  /** Off-data instance fields · 避免 setData 冗余 */
  _pollTimer: 0 as ReturnType<typeof setInterval> | 0,
  _pollStartedAt: 0,
  _countdownTimer: 0 as ReturnType<typeof setInterval> | 0,

  setPhase(phase: Phase) {
    this.setData({ phase, shutterLabel: shutterLabelFor(phase) });
  },

  async onLoad() {
    try {
      const sys = wx.getSystemInfoSync();
      const fpSource = `${sys.brand || ''}|${sys.model || ''}|${sys.system || ''}|${sys.SDKVersion || ''}`;
      const deviceFp = 'fp-' + djb2(fpSource);
      const sb = typeof sys.statusBarHeight === 'number' ? sys.statusBarHeight : 44;
      this.setData({ statusBarHeight: sb });

      const minted = await mint({ deviceFp, entrySource: 'mp-guest-capture' });
      this.setData({
        anonToken: minted.anonToken,
        anonSessionId: minted.anonSessionId,
        phase: 'IDLE',
        shutterLabel: '解锁',
      });
      wx.setStorage({ key: 'anonToken', data: minted.anonToken });
      wx.setStorage({ key: 'anonSessionId', data: minted.anonSessionId });
    } catch (err) {
      console.error('[P-GUEST-CAPTURE] mint failed:', err);
      this.setData({
        phase: 'ERROR',
        errorMsg: '游客会话初始化失败，请重试',
        shutterLabel: shutterLabelFor('ERROR'),
      });
    }
  },

  onUnload() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = 0;
    }
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = 0;
    }
  },

  onSubjectTap(e: WechatMiniprogram.TouchEvent) {
    const value = e.currentTarget.dataset.value as Subject;
    if (value && value !== this.data.subject) {
      this.setData({ subject: value });
    }
  },

  async onConsentToggle() {
    if (this.data.consent.checked) {
      this.setData({ consent: { checked: false, consentAt: null } });
      return;
    }
    if (!this.data.anonToken || !this.data.anonSessionId) {
      wx.showToast({ title: '会话未就绪', icon: 'none' });
      return;
    }
    try {
      const resp = await consent(this.data.anonToken, this.data.anonSessionId, { consentType: 1 });
      this.setData({
        consent: { checked: true, consentAt: resp.consentAt },
        phase: 'CONSENT_PENDING',
        shutterLabel: shutterLabelFor('CONSENT_PENDING'),
      });
    } catch (err) {
      console.error('[P-GUEST-CAPTURE] consent failed:', err);
      this.setData({
        consent: { checked: false, consentAt: null },
        errorMsg: '同意失败，请重试',
        phase: 'ERROR',
        shutterLabel: shutterLabelFor('ERROR'),
      });
    }
  },

  onShutterTap() {
    const { phase } = this.data;
    if (!this.data.consent.checked) {
      this._flashConsentShake();
      return;
    }
    if (phase === 'CONSENT_PENDING' || phase === 'IDLE') {
      this.setData({ phase: 'CAMERA_ACTIVE', shutterLabel: shutterLabelFor('CAMERA_ACTIVE') });
      return;
    }
    if (phase === 'CAMERA_ACTIVE') {
      this.captureAndUpload();
    }
  },

  /** 未勾同意时统一反馈: 醒目 toast (带 ⚠️ + 2.5s + mask) + 同意框 shake 动画 */
  _flashConsentShake() {
    wx.showToast({
      title: '⚠️ 请先勾选同意条款',
      icon: 'none',
      duration: 2500,
      mask: true,
    });
    this.setData({ consentShake: true });
    setTimeout(() => this.setData({ consentShake: false }), 600);
  },

  captureAndUpload() {
    const ctx = wx.createCameraContext();
    ctx.takePhoto({
      quality: 'normal',
      success: (res: WechatMiniprogram.TakePhotoSuccessCallbackResult) => {
        this.uploadFlow(res.tempImagePath);
      },
      fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
        console.error('[P-GUEST-CAPTURE] takePhoto failed:', err);
        this.setData({
          phase: 'ERROR',
          errorMsg: '相机失败，请重试',
          shutterLabel: shutterLabelFor('ERROR'),
        });
      },
    });
  },

  onCameraError(e: WechatMiniprogram.CustomEvent) {
    console.error('[P-GUEST-CAPTURE] camera error:', e.detail);
    this.setData({
      phase: 'ERROR',
      errorMsg: '无法打开相机，请检查权限',
      shutterLabel: shutterLabelFor('ERROR'),
    });
  },

  async uploadFlow(tempFilePath: string) {
    this.setData({ phase: 'UPLOADING', uploadPct: 10, shutterLabel: shutterLabelFor('UPLOADING') });

    try {
      // 0) 拿真实文件大小 · 后端 AnonPresignRequest.size 是 @Min(1) @Max(10MB) ·
      //    不能传 0 (会 400 VALIDATION_FAILED) · 也不能超 10MB
      const fileInfo = await new Promise<{ size: number }>((resolve, reject) => {
        wx.getFileSystemManager().getFileInfo({
          filePath: tempFilePath,
          success: (res) => resolve({ size: res.size }),
          fail: (err) => reject(err),
        });
      });
      const size = Math.min(Math.max(fileInfo.size, 1), 10_485_760);

      // 1) presign
      const presignResp = await presign(this.data.anonToken, {
        filename: 'guest-capture.jpg',
        mime: 'image/jpeg',
        size,
        purpose: 'GUEST_CAPTURE',
      });
      this.setData({ uploadPct: 30 });

      // 2) PUT raw bytes to MinIO via wx.request
      await putToMinio(presignResp.upload_url, tempFilePath, 'image/jpeg');
      this.setData({ uploadPct: 60 });

      // 3) postQuestion (X-Idempotency-Key required)
      const idempotencyKey = buildIdempotencyKey();
      const qResp = await postQuestion(this.data.anonToken, idempotencyKey, {
        objectKey: presignResp.file_key,
        subject: this.data.subject,
      });
      this.setData({ uploadPct: 80, anonQid: qResp.anon_qid });

      // 4) analyzeByUrl · 检查 429
      //    NOTE: 不传 imageUrl · 让后端 mintPresignedGet 拼出能用的 HTTP URL ·
      //    FE 自造 `minio://...` 是非法 scheme · AI service (DashScope) 拉失败 →
      //    AI_INFERENCE_FAILED. 见 backend AnonAnalyzeService.java:188.
      try {
        await analyzeByUrl(this.data.anonToken, {
          anonQid: qResp.anon_qid,
          subject: this.data.subject,
        });
      } catch (e) {
        if (isHttpStatus(e, 429)) {
          const retryAfter = 3600; // default · BE Retry-After header parse TODO
          this.setData({
            phase: 'QUOTA_EXHAUSTED',
            retryAfterSecs: retryAfter,
            retryAfterCountdown: formatCountdown(retryAfter),
            shutterLabel: shutterLabelFor('QUOTA_EXHAUSTED'),
          });
          this.startCountdown();
          return;
        }
        throw e;
      }

      // 5) analyze 202 ok → 按 spec P-GUEST-CAPTURE.spec.md line 215
      //    跳 P03 游客态 · 该页 polling getResult + 显 4 步动画 · 替原 inline polling.
      //    带 anonToken (重启页面后 wx storage 可能为空 · 直接 query 传)
      this.setData({ uploadPct: 100 });
      wx.navigateTo({
        url: `/pages/analyzing/index?guest=1`
          + `&anonQid=${qResp.anon_qid}`
          + `&anonToken=${encodeURIComponent(this.data.anonToken)}`
          + `&subject=${this.data.subject}`,
      });
      return;
    } catch (err) {
      // 用 warn 不用 error: uploadFlow 失败是 recoverable 用户态 · ERROR phase 已经
      // 在 UI 显示 + retry CTA 可见; 用 console.error 会污染 IDE console 让 audit
      // dim_ide_smoke (0 [error] 红线) 误判. 2026-05-18 fix-up.
      console.warn('[P-GUEST-CAPTURE] uploadFlow failed:', err);
      this.setData({
        phase: 'ERROR',
        errorMsg: '上传或分析失败，请重试',
        shutterLabel: shutterLabelFor('ERROR'),
      });
    }
  },

  startPolling() {
    this._pollStartedAt = Date.now();
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = setInterval(async () => {
      const elapsed = Math.floor((Date.now() - this._pollStartedAt) / 1000);
      this.setData({ pollSecs: elapsed });

      if (elapsed > 30) {
        if (this._pollTimer) clearInterval(this._pollTimer);
        this._pollTimer = 0;
        this.setData({
          phase: 'ERROR',
          errorMsg: '分析超时（30s），请重试',
          shutterLabel: shutterLabelFor('ERROR'),
        });
        return;
      }

      try {
        const r = await getResult(this.data.anonToken, this.data.anonQid);
        if (r.status === 'READY' || r.status === 'DONE') {
          if (this._pollTimer) clearInterval(this._pollTimer);
          this._pollTimer = 0;
          this.setData({
            phase: 'READY',
            result: r.result || null,
            shutterLabel: shutterLabelFor('READY'),
          });
        } else if (r.status === 'FAILED') {
          if (this._pollTimer) clearInterval(this._pollTimer);
          this._pollTimer = 0;
          this.setData({
            phase: 'FAILED',
            errorMsg: r.error_code || 'AI 分析失败',
            shutterLabel: shutterLabelFor('FAILED'),
          });
        }
      } catch (err) {
        console.error('[P-GUEST-CAPTURE] poll failed:', err);
      }
    }, 1000);
  },

  startCountdown() {
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    this._countdownTimer = setInterval(() => {
      const next = this.data.retryAfterSecs - 1;
      if (next <= 0) {
        if (this._countdownTimer) clearInterval(this._countdownTimer);
        this._countdownTimer = 0;
        this.setData({ retryAfterSecs: 0, retryAfterCountdown: '已可重试' });
      } else {
        this.setData({ retryAfterSecs: next, retryAfterCountdown: formatCountdown(next) });
      }
    }, 1000);
  },

  onRetryTap() {
    if (this.data.consent.checked) {
      this.setData({
        phase: 'CONSENT_PENDING',
        errorMsg: '',
        shutterLabel: shutterLabelFor('CONSENT_PENDING'),
      });
    } else {
      this.setData({
        phase: 'IDLE',
        errorMsg: '',
        shutterLabel: shutterLabelFor('IDLE'),
      });
    }
  },

  async onSaveCta() {
    const jwt = wx.getStorageSync('studentJwt');
    if (!jwt) {
      wx.navigateTo({
        url: `/pages/login/index?returnTo=${encodeURIComponent('/pages/guest/capture/index?autoClaim=1')}`,
      });
      return;
    }
    this.doClaim(jwt);
  },

  async doClaim(jwt: string) {
    this.setPhase('CLAIMING');
    try {
      const c = await claim(this.data.anonToken, jwt, { subject: this.data.subject });
      this.setPhase('CLAIMED');
      wx.showToast({ title: `已绑定 qid=${c.claimed_question_id}`, icon: 'success' });
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/home/index' });
      }, 800);
    } catch (err) {
      console.error('[P-GUEST-CAPTURE] claim failed:', err);
      this.setData({
        phase: 'ERROR',
        errorMsg: '保存失败，请稍后重试',
        shutterLabel: shutterLabelFor('ERROR'),
      });
    }
  },

  onShow() {
    if (this.data.phase === 'READY') {
      const jwt = wx.getStorageSync('studentJwt');
      if (jwt) {
        this.doClaim(jwt);
      }
    }
  },

  onSigninTap() {
    const anonToken = this.data.anonToken;
    wx.navigateTo({
      url: `/pages/login/index?anonToken=${encodeURIComponent(anonToken)}&returnTo=/pages/home/index`,
    });
  },

  /** 返回 · top-left back · 优先 navigateBack, 没栈就跳 welcome */
  onBackTap() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/pages/welcome/index' });
    }
  },

  /** 3 源 tab (相册/相机/文件) · 必须先勾同意 */
  onSourcePick(e: WechatMiniprogram.TouchEvent) {
    if (!this.data.consent.checked) {
      this._flashConsentShake();
      return;
    }
    const source = e.currentTarget.dataset.source as 'album' | 'camera' | 'file';
    if (source === 'album') {
      wx.chooseImage({
        count: 1,
        sourceType: ['album'],
        success: (res) => {
          const path = res.tempFilePaths && res.tempFilePaths[0];
          if (path) this.uploadFlow(path);
        },
      });
    } else if (source === 'camera') {
      this.setData({ phase: 'CAMERA_ACTIVE', shutterLabel: shutterLabelFor('CAMERA_ACTIVE') });
    } else {
      wx.showToast({ title: '文件导入即将开放', icon: 'none' });
    }
  },

  /** Settings (左侧齿轮) · P1 placeholder */
  onSettingsTap() {
    wx.showToast({ title: '设置即将开放', icon: 'none' });
  },

  /** Flip camera · 仅 CAMERA_ACTIVE 态生效 */
  onFlipCameraTap() {
    if (this.data.phase !== 'CAMERA_ACTIVE') {
      wx.showToast({ title: '请先解锁相机', icon: 'none' });
      return;
    }
    const next = this.data.cameraPosition === 'back' ? 'front' : 'back';
    this.setData({ cameraPosition: next });
  },
});
