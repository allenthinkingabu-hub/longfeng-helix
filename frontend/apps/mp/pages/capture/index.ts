/**
 * P02 拍题页 · 1:1 mirror design/mockups/wrongbook/02_capture.html
 * 状态机: IDLE → UPLOADING → UPLOADED → [nav P03] / ERROR
 * API: presign (file-service :8084) + createQuestion (wrongbook-service :8082)
 * trace: design/mockups/wrongbook/02_capture.html · @longfeng/testids p02
 */
import { presign } from '../../src/api/file';
import { createQuestion } from '../../src/api/wrongbook';

type Subject = 'math' | 'physics' | 'chemistry' | 'english' | 'chinese';
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

    try {
      // Step 1: presign
      const presignResp = await presign({
        mime: 'image/jpeg',
        size,
        filename: 'capture.jpg',
      });
      this.setData({ uploadPct: 20 });

      // Step 2: upload file to presigned URL via wx.uploadFile
      await new Promise<void>((resolve, reject) => {
        wx.uploadFile({
          url: presignResp.upload_url,
          filePath: tempFilePath,
          name: 'file',
          header: { 'Content-Type': 'image/jpeg' },
          success: (uploadRes: WechatMiniprogram.UploadFileSuccessCallbackResult) => {
            if (uploadRes.statusCode >= 200 && uploadRes.statusCode < 400) {
              resolve();
            } else {
              reject(new Error(`Upload failed: ${uploadRes.statusCode}`));
            }
          },
          fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
            reject(new Error(err.errMsg));
          },
        });
      });
      this.setData({ uploadPct: 60 });

      // Step 3: create question record
      const created = await createQuestion({
        studentId: 1,
        subject: this.data.subject,
        image_key: presignResp.file_key,
        mime: 'image/jpeg',
        source_type: 1,
      });
      this.setData({ uploadPct: 100, state: 'UPLOADED' });

      // Step 4: navigate to analyzing page (pass imageUrl for AI analysis kickoff)
      const imageUrl = encodeURIComponent(presignResp.image_url);
      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/analyzing/index?imageUrl=${imageUrl}&subject=${this.data.subject}&qid=${created.qid}`,
        });
      }, 300);
    } catch {
      this.setData({ state: 'ERROR', errorMsg: '上传失败，请重试' });
    }
  },

  onTabHome() {
    wx.reLaunch({ url: '/pages/home/index' });
  },

  onTabWrongbook() {
    wx.navigateTo({ url: '/pages/wrongbook-list/index' });
  },
});
