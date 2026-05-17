package com.longfeng.reviewplan.dto;

import java.util.List;

/**
 * P-HOME 「最近消息」3 条聚合 · 替代之前 FE 写死 MVP_MESSAGES (含 "妈妈分享" "免打扰更新" 假数据).
 *
 * <p>biz §2A.4 P-HOME 「消息聚合」原设计上游来自 message-service / event-detail-service ·
 * 这俩服务 MVP 不存在. 短期方案: 从现有数据 (review_outcome / review_plan / wrong_item) 派生 3 条:
 * 1. 下次复习提醒 (next due plan)
 * 2. 本周新增错题 (本周首条 wrong_item.created_at)
 * 3. 最近遗忘事件 (review_outcome quality=0 latest)
 *
 * <p>FE schema 不变 · 仍是 {title, subtitle, time, icon, iconColor, theme}.
 * 数据不足 (< 3 条) 时返回实际条数 · 不补假 placeholder.
 */
public record MessagesResp(
    List<MessageItem> messages
) {
    public record MessageItem(
        String title,
        String subtitle,
        String time,
        String icon,       // van-icon name
        String iconColor,  // hex
        String theme       // 'ind' / 'pnk' / 'tea' (FE wxss class)
    ) {}
}
