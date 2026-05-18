/**
 * P-SHARED · 分享链只读预览 (MP 真页)
 *
 * trace:
 * - design/system/pages/P-SHARED-shared.spec.md §2/§4/§6/§9/§13
 * - biz §2A.3.2 P-SHARED 规格卡 (脱敏边界 + 升级 CTA + 写操作 403)
 * - biz §2B.14 SC-13 F01-F07 (接收方流程)
 * - frontend/apps/h5/src/pages/Shared/SharedView.tsx (H5 reference · 不复制)
 *
 * 4 态机 (spec §6):
 *   LOADING (骨架屏)
 *     ├─ READY    · 200 ShareResponse · 渲染 banner + masked card + AI teaser + dual CTA
 *     ├─ EXPIRED  · 410 TOKEN_EXPIRED · 全屏挡板
 *     ├─ INVALID  · 404 TOKEN_INVALID / 5xx / network · 全屏挡板
 *     └─ REVOKED  · 403 TOKEN_REVOKED · 全屏挡板
 *
 * 入口: pages/shared/index?token=<HS256 jwt> · 由微信分享卡 deeplink / 二维码扫码触达
 *   wb://s/<token> deeplink P0 简化 · 微信小程序内只支持 query 形式 (sharePath=pages/shared/index?token=xxx)
 *
 * CTA 出口:
 *   - 主 CTA 「一键加入我的错题本 / 注册查看」 → navigateTo /pages/login/index?returnTo=...
 *   - 次 CTA 「我也试试看」 → navigateTo /pages/guest/capture/index (匿名拍题)
 *   - 挡板 CTA 「返回看看新功能」 → navigateTo /pages/welcome/index (spec §7 · 不落 login)
 *
 * 脱敏铁律 (UI 层):
 *   - 仅渲染 5 个白名单字段 (type/sharerNickMasked/ttlSec/signatureValid/maskedPayload.{stemSnippet,kpVisible,kpLockedCount,imgThumbBlurred})
 *   - 绝不渲染 PII (relation_id / sharer_student_id / student_email / original_image_url)
 *   - 写操作不开放 UI 入口 (评论/收藏/立即复习 · 网关 AnonFilter 已守 403)
 */
import { getShare, ShareError, type ShareResponse } from '../../src/api/share';

type PageState = 'LOADING' | 'READY' | 'EXPIRED' | 'INVALID' | 'REVOKED';

interface PageData {
  pageState: PageState;
  /** 原始 share token · 用于 returnTo 编码 · 错误态时仍可用 */
  token: string;
  /** 成功态下的脱敏 payload (仅 READY 态有值) */
  share: ShareResponse | null;
  /** 错误态原因码 (EXPIRED/INVALID/REVOKED 时设置) */
  errorCode: 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'TOKEN_REVOKED' | '';
  /** 挡板文案 (i18n key 镜像 spec.md §14) · 当前内嵌 zh-CN */
  blockerTitle: string;
  blockerCta: string;
}

Page<PageData, WechatMiniprogram.IAnyObject>({
  data: {
    pageState: 'LOADING',
    token: '',
    share: null,
    errorCode: '',
    blockerTitle: '',
    blockerCta: '返回看看新功能',
  },

  onLoad(options: Record<string, string | undefined>) {
    const token = (options.token || '').trim();
    this.setData({ token });

    if (!token) {
      // 没 token · 直接走 INVALID 挡板 (signed token 必须存在)
      this._setBlocker('TOKEN_INVALID', '分享链接无效');
      return;
    }

    this._fetchShare(token);
  },

  async _fetchShare(token: string) {
    this.setData({ pageState: 'LOADING' });
    try {
      const share = await getShare(token);
      this.setData({
        pageState: 'READY',
        share,
        errorCode: '',
      });
    } catch (err) {
      if (err instanceof ShareError) {
        if (err.code === 'TOKEN_EXPIRED') {
          this._setBlocker('TOKEN_EXPIRED', '这个分享已过期');
        } else if (err.code === 'TOKEN_REVOKED') {
          this._setBlocker('TOKEN_REVOKED', '分享者已撤销此分享');
        } else {
          this._setBlocker('TOKEN_INVALID', '分享链接无效');
        }
      } else {
        // 兜底 network error · INVALID 挡板
        console.error('[p-shared] unexpected error', err);
        this._setBlocker('TOKEN_INVALID', '分享链接无效');
      }
    }
  },

  _setBlocker(code: 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'TOKEN_REVOKED', title: string) {
    const pageStateMap: Record<typeof code, PageState> = {
      TOKEN_EXPIRED: 'EXPIRED',
      TOKEN_INVALID: 'INVALID',
      TOKEN_REVOKED: 'REVOKED',
    };
    this.setData({
      pageState: pageStateMap[code],
      errorCode: code,
      blockerTitle: title,
      share: null,
    });
  },

  // ── CTA handlers ─────────────────────────────────────────────

  /**
   * 主 CTA 「一键加入我的错题本 / 注册查看」
   * spec §7 出口: router push /auth?returnTo=/s/<token>
   * MP 等价: wx.navigateTo '/pages/login/index?returnTo=...'
   *
   * returnTo 编码后再 encodeURIComponent 一次 · 避免内层 ?token=xxx 被 query 解析截断
   */
  onCtaRegister() {
    const { token } = this.data;
    const inner = `/pages/shared/index?token=${token}`;
    const returnTo = encodeURIComponent(inner);
    wx.navigateTo({ url: `/pages/login/index?returnTo=${returnTo}` });
  },

  /**
   * 次 CTA 「我也试试看」 · 走匿名拍题入口
   */
  onCtaTryGuest() {
    wx.navigateTo({ url: '/pages/guest/capture/index' });
  },

  /**
   * 挡板 CTA 「返回看看新功能」 → P-LANDING (spec §7 + §2A.3.1 节点 2 降级 · 不落 P00)
   */
  onBlockerCta() {
    wx.navigateTo({ url: '/pages/welcome/index' });
  },

  /**
   * Nav 顶部 「登录」 胶囊 (AnonShell · spec §3 AnonShell.onSignIn)
   * 等价主 CTA · 收口到同一入口
   */
  onSignInTap() {
    this.onCtaRegister();
  },
});
