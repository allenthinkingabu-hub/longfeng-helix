// MP-CATCHUP-B-WELCOME · P-LANDING 真页 (严格按 mockup + spec 重写 2026-05-18)
// trace:
//   design/mockups/wrongbook/14_landing.html (视觉真相 · 字符级)
//   design/system/pages/P-LANDING-landing.spec.md (主依据 · §2 布局 / §3 组件 / §5 API / §6 状态机)
//   biz §2A.3.2 P-LANDING 规格卡 + biz §2B.12 F01-F07
//
// 状态机 (spec §6):
//   LOADING / READY / DEGRADED-samples / DEGRADED-kpi / DEGRADED-both
//
// 重写 decisions (CLAUDE.md Rule 7 + 12):
//   (a) KPI 改静态性能信号 (4.2s/T0-T6/98%) · 不再绑后端 LandingKpiDto 业务规模
//   (b) Samples 横滑 + 卡片字段从 mockup (subject+grade / 公式 / 错因 / 知识点 / Tn chip)
//   (c) openSample → 半屏 P-SAMPLE overlay (替原 wx.showModal · 与 spec §3 对齐)
//   (d) AnonymousShell 顶栏 (Logo + 登录胶囊) · 含 statusBarHeight 计算

import { getSamples, getKpi } from '../../src/api/landing';
import {
  deriveLandingState,
  type LandingPhase,
  type LandingSampleVM,
  type KpiVM,
} from './helpers';

declare const wx: any;
declare const getApp: any;

Page({
  data: {
    // A+ entry guard · 默认 false · wxml wx:if 隐藏全页防闪烁
    // 已登录: 检 jwt → reLaunch home (期间页面白屏 · 不闪 landing)
    // 未登录: setData({authChecked:true}) 解锁渲染 landing
    authChecked: false,
    phase: 'LOADING' as LandingPhase,
    samples: [] as LandingSampleVM[],
    kpi: null as KpiVM | null,
    showSamples: false,
    showKpi: true,
    showDegradedBanner: false,
    degradedMsg: '',
    // backward-compat KPI 显示 (老 e2e 兼容)
    kpiQuestionsM: '0.0',
    kpiDailyK: '0',
    kpiUsersK: '0',
    // statusBar padding (custom nav · 防 notch)
    statusBarHeight: 44,
    // P-SAMPLE 浮层
    sampleOverlayOpen: false,
    sampleOpen: null as LandingSampleVM | null,
  },

  onLoad() {
    // ─── A+ entry guard · 必须最先跑 · 已登录用户直接跳 home 不渲染 landing ───
    const jwt = wx.getStorageSync('jwt');
    if (jwt) {
      wx.reLaunch({ url: '/pages/home/index' });
      return; // 不 setData · wxml 保持空白防闪烁
    }
    // 未登录 · 解锁 wxml 渲染
    this.setData({ authChecked: true });

    try {
      // wx.getWindowInfo() 替代 deprecated getSystemInfoSync (console warning fix)
      const sys =
        (wx.getWindowInfo && wx.getWindowInfo()) ||
        (wx.getSystemInfoSync && wx.getSystemInfoSync()) ||
        {};
      const sb = typeof sys.statusBarHeight === 'number' ? sys.statusBarHeight : 44;
      this.setData({ statusBarHeight: sb });
    } catch (_) {
      // ignore · default 44 already in data
    }
    void this._bootstrap();
  },

  /**
   * 状态机 (spec §6) · 并行 fetch · 部分降级不阻塞 (与 H5 同源)
   * Promise.allSettled 替代 Promise.all + .catch (避免 ES2017 lib 缺失)
   */
  async _bootstrap(): Promise<void> {
    const [samplesVal, kpiVal] = await Promise.all([
      getSamples('default').catch(() => undefined),
      getKpi().catch(() => undefined),
    ]);
    const derived = deriveLandingState(samplesVal, kpiVal);
    this.setData(derived);
  },

  /** 主 CTA "试一次 · 无需注册" → P-GUEST-CAPTURE (team C scope) */
  onTryGuest() {
    console.log('anon_landing_cta_try'); // P0 埋点 · P1 改 sendBeacon
    // 如浮层开着 · 先关
    if ((this.data as { sampleOverlayOpen: boolean }).sampleOverlayOpen) {
      this.setData({ sampleOverlayOpen: false, sampleOpen: null });
    }
    wx.navigateTo({ url: '/pages/guest/capture/index' });
  },

  /** 次 CTA "已有账号 · 直接登录" + 顶部胶囊 → P00 (team A scope) */
  onLogin() {
    console.log('anon_landing_cta_login');
    wx.navigateTo({ url: '/pages/login/index' });
  },

  /** Tap 样例 chip → 开半屏 P-SAMPLE overlay (spec §3 SampleChips.onOpen) */
  openSample(e: { currentTarget: { dataset: { idx: string | number } } }) {
    const idx = Number(e.currentTarget.dataset.idx);
    const s = (this.data as { samples: LandingSampleVM[] }).samples[idx];
    if (!s) return;
    console.log('anon_landing_sample_open', s.subject);
    this.setData({ sampleOverlayOpen: true, sampleOpen: s });
  },

  /** 关闭 P-SAMPLE 浮层 (tap backdrop 或 × 按钮) */
  closeSample() {
    this.setData({ sampleOverlayOpen: false, sampleOpen: null });
  },

  /** 阻止浮层内 tap 冒泡到 backdrop (catchtap 即可 · 但保留方法签名) */
  _noop() {
    // intentionally empty · catchtap stops propagation
  },

  /** ParentHint tap · P1 接 P-OBSERVER · 现 toast 占位 */
  onParentHint() {
    wx.showToast({ title: '家长入口 · 即将开放', icon: 'none' });
  },
});
