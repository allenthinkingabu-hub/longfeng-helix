/**
 * P00 登录页 · MP
 * trace:
 * - biz/业务与技术解决方案_AI错题本_基于日历系统.md §SC-01 + §2A.3.1 决策树节点 1
 * - design/mockups/wrongbook/00_login.html (mockup · 视觉锚)
 * - frontend/apps/h5/src/pages/Auth/Login.tsx (业务逻辑 reference · MP 重写)
 *
 * State machine: IDLE → VERIFYING → SUCCESS (wx.reLaunch /pages/home/index)
 *                              \→ FAILED (error-banner + 回 IDLE on input)
 *
 * 不在范围 (P1):
 *   - 决策树 onLaunch routing
 *   - 找回密码
 *   - 注册新用户独立流程
 */
import { login, wechatLogin } from '../../src/api/auth';

interface LoginPageData {
  phone: string;
  password: string;
  errorMsg: string;
  loading: boolean;
}

// Simple PRC mobile sanity (1 + 10 digits, head 3-9).
// Tighter syntax than backend so user gets immediate feedback instead of 4xx.
function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

Page<LoginPageData, WechatMiniprogram.IAnyObject>({
  data: {
    phone: '',
    password: '',
    errorMsg: '',
    loading: false,
  },

  onPhoneInput(e: WechatMiniprogram.Input) {
    const phone = (e.detail.value || '').trim();
    this.setData({ phone, errorMsg: this.data.errorMsg ? '' : this.data.errorMsg });
  },

  onPasswordInput(e: WechatMiniprogram.Input) {
    const password = e.detail.value || '';
    this.setData({ password, errorMsg: this.data.errorMsg ? '' : this.data.errorMsg });
  },

  /** Map a low-level HTTP throw into user-facing copy. */
  mapError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    if (/HTTP\s*401/.test(msg)) return '手机号或密码错误';
    if (/HTTP\s*423/.test(msg)) return '账号已锁定，5 分钟后重试';
    if (/HTTP\s*4\d\d/.test(msg)) return '请求异常，请稍后重试';
    if (/HTTP\s*5\d\d/.test(msg)) return '服务暂不可用，请稍后重试';
    return '网络异常，请检查后重试';
  },

  async onLogin() {
    if (this.data.loading) return;

    const { phone, password } = this.data;
    if (!isValidPhone(phone)) {
      this.setData({ errorMsg: '请输入有效的 11 位手机号' });
      return;
    }
    if (!password || password.length < 6) {
      this.setData({ errorMsg: '密码至少 6 位' });
      return;
    }

    this.setData({ loading: true, errorMsg: '' });
    try {
      const resp = await login({ phone, password, provider: 'PHONE' });
      // JWT 持久化 (spec §5 #2 wire: resp.jwt + resp.student.id)
      wx.setStorageSync('jwt', resp.jwt);
      wx.setStorageSync('studentJwt', resp.jwt); // P-GUEST-CAPTURE claim 流程用
      if (resp.student) wx.setStorageSync('userId', resp.student.id);
      if (resp.refreshToken) wx.setStorageSync('refreshToken', resp.refreshToken);
      const expiresAt = Date.now() + resp.expiresIn * 1000;
      wx.setStorageSync('expiresAt', expiresAt);

      // SUCCESS → 跳 home (reLaunch 清栈 · 防回退到登录页)
      wx.reLaunch({ url: '/pages/home/index' });
    } catch (err) {
      this.setData({ errorMsg: this.mapError(err), loading: false });
    }
  },

  /** Map WeChat-specific HTTP codes · 503/401/502 各自映射用户友好文案. */
  mapWechatError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    if (/HTTP\s*503/.test(msg)) return '微信登录暂未配置（后台未就绪），请暂用手机号';
    if (/HTTP\s*401/.test(msg)) return '微信授权码已失效，请重试';
    if (/HTTP\s*502/.test(msg)) return '微信服务暂不可达，请稍后重试';
    if (/HTTP\s*4\d\d/.test(msg)) return '微信登录失败，请重试';
    if (/HTTP\s*5\d\d/.test(msg)) return '服务暂不可用，请稍后重试';
    return '网络异常，请检查后重试';
  },

  onWechatLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true, errorMsg: '' });

    wx.login({
      success: async (loginRes: WechatMiniprogram.LoginSuccessCallbackResult) => {
        if (!loginRes.code) {
          this.setData({ errorMsg: '微信授权失败，请重试', loading: false });
          return;
        }
        try {
          const resp = await wechatLogin({ code: loginRes.code });
          wx.setStorageSync('jwt', resp.jwt);
          wx.setStorageSync('studentJwt', resp.jwt);
          if (resp.student) wx.setStorageSync('userId', resp.student.id);
          if (resp.refreshToken) wx.setStorageSync('refreshToken', resp.refreshToken);
          const expiresAt = Date.now() + resp.expiresIn * 1000;
          wx.setStorageSync('expiresAt', expiresAt);
          if (resp.isNew) {
            wx.showToast({ title: '欢迎新用户 · 已为你创建账号', icon: 'success', duration: 1200 });
            setTimeout(() => wx.reLaunch({ url: '/pages/home/index' }), 1200);
          } else {
            wx.reLaunch({ url: '/pages/home/index' });
          }
        } catch (err) {
          this.setData({ errorMsg: this.mapWechatError(err), loading: false });
        }
      },
      fail: () => {
        this.setData({ errorMsg: '微信授权失败，请重试', loading: false });
      },
    });
  },
});
