/**
 * "今日" 判定 · 跨页共享 · P07 + P-HOME 必须用同一份口径.
 *
 * 业务真相 (review_plan 是 cyclic):
 *   每次 grade 把 completedAt 更新为该时刻 + next_due_at 推到下一 T 级未来.
 *   同一行被反复 grade · completedAt 是 "上次 grade 时刻" (历史指针),
 *   不是 "本次到期已完成".
 *
 * 正确判定: completedAt 落在今日窗口 (用户本地 tz today_start ≤ c) 才算今日已 grade.
 *
 * 之前 P07 + P-HOME 各写一份独立实现 · 改一处忘改另一处立刻撕裂 · 此 util 给"结构性保证".
 */

/** 本地 tz 的今日 00:00 (毫秒). */
export function getTodayStartMs(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * "本次到期已 grade" 判定 · 用于 P07/P-HOME doneCount/progress 计算.
 *
 * 示例:
 *   - 昨晚 22:50 grade → completedAt = 昨晚 + next_due_at 推到今晚 22:50
 *   - 今日打开 P07 看到该节点: completedAt < today_start → false → "未开始"
 *   - 今晚 22:50 再 grade → completedAt = 今晚 + next_due_at 推到 +2d
 *   - completedAt >= today_start → true → "已完成"
 */
export function isCompletedToday(
  completedAt: string | null | undefined,
  now: Date
): boolean {
  if (!completedAt) return false;
  const t = new Date(completedAt).getTime();
  if (isNaN(t)) return false;
  return t >= getTodayStartMs(now);
}
