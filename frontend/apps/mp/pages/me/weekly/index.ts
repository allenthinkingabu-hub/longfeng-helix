/**
 * P-WEEKLY-REVIEW · 本周回顾详情页 (SC-16-T02)
 *
 * trace:
 * - biz/features/P-WEEKLY-REVIEW__weekly-review.md §2A.4 + §2B.17 SC-16
 * - design/system/pages/P-WEEKLY-REVIEW-weekly-review.spec.md §2/§3/§4/§5/§6/§7/§9/§12/§13
 * - design/mockups/wrongbook/14_weekly_review.html (canonical · 14 testid)
 *
 * 状态机 (§6): LOADING → READY | EMPTY | ERROR
 * API (§5): GET /api/home/weekly (X-User-Id Header)
 * Entry: P-HOME .bento「查看全部 ›」 (mockup 01_home_v2.html line 291)
 * Exit:  Tap weekly-weak-kp-* → wx.navigateTo /pages/wrongbook-list/index?kpId=KP-XXX (INV-5)
 *        EMPTY CTA → wx.switchTab /pages/capture/index (capture 在 tabBar.list)
 *        Back → wx.navigateBack
 */

import { TEST_IDS } from '@longfeng/testids';
import { track, WEEKLY_EVENTS } from '@longfeng/telemetry';
import { getWeeklyReview, type WeeklyReviewData } from '../../../src/api/weekly';
import {
  formatRangeLabel,
  formatMasteryPct,
  formatDeltaText,
  computeDeltaDirection,
  buildSparklinePath,
  buildSubjectRadarSvg,
  computeWeekLabel,
} from './helpers';

type PageState = 'LOADING' | 'READY' | 'EMPTY' | 'ERROR';

// MVP studentId · 与 P-HOME / T01 backend IT 模式一致 (X-User-Id Header)
// 登录 SC-00 上线时改读 store · 当前固定 stu123 (test-cases.md Case 1 Given)
const MVP_STUDENT_ID = '1';

interface ViewModelHero {
  /** masteryRate * 100 取整 + '%' · null 显 '—%' */
  masteryRateText: string;
  /** '+6' / '-3' · null 显 '' */
  deltaText: string;
  /** 'up' | 'down' | 'flat' · 'flat' 时 chip 仍渲染但不显示箭头 */
  deltaDirection: 'up' | 'down' | 'flat';
  /** A11Y · sr-only 文本节点 · "较上周下跌 3 个百分点" */
  deltaSrText: string;
  /** svg path d 字符串 · null 索引断笔 */
  sparklinePath: string;
  /** svg viewBox · 固定 300x40 */
  sparklineViewBox: string;
}

interface ViewModelWeakKp {
  kpId: string;
  kpName: string;
  subject: string;
  recentMissCount: number;
  rank: number;
  /** rank-1 高亮 · rank-2/3 outline */
  highlight: boolean;
  ctaLabel: string;
}

Page({
  data: {
    testIds: TEST_IDS.weekly,
    pageState: 'LOADING' as PageState,

    // §4.1 page-level state
    week: '',
    rangeLabel: '',
    weekLabel: '',

    // Hero view-model
    hero: null as ViewModelHero | null,

    // Subject radar svg
    radarSvgUri: '',
    radarLegend: [] as Array<{ subject: string; masteryRate: number; color: string }>,

    // Weak KPs (max 3 · rank-1 高亮)
    weakKps: [] as ViewModelWeakKp[],

    // Stats trio
    stats: { reviewedCount: 0, reviewedDurationMin: 0, newCount: 0 },

    // Failed top 5
    failedTop: [] as Array<{ questionId: string; subject: string; missCount: number; subjectLabel: string }>,

    // AI insight
    aiInsight: null as { text: string; insightId: string; generatedAt: string } | null,

    // Error 态
    errorCode: 0,
  },

  // 内部 raw data (跨页一致性 verify 用 · spec.md TC-6(f))
  // 字段声明 (init=null/undefined · 非 simple value 必须 onLoad 内赋值 ·
  // 否则 WeChat MP 框架 deep clone page instance 时报警 + 在 canary 3.16.0
  // lib 下偶发触 navigateTo timeout · spec 锚 onLoad 后初始化)
  _rawData: null as WeeklyReviewData | null,
  _viewedWeakKps: null as Set<string> | null,

  onLoad() {
    // Set 是 non-simple value · 必须 onLoad 起始处赋值 (非 page-level 字面初始化)
    this._viewedWeakKps = new Set<string>();
    void this._fetchWeekly('home-banner');
  },

  onShow() {
    // 二次进入不重新拉 (避免抖动) · ERROR 态由 retry button 触发
    track(WEEKLY_EVENTS.view, {
      week: this.data.week,
      from: 'home-banner',
      empty: this.data.pageState === 'EMPTY',
    });
  },

  /**
   * Fetch + 状态机切换
   * @param from 'home-banner' | 'deeplink' | 'push' · 用于 weekly_view 埋点
   */
  async _fetchWeekly(from: 'home-banner' | 'deeplink' | 'push' | 'retry'): Promise<void> {
    this.setData({ pageState: 'LOADING' as PageState });
    try {
      const data = await getWeeklyReview(MVP_STUDENT_ID);
      this._rawData = data;

      // §6 状态转移 (2026-05-18 用户决策修):
      // 旧: reviewedCount === 0 → EMPTY · 但 reviewedCount 来自 wb_review_record
      //     (我 SC-16-T01 加的并行表 · 生产真数据在 review_outcome 表里)
      //     → 用户有真复习记录但页面误判 EMPTY · 跟复习页 49% / P-HOME 42% 矛盾
      // 新: 任一活动信号 (reviewedCount > 0 OR masteryRate != null OR newCount > 0)
      //     都认为有数据 · 进 READY · 让 hero (masteryRate + sparkline 真值已 wire)
      //     正常显示 · 其他 section 暂时可能空 (待 backend 全表切到 review_outcome)
      const hasActivity =
          data.stats.reviewedCount > 0
          || data.hero.masteryRate !== null
          || (data.stats.newCount ?? 0) > 0;
      const isEmpty = !hasActivity;
      const nextState: PageState = isEmpty ? 'EMPTY' : 'READY';

      if (isEmpty) {
        this.setData({
          pageState: nextState,
          week: data.week,
          rangeLabel: formatRangeLabel(data.range),
          weekLabel: computeWeekLabel(data.week),
        });
        // weekly_view {empty: true}
        track(WEEKLY_EVENTS.view, { week: data.week, from, empty: true });
        return;
      }

      // READY 态 view-model 构建
      const heroVm = this._buildHeroViewModel(data);
      const radarVm = this._buildRadarViewModel(data);
      const weakKpsVm = this._buildWeakKpsViewModel(data);
      const failedTopVm = this._buildFailedTopViewModel(data);

      this.setData({
        pageState: 'READY' as PageState,
        week: data.week,
        rangeLabel: formatRangeLabel(data.range),
        weekLabel: computeWeekLabel(data.week),
        hero: heroVm,
        radarSvgUri: radarVm.svgUri,
        radarLegend: radarVm.legend,
        weakKps: weakKpsVm,
        stats: data.stats,
        failedTop: failedTopVm,
        aiInsight: data.aiInsight,
      });

      // §12 埋点: weekly_view + weekly_data_render
      track(WEEKLY_EVENTS.view, { week: data.week, from, empty: false });
      track(WEEKLY_EVENTS.dataRender, {
        ms: 0, // best-effort · IDE automator timer 失真 · 留 0
        masteryRate: data.hero.masteryRate ?? null,
        weakKPCount: data.weakKPs.length,
      });

      // §12 weekly_weak_kp_view · 3 个 KP 卡 IntersectionObserver 触发
      // MP 无 IntersectionObserver 标准 · 用 wx.createIntersectionObserver
      // 简化: mount 后即时触发 3 条 (spec.ts Case 1 Then (i) 期望 length === 3)
      // 防御: _viewedWeakKps 在 onLoad 赋值 · 若意外为 null 则懒初始化
      if (!this._viewedWeakKps) this._viewedWeakKps = new Set<string>();
      for (const wk of weakKpsVm) {
        if (!this._viewedWeakKps.has(wk.kpId)) {
          this._viewedWeakKps.add(wk.kpId);
          track(WEEKLY_EVENTS.weakKpView, { kpId: wk.kpId, rank: wk.rank });
        }
      }

      // AI insight view (mount 后 § P2 IntersectionObserver · MVP 同步上报)
      if (data.aiInsight) {
        track(WEEKLY_EVENTS.aiInsightView, { insightId: data.aiInsight.insightId });
      }
    } catch (err) {
      // 5xx / timeout / network → ERROR 态 · §6 + §9
      const errMsg = String(err);
      const errorCode = this._extractErrorCode(errMsg);
      this.setData({
        pageState: 'ERROR' as PageState,
        errorCode,
      });
    }
  },

  _buildHeroViewModel(data: WeeklyReviewData): ViewModelHero {
    const direction = computeDeltaDirection(data.hero.masteryDelta);
    return {
      masteryRateText: formatMasteryPct(data.hero.masteryRate),
      deltaText: formatDeltaText(data.hero.masteryDelta),
      deltaDirection: direction,
      deltaSrText: this._buildDeltaSrText(data.hero.masteryDelta, direction),
      sparklinePath: buildSparklinePath(data.hero.sparkline),
      sparklineViewBox: '0 0 300 40',
    };
  },

  _buildDeltaSrText(delta: number | null, direction: 'up' | 'down' | 'flat'): string {
    if (delta === null) return '本周尚无数据';
    const abs = Math.abs(Math.round(delta * 100));
    if (direction === 'up') return `较上周上升 ${abs} 个百分点`;
    if (direction === 'down') return `较上周下跌 ${abs} 个百分点`;
    return '较上周持平';
  },

  _buildRadarViewModel(data: WeeklyReviewData): {
    svgUri: string;
    legend: Array<{ subject: string; masteryRate: number; color: string }>;
  } {
    const subjects = data.subjectRadar;
    const svg = buildSubjectRadarSvg(subjects);
    return {
      svgUri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      legend: subjects.map((s, i) => ({
        subject: s.subject,
        masteryRate: Math.round(s.masteryRate * 100),
        color: SUBJECT_COLORS[s.subject] || '#8E8E93',
      })),
    };
  },

  _buildWeakKpsViewModel(data: WeeklyReviewData): ViewModelWeakKp[] {
    return data.weakKPs.slice(0, 3).map((wk, idx) => ({
      kpId: wk.kpId,
      kpName: wk.kpName,
      subject: wk.subject,
      recentMissCount: wk.recentMissCount,
      rank: idx + 1,
      highlight: idx === 0,
      ctaLabel: idx === 0 ? '立即专练' : '练一次',
    }));
  },

  _buildFailedTopViewModel(data: WeeklyReviewData): Array<{
    questionId: string;
    subject: string;
    subjectLabel: string;
    missCount: number;
    thumbnailUrl: string;
  }> {
    return data.failedTop.slice(0, 5).map((q) => ({
      questionId: q.questionId,
      subject: q.subject,
      subjectLabel: SUBJECT_LABELS[q.subject] || q.subject,
      missCount: q.missCount,
      // 2026-05-18 thumbnail wire · 空时给空串让 wxml wx:if 走 fallback 灰底
      thumbnailUrl: q.thumbnailUrl || '',
    }));
  },

  _extractErrorCode(errMsg: string): number {
    // httpJSON throws `HTTP ${statusCode}` · parse 数字
    const match = errMsg.match(/HTTP (\d+)/);
    return match ? parseInt(match[1], 10) : 500;
  },

  // ── 用户操作 handler ─────────────────────────────────────────

  onWeakKpTap(e: WechatMiniprogram.TouchEvent): void {
    const kpId = e.currentTarget.dataset.kpid as string;
    const rank = e.currentTarget.dataset.rank as number;
    if (!kpId) return;

    // §12 埋点
    track(WEEKLY_EVENTS.weakKpTap, { kpId, rank });

    // INV-5: 必带 kpId · 因 wrongbook-list 在 tabBar (wx.navigateTo 对 tab 页静默失败)
    // 改用 wx.switchTab + wx.setStorageSync 传递 weakKpIntent · 接收端 onShow 读 storage
    // spec drift surface (2026-05-17 E2E TC-2 抓获): spec §7 字面 navigateTo
    //   与 app.json tabBar.list 冲突 · 已落代码注释 + adversarial.md 待 TL 决策
    wx.setStorageSync('weakKpIntent', { kpId, rank, ts: Date.now() });
    wx.switchTab({
      url: '/pages/wrongbook-list/index',
    });
  },

  onFailedQTap(e: WechatMiniprogram.TouchEvent): void {
    const questionId = e.currentTarget.dataset.qid as string;
    if (!questionId) return;
    track(WEEKLY_EVENTS.failedQTap, { qid: questionId });
    wx.navigateTo({ url: `/pages/result/index?qid=${encodeURIComponent(questionId)}` });
  },

  onRetryTap(): void {
    track(WEEKLY_EVENTS.retry, { errorCode: this.data.errorCode });
    void this._fetchWeekly('retry');
  },

  onEmptyCtaTap(): void {
    track(WEEKLY_EVENTS.emptyCtaTap, {});
    // capture 在 app.json tabBar.list 第 3 项 · 必须 switchTab 不是 navigateTo
    wx.switchTab({ url: '/pages/capture/index' });
  },

  onBackTap(): void {
    track(WEEKLY_EVENTS.back, { from: 'manual' });
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) });
  },

  onShareTap(): void {
    // P2 预留: weekly_share · MVP 不实现分享
    track(WEEKLY_EVENTS.share, { week: this.data.week, channel: 'wechat' });
    wx.showToast({ title: '分享功能即将上线', icon: 'none', duration: 1800 });
  },
});

// ── 学科色板 (复用 P-HOME helpers SUBJECT_COLORS 同源) ────────────
const SUBJECT_COLORS: Record<string, string> = {
  math: '#007AFF',
  physics: '#5856D6',
  english: '#FF9500',
  chinese: '#FF3B30',
  chemistry: '#34C759',
  biology: '#30B0C7',
};

const SUBJECT_LABELS: Record<string, string> = {
  math: '数学',
  physics: '物理',
  english: '英语',
  chinese: '语文',
  chemistry: '化学',
  biology: '生物',
};
