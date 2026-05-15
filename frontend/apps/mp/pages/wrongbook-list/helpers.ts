/**
 * P05 wrongbook-list pure helpers (no wx / Page dependency)
 * Extracted for unit testing.
 */
import type { WrongQuestionListItem } from '../../src/api/wrongbook';

export const SUBJECT_LABEL: Record<string, string> = {
  math: '数学', physics: '物理', chemistry: '化学', english: '英语', chinese: '语文',
};

export const SUBJECT_COLOR: Record<string, string> = {
  math: '#007AFF', physics: '#FF9500', chemistry: '#5856D6', english: '#34C759', chinese: '#FF3B30',
};

export const MASTERY_CONFIG: Record<string, { text: string; color: string }> = {
  NOT_MASTERED: { text: '未掌握', color: 'red' },
  PARTIAL: { text: '部分', color: 'orange' },
  MASTERED: { text: '已掌握', color: 'green' },
};

export function formatDueLabel(item: WrongQuestionListItem): string {
  const now = Date.now();
  const due = new Date(item.nextDueAt).getTime();
  const diffMs = due - now;
  const stage = `T${item.nodeStage}`;

  if (diffMs < 0) return `${stage} · 已逾期`;
  if (diffMs < 3600000) return `${stage} · ${Math.ceil(diffMs / 60000)} 分钟后`;
  if (diffMs < 3600000 * 2) return `${stage} · 1 小时后`;
  if (diffMs < 86400000) return `${stage} · ${Math.floor(diffMs / 3600000)} 小时后`;
  if (diffMs < 86400000 * 2) return `${stage} · 明日 09:00`;
  return `${stage} · ${Math.ceil(diffMs / 86400000)} 天后`;
}

export function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60000) return '刚刚';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} 分钟前`;
  if (diffMs < 86400000) {
    const d = new Date(iso);
    return `今日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} 入库`;
  }
  if (diffMs < 86400000 * 2) return '昨天';
  return `${Math.floor(diffMs / 86400000)} 天前`;
}

export function buildStarsLabel(difficulty: number): string {
  return '★'.repeat(Math.max(0, Math.min(5, difficulty)));
}

export function enrichItem(item: WrongQuestionListItem) {
  const mc = MASTERY_CONFIG[item.masteryLabel] || MASTERY_CONFIG.NOT_MASTERED;
  return {
    ...item,
    subjectLabel: SUBJECT_LABEL[item.subject] || item.subject,
    subjectColor: SUBJECT_COLOR[item.subject] || '#007AFF',
    masteryText: mc.text,
    masteryColor: mc.color,
    starsLabel: buildStarsLabel(item.difficulty),
    stemShort: item.stemSnippet.slice(0, 20),
    timeAgo: formatTimeAgo(item.createdAt),
    dueLabel: formatDueLabel(item),
    stageDots: Array.from({ length: 6 }, (_, i) => ({
      idx: i,
      cls: i < item.nodeStage - 1 ? 'sb sb-done' : i === item.nodeStage - 1 ? 'sb sb-now' : 'sb',
    })),
  };
}
