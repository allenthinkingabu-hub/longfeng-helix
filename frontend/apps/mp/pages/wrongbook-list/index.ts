/**
 * P05 错题本列表 · 1:1 mirror design/mockups/wrongbook/05_wrongbook_list.html
 * trace: design/mockups/wrongbook/05_wrongbook_list.html · H5 WrongbookList/index.tsx
 *
 * State machine: LOADING → EMPTY | LIST | ERROR
 * API: GET /api/wb/questions (wrongbook-service :8082)
 */
import { listWrongQuestions } from '../../src/api/wrongbook';
import { enrichItem } from './helpers';
import { TEST_IDS } from '@longfeng/testids';

// ─── Page data shape ─────────────────────────────────────────

interface PageData {
  testIds: typeof TEST_IDS.wrongbookList;
  pageState: 'LOADING' | 'LIST' | 'EMPTY' | 'ERROR';
  items: ReturnType<typeof enrichItem>[];
  totalCount: number;
  activeSubject: string;
  activeMastery: string;
  highlightQid: string;
  subjectCounts: Record<string, number>;
  masteryCounts: { notMastered: number; partial: number; mastered: number };
}

// ─── Page ────────────────────────────────────────────────────

Page<PageData, WechatMiniprogram.IAnyObject>({
  data: {
    testIds: TEST_IDS.wrongbookList,
    pageState: 'LOADING',
    items: [],
    totalCount: 0,
    activeSubject: '',
    activeMastery: '',
    highlightQid: '',
    subjectCounts: {},
    masteryCounts: { notMastered: 0, partial: 0, mastered: 0 },
  },

  onLoad(options: Record<string, string | undefined>) {
    const highlightQid = options.highlight || '';
    this.setData({ highlightQid });
    this._fetchList();
  },

  async _fetchList() {
    this.setData({ pageState: 'LOADING' });
    try {
      const params: Record<string, unknown> = { page: 1, size: 50 };
      if (this.data.activeSubject) {
        (params as Record<string, string>).subject = this.data.activeSubject;
      }
      if (this.data.activeMastery) {
        (params as Record<string, string>).mastery = this.data.activeMastery;
      }

      const resp = await listWrongQuestions(params as Parameters<typeof listWrongQuestions>[0]);

      if (!resp.items || resp.items.length === 0) {
        this.setData({ pageState: 'EMPTY', items: [], totalCount: 0 });
        return;
      }

      const items = resp.items.map(enrichItem);

      // Compute mastery counts from full list
      const masteryCounts = { notMastered: 0, partial: 0, mastered: 0 };
      const subjectCounts: Record<string, number> = {};
      for (const it of resp.items) {
        if (it.masteryLabel === 'NOT_MASTERED') masteryCounts.notMastered++;
        else if (it.masteryLabel === 'PARTIAL') masteryCounts.partial++;
        else if (it.masteryLabel === 'MASTERED') masteryCounts.mastered++;
        subjectCounts[it.subject] = (subjectCounts[it.subject] || 0) + 1;
      }

      this.setData({
        pageState: 'LIST',
        items,
        totalCount: resp.total,
        masteryCounts,
        subjectCounts,
      });
    } catch (err) {
      console.error('[P05] fetchList error:', err);
      this.setData({ pageState: 'ERROR' });
    }
  },

  onSubjectTap(e: WechatMiniprogram.TouchEvent) {
    const subject = e.currentTarget.dataset.subject as string;
    this.setData({ activeSubject: subject === this.data.activeSubject ? '' : subject });
    this._fetchList();
  },

  onMasteryTap(e: WechatMiniprogram.TouchEvent) {
    const mastery = e.currentTarget.dataset.mastery as string;
    this.setData({ activeMastery: mastery === this.data.activeMastery ? '' : mastery });
    this._fetchList();
  },

  onCardTap(e: WechatMiniprogram.TouchEvent) {
    const qid = e.currentTarget.dataset.qid as string;
    wx.navigateTo({ url: `/pages/result/index?qid=${qid}` });
  },

  onCaptureTap() {
    wx.navigateTo({ url: '/pages/capture/index' });
  },

  onRetryTap() {
    this._fetchList();
  },
});
