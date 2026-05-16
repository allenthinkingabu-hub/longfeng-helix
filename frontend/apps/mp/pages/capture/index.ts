/**
 * P02 拍题页 · 1:1 mirror design/mockups/wrongbook/02_capture.html
 * 状态机: IDLE → UPLOADING → UPLOADED → [nav P03] / ERROR
 * API: presign (file-service :8084) + createQuestion (wrongbook-service :8082)
 * trace: design/mockups/wrongbook/02_capture.html · @longfeng/testids p02
 */
import { presign } from '../../src/api/file';
import { createQuestion } from '../../src/api/wrongbook';

type Subject = 'math' | 'physics' | 'chemistry' | 'english' | 'chinese';

/** RFC 4122-ish v4 generator using Math.random — fine for an Idempotency-Key
 *  client token (server treats it opaquely). MP has no global `crypto`. */
function buildIdempotencyKey(): string {
  const rand = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${rand()}${rand()}-${rand()}-4${rand().slice(1)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${rand().slice(1)}-${rand()}${rand()}${rand()}`;
}
type CaptureState = 'IDLE' | 'UPLOADING' | 'UPLOADED' | 'ERROR';

interface SubjectItem {
  value: Subject;
  label: string;
  testid: string;
}

interface ModeItem {
  value: string;
  label: string;
  testid: string;
}

Page({
  data: {
    state: 'IDLE' as CaptureState,
    subject: 'math' as Subject,
    mode: 'photo' as string,
    flashOn: false,
    uploadPct: 0,
    errorMsg: '' as string,
    subjects: [
      { value: 'math', label: '数学', testid: 'subject-chip-math' },
      { value: 'physics', label: '物理', testid: 'subject-chip-physics' },
      { value: 'chemistry', label: '化学', testid: 'subject-chip-chemistry' },
      { value: 'english', label: '英语', testid: 'subject-chip-english' },
      { value: 'chinese', label: '语文', testid: 'subject-chip-chinese' },
    ] as SubjectItem[],
    modeList: [
      { value: 'album', label: '相册', testid: 'p02-mode-tabs-tab-1' },
      { value: 'photo', label: '拍题', testid: 'p02-mode-tabs-tab-2' },
      { value: 'doc', label: '文档', testid: 'p02-mode-tabs-tab-3' },
    ] as ModeItem[],
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  onToggleFlash() {
    this.setData({ flashOn: !this.data.flashOn });
  },

  onSubjectTap(e: WechatMiniprogram.TouchEvent) {
    const value = e.currentTarget.dataset.value as Subject;
    if (value && value !== this.data.subject) {
      this.setData({ subject: value });
    }
  },

  onModeTap(e: WechatMiniprogram.TouchEvent) {
    const value = e.currentTarget.dataset.value as string;
    if (value && value !== this.data.mode) {
      this.setData({ mode: value });
    }
  },

  onShutterTap() {
    if (this.data.state === 'UPLOADING') return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      camera: this.data.flashOn ? 'front' : 'back',
      success: (res: WechatMiniprogram.ChooseMediaSuccessCallbackResult) => {
        const file = res.tempFiles[0];
        if (file) {
          this.handleCapture(file.tempFilePath, file.size);
        }
      },
    });
  },

  onGalleryTap() {
    if (this.data.state === 'UPLOADING') return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res: WechatMiniprogram.ChooseMediaSuccessCallbackResult) => {
        const file = res.tempFiles[0];
        if (file) {
          this.handleCapture(file.tempFilePath, file.size);
        }
      },
    });
  },

  async handleCapture(tempFilePath: string, size: number) {
    const MAX_BYTES = 10 * 1024 * 1024;
    if (size > MAX_BYTES) {
      this.setData({ errorMsg: '图片过大（最大 10MB）', state: 'ERROR' });
      return;
    }

    this.setData({ state: 'UPLOADING', uploadPct: 0, errorMsg: '' });

    // One idempotency key per capture attempt — shared by presign + createQuestion
    // so a weak-network retry of the same shutter press dedupes on both
    // wb_file (file-service) and wb_question (wrongbook-service).
    const idempotencyKey = buildIdempotencyKey();

    try {
      // Step 1: presign (backend requires X-Idempotency-Key per SC-01-T01 AC6).
      const presignResp = await presign({
        mime: 'image/jpeg',
        size,
        filename: 'capture.jpg',
        idempotencyKey,
      });
      this.setData({ uploadPct: 20 });

      // Step 2: PUT raw bytes to presigned URL.
      //
      // wx.uploadFile() can't be used here: it always wraps the body in
      // multipart/form-data, but MinIO/S3 presigned PUT URLs are signed for a
      // RAW body with the exact Content-Type passed to presign(). Multipart
      // wrapping changes both the bytes and the effective content-type, so the
      // signature check fails and the user sees "上传失败,请重试".
      //
      // Workaround: read the temp file into an ArrayBuffer and PUT it via
      // wx.request with the matching Content-Type.
      const fileBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        wx.getFileSystemManager().readFile({
          filePath: tempFilePath,
          success: (res) => resolve(res.data as ArrayBuffer),
          fail: (err) => reject(new Error(`readFile failed: ${err.errMsg}`)),
        });
      });

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
              reject(new Error(`PUT failed: ${res.statusCode} ${JSON.stringify(res.data)}`));
            }
          },
          fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
            reject(new Error(err.errMsg));
          },
        });
      });
      this.setData({ uploadPct: 60 });

      // Step 3: create question record. Backend QuestionDetailController.create
      // requires X-Idempotency-Key + snake_case body (see api/wrongbook.ts).
      const created = await createQuestion({
        studentId: 1,
        subject: this.data.subject,
        image_key: presignResp.file_key,
        mime: 'image/jpeg',
        source_type: 1,
        idempotencyKey,
      });
      this.setData({ uploadPct: 100, state: 'UPLOADED' });

      // Step 4: navigate to analyzing page (pass imageUrl for AI analysis kickoff)
      const imageUrl = encodeURIComponent(presignResp.image_url);
      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/analyzing/index?imageUrl=${imageUrl}&subject=${this.data.subject}&qid=${created.qid}`,
        });
      }, 300);
    } catch (err) {
      // Surface the real failure in IDE console so the next failure mode
      // (presign / PUT / createQuestion) is one tap away instead of buried.
      console.error('[P02] handleCapture failed:', err);
      this.setData({ state: 'ERROR', errorMsg: '上传失败，请重试' });
    }
  },

});
