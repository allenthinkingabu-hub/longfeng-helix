// MP-CATCHUP-B-WELCOME · P-LANDING 真页 (替换 P0 placeholder)
// trace:
//   design/system/pages/P-LANDING-landing.spec.md (主依据 · §2 布局 / §3 组件 / §5 API / §6 状态机)
//   biz §2A.3.2 P-LANDING 规格卡 + biz §2B.12 F01-F07
//   design/mockups/wrongbook/14_landing.html (视觉锚)
//   frontend/apps/h5/src/pages/Landing/LandingPage.tsx (H5 reference · 不复制 · 沿 React 组件 → wxml sections)
//
// 状态机 (spec §6 + H5 reference 取 5 态):
//   LOADING            — 初始 + bootstrap fetch 中 · 仅 hero + skeleton
//   READY              — samples + kpi 都 fulfilled · 全布局
//   DEGRADED-samples   — samples reject · kpi ok    · 隐藏 samples · 仍可 CTA
//   DEGRADED-kpi       — samples ok     · kpi reject · 隐藏 KPI bar · 仍可 CTA
//   DEGRADED-both      — 两都 reject · banner 提示 · 仍可 CTA
//
// 关键 decision (双脑回看 coder-agent.md §6 E2E DoD + CLAUDE.md Rule 11):
//   (a) Promise.allSettled · 部分降级不阻塞 (与 H5 同源)
//   (b) 双 CTA 不论状态都可点 (CTA dock sticky · biz §2A.3.2 性能预算: CTA 永远 1.5s 内可点)
//   (c) openSample → 用 wx.showModal 简化 (scope_in 4(e) · 半屏 overlay 留 P1)
//   (d) 双 CTA 跳: 主 → /pages/guest/capture/index (team C); 次 → /pages/login/index (team A)
//       两 placeholder 已存在 (Phase 0 0857c9e), 不会 404

interface LandingSampleVM {
  subject: string;
  stemText: string;
  knowledgePoints: string[];
  errorReason: string;
  correction: string;
}

interface KpiVM {
  cumulativeQuestions: number;
  dailyAnalyses: number;
  happyUsers: number;
}

type LandingPhase =
  | 'LOADING'
  | 'READY'
  | 'DEGRADED-samples'
  | 'DEGRADED-kpi'
  | 'DEGRADED-both';

import { getSamples, getKpi, type LandingSample, type KpiResponse } from '../../src/api/landing';

declare const wx: any;

Page({
  data: {
    phase: 'LOADING' as LandingPhase,
    samples: [] as LandingSampleVM[],
    kpi: null as KpiVM | null,
    // 派生 (避免 wxml 表达式): show* / 千分化 KPI 显示
    showSamples: false,
    showKpi: false,
    showDegradedBanner: false,
    degradedMsg: '',
    kpiQuestionsM: '0.0',
    kpiDailyK: '0',
    kpiUsersK: '0',
  },

  onLoad() {
    void this._bootstrap();
  },

  /**
   * 状态机映射 (spec §6) · 并行 fetch 部分降级
   *
   * NOTE: 不用 Promise.allSettled · 项目 tsconfig lib=ES2017 不含 PromiseSettledResult
   *       (与 pages/home/index.ts 同决策 · L138 注释)
   *       → .catch(() => undefined) 等价语义 · undefined = rejected
   */
  async _bootstrap(): Promise<void> {
    const [samplesVal, kpiVal] = await Promise.all([
      getSamples('default').catch(() => undefined),
      getKpi().catch(() => undefined),
    ]);
    const samplesOk = samplesVal !== undefined;
    const kpiOk = kpiVal !== undefined;

    let phase: LandingPhase;
    if (samplesOk && kpiOk) phase = 'READY';
    else if (!samplesOk && !kpiOk) phase = 'DEGRADED-both';
    else if (!samplesOk) phase = 'DEGRADED-samples';
    else phase = 'DEGRADED-kpi';

    const samples: LandingSampleVM[] = samplesOk
      ? (samplesVal as LandingSample[]).map((s) => ({
          subject: s.subject,
          stemText: s.stemText,
          knowledgePoints: s.knowledgePoints || [],
          errorReason: s.errorReason,
          correction: s.correction,
        }))
      : [];
    const kpi: KpiVM | null = kpiOk ? (kpiVal as KpiResponse) : null;

    const showSamples = samplesOk;
    const showKpi = kpiOk;
    const showDegradedBanner = !samplesOk || !kpiOk;
    let degradedMsg = '';
    if (phase === 'DEGRADED-samples') {
      degradedMsg = '样例加载失败 · 直接试试看 →';
    } else if (phase === 'DEGRADED-kpi') {
      degradedMsg = '统计数据暂时无法加载 · 不影响您体验 AI 错题分析';
    } else if (phase === 'DEGRADED-both') {
      degradedMsg = '网络不稳 · CTA 仍可点击进入';
    }

    // KPI 千分化 (避免 wxml filter)
    const kpiQuestionsM = kpi ? (kpi.cumulativeQuestions / 1_000_000).toFixed(1) : '0.0';
    const kpiDailyK = kpi ? Math.round(kpi.dailyAnalyses / 1000).toString() : '0';
    const kpiUsersK = kpi ? Math.round(kpi.happyUsers / 1000).toString() : '0';

    this.setData({
      phase,
      samples,
      kpi,
      showSamples,
      showKpi,
      showDegradedBanner,
      degradedMsg,
      kpiQuestionsM,
      kpiDailyK,
      kpiUsersK,
    });
  },

  /** 主 CTA "试试看" → P-GUEST-CAPTURE (team C scope) */
  onTryGuest() {
    console.log('anon_landing_cta_try'); // P0 埋点 · P1 改 sendBeacon
    wx.navigateTo({ url: '/pages/guest/capture/index' });
  },

  /** 次 CTA "已有账号" → P00 登录 (team A scope) */
  onLogin() {
    console.log('anon_landing_cta_login');
    wx.navigateTo({ url: '/pages/login/index' });
  },

  /** Tap 样例 chip → wx.showModal (P0 简化 · SampleOverlay 留 P1) */
  openSample(e: { currentTarget: { dataset: { idx: string | number } } }) {
    const idx = Number(e.currentTarget.dataset.idx);
    const s = (this.data as { samples: LandingSampleVM[] }).samples[idx];
    if (!s) return;
    console.log('anon_landing_sample_open', s.subject);
    wx.showModal({
      title: `${s.subject} · 真实样例`,
      content: `题干: ${s.stemText}\n\n错因: ${s.errorReason}\n\n纠正: ${s.correction}`,
      showCancel: false,
      confirmText: '我知道了',
    });
  },

  /** ParentHint tap · P1 接 P-OBSERVER · 现 toast 占位 */
  onParentHint() {
    wx.showToast({ title: '家长入口 · 即将开放', icon: 'none' });
  },
});
